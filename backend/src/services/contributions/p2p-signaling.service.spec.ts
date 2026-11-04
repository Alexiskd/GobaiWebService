import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { P2PSignalingService } from './p2p-signaling.service';

describe('P2PSignalingService', () => {
  it('only relays WebRTC signaling between peers in the same ephemeral room', async () => {
    const config = {
      corsOrigins: true as const,
      p2p: { maxPeers: 2, maxRooms: 2, iceServers: [] },
    };
    const service = new P2PSignalingService(config);
    const server = createServer();
    service.attach(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
    const first = new WebSocket(`ws://127.0.0.1:${address.port}/api/p2p/signal`);
    const second = new WebSocket(`ws://127.0.0.1:${address.port}/api/p2p/signal`);
    const firstReadyPromise = nextMessage(first, 'ready');
    const secondReadyPromise = nextMessage(second, 'ready');

    try {
      await Promise.all([once(first, 'open'), once(second, 'open')]);
      const [firstReady, secondReady] = await Promise.all([firstReadyPromise, secondReadyPromise]);
      const firstJoined = nextMessage(first, 'joined');
      first.send(JSON.stringify({ type: 'join', room: 'test-room' }));
      const firstPeer = await firstJoined;

      const joined = nextMessage(second, 'joined');
      const peerJoined = nextMessage(first, 'peer-joined');
      second.send(JSON.stringify({ type: 'join', room: 'test-room' }));
      const secondRoom = await joined;
      await peerJoined;

      const relayed = nextMessage(second, 'signal');
      first.send(JSON.stringify({
        type: 'signal',
        target: secondRoom.peerId,
        signalType: 'offer',
        signal: { type: 'offer', sdp: 'temporary-test-sdp' },
      }));
      const signal = await relayed;
      expect(signal.peerId).toBe(firstReady.peerId);
      expect(signal.signal.sdp).toBe('temporary-test-sdp');
      expect(firstPeer.peers).toEqual([]);
      expect(secondReady.peerId).not.toBe(firstReady.peerId);
    } finally {
      const firstClosed = once(first, 'close');
      const secondClosed = once(second, 'close');
      first.close();
      second.close();
      await Promise.all([firstClosed, secondClosed]);
      service.onModuleDestroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

function nextMessage(socket: WebSocket, type: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener('message', onMessage);
      reject(new Error(`Timed out waiting for WebSocket message ${type}.`));
    }, 3_000);
    const onMessage = (data: Buffer) => {
      const message = JSON.parse(data.toString()) as Record<string, any>;
      if (message.type !== type) return;
      clearTimeout(timer);
      socket.removeListener('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}
