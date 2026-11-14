// Importe la latitude limite de la projection de Mercator.
import { MAX_LATITUDE } from './tiles/mercator';

/**
 * Carte globale équirectangulaire (2:1) d'un fond de tuiles, pour habiller une sphère.
 * Web Mercator : mosaïque au zoom choisi puis reprojection ligne par ligne ; au-delà de ±85,05°, la dernière
 * ligne est étirée jusqu'au pôle. Plate carrée (NASA Trek) : mosaïque directe.
 * Les tuiles manquantes restent noires : la carte s'affiche même si une partie échoue.
 *
 * @param {import('./tiles/tileSource').TileSource} source  source prête (status 'ready')
 * @param {{ zoom?: number, signal?: AbortSignal }} opts    zoom visé (borné par la couche), 2 par défaut
 * @returns {Promise<HTMLCanvasElement>}
 */
// Déclare et exporte buildGlobeCanvas : la source de tuiles, le zoom (2 par défaut) et le signal d'annulation.
export async function buildGlobeCanvas(source, { zoom = 2, signal } = {}) {
  // Source non prête : exception.
  if (!source?.ready) throw new Error('Fond de carte indisponible');
  // Vrai si la couche est en projection équirectangulaire.
  const equi = source.info?.projection === 'equirectangular';
  // Niveau de zoom, borné par la couche ; un niveau de moins en équirectangulaire.
  const z = Math.max(source.minZoom, Math.min(source.maxZoom, equi ? zoom - 1 : zoom));
  // Nombre de colonnes de tuiles.
  const cols = equi ? 2 ** (z + 1) : 2 ** z;
  // Nombre de lignes de tuiles.
  const rows = 2 ** z;
  // Côté d'une tuile, en pixels.
  const T = 256;

  // Crée le canvas de la mosaïque.
  const mosaic = document.createElement('canvas');
  // Sa largeur.
  mosaic.width = cols * T;
  // Sa hauteur.
  mosaic.height = rows * T;
  // Son contexte de dessin 2D.
  const mctx = mosaic.getContext('2d');
  // Couleur de remplissage : noir.
  mctx.fillStyle = '#000';
  // Remplit tout le canvas.
  mctx.fillRect(0, 0, mosaic.width, mosaic.height);

  // Liste des chargements.
  const jobs = [];
  // Pour chaque ligne.
  for (let y = 0; y < rows; y++) {
    // Pour chaque colonne.
    for (let x = 0; x < cols; x++) {
      // Charge l'image de la tuile…
      jobs.push(source.loadImage({ z, x, y }, signal)
        // … la dessine à sa place…
        .then((img) => mctx.drawImage(img, x * T, y * T, T, T))
        // … et ignore un échec, sauf une annulation, qui est relancée.
        .catch((e) => { if (e.name === 'AbortError') throw e; }));
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Attend la fin de tous les chargements.
  await Promise.all(jobs);
  // Équirectangulaire : la mosaïque est déjà la carte.
  if (equi) return mosaic;

  // Mercator → équirectangulaire.
  // Largeur et hauteur de la carte finale (2:1).
  const W = mosaic.width, H = W / 2;
  // Crée le canvas final.
  const out = document.createElement('canvas');
  // Ses dimensions.
  out.width = W; out.height = H;
  // Son contexte de dessin 2D.
  const ctx = out.getContext('2d');
  // Hauteur de la mosaïque.
  const M = mosaic.height;
  // Pour chaque ligne de la carte finale.
  for (let j = 0; j < H; j++) {
    // Sa latitude, bornée à la limite de Mercator, en radians.
    const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, 90 - ((j + 0.5) / H) * 180)) * (Math.PI / 180);
    // L'ordonnée correspondante dans la mosaïque.
    const my = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * M;
    // Copie cette ligne de la mosaïque dans la carte finale.
    ctx.drawImage(mosaic, 0, Math.min(M - 1, Math.max(0, Math.floor(my))), W, 1, 0, j, W, 1);
  // Fin des lignes.
  }
  // Renvoie la carte.
  return out;
// Fin de buildGlobeCanvas.
}
