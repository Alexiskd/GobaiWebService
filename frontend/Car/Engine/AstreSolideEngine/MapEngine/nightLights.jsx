// Pollution lumineuse de la Terre la nuit : atlas mondial de la luminosité artificielle du ciel 2025 de David Lorenz
// (Light Pollution Atlas, djlorenz.github.io, recalcul de l'atlas de Cinzano à partir des lumières VIIRS annuelles de
// l'Earth Observation Group, Colorado School of Mines), en tuiles Web Mercator de 1 024 px, niveaux 0 à 6, sans clé,
// chargées par le navigateur. Ses 15 zones en fausses couleurs (noir, gris, bleu, vert, jaune, orange, rouge, blanc)
// sont recolorées en couleurs naturelles (naturalColour) : noir, brun, orange sodium, or, blanc chaud, selon la
// luminosité du ciel. Le shader des tuiles les allume du côté nuit, selon la hauteur du Soleil en chaque point (voir
// tileShaders.jsx) : elles s'allument au crépuscule, brillent toute la nuit et s'éteignent à l'aube, en suivant le
// terminateur en temps réel. Les villes les plus lumineuses gardent un halo, comme sur les photos prises depuis l'ISS :
// technique du « bloom » de three.js (LuminosityHighPassShader et UnrealBloomPass) appliquée à la chaîne de mipmaps
// de l'image (cityLight, bloomWeights).
// « gobai:lumieres-nuit » = « 0 » dans le stockage du navigateur les coupe.

// Importe le partage des téléchargements par adresse, depuis netLoads.
import { SharedLoads } from './netLoads.jsx';
// Importe le chargement d'une image (sans cache disque), depuis tileSource.
import { loadImage } from './tileSource.jsx';
// Importe le remplissage d'une adresse {z}/{x}/{y}, depuis mercator.
import { fillTemplate } from './mercator.jsx';
// Importe nativeTile, la tuile ancêtre d'un niveau donné et la portion couverte, depuis overzoom.
import { nativeTile } from './overzoom.jsx';

/** Clé de l'interrupteur dans le stockage du navigateur : « 0 » coupe les lumières de nuit. */
// Déclare et exporte la clé de l'interrupteur.
export const NIGHT_LIGHTS_KEY = 'gobai:lumieres-nuit';
// Déclare et exporte nightLightsChoice : allumées, sauf pour la valeur « 0 ».
export const nightLightsChoice = (raw) => raw !== '0';

/** Hauteur du Soleil (sinus) à laquelle les lumières commencent à s'allumer : 1° au-dessus de l'horizon. */
// Déclare et exporte le début de l'allumage.
export const LIGHTS_ON_START = 0.02;
/** Hauteur du Soleil (sinus) à laquelle elles brillent pleinement : ≈ 10° sous l'horizon (fin du crépuscule nautique). */
// Déclare et exporte la pleine nuit.
export const LIGHTS_FULL = -0.17;

/**
 * Part d'allumage des lumières (0 … 1) selon le cosinus `d` entre la verticale du lieu et la direction du Soleil :
 * même courbe que le shader (1 − smoothstep(−0,17 ; 0,02 ; d)).
 */
// Déclare et exporte nightWeight : le cosinus de l'angle avec le Soleil.
export function nightWeight(d) {
  // Position entre la pleine nuit et le début de l'allumage, bornée.
  const t = Math.min(1, Math.max(0, (d - LIGHTS_FULL) / (LIGHTS_ON_START - LIGHTS_FULL)));
  // Une moins la courbe en S.
  return 1 - t * t * (3 - 2 * t);
// Fin de nightWeight.
}

/**
 * Zones de l'atlas (page « Color Scale » de l'atlas) : couleur exacte de la tuile et rapport entre la luminosité
 * artificielle et la luminosité naturelle du ciel (indice LPI), de `min` à `max`. Un cran de zone = un facteur 3.
 */
