/**
 * Vols et billets de train entre deux lieux de la Terre : fonctions pures (lecture des réponses, aéroport le plus
 * proche, liens de réservation). Aucun appel réseau ici : voir transport.service.ts.
 *
 *  - Vols : API de données d'Aviasales (programme d'affiliation Travelpayouts). Prix tirés du cache d'Aviasales
 *    (recherches des 2 à 7 derniers jours), lien de réservation sur Aviasales marqué de l'identifiant d'affilié :
 *    une réservation faite par ce lien rapporte une commission.
 *  - Trains : API SNCF (moteur Navitia) : horaires, durée, correspondances et CO₂ des trajets. La SNCF ne vend pas de
 *    billets par API publique : le lien mène à SNCF Connect.
 */

/** Un point de la Terre. */
export interface LatLon { lat: number; lon: number; name?: string }

/** Un aéroport, tel que le publie Travelpayouts (data/airports.json). */
export interface Airport { code: string; cityCode: string; countryCode: string; name: string; lat: number; lon: number }

/** Un vol proposé. */
export interface FlightOffer {
  /** Prix le plus bas trouvé, dans la devise de la réponse. */
  price: number;
  currency: string;
  /** Code IATA de la compagnie. */
  airline: string;
  flightNumber: string;
  originAirport: string;
  destinationAirport: string;
  /** Date et heure de départ (ISO 8601, heure locale de l'aéroport). */
  departureAt: string;
  transfers: number;
  /** Durée du vol aller, en minutes (0 si inconnue). */
  durationMinutes: number;
  /** Lien de réservation sur Aviasales, avec l'identifiant d'affilié. */
  bookingUrl: string;
}

/** Un trajet en train proposé. */
export interface TrainJourney {
  /** Départ et arrivée (ISO 8601, heure de Paris). */
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  transfers: number;
  /** Trains empruntés, dans l'ordre (« TGV INOUI 6611 », « TER 17543 »…). */
  trains: string[];
  /** Gares de départ et d'arrivée. */
  from: string;
  to: string;
  /** Émissions de CO₂ du trajet, en grammes (null si inconnues). */
  co2Grams: number | null;
  /** Page de réservation (SNCF Connect). */
  bookingUrl: string;
}

/** Distance maximale entre un lieu et l'aéroport retenu. */
export const MAX_AIRPORT_KM = 300;
/** Nombre de propositions renvoyées par mode. */
export const MAX_OFFERS = 5;
/** Page de réservation des trains. */
export const SNCF_CONNECT_URL = 'https://www.sncf-connect.com/';

/** Distance en km entre deux points (grand cercle, rayon moyen de la Terre). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lit la liste publique des aéroports de Travelpayouts : garde les vrais aéroports, ouverts aux vols commerciaux. */
export function parseAirports(raw: unknown): Airport[] {
  if (!Array.isArray(raw)) return [];
  const out: Airport[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const c = o.coordinates as Record<string, unknown> | undefined;
    const lat = Number(c?.lat);
    const lon = Number(c?.lon);
    if (o.flightable !== true || (o.iata_type && o.iata_type !== 'airport')) continue;
    if (typeof o.code !== 'string' || !/^[A-Z]{3}$/.test(o.code) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cityCode = typeof o.city_code === 'string' && /^[A-Z]{3}$/.test(o.city_code) ? o.city_code : o.code;
    const countryCode = typeof o.country_code === 'string' && /^[A-Z]{2}$/.test(o.country_code) ? o.country_code : '';
    out.push({ code: o.code, cityCode, countryCode, name: typeof o.name === 'string' ? o.name : o.code, lat, lon });
  }
  return out;
}

/** Aéroport le plus proche d'un lieu, à moins de MAX_AIRPORT_KM ; null sinon. */
export function nearestAirport(p: LatLon, airports: Airport[]): (Airport & { distanceKm: number }) | null {
  let best: (Airport & { distanceKm: number }) | null = null;
  for (const a of airports) {
    const d = haversineKm(p, a);
    if (d <= MAX_AIRPORT_KM && (!best || d < best.distanceKm)) best = { ...a, distanceKm: Math.round(d) };
  }
  return best;
}

/** Lien de réservation Aviasales : le lien relatif de la réponse, avec l'identifiant d'affilié. */
export function aviasalesUrl(link: unknown, marker: string): string {
  const path = typeof link === 'string' && link.startsWith('/') ? link : '/';
  const url = new URL(path, 'https://www.aviasales.com');
  if (marker) url.searchParams.set('marker', marker);
  return url.toString();
}

/** Lit la réponse de /aviasales/v3/prices_for_dates. */
export function parseFlights(raw: unknown, marker: string): FlightOffer[] {
  const o = raw as Record<string, unknown> | null;
  if (!o || o.success === false || !Array.isArray(o.data)) return [];
  const currency = typeof o.currency === 'string' ? o.currency.toUpperCase() : 'EUR';
  const offers: FlightOffer[] = [];
  for (const v of o.data as Record<string, unknown>[]) {
    const price = Number(v?.price);
    if (!Number.isFinite(price) || price <= 0 || typeof v.departure_at !== 'string') continue;
    offers.push({
      price,
      currency,
      airline: String(v.airline ?? ''),
      flightNumber: String(v.flight_number ?? ''),
      originAirport: String(v.origin_airport ?? v.origin ?? ''),
      destinationAirport: String(v.destination_airport ?? v.destination ?? ''),
      departureAt: v.departure_at,
      transfers: Math.max(0, Number(v.transfers) || 0),
      durationMinutes: Math.max(0, Number(v.duration_to ?? v.duration) || 0),
      bookingUrl: aviasalesUrl(v.link, marker),
    });
  }
  return offers.sort((x, y) => x.price - y.price).slice(0, MAX_OFFERS);
}

/** Date Navitia « 20261123T080500 » → ISO 8601 « 2026-11-23T08:05:00 » ; '' si illisible. */
export function navitiaDate(v: unknown): string {
  const m = typeof v === 'string' ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : '';
}

/** Date et heure de Paris à un instant donné : { date: « 2026-11-23 », dateTime: « 2026-11-23T00:05 » }. */
export function parisNow(ms: number = Date.now()): { date: string; dateTime: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, dateTime: `${date}T${parts.hour}:${parts.minute}` };
}

