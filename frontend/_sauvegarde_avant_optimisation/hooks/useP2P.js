import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchP2pConfig } from '@/api';
import { P2PClient } from '@/p2p/client';

/**
 * Relie le panneau P2P, le moteur 3D et les tuiles.
 * `bridge` est stable et créé avant le moteur : il délègue au client dès qu'un salon est rejoint.
 */
export function useP2P({ bridge, engineRef, onToast }) {
  const [state, setState] = useState(null);
  const clientRef = useRef(null);
  const configRef = useRef(null);
  const dataRef = useRef(new Map()); // données publiées avant la création du client
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  const ensureClient = useCallback(async () => {
    if (clientRef.current) return clientRef.current;
    const config = configRef.current || await fetchP2pConfig();
    configRef.current = config;
    const client = new P2PClient({
      config,
      onState: setState,
      onToast: (text, tone, ms) => toastRef.current?.(text, tone, ms),
      onView: (view) => engineRef.current?.applyViewState(view),
    });
    clientRef.current = client;
    bridge.attach(client);
    for (const [key, entry] of dataRef.current) client.publishData(key, entry.value);
    return client;
  }, [bridge, engineRef]);

  const connect = useCallback(async ({ room = null, name = 'Visiteur' } = {}) => {
    try {
      const client = await ensureClient();
      client.connect({ room, name });
    } catch (e) {
      toastRef.current?.(`Pair-à-pair indisponible : ${e.message}`, 'error', 9000);
    }
  }, [ensureClient]);

  const disconnect = useCallback(() => {
    clientRef.current?.setViewRole('off');
    clientRef.current?.disconnect();
    engineRef.current?.setRemoteControlled(false);
  }, [engineRef]);

  const setViewRole = useCallback((role) => clientRef.current?.setViewRole(role), []);
  const setTileSharing = useCallback((on) => clientRef.current?.setTileSharing(on), []);
  const sendFile = useCallback((file, peerId) => clientRef.current?.sendFile(file, peerId) ?? 0, []);
  const respondFile = useCallback((key, accept) => clientRef.current?.respondFile(key, accept), []);
  const cancelTransfer = useCallback((key) => clientRef.current?.cancelTransfer(key), []);
  const dismissTransfer = useCallback((key) => clientRef.current?.dismissTransfer(key), []);
  const publishData = useCallback((key, value) => {
    dataRef.current.set(key, { value, at: Date.now() });
    clientRef.current?.publishData(key, value);
  }, []);
  const latestData = useCallback((key, maxAgeMs = 24 * 3600 * 1000) => {
    const fromPairs = clientRef.current?.latestData(key, maxAgeMs);
    if (fromPairs !== null && fromPairs !== undefined) return fromPairs;
    const entry = dataRef.current.get(key);
    return entry && Date.now() - entry.at <= maxAgeMs ? entry.value : null;
  }, []);

  // Suivi : entrées verrouillées et pose appliquée ; guide : la caméra est publiée 4 fois par seconde.
  const role = state?.viewRole ?? 'off';
  const joined = state?.status === 'joined';
  useEffect(() => {
    const locked = joined && role === 'follow';
    engineRef.current?.setRemoteControlled(locked);
  }, [joined, role, engineRef]);

  useEffect(() => {
    if (!joined || role !== 'lead') return undefined;
    const timer = setInterval(() => {
      const view = engineRef.current?.viewState();
      if (view) clientRef.current?.broadcastView(view);
    }, 250);
    return () => clearInterval(timer);
  }, [joined, role, engineRef]);

  useEffect(() => () => {
    bridge.attach(null);
    clientRef.current?.dispose();
    clientRef.current = null;
  }, [bridge]);

  return {
    state,
    peerCount: state?.peers?.filter((p) => p.connected).length ?? 0,
    connect,
    disconnect,
    setViewRole,
    setTileSharing,
    sendFile,
    respondFile,
    cancelTransfer,
    dismissTransfer,
    publishData,
    latestData,
  };
}
