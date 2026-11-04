import { sha256 as sha256Bytes } from '@noble/hashes/sha2.js';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import type { ContributionManifest, SignedEvent } from './types';
import type { PointChunk } from './chunks';
import type { Helia } from 'helia';

const RAW_CODEC = 0x55;
const EVENT_INDEX_KEY = 'gobai.contributions.events.v1';
const IDENTITY_KEY = 'gobai.contributions.identity.v1';
const PSEUDONYM_KEY = 'gobai.contributions.pseudonym.v1';
const BLOCK_CACHE_NAME = 'gobai-contribution-blocks-v1';
const CACHE_BLOCK_THRESHOLD = 1024 * 1024;
export const MAX_PSEUDONYM_LENGTH = 32;
export const POW_DIFFICULTY = 10;

export interface AnonymousIdentity {
  publicKey: string;
  privateKey: CryptoKey;
}

export function getSavedPseudonym(): string {
  return localStorage.getItem(PSEUDONYM_KEY) ?? '';
}

export function savePseudonym(value: string): string {
  const pseudonym = value.trim().slice(0, MAX_PSEUDONYM_LENGTH);
  if (pseudonym) localStorage.setItem(PSEUDONYM_KEY, pseudonym);
  else localStorage.removeItem(PSEUDONYM_KEY);
  return pseudonym;
}

let heliaPromise: Promise<Helia> | undefined;
let blockCachePromise: Promise<Cache> | undefined;

export async function getHelia() {
  if (!heliaPromise) {
    heliaPromise = Promise.all([import('helia'), import('blockstore-idb')])
      .then(([{ createHeliaLight }, { IDBBlockstore: Blockstore }]) => createHeliaLight({
        blockstore: new Blockstore('gobai-contributions-v1'),
        holdGcLock: false,
      }));
  }
  return heliaPromise;
}

export async function putBytes(bytes: Uint8Array): Promise<string> {
  const cid = CID.createV1(RAW_CODEC, await sha256.digest(bytes));
  await storeBlock(cid, bytes);
  return cid.toString();
}

export async function hasBlock(cidText: string): Promise<boolean> {
  const cached = await matchCachedBlock(cidText);
  return cached !== undefined || (await getHelia()).blockstore.has(CID.parse(cidText));
}

export async function listContributionBlocks(): Promise<string[]> {
  const cids = new Set<string>();
  for (const event of await readSignedEvents()) {
    cids.add(event.cid);
    if (event.kind === 'contribution') {
      const manifest = event.payload as unknown as ContributionManifest;
      cids.add(manifest.fileCid);
      manifest.chunkCids.forEach((cid) => cids.add(cid));
    }
  }
  return [...cids];
}

export async function importRemoteBlock(cidText: string, bytes: Uint8Array): Promise<void> {
  const cid = CID.parse(cidText);
  const digest = await sha256.digest(bytes);
  if (cid.code !== RAW_CODEC || cid.toString() !== CID.createV1(RAW_CODEC, digest).toString()) {
    throw new TypeError(`Le bloc reçu ne correspond pas au CID ${cidText}.`);
  }
  await storeBlock(cid, bytes);
  window.dispatchEvent(new CustomEvent('gobai-contribution-block', { detail: cidText }));
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as Omit<SignedEvent<Record<string, unknown>>, 'cid'>;
    if (
      candidate?.schemaVersion === 1
      && ['contribution', 'vote', 'comment'].includes(candidate.kind)
      && typeof candidate.publicKey === 'string'
      && typeof candidate.signature === 'string'
    ) {
      if (bytes.byteLength > 1024 * 1024) throw new RangeError(`Événement pair-à-pair trop volumineux : ${cidText}.`);
      const event = { ...candidate, cid: cidText } as SignedEvent<Record<string, unknown>>;
      if (!(await verifySignedEvent(event))) throw new TypeError(`Événement pair-à-pair invalide : ${cidText}.`);
      addToEventIndex(cidText);
      window.dispatchEvent(new CustomEvent('gobai-contribution-event', { detail: cidText }));
    }
  }
}