// Déclare et exporte les 15 zones, de 0 (ciel vierge) à 7b (centre-ville) (début).
export const LP_ZONES = [
  // Zone 0 : noir, LPI < 0,01 ; zone 1a : gris très sombre ; zone 1b : gris sombre.
  { zone: '0', rgb: [0, 0, 0], min: 0, max: 0.01 }, { zone: '1a', rgb: [34, 34, 34], min: 0.01, max: 0.06 }, { zone: '1b', rgb: [66, 66, 66], min: 0.06, max: 0.11 },
  // Zones 2a et 2b : bleu sombre et bleu.
  { zone: '2a', rgb: [20, 47, 114], min: 0.11, max: 0.19 }, { zone: '2b', rgb: [33, 84, 216], min: 0.19, max: 0.33 },
  // Zones 3a et 3b : vert sombre et vert (3b/4a : la lumière artificielle égale la naturelle).
  { zone: '3a', rgb: [15, 87, 20], min: 0.33, max: 0.58 }, { zone: '3b', rgb: [31, 161, 42], min: 0.58, max: 1 },
  // Zones 4a et 4b : jaune sombre et jaune.
  { zone: '4a', rgb: [110, 100, 30], min: 1, max: 1.73 }, { zone: '4b', rgb: [184, 166, 37], min: 1.73, max: 3 },
  // Zones 5a et 5b : orange sombre et orange.
  { zone: '5a', rgb: [191, 100, 30], min: 3, max: 5.2 }, { zone: '5b', rgb: [253, 150, 80], min: 5.2, max: 9 },
  // Zones 6a et 6b : rouge et rose.
  { zone: '6a', rgb: [251, 90, 73], min: 9, max: 15.59 }, { zone: '6b', rgb: [251, 153, 138], min: 15.59, max: 27 },
  // Zones 7a et 7b : gris clair et blanc (7b : au-delà de 46,77 ; 80 pour le calcul).
  { zone: '7a', rgb: [160, 160, 160], min: 27, max: 46.77 }, { zone: '7b', rgb: [242, 242, 242], min: 46.77, max: 80 },
// Fin des zones.
];

// Courbe en S entre a et b.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Couleur naturelle d'une zone (0 … 255) : luminosité selon le logarithme de son indice (centre géométrique de la
 * zone, de 0,01 à 80), avec une courbe qui laisse les campagnes sombres ; teinte orange sodium qui tourne à l'or puis
 * au blanc chaud dans les centres-villes. Zone 0 : noir.
 */
// Déclare et exporte naturalColour : l'indice minimal et maximal de la zone.
export function naturalColour(min, max) {
  // Ciel vierge : noir.
  if (max <= 0.01) return [0, 0, 0];
  // Position de la zone sur l'échelle logarithmique, de 0 à 1.
  const l = Math.min(1, Math.max(0, (Math.log10(Math.sqrt(min * max)) + 2) / (Math.log10(80) + 2)));
  // Intensité : les zones faibles restent sombres.
  const i = l ** 1.6;
  // Orange sodium vers l'or.
  const s = smooth(0.3, 0.8, l);
  // Puis vers le blanc chaud.
  const w = smooth(0.85, 1, l);
  // Teinte : orange (1 ; 0,42 ; 0,12), or (1 ; 0,78 ; 0,45), blanc chaud (1 ; 0,96 ; 0,88).
  const hue = [0, 1, 2].map((k) => { const c = [1, 0.42, 0.12][k] + ([1, 0.78, 0.45][k] - [1, 0.42, 0.12][k]) * s; return c + ([1, 0.96, 0.88][k] - c) * w; });
  // Couleur de 0 à 255.
  return hue.map((c) => Math.round(255 * i * c));
// Fin de naturalColour.
}

// Couleur d'un pixel en un entier 0xRRGGBB.
const pack = (r, g, b) => (r << 16) | (g << 8) | b;
/** Table de recoloration : couleur de l'atlas → couleur naturelle, toutes deux en 0xRRGGBB. */
// Déclare et exporte la table des couleurs naturelles.
export const NATURAL_KEY = new Map(LP_ZONES.map(({ rgb, min, max }) => [pack(...rgb), pack(...naturalColour(min, max))]));

