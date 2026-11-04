// Positions des panneaux déplaçables : on garde toujours le panneau entier dans la fenêtre,
// et au moins une poignée attrapable quand il est plus grand que l'écran.
export const DRAG_EDGE = 8;

export function clampPanelPosition(position, size, viewport) {
  const width = Math.max(0, Number(size?.width) || 0);
  const height = Math.max(0, Number(size?.height) || 0);
  const maxX = Math.max(DRAG_EDGE, (Number(viewport?.width) || 0) - width - DRAG_EDGE);
  const maxY = Math.max(DRAG_EDGE, (Number(viewport?.height) || 0) - height - DRAG_EDGE);
  return {
    x: Math.min(Math.max(Number(position?.x) || 0, DRAG_EDGE), maxX),
    y: Math.min(Math.max(Number(position?.y) || 0, DRAG_EDGE), maxY),
  };
}
