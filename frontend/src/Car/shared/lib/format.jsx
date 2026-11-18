// Formats partagés par les composants : nombres français, coordonnées, recherche sans accents.

// Fonction nf : un nombre au format français,
export const nf = (value, digits = 0) =>
  // avec le nombre de décimales demandé.
  Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Fonction fold :
export const fold = (value = '') =>
  // retire les accents et passe en minuscules.
  String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Fonction fmtLat : une latitude à 2 décimales, suivie de N ou S.
export const fmtLat = (value) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'N' : 'S'}`;

// Fonction fmtLon : une longitude à 2 décimales, suivie de E ou O.
export const fmtLon = (value) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'E' : 'O'}`;

// Fonction coords :
export const coords = (lat, lon) =>
  // latitude et longitude à 1 décimale, avec leur lettre.
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'O'}`;
