/**
 * OfflineOrbitEngine — propagation orbitale locale, sans fetch, XHR ni dépendance réseau.
 * Planètes : VSOP87A quand la série locale existe, sinon éléments képlériens séculaires.
 * Lune : théorie ELP abrégée via planetOrbits.
 * Satellites : propagation képlérienne circulaire à partir de a et P du catalogue, orientée
 * dans le plan équatorial du parent. Le catalogue actuel ne fournit pas e, i, Ω, ω ni M0 :
 * ces paramètres ne sont donc pas inventés et le modèle satellite reste explicitement circulaire.
 */
import { earthPosition, heliocentric, AU_UNITS } from './planetOrbits.jsx';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const EARTH_RADIUS_KM = 6371;

const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/** Position d'une planète dans le repère de scène, en UA. */
export function calculatePlanetPosition(def, centuriesTT) {
  if (!def?.elements) return null;
  return def.earth ? earthPosition(def.elements, centuriesTT) : heliocentric(def.elements, centuriesTT);
}

/** Position satellite-parent en km, écliptique J2000. */
export function calculateSatelliteRelativeKm(def, ms, poleScene = null) {
  const a = Number(def?.aKm);
  const period = Number(def?.periodDays);
  if (!(a > 0) || !Number.isFinite(period) || period === 0) return { x: 0, y: 0, z: 0 };
  const angle = (2 * Math.PI * (ms - J2000_MS)) / (period * DAY_MS);
  const c = Math.cos(angle) * a;
  const s = Math.sin(angle) * a;
  if (!poleScene) return { x: c, y: s, z: 0 };
  const n = norm(poleScene);
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(ref, n));
  const w = cross(n, u);
  // Base dans le repère Three.js, puis conversion scène (x,y,z) → écliptique (x,-z,y).
  const q = [c*u[0]+s*w[0], c*u[1]+s*w[1], c*u[2]+s*w[2]];
  return { x: q[0], y: -q[2], z: q[1] };
}

/** Instance légère commune au moteur de scène. */
export class OfflineOrbitEngine {
  constructor() { this.mode = 'offline'; this.lastUpdateMs = 0; }
  planet(def, centuries) { return calculatePlanetPosition(def, centuries); }
  satellite(def, ms, pole) { return calculateSatelliteRelativeKm(def, ms, pole); }
  updateClock(ms) { this.lastUpdateMs = ms; }
  getStatus() { return { mode: this.mode, networkRequired: false, epochMs: this.lastUpdateMs }; }
}

export const ORBIT_ENGINE_CONSTANTS = Object.freeze({ DAY_MS, J2000_MS, EARTH_RADIUS_KM, AU_UNITS });
