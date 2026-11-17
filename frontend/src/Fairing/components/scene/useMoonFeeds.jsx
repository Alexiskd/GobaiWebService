import { useEffect, useState } from 'react';
import { loadSolarSystemHorizons } from '@/Car/AstreSolideEngine/jplHorizonsClient';

/**
 * Éphémérides du Système solaire :
 * - tentative JPL Horizons directe depuis le navigateur au chargement, puis toutes les 6 h ;
 * - en cas d'échec HTTP/CORS/hors-ligne, aucun état n'est remplacé : les moteurs VSOP87/ELP/Kepler locaux
 *   continuent à calculer les positions ;
 * - aucun appel réseau depuis requestAnimationFrame.
 */
export function useMoonFeeds(engine) {
  const [moonPhases] = useState(null);

  useEffect(() => {
    if (!engine) return undefined;
    let disposed = false;
    let controller = null;

    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await loadSolarSystemHorizons({ signal: controller.signal });
        if (disposed || controller.signal.aborted) return;

        if (result.planets.length) engine.setPlanetEphemeris(result.planets);
        if (result.satellites.length) engine.setSatelliteEphemeris(result.satellites);
        if (result.moon?.points?.length) engine.setMoonEphemeris(result.moon.points);
      } catch {
        // Offline, CORS ou erreur JPL : les calculateurs locaux restent actifs.
      }
    };

    load();
    const timer = setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
    };
  }, [engine]);

  return { moonPhases };
}
