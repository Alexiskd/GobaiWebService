import { useEffect, useState } from 'react';
import { fetchBorders, fetchCityLabels } from '@/api';

/** Noms des villes et frontières (Natural Earth), avec leur attribution. */
export function useMapFeeds({ engine, push }) {
  const [cityInfo, setCityInfo] = useState(null);
  const [bordersInfo, setBordersInfo] = useState(null);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchCityLabels(ctrl.signal)
      .then((r) => { engine.setCityLabels(r.items); setCityInfo({ attribution: r.attribution, count: r.count }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Noms des villes indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchBorders(ctrl.signal)
      .then((r) => { engine.setBorders(r); setBordersInfo({ attribution: r.attribution }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Frontières indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  return { cityInfo, bordersInfo };
}
