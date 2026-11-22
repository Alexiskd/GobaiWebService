/**
 * Vols et billets de train entre deux lieux de la Terre (voir transport.ts pour les sources).
 * Clés côté serveur uniquement (variables d'environnement), jamais envoyées au navigateur :
 *   TRAVELPAYOUTS_TOKEN  : jeton de l'API de données Aviasales (programme Travelpayouts) ;
 *   TRAVELPAYOUTS_MARKER : identifiant d'affilié ajouté aux liens de réservation (commission) ;
 *   SNCF_API_KEY         : clé de l'API SNCF (https://numerique.sncf.com/startup/api/token-developpeur/).
 * Sans clé, le mode concerné répond « non configuré » au lieu d'échouer.
 */
import { BadRequestException, Logger } from '@nestjs/common';
import {
  Airport, FlightOffer, LatLon, TrainJourney, nearestAirport, parseAirports, parseFlights, parseTrainJourneys, toNavitiaDate,
} from './transport';

/** Liste publique des aéroports de Travelpayouts (sans jeton). */
const AIRPORTS_URL = 'https://api.travelpayouts.com/data/en/airports.json';
/** Prix des vols pour une date ou un mois. */
const FLIGHTS_URL = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
/** Trajets SNCF. */
const SNCF_JOURNEYS_URL = 'https://api.sncf.com/v1/coverage/sncf/journeys';
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
}

type Fetch = typeof fetch;

export class TransportService {
  private readonly logger = new Logger('Transport');
  private airports: { list: Airport[]; at: number } | null = null;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env, private readonly fetchFn: Fetch = fetch) {}

  /** Vols et trains de A vers B, pour une date (AAAA-MM-JJ ; aujourd'hui + 7 jours par défaut). */
  async tickets(a: LatLon, b: LatLon, rawDate?: unknown): Promise<TicketsResult> {
    const date = this.dateOf(rawDate);
    const [flights, trains] = await Promise.all([this.flights(a, b, date), this.trains(a, b, date)]);
    return { date, flights, trains };
  }

  /** Date demandée, ou dans 7 jours ; refusée si elle est passée ou à plus d'un an. */
  private dateOf(raw: unknown): string {
    const today = new Date().toISOString().slice(0, 10);
    if (raw === undefined || raw === null || raw === '') return new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) throw new BadRequestException('Date invalide : AAAA-MM-JJ attendu.');
    const max = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
    if (raw < today || raw > max) throw new BadRequestException('La date doit être comprise entre aujourd’hui et dans un an.');
    return raw;
  }

  /** Vols : aéroports les plus proches de A et de B, puis les prix d'Aviasales pour la date. */
  private async flights(a: LatLon, b: LatLon, date: string): Promise<TicketsResult['flights']> {
    const source = 'Aviasales (Travelpayouts)';
    const token = this.env.TRAVELPAYOUTS_TOKEN?.trim();
    if (!token) return { status: 'non-configure', message: 'Recherche de vols non configurée (TRAVELPAYOUTS_TOKEN).', source };
    try {
      const airports = await this.loadAirports();
      const from = nearestAirport(a, airports);
      const to = nearestAirport(b, airports);
      if (!from || !to) return { status: 'aucun', message: 'Aucun aéroport à moins de 300 km du départ ou de l’arrivée.', source };
      if (from.cityCode === to.cityCode) return { status: 'aucun', message: 'Le départ et l’arrivée dépendent du même aéroport : pas de vol utile.', source };
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
      const route = { from: `${from.name} (${from.code})`, to: `${to.name} (${to.code})` };
      if (!offers.length) return { status: 'aucun', message: 'Aucun prix récent connu sur ce trajet.', source, ...route };
      return { status: 'ok', offers, source, ...route, ...(note ? { note } : {}) };
    } catch (e) {
      this.logger.warn(`Vols : ${(e as Error).message}`);
      return { status: 'erreur', message: 'La recherche de vols n’a pas répondu.', source };
    }
  }

  private async fetchFlights(query: URLSearchParams): Promise<FlightOffer[]> {
    const res = await this.fetchFn(`${FLIGHTS_URL}?${query}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Aviasales ${res.status}`);
    return parseFlights(await res.json(), this.env.TRAVELPAYOUTS_MARKER?.trim() ?? '');
  }

  /** Liste des aéroports, gardée en mémoire une semaine. */
  private async loadAirports(): Promise<Airport[]> {
    if (this.airports && Date.now() - this.airports.at < AIRPORTS_TTL_MS) return this.airports.list;
    const res = await this.fetchFn(AIRPORTS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`liste des aéroports ${res.status}`);
    const list = parseAirports(await res.json());
    if (!list.length) throw new Error('liste des aéroports vide');
    this.airports = { list, at: Date.now() };
    return list;
  }

  /** Trains : trajets SNCF de A vers B à partir de 6 h le jour demandé. */
  private async trains(a: LatLon, b: LatLon, date: string): Promise<TicketsResult['trains']> {
    const source = 'SNCF (API SNCF)';
    const key = this.env.SNCF_API_KEY?.trim();
    if (!key) return { status: 'non-configure', message: 'Recherche de trains non configurée (SNCF_API_KEY).', source };
    try {
      const query = new URLSearchParams({
        from: `${a.lon};${a.lat}`, to: `${b.lon};${b.lat}`, datetime: toNavitiaDate(date), datetime_represents: 'departure',
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