/** Couleur naturelle de la zone la plus proche d'un pixel quelconque (pixel lissé ou recompressé), en 0xRRGGBB. */
// nearestNatural : les trois composantes du pixel.
function nearestNatural(r, g, b) {
  // Meilleure zone et sa distance.
  let best = 0, bd = Infinity;
  // Pour chaque zone : distance au carré dans l'espace des couleurs.
  LP_ZONES.forEach(({ rgb }, k) => { const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2; if (d < bd) { bd = d; best = k; } });
  // Sa couleur naturelle.
  return NATURAL_KEY.get(pack(...LP_ZONES[best].rgb));
// Fin de nearestNatural.
}

/** Recolore en place des pixels RGBA (ImageData.data) : chaque couleur de l'atlas devient sa couleur naturelle. */
// Déclare et exporte recolourPixels : le tableau des pixels.
export function recolourPixels(data) {
  // Couleurs inconnues déjà rencontrées (cache).
  const seen = new Map();
  // Pour chaque pixel (début).
  for (let p = 0; p < data.length; p += 4) {
    // Sa couleur.
    const key = pack(data[p], data[p + 1], data[p + 2]);
    // Couleur naturelle : celle de la table, sinon celle de la zone la plus proche (gardée).
    let n = NATURAL_KEY.get(key) ?? seen.get(key);
    // Inconnue : calculée et gardée.
    if (n === undefined) { n = nearestNatural(data[p], data[p + 1], data[p + 2]); seen.set(key, n); }
    // Écrit la couleur naturelle, opaque.
    data[p] = n >> 16; data[p + 1] = (n >> 8) & 255; data[p + 2] = n & 255; data[p + 3] = 255;
  // Fin de la boucle.
  }
  // Renvoie le tableau.
  return data;
// Fin de recolourPixels.
}

/** Tuile de l'atlas recolorée en couleurs naturelles, sur un canevas de sa taille. */
// Déclare et exporte naturalLightsImage : l'image et la fabrique de canevas.
export function naturalLightsImage(img, createCanvas = () => globalThis.document.createElement('canvas')) {
  // Canevas de la taille de l'image.
  const canvas = createCanvas();
  // Sa taille.
  canvas.width = img.naturalWidth || img.width; canvas.height = img.naturalHeight || img.height;
  // Contexte, lu souvent.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Dessine l'image.
  ctx.drawImage(img, 0, 0);
  // Ses pixels.
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Recolorés, puis reposés.
  recolourPixels(px.data); ctx.putImageData(px, 0, 0);
  // Renvoie le canevas.
  return canvas;
// Fin de naturalLightsImage.
}

/**
 * Halo d'un pixel de lumière naturelle (r, g, b entre 0 et 1) : même formule que `cityLight` du shader. Filtre
 * passe-haut sur la luminosité (seuil 0,35, comme LuminosityHighPassShader) : seules les zones 5a et plus brillantes
 * rayonnent autour d'elles.
 */
// Déclare et exporte cityLight : les trois composantes du pixel.
export function cityLight([r, g, b]) {
  // Luminosité au-delà du seuil, multipliée par 1,6.
  return Math.max(0.299 * r + 0.587 * g + 0.114 * b - 0.35, 0) * 1.6;
// Fin de cityLight.
}

/** Facteurs des niveaux de flou de UnrealBloomPass (three.js), les quatre premiers, et le rayon du halo. */
// Déclare et exporte les facteurs : 1 ; 0,8 ; 0,6 ; 0,4.
export const BLOOM_FACTORS = [1, 0.8, 0.6, 0.4];
// Déclare et exporte le rayon : 0,4.
export const BLOOM_RADIUS = 0.4;
/** Poids des niveaux du halo, comme `lerpBloomFactor` de UnrealBloomPass : mélange de f et de 1,2 − f selon le rayon. */
// Déclare et exporte bloomWeights : le rayon (BLOOM_RADIUS par défaut).
export const bloomWeights = (radius = BLOOM_RADIUS) => BLOOM_FACTORS.map((f) => Math.round((f + (1.2 - f - f) * radius) * 100) / 100);

