// Lune en direct : phase, libration, point subsolaire, sondes en orbite. Fonctions pures (aucun three.js), testées.
// Importe interpolateState, l'interpolation d'une table de positions, depuis moonEphemeris.
import { interpolateState } from './moonEphemeris';
// Importe xyzToLonLat, la conversion d'un vecteur en longitude et latitude, depuis tiles/mercator.
import { xyzToLonLat } from './tiles/mercator';

// Déclare et exporte le rayon de la Lune : 1737,4 km.
export const MOON_RADIUS_KM = 1737.4;
// Déclare et exporte le rayon de la Terre : 6371 km.
export const EARTH_RADIUS_KM = 6371;
// Déclare et exporte le paramètre gravitationnel de la Lune.
export const MOON_GM = 4902.8001;           // km³/s² (GRAIL)
// Déclare et exporte la durée du mois synodique : 29,530589 jours.
export const SYNODIC_MONTH_DAYS = 29.530589;
// Vitesse de la lumière en km/s.
const LIGHT_KM_S = 299792.458;

// Déclare et exporte les noms des huit phases de la Lune (début).
export const MOON_PHASES = [
  // De la nouvelle lune à la gibbeuse croissante.
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  // De la pleine lune au dernier croissant.
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
// Fin de la liste.
];

// len : longueur d'un vecteur.
const len = (v) => Math.hypot(v[0], v[1], v[2]);
// unit : vecteur rendu unitaire ; une longueur nulle est remplacée par 1.
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Écliptique J2000 (x, y, z) → repère de la scène (x, z, −y), même convention que `heliocentric`. */
// Déclare et exporte eclToScene : range (x, y, z) en (x, z, −y).
export const eclToScene = ([x, y, z]) => [x, z, -y];

/**
 * État de la Lune vu de la Terre.
 * @param {object} o
 *  moonRel    vecteur Terre → Lune, repère de la scène (rayons terrestres)
 *  moonHelio  vecteur Soleil → Lune, repère de la scène
 *  elongDeg   élongation (longitude écliptique Lune − Soleil, 0 à 360°) : croissant ou décroissant
 *  toLocal    (v scène) => v dans le repère sélénographique (longitude 0 vers la Terre, Nord en +Y)
 */
// Déclare et exporte moonState : les deux vecteurs, l'élongation et la conversion vers le repère de la Lune.
export function moonState({ moonRel, moonHelio, elongDeg, toLocal }) {
  // Direction de la Lune vers la Terre, unitaire.
  const toEarth = unit(moonRel.map((c) => -c));
  // Direction de la Lune vers le Soleil, unitaire.
  const toSun = unit(moonHelio.map((c) => -c));
  // Cosinus de l'angle entre ces deux directions, borné entre −1 et 1.
  const cosPhase = Math.max(-1, Math.min(1, dot(toEarth, toSun)));
  // Fraction éclairée du disque.
  const lit = (1 + cosPhase) / 2;                      // fraction éclairée vue de la Terre
  // Élongation ramenée entre 0 et 360°.
  const elong = ((elongDeg % 360) + 360) % 360;
  // Distance Terre-Lune en kilomètres.
  const distKm = len(moonRel) * EARTH_RADIUS_KM;
  // Longitude et latitude du point de la Lune qui fait face à la Terre.
  const [libLon, libLat] = xyzToLonLat(toLocal(toEarth)); // point sub-terrestre = libration
  // Longitude et latitude du point de la Lune qui a le Soleil au zénith.
  const [sunLon, sunLat] = xyzToLonLat(toLocal(toSun));    // Soleil au zénith
  // Renvoie l'état (début).
  return {
    // La fraction éclairée.
    lit,
    // L'angle de phase, en degrés.
    phaseAngleDeg: (Math.acos(cosPhase) * 180) / Math.PI,
    // Le nom de la phase : une tranche de 45° d'élongation par nom.
    phase: MOON_PHASES[Math.round(elong / 45) % 8],
    // Croissante quand l'élongation est inférieure à 180°.
    waxing: elong < 180,
    // L'âge de la Lune, en jours.
    ageDays: (elong / 360) * SYNODIC_MONTH_DAYS,
    // La distance en kilomètres.
    distKm,
    // Le temps de trajet de la lumière, en secondes.
    lightSeconds: distKm / LIGHT_KM_S,
    // La libration.
    libration: { lon: libLon, lat: libLat },
    // Le point subsolaire.
    subSolar: { lon: sunLon, lat: sunLat },
    // Le terminateur est le grand cercle à 90° du point subsolaire : longitude du terminateur à l'équateur.
    // La longitude du terminateur : celle du point subsolaire moins 90° en lune croissante, plus 90° en lune décroissante, ramenée entre −180° et 180°.
    terminatorLon: wrap180(sunLon + (elong < 180 ? -90 : 90)),
  // Fin de l'état.
  };
// Fin de moonState.
}

