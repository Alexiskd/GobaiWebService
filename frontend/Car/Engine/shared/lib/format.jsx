// Formats partagés par les composants : nombres français, coordonnées, recherche sans accents.

// Un formateur par nombre de décimales, créé une fois : nf est appelé par le HUD plusieurs fois par seconde, et
// toLocaleString avec options recréait un formateur à chaque appel.
const NF_BY_DIGITS = new Map();

// Fonction nf : un nombre au format français, avec le nombre de décimales demandé.
export const nf = (value, digits = 0) => {
  let f = NF_BY_DIGITS.get(digits);
  if (!f) NF_BY_DIGITS.set(digits, (f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })));
  return f.format(Number(value));
};

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
