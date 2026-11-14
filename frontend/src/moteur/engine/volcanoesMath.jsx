// Importe le générateur pseudo-aléatoire et les formules balistiques, communs avec les éruptions du Soleil.
import { apexHeight, flightTime, seededRandom } from './sunSurfaceMath';

// Calculs des volcans en éruption sur la Terre (sans three.js, donc testables seuls) : nettoyage de la liste reçue
// du serveur et tableaux de particules envoyés au shader de volcanoes.jsx.
//
// Modèle : chaque volcan a un repère lumineux (visible de loin) et une fontaine continue de grains projetés depuis
// le cratère, qui montent puis retombent (hauteur = vUp·t − g·t²/2). Les distances sont en rayons terrestres
// (1 rayon = 6 371 km) : le panache monte de 6 à 18 km, l'ordre de grandeur d'un vrai panache de cendres. Le temps
// est accéléré pour que le mouvement se voie.

/** Gravité du modèle, en rayons terrestres par seconde carrée (temps d'affichage accéléré). */
// Déclare et exporte la gravité du modèle.
export const VOLCANO_GRAVITY = 4.5e-4;
/** Vitesse verticale de départ la plus faible et la plus forte, en rayons terrestres par seconde. */
// Déclare et exporte la vitesse verticale minimale.
export const VOLCANO_V_MIN = 0.9e-3;
// Déclare et exporte la vitesse verticale maximale.
export const VOLCANO_V_MAX = 1.6e-3;
/** Nombre maximal de volcans dessinés. */
// Déclare et exporte le nombre maximal de volcans : 80.
export const MAX_VOLCANOES = 80;

/** Point de la sphère de rayon 1 à une longitude et une latitude en degrés : même repère que lonLatToVec (ephemeris.jsx). */
// Déclare et exporte lonLatToUnit : la longitude et la latitude.
export function lonLatToUnit(lon, lat) {
  // Longitude et latitude en radians.
  const lo = (lon * Math.PI) / 180, la = (lat * Math.PI) / 180;
  // Renvoie le point : y vers le pôle nord.
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
// Fin de lonLatToUnit.
}

/** Nettoie la liste du serveur : garde les volcans aux coordonnées valides, sans doublon, MAX_VOLCANOES au plus. */
// Déclare et exporte normalizeVolcanoes : la liste reçue.
export function normalizeVolcanoes(list) {
  // Identifiants déjà vus.
  const seen = new Set();
  // Volcans gardés.
  const out = [];
  // Pour chaque entrée, si la liste en est une (début).
  for (const v of Array.isArray(list) ? list : []) {
    // Sa longitude et sa latitude.
    const lon = Number(v?.lon), lat = Number(v?.lat);
    // Son identifiant : celui du serveur, sinon ses coordonnées.
    const id = String(v?.id ?? `${lon},${lat}`);
    // Coordonnées absentes ou hors du globe, ou volcan déjà vu : ignoré.
    if (v?.lon == null || v?.lat == null || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || seen.has(id)) continue;
    // Note l'identifiant.
    seen.add(id);
    // Garde le volcan.
    out.push({ id, name: String(v.name || ''), lon, lat });
    // Maximum atteint : arrêt.
    if (out.length >= MAX_VOLCANOES) break;
  // Fin de la boucle.
  }
  // Renvoie les volcans gardés.
  return out;
// Fin de normalizeVolcanoes.
}

/**
 * Tableaux des points pour le shader : pour chaque volcan, un repère puis `grains` grains. Pour chaque point :
 *  - `position` : le cratère sur la sphère de rayon 1 (3 nombres) ;
 *  - `slide`    : la direction dans laquelle le grain dérive le long du sol, unitaire (3 nombres ; nulle pour le repère) ;
 *  - `launch`   : vitesse verticale (0 pour le repère), vitesse le long du sol, décalage dans le temps, taille relative.
 */
// Déclare et exporte buildVolcanoAttributes : les volcans, le nombre de grains par volcan et la graine.
export function buildVolcanoAttributes(volcanoes, grains, seed = 11) {
  // Générateur pseudo-aléatoire.
  const rnd = seededRandom(seed);
  // Points par volcan : le repère et les grains.
  const per = grains + 1;
  // Nombre total de points.
  const count = volcanoes.length * per;
  // Cratères.
  const position = new Float32Array(count * 3);
  // Directions de dérive.
  const slide = new Float32Array(count * 3);
  // Paramètres de lancement.
  const launch = new Float32Array(count * 4);
  // Indice du point.
  let i = 0;
  // Pour chaque volcan (début).
  for (const v of volcanoes) {
    // Le cratère.
    const [ox, oy, oz] = lonLatToUnit(v.lon, v.lat);
    // Longueur de la projection du cratère sur l'équateur ; aux pôles, une valeur minuscule évite la division par zéro.
    const el = Math.hypot(ox, oz) || 1e-9;
    // L'est local, unitaire.
    const ex = oz / el, ez = -ox / el;
    // Le nord local : produit vectoriel du cratère et de l'est.
    const nx = oy * ez, ny = oz * ex - ox * ez, nz = -oy * ex;
    // Pour chaque point du volcan (début).
    for (let k = 0; k < per; k++, i++) {
      // Cratère : x.
      position[i * 3] = ox;
      // y.
      position[i * 3 + 1] = oy;
      // z.
      position[i * 3 + 2] = oz;
      // Décalage dans le temps : chaque point a son propre rythme.
      launch[i * 4 + 2] = rnd() * 10;
      // Premier point : le repère, sans vitesse, de taille 1.
      if (k === 0) { launch[i * 4 + 3] = 1; continue; }
      // Direction de dérive : un angle au hasard autour du cratère.
      const angle = rnd() * Math.PI * 2;
      // Mélange de l'est et du nord locaux : x.
      slide[i * 3] = ex * Math.cos(angle) + nx * Math.sin(angle);
      // y.
      slide[i * 3 + 1] = ny * Math.sin(angle);
      // z.
      slide[i * 3 + 2] = ez * Math.cos(angle) + nz * Math.sin(angle);
      // Vitesse verticale : entre le minimum et le maximum.
      const vUp = VOLCANO_V_MIN + rnd() * (VOLCANO_V_MAX - VOLCANO_V_MIN);
      // La range.
      launch[i * 4] = vUp;
      // Vitesse le long du sol : jusqu'à 25 % de la vitesse verticale, pour une gerbe en cône étroit.
      launch[i * 4 + 1] = vUp * rnd() * 0.25;
      // Taille relative : entre 0,6 et 1,4.
      launch[i * 4 + 3] = 0.6 + rnd() * 0.8;
    // Fin de la boucle des points.
    }
  // Fin de la boucle des volcans.
  }
  // Renvoie les tableaux et le nombre de points.
  return { count, position, slide, launch };
// Fin de buildVolcanoAttributes.
}

/** Hauteur maximale du panache, en kilomètres, pour une vitesse verticale donnée. */
// Déclare et exporte plumeHeightKm : la vitesse verticale.
export const plumeHeightKm = (vUp) => apexHeight(vUp, VOLCANO_GRAVITY) * 6371;
/** Durée du vol d'un grain, en secondes. */
// Déclare et exporte grainFlightS : la vitesse verticale.
export const grainFlightS = (vUp) => flightTime(vUp, VOLCANO_GRAVITY);
