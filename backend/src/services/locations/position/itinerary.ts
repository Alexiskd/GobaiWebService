// Itinéraire : calculs purs (consigne du modèle, lecture de sa réponse JSON, validation). Aucun réseau ni NestJS.
import { MAX_TRIP_MINUTES, PositionPoint, surfaceDistanceKm } from './position';

/** Catégorie d'un moyen de locomotion : `vol` (modélisé en 3D) ou `sol` (modélisé en 2D : roule, marche, flotte, glisse). */
export type ModeCategory = 'vol' | 'sol';

/** Un moyen de locomotion connu : identifiant stable, catégorie, vitesse de croisière et mots qui le désignent. */
export interface ModeSpec { id: string; category: ModeCategory; label: string; speedKmh: number; words: RegExp }

/**
 * Moyens de locomotion connus. Chacun a son moteur côté frontend (Engine/ItineraireEngine/engines). Un moyen inconnu
 * du modèle (« traîneau », « tuk-tuk »…) n'est pas refusé : il prend la catégorie donnée par le modèle et le moteur générique.
 */
export const MODES: readonly ModeSpec[] = [
  { id: 'marche', category: 'sol', label: 'Marche', speedKmh: 5, words: /marche|pied|pieton|randonnee|balade|walk/ },
  { id: 'course', category: 'sol', label: 'Course à pied', speedKmh: 10, words: /course|jogging|running|courir/ },
  { id: 'velo', category: 'sol', label: 'Vélo', speedKmh: 16, words: /velo|bicyclette|cyclisme|bike|vtt/ },
  { id: 'trottinette', category: 'sol', label: 'Trottinette', speedKmh: 15, words: /trottinette|skate|roller|gyropode|scooter electrique/ },
  { id: 'moto', category: 'sol', label: 'Moto', speedKmh: 70, words: /moto|scooter|mobylette|cyclomoteur/ },
  { id: 'voiture', category: 'sol', label: 'Voiture', speedKmh: 70, words: /voiture|\bauto\b|taxi|vtc|covoiturage|camion|\bcar\b|autoroute/ },
  { id: 'bus', category: 'sol', label: 'Bus', speedKmh: 30, words: /bus|autocar|navette/ },
  { id: 'tramway', category: 'sol', label: 'Tramway', speedKmh: 20, words: /tram/ },
  { id: 'metro', category: 'sol', label: 'Métro', speedKmh: 30, words: /metro|\brer\b|subway|souterrain/ },
  { id: 'train', category: 'sol', label: 'Train', speedKmh: 120, words: /\btrains?\b|\btgv\b|\bter\b|ferroviaire|\brail\b|intercites|eurostar/ },
  { id: 'bateau', category: 'sol', label: 'Bateau', speedKmh: 30, words: /bateau|ferry|navire|paquebot|voilier|kayak|canoe|peniche|traversier|boat|ship/ },
  { id: 'ski', category: 'sol', label: 'Ski', speedKmh: 25, words: /ski|snowboard|luge/ },
  { id: 'cheval', category: 'sol', label: 'Cheval', speedKmh: 20, words: /cheval|equitation|chameau|\bane\b|caleche/ },
  { id: 'avion', category: 'vol', label: 'Avion', speedKmh: 800, words: /avion|\bvol\b|\bjet\b|aerien|\bplane\b|airliner/ },
  { id: 'helicoptere', category: 'vol', label: 'Hélicoptère', speedKmh: 220, words: /helico|helicopter|giravion/ },
  { id: 'fusee', category: 'vol', label: 'Fusée', speedKmh: 25000, words: /fusee|rocket|vaisseau|navette spatiale|starship|capsule/ },
  { id: 'drone', category: 'vol', label: 'Drone', speedKmh: 50, words: /drone|quadricoptere/ },
  { id: 'ballon', category: 'vol', label: 'Ballon', speedKmh: 25, words: /ballon|montgolfiere|dirigeable|zeppelin/ },
  { id: 'planeur', category: 'vol', label: 'Planeur', speedKmh: 110, words: /planeur|parapente|deltaplane|glider|parachute|wingsuit/ },
];

/** Moteurs génériques pour un moyen que le modèle invente. */
export const OTHER_MODES: Record<ModeCategory, ModeSpec> = {
  sol: { id: 'autre-sol', category: 'sol', label: 'Autre (au sol)', speedKmh: 30, words: /$^/ },
  vol: { id: 'autre-vol', category: 'vol', label: 'Autre (aérien)', speedKmh: 300, words: /$^/ },
};

/** Texte sans accents ni majuscules, pour reconnaître un moyen de locomotion. */
export const fold = (t: unknown): string => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Moyen de locomotion d'un nom libre : le moyen connu, ou le générique de la catégorie donnée (au sol par défaut). */
export function resolveMode(name: unknown, category?: unknown): ModeSpec {
  const text = fold(name);
  const known = text ? MODES.find((m) => m.id === text || m.words.test(text)) : undefined;
  if (known) return known;
  const c = fold(category);
  return OTHER_MODES[c === 'vol' || c === 'aerien' || c === 'air' ? 'vol' : 'sol'];
}