/** Date ISO (« 2026-11-23 » ou « 2026-11-23T08:00 ») → format Navitia « 20261123T080000 ». */
export function toNavitiaDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4] ?? '06'}${m[5] ?? '00'}00` : '';
}

/** Lit la réponse de /coverage/sncf/journeys : ne garde que les trajets qui prennent au moins un train. */
export function parseTrainJourneys(raw: unknown): TrainJourney[] {
  const o = raw as Record<string, unknown> | null;
  if (!o || !Array.isArray(o.journeys)) return [];
  const out: TrainJourney[] = [];
  for (const j of o.journeys as Record<string, unknown>[]) {
    const sections = Array.isArray(j?.sections) ? (j.sections as Record<string, unknown>[]) : [];
    const rides = sections.filter((s) => s?.type === 'public_transport');
    if (!rides.length) continue;
    const trains = rides.map((s) => {
      const d = (s.display_informations ?? {}) as Record<string, unknown>;
      return [d.commercial_mode, d.headsign].filter((x) => typeof x === 'string' && x).join(' ');
    }).filter(Boolean);
    const first = rides[0].from as Record<string, unknown> | undefined;
    const last = rides[rides.length - 1].to as Record<string, unknown> | undefined;
    const co2 = (j.co2_emission ?? {}) as Record<string, unknown>;
    out.push({
      departureAt: navitiaDate(j.departure_date_time),
      arrivalAt: navitiaDate(j.arrival_date_time),
      durationMinutes: Math.round((Number(j.duration) || 0) / 60),
      transfers: Math.max(0, Number(j.nb_transfers) || 0),
      trains,
      from: typeof first?.name === 'string' ? first.name : '',
      to: typeof last?.name === 'string' ? last.name : '',
      co2Grams: Number.isFinite(Number(co2.value)) ? Math.round(Number(co2.value)) : null,
      bookingUrl: SNCF_CONNECT_URL,
    });
  }
  return out.slice(0, MAX_OFFERS);
}

// ── Vols en direct : Duffel ─────────────────────────────────────────────────────────────────────────────

/** Durée ISO 8601 (« PT2H35M », « P1DT3H ») → minutes ; 0 si illisible. */
export function isoDurationMinutes(v: unknown): number {
  const m = typeof v === 'string' ? /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(v) : null;
  return m ? (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0) : 0;
}

/**
 * Lien de recherche Aviasales pour un trajet et une date : « /search/PAR0512NCE1 » (origine, jour, mois, destination,
 * un adulte), avec l'identifiant d'affilié. Sert de lien de réservation aux vols trouvés en direct par Duffel.
 */
export function aviasalesSearchUrl(origin: string, destination: string, date: string, marker: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return aviasalesUrl(m ? `/search/${origin}${m[2]}${m[1]}${destination}1` : '/', marker);
}

/** Lit la réponse de POST /air/offer_requests?return_offers=true (Duffel, version v2). */
export function parseDuffelOffers(raw: unknown, marker: string): FlightOffer[] {
  const offers = ((raw as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined)?.offers;
  if (!Array.isArray(offers)) return [];
  const out: FlightOffer[] = [];
  for (const o of offers as Record<string, unknown>[]) {
    const price = Number(o?.total_amount);
    const slice = Array.isArray(o?.slices) ? (o.slices as Record<string, unknown>[])[0] : undefined;
    const segments = Array.isArray(slice?.segments) ? (slice!.segments as Record<string, unknown>[]) : [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (!Number.isFinite(price) || price <= 0 || !first || typeof first.departing_at !== 'string') continue;
    const code = (x: unknown) => String((x as Record<string, unknown> | undefined)?.iata_code ?? '');
    const origin = code(first.origin);
    const destination = code(last.destination);
    out.push({
      price,
      currency: String(o.total_currency ?? 'EUR').toUpperCase(),
      airline: code(first.marketing_carrier) || code(o.owner),
      flightNumber: String(first.marketing_carrier_flight_number ?? ''),
      originAirport: origin,
      destinationAirport: destination,
      departureAt: first.departing_at,
      transfers: Math.max(0, segments.length - 1),
      durationMinutes: isoDurationMinutes(slice?.duration),
      bookingUrl: aviasalesSearchUrl(origin, destination, first.departing_at, marker),
    });
  }
  return out.sort((x, y) => x.price - y.price).slice(0, MAX_OFFERS);
}

// ── Trains hors SNCF : liens de réservation affiliés, choisis selon les pays du trajet ─────────────────────

/** Un site de billets de train proposé pour le trajet. */
export interface TrainPartner { id: string; name: string; coverage: string; url: string }

/** Pays d'Europe (codes ISO 3166-1 alpha-2) : Trainline, Omio et RailEurope. */
const EUROPE = new Set(('AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS '
  + 'SE SI SK SM UA VA XK').split(' '));

/**
 * Sites partenaires. Chaque adresse se remplace par le lien d'affiliation généré dans Travelpayouts (ou chez le
 * partenaire), par une variable d'environnement : sans elle, c'est la page d'accueil du site, sans commission.
 */
export const TRAIN_PARTNERS = [
  { id: 'trainline', name: 'Trainline', coverage: 'Europe · 45 pays', env: 'TRAIN_LINK_TRAINLINE', url: 'https://www.thetrainline.com/', match: (c: string) => EUROPE.has(c) },
  { id: 'omio', name: 'Omio', coverage: 'Europe et États-Unis', env: 'TRAIN_LINK_OMIO', url: 'https://www.omio.com/', match: (c: string) => EUROPE.has(c) || c === 'US' },
  { id: 'raileurope', name: 'Rail Europe', coverage: 'Europe', env: 'TRAIN_LINK_RAILEUROPE', url: 'https://www.raileurope.com/', match: (c: string) => EUROPE.has(c) },
  { id: 'tripcom', name: 'Trip.com', coverage: 'Chine, Corée du Sud, Royaume-Uni, Europe', env: 'TRAIN_LINK_TRIPCOM', url: 'https://www.trip.com/trains/', match: (c: string) => c === 'CN' || c === 'KR' || c === 'GB' },
  { id: '12go', name: '12Go', coverage: 'Asie et plus de 100 pays', env: 'TRAIN_LINK_12GO', url: 'https://12go.asia/', match: (c: string) => !EUROPE.has(c) && c !== 'US' },
] as const;

/**
 * Sites de billets de train utiles pour un trajet entre deux pays : ceux qui couvrent le pays de départ ou d'arrivée.
 * La France est déjà couverte par l'API SNCF : elle n'ajoute rien de plus que les partenaires européens.
 */
export function trainPartnersFor(countries: string[], env: Record<string, string | undefined> = process.env): TrainPartner[] {
  const known = countries.filter((c) => /^[A-Z]{2}$/.test(c));
  if (!known.length) return [];
  return TRAIN_PARTNERS.filter((p) => known.some((c) => p.match(c))).map((p) => {
    const custom = env[p.env]?.trim();
    const url = custom && /^https:\/\//.test(custom) ? custom : p.url;
    return { id: p.id, name: p.name, coverage: p.coverage, url };
  });
}
