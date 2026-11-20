/**
 * Adaptateur Claude (Claude Platform, API Messages) : appelé avec la clé de l'utilisateur, en-tête `x-api-key`.
 *
 * Classement des refus (https://platform.claude.com/docs/en/api/errors) :
 *  - 401 authentication_error : clé fausse, révoquée ou expirée ;
 *  - 402 billing_error, ou 400 « credit balance is too low » (crédit épuisé) : facturation ;
 *  - 403 permission_error, 404 not_found_error : modèle non ouvert à ce compte → modèle suivant ;
 *  - 429 rate_limit_error, 529 overloaded_error : réessayer plus tard.
 */
import {
  AssistantProvider, ChatRequest, ChatResult, PROVIDER_TIMEOUT_MS, ProviderError, ProviderInfo, redact,
} from './assistant-provider';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Ce qui ne change pas d'un déploiement à l'autre. */
export const CLAUDE_INFO: Omit<ProviderInfo, 'models'> = {
  id: 'claude',
  label: 'Claude',
  billingUrl: 'https://platform.claude.com/settings/billing',
  keysUrl: 'https://platform.claude.com/settings/keys',
};

/** Refus de l'API Claude, classé. Le crédit épuisé arrive en 400 : il est reconnu à son message. */
export function classifyClaude(status: number, type: string | undefined, message: string): ProviderError {
  const text = message || `HTTP ${status}`;
  if (status === 401 || type === 'authentication_error') return new ProviderError('invalid_key', text, status);
  if (status === 429 || status === 529 || type === 'rate_limit_error' || type === 'overloaded_error') {
    return new ProviderError('rate_limited', text, status);
  }
  if (status === 402 || type === 'billing_error' || /credit balance|purchase credits|billing|payment/i.test(message)) {
    return new ProviderError('billing', text, status);
  }
  if (status === 403 || status === 404 || type === 'permission_error' || type === 'not_found_error') {
    return new ProviderError('model_unavailable', text, status);
  }
  if (status === 400) return new ProviderError('bad_request', text, status);
  return new ProviderError('unavailable', text, status);
}

interface ClaudeResponse {
  content?: { type: string; text?: string; name?: unknown; input?: unknown }[];
  error?: { type?: string; message?: string };
}

export class ClaudeProvider implements AssistantProvider {
  readonly info: ProviderInfo;

  constructor(models: string[], private readonly fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.info = { ...CLAUDE_INFO, models };
  }

  async verify(key: string): Promise<{ model: string }> {
    return this.withModels(async (model) => {
      await this.call(key, { model, max_tokens: 1, messages: [{ role: 'user', content: 'Réponds : OK' }] });
      return { model };
    });
  }

  async chat(key: string, req: ChatRequest): Promise<ChatResult> {
    return this.withModels(async (model) => {
      const body: Record<string, unknown> = { model, max_tokens: req.maxTokens, system: req.system, messages: req.messages };
      if (req.tools.length) body.tools = req.tools;
      let json: ClaudeResponse;
      try {
        json = await this.call(key, body);
      } catch (e) {
        // Paramètre refusé par ce modèle : un second essai sans outils, pour que l'assistant réponde quand même.
        if (!(e instanceof ProviderError) || e.kind !== 'bad_request' || !body.tools) throw e;
        delete body.tools;
        json = await this.call(key, body);
      }
      const blocks = json.content ?? [];
      return {
        text: blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim(),
        toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input })),
        model,
      };
    });
  }

  /** Essaie les modèles dans l'ordre : le suivant seulement si celui-ci n'est pas ouvert au compte. */
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

  private async call(key: string, body: Record<string, unknown>): Promise<ClaudeResponse> {
    let res: Response;
    try {
      res = await this.fetchFn(API_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': API_VERSION },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ProviderError('unavailable', 'API Claude injoignable.');
    }
    const json = await res.json().catch(() => ({})) as ClaudeResponse;
    if (res.ok) return json;
    throw classifyClaude(res.status, json.error?.type, redact(json.error?.message ?? '', key));
  }
}