/**
 * Poids des quatre niveaux du halo à un niveau de détail donné de la mosaïque (log₂ de ses pixels par pixel d'écran) :
 * ceux de bloomWeights, chacun multiplié par le flou qu'il apporte vraiment à l'écran (lod + k borné entre 0 et 1).
 * Même calcul que `cityHalo` du shader : plein halo vu de loin, plus aucun une fois la mosaïque agrandie (lod ≤ −4),
 * pour que les villes vues de près ne soient pas éclaircies par un halo d'objectif.
 */
// Déclare et exporte haloWeights : le niveau de détail de la mosaïque.
export const haloWeights = (lod) => bloomWeights().map((w, i) => w * Math.min(1, Math.max(0, lod + i + 1)));

/**
 * Poids de l'interpolation bicubique B-spline (de la tuile agrandie) pour une position fractionnaire f entre deux
 * pixels : [w0, w1, w2, w3], positifs, de somme 1 — lissage sans dépassement, sans détail inventé. Même calcul que
 * `lightCore` du shader.
 */
// Déclare et exporte bsplineWeights : la position fractionnaire.
export function bsplineWeights(f) {
  // Carré et cube.
  const f2 = f * f, f3 = f2 * f;
  // Les quatre poids cubiques.
  return [(1 - 3 * f + 3 * f2 - f3) / 6, (4 - 6 * f2 + 3 * f3) / 6, (1 + 3 * f + 3 * f2 - 3 * f3) / 6, f3 / 6];
// Fin de bsplineWeights.
}

/**
 * Repli d'une tuile affichée en attendant sa tuile de lumières : l'ancêtre le plus proche déjà sur la carte graphique.
 * `loaded` : tuiles de lumières chargées (« z/x/y » → image) ; `native` : la tuile de l'atlas voulue ; `shown` : la tuile
 * affichée. Renvoie { img, rect } (rect : portion de l'ancêtre couverte par la tuile affichée) ou null.
 */
// Déclare et exporte lightsFallback : les tuiles chargées, la tuile voulue et la tuile affichée.
export function lightsFallback(loaded, native, shown) {
  // Du niveau juste au-dessus jusqu'au niveau 0 (début).
  for (let z = native.z - 1; z >= 0; z--) {
    // L'ancêtre à ce niveau.
    const a = nativeTile(native, z).coord;
    // Son image, si elle est chargée.
    const img = loaded.get(`${a.z}/${a.x}/${a.y}`);
    // Trouvée : elle, avec la portion de la tuile affichée.
    if (img) return { img, rect: nativeTile(shown, z).rect };
  // Fin de la boucle.
  }
  // Aucun ancêtre chargé : null.
  return null;
// Fin de lightsFallback.
}

/**
 * Courbe d'affichage des lumières, composante par composante : inchangée jusqu'à 0,8, puis approche douce de 1 (pente 1
 * au raccord). Monotone : l'ordre des intensités est conservé ; les zones les plus brillantes (6a à 7b), qui saturaient
 * toutes en même aplat, restent distinctes, de l'orangé au blanc. Même calcul que `lightKnee` du shader.
 */
// Déclare et exporte lightKnee : les trois composantes [r, g, b] de la lumière.
export const lightKnee = (c) => c.map((v) => (v <= 0.8 ? v : 0.8 + 0.2 * (1 - Math.exp((0.8 - v) / 0.2))));

/** Tuiles de lumières préchargées au plus à chaque nouvelle vue prédite (zones voisines du champ de la caméra). */
// Déclare et exporte LIGHTS_PREFETCH_MAX : 8 tuiles natives (1 024 px chacune) au plus.
export const LIGHTS_PREFETCH_MAX = 8;