export async function putChunk(chunk: PointChunk): Promise<string> {
  const header = new TextEncoder().encode(JSON.stringify({
    key: chunk.key,
    bounds: chunk.bounds,
    pointCount: chunk.pointCount,
    levels: chunk.levels.map(({ stride, positions, colors }) => ({
      stride,
      positionBytes: positions.byteLength,
      colorBytes: colors.byteLength,
    })),
  }));
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, header.byteLength, false);
  const segments: Uint8Array[] = [prefix, header];
  for (const level of chunk.levels) {
    segments.push(new Uint8Array(level.positions.buffer, level.positions.byteOffset, level.positions.byteLength));
    segments.push(level.colors);
  }
  return putBytes(joinBytes(segments));
}

export async function getBytes(cidText: string): Promise<Uint8Array> {
  const cid = CID.parse(cidText);
  const cached = await matchCachedBlock(cidText);
  const bytes = cached
    ? new Uint8Array(await cached.arrayBuffer())
    : joinBytes(await collectBlock((await getHelia()).blockstore.get(cid)));
  if (cid.code !== RAW_CODEC || cid.toString() !== CID.createV1(RAW_CODEC, await sha256.digest(bytes)).toString()) {
    throw new TypeError(`Le contenu local ne correspond pas au CID ${cidText}.`);
  }
  return bytes;
}

export async function getChunk(cidText: string): Promise<PointChunk> {
  const bytes = await getBytes(cidText);
  if (bytes.byteLength < 4) throw new TypeError(`Chunk ${cidText} tronqué.`);
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  if (headerLength > bytes.byteLength - 4) throw new TypeError(`En-tête de chunk ${cidText} invalide.`);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength))) as {
    key: string;
    bounds: PointChunk['bounds'];
    pointCount: number;
    levels: Array<{ stride: number; positionBytes: number; colorBytes: number }>;
  };
  if (
    !Number.isSafeInteger(header.pointCount)
    || header.pointCount < 1
    || header.pointCount > 100_000
    || !Array.isArray(header.levels)
    || header.levels.length !== 3
    || !validBounds(header.bounds)
    || typeof header.key !== 'string'
    || header.key.length > 256
  ) {
    throw new TypeError(`Métadonnées de chunk ${cidText} invalides.`);
  }
  let offset = 4 + headerLength;
  const expectedStrides = [1, 4, 16];
  const levels = header.levels.map(({ stride, positionBytes, colorBytes }, index) => {
    const expectedCount = Math.ceil(header.pointCount / stride);
    if (
      stride !== expectedStrides[index]
      || !Number.isSafeInteger(positionBytes)
      || !Number.isSafeInteger(colorBytes)
      || positionBytes !== expectedCount * 12
      || colorBytes !== expectedCount * 4
      || offset + positionBytes + colorBytes > bytes.byteLength
    ) {
      throw new TypeError(`Niveau LOD invalide dans le chunk ${cidText}.`);
    }
    const positionsBytes = bytes.slice(offset, offset + positionBytes);
    offset += positionBytes;
    const colors = bytes.slice(offset, offset + colorBytes);
    offset += colorBytes;
    return {
      stride,
      positions: new Float32Array(positionsBytes.buffer),
      colors,
    };
  });
  if (offset !== bytes.byteLength) {
    throw new TypeError(`Taille de chunk incohérente pour ${cidText}.`);
  }
  return { key: header.key, bounds: header.bounds, pointCount: header.pointCount, levels };
}

export async function getIdentity(): Promise<AnonymousIdentity> {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (stored) {
    const identity = JSON.parse(stored) as { publicKey: string; privateKey: string };
    return {
      publicKey: identity.publicKey,
      privateKey: await crypto.subtle.importKey('pkcs8', toArrayBuffer(fromBase64(identity.privateKey)), { name: 'Ed25519' }, true, ['sign']),
    };
  }
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('raw', keys.publicKey),
    crypto.subtle.exportKey('pkcs8', keys.privateKey),
  ]);
  const publicKeyText = toBase64(new Uint8Array(publicKey));
  const privateKeyText = toBase64(new Uint8Array(privateKey));
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ publicKey: publicKeyText, privateKey: privateKeyText }));
  return { publicKey: publicKeyText, privateKey: keys.privateKey };
}

