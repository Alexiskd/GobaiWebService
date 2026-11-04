/**
 * Lecture des vecteurs d'état de l'API JPL Horizons (https://ssd-api.jpl.nasa.gov/doc/horizons.html).
 * Avec CSV_FORMAT='YES' et VEC_TABLE='1', chaque ligne entre $$SOE et $$EOE vaut :
 *   JDTDB, Calendar Date (TDB), X, Y, Z,
 */
export interface StatePoint {
  /** Instant UTC (ms depuis 1970). */
  t: number;
  x: number;
  y: number;
  z: number;
}

/** TT − UTC = 32,184 s + 37 secondes intercalaires (aucune nouvelle depuis 2017). TDB ≈ TT à 2 ms près. */
export const TT_MINUS_UTC_MS = 69_184;

export const jdTdbToUtcMs = (jd: number) => (jd - 2440587.5) * 86_400_000 - TT_MINUS_UTC_MS;

export function parseVectorTable(result: string): StatePoint[] {
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < start) throw new Error('Table $$SOE…$$EOE absente de la réponse Horizons');
  return result
    .slice(start + 5, end)
    .split('\n')
    .map((line) => line.split(',').map((c) => c.trim()))
    .filter((cols) => cols.length >= 5 && cols[0])
    .map((cols) => ({ t: jdTdbToUtcMs(Number(cols[0])), x: Number(cols[2]), y: Number(cols[3]), z: Number(cols[4]) }))
    .filter((p) => [p.t, p.x, p.y, p.z].every(Number.isFinite));
}

export interface VectorQuery {
  /** Corps cible (ex. '301' pour la Lune). */
  command: string;
  /** Centre (ex. '500@399' centre de la Terre). */
  center: string;
  /** Début et fin, 'YYYY-MM-DD HH:MM'. */
  start: string;
  stop: string;
  /** Pas, ex. '30 m', '10 m'. */
  step: string;
}

/** Paramètres d'une table de vecteurs Horizons (positions géométriques, écliptique J2000, km, CSV), encodés en %20. */
export function vectorQueryString(q: VectorQuery): string {
  const params: Record<string, string> = {
    format: 'json',
    COMMAND: `'${q.command}'`,
    CENTER: `'${q.center}'`,
    EPHEM_TYPE: "'VECTORS'",
    START_TIME: `'${q.start}'`,
    STOP_TIME: `'${q.stop}'`,
    STEP_SIZE: `'${q.step}'`,
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'KM-S'",
    VEC_TABLE: "'1'",
    VEC_CORR: "'NONE'",
    CSV_FORMAT: "'YES'",
    OBJ_DATA: "'NO'",
  };
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

