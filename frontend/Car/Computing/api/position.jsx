/**
 * API de position et de temps de trajet (backend `/position`) : les sites Apollo, puis la durée d'un trajet A → B.
 *
 * Temps de trajet : le serveur renvoie une durée, sans tracé. Itinéraire : des étapes (un moyen de locomotion chacune). Terre ↔ site Apollo : 3 jours fixés par le serveur, sans clé. Tous les
 * autres trajets : estimés par le modèle de l'utilisateur (Claude ou Mistral) avec SA clé, envoyée dans l'en-tête
 * `X-Assistant-Key` comme pour l'assistant. Les refus arrivent typés (`AssistantError.code`, voir assistant.jsx).
 */
import { get } from './client.jsx';
import { callWithKey } from './assistant.jsx';

/** Sites d'alunissage Apollo : { items: [{ id, name, lat, lon, info }] }. */
export const fetchMoonSites = (signal) => get('/position/lune', { signal });

/**
 * Durée du trajet entre deux positions { body: 'earth' | 'moon', lat, lon, name? }.
 * Renvoie { source: 'fixe' | 'ia', durationMinutes, mode, summary, distanceKm, distanceKind, provider?, model? }.
 * `key` peut être vide : le trajet fixé Terre ↔ Apollo n'en a pas besoin ; sinon le serveur répond 401 `invalid_key`.
 */
export const computeTrip = (provider, key, a, b, signal) => callWithKey('position/trajet', { provider, key, body: { a, b }, signal });

/**
 * Itinéraire entre deux lieux de la Terre, découpé en étapes par le modèle de l'utilisateur (sa clé, obligatoire).
 * Renvoie { summary, totalMinutes, totalKm, segments: [{ index, mode, modeLabel, category: 'sol' | 'vol', label, from, to,
 * waypoints, minutes, km, altitudeKm? }], provider, model }. Le moteur de chaque `mode` le modélise (Engine/ItineraireEngine).
 */
export const computeItinerary = (provider, key, a, b, signal) => callWithKey('position/itineraire', { provider, key, body: { a, b }, signal });
