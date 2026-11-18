// Positions des panneaux déplaçables : on garde toujours le panneau entier dans la fenêtre,
// et au moins une poignée attrapable quand il est plus grand que l'écran.
// Marge gardée entre un panneau et le bord de la fenêtre, en pixels.
export const DRAG_EDGE = 8;

// Déclare et exporte clampPanelPosition : la position voulue, la taille du panneau et celle de la fenêtre.
export function clampPanelPosition(position, size, viewport) {
  // Largeur du panneau : un nombre positif, 0 à défaut.
  const width = Math.max(0, Number(size?.width) || 0);
  // Hauteur du panneau : un nombre positif, 0 à défaut.
  const height = Math.max(0, Number(size?.height) || 0);
  // Abscisse maximale : le panneau tient dans la fenêtre avec sa marge ; jamais moins que la marge.
  const maxX = Math.max(DRAG_EDGE, (Number(viewport?.width) || 0) - width - DRAG_EDGE);
  // Ordonnée maximale, calculée de même.
  const maxY = Math.max(DRAG_EDGE, (Number(viewport?.height) || 0) - height - DRAG_EDGE);
  // Renvoie la position corrigée (début de l'objet).
  return {
    // Abscisse bornée entre la marge et le maximum.
    x: Math.min(Math.max(Number(position?.x) || 0, DRAG_EDGE), maxX),
    // Ordonnée bornée entre la marge et le maximum.
    y: Math.min(Math.max(Number(position?.y) || 0, DRAG_EDGE), maxY),
  // Fin de l'objet.
  };
// Fin de clampPanelPosition.
}
