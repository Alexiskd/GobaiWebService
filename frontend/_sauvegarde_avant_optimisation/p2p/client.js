import { Signaling } from './signaling.js';
import {
  CHUNK_BYTES, decodeChunk, encodeChunk, FILE_CHUNK, safeFileName, TILE_CHUNK,
} from './protocol.js';

const TILE_TIMEOUT_MS = 3000;
const MAX_TILE_BYTES = 8 * 1024 * 1024;
const MAX_TILE_MEMORY = 160;              // blobs récents gardés en mémoire (les autres viennent du cache disque)
const MAX_TILE_LIST = 3000;               // tuiles annoncées par pair
const MAX_OWN_TILES = 3000;
const HAVE_BATCH = 80;
const HAVE_FLUSH_MS = 900;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_ACTIVE_TRANSFERS = 8;
const MAX_DATA_BYTES = 180 * 1024;        // au-delà, le message dépasserait la limite pratique d'un canal
const SEND_HIGH_WATER = 4 * 1024 * 1024;
const SEND_LOW_WATER = 1 * 1024 * 1024;
const SAFE_CACHES = new Set(['moon-tiles-v1', 'mars-tiles-v1']);
const DATA_KEYS = new Set(['ephemeris/moon', 'ephemeris/moon/orbiters', 'ephemeris/moon/phases']);

