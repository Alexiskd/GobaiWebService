/**
 * Traduction des données météo Open-Meteo (codes WMO) en libellés et pictogrammes français.
 * Fonctions pures, testées dans cityWeatherMath.test.mjs.
 */

const CODE_INFO = {
  0: ['clear', 'Ensoleillé'],
  1: ['partly', 'Peu nuageux'],
  2: ['partly', 'Partiellement nuageux'],
  3: ['cloudy', 'Couvert'],
  45: ['fog', 'Brouillard'],
  48: ['fog', 'Brouillard givrant'],
  51: ['drizzle', 'Bruine légère'],
  53: ['drizzle', 'Bruine'],
  55: ['drizzle', 'Bruine forte'],
  56: ['drizzle', 'Bruine verglaçante'],
  57: ['drizzle', 'Bruine verglaçante forte'],
  61: ['rain', 'Pluie faible'],
  63: ['rain', 'Pluie'],
  65: ['rain', 'Pluie forte'],
  66: ['rain', 'Pluie verglaçante'],
  67: ['rain', 'Pluie verglaçante forte'],
  71: ['snow', 'Neige faible'],
  73: ['snow', 'Neige'],
  75: ['snow', 'Neige forte'],
  77: ['snow', 'Grains de neige'],
  80: ['rain', 'Averses faibles'],
  81: ['rain', 'Averses'],
  82: ['rain', 'Averses fortes'],
  85: ['snow', 'Averses de neige'],
  86: ['snow', 'Averses de neige fortes'],
  95: ['storm', 'Orage'],
  96: ['storm', 'Orage avec grêle'],
  99: ['storm', 'Orage avec grêle forte'],
};

/** Libellé et pictogramme d'un code WMO ; la nuit, un ciel dégagé devient « Ciel étoilé ». */
export function weatherCodeInfo(code, isDay = true) {
  const c = Math.round(Number(code));
  if (c === 0) {
    return isDay
      ? { icon: 'clear', label: 'Ensoleillé' }
      : { icon: 'moon', label: 'Ciel étoilé' };
  }
  const hit = CODE_INFO[c];
  return hit ? { icon: hit[0], label: hit[1] } : { icon: 'cloudy', label: 'Temps variable' };
}

const WIND = [
  ['N', 'nord'], ['NE', 'nord-est'], ['E', 'est'], ['SE', 'sud-est'],
  ['S', 'sud'], ['SO', 'sud-ouest'], ['O', 'ouest'], ['NO', 'nord-ouest'],
];

/** Direction d'où vient le vent, en huit secteurs (0° = nord, sens horaire). */
export function windDescription(deg) {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  return { short: WIND[i][0], from: WIND[i][1] };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const oneDecimal = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n * 10) / 10;
};

/** Bloc `current` d'Open-Meteo → valeurs prêtes à afficher ; `null` sans température. */
export function normalizeCurrentWeather(data) {
  const c = data?.current;
  const tempC = int(c?.temperature_2m);
  if (tempC == null) return null;
  return {
    tempC,
    feelsC: int(c.apparent_temperature),
    humidity: int(c.relative_humidity_2m),
    windKmh: int(c.wind_speed_10m),
    windDeg: num(c.wind_direction_10m),
    precipMm: oneDecimal(c.precipitation),
    cloudPct: int(c.cloud_cover),
    code: int(c.weather_code) ?? 3,
    isDay: c.is_day !== 0,
  };
}

/** Ajoute libellé, pictogramme et direction du vent aux valeurs normalisées. */
export function weatherView(current) {
  if (!current) return null;
  const info = weatherCodeInfo(current.code, current.isDay);
  return {
    ...current,
    ...info,
    wind: current.windDeg == null ? null : windDescription(current.windDeg),
  };
}

/** Clé de cache arrondie à ≈ 1 km, pour partager la météo des villes voisines. */
export function weatherKey(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}
