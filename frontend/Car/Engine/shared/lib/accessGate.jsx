/**
 * Verrou d'accès au cœur de l'application : seule une adresse IP de la liste d'autorisation peut créer le moteur 3D.
 *
 * Le noyau de l'app (le moteur SolarEngine et tout ce qui en dépend : registres, politiques, tuiles, HUD, outils)
 * n'est jamais construit si la fonction requireAccess refuse : l'ouverture reste bloquée derrière le composant
 * FullScreenMessage, qui affiche le motif du refus (message d'AccessDeniedError) tant que l'adresse n'est pas bonne.
 *
 * Fonctions pures et testables : la lecture de l'adresse se fait par `fetchImpl` injectable (défaut : le fetch du
 * navigateur, sur le service d'écho d'IP public), le cache est un module (une seule requête pour toute la session).
 */

// La liste d'autorisation : la seule adresse admise dans le cœur de l'app.
export const ALLOWED_IPS = ['212.195.255.196'];

// Le service d'écho d'IP : renvoie { ip } (format JSON).
const ECHO_URL = 'https://api.ipify.org?format=json';

// Le cache de l'adresse : promesse partagée par toute la session, une seule requête réseau.
let ipPromise = null;

/**
 * Lit l'adresse IP publique du client, via le service d'écho ; le résultat est mis en cache (la promesse est
 * partagée par toute la session). Le `signal` est transmis au fetch (les interruptions remontent telles quelles).
 * @param {object}   [o]
 * @param {AbortSignal} [o.signal]    signal d'interruption transmis au fetch
 * @param {Function}   [o.fetchImpl]  le fetch injectable (essais : un faux fetch)
 * @returns {Promise<string>} l'adresse IP du client
 */
export async function clientIp({ signal, fetchImpl = fetch } = {}) {
  // Déjà en cours : la promesse partagée, le signal passe au premier appel.
  if (ipPromise) return ipPromise;
  // La promesse partagée : le fetch, puis l'adresse du corps JSON.
  ipPromise = (async () => {
    // La réponse.
    const r = await fetchImpl(ECHO_URL, { signal });
    // Une réponse sans succès est une erreur lisible.
    if (!r.ok) throw new Error(`Service d'écho d'IP injoignable (HTTP ${r.status})`);
    // Le corps de la réponse : { ip }.
    const body = await r.json();
    // L'adresse, seule valeur utile.
    return String(body?.ip || '');
  // Fin de la promesse partagée.
  })();
  // L'adresse.
  return ipPromise;
// Fin de clientIp.
}

/**
 * Vrai si l'adresse du client est admise dans le cœur de l'app (dans la liste d'autorisation).
 * @param {object}   [o]
 * @param {AbortSignal} [o.signal]    signal d'interruption transmis à la lecture d'IP
 * @param {Function}   [o.fetchImpl]  le fetch injectable
 * @returns {Promise<boolean>} vrai si l'adresse est bien celle de la liste d'autorisation
 */
export async function isAccessAllowed({ signal, fetchImpl } = {}) {
  // L'adresse du client, lue (et mise en cache) : admise si elle est dans la liste.
  return ALLOWED_IPS.includes(await clientIp({ signal, fetchImpl }));
// Fin de isAccessAllowed.
}

/**
 * Reconduit l'accès ou refuse de créer le moteur : la fonction à appeler juste avant `new SolarEngine(...)`.
 * @param {object}   [o]
 * @param {AbortSignal} [o.signal]    signal d'interruption transmis à la lecture d'IP
 * @param {Function}   [o.fetchImpl]  le fetch injectable
 * @throws {AccessDeniedError} si l'adresse du client n'est pas dans la liste d'autorisation
 */
export async function requireAccess({ signal, fetchImpl } = {}) {
  // L'adresse du client, lue (et mise en cache).
  const ip = await clientIp({ signal, fetchImpl });
  // Hors liste : le refus, avec l'adresse en cause.
  if (!ALLOWED_IPS.includes(ip)) throw new AccessDeniedError(ip);
// Fin de requireAccess.
}

/** Erreur d'accès refusé : elle porte l'adresse refusée et un message lisible, pour l'écran plein. */
export class AccessDeniedError extends Error {
  // Constructeur : l'adresse refusée (début).
  constructor(ip) {
    // Le message lisible, avec l'adresse.
    super(`Accès refusé : l'adresse ${ip || 'inconnue'} n'est pas dans la liste d'autorisation (${ALLOWED_IPS.join(', ')})`);
    // Le nom de l'erreur.
    this.name = 'AccessDeniedError';
    // L'adresse refusée.
    this.ip = ip;
  // Fin du constructeur.
  }
// Fin de la classe.
}
