// Image décodée (pixels RVBA).
import type { DecodedPng } from './png';

// Radar des précipitations (PrecipitationEngine, partie données). Source : API publique Weather Maps de Rain Viewer
// (composite des radars météorologiques au sol, images des deux dernières heures toutes les 10 minutes, sans clé).
// Depuis le 1er janvier 2026, l'accès gratuit se limite au niveau de zoom 7, au seul jeu de couleurs « Universal
// Blue » (2), sans prévision immédiate ni satellite, à 100 requêtes par minute et par adresse IP, pour un usage
// personnel ou éducatif, avec mention obligatoire de Rain Viewer.
// Les tuiles sont demandées SANS lissage (couleurs exactes) et avec la neige distinguée : chaque couleur est reconvertie
// en réflectivité (dBZ) grâce à la table officielle des couleurs ; la carte affichée et la détection des cellules
// orageuses travaillent donc sur la mesure, pas sur une couleur.

/** Hôte des tuiles attendu (l'index des images est refusé s'il en annonce un autre). */
// Déclare et exporte l'hôte des tuiles.
export const RAINVIEWER_HOST = 'https://tilecache.rainviewer.com';
/** Index des images radar disponibles. */
// Déclare et exporte l'adresse de l'index.
export const RAINVIEWER_INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';
/** Côté des tuiles demandées, en pixels (256 ou 512 ; 512 : quatre fois moins de requêtes). */
// Déclare et exporte le côté des tuiles.
export const RADAR_TILE_SIZE = 512;
/** Niveau de zoom maximal de l'accès gratuit. */
// Déclare et exporte le niveau maximal.
export const RADAR_MAX_ZOOM = 7;
/** Jeu de couleurs « Universal Blue », le seul encore servi gratuitement. */
// Déclare et exporte le jeu de couleurs.
export const RADAR_COLOR_SCHEME = 2;
/** Pas entre deux images, en minutes. */
// Déclare et exporte le pas des images.
export const RADAR_FRAME_STEP_MIN = 10;
/** Âge au-delà duquel la dernière image est dite périmée : 30 minutes. */
// Déclare et exporte le seuil de péremption.
export const RADAR_STALE_MS = 30 * 60_000;
/** Codage d'une réflectivité dans un octet : code = dBZ + 11 (de 1 pour −10 dBZ à 106 pour 95 dBZ) ; 0 = aucun écho. */
// Déclare et exporte le décalage du codage.
export const DBZ_CODE_OFFSET = 11;
/** Couverture radar dans le canal bleu : 255 couvert, 0 hors de portée de tout radar, 128 inconnue. */
// Déclare et exporte les valeurs de la couverture.
export const COVERAGE = { covered: 255, none: 0, unknown: 128 };

// Table officielle « Universal Blue » de Rain Viewer (rainviewer_api_colors_table.csv, colonne 4), couleurs RVBA de la
// PLUIE de −10 à 65 dBZ (au-delà : la couleur de 65, saturée).
const RAIN_HEX = '63615914 66635a19 69665c1e 6c685d24 6f6b5f29 726e612e 75706234 78736439 7c75653e 7f786744 827b6949 857d6a4e 88806c54 8b826d59 8e856f5e 92887164 9e93756e aa9e7978 b6a97e82 c2b4828c cec08796 d2c48ba0 d6c88faa dacc93b4 ded097be 88ddeeff 6cd1ebff 51c5e8ff 36bae5ff 1baee2ff 00a3e0ff 009ad5ff 0091caff 0088bfff 007fb4ff 0077aaff 0070a3ff 00699cff 006295ff 005b8eff 005588ff 005180ff 004e78ff 004a70ff 004768ff ffee00ff ffe000ff ffd200ff ffc500ff ffb700ff ffaa00ff ff9f00ff ff9500ff ff8b00ff ff8100ff ff4400ff f23600ff e62800ff d91b00ff cd0d00ff c10000ff a80000ff 8f0000ff 760000ff 5d0000ff ffaaffff ff9fffff ff95ffff ff8bffff ff81ffff ff77ffff ff6cffff ff62ffff ff58ffff ff4effff ffffffff';
// Même table, couleurs de la NEIGE de −10 à 75 dBZ (au-delà : la couleur de 75, saturée).
const SNOW_HEX = 'cfffff00 ceffff0c cdffff19 ccffff26 cbffff33 cbffff3f caffff4c c9ffff59 c8ffff66 c7ffff72 c7ffff7f c6ffff8c c5ffff99 c4ffffa5 c3ffffb2 c3ffffbf c2ffffcc c1ffffd8 c0ffffe5 bffffff2 bfffffff b8f8ffff b2f2ffff abebffff a5e5ffff 9fdfffff 98d8ffff 92d2ffff 8bcbffff 85c5ffff 7fbfffff 78b8ffff 72b2ffff 6babffff 65a5ffff 5f9fffff 5b9bffff 5898ffff 5595ffff 5292ffff 4f8fffff 4b8bffff 4888ffff 4585ffff 4282ffff 3f7fffff 3b7bffff 3878ffff 3575ffff 3272ffff 2f6fffff 2b6bffff 2868ffff 2565ffff 2262ffff 1f5fffff 1b5bffff 1858ffff 1555ffff 1252ffff 0f4fffff 0c4bffff 0948ffff 0645ffff 0242ffff 003fffff 003bffff 0038ffff 0035ffff 0032ffff 002fffff 002bffff 0028ffff 0025ffff 0022ffff 001fffff 001bffff 0018ffff 0015ffff 0012ffff 000fffff 000cffff 0009ffff 0006ffff 0002ffff 0000ffff';

