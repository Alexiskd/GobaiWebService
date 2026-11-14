// Importe buildGlobeCanvas, qui assemble la carte du globe.
import { buildGlobeCanvas } from './globeTexture';
// Importe TileSource, la source de tuiles.
import { TileSource } from './tiles/tileSource';

/** Nom du fichier téléchargé : « astre-couche.png », sans accent ni caractère spécial. */
// Déclare et exporte layerFileName : le nom de l'astre et celui de la couche.
export function layerFileName(bodyLabel, layerLabel) {
  // slug : retire les accents, passe en minuscules…
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    // … remplace toute suite d'autres caractères par un tiret, et retire les tirets du début et de la fin.
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Les deux parties non vides reliées par un tiret (« carte » à défaut), avec l'extension .png.
  return `${[slug(bodyLabel), slug(layerLabel)].filter(Boolean).join('-') || 'carte'}.png`;
// Fin de layerFileName.
}

/** Zoom de la carte téléchargée : 4096 × 2048 px sur ordinateur, 2048 × 1024 px sur écran tactile (mémoire limitée). */
// downloadZoom : niveau 3 sur écran tactile, 4 sinon.
export const downloadZoom = (coarse) => (coarse ? 3 : 4);

/**
 * Télécharge la carte globale (équirectangulaire 2:1, PNG) d'une couche ou d'un fond de carte, quel que soit l'astre :
 * mêmes tuiles que celles affichées sur le globe, assemblées dans le navigateur (voir globeTexture.jsx).
 */
// Déclare et exporte downloadLayer : la couche, le nom du fichier, le signal d'annulation et le client de l'API.
export async function downloadLayer({ layerId, fileName, signal, api }) {
  // Client de l'API chargé à la demande : les fonctions pures ci-dessus restent testables sans navigateur.
  // Crée la source de tuiles de la couche, avec le client fourni ou celui du module chargé à la demande.
  const source = new TileSource({ api: api || (await import('../api/tiles')).tilesApi, layerId });
  // Début du bloc protégé.
  try {
    // Démarre la source et attend.
    await source.start();
    // Source non prête : exception avec sa cause.
    if (!source.ready) throw new Error(source.error || 'Fond de carte indisponible');
    // Écran tactile ?
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    // Assemble la carte au niveau de zoom voulu.
    const canvas = await buildGlobeCanvas(source, { zoom: downloadZoom(coarse), signal });
    // Convertit le canvas en image PNG.
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    // Conversion impossible : exception.
    if (!blob) throw new Error('Image impossible à enregistrer');
    // Crée une adresse locale pour l'image.
    const url = URL.createObjectURL(blob);
    // Crée un lien invisible.
    const a = document.createElement('a');
    // Son adresse : l'image.
    a.href = url;
    // Son nom de téléchargement.
    a.download = fileName;
    // L'ajoute à la page.
    document.body.appendChild(a);
    // Simule un clic : le navigateur enregistre le fichier.
    a.click();
    // Retire le lien.
    a.remove();
    // Libère l'adresse locale après une minute.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  // Dans tous les cas.
  } finally {
    // Libère la source de tuiles.
    source.dispose();
  // Fin du bloc.
  }
// Fin de downloadLayer.
}
