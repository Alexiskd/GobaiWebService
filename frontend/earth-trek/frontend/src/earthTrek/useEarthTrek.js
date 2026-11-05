import { useEffect, useState } from 'react';
import { earthTrekApi } from './earthTrekApi';

/** Fonds et étapes du Trek de la Terre, chargés une fois. */
export function useEarthTrek() {
  const [state, setState] = useState({ layers: [], stops: [], status: 'loading', error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([earthTrekApi.layers(ctrl.signal), earthTrekApi.stops(ctrl.signal)])
      .then(([layers, stops]) => setState({ layers, stops, status: 'ready', error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ layers: [], stops: [], status: 'error', error: error.message });
      });
    return () => ctrl.abort();
  }, []);

  return state;
}