/** Une entrée de la table : couleur RVBA, réflectivité et nature (neige ou pluie). */
// Forme d'une entrée.
export interface PaletteEntry {
  // rgba : la couleur, quatre octets.
  rgba: [number, number, number, number];
  // dbz : la réflectivité.
  dbz: number;
  // snow : vrai pour la neige.
  snow: boolean;
// Fin de PaletteEntry.
}

// hexToRgba : « rrggbbaa » → quatre octets.
const hexToRgba = (h: string): [number, number, number, number] => [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number, number];
// pack : quatre octets → un entier (clé de la table).
const pack = (r: number, g: number, b: number, a: number): number => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

/** Table complète, pluie puis neige ; les couleurs transparentes (aucun écho) en sont exclues. */
// Déclare et exporte la table.
export const PALETTE: PaletteEntry[] = [
  // Pluie, de −10 dBZ à 65 dBZ.
  ...RAIN_HEX.split(' ').map((h, i) => ({ rgba: hexToRgba(h), dbz: i - 10, snow: false })),
  // Neige, de −10 dBZ à 75 dBZ.
  ...SNOW_HEX.split(' ').map((h, i) => ({ rgba: hexToRgba(h), dbz: i - 10, snow: true })),
// Sans les couleurs entièrement transparentes.
].filter((e) => e.rgba[3] > 0);

// Index exact : couleur → entrée (pour une couleur répétée, la plus faible réflectivité, comme dans la table).
const EXACT = new Map<number, PaletteEntry>();
// Remplissage de l'index.
for (const e of PALETTE) { const k = pack(...e.rgba); if (!EXACT.has(k)) EXACT.set(k, e); }
// Couleurs inattendues déjà rapprochées (évite de refaire la recherche), bornées en nombre.
const NEAREST = new Map<number, PaletteEntry | null>();
/** Écart maximal (somme des écarts des quatre canaux) pour rapprocher une couleur inattendue de la table. */
// Déclare et exporte l'écart maximal.
export const NEAREST_TOLERANCE = 48;

/** Réflectivité d'une couleur de tuile : entrée de la table, ou null (transparent : aucun écho ; ou couleur inconnue). */
// Déclare et exporte decodeRadarColor : les quatre canaux.
export function decodeRadarColor(r: number, g: number, b: number, a: number): PaletteEntry | null {
  // Transparent : aucun écho.
  if (a === 0) return null;
  // Clé de la couleur.
  const k = pack(r, g, b, a);
  // Couleur exacte de la table.
  const exact = EXACT.get(k);
  // Trouvée : rendue.
  if (exact) return exact;
  // Déjà rapprochée : le résultat gardé.
  if (NEAREST.has(k)) return NEAREST.get(k) ?? null;
  // Plus proche couleur de la table.
  let best: PaletteEntry | null = null, bestD = Infinity;
  // Parcours de la table.
  for (const e of PALETTE) { const d = Math.abs(e.rgba[0] - r) + Math.abs(e.rgba[1] - g) + Math.abs(e.rgba[2] - b) + Math.abs(e.rgba[3] - a); if (d < bestD) { bestD = d; best = e; } }
  // Assez proche : gardée ; sinon inconnue.
  const found = bestD <= NEAREST_TOLERANCE ? best : null;
  // Mémoire bornée : vidée au-delà de 4 096 couleurs.
  if (NEAREST.size > 4096) NEAREST.clear();
  // Résultat gardé.
  NEAREST.set(k, found);
  // Rendu.
  return found;
// Fin de decodeRadarColor.
}

