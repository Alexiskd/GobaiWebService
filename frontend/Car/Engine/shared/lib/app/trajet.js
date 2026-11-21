/**
 * Fenêtre « Trajet » : petites fonctions pures (positions, durée, distance), sans React ni réseau.
 *
 * Une position est { body: 'earth' | 'moon', lat, lon, name? } (degrés, Est et Nord positifs), le format du backend.
 */

const nf = (digits) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits });

/** Position sur la Terre à partir d'un résultat de recherche { name, lat, lon }, ou null s'il est inutilisable. */
export function earthPoint(place) {
  const lat = Number(place?.lat), lon = Number(place?.lon);
  if (place?.lat == null || place?.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = typeof place?.name === 'string' ? place.name.trim() : '';
  return { body: 'earth', lat, lon, ...(name ? { name } : {}) };
}

/** Position sur la Lune à partir d'un site { name, lat, lon } du backend, ou null. */
export function moonPoint(site) {
  const p = earthPoint(site);
  return p ? { ...p, body: 'moon' } : null;
}

/** Vrai si la valeur est une position complète. */
export const isPoint = (p) => Boolean(p) && (p.body === 'earth' || p.body === 'moon') && Number.isFinite(p.lat) && Number.isFinite(p.lon);

/** Signature d'un trajet : change quand A, B ou le fournisseur change, donc quand il faut recalculer. */
export const tripSignature = (a, b, provider = '') => (isPoint(a) && isPoint(b)
  ? [provider, a.body, a.lat, a.lon, b.body, b.lat, b.lon].join('|')
  : '');

/** Durée en minutes → « 35 min », « 1 h 20 min », « 3 j », « 2 j 5 h ». */
export function formatDuration(minutes) {
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return '—';
  const days = Math.floor(total / 1440), hours = Math.floor((total % 1440) / 60), mins = total % 60;
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  return `${mins} min`;
}

/** Distance en km → « 21 km », « 384 400 km » ; une décimale sous 10 km. */
export function formatKm(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return '—';
  return `${nf(n < 10 ? 1 : 0).format(n)} km`;
}

/** Coordonnées lisibles : « 48,9992° N, 2,0967° E ». */
export function formatCoords(p) {
  if (!isPoint(p)) return '';
  const ns = p.lat >= 0 ? 'N' : 'S', ew = p.lon >= 0 ? 'E' : 'O';
  return `${nf(4).format(Math.abs(p.lat))}° ${ns}, ${nf(4).format(Math.abs(p.lon))}° ${ew}`;
}

/** Nom affiché d'une position : son nom, sinon ses coordonnées. */
export const pointLabel = (p) => (isPoint(p) ? p.name || formatCoords(p) : '');
