/**
 * JPL Horizons direct browser client.
 * One bounded request per body on load / refresh; never called from the render loop.
 * If CORS, network, rate limit or Horizons fails, callers keep the local VSOP87/Kepler engines.
 */
import { PLANETS, ALL_SATELLITES } from '../SystemeEngine/data/astronomy/data/bodies.data';

const HORIZONS_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const AU_KM = 149597870.7;
const PLANET_CODES = {
  mercury: '199', venus: '299', earth: '399', mars: '499',
  jupiter: '599', saturn: '699', uranus: '799', neptune: '899',
  pluto: '999', ceres: '1', haumea: '136108', makemake: '136472', eris: '136199',
};
const PLANET_KEYS = {
  Mercure: 'mercury', Vénus: 'venus', Terre: 'earth', Mars: 'mars',
  Jupiter: 'jupiter', Saturne: 'saturn', Uranus: 'uranus', Neptune: 'neptune',
  Pluton: 'pluto', Cérès: 'ceres', Hauméa: 'haumea', Makémaké: 'makemake', Éris: 'eris',
};

const csvFields = (line) => {
  const fields = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      fields.push(field.trim()); field = '';
    } else field += c;
  }
  fields.push(field.trim());
  return fields;
};

function parseVectors(text) {
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE');
  if (start < 0 || end < 0 || end <= start) throw new Error('Réponse Horizons sans bloc $$SOE/$$EOE');
  const rows = text.slice(start + 5, end).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const points = [];
  for (const row of rows) {
    const f = csvFields(row);
    // CSV VECTORS: JD TDB, date, X,Y,Z,VX,VY,VZ, ...
    const nums = f.map((v) => Number(v));
    const jd = nums[0];
    const values = nums.slice(2, 8);
    if (!Number.isFinite(jd) || values.length < 6 || !values.every(Number.isFinite)) continue;
    points.push({
      t: (jd - 2440587.5) * 86400000,
      x: values[0], y: values[1], z: values[2],
      vx: values[3], vy: values[4], vz: values[5],
    });
  }
  if (points.length < 2) throw new Error('Horizons a renvoyé trop peu de vecteurs');
  return points.sort((a, b) => a.t - b.t);
}

async function requestVectors(command, center, start, stop, signal) {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    CENTER: `'${center}'`,
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: "'6 h'",
    OUT_UNITS: 'KM-S',
    REF_PLANE: 'ECLIPTIC',
    REF_SYSTEM: 'J2000',
    VEC_TABLE: '2',
    CSV_FORMAT: 'YES',
    OBJ_DATA: 'NO',
  });
  const response = await fetch(`${HORIZONS_URL}?${params.toString()}`, {
    method: 'GET', signal, headers: { Accept: 'text/plain' }, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`JPL Horizons HTTP ${response.status}`);
  const body = await response.text();
  if (/No ephemeris for target|Cannot find|error:/i.test(body) && !body.includes('$$SOE')) {
    throw new Error(body.match(/(?:No ephemeris for target|Cannot find|error:)[^\n]*/i)?.[0] || 'Réponse Horizons invalide');
  }
  return parseVectors(body);
}

async function mapLimit(items, limit, worker, signal) {
  const out = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length && !signal?.aborted) {
      const index = cursor++;
      try { out[index] = await worker(items[index]); }
      catch (error) { out[index] = { ...items[index], error }; }
    }
  });
  await Promise.all(runners);
  return out.filter(Boolean);
}

/**
 * Returns JPL heliocentric vectors for planets and planetocentric vectors for natural satellites.
 * A short 24-hour window is refreshed periodically; local theory remains authoritative outside it.
 */
export async function loadSolarSystemHorizons({ signal, now = Date.now(), concurrency = 3 } = {}) {
  const startDate = new Date(now - 12 * 3600000);
  const stopDate = new Date(now + 36 * 3600000);
  const stamp = (date) => date.toISOString().replace('T', ' ').slice(0, 16);
  const start = stamp(startDate);
  const stop = stamp(stopDate);

  const planetJobs = PLANETS.map((planet) => {
    const key = PLANET_KEYS[planet.name];
    const code = PLANET_CODES[key];
    return code ? { id: key, command: code, center: '500@10', kind: 'planet' } : null;
  }).filter(Boolean);

  const satelliteJobs = ALL_SATELLITES
    .filter((sat) => sat.horizons && sat.parentHorizons)
    .map((sat) => ({ id: sat.id, command: sat.horizons, center: sat.parentHorizons, kind: 'satellite' }));

  const moonJob = { id: 'moon', command: '301', center: '500@399', kind: 'moon' };
  const jobs = [...planetJobs, ...satelliteJobs, moonJob];
  const results = await mapLimit(jobs, concurrency, async (job) => ({
    ...job,
    points: await requestVectors(job.command, job.center, start, stop, signal),
  }), signal);

  return {
    planets: results.filter((r) => r.kind === 'planet' && r.points),
    satellites: results.filter((r) => r.kind === 'satellite' && r.points),
    moon: results.find((r) => r.kind === 'moon' && r.points) || null,
    failed: results.filter((r) => r.error).map((r) => ({ id: jobs[results.indexOf(r)]?.id, message: String(r.error?.message || r.error) })),
    source: 'JPL Horizons',
    fetchedAt: Date.now(),
    window: { start, stop },
  };
}

/** Linear interpolation of a heliocentric JPL vector in km; null outside the fetched window. */
export function interpolateHorizonsVector(points, ms) {
  if (!Array.isArray(points) || points.length < 2 || ms < points[0].t || ms > points[points.length - 1].t) return null;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= ms) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const f = (ms - a.t) / (b.t - a.t);
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
  };
}

export { AU_KM };
