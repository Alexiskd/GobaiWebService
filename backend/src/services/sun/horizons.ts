const MONTHS = new Map([
  ['jan', 0],
  ['feb', 1],
  ['mar', 2],
  ['apr', 3],
  ['may', 4],
  ['jun', 5],
  ['jul', 6],
  ['aug', 7],
  ['sep', 8],
  ['oct', 9],
  ['nov', 10],
  ['dec', 11],
]);

const ROW_PATTERN =
  /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/;

export interface ParsedSolarRow {
  time: string;
  lon: number;
  lat: number;
}

export interface ParsedSolarTable {
  rows: ParsedSolarRow[];
  /** Horizons renvoie une longitude positive vers l'ouest pour Mars. */
  westPositive: boolean;
  dataset: string | null;
}

/**
 * Extrait le tableau `SunSub-LON / SunSub-LAT` de la réponse texte de
 * l'API JPL Horizons (quantité 15).
 */
export function parseHorizonsSolarTable(text: string): ParsedSolarTable {
  const start = text.indexOf('$$SOE');
  const end = text.indexOf('$$EOE', start);
  if (start === -1 || end === -1) {
    throw new Error(
      'Réponse Horizons sans tableau $$SOE/$$EOE : éphéméride indisponible.',
    );
  }

  const rows: ParsedSolarRow[] = [];
  const body = text.slice(start + '$$SOE'.length, end).split(/\r?\n/);
  for (const line of body) {
    const match = ROW_PATTERN.exec(line);
    if (!match) {
      continue;
    }

    const [, year, monthName, day, hour, minute, second, lon, lat] = match;
    const month = MONTHS.get(monthName.toLowerCase());
    if (month === undefined) {
      continue;
    }

    rows.push({
      time: new Date(
        Date.UTC(
          Number(year),
          month,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second ?? 0),
        ),
      ).toISOString(),
      lon: Number(lon),
      lat: Number(lat),
    });
  }

  if (rows.length === 0) {
    throw new Error('Réponse Horizons sans ligne SunSub exploitable.');
  }

  const pole = /Target pole\/equ\s*:\s*([^\n{]+)\{([^}]*)\}/.exec(text);
  const westPositive = pole
    ? /west-longitude positive/i.test(pole[2])
    : false;
  const dataset = /Target body name:[\s\S]*?\{source:\s*([^}]+)\}/.exec(text);

  return {
    rows,
    westPositive,
    dataset: dataset ? dataset[1].trim() : null,
  };
}

export function normalizeLongitude(lon: number): number {
  const wrapped = lon % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function toEastPositive(
  lon: number,
  westPositive: boolean,
): number {
  return normalizeLongitude(westPositive ? 360 - lon : lon);
}

/** Interpole linéairement une position sous-solaire entre deux échantillons. */
export function interpolateSolarSample(
  samples: ParsedSolarRow[],
  atMs: number,
): ParsedSolarRow {
  if (samples.length === 0) {
    throw new Error('Aucun échantillon sous-solaire à interpoler.');
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (atMs <= Date.parse(first.time)) {
    return { ...first };
  }
  if (atMs >= Date.parse(last.time)) {
    return { ...last };
  }

  let low = 0;
  let high = samples.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (Date.parse(samples[mid].time) <= atMs) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const before = samples[low];
  const after = samples[high];
  const beforeMs = Date.parse(before.time);
  const afterMs = Date.parse(after.time);
  const ratio =
    afterMs === beforeMs ? 0 : (atMs - beforeMs) / (afterMs - beforeMs);

  let delta = after.lon - before.lon;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }

  return {
    time: new Date(atMs).toISOString(),
    lon: normalizeLongitude(before.lon + delta * ratio),
    lat: before.lat + (after.lat - before.lat) * ratio,
  };
}

function formatHorizonsTime(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * Construit la requête Horizons qui renvoie la position du point sous-solaire
 * (SunSub-LON / SunSub-LAT) d'un corps, échantillonnée heure par heure.
 */
export function buildSolarQueryUrl(
  horizonsId: string,
  start: Date,
  stop: Date,
): URL {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  const params = {
    format: 'text',
    COMMAND: `'${horizonsId}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    START_TIME: `'${formatHorizonsTime(start)}'`,
    STOP_TIME: `'${formatHorizonsTime(stop)}'`,
    STEP_SIZE: "'1h'",
    QUANTITIES: "'15'",
    ANG_FORMAT: "'DEG'",
  };
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}
