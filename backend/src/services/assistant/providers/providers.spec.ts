// Adaptateurs de l'assistant : même comportement chez Claude et chez Mistral, refus bien classés, clé jamais renvoyée.
import { ProviderError, redact } from './assistant-provider';
import { ClaudeProvider, classifyClaude } from './claude.provider';
import { MistralProvider, classifyMistral } from './mistral.provider';
import { AssistantService } from '../assistant.service';

const KEY = 'sk-test-0123456789abcdefghij';

/** Faux fetch : répond dans l'ordre les réponses données, et garde chaque appel. */
function fakeFetch(...answers: { status: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const TOOL = { name: 'aller_a_un_astre', description: 'Va sur un astre.', input_schema: { type: 'object', properties: { astre: { type: 'string' } }, required: ['astre'], additionalProperties: false } };
const REQ = { system: 'Consigne', messages: [{ role: 'user' as const, content: 'Va sur Titan' }], tools: [TOOL], maxTokens: 64 };

describe('classement des refus', () => {
  it('Claude : clé, facturation (402 ou crédit épuisé en 400), modèle, débit', () => {
    expect(classifyClaude(401, 'authentication_error', 'invalid x-api-key').kind).toBe('invalid_key');
    expect(classifyClaude(402, 'billing_error', '').kind).toBe('billing');
    expect(classifyClaude(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.').kind).toBe('billing');
    expect(classifyClaude(404, 'not_found_error', 'model: claude-x').kind).toBe('model_unavailable');
    expect(classifyClaude(429, 'rate_limit_error', 'see plans and billing').kind).toBe('rate_limited');
    expect(classifyClaude(400, 'invalid_request_error', 'tools: unexpected').kind).toBe('bad_request');
  });

  it('Mistral : clé, facturation (402, abonnement), modèle, débit', () => {
    expect(classifyMistral(401, 'Unauthorized').kind).toBe('invalid_key');
    expect(classifyMistral(402, 'Payment required').kind).toBe('billing');
    expect(classifyMistral(403, 'Subscription inactive').kind).toBe('billing');
    expect(classifyMistral(400, 'Invalid model: xyz').kind).toBe('model_unavailable');
    expect(classifyMistral(429, 'Requests rate limit exceeded').kind).toBe('rate_limited');
  });

  it('retire la clé de tout texte', () => {
    expect(redact(`bad key ${KEY} here`, KEY)).not.toContain(KEY);
    expect(redact('key sk-ant-api03-abcdefghijklmnop refused')).not.toContain('sk-ant-api03');
  });
});

describe('ClaudeProvider', () => {
  it('envoie la clé dans x-api-key et ramène texte et outils', async () => {
    const { fn, calls } = fakeFetch({ status: 200, body: { content: [{ type: 'text', text: 'Je vous emmène.' }, { type: 'tool_use', name: 'aller_a_un_astre', input: { astre: 'Titan' } }] } });
    const r = await new ClaudeProvider(['claude-a'], fn).chat(KEY, REQ);
    expect((calls[0].init.headers as Record<string, string>)['x-api-key']).toBe(KEY);
    expect(calls[0].body.model).toBe('claude-a');
    expect(r.text).toBe('Je vous emmène.');
    expect(r.toolCalls).toEqual([{ name: 'aller_a_un_astre', input: { astre: 'Titan' } }]);
  });

  it('passe au modèle suivant si le premier n’est pas ouvert au compte', async () => {
    const { fn, calls } = fakeFetch({ status: 404, body: { error: { type: 'not_found_error', message: 'model' } } }, { status: 200, body: { content: [{ type: 'text', text: 'OK' }] } });
    const r = await new ClaudeProvider(['claude-a', 'claude-b'], fn).verify(KEY);
    expect(r.model).toBe('claude-b');
    expect(calls.map((c) => c.body.model)).toEqual(['claude-a', 'claude-b']);
  });

  it('lève billing sur crédit épuisé, sans recopier la clé', async () => {
    const { fn } = fakeFetch({ status: 400, body: { error: { type: 'invalid_request_error', message: `Your credit balance is too low (${KEY})` } } });
    await expect(new ClaudeProvider(['claude-a'], fn).verify(KEY)).rejects.toMatchObject({ kind: 'billing' });
    const err = await new ClaudeProvider(['claude-a'], fn).verify(KEY).catch((e: ProviderError) => e);
    expect(String((err as ProviderError).message)).not.toContain(KEY);
  });
});

describe('MistralProvider', () => {
  it('traduit les outils en fonctions et ramène les appels au format commun', async () => {
    const { fn, calls } = fakeFetch({ status: 200, body: { choices: [{ message: { content: 'Je vous emmène.', tool_calls: [{ function: { name: 'aller_a_un_astre', arguments: '{"astre":"Titan"}' } }] } }] } });
    const r = await new MistralProvider(['mistral-a'], fn).chat(KEY, REQ);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect((calls[0].body.messages as { role: string }[])[0].role).toBe('system');
    expect((calls[0].body.tools as { type: string; function: { name: string } }[])[0]).toMatchObject({ type: 'function', function: { name: 'aller_a_un_astre' } });
    expect(r.text).toBe('Je vous emmène.');
    expect(r.toolCalls).toEqual([{ name: 'aller_a_un_astre', input: { astre: 'Titan' } }]);
  });

  it('lève invalid_key sur 401', async () => {
    const { fn } = fakeFetch({ status: 401, body: { message: 'Unauthorized' } });
    await expect(new MistralProvider(['mistral-a'], fn).verify(KEY)).rejects.toMatchObject({ kind: 'invalid_key' });
  });
});

describe('AssistantService', () => {
  const config = { claudeModels: ['claude-a'], mistralModels: ['mistral-a'] };

  it('même réponse et mêmes actions avec les deux fournisseurs', async () => {
    const claude = fakeFetch({ status: 200, body: { content: [{ type: 'text', text: 'OK' }, { type: 'tool_use', name: 'aller_a_un_astre', input: { astre: 'Titan' } }] } });
    const mistral = fakeFetch({ status: 200, body: { choices: [{ message: { content: 'OK', tool_calls: [{ function: { name: 'aller_a_un_astre', arguments: '{"astre":"Titan"}' } }] } }] } });
    const a = await new AssistantService(config, claude.fn).reply('claude', KEY, REQ.messages);
    const b = await new AssistantService(config, mistral.fn).reply('mistral', KEY, REQ.messages);
    expect(a.actions).toEqual(b.actions);
    expect(a.reply).toBe(b.reply);
    // La consigne du serveur et les outils partent dans les deux cas.
    expect(String(claude.calls[0].body.system)).toContain('assistant');
    expect((mistral.calls[0].body.tools as unknown[]).length).toBe((claude.calls[0].body.tools as unknown[]).length);
  });

  it('refus de facturation → 402 avec la page de paiement du fournisseur', async () => {
    const { fn } = fakeFetch({ status: 402, body: { message: 'Payment required' } });
    const err = await new AssistantService(config, fn).verify('mistral', KEY).catch((e) => e);
    expect(err.getStatus()).toBe(402);
    expect(err.getResponse()).toMatchObject({ code: 'billing', provider: 'mistral', billingUrl: 'https://admin.mistral.ai/organization/billing' });
  });

  it('clé révoquée → 401 invalid_key ; clé mal formée refusée sans appel', async () => {
    const { fn, calls } = fakeFetch({ status: 401, body: { error: { type: 'authentication_error', message: 'invalid x-api-key' } } });
    const service = new AssistantService(config, fn);
    expect((await service.verify('claude', KEY).catch((e) => e)).getResponse()).toMatchObject({ code: 'invalid_key' });
    expect((await service.verify('claude', 'court').catch((e) => e)).getStatus()).toBe(401);
    expect(calls.length).toBe(1);
  });

  it('ne connaît que claude et mistral', async () => {
    expect((await new AssistantService(config).verify('autre', KEY).catch((e) => e)).getStatus()).toBe(400);
  });

  it('annonce le modèle principal et les pages de chaque fournisseur', () => {
    expect(new AssistantService(config).catalog().providers.map((p) => [p.id, p.model])).toEqual([['claude', 'claude-a'], ['mistral', 'mistral-a']]);
  });
});
