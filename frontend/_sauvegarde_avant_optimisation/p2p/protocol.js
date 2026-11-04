// Protocole du canal de données WebRTC.
// Les messages de contrôle sont du JSON ; les gros contenus (tuiles, fichiers) sont découpés en trames binaires :
//   octet 0      type (1 = tuile, 2 = fichier)
//   octets 1-4   identifiant de la demande (uint32, little endian)
//   octets 5-8   numéro du morceau (uint32, little endian)
//   octets 9-…   contenu brut
// Le canal est ordonné : les trames arrivent dans l'ordre d'émission, ce qui permet des transferts simultanés.

export const TILE_CHUNK = 1;
export const FILE_CHUNK = 2;
export const HEADER_BYTES = 9;
export const CHUNK_BYTES = 16 * 1024;

/** Codes de salon sans caractères ambigus (I, O, 0, 1), dictables à l'oral. */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode(length = 6) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let code = '';
  for (let i = 0; i < length; i++) code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return code;
}

/** Prépare une trame binaire prête à envoyer sur le canal de données. */
export function encodeChunk(type, id, seq, buffer) {
  const payload = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const out = new ArrayBuffer(HEADER_BYTES + payload.byteLength);
  const bytes = new Uint8Array(out);
  const view = new DataView(out);
  bytes[0] = type;
  view.setUint32(1, id >>> 0, true);
  view.setUint32(5, seq >>> 0, true);
  bytes.set(new Uint8Array(payload), HEADER_BYTES);
  return out;
}

/** Décode une trame binaire ; `null` si elle est trop courte ou d'un type inconnu. */
export function decodeChunk(data) {
  if (!(data instanceof ArrayBuffer) || data.byteLength < HEADER_BYTES) return null;
  const view = new DataView(data);
  const type = view.getUint8(0);
  if (type !== TILE_CHUNK && type !== FILE_CHUNK) return null;
  return {
    type,
    id: view.getUint32(1, true),
    seq: view.getUint32(5, true),
    payload: data.slice(HEADER_BYTES),
  };
}

/** Empêche un pair d'inonder la mémoire : nom de fichier lisible dans l'interface, jamais utilisé comme chemin. */
export function safeFileName(name, fallback = 'fichier') {
  if (typeof name !== 'string') return fallback;
  const clean = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return (clean || fallback).slice(0, 180);
}
