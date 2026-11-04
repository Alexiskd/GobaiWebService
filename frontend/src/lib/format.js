// Formats partagés par les composants : nombres français, coordonnées, recherche sans accents.

export const nf = (value, digits = 0) =>
  Number(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fold = (value = '') =>
  String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const fmtLat = (value) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'N' : 'S'}`;

export const fmtLon = (value) => `${Math.abs(value).toFixed(2)}° ${value >= 0 ? 'E' : 'O'}`;

export const coords = (lat, lon) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'O'}`;