export async function exportIdentity(): Promise<Blob> {
  const identity = await getIdentity();
  const privateKey = await crypto.subtle.exportKey('pkcs8', identity.privateKey);
  return new Blob([JSON.stringify({
    format: 'gobai-ed25519-identity-v1',
    publicKey: identity.publicKey,
    privateKey: toBase64(new Uint8Array(privateKey)),
  }, null, 2)], { type: 'application/json' });
}

export async function importIdentity(serialized: string): Promise<AnonymousIdentity> {
  const parsed = JSON.parse(serialized) as {
    format?: string;
    publicKey?: string;
    privateKey?: string;
  };
  if (
    parsed.format !== 'gobai-ed25519-identity-v1'
    || typeof parsed.publicKey !== 'string'
    || typeof parsed.privateKey !== 'string'
  ) {
    throw new TypeError('Le fichier ne contient pas une identité Gobai Ed25519 reconnue.');
  }
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey('pkcs8', toArrayBuffer(fromBase64(parsed.privateKey)), { name: 'Ed25519' }, true, ['sign']),
    crypto.subtle.importKey('raw', toArrayBuffer(fromBase64(parsed.publicKey)), { name: 'Ed25519' }, false, ['verify']),
  ]);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const challengeBuffer = toArrayBuffer(challenge);
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, challengeBuffer);
  if (!(await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, signature, challengeBuffer))) {
    throw new TypeError('La clé privée exportée ne correspond pas à la clé publique.');
  }
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(parsed));
  return { publicKey: parsed.publicKey, privateKey };
}

export async function appendSignedEvent<T extends object>(
  identity: AnonymousIdentity,
  kind: SignedEvent<T>['kind'],
  payload: T,
): Promise<SignedEvent<T>> {
  const createdAt = new Date().toISOString();
  if (!validEventPayload(kind, payload as Record<string, unknown>)) {
    throw new TypeError(`Payload invalide pour l’événement « ${kind} ».`);
  }
  const nonce = await findProofOfWork(kind, identity.publicKey, createdAt, payload);
  const unsigned = {
    schemaVersion: 1 as const,
    kind,
    publicKey: identity.publicKey,
    createdAt,
    payload,
    nonce,
    difficulty: POW_DIFFICULTY,
  };
  const signature = toBase64(new Uint8Array(await crypto.subtle.sign(
    { name: 'Ed25519' },
    identity.privateKey,
    toArrayBuffer(new TextEncoder().encode(stableJson(unsigned))),
  )));
  const blockBytes = new TextEncoder().encode(stableJson({ ...unsigned, signature }));
  const cid = await putBytes(blockBytes);
  addToEventIndex(cid);
  const event: SignedEvent<T> = { ...unsigned, cid, signature };
  window.dispatchEvent(new CustomEvent('gobai-contribution-event', { detail: cid }));
  return event;
}

export async function readSignedEvents(): Promise<Array<SignedEvent<Record<string, unknown>>>> {
  const events: Array<SignedEvent<Record<string, unknown>>> = [];
  for (const cid of readEventIndex()) {
    const event = JSON.parse(new TextDecoder().decode(await getBytes(cid))) as Omit<SignedEvent<Record<string, unknown>>, 'cid'>;
    const complete = { ...event, cid };
    if (!(await verifySignedEvent(complete))) {
      throw new Error(`L’événement signé ${cid} est invalide.`);
    }
    events.push(complete);
  }
  return events;
}

