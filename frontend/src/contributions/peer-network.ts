import { fetchContributionP2PConfig, resolveApiUrl } from '../api/index';
import { getBytes, hasBlock, importRemoteBlock, listContributionBlocks } from './store';

const ROOM = 'gobai-contributions-v1';
const MAX_TRANSFER_BYTES = 256 * 1024 * 1024;
const FRAME_PAYLOAD_BYTES = 12 * 1024;

interface PeerConnection {
  connection: RTCPeerConnection;
  channel?: RTCDataChannel;
  pendingCandidates: RTCIceCandidateInit[];
  wanted: Set<string>;
  advertised: Set<string>;
  incoming: Map<string, { bytes: Uint8Array; total: number; received: number }>;
  sendQueue: Promise<void>;
}

interface SignalMessage {
  type: string;
  peerId?: string;
  peers?: string[];
  signalType?: 'offer' | 'answer' | 'candidate';
  signal?: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface PeerSyncConnection {
  close(): void;
}

export async function connectContributionsPeer(
  onState: (message: string) => void,
  onError: (message: string) => void,
): Promise<PeerSyncConnection> {
  const config = await fetchContributionP2PConfig();
  const signalUrl = new URL(resolveApiUrl(config.signalPath), window.location.href);
  signalUrl.protocol = signalUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(signalUrl);
  const peers = new Map<string, PeerConnection>();
  let localPeerId: string | null = null;
  let closed = false;
  const unsubscribe = () => window.removeEventListener('gobai-contribution-event', onLocalEvent);

  function reportError(error: unknown): void {
    onError(error instanceof Error ? error.message : 'Erreur de synchronisation pair-à-pair.');
  }

  function signal(target: string, signalType: SignalMessage['signalType'], payload: RTCSessionDescriptionInit | RTCIceCandidateInit): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'signal', target, signalType, signal: payload }));
  }

  function sendControl(peer: PeerConnection, message: object): void {
    if (peer.channel?.readyState === 'open') peer.channel.send(JSON.stringify(message));
  }

  function createPeer(peerId: string, initiator: boolean): PeerConnection {
    const existing = peers.get(peerId);
    if (existing) return existing;
    const connection = new RTCPeerConnection({ iceServers: config.iceServers });
    const peer: PeerConnection = {
      connection,
      pendingCandidates: [],
      wanted: new Set(),
      advertised: new Set(),
      incoming: new Map(),
      sendQueue: Promise.resolve(),
    };
    peers.set(peerId, peer);
    connection.onicecandidate = (event) => {
      if (event.candidate) signal(peerId, 'candidate', event.candidate.toJSON());
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        onState(`Connecté · ${peers.size} pair${peers.size === 1 ? '' : 's'}`);
      } else if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
        connection.close();
        peers.delete(peerId);
        onState(peers.size ? `Connecté · ${peers.size} pairs` : 'Recherche de pairs…');
      }
    };
    connection.ondatachannel = (event) => attachChannel(peer, event.channel);
    if (initiator) attachChannel(peer, connection.createDataChannel('contributions', { ordered: true }));
    return peer;
  }

  function attachChannel(peer: PeerConnection, channel: RTCDataChannel): void {
    peer.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 256 * 1024;
    channel.onopen = () => {
      onState(`Connecté · ${peers.size} pair${peers.size === 1 ? '' : 's'}`);
      void announceInventory(peer).catch(reportError);
    };
    channel.onmessage = (event) => {
      void receiveData(peer, event.data).catch((error) => {
        reportError(error);
        channel.close();
      });
    };
    channel.onerror = () => reportError(new Error('Canal WebRTC interrompu.'));
  }

  async function announceInventory(peer: PeerConnection): Promise<void> {
    const cids = await listContributionBlocks();
    for (let offset = 0; offset < cids.length; offset += 200) {
      const batch = cids.slice(offset, offset + 200);
      batch.forEach((cid) => peer.advertised.add(cid));
      sendControl(peer, { type: 'inventory', cids: batch });
    }
  }

  async function receiveData(peer: PeerConnection, data: string | ArrayBuffer | Blob): Promise<void> {
    if (typeof data === 'string') {
      const message = JSON.parse(data) as { type: string; cids?: string[]; cid?: string };
      if (message.type === 'inventory') {
        if (!Array.isArray(message.cids) || message.cids.length > 200) {
          throw new TypeError('Inventaire pair-à-pair invalide.');
        }
        for (const cid of message.cids) {
          if (typeof cid !== 'string' || peer.wanted.has(cid) || await hasBlock(cid)) continue;
          peer.wanted.add(cid);
          sendControl(peer, { type: 'get', cid });
        }
      } else if (message.type === 'get' && typeof message.cid === 'string') {
        if (!peer.advertised.has(message.cid)) {
          sendControl(peer, { type: 'not-found', cid: message.cid });
        } else {
          peer.sendQueue = peer.sendQueue.then(() => sendBlock(peer, message.cid!)).catch((error) => {
            reportError(error);
          });
        }
      } else if (message.type === 'not-found' && typeof message.cid === 'string') {
        peer.wanted.delete(message.cid);
      } else {
        throw new TypeError('Message pair-à-pair inconnu.');
      }
      return;
    }
    const frame = data instanceof Blob ? await data.arrayBuffer() : data;
    await receiveFrame(peer, new Uint8Array(frame));
  }

  async function sendBlock(peer: PeerConnection, cid: string): Promise<void> {
    const bytes = await getBytes(cid);
    if (bytes.byteLength > MAX_TRANSFER_BYTES) throw new RangeError(`Bloc trop grand pour le transfert : ${cid}.`);
    const cidBytes = new TextEncoder().encode(cid);
    if (cidBytes.byteLength > 512) throw new TypeError('CID trop long.');
    for (let offset = 0; offset < bytes.byteLength; offset += FRAME_PAYLOAD_BYTES) {
      const part = bytes.subarray(offset, Math.min(offset + FRAME_PAYLOAD_BYTES, bytes.byteLength));
      const frame = new Uint8Array(10 + cidBytes.byteLength + part.byteLength);
      const view = new DataView(frame.buffer);
      view.setUint16(0, cidBytes.byteLength, false);
      view.setUint32(2, offset, false);
      view.setUint32(6, bytes.byteLength, false);
      frame.set(cidBytes, 10);
      frame.set(part, 10 + cidBytes.byteLength);
      await sendFrame(peer, frame);
    }
  }

  async function sendFrame(peer: PeerConnection, frame: Uint8Array): Promise<void> {
    const channel = peer.channel;
    if (!channel || channel.readyState !== 'open') throw new Error('Canal WebRTC fermé avant la fin du transfert.');
    if (channel.bufferedAmount > 512 * 1024) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          channel.removeEventListener('bufferedamountlow', onLow);
          reject(new Error('Le canal WebRTC est saturé.'));
        }, 15_000);
        const onLow = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        channel.addEventListener('bufferedamountlow', onLow, { once: true });
      });
    }
    const transferable = new ArrayBuffer(frame.byteLength);
    new Uint8Array(transferable).set(frame);
    channel.send(transferable);
  }

  async function receiveFrame(peer: PeerConnection, frame: Uint8Array): Promise<void> {
    if (frame.byteLength < 11) throw new TypeError('Fragment de bloc pair-à-pair tronqué.');
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const cidLength = view.getUint16(0, false);
    const offset = view.getUint32(2, false);
    const total = view.getUint32(6, false);
    if (cidLength < 1 || total < 1 || total > MAX_TRANSFER_BYTES || 10 + cidLength >= frame.byteLength) {
      throw new TypeError('En-tête de fragment pair-à-pair invalide.');
    }
    const cid = new TextDecoder().decode(frame.subarray(10, 10 + cidLength));
    const content = frame.subarray(10 + cidLength);
    if (!peer.wanted.has(cid)) throw new TypeError('Bloc pair-à-pair reçu sans demande préalable.');
    let transfer = peer.incoming.get(cid);
    if (!transfer) {
      if (offset !== 0) throw new TypeError('Le premier fragment du bloc est absent.');
      if (peer.incoming.size >= 1) throw new RangeError('Trop de blocs reçus simultanément de ce pair.');
      transfer = { bytes: new Uint8Array(total), total, received: 0 };
      peer.incoming.set(cid, transfer);
    }
    if (transfer.total !== total || offset !== transfer.received || offset + content.byteLength > total) {
      throw new TypeError('Ordre ou taille des fragments pair-à-pair incohérent.');
    }
    transfer.bytes.set(content, offset);
    transfer.received += content.byteLength;
    if (transfer.received === transfer.total) {
      peer.incoming.delete(cid);
      await importRemoteBlock(cid, transfer.bytes);
      peer.wanted.delete(cid);
      onState(`Bloc reçu · ${cid.slice(0, 16)}…`);
      await announceInventory(peer);
    }
  }

  async function handleSignal(message: SignalMessage): Promise<void> {
    if (!message.peerId || !message.signalType || !message.signal) return;
    const peer = createPeer(message.peerId, false);
    if (message.signalType === 'candidate') {
      const candidate = message.signal as RTCIceCandidateInit;
      if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(candidate);
      else peer.pendingCandidates.push(candidate);
      return;
    }
    await peer.connection.setRemoteDescription(message.signal as RTCSessionDescriptionInit);
    while (peer.pendingCandidates.length) {
      await peer.connection.addIceCandidate(peer.pendingCandidates.shift()!);
    }
    if (message.signalType === 'offer') {
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      signal(message.peerId, 'answer', peer.connection.localDescription!.toJSON());
    }
  }

  function onLocalEvent(): void {
    for (const peer of peers.values()) void announceInventory(peer).catch(reportError);
  }
  window.addEventListener('gobai-contribution-event', onLocalEvent);

  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', room: ROOM })));
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data) as SignalMessage;
      if (message.type === 'ready') {
        localPeerId = message.peerId ?? null;
      } else if (message.type === 'joined') {
        localPeerId = message.peerId ?? localPeerId;
        onState(`Recherche de pairs… (${message.peers?.length ?? 0})`);
        for (const peerId of message.peers ?? []) {
          if (localPeerId && localPeerId.localeCompare(peerId) < 0) void offer(peerId);
        }
      } else if (message.type === 'peer-joined' && message.peerId) {
        if (localPeerId && localPeerId.localeCompare(message.peerId) < 0) void offer(message.peerId);
      } else if (message.type === 'signal') {
        void handleSignal(message).catch(reportError);
      } else if (message.type === 'peer-left' && message.peerId) {
        peers.get(message.peerId)?.connection.close();
        peers.delete(message.peerId);
      } else if (message.type === 'error') {
        onError(String((message as { message?: string }).message ?? 'Signalisation refusée.'));
      }
    } catch (error) {
      reportError(error);
    }
  });
  socket.addEventListener('error', () => onError('Signalisation WebRTC indisponible.'));
  socket.addEventListener('close', () => {
    if (!closed) onState('Signalisation fermée.');
  });

  async function offer(peerId: string): Promise<void> {
    try {
      const peer = createPeer(peerId, true);
      const description = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(description);
      signal(peerId, 'offer', peer.connection.localDescription!.toJSON());
    } catch (error) {
      reportError(error);
    }
  }

  return {
    close() {
      closed = true;
      unsubscribe();
      socket.close();
      for (const peer of peers.values()) peer.connection.close();
      peers.clear();
    },
  };
}