// Déclare et exporte wrap180 : ramène une longitude entre −180° et 180°.
export const wrap180 = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Position (km) et vitesse (km/s) d'une sonde à l'instant t, par la table Horizons ; null hors de la table. */
// Déclare et exporte orbiterStateAt : la table de points et l'instant.
export function orbiterStateAt(points, t) {
  // Position interpolée à cet instant.
  const p = interpolateState(points, t);
  // Hors de la table : null.
  if (!p) return null;
  // Positions cinq secondes avant et cinq secondes après.
  const a = interpolateState(points, t - 5000), b = interpolateState(points, t + 5000);
  // L'une des deux manque : null.
  if (!a || !b) return null;
  // Renvoie la position et la vitesse : l'écart entre les deux positions, divisé par dix secondes.
  return { r: [p.x, p.y, p.z], v: [(b.x - a.x) / 10, (b.y - a.y) / 10, (b.z - a.z) / 10] };
// Fin de orbiterStateAt.
}

/**
 * Grandeurs d'une sonde : altitude, vitesse, période (énergie orbitale, vis-viva), point survolé et visibilité de
 * la Terre (la Lune masque-t-elle la ligne sonde → Terre ?).
 * @param r, v    km et km/s, écliptique J2000, centre de la Lune
 * @param toLocal (v scène) => repère sélénographique ; toEarth : direction Lune → Terre (scène, unitaire)
 */
// Déclare et exporte orbiterMetrics : la position et la vitesse de la sonde, la conversion vers le repère de la Lune et la direction de la Terre.
export function orbiterMetrics({ r, v }, toLocal, toEarth) {
  // Distance de la sonde au centre de la Lune.
  const dist = len(r);
  // Sa vitesse.
  const speed = len(v);
  // Énergie orbitale par unité de masse : v²/2 − GM/r.
  const energy = (speed * speed) / 2 - MOON_GM / dist;
  // Demi-grand axe ; infini quand l'énergie n'est pas négative (trajectoire ouverte).
  const a = energy < 0 ? -MOON_GM / (2 * energy) : Infinity;
  // Période en minutes, par la troisième loi de Kepler ; null pour une trajectoire ouverte.
  const periodMin = Number.isFinite(a) ? (2 * Math.PI * Math.sqrt((a * a * a) / MOON_GM)) / 60 : null;
  // Position de la sonde dans le repère de la scène.
  const s = eclToScene(r);
  // Longitude et latitude du point survolé.
  const [lon, lat] = xyzToLonLat(toLocal(s));
  // Composante de la position le long de la direction de la Terre.
  const along = dot(s, toEarth);
  // Distance de la sonde à la droite Lune-Terre.
  const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
  // Renvoie les grandeurs (début).
  return {
    // L'altitude : la distance moins le rayon de la Lune.
    altitudeKm: dist - MOON_RADIUS_KM,
    // La vitesse en km/s.
    speedKmS: speed,
    // La période en minutes.
    periodMin,
    // La longitude et la latitude survolées.
    lon, lat,
    // La Terre est visible, sauf si la sonde est du côté opposé à la Terre et à moins d'un rayon lunaire de la droite Lune-Terre.
    earthVisible: !(along < 0 && perp < MOON_RADIUS_KM),
  // Fin des grandeurs.
  };
// Fin de orbiterMetrics.
}
