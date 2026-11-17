/**
 * VSOP87A — positions rectangulaires héliocentriques des huit planètes dans l'écliptique J2000.
 *
 * Théorie de Bretagnon & Francou (1988), A&A 202, 309.
 * Coefficients complets distribués par le Bureau des longitudes / IMCCE, miroir de travail ctdk/vsop87.
 * Chaque terme est A*cos(B + C*tau)*tau^alpha ; tau est en milliers d'années juliennes depuis J2000.
 * Les séries donnent directement la Terre (EARTH), pas le barycentre Terre–Lune (EMB).
 *
 * Temps : TT, assimilé à TDB pour cette théorie. Sorties : UA et UA/jour, repère écliptique dynamique J2000.
 */
import mercury from './mercury';
import venus from './venus';
import earth from './earth';
import mars from './mars';
import jupiter from './jupiter';
import saturn from './saturn';
import uranus from './uranus';
import neptune from './neptune';

export type Vec3 = [number, number, number];
type Term = readonly [number, number, number];
type CoordinateSeries = Array<readonly Term[] | null>;
type PlanetSeries = [CoordinateSeries, CoordinateSeries, CoordinateSeries];

const SERIES = new Map<number, PlanetSeries>([
  [0.38709927, mercury as unknown as PlanetSeries],
  [0.72333566, venus as unknown as PlanetSeries],
  [1.00000261, earth as unknown as PlanetSeries],
  [1.52371034, mars as unknown as PlanetSeries],
  [5.202887, jupiter as unknown as PlanetSeries],
  [9.53667594, saturn as unknown as PlanetSeries],
  [19.18916464, uranus as unknown as PlanetSeries],
  [30.06992276, neptune as unknown as PlanetSeries],
]);

/** Paramètre gravitationnel solaire, unités UA³/jour² (constante de Gauss au carré). */
export const GM_SUN_AU3_DAY2 = 0.01720209895 ** 2;
/** Nombre de jours dans un millénaire julien. */
const DAYS_PER_MILLENNIUM = 365250;
const RAD = 180 / Math.PI;

/** Évalue une coordonnée et sa dérivée temporelle, sans différence finie. */
function evaluateCoordinate(series: CoordinateSeries, tau: number): [number, number] {
  let value = 0;
  let derivative = 0;
  for (let alpha = 0; alpha < series.length; alpha++) {
    const terms = series[alpha];
    if (!terms) continue;
    const power = Math.pow(tau, alpha);
    const previousPower = alpha === 0 ? 0 : alpha * Math.pow(tau, alpha - 1);
    for (const [amplitude, phase, frequency] of terms) {
      const angle = phase + frequency * tau;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      value += power * amplitude * c;
      derivative += amplitude * (previousPower * c - power * frequency * s);
    }
  }
  return [value, derivative / DAYS_PER_MILLENNIUM];
}

/**
 * État VSOP87A à T siècles juliens de TT depuis J2000.
 * Retourne null pour Pluton et tout corps sans série VSOP87A.
 */
export function vsop87aState(elements: readonly number[], T: number): { position: Vec3; velocity: Vec3 } | null {
  const series = SERIES.get(elements[0]);
  if (!series) return null;
  const tau = T / 10;
  const x = evaluateCoordinate(series[0], tau);
  const y = evaluateCoordinate(series[1], tau);
  const z = evaluateCoordinate(series[2], tau);
  return {
    position: [x[0], y[0], z[0]],
    velocity: [x[1], y[1], z[1]],
  };
}

/** Éléments osculateurs képlériens déduits d'un état VSOP87A, au même instant. */
export function osculatingElements(position: Vec3, velocity: Vec3) {
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (v: Vec3) => Math.hypot(...v);
  const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
  const r = norm(position);
  const h = cross(position, velocity);
  const hNorm = norm(h);
  const hHat = scale(h, 1 / hNorm);
  const eVector = cross(velocity, h).map((v, i) => v / GM_SUN_AU3_DAY2 - position[i] / r) as Vec3;
  const e = norm(eVector);
  const a = 1 / (2 / r - dot(velocity, velocity) / GM_SUN_AU3_DAY2);
  const p = e > 1e-12 ? scale(eVector, 1 / e) : scale(position, 1 / r);
  const q = cross(hHat, p);
  const node = [-h[1], h[0], 0] as Vec3;
  const nodeNorm = norm(node);
  const inclination = Math.acos(Math.max(-1, Math.min(1, hHat[2])));
  const ascendingNode = nodeNorm > 1e-14 ? Math.atan2(node[1], node[0]) : 0;
  const argumentPerihelion = nodeNorm > 1e-14 && e > 1e-12
    ? Math.atan2(dot(cross(node, eVector), hHat) / (nodeNorm * e), dot(node, eVector) / (nodeNorm * e))
    : 0;
  const trueAnomaly = Math.atan2(dot(position, q), dot(position, p));
  const eccentricAnomaly = Math.atan2(Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(trueAnomaly), e + Math.cos(trueAnomaly));
  const meanAnomaly = eccentricAnomaly - e * Math.sin(eccentricAnomaly);
  const longitudeOfPerihelionDeg = ((ascendingNode + argumentPerihelion) * RAD % 360 + 360) % 360;
  const meanLongitudeDeg = ((longitudeOfPerihelionDeg + meanAnomaly * RAD) % 360 + 360) % 360;
  return {
    semiMajorAxisAu: a,
    eccentricity: e,
    inclinationDeg: inclination * RAD,
    argumentOfPerihelionDeg: argumentPerihelion * RAD,
    longitudeOfPerihelionDeg,
    longitudeOfAscendingNodeDeg: ((ascendingNode * RAD % 360) + 360) % 360,
    meanAnomalyDeg: meanAnomaly * RAD,
    meanLongitudeDeg,
    trueAnomalyDeg: trueAnomaly * RAD,
    periodDays: a > 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / GM_SUN_AU3_DAY2) : null,
    basis: { perihelion: p, transverse: q },
    eccentricAnomaly,
  };
}

/** Échantillonne l'ellipse osculatrice à la date, et non une ellipse moyenne figée à J2000. */
export function osculatingOrbitPositions(position: Vec3, velocity: Vec3, count = 2048, scale = 23455): Float32Array {
  const el = osculatingElements(position, velocity);
  const a = el.semiMajorAxisAu;
  const e = el.eccentricity;
  const b = Math.sqrt(Math.max(0, 1 - e * e));
  const { perihelion: p, transverse: q } = el.basis;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const E = el.eccentricAnomaly + (2 * Math.PI * i) / count;
    const x = a * (Math.cos(E) - e);
    const y = a * b * Math.sin(E);
    const X = x * p[0] + y * q[0];
    const Y = x * p[1] + y * q[1];
    const Z = x * p[2] + y * q[2];
    out[3 * i] = X * scale;
    out[3 * i + 1] = Z * scale;
    out[3 * i + 2] = -Y * scale;
  }
  return out;
}
