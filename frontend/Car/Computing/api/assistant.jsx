/**
 * API de l'assistant (backend `/assistant`) : connexion et conversation avec la clé de l'utilisateur.
 *
 * La clé part dans l'en-tête `X-Assistant-Key` — jamais dans l'adresse, donc jamais dans un historique ou un journal
 * d'accès. Les refus arrivent typés (`AssistantError.code`) :
 *  - `invalid_key`  : clé fausse ou révoquée → retour à l'écran de connexion ;
 *  - `billing`      : pas de moyen de paiement ou plus de crédit → page de paiement (`billingUrl`) ;
 *  - `rate_limited` : trop de demandes, réessayer ;
 *  - `model_unavailable`, `unavailable`, `network` : le reste.
 */
import { API_BASE } from './client.jsx';

/** Refus de l'assistant, avec sa nature et, pour la facturation, la page de paiement du fournisseur. */
export class AssistantError extends Error {
  constructor(code, message, { billingUrl = '', provider = '', status = 0 } = {}) {
    super(message);
    this.name = 'AssistantError';
    this.code = code;
    this.billingUrl = billingUrl;
    this.provider = provider;
    this.status = status;
  }
}

const CODE_BY_STATUS = { 401: 'invalid_key', 402: 'billing', 429: 'rate_limited' };

/** POST avec la clé de l'utilisateur dans l'en-tête, vers une route de l'API (`assistant/session`, `position/trajet`…). */
export async function callWithKey(route, { provider, key, body = {}, signal }) {
  let res;
  try {
    res = await fetch(`${API_BASE}/${route}`, {
      method: 'POST',
      signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Assistant-Key': key },
      body: JSON.stringify({ provider, ...body }),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new AssistantError('network', 'Le serveur de Gobai Space est injoignable : vérifiez votre connexion et réessayez.');
  }
  const json = await res.json().catch(() => null);
  if (res.ok && json) return json;
  const message = Array.isArray(json?.message) ? json.message.join(', ') : json?.message;
  throw new AssistantError(json?.code || CODE_BY_STATUS[res.status] || 'unavailable', message || `L’assistant n’a pas pu répondre (erreur ${res.status}).`, {
    billingUrl: json?.billingUrl || '',
    provider: json?.provider || provider,
    status: res.status,
  });
}

/** Appel de test : la clé est-elle valide et le compte peut-il payer ? Renvoie { provider, label, model }. */
export const connectAssistant = (provider, key, signal) => callWithKey('assistant/session', { provider, key, signal });

/** Une question : renvoie { reply, actions, provider, model }. */
export const askAssistant = (provider, key, messages, elements, signal) => callWithKey('assistant/messages', { provider, key, body: { messages, elements }, signal });