export async function verifySignedEvent(event: SignedEvent<Record<string, unknown>>): Promise<boolean> {
  const { cid: _cid, signature, ...unsigned } = event;
  if (
    event.schemaVersion !== 1
    || event.difficulty !== POW_DIFFICULTY
    || !Number.isSafeInteger(event.nonce)
    || event.nonce < 0
    || typeof event.publicKey !== 'string'
    || typeof signature !== 'string'
    || !Number.isFinite(Date.parse(event.createdAt))
    || !validEventPayload(event.kind, event.payload)
  ) return false;
  if (!hasProofOfWork(proofJson(
    unsigned.kind,
    unsigned.publicKey,
    unsigned.createdAt,
    unsigned.payload,
    unsigned.nonce,
    unsigned.difficulty,
  ), unsigned.nonce, unsigned.difficulty)) return false;
  const publicKey = await crypto.subtle.importKey('raw', toArrayBuffer(fromBase64(event.publicKey)), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    publicKey,
    toArrayBuffer(fromBase64(signature)),
    toArrayBuffer(new TextEncoder().encode(stableJson(unsigned))),
  );
}

export function subscribeToEvents(listener: () => void): () => void {
  const onEvent = () => listener();
  const onBlock = () => listener();
  window.addEventListener('gobai-contribution-event', onEvent);
  window.addEventListener('gobai-contribution-block', onBlock);
  return () => {
    window.removeEventListener('gobai-contribution-event', onEvent);
    window.removeEventListener('gobai-contribution-block', onBlock);
  };
}

function readEventIndex(): string[] {
  const value = localStorage.getItem(EVENT_INDEX_KEY);
  if (!value) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((cid) => typeof cid !== 'string')) {
    throw new TypeError('Index local des événements de contribution invalide.');
  }
  return parsed;
}

async function storeBlock(cid: ReturnType<typeof CID.parse>, bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength >= CACHE_BLOCK_THRESHOLD && 'caches' in globalThis) {
    const cache = await getBlockCache();
    await cache.put(cacheRequest(cid.toString()), new Response(toArrayBuffer(bytes)));
    return;
  }
  const helia = await getHelia();
  await helia.blockstore.put(cid, bytes);
  await helia.pins.add(cid);
}

async function matchCachedBlock(cid: string): Promise<Response | undefined> {
  if (!('caches' in globalThis)) return undefined;
  const cache = await getBlockCache();
  return (await cache.match(cacheRequest(cid))) ?? undefined;
}

async function collectBlock(block: AsyncGenerator<Uint8Array> | Generator<Uint8Array>): Promise<Uint8Array[]> {
  const parts: Uint8Array[] = [];
  for await (const part of block) parts.push(part);
  return parts;
}

function validEventPayload(kind: string, payload: Record<string, unknown>): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (kind === 'vote') {
    return isContentCid(payload.contributionCid)
      && (payload.direction === 'up' || payload.direction === 'down')
      && validPseudonym(payload.pseudonym);
  }
  if (kind === 'comment') {
    return isContentCid(payload.contributionCid)
      && typeof payload.text === 'string'
      && payload.text.trim().length > 0
      && payload.text.length <= 1000
      && validPseudonym(payload.pseudonym)
      && (payload.parentCid === null || payload.parentCid === undefined || isContentCid(payload.parentCid));
  }
  if (kind !== 'contribution') return false;
  const manifest = payload as unknown as ContributionManifest;
  return manifest.schemaVersion === 1
    && typeof manifest.title === 'string'
    && manifest.title.length <= 100
    && typeof manifest.filename === 'string'
    && manifest.filename.length <= 255
    && isContentCid(manifest.fileCid)
    && Array.isArray(manifest.chunkCids)
    && manifest.chunkCids.length > 0
    && manifest.chunkCids.length <= 4096
    && manifest.chunkCids.every(isContentCid)
    && Number.isSafeInteger(manifest.pointCount)
    && manifest.pointCount > 0
    && manifest.pointCount <= 10_000_000
    && validBounds(manifest.bounds)
    && validAnchor(manifest.anchor)
    && Array.isArray(manifest.dimensionsMeters)
    && manifest.dimensionsMeters.length === 3
    && manifest.dimensionsMeters.every((value) => Number.isFinite(value) && value > 0)
    && (manifest.sourceDimensionsMeters === undefined
      || (Array.isArray(manifest.sourceDimensionsMeters)
        && manifest.sourceDimensionsMeters.length === 3
        && manifest.sourceDimensionsMeters.every((value) => Number.isFinite(value) && value > 0)))
    && (manifest.crsWkt === null || (typeof manifest.crsWkt === 'string' && manifest.crsWkt.length <= 1_000_000))
    && Number.isFinite(Date.parse(manifest.createdAt))
    && validPseudonym(manifest.pseudonym)
    && (manifest.previousVersionCid === null || isContentCid(manifest.previousVersionCid));
}

