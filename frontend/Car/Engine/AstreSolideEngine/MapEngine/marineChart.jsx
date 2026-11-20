// Carte marine de la Terre (couche unique « earth-hd »), décrite par la table du serveur (champ `marine`, voir backend
// earth-seafloor.ts et earth-plan.ts) : teinte des océans de la NOAA (ETOPO 2022) vue de l'espace, fondu vers GEBCO
// aux zooms moyens, GEBCO seule en relief ombré avec isobathes aux zooms forts. Les seuils sont la colonne « marine »
// des paliers de la table. Fonctions pures, sans navigateur (testées dans marineChart.test.jsx) ; le chargement est
// dans tileSource.jsx (marinePixelsAt), sous le masque de la mer des altitudes Terrarium.

// Importe le test des paliers de zoom, depuis zoomTiers.
import { validTiers } from './zoomTiers.jsx';

// Ordre des étapes de la carte marine, du plus lointain au plus proche.
// Déclare et exporte les étapes : NOAA, fondu, GEBCO.
export const MARINE_STAGES = ['noaa', 'fondu', 'gebco'];

/** Une couche d'images de la carte marine est-elle bien formée ? (modèle d'adresse et niveau le plus fin) */
// Déclare validLayer : la couche reçue.
const validLayer = (l) => Boolean(l && typeof l.template === 'string' && l.template.length > 0 && Number.isFinite(l.maxZoom));

/** La carte marine de la table est-elle utilisable ? (NOAA, GEBCO, carte plate, masque, fondu, isobathes) */
// Déclare et exporte validMarine : la carte marine reçue.
export function validMarine(m) {
  // Vrai si ses quatre couches sont bien formées,
  return Boolean(m && ['noaa', 'gebco', 'flat', 'mask'].every((k) => validLayer(m[k]))
    // si la durée du fondu est un nombre positif ou nul,
    && Number.isFinite(m.fadeMs) && m.fadeMs >= 0
    // et si les isobathes ont au moins 2 bandes et une force entre 0 et 1.
    && Number.isFinite(m.isobaths?.bands) && m.isobaths.bands >= 2 && m.isobaths.strength >= 0 && m.isobaths.strength <= 1);
// Fin de validMarine.
}

/**
 * Part de GEBCO dans l'image des fonds d'une tuile de niveau `z`, et isobathes à tracer, d'après la colonne « marine »
 * des paliers : le palier qui affiche ce niveau est le plus lointain dont le niveau max l'atteint. Étape « noaa » :
 * NOAA seule (0). Étape « gebco » : GEBCO seule (1) avec isobathes. Étape « fondu » : la part croît niveau par niveau,
 * du dernier niveau NOAA au premier niveau GEBCO. Sans paliers : GEBCO seule, sans isobathes (comme avant la table).
 */
// Déclare et exporte marineMix : les paliers de la table et le niveau de la tuile.
export function marineMix(tiers, z) {
  // Sans paliers utilisables : GEBCO seule, sans isobathes.
  if (!validTiers(tiers)) return { gebco: 1, isobaths: false };
  // Paliers du plus lointain au plus proche (le dernier palier, sans limite, en tête).
  const far = [...tiers].sort((a, b) => (b.maxKm ?? Infinity) - (a.maxKm ?? Infinity));
  // Palier qui affiche ce niveau : le plus lointain dont le niveau max l'atteint, sinon le plus proche.
  const tier = far.find((t) => t.maxZoom >= z) ?? far[far.length - 1];
  // Son étape de la carte marine.
  const stage = tier.details?.marine;
  // NOAA seule.
  if (stage === 'noaa') return { gebco: 0, isobaths: false };
  // GEBCO seule, avec isobathes.
  if (stage === 'gebco') return { gebco: 1, isobaths: true };
  // Dernier niveau NOAA : le plus fin des paliers « noaa » (−1 s'il n'y en a pas).
  const lastNoaa = Math.max(-1, ...far.filter((t) => t.details?.marine === 'noaa').map((t) => t.maxZoom));
  // Premier niveau GEBCO : juste après le plus fin des paliers qui ne sont pas « gebco ».
  const firstGebco = 1 + Math.max(lastNoaa, ...far.filter((t) => t.details?.marine !== 'gebco').map((t) => t.maxZoom));
  // Fondu : part de GEBCO entre ces deux niveaux, bornée à [0, 1], sans isobathes.
  return { gebco: Math.min(1, Math.max(0, (z - lastNoaa) / (firstGebco - lastNoaa))), isobaths: false };
// Fin de marineMix.
}

