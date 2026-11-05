import { useEffect, useState } from 'react';
import { fetchMoonEphemeris, fetchMoonOrbiters, fetchMoonPhases } from '@/api';

/** Données lunaires rafraîchies périodiquement : sondes (2 h), phases USNO (6 h), éphéméride JPL (6 h). */
export function useMoonFeeds(engine) {
  const [moonPhases, setMoonPhases] = useState(null);

  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonOrbiters(ctrl.signal)
        .then((r) => engine.setMoonOrbiters(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('Sondes lunaires indisponibles :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 2 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  useEffect(() => {
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonPhases(ctrl.signal)
        .then((r) => setMoonPhases(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('USNO indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, []);

  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonEphemeris(ctrl.signal)
        .then((r) => engine.setMoonEphemeris(r.points))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('JPL Horizons indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  return { moonPhases };
}