/** Code d'un octet → réflectivité (dBZ), ou null pour 0 (aucun écho). */
// Déclare et exporte dbzOfCode : le code.
export const dbzOfCode = (code: number): number | null => (code > 0 ? code - DBZ_CODE_OFFSET : null);

/**
 * Intensité estimée des précipitations (mm/h d'eau) à partir de la réflectivité : relation de Marshall-Palmer
 * Z = 200 R^1,6 pour la pluie, Z = 2 000 R^2 pour la neige (équivalent en eau). Estimation : la relation réelle
 * dépend de la taille des gouttes.
 */
// Déclare et exporte rainRateMmH : la réflectivité et la nature.
export function rainRateMmH(dbz: number, snow = false): number {
  // Réflectivité linéaire (mm⁶/m³).
  const z = 10 ** (dbz / 10);
  // Intensité selon la relation, arrondie au dixième.
  return Math.round((snow ? Math.sqrt(z / 2000) : (z / 200) ** (1 / 1.6)) * 10) / 10;
// Fin de rainRateMmH.
}

/** Une image radar : identifiant (chemin de Rain Viewer) et heure (ms). */
// Forme d'une image.
export interface RadarFrame {
  // id : l'identifiant de l'image chez Rain Viewer (dernier segment du chemin).
  id: string;
  // time : l'heure de l'image, en millisecondes.
  time: number;
// Fin de RadarFrame.
}

/** Index lu : heure de fabrication, hôte des tuiles et images, de la plus ancienne à la plus récente. */
// Forme de l'index.
export interface RadarIndex {
  // generated : l'heure de fabrication de l'index (ms), ou null.
  generated: number | null;
  // host : l'hôte des tuiles.
  host: string;
  // frames : les images passées.
  frames: RadarFrame[];
// Fin de RadarIndex.
}

/**
 * Lit l'index weather-maps.json ; null si le format est inattendu. Les chemins sont pris tels quels (Rain Viewer y met
 * un identifiant opaque, plus l'heure) mais contrôlés ; un hôte inattendu fait refuser l'index (aucune requête ne part
 * ailleurs que chez Rain Viewer).
 */
// Déclare et exporte parseWeatherMaps : le JSON reçu.
export function parseWeatherMaps(json: unknown): RadarIndex | null {
  // Objet attendu.
  const j = json as { generated?: unknown; host?: unknown; radar?: { past?: unknown } } | null;
  // Pas un objet, ou sans liste des images passées : null.
  if (!j || typeof j !== 'object' || !Array.isArray(j.radar?.past)) return null;
  // Hôte annoncé.
  const host = typeof j.host === 'string' ? j.host.replace(/\/+$/, '') : '';
  // Hôte inattendu : null.
  if (host !== RAINVIEWER_HOST) return null;
  // Images contrôlées (début).
  const frames = (j.radar!.past as unknown[]).map((f) => {
    // Image attendue : objet avec heure et chemin.
    const o = f as { time?: unknown; path?: unknown } | null;
    // Chemin contrôlé : « /v2/radar/<identifiant> ».
    const m = typeof o?.path === 'string' ? /^\/v2\/radar\/([A-Za-z0-9_-]{4,64})$/.exec(o.path) : null;
    // Heure en secondes.
    const t = Number(o?.time);
    // Illisible : écartée ; sinon identifiant et heure en ms.
    return m && Number.isFinite(t) && t > 0 ? { id: m[1], time: t * 1000 } : null;
  // Images lisibles, sans doublon, de la plus ancienne à la plus récente.
  }).filter((f): f is RadarFrame => f !== null).filter((f, i, a) => a.findIndex((g) => g.id === f.id) === i).sort((a, b) => a.time - b.time);
  // Heure de fabrication.
  const g = Number(j.generated);
  // Index.
  return { generated: Number.isFinite(g) && g > 0 ? g * 1000 : null, host, frames };
// Fin de parseWeatherMaps.
}

/** Vrai si (z, x, y) est une tuile Web Mercator valide, au plus au niveau permis. */
// Déclare et exporte isRadarTile : niveau, colonne, ligne.
export const isRadarTile = (z: number, x: number, y: number): boolean => [z, x, y].every(Number.isInteger) && z >= 0 && z <= RADAR_MAX_ZOOM && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;

