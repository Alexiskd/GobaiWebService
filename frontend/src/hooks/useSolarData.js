import { useCallback, useEffect, useState } from 'react';
import { fetchSceneData } from '@/api';

/** Charge les données de la scène depuis l'API. status : 'loading' | 'ready' | 'error'. */
export function useSolarData() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    fetchSceneData(ctrl.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((e) => {
        if (e.name !== 'AbortError') setState({ status: 'error', data: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
