// Sur-zoom : au-delà du niveau natif d'une couche, on réutilise la tuile ancêtre de ce niveau et on n'en affiche
// que la portion correspondante (pixels agrandis, mais une vraie photo jusqu'au niveau 22).

/** Niveaux d'agrandissement autorisés au-delà du niveau natif d'une couche. */
// Nombre de niveaux de sur-zoom autorisés : 3.
export const OVERZOOM_LEVELS = 3;

/**
 * Tuile à télécharger pour afficher `coord` avec une couche limitée à `nativeMaxZoom`, et rectangle de texture à
 * utiliser : [u0, v0, largeur, hauteur], v vers le haut (le Nord en haut, comme les uv des tuiles).
 */
// Déclare et exporte nativeTile : la tuile voulue et le niveau natif maximal de la couche.
export function nativeTile({ z, x, y }, nativeMaxZoom) {
  // Nombre de niveaux au-delà du niveau natif.
  const d = z - nativeMaxZoom;
  // Aucun : la tuile elle-même, avec toute sa texture.
  if (d <= 0) return { coord: { z, x, y }, rect: [0, 0, 1, 1] };
  // Nombre de tuiles voulues par côté de la tuile ancêtre.
  const n = 2 ** d;
  // Coordonnées de la tuile ancêtre.
  const ax = Math.floor(x / n), ay = Math.floor(y / n);
  // Position de la tuile voulue dans l'ancêtre.
  const rx = x - ax * n, ry = y - ay * n;
  // Taille de la portion de texture.
  const s = 1 / n;
  // Renvoie la tuile ancêtre et le rectangle de texture, v compté vers le haut.
  return { coord: { z: nativeMaxZoom, x: ax, y: ay }, rect: [rx * s, 1 - (ry + 1) * s, s, s] };
// Fin de nativeTile.
}