/** Mélange les pixels RGBA de la NOAA `noaa` et de GEBCO `gebco` (part `w` de GEBCO) dans `out` (par défaut `noaa`). */
// Déclare et exporte mixSea : les deux images, la part de GEBCO et la sortie.
export function mixSea(noaa, gebco, w, out = noaa) {
  // Pour chaque pixel (début).
  for (let i = 0; i < out.length; i += 4) {
    // Rouge, vert et bleu : mélange des deux images.
    out[i] = noaa[i] + (gebco[i] - noaa[i]) * w; out[i + 1] = noaa[i + 1] + (gebco[i + 1] - noaa[i + 1]) * w; out[i + 2] = noaa[i + 2] + (gebco[i + 2] - noaa[i + 2]) * w;
    // Opaque.
    out[i + 3] = 255;
  // Fin de la boucle.
  }
  // Renvoie la sortie.
  return out;
// Fin de mixSea.
}

/** Bande de couleur d'un pixel de la carte plate de GEBCO : sa luminance (0 à 1) découpée en `bands` bandes. */
// Déclare et exporte colorBand : rouge, vert, bleu (0 à 255) et nombre de bandes.
export function colorBand(r, g, b, bands) {
  // Luminance relative du pixel (coefficients de la norme sRGB), de 0 à 1.
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Numéro de sa bande, de 0 à bands − 1.
  return Math.min(bands - 1, Math.floor(l * bands));
// Fin de colorBand.
}

/**
 * Isobathes : la carte plate de GEBCO colore chaque pixel selon sa profondeur, donc une limite entre deux bandes de
 * couleur suit une ligne d'égale profondeur. Assombrit dans `out` (pixels RGBA des fonds) les pixels de pleine mer
 * (part de mer 1 dans `mask`) dont la bande diffère de celle du voisin de droite ou du dessous, lui aussi en pleine
 * mer : la terre et l'eau peu profonde des côtes ne sont jamais touchées. Renvoie le nombre de pixels tracés.
 */
// Déclare et exporte drawIsobaths : les pixels des fonds, ceux de la carte plate, les parts de mer, le réglage et la taille.
export function drawIsobaths(out, flat, mask, { bands, strength }, size = 256) {
  // Bande de couleur de chaque pixel de la carte plate.
  const band = new Int16Array(size * size);
  // Pour chaque pixel : sa bande.
  for (let k = 0; k < band.length; k++) band[k] = colorBand(flat[k * 4], flat[k * 4 + 1], flat[k * 4 + 2], bands);
  // Facteur d'assombrissement du trait.
  const keep = 1 - strength;
  // Pixels tracés : aucun pour l'instant.
  let drawn = 0;
  // Pour chaque ligne (début).
  for (let j = 0; j < size; j++) {
    // Pour chaque colonne (début).
    for (let i = 0; i < size; i++) {
      // Indice du pixel.
      const k = j * size + i;
      // Pas en pleine mer : pixel suivant.
      if (!(mask[k] >= 1)) continue;
      // Voisin de droite en pleine mer, d'une autre bande ?
      const right = i + 1 < size && mask[k + 1] >= 1 && band[k + 1] !== band[k];
      // Voisin du dessous en pleine mer, d'une autre bande ?
      const down = j + 1 < size && mask[k + size] >= 1 && band[k + size] !== band[k];
      // Ni l'un ni l'autre : pixel suivant.
      if (!right && !down) continue;
      // Sinon : rouge, vert et bleu assombris ; un pixel tracé de plus.
      out[k * 4] *= keep; out[k * 4 + 1] *= keep; out[k * 4 + 2] *= keep; drawn++;
    // Fin de la boucle des colonnes.
    }
  // Fin de la boucle des lignes.
  }
  // Renvoie le nombre de pixels tracés.
  return drawn;
// Fin de drawIsobaths.
}
