/**
 * Vols et billets de train entre deux lieux de la Terre (voir transport.ts pour les sources).
 * Clés côté serveur uniquement (variables d'environnement), jamais envoyées au navigateur :
 *   TRAVELPAYOUTS_TOKEN  : jeton de l'API de données Aviasales (programme Travelpayouts) ;
 *   TRAVELPAYOUTS_MARKER : identifiant d'affilié ajouté aux liens de réservation (commission) ;
 *   SNCF_API_KEY         : clé de l'API SNCF (https://numerique.sncf.com/startup/api/token-developpeur/) ;
 *   DUFFEL_ACCESS_TOKEN  : jeton Duffel (vols en direct, https://duffel.com) ;
 *   TRAIN_LINK_*         : liens d'affiliation des sites de billets de train (Trainline, Omio, Rail Europe, Trip.com, 12Go).
 * Sans clé, le mode concerné répond « non configuré » au lieu d'échouer.
 */
import { BadRequestException, Logger } from '@nestjs/common';
import {
  Airport, FlightOffer, LatLon, TrainJourney, TrainPartner, nearestAirport, parseAirports, parseDuffelOffers, parseFlights, parseTrainJourneys,
  parisNow, toNavitiaDate, trainPartnersFor,
} from './transport';

/** Liste publique des aéroports de Travelpayouts (sans jeton). */
const AIRPORTS_URL = 'https://api.travelpayouts.com/data/en/airports.json';
/** Prix des vols pour une date ou un mois. */
const FLIGHTS_URL = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
/** Trajets SNCF. */
const SNCF_JOURNEYS_URL = 'https://api.sncf.com/v1/coverage/sncf/journeys';
/** Recherche de vols en direct (Duffel). */
const DUFFEL_URL = 'https://api.duffel.com/air/offer_requests';
/** Délai maximal de Duffel : 10 s chez les compagnies, plus la réponse. */
const DUFFEL_TIMEOUT_MS = 20_000;
/** Délai maximal d'un appel. */
const TIMEOUT_MS = 12_000;
/** La liste des aéroports est relue une fois par semaine. */
const AIRPORTS_TTL_MS = 7 * 24 * 3600 * 1000;

/** Résultat d'un mode : des propositions, ou la raison de leur absence. */
export type ModeResult<T> =
  | { status: 'ok'; offers: T[]; source: string; note?: string }
  | { status: 'non-configure' | 'aucun' | 'erreur'; message: string; source: string };

/** Réponse de POST position/billets. */
export interface TicketsResult {
  date: string;
  flights: ModeResult<FlightOffer> & { from?: string; to?: string };
  trains: ModeResult<TrainJourney>;
  /** Sites de billets de train des pays du trajet (liens affiliés), en plus de la SNCF. */
  trainPartners: TrainPartner[];
}

type Fetch = typeof fetch;

