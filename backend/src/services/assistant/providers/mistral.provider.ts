/**
 * Adaptateur Mistral (La Plateforme, API Chat Completions) : appelé avec la clé de l'utilisateur, en-tête
 * `Authorization: Bearer`. Les outils sont traduits au format « function » de Mistral, et ses appels de fonction
 * ramenés au format commun : l'assistant pilote l'interface pareil qu'avec Claude.
 *
 * Classement des refus (https://docs.mistral.ai/resources/error-glossary) :
 *  - 401 : clé absente, fausse, révoquée ou expirée ;
 *  - 402 : facturation (crédit gratuit épuisé, aucun moyen de paiement) ; 403 sans rapport au modèle : abonnement
 *    inactif, traité comme de la facturation ;
 *  - 404, ou 400/403/422 qui parle du modèle : modèle non ouvert à ce compte → modèle suivant ;
 *  - 429 : réessayer plus tard.
 */
import {
  AssistantProvider, ChatRequest, ChatResult, PROVIDER_TIMEOUT_MS, ProviderError, ProviderInfo, redact,
} from './assistant-provider';

const API_URL = 'https://api.mistral.ai/v1/chat/completions';

/** Ce qui ne change pas d'un déploiement à l'autre. */
export const MISTRAL_INFO: Omit<ProviderInfo, 'models'> = {
  id: 'mistral',
  label: 'Mistral',
  billingUrl: 'https://admin.mistral.ai/organization/billing',
  keysUrl: 'https://console.mistral.ai/api-keys',
};

/** Refus de l'API Mistral, classé. */
export function classifyMistral(status: number, message: string): ProviderError {
  const text = message || `HTTP ${status}`;
  const aboutModel = /\bmodel\b|modèle/i.test(message);
  if (status === 401) return new ProviderError('invalid_key', text, status);
  if (status === 429) return new ProviderError('rate_limited', text, status);
  if (status === 402) return new ProviderError('billing', text, status);
  if (status === 404 || (aboutModel && [400, 403, 422].includes(status))) return new ProviderError('model_unavailable', text, status);
  if (status === 403 || /payment|billing|credit|subscription/i.test(message)) return new ProviderError('billing', text, status);
  if (status === 400 || status === 422) return new ProviderError('bad_request', text, status);
  return new ProviderError('unavailable', text, status);
}

/** Texte d'un message Mistral : une chaîne, ou une liste de morceaux typés. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((c) => (c && typeof c === 'object' && (c as { type?: string }).type === 'text' ? String((c as { text?: unknown }).text ?? '') : ''))
      .join('').trim();
  }
  return '';
}

/** Arguments d'un appel de fonction : un texte JSON (cas habituel) ou déjà un objet. */
function argsOf(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

interface MistralResponse {
  choices?: { message?: { content?: unknown; tool_calls?: { function?: { name?: unknown; arguments?: unknown } }[] } }[];
  message?: string;
  detail?: unknown;
}

/** Message d'erreur de Mistral, quelle que soit sa forme. */
function errorMessage(json: MistralResponse): string {
  if (typeof json.message === 'string') return json.message;
  if (typeof json.detail === 'string') return json.detail;
  if (Array.isArray(json.detail)) return json.detail.map((d) => (d && typeof d === 'object' ? String((d as { msg?: unknown }).msg ?? '') : '')).join(' ; ');
  return '';
}

export class MistralProvider implements AssistantProvider {
  readonly info: ProviderInfo;

  constructor(models: string[], private readonly fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.info = { ...MISTRAL_INFO, models };
  }

  async verify(key: string): Promise<{ model: string }> {
    return this.withModels(async (model) => {
      await this.call(key, { model, max_tokens: 1, messages: [{ role: 'user', content: 'Réponds : OK' }] });
      return { model };
    });
  }

  async chat(key: string, req: ChatRequest): Promise<ChatResult> {
    return this.withModels(async (model) => {
      const body: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens,
        temperature: 0.2,
        messages: [{ role: 'system', content: req.system }, ...req.messages],
      };
      if (req.tools.length) {
        body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
        body.tool_choice = 'auto';
      }
      let json: MistralResponse;
      try {
        json = await this.call(key, body);
      } catch (e) {
        if (!(e instanceof ProviderError) || e.kind !== 'bad_request' || !body.tools) throw e;
        delete body.tools; delete body.tool_choice;
        json = await this.call(key, body);
      }
      const message = json.choices?.[0]?.message ?? {};
      return {
        text: textOf(message.content),
        toolCalls: (message.tool_calls ?? []).map((c) => ({ name: c.function?.name, input: argsOf(c.function?.arguments) })),
        model,
      };
    });
  }

  private async withModels<T>(fn: (model: string) => Promise<T>): Promise<T> {
    let last: ProviderError | null = null;
    for (const model of this.info.models) {
      try { return await fn(model); } catch (e) {
        if (e instanceof ProviderError && e.kind === 'model_unavailable') { last = e; continue; }
        throw e;
      }
    }
    throw last ?? new ProviderError('model_unavailable', 'Aucun modèle configuré.');
  }

  private async call(key: string, body: Record<string, unknown>): Promise<MistralResponse> {
    let res: Response;
    try {
      res = await this.fetchFn(API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ProviderError('unavailable', 'API Mistral injoignable.');
    }
    const json = await res.json().catch(() => ({})) as MistralResponse;
    if (res.ok) return json;
    throw classifyMistral(res.status, redact(errorMessage(json), key));
  }
}
