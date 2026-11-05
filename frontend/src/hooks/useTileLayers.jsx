import { useEffect, useState } from 'react';
import { tilesApi } from '@/api';

/**
 * Couches de tuiles proposées par l'API (GET /tiles/layers).
 * status : 'loading' | 'ready' | 'error' — en cas d'erreur, la Terre et la Lune restent des sphères unies.
 */
export function useTileLayers() {
  const [state, setState] = useState({ status: 'loading', provider: null, fallback: false, placeSearch: false, layers: [], error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    tilesApi.layers(ctrl.signal)
      .then((r) => setState({ status: 'ready', provider: r.provider, fallback: r.fallback, placeSearch: Boolean(r.placeSearch), layers: r.layers, error: null }))
      .catch((e) => { if (e.name !== 'AbortError') setState({ status: 'error', provider: null, fallback: false, placeSearch: false, layers: [], error: e.message }); });
    return () => ctrl.abort();
  }, []);

  return state;
}
