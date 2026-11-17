// Importe la liste des tuiles d'un bloc et le côté des tuiles.
import { RADAR_TILE_PX, blockTiles } from './radarMath';

// Chargement des tuiles radar décodées (PNG RVB où chaque canal porte une mesure : pluie, neige, couverture) et
// assemblage d'un bloc de tuiles dans un canevas. Les images sont décodées SANS conversion de couleur ni
// prémultiplication : les valeurs arrivent intactes jusqu'au shader.

/**
 * Charge un bloc de tuiles ({ z, x0, y0, n }) d'une image radar et l'assemble dans un canevas de n × 512 px de côté.
 * `tileUrl(z, x, y)` donne l'adresse d'une tuile. Rejette si une tuile manque (le bloc n'est pas affiché à moitié).
 */
// Déclare et exporte loadRadarBlock : l'adresse d'une tuile, le bloc et le signal d'abandon.
export async function loadRadarBlock(tileUrl, block, signal) {
  // Tuiles du bloc.
  const tiles = blockTiles(block);
  // Chargement d'une tuile (début).
  const load = async (t) => {
    // Téléchargement.
    const res = await fetch(tileUrl(block.z, t.x, t.y), { signal });
    // Réponse en erreur : exception.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Décodage sans conversion de couleur ni prémultiplication.
    return createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  // Fin du chargement.
  };
  // Toutes les tuiles, en parallèle.
  const images = await Promise.all(tiles.map(load));
  // Canevas du bloc.
  const canvas = document.createElement('canvas');
  // Côté du bloc.
  canvas.width = canvas.height = block.n * RADAR_TILE_PX;
  // Contexte de dessin 2D, sans lissage.
  const ctx = canvas.getContext('2d');
  // Aucun lissage (les valeurs sont des mesures).
  ctx.imageSmoothingEnabled = false;
  // Chaque tuile à sa place, puis libérée.
  images.forEach((img, i) => { ctx.drawImage(img, tiles[i].dx * RADAR_TILE_PX, tiles[i].dy * RADAR_TILE_PX); img.close?.(); });
  // Canevas.
  return canvas;
// Fin de loadRadarBlock.
}

/** Charge une image (mesures ou image de prévision) et la recopie dans un canevas, sans conversion de couleur. */
// Déclare et exporte loadImageCanvas : l'adresse et le signal d'abandon.
export async function loadImageCanvas(url, signal) {
  // Téléchargement.
  const res = await fetch(url, { signal });
  // Réponse en erreur : exception.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Décodage sans conversion de couleur ni prémultiplication.
  const img = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  // Canevas à la taille de l'image.
  const canvas = document.createElement('canvas');
  // Dimensions.
  canvas.width = img.width; canvas.height = img.height;
  // Contexte de dessin 2D, sans lissage.
  const ctx = canvas.getContext('2d');
  // Aucun lissage.
  ctx.imageSmoothingEnabled = false;
  // Image recopiée, puis libérée.
  ctx.drawImage(img, 0, 0); img.close?.();
  // Canevas.
  return canvas;
// Fin de loadImageCanvas.
}
