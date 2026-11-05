import { useEffect, useState } from 'react';
import { fetchLyonPointCloud } from '@/api';

// Métadonnées EPT du LiDAR de Lyon : chargées uniquement pour une ville de Lyon, panneau ouvert.
export function useLyonDataset(open, isLyon) {
  const [lyonDataset, setLyonDataset] = useState({ data: null, status: 'idle', error: null });

  useEffect(() => {
    if (!open || !isLyon) {
      setLyonDataset({ data: null, status: 'idle', error: null });
      return undefined;
    }
    const controller = new AbortController();
    setLyonDataset({ data: null, status: 'loading', error: null });
    fetchLyonPointCloud(controller.signal)
      .then((data) => setLyonDataset({ data, status: 'ready', error: null }))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setLyonDataset({ data: null, status: 'error', error: cause.message });
      });
    return () => controller.abort();
  }, [open, isLyon]);

  return lyonDataset;
}
