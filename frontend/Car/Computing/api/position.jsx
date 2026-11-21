/**
 * API de position et de temps de trajet (backend `/position`) : les sites Apollo, puis la durée d'un trajet A → B.
 *
 * Aucun tracé : le serveur renvoie une durée. Terre ↔ site Apollo : 3 jours fixés par le serveur, sans clé. Tous les
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