function validPseudonym(value: unknown): boolean {
  return value === undefined
    || (typeof value === 'string'
     && value.trim().length > 0
     && value.length <= MAX_PSEUDONYM_LENGTH);
}

function validBounds(bounds: unknown): bounds is ContributionManifest['bounds'] {
  if (!bounds || typeof bounds !== 'object') return false;
  const value = bounds as ContributionManifest['bounds'];
  return [value.minX, value.minY, value.minZ, value.maxX, value.maxY, value.maxZ].every(Number.isFinite)
    && value.minX <= value.maxX
    && value.minY <= value.maxY
    && value.minZ <= value.maxZ;
}

function validAnchor(anchor: unknown): anchor is ContributionManifest['anchor'] {
  if (!anchor || typeof anchor !== 'object') return false;
  const value = anchor as ContributionManifest['anchor'];
  return Number.isFinite(value.latitude) && value.latitude >= -90 && value.latitude <= 90
    && Number.isFinite(value.longitude) && value.longitude >= -180 && value.longitude <= 180
    && Number.isFinite(value.altitudeMeters) && value.altitudeMeters >= -12_000 && value.altitudeMeters <= 100_000;
}

function isContentCid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return CID.parse(value).code === RAW_CODEC;
  } catch {
    return false;
  }
}

function getBlockCache(): Promise<Cache> {
  if (!blockCachePromise) blockCachePromise = caches.open(BLOCK_CACHE_NAME);
  return blockCachePromise;
}

function cacheRequest(cid: string): Request {
  return new Request(new URL(`/__gobai_blocks__/${encodeURIComponent(cid)}`, location.origin));
}

function addToEventIndex(cid: string): void {
  const index = readEventIndex();
  if (index.includes(cid)) return;
  index.push(cid);
  localStorage.setItem(EVENT_INDEX_KEY, JSON.stringify(index));
}

async function findProofOfWork(
  kind: string,
  publicKey: string,
  createdAt: string,
  payload: object,
): Promise<number> {
  const canonicalPayload = stableJson(payload);
  for (let nonce = 0; nonce < Number.MAX_SAFE_INTEGER; nonce++) {
    if (hasProofOfWork(proofJson(kind, publicKey, createdAt, canonicalPayload, nonce, POW_DIFFICULTY), nonce, POW_DIFFICULTY)) {
      return nonce;
    }
    if (nonce % 128 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Impossible de trouver une preuve de travail pour cet événement.');
}

function proofJson(
  kind: string,
  publicKey: string,
  createdAt: string,
  payload: unknown,
  nonce: number,
  difficulty: number,
): string {
  const canonicalPayload = typeof payload === 'string' ? payload : stableJson(payload);
  return `{"createdAt":${JSON.stringify(createdAt)},"difficulty":${difficulty},"kind":${JSON.stringify(kind)},"nonce":${nonce},"payload":${canonicalPayload},"publicKey":${JSON.stringify(publicKey)}}`;
}

function hasProofOfWork(input: string, nonce: number, difficulty: number): boolean {
  if (!Number.isSafeInteger(nonce) || nonce < 0 || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 32) return false;
  const digest = sha256Bytes(new TextEncoder().encode(input));
  const wholeBytes = Math.floor(difficulty / 8);
  const remainingBits = difficulty % 8;
  for (let index = 0; index < wholeBytes; index++) {
    if (digest[index] !== 0) return false;
  }
  return remainingBits === 0 || (digest[wholeBytes] >>> (8 - remainingBits)) === 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function joinBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer;
  }
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export type ContributionEventPayload = ContributionManifest;
