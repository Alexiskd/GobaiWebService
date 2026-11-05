// Lune en direct : phase, libration, point subsolaire, sondes en orbite. Fonctions pures (aucun three.js), testées.
import { interpolateState } from './moonEphemeris';
import { xyzToLonLat } from './tiles/mercator';

export const MOON_RADIUS_KM = 1737.4;
export const EARTH_RADIUS_KM = 6371;
export const MOON_GM = 4902.8001;           // km³/s² (GRAIL)
export const SYNODIC_MONTH_DAYS = 29.530589;
const LIGHT_KM_S = 299792.458;

export const MOON_PHASES = [
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
];

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Écliptique J2000 (x, y, z) → repère de la scène (x, z, −y), même convention que `heliocentric`. */
export const eclToScene = ([x, y, z]) => [x, z, -y];

/**
 * État de la Lune vu de la Terre.
 * @param {object} o
 *  moonRel    vecteur Terre → Lune, repère de la scène (rayons terrestres)
 *  moonHelio  vecteur Soleil → Lune, repère de la scène
 *  elongDeg   élongation (longitude écliptique Lune − Soleil, 0 à 360°) : croissant ou décroissant
 *  toLocal    (v scène) => v dans le repère sélénographique (longitude 0 vers la Terre, Nord en +Y)
 */
export function moonState({ moonRel, moonHelio, elongDeg, toLocal }) {
  const toEarth = unit(moonRel.map((c) => -c));
  const toSun = unit(moonHelio.map((c) => -c));
  const cosPhase = Math.max(-1, Math.min(1, dot(toEarth, toSun)));
  const lit = (1 + cosPhase) / 2;                      // fraction éclairée vue de la Terre
  const elong = ((elongDeg % 360) + 360) % 360;
  const distKm = len(moonRel) * EARTH_RADIUS_KM;
  const [libLon, libLat] = xyzToLonLat(toLocal(toEarth)); // point sub-terrestre = libration
  const [sunLon, sunLat] = xyzToLonLat(toLocal(toSun));    // Soleil au zénith
  return {
    lit,
    phaseAngleDeg: (Math.acos(cosPhase) * 180) / Math.PI,
    phase: MOON_PHASES[Math.round(elong / 45) % 8],
    waxing: elong < 180,
    ageDays: (elong / 360) * SYNODIC_MONTH_DAYS,
    distKm,
    lightSeconds: distKm / LIGHT_KM_S,
    libration: { lon: libLon, lat: libLat },
    subSolar: { lon: sunLon, lat: sunLat },
    // Le terminateur est le grand cercle à 90° du point subsolaire : longitude du terminateur à l'équateur.
    terminatorLon: wrap180(sunLon + (elong < 180 ? -90 : 90)),
  };
}

export const wrap180 = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Position (km) et vitesse (km/s) d'une sonde à l'instant t, par la table Horizons ; null hors de la table. */
export function orbiterStateAt(points, t) {
  const p = interpolateState(points, t);
  if (!p) return null;
  const a = interpolateState(points, t - 5000), b = interpolateState(points, t + 5000);
  if (!a || !b) return null;
  return { r: [p.x, p.y, p.z], v: [(b.x - a.x) / 10, (b.y - a.y) / 10, (b.z - a.z) / 10] };
}

/**
 * Grandeurs d'une sonde : altitude, vitesse, période (énergie orbitale, vis-viva), point survolé et visibilité de
 * la Terre (la Lune masque-t-elle la ligne sonde → Terre ?).
 * @param r, v    km et km/s, écliptique J2000, centre de la Lune
 * @param toLocal (v scène) => repère sélénographique ; toEarth : direction Lune → Terre (scène, unitaire)
 */
export function orbiterMetrics({ r, v }, toLocal, toEarth) {
  const dist = len(r);
  const speed = len(v);
  const energy = (speed * speed) / 2 - MOON_GM / dist;
  const a = energy < 0 ? -MOON_GM / (2 * energy) : Infinity;
  const periodMin = Number.isFinite(a) ? (2 * Math.PI * Math.sqrt((a * a * a) / MOON_GM)) / 60 : null;
  const s = eclToScene(r);
  const [lon, lat] = xyzToLonLat(toLocal(s));
  const along = dot(s, toEarth);
  const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
  return {
    altitudeKm: dist - MOON_RADIUS_KM,
    speedKmS: speed,
    periodMin,
    lon, lat,
    earthVisible: !(along < 0 && perp < MOON_RADIUS_KM),
  };
}