export class TransportService {
  private readonly logger = new Logger('Transport');
  private airports: { list: Airport[]; at: number } | null = null;
  private airportsLoading: Promise<Airport[]> | null = null;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env, private readonly fetchFn: Fetch = fetch) {}

  /** Vols et trains de A vers B, pour une date (AAAA-MM-JJ ; aujourd'hui + 7 jours par défaut). */
  async tickets(a: LatLon, b: LatLon, rawDate?: unknown): Promise<TicketsResult> {
    const date = this.dateOf(rawDate);
    const [flights, trains, trainPartners] = await Promise.all([this.flights(a, b, date), this.trains(a, b, date), this.partners(a, b)]);
    return { date, flights, trains, trainPartners };
  }

  /** Sites de billets de train des pays de A et de B (pays déduit de l'aéroport le plus proche). */
  private async partners(a: LatLon, b: LatLon): Promise<TrainPartner[]> {
    try {
      const airports = await this.loadAirports();
      const countries = [nearestAirport(a, airports)?.countryCode, nearestAirport(b, airports)?.countryCode].filter((c): c is string => Boolean(c));
      return trainPartnersFor(countries, this.env);
    } catch {
      return [];
    }
  }

  /** Date demandée, ou aujourd'hui (heure de Paris) ; refusée si elle est passée ou à plus d'un an. */
  private dateOf(raw: unknown): string {
    const today = parisNow().date;
    if (raw === undefined || raw === null || raw === '') return today;
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new BadRequestException('Date invalide : AAAA-MM-JJ attendu.');
    const max = parisNow(Date.now() + 365 * 86400_000).date;
    // La veille reste acceptée : un appareil à l'ouest de Paris (Amériques) est encore la veille.
    const yesterday = parisNow(Date.now() - 86400_000).date;
    if (raw < yesterday || raw > max) throw new BadRequestException('La date doit être comprise entre aujourd’hui et dans un an.');
    return raw;
  }

  /**
   * Vols : aéroports les plus proches de A et de B, puis
   *  1. Duffel (prix en direct des compagnies) si DUFFEL_ACCESS_TOKEN est réglé ;
   *  2. sinon, ou si Duffel ne trouve rien, les prix récents d'Aviasales (TRAVELPAYOUTS_TOKEN).
   */
  private async flights(a: LatLon, b: LatLon, date: string): Promise<TicketsResult['flights']> {
    const duffel = this.env.DUFFEL_ACCESS_TOKEN?.trim();
    const token = this.env.TRAVELPAYOUTS_TOKEN?.trim();
    const source = duffel ? 'Duffel (en direct)' : 'Aviasales (Travelpayouts)';
    if (!duffel && !token) return { status: 'non-configure', message: 'Recherche de vols non configurée (DUFFEL_ACCESS_TOKEN ou TRAVELPAYOUTS_TOKEN).', source };
    try {
      const airports = await this.loadAirports();
      const from = nearestAirport(a, airports);
      const to = nearestAirport(b, airports);
      if (!from || !to) return { status: 'aucun', message: 'Aucun aéroport à moins de 300 km du départ ou de l’arrivée.', source };
      if (from.cityCode === to.cityCode) return { status: 'aucun', message: 'Le départ et l’arrivée dépendent du même aéroport : pas de vol utile.', source };
      const route = { from: `${from.name} (${from.code})`, to: `${to.name} (${to.code})` };
      const marker = this.env.TRAVELPAYOUTS_MARKER?.trim() ?? '';

      // 1. Duffel : prix en direct. Un échec n'empêche pas de passer à Aviasales.
      if (duffel) {
        const live = await this.fetchDuffel(duffel, from.cityCode, to.cityCode, date, marker).catch((e) => {
          this.logger.warn(`Duffel : ${(e as Error).message}`);
          return [] as FlightOffer[];
        });
        if (live.length) return { status: 'ok', offers: live, source: 'Duffel (en direct)', ...route, note: 'Prix en direct des compagnies ; réservation sur Aviasales.' };
      }

      // 2. Aviasales : prix récents (cache de 2 à 7 jours).
      if (!token) return { status: 'aucun', message: 'Aucun vol trouvé en direct sur ce trajet.', source, ...route };
      const query = new URLSearchParams({
        origin: from.cityCode, destination: to.cityCode, departure_at: date, one_way: 'true', sorting: 'price',
        currency: 'eur', limit: '10', direct: 'false', token,
      });
      let offers = await this.fetchFlights(query);
      let note: string | undefined;
      // Aucun prix en cache pour ce jour précis : on élargit au mois.
      if (!offers.length) {
        query.set('departure_at', date.slice(0, 7));
        offers = await this.fetchFlights(query);
        if (offers.length) note = 'Pas de prix connu ce jour-là : meilleurs prix du mois.';
      }
      const cache = 'Aviasales (Travelpayouts)';
      if (!offers.length) return { status: 'aucun', message: 'Aucun prix récent connu sur ce trajet.', source: cache, ...route };
      return { status: 'ok', offers, source: cache, ...route, ...(note ? { note } : {}) };
    } catch (e) {
      this.logger.warn(`Vols : ${(e as Error).message}`);
      return { status: 'erreur', message: 'La recherche de vols n’a pas répondu.', source };
    }
  }

  /** Duffel : une recherche aller simple, un adulte, classe économique ; 10 s au plus chez les compagnies. */
  private async fetchDuffel(accessToken: string, origin: string, destination: string, date: string, marker: string): Promise<FlightOffer[]> {
    const res = await this.fetchFn(`${DUFFEL_URL}?return_offers=true&supplier_timeout=10000`, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json', 'Duffel-Version': 'v2', Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ data: { slices: [{ origin, destination, departure_date: date }], passengers: [{ type: 'adult' }], cabin_class: 'economy' } }),
      signal: AbortSignal.timeout(DUFFEL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Duffel ${res.status}`);
    return parseDuffelOffers(await res.json(), marker);
  }

  private async fetchFlights(query: URLSearchParams): Promise<FlightOffer[]> {
    const res = await this.fetchFn(`${FLIGHTS_URL}?${query}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Aviasales ${res.status}`);
    return parseFlights(await res.json(), this.env.TRAVELPAYOUTS_MARKER?.trim() ?? '');
  }

  /** Liste des aéroports, gardée en mémoire une semaine ; une seule lecture à la fois. */
  private async loadAirports(): Promise<Airport[]> {
    if (this.airports && Date.now() - this.airports.at < AIRPORTS_TTL_MS) return this.airports.list;
    this.airportsLoading ??= (async () => {
      const res = await this.fetchFn(AIRPORTS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`liste des aéroports ${res.status}`);
      const list = parseAirports(await res.json());
      if (!list.length) throw new Error('liste des aéroports vide');
      this.airports = { list, at: Date.now() };
      return list;
    })().finally(() => { this.airportsLoading = null; });
    return this.airportsLoading;
  }

  /** Trains : trajets SNCF de A vers B, à partir de maintenant aujourd'hui, sinon à partir de 6 h le jour demandé. */
  private async trains(a: LatLon, b: LatLon, date: string): Promise<TicketsResult['trains']> {
    const source = 'SNCF (API SNCF)';
    const key = this.env.SNCF_API_KEY?.trim();
    if (!key) return { status: 'non-configure', message: 'Recherche de trains non configurée (SNCF_API_KEY).', source };
    try {
      const query = new URLSearchParams({
        from: `${a.lon};${a.lat}`, to: `${b.lon};${b.lat}`, datetime: date === parisNow().date ? toNavitiaDate(parisNow().dateTime) : toNavitiaDate(date), datetime_represents: 'departure',
        count: '5', min_nb_journeys: '3',
      });
      const res = await this.fetchFn(`${SNCF_JOURNEYS_URL}?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // 404 : Navitia ne trouve pas de trajet (lieux hors du réseau SNCF, par exemple).
      if (res.status === 404) return { status: 'aucun', message: 'Aucun trajet en train trouvé sur le réseau SNCF.', source };
      if (!res.ok) throw new Error(`SNCF ${res.status}`);
      const offers = parseTrainJourneys(await res.json());
      if (!offers.length) return { status: 'aucun', message: 'Aucun trajet en train trouvé sur le réseau SNCF.', source };
      return { status: 'ok', offers, source, note: 'Horaires SNCF ; le prix s’affiche sur SNCF Connect.' };
    } catch (e) {
      this.logger.warn(`Trains : ${(e as Error).message}`);
      return { status: 'erreur', message: 'La recherche de trains n’a pas répondu.', source };
    }
  }
}
