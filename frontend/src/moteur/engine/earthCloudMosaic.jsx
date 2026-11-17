// Nuages réels de la Terre vus par satellite : mosaïque mondiale assemblée à partir des tuiles Web Mercator relayées
// par l'API (GET /tiles/earth-clouds/xweather/{z}/{x}/{y}, source Xweather Raster Maps). Le moteur la pose sur le globe
// (atmosphere.jsx) ; la projection de Mercator s'arrête à 85,05° de latitude ; au-delà, le moteur comble les pôles avec les nuages simulés.

// Niveau de zoom de la mosaïque.
export const MOSAIC_ZOOM = 2;   // 4 × 4 tuiles de 256 px : 1024 × 1024 px pour le monde entier
// Côté d'une tuile, en pixels.
export const TILE_SIZE = 256;

/** Tuiles de la mosaïque : { x, y, left, top } en pixels du canevas (la tuile 0/0 est en haut à gauche, au nord-ouest). */
// Déclare et exporte mosaicTiles : reçoit le niveau de zoom.
export function mosaicTiles(zoom = MOSAIC_ZOOM) {
  // Nombre de tuiles par côté.
  const n = 2 ** zoom;
  // Liste des tuiles.
  const tiles = [];
  // Ligne par ligne, puis colonne par colonne : la tuile et sa position en pixels.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) tiles.push({ x, y, left: x * TILE_SIZE, top: y * TILE_SIZE });
  // Renvoie la liste.
  return tiles;
// Fin de mosaicTiles.
}

/** Ordonnée de la mosaïque (0 = sud à 85,05° S, 1 = nord) pour une latitude en radians ; hors de [0, 1] près des pôles. */
// Déclare et exporte mercatorV : reçoit une latitude en radians.
export function mercatorV(lat) {
  // Formule de Mercator, ramenée entre 0 et 1.
  return 0.5 + Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
// Fin de mercatorV.
}

/**
 * Charge la mosaïque : `tileUrl(z, x, y)` donne l'adresse d'une tuile. Renvoie un canevas, ou rejette si la source
 * n'est pas disponible (identifiants absents, API en panne) — l'appelant passe alors à une autre source de nuages.
 */
// Déclare et exporte loadCloudMosaic : l'adresse d'une tuile, le signal d'annulation et le niveau de zoom.
export async function loadCloudMosaic(tileUrl, signal, zoom = MOSAIC_ZOOM) {
  // Les tuiles à charger.
  const tiles = mosaicTiles(zoom);
  // load : charge une tuile.
  const load = async (t) => {
    // Télécharge la tuile.
    const res = await fetch(tileUrl(zoom, t.x, t.y), { signal });
    // Réponse en erreur : exception.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Décode l'image.
    return createImageBitmap(await res.blob());
  // Fin de load.
  };
  // Première tuile seule : si la source n'est pas configurée, on s'arrête après un seul appel.
  // Charge la première tuile seule.
  const first = await load(tiles[0]);
  // Charge les autres en parallèle.
  const rest = await Promise.all(tiles.slice(1).map(load));
  // Côté de la mosaïque, en pixels.
  const size = TILE_SIZE * 2 ** zoom;
  // Crée un canvas.
  const canvas = document.createElement('canvas');
  // Fixe sa largeur.
  canvas.width = size;
  // Fixe sa hauteur.
  canvas.height = size;
  // Son contexte de dessin 2D.
  const ctx = canvas.getContext('2d');
  // Dessine chaque tuile à sa place, puis libère son image.
  [first, ...rest].forEach((bitmap, i) => { ctx.drawImage(bitmap, tiles[i].left, tiles[i].top, TILE_SIZE, TILE_SIZE); bitmap.close?.(); });
  // Renvoie le canvas.
  return canvas;
// Fin de loadCloudMosaic.
}
