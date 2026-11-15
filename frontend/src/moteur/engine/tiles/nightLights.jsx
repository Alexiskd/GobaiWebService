// Lumières humaines de la Terre la nuit (pollution lumineuse vue de l'espace) : NASA Black Marble 2016 (VIIRS, Suomi
// NPP), en tuiles Web Mercator de NASA GIBS jusqu'au niveau 8, sans clé, chargées par le navigateur. Le shader des
// tuiles les allume du côté nuit, selon la hauteur du Soleil en chaque point (voir tileShaders.jsx) : elles s'allument
// au crépuscule, brillent toute la nuit et s'éteignent à l'aube, en suivant le terminateur en temps réel.
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
