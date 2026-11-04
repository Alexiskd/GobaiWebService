import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';

interface Peer {
  id: string;
  room?: string;
  socket: WebSocket;
}

@Injectable()
export class P2PSignalingService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Set<Peer>>();
  private server?: WebSocketServer;

  constructor(@Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'corsOrigins' | 'p2p'>) {}

  attach(httpServer: Server): void {
    if (this.server) throw new Error('La signalisation P2P est déjà attachée.');
    this.server = new WebSocketServer({
      server: httpServer,
      path: '/api/p2p/signal',
      maxPayload: 16 * 1024,
      verifyClient: ({ origin }: { origin: string; secure: boolean; req: IncomingMessage }) => this.allowedOrigin(origin),
    });
    this.server.on('connection', (socket) => this.connect(socket));
  }

  onModuleDestroy(): void {
    this.server?.close();
    this.rooms.clear();
  }

  private connect(socket: WebSocket): void {
    const peer: Peer = { id: randomUUID(), socket };
    socket.on('message', (raw) => this.receive(peer, raw.toString()));
    socket.on('close', () => this.leave(peer));
    socket.on('error', () => this.leave(peer));
    this.send(peer, { type: 'ready', peerId: peer.id });
  }

  private receive(peer: Peer, raw: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw);
    } catch {
      this.closePeer(peer, 1008, 'Message de signalisation invalide.');
      return;
    }

    if (message.type === 'join') {
      this.join(peer, message.room);
      return;
    }
    if (message.type === 'signal') {
      this.relay(peer, message);
      return;
    }
    if (message.type === 'leave') {
      this.leave(peer);
      return;
    }
    this.closePeer(peer, 1008, 'Type de message de signalisation inconnu.');
  }

  private join(peer: Peer, roomValue: unknown): void {
    if (peer.room || typeof roomValue !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(roomValue)) {
      this.closePeer(peer, 1008, 'Salle de signalisation invalide.');
      return;
    }
    let room = this.rooms.get(roomValue);
    if (!room && this.rooms.size >= this.config.p2p.maxRooms) {
      this.closePeer(peer, 1013, 'Capacité de salles atteinte.');
      return;
    }
    if (!room) {
      room = new Set();
      this.rooms.set(roomValue, room);
    }
    if (room.size >= this.config.p2p.maxPeers) {
      this.closePeer(peer, 1013, 'Capacité de pairs atteinte pour cette salle.');
      return;
    }
    peer.room = roomValue;
    this.send(peer, { type: 'joined', peerId: peer.id, peers: [...room].map((item) => item.id) });
    for (const existing of room) this.send(existing, { type: 'peer-joined', peerId: peer.id });
    room.add(peer);
  }

  private relay(peer: Peer, message: Record<string, unknown>): void {
    if (!peer.room || typeof message.target !== 'string' || !['offer', 'answer', 'candidate'].includes(String(message.signalType))) {
      this.closePeer(peer, 1008, 'Signal WebRTC invalide.');
      return;
    }
    const signal = message.signal;
    if (!signal || typeof signal !== 'object' || JSON.stringify(signal).length > 12_000) {
      this.closePeer(peer, 1008, 'Charge utile de signalisation trop grande ou invalide.');
      return;
    }
    const target = this.rooms.get(peer.room)?.values();
    const recipient = target && [...target].find((item) => item.id === message.target);
    if (!recipient) {
      this.send(peer, { type: 'peer-unavailable', peerId: message.target });
      return;
    }
    this.send(recipient, { type: 'signal', peerId: peer.id, signalType: message.signalType, signal });
  }

  private leave(peer: Peer): void {
    if (!peer.room) return;
    const roomName = peer.room;
    peer.room = undefined;
    const room = this.rooms.get(roomName);
    if (!room) return;
    room.delete(peer);
    for (const remaining of room) this.send(remaining, { type: 'peer-left', peerId: peer.id });
    if (room.size === 0) this.rooms.delete(roomName);
  }

  private closePeer(peer: Peer, code: number, reason: string): void {
    if (peer.socket.readyState === WebSocket.OPEN) {
      this.send(peer, { type: 'error', message: reason });
      peer.socket.close(code, reason.slice(0, 120));
    }
    this.leave(peer);
  }

  private send(peer: Peer, message: object): void {
    if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(JSON.stringify(message));
  }

  private allowedOrigin(origin: string): boolean {
    if (this.config.corsOrigins === true) return true;
    if (!origin) return false;
    try {
      return this.config.corsOrigins.includes(new URL(origin).origin);
    } catch {
      return false;
    }
  }
}