/**
 * Tuiles de l'atlas à précharger pour une vue élargie (celle du préchargement prédictif) : la tuile native de chaque
 * tuile de la vue, une seule fois, la plus utile d'abord (priorité la plus petite), sans celles déjà chargées, `max`
 * au plus. `tiles` : [{ z, x, y, p }] ; renvoie [{ coord, key, p }], `key` de la forme « z/x/y ».
 */
// Déclare et exporte lightsPrefetchList : les tuiles de la vue, le niveau le plus fin de l'atlas, les chargées, le plafond.
export function lightsPrefetchList(tiles, maxZoom, loaded, max = LIGHTS_PREFETCH_MAX) {
  // Tuiles natives retenues, par clé.
  const byKey = new Map();
  // Pour chaque tuile de la vue (début).
  for (const t of tiles) {
    // Sa tuile native dans l'atlas.
    const c = nativeTile(t, maxZoom).coord;
    // Sa clé.
    const key = `${c.z}/${c.x}/${c.y}`;
    // Déjà chargée : suivante.
    if (loaded.has(key)) continue;
    // Déjà retenue : la priorité la plus forte des deux.
    const had = byKey.get(key);
    // Garde la plus petite priorité.
    if (!had || t.p < had.p) byKey.set(key, { coord: c, key, p: t.p ?? 0 });
  // Fin de la boucle.
  }
  // Les plus utiles d'abord, `max` au plus.
  return [...byKey.values()].sort((a, b) => a.p - b.p).slice(0, max);
// Fin de lightsPrefetchList.
}

/**
 * Bordure des tuiles de lumières sur la carte graphique, en pixels : chaque tuile est entourée de 2 pixels pris dans
 * ses huit voisines, si bien que le lissage (bilinéaire, bicubique, mipmaps proches) traverse les bords sans raccord.
 */
// Déclare et exporte LIGHTS_PAD : 2 pixels (le bicubique lit 1,5 pixel au-delà du bord).
export const LIGHTS_PAD = 2;

/** Les huit directions des voisines d'une tuile : [dx, dy], y vers le bas comme les numéros de tuiles. */
// Déclare et exporte NEIGHBOUR_DIRS : les huit directions.
export const NEIGHBOUR_DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Voisine d'une tuile dans une direction : x bouclé à l'antiméridien, null au-delà des pôles. */
// Déclare et exporte neighbourTile : la tuile et la direction.
export function neighbourTile({ z, x, y }, [dx, dy]) {
  // Tuiles par côté à ce niveau.
  const n = 2 ** z;
  // Rangée de la voisine.
  const ny = y + dy;
  // Au-delà d'un pôle : aucune.
  if (ny < 0 || ny >= n) return null;
  // Colonne bouclée (l'antiméridien n'a pas de bord), même niveau.
  return { z, x: (((x + dx) % n) + n) % n, y: ny };
// Fin de neighbourTile.
}

/**
 * Bande de bordure d'une tuile de côté N (bordure p) dans la direction [dx, dy] : `src`, rectangle [x, y, l, h] à
 * prendre dans la voisine (sans sa bordure) ; `dst`, sa place dans le canevas bordé ; `edge`, le bord de la tuile
 * elle-même à étirer quand la voisine manque (même effet que le bord bloqué d'avant).
 */
// Déclare et exporte padStrip : le côté, la bordure et la direction.
export function padStrip(N, p, [dx, dy]) {
  // Un axe : avant (−1), dedans (0) ou après (+1).
  const axis = (d) => (d < 0 ? { s: N - p, w: p, o: 0, e: 0, ew: 1 } : d > 0 ? { s: 0, w: p, o: p + N, e: N - 1, ew: 1 } : { s: 0, w: N, o: p, e: 0, ew: N });
  // Les deux axes.
  const ax = axis(dx), ay = axis(dy);
  // Source, destination, bord à étirer.
  return { src: [ax.s, ay.s, ax.w, ay.w], dst: [ax.o, ay.o, ax.w, ay.w], edge: [ax.e, ay.e, ax.ew, ay.ew] };
// Fin de padStrip.
}