/** Limites : étapes d'un itinéraire, points intermédiaires d'une étape, texte. */
export const MAX_SEGMENTS = 10;
export const MAX_WAYPOINTS = 30;

/** Un point d'une étape. */
export interface GeoPoint { lat: number; lon: number }

/** Une étape d'un itinéraire, validée. */
export interface ItinerarySegment {
  index: number;
  /** Identifiant du moteur : `marche`, `train`, `avion`… ou `autre-sol` / `autre-vol`. */
  mode: string;
  modeLabel: string;
  category: ModeCategory;
  label: string;
  from: GeoPoint & { name?: string };
  to: GeoPoint & { name?: string };
  /** Points intermédiaires, du départ à l'arrivée de l'étape (extrémités exclues). */
  waypoints: GeoPoint[];
  minutes: number;
  /** Longueur du tracé, calculée ici (jamais reprise du modèle). */
  km: number;
  /** Altitude de croisière en km (étapes aériennes), si le modèle l'a donnée. */
  altitudeKm?: number;
}

/** Itinéraire validé. */
export interface Itinerary { summary: string; totalMinutes: number; totalKm: number; segments: ItinerarySegment[] }

/** Consigne du modèle : un itinéraire en JSON, découpé en étapes, tout moyen de locomotion possible. */
export const ITINERARY_SYSTEM_PROMPT = [
  'Tu es un moteur d’itinéraires. Tu reçois un départ A et une arrivée B sur la Terre (latitude, longitude) et tu réponds par UN SEUL objet JSON, sans texte autour ni Markdown.',
  'Découpe le trajet en 1 à 8 étapes ("segments") qui s’enchaînent : l’arrivée d’une étape est le départ de la suivante, la première part de A, la dernière arrive en B.',
  'Pour chaque étape, choisis le moyen de locomotion le plus réaliste, quel qu’il soit : marche, course, vélo, trottinette, moto, voiture, bus, tramway, métro, train, bateau, ski, cheval, avion, hélicoptère, fusée, drone, ballon, planeur… ou tout autre moyen adapté (traîneau, tuk-tuk, téléphérique…).',
  'Combine les moyens quand c’est réaliste (marche jusqu’à la gare, train, puis avion, puis voiture) ; ne mets pas d’étape de moins de 100 m.',
  'Chaque étape contient : "mode" (nom du moyen en un ou deux mots, en français), "category" ("vol" si l’on vole ou quitte l’atmosphère, sinon "sol" : on roule, marche, navigue, glisse), "label" (une phrase courte), "from" et "to" ({"lat","lon","name"} en degrés décimaux, Nord et Est positifs), "waypoints" (liste de [lat, lon] : au plus 12 points qui suivent la route, la voie ferrée, le cours d’eau ou la trajectoire réelle ; liste vide pour un vol en ligne droite), "minutes" (durée de l’étape, nombre entier réaliste, attentes comprises).',
  'Pour une étape aérienne, ajoute "altitudeKm" (altitude de croisière en km, par exemple 11 pour un avion de ligne, 0.5 pour un hélicoptère).',
  'Ajoute à la racine "summary" : une phrase en français qui résume l’itinéraire.',
  'Les coordonnées doivent être des nombres réels et plausibles, jamais inventés au hasard : si tu hésites, donne moins de points intermédiaires.',
  'Format : {"summary":"…","segments":[{"mode":"Marche","category":"sol","label":"Jusqu’à la gare","from":{"lat":48.99,"lon":2.09,"name":"Départ"},"to":{"lat":48.97,"lon":2.1,"name":"Gare"},"waypoints":[[48.98,2.095]],"minutes":12},{"mode":"Avion","category":"vol","label":"Vol direct","from":{"lat":49.0,"lon":2.55,"name":"Aéroport"},"to":{"lat":40.64,"lon":-73.78,"name":"Aéroport"},"waypoints":[],"minutes":480,"altitudeKm":11}]}',
].join(' ');

/** Une position mise en texte pour le modèle. */
function describe(label: string, p: PositionPoint): string {
  return `${label} : ${p.name ? `${p.name}, ` : ''}Terre, latitude ${p.lat.toFixed(5)}°, longitude ${p.lon.toFixed(5)}°`;
}

/** Message envoyé au modèle : les deux positions et la distance au sol. */
export function buildItineraryMessage(a: PositionPoint, b: PositionPoint): string {
  const km = surfaceDistanceKm(a, b) ?? 0;
  return [describe('Départ (A)', a), describe('Arrivée (B)', b), `Distance à vol d’oiseau : ${Math.round(km)} km.`, 'Donne l’itinéraire en JSON.'].join('\n');
}

