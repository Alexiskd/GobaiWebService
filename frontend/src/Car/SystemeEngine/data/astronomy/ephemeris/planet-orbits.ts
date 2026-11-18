/**
 * Modèle Kepler commun de Gobai Space.
 * Soleil fixe pour les planètes ; calcul relatif au parent pour les satellites.
 * Ce module ne contient aucune série planétaire alternative ni modèle lunaire périodique.
 */
const D = Math.PI / 180;
const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const J2000_JD = 2_451_545;
export const AU_KM = 149_597_870.7;
export const TT_MINUS_UTC_S = 69.184;
export const centuriesTT = (ms: number): number =>
  (ms / DAY_MS + (UNIX_EPOCH_JD - J2000_JD) + TT_MINUS_UTC_S / DAY_MS) / 36_525;

export type Vec3 = [number, number, number];

export function solveKepler(M: number, e: number): number {
  if (!Number.isFinite(M) || !Number.isFinite(e) || e < 0 || e >= 1) {
    throw new RangeError('Éléments invalides pour une orbite képlérienne elliptique');
  }
  const m = Math.atan2(Math.sin(M), Math.cos(M));
  let E = m + 0.85 * e * Math.sign(m || 1);
  for (let i = 0; i < 40; i++) {
    const correction = Math.max(-1, Math.min(1, (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E))));
    E -= correction;
    if (Math.abs(correction) < 1e-14) break;
  }
  return E;
}

export interface KeplerElementsAt {
  a: number; e: number; inclination: number; ascendingNode: number;
  argumentPeriapsis: number; meanAnomaly: number;
}

export function keplerPosition(k: KeplerElementsAt): Vec3 {
  if (!(k.a > 0) || !(k.e >= 0 && k.e < 1)) throw new RangeError('Orbite elliptique invalide');
  const E = solveKepler(k.meanAnomaly, k.e);
  const x = k.a * (Math.cos(E) - k.e);
  const y = k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E);
  const cw = Math.cos(k.argumentPeriapsis), sw = Math.sin(k.argumentPeriapsis);
  const cO = Math.cos(k.ascendingNode), sO = Math.sin(k.ascendingNode);
  const cI = Math.cos(k.inclination), sI = Math.sin(k.inclination);
  return [
    (cw*cO - sw*sO*cI)*x + (-sw*cO - cw*sO*cI)*y,
    (cw*sO + sw*cO*cI)*x + (-sw*sO + cw*cO*cI)*y,
    sw*sI*x + cw*sI*y,
  ];
}
