// Importe useEffect de React.
import { useEffect } from 'react';

/** Catégorie d’écran exposée au CSS (html[data-vp="sm"], html[data-pointer="coarse"]). */
// Déclare et exporte le crochet useDocumentViewport : reçoit la catégorie d'écran.
export function useDocumentViewport(viewport) {
  // Effet relancé quand la catégorie d'écran change.
  useEffect(() => {
    // Récupère l'élément html.
    const root = document.documentElement;
    // Attribut data-vp : la taille d'écran (xs, sm, md, lg ou xl).
    root.dataset.vp = viewport.size;
    // Attribut data-pointer : « coarse » au doigt, « fine » à la souris.
    root.dataset.pointer = viewport.coarse ? 'coarse' : 'fine';
    // Attribut data-compact : « true » ou « false ».
    root.dataset.compact = viewport.compact ? 'true' : 'false';
    // Attribut data-orientation : paysage ou portrait.
    root.dataset.orientation = viewport.landscape ? 'landscape' : 'portrait';
  // Fin de l'effet ; dépendance : la catégorie d'écran.
  }, [viewport]);
// Fin de useDocumentViewport.
}
