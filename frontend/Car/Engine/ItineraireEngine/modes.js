/**
 * Registre des moteurs de locomotion de l'itinéraire, construits depuis la table modeTable.js :
 *  - 3D (véhicules volants) : avion, hélicoptère, fusée, drone, ballon, planeur, autre-vol ;
 *  - 2D (véhicules qui roulent, marchent, glissent ou naviguent) : marche, course, vélo, trottinette, moto, voiture, bus,
 *    tramway, métro, train, bateau, ski, cheval, autre-sol.
 * Les identifiants sont ceux que renvoie le backend (POST /position/itineraire, champ `mode`).
 */
// Importe la fabrique du moteur au sol (2D).
import { createGroundEngine } from './groundEngine.js';
// Importe la fabrique du moteur volant (3D).
import { createFlightEngine } from './flightEngine.js';
// Importe la table des moyens : une ligne de données par moyen.
import { FLIGHT_MODES, GROUND_MODES } from './modeTable.js';

/**
 * Moteur mutable : une seule définition, réglée par une ligne de la table. La catégorie choisit le calcul
 * (tracé au sol en 2D, ou trajectoire en altitude en 3D) ; la ligne donne le style, la vitesse et le profil.
 */
export const createModeEngine = (row, category) => (category === 'vol' ? createFlightEngine(row) : createGroundEngine(row));

/** Tous les moteurs, par identifiant : construits une fois depuis la table. */
export const ENGINES = Object.freeze(Object.fromEntries([
  // Les moyens au sol, chacun réglé par sa ligne.
  ...GROUND_MODES.map((row) => [row.id, createModeEngine(row, 'sol')]),
  // Les moyens volants, chacun réglé par sa ligne.
  ...FLIGHT_MODES.map((row) => [row.id, createModeEngine(row, 'vol')]),
// Fin des moteurs.
]));

/** Moteur d'un moyen : le sien, sinon le moteur générique de sa catégorie (au sol par défaut). */
export const engineFor = (mode, category = 'sol') => ENGINES[mode] ?? ENGINES[category === 'vol' ? 'autre-vol' : 'autre-sol'];

const isGeo = (p) => Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/** Modélise une étape du backend avec le moteur de son moyen ; null si ses extrémités sont inutilisables. */
export function modelSegment(segment) {
  if (!isGeo(segment?.from) || !isGeo(segment?.to)) return null;
  const engine = engineFor(segment.mode, segment.category);
  const waypoints = (Array.isArray(segment.waypoints) ? segment.waypoints : []).filter(isGeo);
  const track = engine.model({ ...segment, waypoints, minutes: Number(segment.minutes) > 0 ? Number(segment.minutes) : 1 });
  return { ...track, index: segment.index ?? 0, label: segment.label ?? '', modeLabel: segment.modeLabel || engine.label, km: Number(segment.km) || track.lengthKm };
}

/** Modélise tout l'itinéraire : un tracé par étape, dans l'ordre. Étapes inutilisables ignorées. */
export function modelItinerary(itinerary) {
  const tracks = (Array.isArray(itinerary?.segments) ? itinerary.segments : []).map(modelSegment).filter(Boolean);
  return {
    tracks,
    totalMinutes: tracks.reduce((n, t) => n + t.minutes, 0),
    totalKm: tracks.reduce((n, t) => n + t.km, 0),
  };
}

/**
 * Position sur l'ensemble des tracés à la fraction u (0 à 1) du temps de l'animation. Chaque étape reçoit au moins 8 %
 * du temps : une marche de 5 minutes avant un vol de 8 heures resterait sinon invisible. Renvoie
 * { track, local (fraction dans l'étape), index }.
 */
export function locate(tracks, u) {
  if (!tracks.length) return null;
  const total = tracks.reduce((n, t) => n + t.minutes, 0) || 1;
  const w = tracks.map((t) => Math.max(t.minutes / total, 0.08));
  const sum = w.reduce((a, b) => a + b, 0);
  let x = Math.min(1, Math.max(0, u)) * sum;
  for (let i = 0; i < tracks.length; i++) {
    if (x <= w[i] || i === tracks.length - 1) return { track: tracks[i], local: Math.min(1, Math.max(0, x / w[i])), index: i };
    x -= w[i];
  }
  return null;
}
