/**
 * Blocage des API externes, hôte par hôte : une API bloquée n'est plus jamais appelée par le serveur.
 * Deux listes s'additionnent :
 *  - la liste permanente, lue dans la variable d'environnement BLOCKED_API_HOSTS (hôtes séparés par des virgules) ;
 *  - la liste d'exécution, modifiée par la route PUT /api/v1/apis/blocked (perdue au redémarrage du serveur).
 * Le blocage est appliqué en un seul point : `fetch` est enveloppé (voir installFetchGuard), si bien que tous les
 * services du serveur sont couverts sans être modifiés un par un. Une source bloquée échoue aussitôt, et les
 * services qui ont une source de secours passent à la suivante.
 */

// Nombre maximal d'hôtes dans une liste.
export const MAX_BLOCKED_HOSTS = 200;

// Forme acceptée d'un nom d'hôte : lettres, chiffres, points et tirets.
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Erreur levée à la place de l'appel réseau quand l'API visée est bloquée. */
export class ApiBlockedError extends Error {
  // Constructeur : garde l'hôte refusé.
  constructor(readonly host: string) {
    // Message lisible dans les journaux.
    super(`API déconnectée : ${host}`);
    // Nom de l'erreur.
    this.name = 'ApiBlockedError';
  // Fin du constructeur.
  }
// Fin de ApiBlockedError.
}

/** Nettoie une liste d'hôtes : minuscules, sans espaces, sans doublon, noms valides seulement. */
export function normalizeHosts(hosts: readonly string[]): string[] {
  // Ensemble des hôtes retenus, dans l'ordre d'arrivée.
  const out = new Set<string>();
  // Parcourt les hôtes reçus.
  for (const raw of hosts) {
    // Passe en minuscules et retire les espaces et le point final.
    const host = String(raw).trim().toLowerCase().replace(/\.$/, '');
    // Garde l'hôte s'il a la forme d'un nom d'hôte.
    if (HOST_RE.test(host)) out.add(host);
    // S'arrête à la taille maximale.
    if (out.size >= MAX_BLOCKED_HOSTS) break;
  // Fin du parcours.
  }
  // Renvoie la liste.
  return [...out];
// Fin de normalizeHosts.
}

/** Lit une liste d'hôtes écrite en texte, séparés par des virgules, des espaces ou des retours à la ligne. */
export function parseHosts(text: string | undefined | null): string[] {
  // Découpe puis nettoie.
  return normalizeHosts((text ?? '').split(/[\s,;]+/).filter(Boolean));
// Fin de parseHosts.
}

/** L'hôte est-il bloqué ? Vrai s'il est dans la liste, ou s'il est un sous-domaine d'un hôte de la liste. */
export function hostBlocked(host: string, blocked: readonly string[]): boolean {
  // Hôte en minuscules, sans point final.
  const h = host.toLowerCase().replace(/\.$/, '');
  // Cherche une égalité ou un suffixe « .hôte ».
  return blocked.some((b) => h === b || h.endsWith(`.${b}`));
// Fin de hostBlocked.
}

/** Hôte d'une adresse http(s), ou null si ce n'en est pas une (adresse relative, data:, blob:…). */
export function hostOf(url: string): string | null {
  // Essaie de lire l'adresse.
  try {
    // Analyse l'adresse.
    const u = new URL(url);
    // Ne renvoie l'hôte que pour http et https.
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  // Adresse illisible : pas d'hôte.
  } catch {
    // Renvoie null.
    return null;
  // Fin de l'essai.
  }
// Fin de hostOf.
}

// Liste permanente, lue une fois dans l'environnement.
let envHosts: string[] = parseHosts(process.env.BLOCKED_API_HOSTS);
// Liste d'exécution, vide au démarrage.
let runtimeHosts: string[] = [];

/** Liste permanente (variable d'environnement). */
export const envBlockedHosts = (): string[] => [...envHosts];
/** Liste d'exécution (route d'administration). */
export const runtimeBlockedHosts = (): string[] => [...runtimeHosts];
/** Tous les hôtes bloqués, les deux listes réunies. */
export const blockedHosts = (): string[] => normalizeHosts([...envHosts, ...runtimeHosts]);

/** Remplace la liste d'exécution ; renvoie la liste retenue après nettoyage. */
export function setRuntimeBlockedHosts(hosts: readonly string[]): string[] {
  // Nettoie et garde.
  runtimeHosts = normalizeHosts(hosts);
  // Renvoie une copie.
  return [...runtimeHosts];
// Fin de setRuntimeBlockedHosts.
}

/** Relit la liste permanente (pour les tests). */
export function reloadEnvBlockedHosts(text: string | undefined = process.env.BLOCKED_API_HOSTS): void {
  // Relit le texte fourni.
  envHosts = parseHosts(text);
// Fin de reloadEnvBlockedHosts.
}

/** L'adresse vise-t-elle une API bloquée ? */
export function urlBlocked(url: string, blocked: readonly string[] = blockedHosts()): boolean {
  // Hôte de l'adresse.
  const host = hostOf(url);
  // Bloquée si l'hôte existe et figure dans la liste.
  return host !== null && hostBlocked(host, blocked);
// Fin de urlBlocked.
}

// Adresse visée par un appel à fetch, quelle que soit la forme de son premier argument.
function targetOf(input: unknown): string {
  // Texte : l'adresse elle-même.
  if (typeof input === 'string') return input;
  // Objet URL : son adresse complète.
  if (input instanceof URL) return input.href;
  // Objet Request : son champ url ; sinon, rien.
  return typeof (input as { url?: unknown })?.url === 'string' ? (input as { url: string }).url : '';
// Fin de targetOf.
}

/** Enveloppe une fonction fetch : refuse les appels vers une API bloquée, laisse passer les autres. */
export function guardFetch(inner: typeof fetch, blocked: () => readonly string[] = blockedHosts): typeof fetch {
  // La fonction enveloppée.
  const guarded = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    // Hôte visé.
    const host = hostOf(targetOf(input));
    // Bloqué : promesse rejetée, aucun appel réseau.
    if (host !== null && hostBlocked(host, blocked())) return Promise.reject(new ApiBlockedError(host));
    // Sinon : appel normal.
    return inner(input, init);
  // Fin de la fonction enveloppée.
  };
  // Renvoie la fonction, au type de fetch.
  return guarded as typeof fetch;
// Fin de guardFetch.
}

// Marque posée sur le fetch global une fois enveloppé, pour ne pas l'envelopper deux fois.
const GUARD_MARK = Symbol.for('gobai.fetchGuard');

/** Enveloppe le fetch global du serveur. À appeler avant le chargement des services. */
export function installFetchGuard(): void {
  // Le fetch global, vu comme un objet pouvant porter la marque.
  const current = globalThis.fetch as typeof fetch & { [GUARD_MARK]?: boolean };
  // Déjà enveloppé, ou pas de fetch : rien à faire.
  if (typeof current !== 'function' || current[GUARD_MARK]) return;
  // Enveloppe le fetch d'origine, lié à l'objet global.
  const guarded = guardFetch(current.bind(globalThis)) as typeof fetch & { [GUARD_MARK]?: boolean };
  // Pose la marque.
  guarded[GUARD_MARK] = true;
  // Remplace le fetch global.
  globalThis.fetch = guarded;
// Fin de installFetchGuard.
}
