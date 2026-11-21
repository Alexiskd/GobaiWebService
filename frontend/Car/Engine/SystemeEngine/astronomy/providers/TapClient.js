/** Client TAP minimal pour les archives astronomiques publiques. */
export class TapHttpError extends Error {
  constructor(provider, status, message, url) {
    super(message || `${provider}: HTTP ${status}`);
    this.name = 'TapHttpError';
    this.provider = provider;
    this.status = status;
    this.url = url;
  }
}

export function createTapUrl(endpoint, query, params = {}, tapOptions = {}) {
  const url = new URL(endpoint);
  const { requestParam = 'REQUEST', languageParam = 'LANG', formatParam = 'FORMAT', queryParam = 'QUERY' } = tapOptions;
  if (requestParam) url.searchParams.set(requestParam, 'doQuery');
  if (languageParam) url.searchParams.set(languageParam, 'ADQL');
  if (formatParam) url.searchParams.set(formatParam, 'json');
  url.searchParams.set(queryParam, query);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Convertit les formats JSON TAP courants en lignes objets, sans perdre les colonnes inconnues. */
export function parseTapRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data) && Array.isArray(payload.metadata)) {
    const columns = payload.metadata.map((column) => column.name || column.ID || column.id);
    return payload.data.map((row) => {
      if (!Array.isArray(row)) return row;
      return Object.fromEntries(columns.map((name, index) => [name, row[index]]).filter(([name]) => name));
    });
  }
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

export async function executeTapQuery({ provider, endpoint, query, signal, fetchImpl = globalThis.fetch, timeoutMs = 30000, params = {}, tapOptions = {} }) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch indisponible dans cet environnement.');
  const url = createTapUrl(endpoint, query, params, tapOptions);
  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) relayAbort();
  else signal?.addEventListener?.('abort', relayAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException('TAP timeout', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) throw new TapHttpError(provider, response.status, `${provider}: réponse HTTP ${response.status}`, url);
    const contentType = response.headers?.get?.('content-type') || '';
    const text = await response.text();
    if (/xml|votable/i.test(contentType) || /^\s*</.test(text)) {
      throw new Error(`${provider}: réponse XML/VOTable reçue au lieu du JSON demandé.`);
    }
    let payload;
    try { payload = JSON.parse(text); }
    catch { throw new Error(`${provider}: réponse JSON illisible.`); }
    return { rows: parseTapRows(payload), retrievedAt: new Date().toISOString(), provider, endpoint };
  } catch (error) {
    if (signal?.aborted) throw signal.reason || error;
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', relayAbort);
  }
}