/** Nombre lu dans une valeur : un nombre, ou un texte qui commence par un nombre. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = typeof v === 'string' ? /^\s*(-?\d+(?:[.,]\d+)?)/.exec(v) : null;
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Point lu dans {lat, lon}, {latitude, longitude}, {lat, lng} ou [lat, lon] ; null s'il est hors des bornes. */
export function geoPointOf(v: unknown): (GeoPoint & { name?: string }) | null {
  let lat: number | null = null;
  let lon: number | null = null;
  let name: unknown;
  if (Array.isArray(v)) { lat = num(v[0]); lon = num(v[1]); } else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    lat = num(o.lat ?? o.latitude); lon = num(o.lon ?? o.lng ?? o.long ?? o.longitude); name = o.name ?? o.nom;
  }
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  return { lat, lon, ...(clean ? { name: clean } : {}) };
}

/** Longueur d'un tracé en km (grand cercle entre points successifs). */
export function pathKm(points: GeoPoint[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += surfaceDistanceKm({ body: 'earth', ...points[i - 1] }, { body: 'earth', ...points[i] }) ?? 0;
  return km;
}

/** Points gardés en nombre limité, répartis sur toute la liste (premier et dernier compris). */
function thin<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  return Array.from({ length: max }, (_, i) => list[Math.round((i * (list.length - 1)) / (max - 1))]);
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Lit la réponse du modèle (un objet JSON, éventuellement entouré de texte) et la rend cohérente :
 *  - les étapes s'enchaînent : la première part de A, la dernière arrive en B, chacune part d'où la précédente arrive ;
 *  - la longueur est recalculée sur le tracé ; la durée manquante est déduite de la vitesse du moyen ;
 *  - un moyen inconnu prend le moteur générique de sa catégorie.
 * Renvoie null si rien d'exploitable.
 */
export function parseItineraryReply(text: string, a: PositionPoint, b: PositionPoint): Itinerary | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: Record<string, unknown>;
  try { json = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>; } catch { return null; }
  const rawList = json.segments ?? json.etapes ?? json.legs ?? json.steps;
  if (!Array.isArray(rawList) || rawList.length === 0) return null;

  const segments: ItinerarySegment[] = [];
  let cursor: GeoPoint & { name?: string } = { lat: a.lat, lon: a.lon, ...(a.name ? { name: a.name } : {}) };
  const list = rawList.slice(0, MAX_SEGMENTS);
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const spec = resolveMode(s.mode ?? s.moyen ?? s.transport, s.category ?? s.categorie);
    // Départ : la fin de l'étape précédente ; arrivée : celle du modèle, sauf pour la dernière étape qui arrive en B.
    const last = i === list.length - 1;
    const to = last ? { lat: b.lat, lon: b.lon, ...(b.name ? { name: b.name } : {}) } : geoPointOf(s.to ?? s.arrivee);
    if (!to) continue;
    const waypoints = thin(
      (Array.isArray(s.waypoints ?? s.points ?? s.trace) ? (s.waypoints ?? s.points ?? s.trace) as unknown[] : [])
        .map(geoPointOf).filter((p): p is GeoPoint & { name?: string } => p !== null).map(({ lat, lon }) => ({ lat, lon })),
      MAX_WAYPOINTS,
    );
    const km = pathKm([cursor, ...waypoints, to]);
    if (km * 1000 < 1) continue; // étape sans longueur : ignorée
    const given = num(s.minutes ?? s.durationMinutes ?? s.duration_minutes ?? s.duree);
    const minutes = Math.max(1, Math.round(given !== null && given > 0 && given <= MAX_TRIP_MINUTES ? given : (km / spec.speedKmh) * 60));
    const alt = num(s.altitudeKm ?? s.altitude_km ?? s.altitude);
    segments.push({
      index: segments.length, mode: spec.id, modeLabel: clean(s.mode ?? s.moyen, 40) || spec.label, category: spec.category,
      label: clean(s.label ?? s.description, 160), from: cursor, to, waypoints, minutes, km: Math.round(km * 10) / 10,
      ...(spec.category === 'vol' && alt !== null && alt > 0 && alt <= 500 ? { altitudeKm: alt } : {}),
    });
    cursor = to;
  }
  if (!segments.length) return null;
  // La dernière étape doit arriver en B : à moins de 200 m on la recale, au-delà (étape finale ignorée) la réponse est refusée.
  const lastSeg = segments[segments.length - 1];
  const gap = surfaceDistanceKm({ body: 'earth', ...lastSeg.to }, { body: 'earth', lat: b.lat, lon: b.lon }) ?? Infinity;
  if (gap > 0.2) return null;
  lastSeg.to = { lat: b.lat, lon: b.lon, ...(b.name ? { name: b.name } : {}) };
  const totalMinutes = segments.reduce((n, s) => n + s.minutes, 0);
  if (totalMinutes > MAX_TRIP_MINUTES) return null;
  return {
    summary: clean(json.summary ?? json.resume, 300), totalMinutes,
    totalKm: Math.round(segments.reduce((n, s) => n + s.km, 0) * 10) / 10, segments,
  };
}
