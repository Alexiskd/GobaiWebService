import { API_BASE, API_ROOT } from './client';

const DEFAULT_SIGNAL_PATH = '/api/v1/p2p/signal';
const DEFAULT_ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const DEFAULT_MAX_PEERS = 8;

/** Convertit le chemin de signalisation renvoyé par l'API en URL WebSocket. */
export function signalUrl(path = DEFAULT_SIGNAL_PATH) {
  const explicit = import.meta.env.VITE_P2P_SIGNAL_URL;
  if (explicit) return explicit;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (/^wss?:\/\//.test(path)) return path;
  if (/^https?:\/\//.test(API_ROOT)) {
    const url = new URL(path.startsWith('/') ? path : `${API_ROOT}/${path}`, API_ROOT);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
  }
  const full = path.startsWith('/') ? path : `${API_ROOT}/${path}`;
  return `${proto}//${window.location.host}${full}`;
}

/**
 * Configuration du relais : chemin WebSocket, serveurs STUN/TURN et nombre de pairs par salon.
 * Si l'API ne répond pas, des valeurs par défaut permettent quand même de tenter une connexion.
 */
export async function fetchP2pConfig({ signal } = {}) {
  try {
    const res = await fetch(`${API_BASE}/p2p/config`, { signal, headers: { Accept: 'application/json' } });
    const body = res.ok ? await res.json() : null;
    return {
      signalUrl: signalUrl(typeof body?.signalPath === 'string' ? body.signalPath : DEFAULT_SIGNAL_PATH),
      iceServers: Array.isArray(body?.iceServers) && body.iceServers.length ? body.iceServers : DEFAULT_ICE_SERVERS,
      maxPeers: Number.isFinite(body?.maxPeers) ? body.maxPeers : DEFAULT_MAX_PEERS,
    };
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return {
      signalUrl: signalUrl(DEFAULT_SIGNAL_PATH),
      iceServers: DEFAULT_ICE_SERVERS,
      maxPeers: DEFAULT_MAX_PEERS,
    };
  }
}
