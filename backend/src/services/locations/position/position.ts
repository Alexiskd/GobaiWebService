/**
 * Position GPS et temps de trajet : fonctions pures, sans réseau, testables seules.
 *
 * Une position est un point sur la Terre ou sur la Lune : { body, lat, lon, name? } (degrés, longitude Est positive,
 * latitude Nord positive). Aucun tracé d'itinéraire : le module ne calcule qu'une durée, la distance au sol quand les
 * deux points sont sur le même astre, et le contexte à donner au modèle de l'utilisateur pour estimer le trajet.
 */

/** Astres où l'on peut poser une position. */
export const POSITION_BODIES = ['earth', 'moon'] as const;
/** Identifiant d'un astre de position. */
export type PositionBody = (typeof POSITION_BODIES)[number];

/** Une position : l'astre, la latitude, la longitude et, facultatif, un nom (ville, site d'alunissage). */
export interface PositionPoint { body: PositionBody; lat: number; lon: number; name?: string }

/** Rayon moyen de chaque astre, en kilomètres (Terre : UGGI ; Lune : IAU). */
export const BODY_RADIUS_KM: Record<PositionBody, number> = { earth: 6371.0088, moon: 1737.4 };
/** Distance moyenne Terre–Lune, de centre à centre, en kilomètres. */
export const EARTH_MOON_KM = 384_400;

/** Durée du trajet Terre ↔ site Apollo fixée pour le moment : 3 jours (transit d'une mission Apollo). */
export const APOLLO_FIXED_DAYS: number | null = 3;
/** Tolérance pour reconnaître un site Apollo à ses coordonnées : 0,05° (≈ 1,5 km sur la Lune). */
const SITE_TOLERANCE_DEG = 0.05;

/** Un site d'alunissage proposé comme position sur la Lune. */
export interface MoonSite { id: string; name: string; lat: number; lon: number; info: string }

/** Les six sites d'alunissage des missions habitées Apollo (coordonnées des sites de la fiche NASA). */
export const APOLLO_SITES: readonly MoonSite[] = [
  { id: 'apollo-11', name: 'Apollo 11', lat: 0.674, lon: 23.473, info: 'Juillet 1969 · Armstrong, Aldrin · Mer de la Tranquillité' },
  { id: 'apollo-12', name: 'Apollo 12', lat: -3.012, lon: -23.422, info: 'Novembre 1969 · Conrad, Bean · Océan des Tempêtes' },
  { id: 'apollo-14', name: 'Apollo 14', lat: -3.645, lon: -17.471, info: 'Février 1971 · Shepard, Mitchell · Fra Mauro' },
  { id: 'apollo-15', name: 'Apollo 15', lat: 26.132, lon: 3.634, info: 'Juillet 1971 · Scott, Irwin · Hadley-Apennin' },
  { id: 'apollo-16', name: 'Apollo 16', lat: -8.973, lon: 15.5, info: 'Avril 1972 · Young, Duke · Descartes' },
  { id: 'apollo-17', name: 'Apollo 17', lat: 20.191, lon: 30.772, info: 'Décembre 1972 · Cernan, Schmitt · Taurus-Littow' },
];

/** Position lue dans une valeur reçue, ou null si elle est invalide (astre inconnu, coordonnée hors bornes). */
export function normalizePoint(raw: unknown): PositionPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const { body, lat, lon, name } = raw as Record<string, unknown>;
  if (!(POSITION_BODIES as readonly unknown[]).includes(body)) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const label = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return { body: body as PositionBody, lat, lon, ...(label ? { name: label } : {}) };
}

const RAD = Math.PI / 180;

