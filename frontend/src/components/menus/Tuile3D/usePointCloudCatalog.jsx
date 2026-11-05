import { useEffect, useState } from 'react';
import { fetchPointClouds } from '@/api';

// Catalogue des nuages Potree, chargé à l'ouverture du panneau.
export function usePointCloudCatalog(open) {
  const [catalog, setCatalog] = useState({ items: [], status: 'idle', error: null });

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setCatalog({ items: [], status: 'loading', error: null });
    fetchPointClouds(controller.signal)
      .then(({ items }) => setCatalog({ items: Array.isArray(items) ? items : [], status: 'ready', error: null }))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setCatalog({ items: [], status: 'error', error: cause.message });
      });
    return () => controller.abort();
  }, [open]);

  return catalog;
}
