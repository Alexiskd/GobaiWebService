/**
 * Interface commune des fournisseurs de l'assistant (Claude, Mistral) : l'assistant se comporte pareil avec les deux.
 *
 * Chaque requête porte la clé de l'utilisateur, jamais une clé du serveur. La clé n'est ni gardée, ni écrite dans un
 * journal, ni renvoyée dans un message d'erreur : `redact` la retire de tout texte venu d'un fournisseur.
 */

/** Fournisseurs proposés à l'utilisateur. */
export const PROVIDER_IDS = ['claude', 'mistral'] as const;
/** Identifiant d'un fournisseur. */
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Message de la conversation, sans la consigne système. */
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

/** Outil au format neutre (celui de l'API Claude) : chaque adaptateur le traduit pour son fournisseur. */
export interface ToolSpec { name: string; description: string; input_schema: Record<string, unknown> }

/** Ce que l'adaptateur envoie : consigne, conversation, outils. */
export interface ChatRequest { system: string; messages: ChatMessage[]; tools: ToolSpec[]; maxTokens: number }

/** Ce que l'adaptateur rend : le texte et les appels d'outils, au même format pour les deux fournisseurs. */
export interface ChatResult { text: string; toolCalls: { name: unknown; input: unknown }[]; model: string }

/** Ce qu'il faut savoir d'un fournisseur pour l'afficher et le facturer. */
export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Modèles essayés dans l'ordre : le plus performant d'abord, un repli si le compte n'y a pas accès. */
  models: string[];
  /** Page d'ajout d'un moyen de paiement ou de crédit. */
  billingUrl: string;
  /** Page de création d'une clé. */
  keysUrl: string;
}

/** Contrat d'un adaptateur. */
export interface AssistantProvider {
  readonly info: ProviderInfo;
  /** Appel de test minimal (une réponse d'un seul jeton) : lève une ProviderError si la clé ou le compte bloque. */
  verify(key: string): Promise<{ model: string }>;
  /** Une réponse de l'assistant. */
  chat(key: string, request: ChatRequest): Promise<ChatResult>;
}

/** Nature d'un refus du fournisseur, la seule chose que le reste du serveur a besoin de connaître. */
export type ProviderErrorKind =
  | 'invalid_key'     // clé fausse, révoquée ou expirée
  | 'billing'         // pas de moyen de paiement, plus de crédit gratuit, compte bloqué pour facturation
  | 'rate_limited'    // trop de requêtes : réessayer plus tard
  | 'model_unavailable' // modèle inconnu ou non ouvert à ce compte : essayer le modèle suivant
  | 'bad_request'     // requête refusée pour une autre raison (paramètre)
  | 'unavailable';    // panne, délai dépassé, surcharge

/** Refus d'un fournisseur, déjà classé. Le message ne contient jamais la clé. */
export class ProviderError extends Error {
  constructor(readonly kind: ProviderErrorKind, message: string, readonly status = 0) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Retire la clé (et tout ce qui ressemble à une clé d'API) d'un texte venu d'un fournisseur. */
export function redact(text: string, key?: string): string {
  let out = String(text ?? '');
  if (key && key.length >= 6) out = out.split(key).join('[clé masquée]');
  return out.replace(/\b(sk-ant-[A-Za-z0-9_-]{6,}|sk-[A-Za-z0-9_-]{16,}|[A-Za-z0-9]{32,})\b/g, '[clé masquée]').slice(0, 300);
}

/** Délai maximal d'un appel au fournisseur. */
export const PROVIDER_TIMEOUT_MS = 45_000;
