/**
 * Traduction des données météo Open-Meteo (codes WMO) en libellés et pictogrammes français.
 * Fonctions pures, testées dans cityWeatherMath.test.mjs.
 */

// Table des codes météo WMO (début).
const CODE_INFO = {
  // Code 0 : pictogramme « clear », libellé « Ensoleillé ».
  0: ['clear', 'Ensoleillé'],
  // Code 1 : pictogramme « partly », libellé « Peu nuageux ».
  1: ['partly', 'Peu nuageux'],
  // Code 2 : pictogramme « partly », libellé « Partiellement nuageux ».
  2: ['partly', 'Partiellement nuageux'],
  // Code 3 : pictogramme « cloudy », libellé « Couvert ».
  3: ['cloudy', 'Couvert'],
  // Code 45 : pictogramme « fog », libellé « Brouillard ».
  45: ['fog', 'Brouillard'],
  // Code 48 : pictogramme « fog », libellé « Brouillard givrant ».
  48: ['fog', 'Brouillard givrant'],
  // Code 51 : pictogramme « drizzle », libellé « Bruine légère ».
  51: ['drizzle', 'Bruine légère'],
  // Code 53 : pictogramme « drizzle », libellé « Bruine ».
  53: ['drizzle', 'Bruine'],
  // Code 55 : pictogramme « drizzle », libellé « Bruine forte ».
  55: ['drizzle', 'Bruine forte'],
  // Code 56 : pictogramme « drizzle », libellé « Bruine verglaçante ».
  56: ['drizzle', 'Bruine verglaçante'],
  // Code 57 : pictogramme « drizzle », libellé « Bruine verglaçante forte ».
  57: ['drizzle', 'Bruine verglaçante forte'],
  // Code 61 : pictogramme « rain », libellé « Pluie faible ».
  61: ['rain', 'Pluie faible'],
  // Code 63 : pictogramme « rain », libellé « Pluie ».
  63: ['rain', 'Pluie'],
  // Code 65 : pictogramme « rain », libellé « Pluie forte ».
  65: ['rain', 'Pluie forte'],
  // Code 66 : pictogramme « rain », libellé « Pluie verglaçante ».
  66: ['rain', 'Pluie verglaçante'],
  // Code 67 : pictogramme « rain », libellé « Pluie verglaçante forte ».
  67: ['rain', 'Pluie verglaçante forte'],
  // Code 71 : pictogramme « snow », libellé « Neige faible ».
  71: ['snow', 'Neige faible'],
  // Code 73 : pictogramme « snow », libellé « Neige ».
  73: ['snow', 'Neige'],
  // Code 75 : pictogramme « snow », libellé « Neige forte ».
  75: ['snow', 'Neige forte'],
  // Code 77 : pictogramme « snow », libellé « Grains de neige ».
  77: ['snow', 'Grains de neige'],
  // Code 80 : pictogramme « rain », libellé « Averses faibles ».
  80: ['rain', 'Averses faibles'],
  // Code 81 : pictogramme « rain », libellé « Averses ».
  81: ['rain', 'Averses'],
  // Code 82 : pictogramme « rain », libellé « Averses fortes ».
  82: ['rain', 'Averses fortes'],
  // Code 85 : pictogramme « snow », libellé « Averses de neige ».
  85: ['snow', 'Averses de neige'],
  // Code 86 : pictogramme « snow », libellé « Averses de neige fortes ».
  86: ['snow', 'Averses de neige fortes'],
  // Code 95 : pictogramme « storm », libellé « Orage ».
  95: ['storm', 'Orage'],
  // Code 96 : pictogramme « storm », libellé « Orage avec grêle ».
  96: ['storm', 'Orage avec grêle'],
  // Code 99 : pictogramme « storm », libellé « Orage avec grêle forte ».
  99: ['storm', 'Orage avec grêle forte'],
// Fin de la table.
};

/** Libellé et pictogramme d'un code WMO ; la nuit, un ciel dégagé devient « Ciel étoilé ». */
// Déclare et exporte weatherCodeInfo : le code et le jour (vrai par défaut).
export function weatherCodeInfo(code, isDay = true) {
  // Code converti en nombre entier.
  const c = Math.round(Number(code));
  // Pour le code 0, ciel dégagé (début).
  if (c === 0) {
    // Renvoie, selon le jour ou la nuit :
    return isDay
      // de jour, le soleil et « Ensoleillé » ;
      ? { icon: 'clear', label: 'Ensoleillé' }
      // de nuit, la lune et « Ciel étoilé ».
      : { icon: 'moon', label: 'Ciel étoilé' };
  // Fin du cas du code 0.
  }
  // Entrée de la table pour ce code.
  const hit = CODE_INFO[c];
  // Renvoie son pictogramme et son libellé ; pour un code inconnu, des nuages et « Temps variable ».
  return hit ? { icon: hit[0], label: hit[1] } : { icon: 'cloudy', label: 'Temps variable' };
// Fin de weatherCodeInfo.
}