/** Distance au sol entre deux points d'un même astre (grand cercle, formule de haversine), en kilomètres. */
export function surfaceDistanceKm(a: PositionPoint, b: PositionPoint): number | null {
  if (a.body !== b.body) return null;
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * BODY_RADIUS_KM[a.body] * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance utile à l'affichage : au sol sur un même astre, centre à centre moyenne entre la Terre et la Lune. */
export function tripDistance(a: PositionPoint, b: PositionPoint): { km: number; kind: 'surface' | 'terre-lune' } {
  const km = surfaceDistanceKm(a, b);
  return km === null ? { km: EARTH_MOON_KM, kind: 'terre-lune' } : { km, kind: 'surface' };
}

/** Site d'alunissage Apollo à cette position, ou null. */
export function apolloSiteAt(p: PositionPoint): MoonSite | null {
  if (p.body !== 'moon') return null;
  return APOLLO_SITES.find((s) => Math.abs(s.lat - p.lat) <= SITE_TOLERANCE_DEG && Math.abs(s.lon - p.lon) <= SITE_TOLERANCE_DEG) ?? null;
}

/**
 * Durée fixée d'un trajet, en minutes, ou null quand elle doit être calculée par le modèle de l'utilisateur.
 * Pour le moment : un point sur la Terre et l'autre sur un site Apollo de la Lune = 3 jours (dans les deux sens).
 * Mettre APOLLO_FIXED_DAYS à null rend ce calcul au modèle.
 */
export function fixedTripMinutes(a: PositionPoint, b: PositionPoint): number | null {
  if (APOLLO_FIXED_DAYS === null) return null;
  const earthToMoon = a.body === 'earth' && apolloSiteAt(b);
  const moonToEarth = b.body === 'earth' && apolloSiteAt(a);
  return earthToMoon || moonToEarth ? Math.round(APOLLO_FIXED_DAYS * 24 * 60) : null;
}

/** Plus grande durée acceptée : un an. Au-delà, la réponse du modèle est jugée incohérente. */
export const MAX_TRIP_MINUTES = 365 * 24 * 60;

/** Consigne du modèle : une durée seulement, jamais un itinéraire ni un tracé. */
export const TRIP_SYSTEM_PROMPT = [
  'Tu estimes la durée d’un trajet entre deux positions GPS, sur la Terre ou sur la Lune.',
  'Tu ne traces aucun itinéraire et tu ne décris aucune étape : tu estimes seulement la durée.',
  'Choisis le moyen de transport le plus rapide et réaliste entre les deux positions (marche, voiture, train, avion, vaisseau).',
  'Un trajet Terre–Lune dure 3 jours, comme les missions Apollo.',
  'Sur la Lune, les deux positions sont à la surface : estime avec un véhicule d’exploration lunaire.',
  'Réponds uniquement par un objet JSON, sans texte autour ni Markdown : {"durationMinutes": nombre entier, "mode": "moyen de transport en un mot ou deux", "summary": "une phrase en français"}.',
].join(' ');

/** Une position mise en texte pour le modèle. */
function describe(label: string, p: PositionPoint): string {
  const body = p.body === 'earth' ? 'Terre' : 'Lune';
  return `${label} : ${p.name ? `${p.name}, ` : ''}${body}, latitude ${p.lat.toFixed(4)}°, longitude ${p.lon.toFixed(4)}°`;
}

/** Message envoyé au modèle : les deux positions et la distance déjà calculée. */
export function buildTripMessage(a: PositionPoint, b: PositionPoint): string {
  const { km, kind } = tripDistance(a, b);
  const distance = kind === 'surface' ? `Distance au sol : ${Math.round(km)} km.` : `Distance moyenne Terre–Lune : ${km} km.`;
  return [describe('Départ (A)', a), describe('Arrivée (B)', b), distance, 'Estime la durée du trajet.'].join('\n');
}

/** Durée estimée lue dans la réponse du modèle. */
export interface TripEstimate { durationMinutes: number; mode: string; summary: string }

/** Nombre lu dans une valeur : un nombre, ou un texte qui commence par un nombre (« 35 », « 35,5 min »). */
function numberOf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = typeof v === 'string' ? /^\s*(\d+(?:[.,]\d+)?)/.exec(v) : null;
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Durée en minutes lue dans l'objet du modèle : `durationMinutes` (ou `duration_minutes`, `minutes`), sinon heures ou jours. */
function minutesOf(json: Record<string, unknown>): number | null {
  const direct = numberOf(json.durationMinutes ?? json.duration_minutes ?? json.minutes);
  if (direct !== null) return direct;
  const hours = numberOf(json.durationHours ?? json.duration_hours ?? json.hours);
  if (hours !== null) return hours * 60;
  const days = numberOf(json.durationDays ?? json.duration_days ?? json.days);
  return days !== null ? days * 1440 : null;
}

/** Lit la réponse du modèle (un objet JSON, éventuellement entouré de texte) ; null si elle est inutilisable. */
export function parseTripReply(text: string): TripEstimate | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: Record<string, unknown>;
  try { json = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
  const minutes = minutesOf(json);
  if (minutes === null || minutes <= 0 || minutes > MAX_TRIP_MINUTES) return null;
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  return { durationMinutes: Math.max(1, Math.round(minutes)), mode: clean(json.mode, 40), summary: clean(json.summary, 240) };
}