/** Portion [x, y, l, h] (v vers le haut) d'une tuile de côté N, ramenée dans sa texture bordée de p pixels. */
// Déclare et exporte paddedRect : la portion, le côté et la bordure.
export function paddedRect([x, y, w, h], N, p) {
  // Côté de la texture bordée.
  const s = N + 2 * p;
  // Décalage de la bordure, puis mise à l'échelle.
  return [(p + x * N) / s, (p + y * N) / s, (w * N) / s, (h * N) / s];
// Fin de paddedRect.
}

/**
 * Pose une bande de bordure dans le canevas bordé d'une tuile : prise dans la voisine (canevas bordé lui aussi) si
 * elle est là, sinon le bord de la tuile étiré (sans lissage). `own` : l'image de la tuile, sans bordure.
 */
// Déclare et exporte fillPad : le contexte, l'image de la tuile, la voisine (ou null), la direction, le côté, la bordure.
export function fillPad(ctx, own, nb, dir, N, p) {
  // La bande.
  const { src, dst, edge } = padStrip(N, p, dir);
  // Voisine présente : sa bande, décalée de sa propre bordure.
  if (nb) ctx.drawImage(nb, src[0] + p, src[1] + p, src[2], src[3], ...dst);
  // Sinon : le bord de la tuile, étiré.
  else if (own) ctx.drawImage(own, ...edge, ...dst);
// Fin de fillPad.
}

/**
 * Canevas bordé d'une tuile de lumières : l'image au centre, entourée de p pixels de ses voisines déjà chargées
 * (`neighbour(dir)` : leur canevas bordé, ou null), sinon de son propre bord étiré.
 */
// Déclare et exporte padLightsImage : l'image, la bordure, les voisines et la création d'un canevas.
export function padLightsImage(img, p, neighbour, createCanvas = () => globalThis.document.createElement('canvas')) {
  // Côté de l'image.
  const N = img.naturalWidth || img.width;
  // Canevas bordé.
  const c = createCanvas();
  // Sa taille.
  c.width = c.height = N + 2 * p;
  // Son contexte, sans lissage (copie exacte des pixels, bords étirés sans mélange).
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  // L'image au centre.
  ctx.drawImage(img, p, p);
  // Les huit bandes.
  for (const dir of NEIGHBOUR_DIRS) fillPad(ctx, img, neighbour(dir), dir, N, p);
  // Renvoie le canevas.
  return c;
// Fin de padLightsImage.
}

/** Réglage de la pollution lumineuse de la Terre : atlas 2025 de David Lorenz, tuiles de 1 024 px, niveaux 0 à 6. */
// Déclare et exporte le réglage des lumières de la Terre.
export const EARTH_NIGHT_LIGHTS = {
  // Modèle d'adresse : tuiles de l'atlas 2025, Web Mercator ({z} {x} {y} comme OpenStreetMap), PNG.
  template: 'https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png',
  // Niveau le plus fin : 6 (1 024 px, ≈ 600 m par pixel à l'équateur), agrandi au-delà.
  maxZoom: 6,
  // Côté d'une tuile : 1 024 px.
  tileSize: 1024,
  // Recolorée en couleurs naturelles.
  natural: true,
  // Mention.
  attribution: 'Pollution lumineuse 2025 : Light Pollution Atlas, David Lorenz (lumières VIIRS de l’Earth Observation Group, Colorado School of Mines)',
// Fin du réglage.
};

