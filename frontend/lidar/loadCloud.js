// Chargement d'un nuage LAS / LAZ hors du fil principal (même worker que la visionneuse), sans contexte WebGL.
// Sert à la couche du globe : avec `georeference`, les points arrivent en mètres Est-Nord-Haut autour du centre.

/**
 * @param {File|Blob|ArrayBuffer|string} source  fichier, données ou URL
 * @param {object} [options]
 *   maxPoints     points gardés au maximum (au-delà, un point sur n) — défaut 8 millions pour le globe
 *   georeference  convertit les points en repère local ENU (défaut true)
 *   lazWasmBase   dossier de laz-perf.wasm si le bundler ne le place pas à côté du module
 *   onProgress    ({ phase, ratio }) => void
 *   onHeader      (header) => void
 * @returns {{ promise: Promise<object>, cancel: () => void }}
 */
export function loadLidarCloud(source, { maxPoints = 8_000_000, georeference = true, lazWasmBase = '', onProgress, onHeader, name } = {}) {
  let worker = null;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    worker?.terminate();
    worker = null;
  };

  const promise = (async () => {
    onProgress?.({ phase: 'Lecture du fichier', ratio: 0 });
    let buffer;
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Téléchargement impossible (${response.status} ${response.statusText}).`);
      buffer = await response.arrayBuffer();
      name = name || decodeURIComponent(source.split('/').pop().split('?')[0]) || 'nuage';
    } else if (source instanceof ArrayBuffer) {
      buffer = source;
    } else if (source && typeof source.arrayBuffer === 'function') {
      buffer = await source.arrayBuffer();
      name = name || source.name;
    } else {
      throw new Error('Source non reconnue : attendu un fichier, un ArrayBuffer ou une URL.');
    }
    if (cancelled) throw new Error('Chargement annulé.');

    worker = new Worker(new URL('./lidar.worker.js', import.meta.url), { type: 'module' });
    const current = worker;
    return new Promise((resolve, reject) => {
      current.onerror = (e) => { current.terminate(); reject(new Error(e.message || 'Erreur dans le worker de chargement.')); };
      current.onmessage = ({ data: msg }) => {
        if (msg.type === 'progress') onProgress?.({ phase: msg.phase, ratio: msg.ratio });
        else if (msg.type === 'header') onHeader?.(msg.header);
        else if (msg.type === 'error') { current.terminate(); reject(new Error(msg.message)); }
        else if (msg.type === 'done') {
          current.terminate();
          if (worker === current) worker = null;
          resolve({ ...msg.result, name: name || msg.result.name || 'nuage' });
        }
      };
      current.postMessage({ type: 'load', id: 1, buffer, name, maxPoints, lazWasmBase, georeference }, [buffer]);
    });
  })();

  return { promise, cancel };
}