const now = () => Date.now();
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Maillage pair-à-pair d'un visiteur. Un canal de données ordonné par pair transporte :
 *   • les tuiles déjà en cache (le serveur n'est plus sollicité),
 *   • les fichiers déposés dans le panneau P2P,
 *   • la vue synchronisée (visite à deux),
 *   • les données d'éphémérides de secours.
 * Seule la signalisation WebSocket passe par le serveur.
 */
export class P2PClient {
  constructor({ config, name = 'Visiteur', onState, onToast, onView } = {}) {
    this.config = config || {};
    this.signalingUrl = config?.signalUrl || '';
    this.iceServers = config?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
    this.name = name;
    this.onState = onState;
    this.onToast = onToast;
    this.onView = onView;

    this.disposed = false;
    this.status = 'idle';
    this.error = null;
    this.room = null;
    this.peerId = null;
    this.signaling = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.haveTimer = null;
    this.notifyTimer = null;

    this.peers = new Map();
    this.transfers = new Map();
    this.tileBlobs = new Map();     // url → Blob (LRU par ordre d'insertion)
    this.ownTiles = new Map();      // url → nom du cache disque (ou null)
    this.haveQueue = new Map();     // url → cache, annonces à envoyer
    this.data = new Map();          // clé → { value, at, from }
    this.tileCounter = 0;
    this.fileCounter = 0;
    this.tilesSent = 0;
    this.tilesReceived = 0;
    this.bytesIn = 0;
    this.bytesOut = 0;
    this.tileSharingEnabled = true;
    this.viewRole = 'off';
  }

  // ------------------------------------------------------------------ cycle de vie

  connect({ room = null, name = this.name } = {}) {
    if (this.disposed) return;
    if (typeof RTCPeerConnection === 'undefined') {
      this.status = 'error';
      this.error = 'Ce navigateur ne prend pas en charge WebRTC.';
      this.notify(true);
      this.onToast?.(this.error, 'error', 9000);
      return;
    }
    if (!this.signalingUrl) {
      this.status = 'error';
      this.error = 'Adresse de signalisation inconnue.';
      this.notify(true);
      return;
    }
    this.room = room;
    this.name = String(name || 'Visiteur').slice(0, 32);
    this.error = null;
    this.status = 'connecting';
    this.notify(true);
    this.openSignaling();
  }

  disconnect() {
    this.reconnectAttempt = 0;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.signaling?.close();
    this.signaling = null;
    this.closeAllPeers();
    this.room = null;
    this.peerId = null;
    this.status = 'idle';
    this.error = null;
    this.notify(true);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.notifyTimer);
    clearInterval(this.haveTimer);
    this.signaling?.close();
    this.signaling = null;
    this.closeAllPeers();
    for (const tr of this.transfers.values()) if (tr.url) URL.revokeObjectURL(tr.url);
    this.transfers.clear();
    this.tileBlobs.clear();
    this.ownTiles.clear();
    this.haveQueue.clear();
    this.data.clear();
  }

  // ------------------------------------------------------------------ signalisation

  openSignaling() {
    this.signaling?.close();
    this.signaling = new Signaling({
      url: this.signalingUrl,
      onOpen: () => {
        this.status = 'connecting';
        this.notify(true);
        this.signaling.send({ type: 'join', room: this.room, name: this.name });
      },
      onMessage: (msg) => this.handleServerMessage(msg),
      onClose: ({ intentional }) => this.handleSignalingClose(intentional),
    });
    this.signaling.open();
  }

  handleSignalingClose(intentional) {
    if (this.disposed || intentional) return;
    this.closeAllPeers();
    this.status = 'connecting';
    this.error = 'Relais de signalisation perdu, reconnexion…';
    this.notify(true);
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.disposed) return;
    const delay = Math.min(15_000, 800 * 2 ** Math.min(5, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.disposed && this.room !== null) this.openSignaling();
    }, delay);
  }

  handleServerMessage(msg) {
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case 'welcome':
        this.peerId = typeof msg.peerId === 'string' ? msg.peerId : this.peerId;
        break;
      case 'joined': return this.handleJoined(msg);
      case 'peer-joined':
        if (isObj(msg.peer) && typeof msg.peer.id === 'string') {
          this.createPeer(msg.peer.id, String(msg.peer.name || 'Pair'));
          this.onToast?.(`${msg.peer.name || 'Un visiteur'} a rejoint le salon.`, 'info', 5000);
        }
        break;
      case 'peer-left':
        if (typeof msg.peerId === 'string') this.removePeer(msg.peerId);
        break;
      case 'signal':
        if (typeof msg.from === 'string' && isObj(msg.data)) {
          const peer = this.peers.get(msg.from) || this.createPeer(msg.from, 'Pair');
          if (peer) this.handlePeerSignal(peer, msg.data);
        }
        break;
      case 'left':
        this.status = 'idle';
        this.room = null;
        this.notify(true);
        break;
      case 'error':
        this.error = msg.message || 'Erreur de signalisation.';
        this.onToast?.(this.error, 'error', 8000);
        if (msg.code !== 'unknown-peer' && msg.code !== 'bad-type') {
          this.status = 'error';
          this.notify(true);
        }
        break;
      default:
        break;
    }
  }

  handleJoined(msg) {
    const previousId = this.peerId;
    this.peerId = typeof msg.peerId === 'string' ? msg.peerId : previousId;
    this.room = typeof msg.room === 'string' ? msg.room : this.room;
    this.name = typeof msg.name === 'string' ? msg.name : this.name;
    this.status = 'joined';
    this.error = null;
    this.reconnectAttempt = 0;
    // Une reconnexion peut changer l'identifiant : les anciennes connexions sont caduques.
    this.closeAllPeers();
    const peers = Array.isArray(msg.peers) ? msg.peers.slice(0, this.config.maxPeers || 16) : [];
    for (const p of peers) {
      if (p && typeof p.id === 'string' && p.id !== this.peerId) {
        this.createPeer(p.id, String(p.name || 'Pair'));
      }
    }
    this.startHaveLoop();
    this.notify(true);
  }

  startHaveLoop() {
    if (this.haveTimer) return;
    this.haveTimer = setInterval(() => this.flushHave(), HAVE_FLUSH_MS);
  }

  signal(to, data) {
    this.signaling?.send({ type: 'signal', to, data });
  }

  // ---------------------------------------------------------------------- WebRTC

  createPeer(id, name) {
    if (this.peers.has(id)) {
      const existing = this.peers.get(id);
      if (name && name !== 'Pair') existing.name = name;
      return existing;
    }
    // Règle symétrique : le plus petit identifiant initie, l'autre est « poli » (négociation parfaite).
    const initiator = Boolean(this.peerId && this.peerId < id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = {
      id, name: name || 'Pair', pc, channel: null, connected: false,
      polite: (this.peerId || '') > id,
      makingOffer: false, ignoreOffer: false, isSettingRemoteAnswerPending: false,
      remoteTiles: new Map(), tilesIn: new Map(),
      serveQueue: [], serving: 0,
    };
    this.peers.set(id, peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signal(id, { candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peer.connected = false;
        this.notify();
      }
    };
    pc.ondatachannel = ({ channel }) => this.setChannel(peer, channel);
    pc.onnegotiationneeded = async () => {
      if (peer.makingOffer) return;
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.signal(id, { description: pc.localDescription });
      } catch (e) {
        if (!this.disposed) this.error = `Négociation impossible : ${e.message}`;
      } finally {
        peer.makingOffer = false;
      }
    };

    if (initiator) this.setChannel(peer, pc.createDataChannel('gobai-p2p', { ordered: true }));
    this.notify();
    return peer;
  }

  async handlePeerSignal(peer, data) {
    const { pc } = peer;
    try {
      if (data.description) {
        const description = data.description;
        const readyForOffer = !peer.makingOffer && (pc.signalingState === 'stable' || peer.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;
        peer.isSettingRemoteAnswerPending = description.type === 'answer';
        await pc.setRemoteDescription(description);
        peer.isSettingRemoteAnswerPending = false;
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.signal(peer.id, { description: pc.localDescription });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          if (!peer.ignoreOffer) throw e;
        }
      }
    } catch (e) {
      if (!this.disposed) {
        this.error = `Signalisation WebRTC : ${e.message}`;
        this.notify();
      }
    }
  }

  setChannel(peer, channel) {
    if (peer.channel && peer.channel !== channel && peer.channel.readyState !== 'closed') return;
    peer.channel = channel;
    channel.binaryType = 'arraybuffer';
    const opened = () => {
      peer.connected = true;
      this.sendControl(peer, { t: 'hello', name: this.name });
      this.announceInventory(peer);
      this.announceData(peer);
      this.notify(true);
    };
    if (channel.readyState === 'open') opened();
    else channel.onopen = opened;
    channel.onclose = () => {
      peer.connected = false;
      this.notify();
    };
    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        this.handlePeerControl(peer, msg);
      } else if (event.data instanceof ArrayBuffer) {
        this.handlePeerChunk(peer, event.data);
      }
    };
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    for (const pending of peer.tilesIn.values()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    peer.tilesIn.clear();
    for (const tr of this.transfers.values()) {
      if (tr.peerId === id && !['done', 'declined', 'error'].includes(tr.status)) {
        tr.status = 'error';
        tr.error = 'Pair déconnecté';
      }
    }
    try { peer.channel?.close(); } catch { /* déjà fermé */ }
    try { peer.pc.close(); } catch { /* déjà fermé */ }
    this.notify(true);
  }

  closeAllPeers() {
    for (const id of [...this.peers.keys()]) this.removePeer(id);
  }

  sendControl(peer, message) {
    if (peer.channel?.readyState === 'open') peer.channel.send(JSON.stringify(message));
  }

  sendBinary(peer, frame) {
    if (peer.channel?.readyState === 'open') peer.channel.send(frame);
  }

  async waitForBuffer(channel) {
    if (!channel || channel.readyState !== 'open') throw new Error('canal fermé');
    if (channel.bufferedAmount < SEND_HIGH_WATER) return;
    await new Promise((resolve) => {
      const done = () => {
        channel.removeEventListener('bufferedamountlow', done);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 5000);
      channel.bufferedAmountLowThreshold = SEND_LOW_WATER;
      channel.addEventListener('bufferedamountlow', done);
    });
  }

  // ------------------------------------------------------------------ messages P2P

  handlePeerControl(peer, msg) {
    if (!isObj(msg) || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case 'hello':
        if (typeof msg.name === 'string' && msg.name.trim()) {
          peer.name = msg.name.slice(0, 32);
          this.notify();
        }
        break;
      case 'tile-have': this.receiveHave(peer, msg.tiles); break;
      case 'tile-off': peer.remoteTiles.clear(); this.notify(); break;
      case 'tile-req': this.queueTileServe(peer, msg); break;
      case 'tile-miss': this.receiveTileMiss(peer, msg); break;
      case 'tile-start': this.receiveTileStart(peer, msg); break;
      case 'tile-end': this.receiveTileEnd(peer, msg.id); break;
      case 'file-offer': this.receiveFileOffer(peer, msg); break;
      case 'file-accept': this.acceptOutgoing(peer, msg.id); break;
      case 'file-decline': this.declineOutgoing(peer, msg.id); break;
      case 'file-start': this.receiveFileStart(peer, msg); break;
      case 'file-end': this.receiveFileEnd(peer, msg.id); break;
      case 'file-cancel': this.receiveFileCancel(peer, msg.id); break;
      case 'view':
        if (this.viewRole === 'follow' && isObj(msg.v)) this.onView?.(msg.v);
        break;
      case 'data': this.receiveData(peer, msg); break;
      case 'data-req':
        if (typeof msg.k === 'string') this.sendDataTo(peer, msg.k);
        break;
      default:
        break;
    }
  }

  handlePeerChunk(peer, data) {
    const chunk = decodeChunk(data);
    if (!chunk) return;
    if (chunk.type === TILE_CHUNK) {
      const pending = peer.tilesIn.get(chunk.id);
      if (!pending || pending.done) return;
      if (pending.size && pending.received + chunk.payload.byteLength > pending.size) {
        this.finishTile(pending, null);
        return;
      }
      pending.received += chunk.payload.byteLength;
      pending.chunks.push(chunk.payload);
    } else if (chunk.type === FILE_CHUNK) {
      const tr = this.transfers.get(`${peer.id}:${chunk.id}`);
      if (!tr || tr.direction !== 'in' || tr.status !== 'receiving') return;
      if (tr.bytes + chunk.payload.byteLength > MAX_FILE_BYTES) {
        tr.status = 'error';
        tr.error = 'Fichier trop volumineux';
        this.notify(true);
        return;
      }
      tr.parts.push(chunk.payload);
      tr.bytes += chunk.payload.byteLength;
      this.notify();
    }
  }

  // ---------------------------------------------------------------------- tuiles

  /** Vrai si au moins un pair connecté a annoncé cette URL. */
  tileHas(url) {
    if (!this.tileSharingEnabled) return false;
    for (const peer of this.peers.values()) {
      if (peer.connected && peer.remoteTiles.has(url)) return true;
    }
    return false;
  }

  /** Récupère une tuile chez un pair ; `null` si personne ne l'a ou si le transfert échoue. */
  async tileGet(url, cacheName = null) {
    if (!this.tileSharingEnabled) return null;
    const candidates = [...this.peers.values()].filter((p) => p.connected && p.remoteTiles.has(url)).slice(0, 2);
    for (const peer of candidates) {
      const blob = await this.requestTile(peer, url, cacheName ?? peer.remoteTiles.get(url) ?? null);
      if (blob) return blob;
    }
    return null;
  }

  requestTile(peer, url, cacheName) {
    const id = ++this.tileCounter;
    return new Promise((resolve) => {
      const pending = { url, chunks: [], size: 0, type: 'image/png', received: 0, done: false, resolve, timer: null };
      pending.timer = setTimeout(() => {
        peer.tilesIn.delete(id);
        peer.remoteTiles.delete(url);
        this.finishTile(pending, null);
      }, TILE_TIMEOUT_MS);
      peer.tilesIn.set(id, pending);
      this.sendControl(peer, { t: 'tile-req', id, u: url, c: cacheName });
    });
  }

  finishTile(pending, blob) {
    if (pending.done) return;
    pending.done = true;
    clearTimeout(pending.timer);
    pending.resolve(blob);
  }

  receiveTileStart(peer, msg) {
    const pending = peer.tilesIn.get(Number(msg.id));
    if (!pending) return;
    const size = Number(msg.size);
    if (!Number.isFinite(size) || size < 0 || size > MAX_TILE_BYTES) {
      this.finishTile(pending, null);
      return;
    }
    pending.size = size;
    if (typeof msg.type === 'string' && msg.type.startsWith('image/')) pending.type = msg.type;
  }

  receiveTileEnd(peer, id) {
    const pending = peer.tilesIn.get(Number(id));
    if (!pending) return;
    peer.tilesIn.delete(Number(id));
    if (pending.done) return;
    const blob = pending.chunks.length ? new Blob(pending.chunks, { type: pending.type }) : null;
    this.finishTile(pending, blob);
  }

  receiveTileMiss(peer, msg) {
    const id = Number(msg.id);
    const pending = peer.tilesIn.get(id);
    const url = typeof msg.u === 'string' ? msg.u : pending?.url;
    if (url) peer.remoteTiles.delete(url);
    if (!pending) return;
    peer.tilesIn.delete(id);
    this.finishTile(pending, null);
  }

  /** Mémorise une tuile vue localement et l'annonce aux pairs (sans bloquer le chargement). */
  tilePut(url, blob, cacheName = null) {
    if (!this.tileSharingEnabled || !blob || !(blob instanceof Blob)) return;
    if (blob.size === 0 || blob.size > MAX_TILE_BYTES) return;
    let hasConnected = false;
    for (const peer of this.peers.values()) if (peer.connected) { hasConnected = true; break; }
    if (!hasConnected) return;
    const known = this.ownTiles.get(url);
    this.tileBlobs.delete(url);
    this.tileBlobs.set(url, blob);
    while (this.tileBlobs.size > MAX_TILE_MEMORY) this.tileBlobs.delete(this.tileBlobs.keys().next().value);
    this.ownTiles.set(url, cacheName || null);
    while (this.ownTiles.size > MAX_OWN_TILES) this.ownTiles.delete(this.ownTiles.keys().next().value);
    if (known === undefined || known !== (cacheName || null)) this.haveQueue.set(url, cacheName || null);
    this.notify();
  }

  receiveHave(peer, tiles) {
    if (!Array.isArray(tiles) || !this.tileSharingEnabled) return;
    for (const entry of tiles.slice(0, 500)) {
      let url; let cache = null;
      if (Array.isArray(entry)) { url = entry[0]; cache = entry[1] ?? null; }
      else if (isObj(entry)) { url = entry.u; cache = entry.c ?? null; }
      if (typeof url !== 'string' || url.length > 2048) continue;
      if (!/^https?:\/\//.test(url) && !url.startsWith('/')) continue;
      if (cache !== null && (typeof cache !== 'string' || !SAFE_CACHES.has(cache))) cache = null;
      peer.remoteTiles.set(url, cache);
      while (peer.remoteTiles.size > MAX_TILE_LIST) peer.remoteTiles.delete(peer.remoteTiles.keys().next().value);
    }
    this.notify();
  }

  announceInventory(peer) {
    if (!this.tileSharingEnabled || !peer.channel) return;
    const tiles = [...this.ownTiles.entries()].slice(-300);
    if (tiles.length) this.sendControl(peer, { t: 'tile-have', tiles });
  }

  flushHave() {
    if (!this.haveQueue.size) return;
    const connected = [...this.peers.values()].filter((p) => p.connected);
    if (!connected.length) {
      while (this.haveQueue.size > 500) this.haveQueue.delete(this.haveQueue.keys().next().value);
      return;
    }
    const batch = [...this.haveQueue.entries()].slice(0, HAVE_BATCH);
    for (const [url] of batch) this.haveQueue.delete(url);
    for (const peer of connected) this.sendControl(peer, { t: 'tile-have', tiles: batch });
  }

  sendTileMiss(peer, id, url) {
    const msg = { t: 'tile-miss', id };
    if (typeof url === 'string' && url) msg.u = url;
    this.sendControl(peer, msg);
  }

  queueTileServe(peer, msg) {
    if (!this.tileSharingEnabled) {
      this.sendTileMiss(peer, msg.id, msg.u);
      return;
    }
    const id = Number(msg.id);
    const url = typeof msg.u === 'string' ? msg.u : '';
    const cacheName = typeof msg.c === 'string' && SAFE_CACHES.has(msg.c) ? msg.c : null;
    if (!Number.isFinite(id) || !url || url.length > 2048 || (!/^https?:\/\//.test(url) && !url.startsWith('/'))) {
      this.sendTileMiss(peer, id, url);
      return;
    }
    peer.serveQueue.push({ id, url, cacheName });
    this.pumpServe(peer);
  }

  async pumpServe(peer) {
    while (peer.serving < 2 && peer.serveQueue.length) {
      const job = peer.serveQueue.shift();
      peer.serving++;
      this.serveTile(peer, job).catch(() => {
        this.sendTileMiss(peer, job.id, job.url);
      }).finally(() => {
        peer.serving--;
        this.pumpServe(peer);
      });
    }
  }

  async serveTile(peer, { id, url, cacheName }) {
    const blob = await this.findTile(url, cacheName);
    if (!blob) { this.sendTileMiss(peer, id, url); return; }
    this.sendControl(peer, { t: 'tile-start', id, size: blob.size, type: blob.type || 'image/png' });
    let seq = 0;
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      if (peer.channel?.readyState !== 'open') return;
      await this.waitForBuffer(peer.channel);
      const buffer = await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      this.sendBinary(peer, encodeChunk(TILE_CHUNK, id, seq++, buffer));
    }
    this.sendControl(peer, { t: 'tile-end', id });
    this.tilesSent++;
    this.bytesOut += blob.size;
    this.notify();
  }

  async findTile(url, cacheName) {
    const cached = this.tileBlobs.get(url);
    if (cached) return cached;
    if (cacheName && SAFE_CACHES.has(cacheName) && typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(cacheName);
        const res = await cache.match(url);
        if (res) {
          const blob = await res.blob();
          if (blob.size <= MAX_TILE_BYTES) {
            this.tileBlobs.set(url, blob);
            while (this.tileBlobs.size > MAX_TILE_MEMORY) this.tileBlobs.delete(this.tileBlobs.keys().next().value);
            return blob;
          }
        }
      } catch { /* cache indisponible (contexte non sécurisé, quota…) */ }
    }
    return null;
  }

  setTileSharing(on) {
    const value = Boolean(on);
    if (value === this.tileSharingEnabled) return;
    this.tileSharingEnabled = value;
    if (!value) {
      for (const peer of this.peers.values()) this.sendControl(peer, { t: 'tile-off' });
      this.haveQueue.clear();
    } else {
      for (const peer of this.peers.values()) this.announceInventory(peer);
    }
    this.notify(true);
  }

  // --------------------------------------------------------------------- fichiers

  /** Propose un fichier à un pair précis, ou à tous les pairs connectés. Renvoie le nombre d'envois lancés. */
  sendFile(file, peerId = null) {
    if (!file) return 0;
    if (file.size > MAX_FILE_BYTES) {
      this.onToast?.(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo, ${MAX_FILE_BYTES / 1024 / 1024} Mo au maximum).`, 'error', 9000);
      return 0;
    }
    const targets = peerId
      ? [this.peers.get(peerId)].filter(Boolean)
      : [...this.peers.values()].filter((p) => p.connected);
    const connected = targets.filter((p) => p.connected);
    if (!connected.length) {
      this.onToast?.('Aucun pair connecté pour recevoir le fichier.', 'warn');
      return 0;
    }
    const id = ++this.fileCounter;
    let count = 0;
    for (const peer of connected) {
      if ([...this.transfers.values()].filter((t) => t.direction === 'out' && t.status === 'sending').length >= MAX_ACTIVE_TRANSFERS) break;
      const key = `${peer.id}:${id}`;
      this.transfers.set(key, {
        key, id, peerId: peer.id, peerName: peer.name, direction: 'out',
        name: safeFileName(file.name), size: file.size, mime: file.type || 'application/octet-stream',
        status: 'offered', bytes: 0, createdAt: now(), file,
      });
      this.sendControl(peer, {
        t: 'file-offer', id, name: safeFileName(file.name), size: file.size, mime: file.type || 'application/octet-stream',
      });
      count++;
    }
    this.notify(true);
    return count;
  }

  respondFile(key, accept) {
    const tr = this.transfers.get(key);
    if (!tr || tr.direction !== 'in' || tr.status !== 'offered') return;
    const peer = this.peers.get(tr.peerId);
    if (!peer?.connected) { tr.status = 'error'; tr.error = 'Pair déconnecté'; this.notify(true); return; }
    if (accept) {
      tr.status = 'receiving';
      tr.parts = [];
      tr.bytes = 0;
      this.sendControl(peer, { t: 'file-accept', id: tr.id });
    } else {
      tr.status = 'declined';
      this.sendControl(peer, { t: 'file-decline', id: tr.id });
    }
    this.notify(true);
  }

  receiveFileOffer(peer, msg) {
    const id = Number(msg.id);
    const size = Number(msg.size);
    if (!Number.isFinite(id) || !Number.isFinite(size) || size < 0) return;
    if (size > MAX_FILE_BYTES) {
      this.sendControl(peer, { t: 'file-decline', id });
      this.onToast?.('Fichier refusé : trop volumineux.', 'warn');
      return;
    }
    const tr = {
      key: `${peer.id}:${id}`, id, peerId: peer.id, peerName: peer.name, direction: 'in',
      name: safeFileName(msg.name), size, mime: typeof msg.mime === 'string' ? msg.mime.slice(0, 120) : 'application/octet-stream',
      status: 'offered', bytes: 0, createdAt: now(),
    };
    this.transfers.set(tr.key, tr);
    this.onToast?.(`${peer.name} propose « ${tr.name} » (${formatBytes(size)}).`, 'info', 9000);
    this.notify(true);
  }

  acceptOutgoing(peer, id) {
    const tr = this.transfers.get(`${peer.id}:${Number(id)}`);
    if (!tr || tr.direction !== 'out' || tr.status !== 'offered') return;
    tr.status = 'sending';
    this.notify(true);
    this.streamFile(peer, tr).catch((e) => {
      tr.status = 'error';
      tr.error = e.message;
      this.notify(true);
    });
  }

  declineOutgoing(peer, id) {
    const tr = this.transfers.get(`${peer.id}:${Number(id)}`);
    if (!tr || tr.direction !== 'out') return;
    tr.status = 'declined';
    this.notify(true);
  }

  async streamFile(peer, tr) {
    const channel = peer.channel;
    if (!channel || channel.readyState !== 'open') throw new Error('pair déconnecté');
    this.sendControl(peer, {
      t: 'file-start', id: tr.id, name: tr.name, size: tr.size, mime: tr.mime, chunk: CHUNK_BYTES,
    });
    let seq = 0;
    for (let offset = 0; offset < tr.size; offset += CHUNK_BYTES) {
      if (tr.cancelled) {
        // L'annulation distante a déjà posé le statut : ne pas renvoyer un file-cancel en écho.
        if (tr.status !== 'cancelled') {
          this.sendControl(peer, { t: 'file-cancel', id: tr.id });
          tr.status = 'cancelled';
        }
        this.notify(true);
        return;
      }
      if (channel.readyState !== 'open') throw new Error('canal fermé');
      await this.waitForBuffer(channel);
      const buffer = await tr.file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      this.sendBinary(peer, encodeChunk(FILE_CHUNK, tr.id, seq++, buffer));
      tr.bytes += buffer.byteLength;
      this.notify();
    }
    this.sendControl(peer, { t: 'file-end', id: tr.id });
    tr.status = 'done';
    this.bytesOut += tr.size;
    this.onToast?.(`« ${tr.name} » envoyé à ${peer.name}.`, 'info', 6000);
    this.notify(true);
  }

  receiveFileStart(peer, msg) {
    const tr = this.transfers.get(`${peer.id}:${Number(msg.id)}`);
    if (!tr || tr.direction !== 'in') return;
    const size = Number(msg.size);
    if (!Number.isFinite(size) || size > MAX_FILE_BYTES) {
      tr.status = 'error';
      tr.error = 'Fichier trop volumineux';
      this.sendControl(peer, { t: 'file-cancel', id: tr.id });
      this.notify(true);
      return;
    }
    tr.size = size;
    tr.parts = [];
    tr.bytes = 0;
    tr.status = 'receiving';
    this.notify(true);
  }

  receiveFileEnd(peer, id) {
    const tr = this.transfers.get(`${peer.id}:${Number(id)}`);
    if (!tr || tr.direction !== 'in') return;
    if (!tr.parts || tr.status !== 'receiving') {
      tr.status = 'error';
      tr.error = 'Transfert incomplet';
      this.notify(true);
      return;
    }
    const blob = new Blob(tr.parts, { type: tr.mime || 'application/octet-stream' });
    tr.url = URL.createObjectURL(blob);
    tr.parts = null;
    tr.bytes = blob.size;
    tr.size = blob.size;
    tr.status = 'done';
    this.bytesIn += blob.size;
    this.onToast?.(`Fichier reçu : « ${tr.name} » (${formatBytes(blob.size)}).`, 'info', 9000);
    this.notify(true);
  }

  /** Annulation déclenchée localement depuis l'interface. */
  cancelTransfer(key) {
    const tr = this.transfers.get(key);
    if (!tr) return;
    const peer = this.peers.get(tr.peerId);
    if (tr.direction === 'out') {
      if (tr.status === 'offered') {
        if (peer) this.sendControl(peer, { t: 'file-decline', id: tr.id });
        tr.status = 'cancelled';
      } else if (tr.status === 'sending') {
        tr.cancelled = true; // streamFile s'arrête et prévient le pair
      }
    } else if (tr.status === 'offered' || tr.status === 'receiving') {
      if (peer) this.sendControl(peer, { t: 'file-cancel', id: tr.id });
      tr.status = 'cancelled';
      tr.parts = null;
    }
    this.notify(true);
  }

  /** Annulation demandée par le pair : on ne la renvoie pas. */
  receiveFileCancel(peer, id) {
    const tr = this.transfers.get(`${peer.id}:${Number(id)}`);
    if (!tr) return;
    if (tr.direction === 'out') {
      tr.cancelled = true;
      tr.status = 'cancelled';
    } else if (tr.status === 'offered' || tr.status === 'receiving') {
      tr.status = 'cancelled';
      tr.parts = null;
    }
    this.notify(true);
  }

  dismissTransfer(key) {
    const tr = this.transfers.get(key);
    if (!tr) return;
    if (tr.direction === 'out' && tr.status === 'offered') {
      const peer = this.peers.get(tr.peerId);
      if (peer) this.sendControl(peer, { t: 'file-decline', id: tr.id });
    }
    if (tr.url) URL.revokeObjectURL(tr.url);
    tr.url = null;
    this.transfers.delete(key);
    this.notify(true);
  }

  // ------------------------------------------------------------------ visite / données

  setViewRole(role) {
    this.viewRole = ['off', 'lead', 'follow'].includes(role) ? role : 'off';
    this.notify(true);
  }

  broadcastView(state) {
    if (this.viewRole !== 'lead' || !isObj(state)) return;
    for (const peer of this.peers.values()) if (peer.connected) this.sendControl(peer, { t: 'view', v: state });
  }

  /** Publie une donnée d'éphéméride : les pairs peuvent s'en servir si l'API ne répond plus. */
  publishData(key, value) {
    if (!DATA_KEYS.has(key) || value === undefined) return;
    let json;
    try { json = JSON.stringify(value); } catch { return; }
    if (json.length > MAX_DATA_BYTES) return;
    this.data.set(key, { value, at: now(), from: 'local' });
    for (const peer of this.peers.values()) {
      if (peer.connected) this.sendControl(peer, { t: 'data', k: key, v: value, at: now() });
    }
    this.notify();
  }

  latestData(key, maxAgeMs = 24 * 3600 * 1000) {
    if (!DATA_KEYS.has(key)) return null;
    const entry = this.data.get(key);
    if (!entry || now() - entry.at > maxAgeMs) return null;
    return entry.value;
  }

  receiveData(peer, msg) {
    if (typeof msg.k !== 'string' || !DATA_KEYS.has(msg.k) || msg.v === undefined) return;
    let size = 0;
    try { size = JSON.stringify(msg.v).length; } catch { return; }
    if (size > MAX_DATA_BYTES) return;
    const at = Number(msg.at);
    this.data.set(msg.k, { value: msg.v, at: Number.isFinite(at) ? at : now(), from: peer.name });
    this.notify();
  }

  announceData(peer) {
    for (const [key, entry] of this.data) this.sendDataTo(peer, key, entry);
  }

  sendDataTo(peer, key, entry = this.data.get(key)) {
    if (entry) this.sendControl(peer, { t: 'data', k: key, v: entry.value, at: entry.at });
  }

  // ------------------------------------------------------------------------ état

  snapshot() {
    const peers = [...this.peers.values()].map((p) => ({
      id: p.id, name: p.name, connected: p.connected, tiles: p.remoteTiles.size,
    }));
    const transfers = [...this.transfers.values()].map((tr) => ({
      key: tr.key, id: tr.id, peerId: tr.peerId, peerName: tr.peerName, direction: tr.direction,
      name: tr.name, size: tr.size, mime: tr.mime, status: tr.status, bytes: tr.bytes,
      error: tr.error || null, url: tr.status === 'done' ? tr.url : null, createdAt: tr.createdAt,
    }));
    return {
      status: this.status, room: this.room, peerId: this.peerId, name: this.name, error: this.error,
      peers,
      transfers,
      tiles: {
        sharing: this.tileSharingEnabled,
        available: this.ownTiles.size,
        sent: this.tilesSent,
        received: this.tilesReceived,
        bytesIn: this.bytesIn,
        bytesOut: this.bytesOut,
      },
      data: [...this.data.entries()].map(([key, entry]) => ({ key, at: entry.at, from: entry.from })),
      viewRole: this.viewRole,
    };
  }

  notify(immediate = false) {
    if (this.disposed) return;
    if (immediate) {
      if (this.notifyTimer) { clearTimeout(this.notifyTimer); this.notifyTimer = null; }
      this.onState?.(this.snapshot());
      return;
    }
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      if (!this.disposed) this.onState?.(this.snapshot());
    }, 120);
  }
}

/**
 * Passerelle stable fournie au moteur de tuiles : elle délègue au client P2P courant,
 * qui n'existe qu'après la connexion à un salon.
 */
export function createP2PBridge() {
  let client = null;
  return {
    attach(next) { client = next; },
    tileHas(url) { return client ? client.tileHas(url) : false; },
    tileGet(url, cacheName) { return client ? client.tileGet(url, cacheName) : Promise.resolve(null); },
    tilePut(url, blob, cacheName) { client?.tilePut(url, blob, cacheName); },
  };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} Mo`;
}
