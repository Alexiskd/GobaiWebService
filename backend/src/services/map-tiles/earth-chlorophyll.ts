/**
 * Chlorophylle des océans, pour colorer l'eau du large de la couche unique « earth-hd » (voir earth-seafloor.ts et,
 * côté navigateur, oceanColour.jsx) : composite mensuel MODIS Aqua de la NASA (chlorophylle-a, 4 km), lu sur le
 * serveur ERDDAP de NOAA CoastWatch au format ESRI ASCII, un point sur 12 (grille mondiale de 0,5°, 720 × 360).
 * La grille devient une image en niveaux de gris : le gris code le logarithme de la chlorophylle entre 0,01 et
 * 30 mg/m³, la transparence marque l'absence de donnée (terre, glace, nuages tout le mois).
 * Fonctions pures, testées dans earth-chlorophyll.spec.ts.
 */

// Serveur ERDDAP et jeu de données : CHLOROPHYLL_ERDDAP_URL si elle est définie, sinon le composite mensuel MODIS Aqua de NOAA CoastWatch.
const ERDDAP = (process.env.CHLOROPHYLL_ERDDAP_URL?.trim() || 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdMH1chlamday_R2022SQ').replace(/\/$/, '');
// Un point sur 12 : 4 km × 12 ≈ 0,5°.
export const CHL_STRIDE = 12;
// Chlorophylle (mg/m³) du gris 0 et du gris 255.
export const CHL_MIN = 0.01, CHL_MAX = 30;
// Mention des données : la NASA (OBPG, MODIS Aqua), relayée par NOAA CoastWatch ; couleur calculée avec ocpy.
export const CHL_ATTRIBUTION = 'Couleur de l’eau : chlorophylle NASA OBPG (MODIS Aqua) via NOAA CoastWatch, modèle d’après ocpy (BSD-3)';
/** Emprise de l'image [ouest, sud, est, nord] en degrés : le monde entier, en plate carrée, nord en haut. */
// Emprise de l'image.
export const CHL_BOUNDS: [number, number, number, number] = [-180, -90, 180, 90];

/**
 * Adresses à essayer, dans l'ordre : le même mois un an plus tôt (saison juste, mois déjà complet), puis le dernier
 * mois disponible. ERDDAP prend la date la plus proche ; les crochets sont encodés.
 */
// Fonction chlorophyllUrls : les adresses à essayer ; la date du jour et la base par défaut.
export function chlorophyllUrls(now: Date = new Date(), base: string = ERDDAP): Array<{ url: string; month: string }> {
  // Même mois, un an plus tôt, au 16 (milieu de mois des composites).
  const month = `${now.getUTCFullYear() - 1}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  // url : l'adresse ESRI ASCII pour un instant donné, un point sur 12 en latitude et en longitude.
  const url = (time: string) => `${base}.esriAscii?chlor_a%5B(${time})%5D%5B0:${CHL_STRIDE}:last%5D%5B0:${CHL_STRIDE}:last%5D`;
  // Renvoie le mois de l'an dernier, puis le dernier mois.
  return [{ url: url(`${month}-16T00:00:00Z`), month }, { url: url('last'), month: 'dernier' }];
// Fin de chlorophyllUrls.
}

// Forme d'une grille ESRI ASCII : colonnes, lignes et valeurs (première ligne au nord).
export interface EsriGrid { ncols: number; nrows: number; values: Float32Array }

/** Lit une grille ESRI ASCII (en-tête ncols, nrows, …, NODATA_value, puis les valeurs du nord au sud). */
// Fonction parseEsriAscii : le texte reçu.
export function parseEsriAscii(text: string): EsriGrid {
  // Mots du texte, séparés par les espaces et les retours à la ligne.
  const words = text.trim().split(/\s+/);
  // Valeurs de l'en-tête, par clé en minuscules.
  const head: Record<string, number> = {};
  // Indice du premier mot qui n'est pas de l'en-tête.
  let i = 0;
  // Tant que le mot est une clé connue : lit la paire clé-valeur.
  while (i + 1 < words.length && /^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|nodata_value)$/i.test(words[i])) { head[words[i].toLowerCase()] = Number(words[i + 1]); i += 2; }
  // Nombre de colonnes et de lignes.
  const ncols = head.ncols, nrows = head.nrows;
  // En-tête incomplet ou incohérent : erreur.
  if (!(ncols > 0) || !(nrows > 0) || words.length - i < ncols * nrows) throw new Error('Grille ESRI ASCII illisible');
  // Valeur « sans donnée », NaN par défaut.
  const nodata = head.nodata_value ?? Number.NaN;
  // Les valeurs.
  const values = new Float32Array(ncols * nrows);
  // Pour chaque valeur : le nombre lu, NaN s'il vaut « sans donnée ».
  for (let k = 0; k < values.length; k++) { const v = Number(words[i + k]); values[k] = v === nodata ? Number.NaN : v; }
  // Renvoie la grille.
  return { ncols, nrows, values };
// Fin de parseEsriAscii.
}

/** Gris (0 … 255) d'une chlorophylle (mg/m³), sur l'échelle logarithmique de 0,01 à 30 ; bornée aux extrémités. */
// Fonction chlorophyllGray : la chlorophylle.
export function chlorophyllGray(chl: number): number {
  // Logarithmes des bornes.
  const lo = Math.log10(CHL_MIN), hi = Math.log10(CHL_MAX);
  // Gris arrondi, borné entre 0 et 255.
  return Math.max(0, Math.min(255, Math.round((255 * (Math.log10(chl) - lo)) / (hi - lo))));
// Fin de chlorophyllGray.
}

/** Pixels gris + transparence (2 octets par pixel) de la grille : opaques là où la chlorophylle est connue. */
// Fonction chlorophyllPixels : la grille.
export function chlorophyllPixels(grid: EsriGrid): Uint8Array {
  // Deux octets par pixel.
  const out = new Uint8Array(grid.values.length * 2);
  // Pour chaque valeur (début).
  for (let k = 0; k < grid.values.length; k++) {
    // La chlorophylle.
    const v = grid.values[k];
    // Sans donnée (ou valeur impossible) : pixel transparent.
    if (!(v > 0) || !Number.isFinite(v)) continue;
    // Sinon : son gris, opaque.
    out[k * 2] = chlorophyllGray(v); out[k * 2 + 1] = 255;
  // Fin de la boucle.
  }
  // Renvoie les pixels.
  return out;
// Fin de chlorophyllPixels.
}
