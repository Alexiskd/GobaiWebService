// Sur-zoom : au-delà du niveau natif d'une couche, on réutilise la tuile ancêtre de ce niveau et on n'en affiche
// que la portion correspondante (pixels agrandis, mais une vraie photo jusqu'au niveau 22).

/** Niveaux d'agrandissement autorisés au-delà du niveau natif d'une couche. */
export const OVERZOOM_LEVELS = 3;

/**
 * Tuile à télécharger pour afficher `coord` avec une couche limitée à `nativeMaxZoom`, et rectangle de texture à
 * utiliser : [u0, v0, largeur, hauteur], v vers le haut (le Nord en haut, comme les uv des tuiles).
 */
export function nativeTile({ z, x, y }, nativeMaxZoom) {
  const d = z - nativeMaxZoom;
  if (d <= 0) return { coord: { z, x, y }, rect: [0, 0, 1, 1] };
  const n = 2 ** d;
  const ax = Math.floor(x / n), ay = Math.floor(y / n);
  const rx = x - ax * n, ry = y - ay * n;
  const s = 1 / n;
  return { coord: { z: nativeMaxZoom, x: ax, y: ay }, rect: [rx * s, 1 - (ry + 1) * s, s, s] };
}
