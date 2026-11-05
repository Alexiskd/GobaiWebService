import { useEffect, useRef, useState } from 'react';
import { validateAnchor } from '@/contributions/geodesy';

// Décodage LAZ dans un worker dédié (arrêté au démontage) et contrôle de l'en-tête.
export function useLazAnalysis({ file, metadata, dimensions, anchor, setBusy, setError, setStatus, setPreview }) {
  const [analyzing, setAnalyzing] = useState(false); // distinct de `busy` : le libellé « Analyse x % » ne s'affiche plus pendant une publication
  const [progress, setProgress] = useState(0);
  const workerRef = useRef(null);
  const jobIdRef = useRef(0);                         // identifiant unique de tâche (Date.now() pouvait se répéter)

  useEffect(() => {
    const worker = new Worker(new URL('../../../contributions/las.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const analyzeFile = async () => {
    if (!file || !metadata || !workerRef.current) return;
    setBusy(true);
    setAnalyzing(true);
    setError('');
    setPreview(null);
    setProgress(0);
    try {
      const size = dimensions.map(Number);
      if (size.some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new RangeError('Les trois dimensions doivent être des nombres positifs en mètres.');
      }
      validateAnchor(anchor);
      const bytes = await file.arrayBuffer();
      const parsed = await new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) { reject(new Error('Décodeur indisponible.')); return; }
        const id = ++jobIdRef.current;
        const cleanup = () => {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        };
        const onMessage = (event) => {
          if (event.data.id !== id) return;
          if (event.data.type === 'progress') setProgress(Math.round(event.data.progress * 100));
          if (event.data.type === 'error') { cleanup(); reject(new Error(event.data.message)); }
          if (event.data.type === 'complete') { cleanup(); resolve(event.data); }
        };
        const onError = (event) => {
          cleanup();
          reject(new Error(event.message || 'Échec du décodage du fichier LAZ.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({ id, buffer: bytes, dimensionsMeters: size }, [bytes]);
      });
      if (parsed.pointCount !== metadata.pointCount) {
        throw new Error('Le nombre de points décodé ne correspond pas à l’en-tête du fichier.');
      }
      const tolerance = Math.max(...metadata.scale) + 1e-6;
      for (const axis of ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ']) {
        if (Math.abs(parsed.bounds[axis] - metadata.bounds[axis]) > tolerance) {
          throw new Error('L’emprise décodée ne correspond pas aux métadonnées du fichier.');
        }
      }
      setPreview({ chunks: parsed.chunks, bounds: parsed.bounds });
      setProgress(100);
      setStatus(`Aperçu prêt · ${parsed.chunks.length} chunks · ${parsed.pointCount.toLocaleString('fr-FR')} points`);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
      setAnalyzing(false);
    }
  };

  return { analyzing, progress, analyzeFile };
}