/** Adresse d'une tuile radar : sans lissage (0), neige distinguée (1), jeu « Universal Blue ». */
// Déclare et exporte radarTileUrl : identifiant de l'image, niveau, colonne, ligne.
export const radarTileUrl = (id: string, z: number, x: number, y: number): string => `${RAINVIEWER_HOST}/v2/radar/${id}/${RADAR_TILE_SIZE}/${z}/${x}/${y}/${RADAR_COLOR_SCHEME}/0_1.png`;

/** Adresse d'une tuile de couverture (transparent : couvert par un radar ; noir : hors de portée). */
// Déclare et exporte coverageTileUrl : niveau, colonne, ligne.
export const coverageTileUrl = (z: number, x: number, y: number): string => `${RAINVIEWER_HOST}/v2/coverage/0/${RADAR_TILE_SIZE}/${z}/${x}/${y}/0/0_0.png`;

/** Résultat du décodage d'une tuile : réflectivités par pixel et bilan. */
// Forme du décodage.
export interface DecodedRadar {
  // width, height : les dimensions.
  width: number; height: number;
  // rain, snow : codes de la pluie et de la neige par pixel (0 : aucun écho).
  rain: Uint8Array; snow: Uint8Array;
  // coverage : couverture par pixel (voir COVERAGE).
  coverage: Uint8Array;
  // echoes : pixels avec écho ; unknown : pixels de couleur inconnue (comptés sans écho).
  echoes: number; unknown: number;
// Fin de DecodedRadar.
}

/** Masque de couverture d'une tuile de couverture : 1 là où un radar couvre (pixel transparent), 0 ailleurs (noir). */
// Déclare et exporte coverageMask : la tuile de couverture décodée.
export function coverageMask(img: DecodedPng): Uint8Array {
  // Un octet par pixel.
  const mask = new Uint8Array(img.width * img.height);
  // Pixel par pixel : transparent (alpha < 128) → couvert.
  for (let i = 0; i < mask.length; i++) mask[i] = img.rgba[i * 4 + 3] < 128 ? 1 : 0;
  // Masque.
  return mask;
// Fin de coverageMask.
}

/** Décode une tuile radar (et le masque de couverture de la même tuile, s'il est connu) en réflectivités. */
// Déclare et exporte decodeRadarTile : la tuile et le masque de couverture.
export function decodeRadarTile(img: DecodedPng, coverage: Uint8Array | null): DecodedRadar {
  // Nombre de pixels.
  const n = img.width * img.height;
  // Tableaux du résultat.
  const rain = new Uint8Array(n), snow = new Uint8Array(n), cover = new Uint8Array(n);
  // Masque utilisable seulement à la même taille.
  const cov = coverage && coverage.length === n ? coverage : null;
  // Bilan.
  let echoes = 0, unknown = 0;
  // Pixel par pixel (début).
  for (let i = 0; i < n; i++) {
    // Position dans les pixels RVBA.
    const o = i * 4;
    // Entrée de la table.
    const e = decodeRadarColor(img.rgba[o], img.rgba[o + 1], img.rgba[o + 2], img.rgba[o + 3]);
    // Couleur visible mais inconnue : comptée.
    if (!e && img.rgba[o + 3] > 0) unknown++;
    // Écho : code de la neige ou de la pluie, borné à un octet.
    if (e) { const code = Math.max(1, Math.min(255, e.dbz + DBZ_CODE_OFFSET)); if (e.snow) snow[i] = code; else rain[i] = code; echoes++; }
    // Couverture : un écho prouve la couverture ; sinon le masque, sinon inconnue.
    cover[i] = e ? COVERAGE.covered : cov ? (cov[i] ? COVERAGE.covered : COVERAGE.none) : COVERAGE.unknown;
  // Fin des pixels.
  }
  // Résultat.
  return { width: img.width, height: img.height, rain, snow, coverage: cover, echoes, unknown };
// Fin de decodeRadarTile.
}

/** Pixels RVB à envoyer au navigateur : rouge = code de la pluie, vert = code de la neige, bleu = couverture. */
// Déclare et exporte radarToRgb : le décodage.
export function radarToRgb(d: DecodedRadar): Uint8Array {
  // Trois octets par pixel.
  const out = new Uint8Array(d.width * d.height * 3);
  // Pixel par pixel : pluie, neige, couverture.
  for (let i = 0; i < d.width * d.height; i++) { out[i * 3] = d.rain[i]; out[i * 3 + 1] = d.snow[i]; out[i * 3 + 2] = d.coverage[i]; }
  // Pixels.
  return out;
// Fin de radarToRgb.
}