/** Source des tuiles de lumières : un téléchargement par adresse, partagé par toutes les tuiles affichées qu'elle couvre. */
// Déclare et exporte la classe NightLightsSource (début).
export class NightLightsSource {
  // Constructeur : le modèle d'adresse, le niveau le plus fin, le côté des tuiles et la recoloration naturelle (début).
  constructor({ template, maxZoom, tileSize = 256, natural = false }) {
    // Garde le modèle, le niveau et le côté des tuiles.
    this.template = template; this.maxZoom = maxZoom; this.tileSize = tileSize;
    // Téléchargements partagés par adresse : une image reste partagée 30 s ; recolorée en couleurs naturelles si demandé.
    this.loads = new SharedLoads((url, signal, urgent) => loadImage(url, signal, urgent).then((img) => (natural ? naturalLightsImage(img) : img)), { keepMs: 30_000 });
  // Fin du constructeur.
  }

  // loadImage : l'image d'une tuile (z, x, y), partagée.
  loadImage(coord, signal) { return this.loads.get(fillTemplate(this.template, coord), signal); }
// Fin de la classe NightLightsSource.
}

/**
 * Couverture mondiale permanente de la pollution lumineuse : une mosaïque Web Mercator de 2 048 px de côté (atlas :
 * niveau 1, 4 tuiles de 1 024 px, ≈ 20 km par pixel à l'équateur, sur tous les appareils), chargée dès que les
 * lumières sont allumées. Elle couvre la Terre entière vue de loin, sert de repli sous les tuiles fines pendant leur
 * chargement (jamais de trou) et porte le halo des villes. 2 048 px suffisent vus de loin (la Terre fait au plus
 * ≈ 1 000 px à l'écran) et tiennent ≈ 21 Mo de carte graphique, contre ≈ 85 Mo à 4 096 px.
 */
// Déclare et exporte le côté de la mosaïque mondiale : 2 048 px.
export const LIGHTS_MOSAIC_PX = 2048;
// Déclare et exporte mosaicLevelFor : le niveau dont les tuiles font la mosaïque, selon leur côté (256 px → 3, 1 024 px → 1).
export const mosaicLevelFor = (tileSize = 256) => Math.max(0, Math.round(Math.log2(LIGHTS_MOSAIC_PX / tileSize)));
// Tuiles de la mosaïque demandées en même temps.
const MOSAIC_PARALLEL = 16;

/** Toutes les tuiles d'un niveau, ligne par ligne du nord au sud. */
// Déclare et exporte mosaicTiles : le niveau.
export function mosaicTiles(level) {
  // Nombre de tuiles par côté.
  const n = 2 ** level;
  // Chaque tuile de la grille.
  return Array.from({ length: n * n }, (_, k) => ({ z: level, x: k % n, y: Math.floor(k / n) }));
// Fin de mosaicTiles.
}

/**
 * Mosaïque mondiale des lumières : toutes les tuiles du niveau `level`, collées sur un canevas (au côté des tuiles de la source).
 * Une tuile manquante reste noire (pas de lumière). Renvoie le canevas et le nombre de tuiles arrivées.
 */
// Déclare et exporte assembleLightsMosaic, asynchrone : la source, le niveau et la fabrique de canevas (début).
export async function assembleLightsMosaic(source, level, createCanvas = () => globalThis.document.createElement('canvas')) {
  // Tuiles à charger.
  const tiles = mosaicTiles(level);
  // Canevas du monde entier.
  const canvas = createCanvas();
  // Côté d'une tuile : celui de la source (256 px par défaut).
  const px = source.tileSize || 256;
  // À la taille de la grille.
  canvas.width = canvas.height = px * 2 ** level;
  // Son contexte, fond noir.
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Tuiles arrivées.
  let got = 0;
  // Par paquets (début).
  for (let i = 0; i < tiles.length; i += MOSAIC_PARALLEL) {
    // Chaque tuile du paquet : chargée et collée à sa place ; un échec est ignoré.
    await Promise.all(tiles.slice(i, i + MOSAIC_PARALLEL).map((t) => source.loadImage(t).then((img) => { ctx.drawImage(img, t.x * px, t.y * px, px, px); got++; }).catch(() => {})));
  // Fin des paquets.
  }
  // Le canevas et le compte.
  return { canvas, got, total: tiles.length };
// Fin de assembleLightsMosaic.
}
