import { useEffect, useState } from 'react';
import { tilesApi } from '@/api';

/**
 * Crée le moteur 3D et le détruit au démontage.
 * Retourne l'instance (état, pour déclencher les effets) ; `engineRef` est fourni par l'appelant.
 */
export function useSolarEngine({ containerRef, data, labels, hud, engineRef }) {
  const [engine, setEngine] = useState(null);
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let instance = null;

    (async () => {
      try {
        // Chargé à la demande : three.js reste hors du bundle initial.
        const { SolarEngine } = await import('@/engine/engine');
        if (cancelled) return;
        instance = new SolarEngine({ container: containerRef.current, data, labels, hud, tilesApi, onFocusChange: setFocus });
        engineRef.current = instance;
        setEngine(instance);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(`Impossible d’initialiser la scène 3D : ${e?.message || e}`);
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current = null;
      if (instance) instance.dispose();
      setEngine(null);
    };
  }, [containerRef, data, labels, hud, engineRef]);

  return { engine, focus, error };
}
