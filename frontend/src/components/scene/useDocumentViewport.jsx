import { useEffect } from 'react';

/** Catégorie d’écran exposée au CSS (html[data-vp="sm"], html[data-pointer="coarse"]). */
export function useDocumentViewport(viewport) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.vp = viewport.size;
    root.dataset.pointer = viewport.coarse ? 'coarse' : 'fine';
    root.dataset.compact = viewport.compact ? 'true' : 'false';
    root.dataset.orientation = viewport.landscape ? 'landscape' : 'portrait';
  }, [viewport]);
}