// Table des huit secteurs du vent : abréviation et nom (début).
const WIND = [
  // Nord, nord-est, est et sud-est.
  ['N', 'nord'], ['NE', 'nord-est'], ['E', 'est'], ['SE', 'sud-est'],
  // Sud, sud-ouest, ouest et nord-ouest.
  ['S', 'sud'], ['SO', 'sud-ouest'], ['O', 'ouest'], ['NO', 'nord-ouest'],
// Fin de la table.
];

/** Direction d'où vient le vent, en huit secteurs (0° = nord, sens horaire). */
// Déclare et exporte windDescription : la direction en degrés.
export function windDescription(deg) {
  // Si ce n'est pas un nombre fini : null.
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  // Indice du secteur : la direction arrondie au multiple de 45° le plus proche, ramenée entre 0 et 7.
  const i = ((Math.round(deg / 45) % 8) + 8) % 8;
  // Renvoie l'abréviation et le nom du secteur.
  return { short: WIND[i][0], from: WIND[i][1] };
// Fin de windDescription.
}

// num : la valeur si c'est un nombre fini, sinon null.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// int : valeur arrondie à l'entier (début).
const int = (v) => {
  // La valeur comme nombre, ou null.
  const n = num(v);
  // null reste null ; sinon l'arrondi.
  return n == null ? null : Math.round(n);
// Fin de int.
};
// oneDecimal : valeur arrondie à une décimale (début).
const oneDecimal = (v) => {
  // La valeur comme nombre, ou null.
  const n = num(v);
  // null reste null ; sinon l'arrondi au dixième.
  return n == null ? null : Math.round(n * 10) / 10;
// Fin de oneDecimal.
};

/** Bloc `current` d'Open-Meteo → valeurs prêtes à afficher ; `null` sans température. */
// Déclare et exporte normalizeCurrentWeather : la réponse d'Open-Meteo.
export function normalizeCurrentWeather(data) {
  // Son bloc des valeurs actuelles.
  const c = data?.current;
  // Température arrondie.
  const tempC = int(c?.temperature_2m);
  // Sans température : null.
  if (tempC == null) return null;
  // Renvoie les valeurs (début).
  return {
    // La température.
    tempC,
    // La température ressentie.
    feelsC: int(c.apparent_temperature),
    // L'humidité.
    humidity: int(c.relative_humidity_2m),
    // La vitesse du vent.
    windKmh: int(c.wind_speed_10m),
    // La direction du vent, non arrondie.
    windDeg: num(c.wind_direction_10m),
    // Les précipitations, à une décimale.
    precipMm: oneDecimal(c.precipitation),
    // La couverture nuageuse.
    cloudPct: int(c.cloud_cover),
    // Le code météo, ou 3 s'il manque.
    code: int(c.weather_code) ?? 3,
    // Jour, sauf si is_day vaut 0.
    isDay: c.is_day !== 0,
  // Fin des valeurs.
  };
// Fin de normalizeCurrentWeather.
}

/** Ajoute libellé, pictogramme et direction du vent aux valeurs normalisées. */
// Déclare et exporte weatherView : les valeurs normalisées.
export function weatherView(current) {
  // Aucune : null.
  if (!current) return null;
  // Pictogramme et libellé du code.
  const info = weatherCodeInfo(current.code, current.isDay);
  // Renvoie la vue (début).
  return {
    // Les valeurs normalisées.
    ...current,
    // Le pictogramme et le libellé.
    ...info,
    // La description du vent, ou null sans direction.
    wind: current.windDeg == null ? null : windDescription(current.windDeg),
  // Fin de la vue.
  };
// Fin de weatherView.
}

/** Clé de cache arrondie à ≈ 1 km, pour partager la météo des villes voisines. */
// Déclare et exporte weatherKey : la latitude et la longitude.
export function weatherKey(lat, lon) {
  // Si l'une des deux n'est pas un nombre fini : null.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // Renvoie les deux valeurs à deux décimales, séparées par une virgule.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
// Fin de weatherKey.
}
