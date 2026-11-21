/**
 * Fabrique des moteurs « vol » (modélisation 3D) : avion, hélicoptère, fusée, drone, ballon, planeur…
 * Le tracé suit le grand cercle entre les points de l'étape (le plus court chemin sur la sphère) et reçoit un profil
 * d'altitude propre au véhicule : montée, croisière, descente. `profile(u)` donne la part de l'altitude de croisière
 * (0 à 1) à la fraction u du trajet.
 */
import { polylineKm, sampleAlong } from './geo.js';

/** Marche douce de 0 à 1 (dérivée nulle aux extrémités). */
export const smoothstep = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Profil « montée, croisière, descente » : monte sur les `climb` premiers % du trajet, descend sur les `descent` derniers. */
export const climbCruiseDescent = (climb, descent) => (u) => Math.min(smoothstep(u / climb), smoothstep((1 - u) / descent));

/**
 * `spec` : { id, label, color, glyph, shape ('avion' | 'fusee' | 'rotor' | 'ballon' | 'planeur' | 'point'), cruiseKm (altitude de croisière par défaut, km), profile (u → 0..1), speedKmh }.
 * L'altitude donnée par le modèle (`altitudeKm` de l'étape) remplace `cruiseKm` quand elle existe.
 */
export function createFlightEngine(spec) {
  return Object.freeze({
    id: spec.id, label: spec.label, dimension: '3d', category: 'vol',
    color: spec.color, glyph: spec.glyph, shape: spec.shape, width: 3, dash: [], speedKmh: spec.speedKmh, cruiseKm: spec.cruiseKm,
    /** Modélise une étape { from, to, waypoints, minutes, altitudeKm? } : un tracé 3D (lat, lon, alt en km) échantillonné. */
    model(segment) {
      const raw = [segment.from, ...(segment.waypoints ?? []), segment.to];
      const lengthKm = polylineKm(raw);
      const cruise = segment.altitudeKm > 0 ? segment.altitudeKm : spec.cruiseKm;
      const samples = Math.round(Math.min(240, Math.max(32, lengthKm / 4)));
      const points = sampleAlong(raw, samples).map((p, i, all) => ({ ...p, alt: cruise * spec.profile(i / (all.length - 1)) }));
      return {
        engineId: spec.id, dimension: '3d', category: 'vol', color: spec.color, glyph: spec.glyph, shape: spec.shape, width: 3, dash: [],
        lengthKm, minutes: segment.minutes, cruiseKm: cruise, points, stops: [], from: segment.from, to: segment.to,
      };
    },
  });
}
