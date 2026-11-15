// Lumières humaines de la Terre la nuit (pollution lumineuse vue de l'espace) : NASA Black Marble 2016 (VIIRS, Suomi
// NPP), en tuiles Web Mercator de NASA GIBS jusqu'au niveau 8, sans clé, chargées par le navigateur. Le shader des
// tuiles les allume du côté nuit, selon la hauteur du Soleil en chaque point (voir tileShaders.jsx) : elles s'allument
// au crépuscule, brillent toute la nuit et s'éteignent à l'aube, en suivant le terminateur en temps réel. Comme sur
// les photos prises depuis l'ISS, les villes ont un cœur blanc et un halo orangé : technique du « bloom » de three.js
// (LuminosityHighPassShader et UnrealBloomPass) appliquée à la chaîne de mipmaps de l'image (cityLight, bloomWeights).
// « gobai:lumieres-nuit » = « 0 » dans le stockage du navigateur les coupe.

// Importe le partage des téléchargements par adresse, depuis netLoads.
import { SharedLoads } from './netLoads';
// Importe le chargement d'une image (sans cache disque), depuis tileSource.
import { loadImage } from './tileSource';
// Importe le remplissage d'une adresse {z}/{x}/{y}, depuis mercator.
import { fillTemplate } from './mercator';

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
 * Intensité d'une lumière humaine dans un pixel Black Marble (r, g, b entre 0 et 1) : même formule que `cityLight` du
 * shader. Filtre passe-haut doux sur l'excès de rouge sur le bleu (lampes jaunes à blanches ; sol et mer bleutés
 * écartés), multiplié par la luminosité.
 */
// Déclare et exporte cityLight : les trois composantes du pixel.
export function cityLight([r, g, b]) {
  // Excès de rouge sur le bleu.
  const w = Math.max(r - 0.8 * b, 0);
  // Position dans le filtre passe-haut (de 0,05 à 0,3), bornée.
  const t = Math.min(1, Math.max(0, (w - 0.05) / 0.25));
  // Courbe en S, multipliée par 0,35 plus la luminosité.
  return t * t * (3 - 2 * t) * (0.35 + 0.299 * r + 0.587 * g + 0.114 * b);
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

/** Réglage des lumières de la Terre : tuiles Black Marble de GIBS, niveaux 0 à 8, et leur mention. */
// Déclare et exporte le réglage des lumières de la Terre.
export const EARTH_NIGHT_LIGHTS = {
  // Modèle d'adresse : WMTS de GIBS, Web Mercator, couche VIIRS_Black_Marble, image de 2016, PNG.
  template: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
  // Niveau le plus fin : 8 (≈ 600 m par pixel), agrandi au-delà.
  maxZoom: 8,
  // Mention.
  attribution: 'Lumières de nuit : NASA Black Marble 2016 (VIIRS, Suomi NPP), via NASA GIBS',
// Fin du réglage.
};

/** Source des tuiles de lumières : un téléchargement par adresse, partagé par toutes les tuiles affichées qu'elle couvre. */
// Déclare et exporte la classe NightLightsSource (début).
export class NightLightsSource {
  // Constructeur : le modèle d'adresse et le niveau le plus fin (début).
  constructor({ template, maxZoom }) {
    // Garde le modèle et le niveau.
    this.template = template; this.maxZoom = maxZoom;
    // Téléchargements partagés par adresse : une image reste partagée 30 s.
    this.loads = new SharedLoads((url, signal, urgent) => loadImage(url, signal, urgent), { keepMs: 30_000 });
  // Fin du constructeur.
  }

  // loadImage : l'image d'une tuile (z, x, y), partagée.
  loadImage(coord, signal) { return this.loads.get(fillTemplate(this.template, coord), signal); }
// Fin de la classe NightLightsSource.
}

/**
 * Vue de la pollution lumineuse depuis l'espace : toute la Terre de nuit. Pour que le globe entier soit allumé d'un
 * coup, ses lumières sont chargées en une seule mosaïque Web Mercator (niveau 4 : 256 tuiles, 4 096 px de côté ;
 * niveau 3 sur téléphone : 64 tuiles, 2 048 px), posée sous les tuiles plus fines qui arrivent ensuite.
 */
// Déclare et exporte le niveau de la mosaïque mondiale : 4 sur ordinateur, 3 sur téléphone.
export const LIGHTS_MOSAIC_LEVEL = { desktop: 4, phone: 3 };
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
 * Mosaïque mondiale des lumières : toutes les tuiles du niveau `level`, collées sur un canevas (256 px par tuile).
 * Une tuile manquante reste noire (pas de lumière). Renvoie le canevas et le nombre de tuiles arrivées.
 */
// Déclare et exporte assembleLightsMosaic, asynchrone : la source, le niveau et la fabrique de canevas (début).
export async function assembleLightsMosaic(source, level, createCanvas = () => globalThis.document.createElement('canvas')) {
  // Tuiles à charger.
  const tiles = mosaicTiles(level);
  // Canevas du monde entier.
  const canvas = createCanvas();
  // À la taille de la grille.
  canvas.width = canvas.height = 256 * 2 ** level;
  // Son contexte, fond noir.
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Tuiles arrivées.
  let got = 0;
  // Par paquets (début).
  for (let i = 0; i < tiles.length; i += MOSAIC_PARALLEL) {
    // Chaque tuile du paquet : chargée et collée à sa place ; un échec est ignoré.
    await Promise.all(tiles.slice(i, i + MOSAIC_PARALLEL).map((t) => source.loadImage(t).then((img) => { ctx.drawImage(img, t.x * 256, t.y * 256, 256, 256); got++; }).catch(() => {})));
  // Fin des paquets.
  }
  // Le canevas et le compte.
  return { canvas, got, total: tiles.length };
// Fin de assembleLightsMosaic.
}
