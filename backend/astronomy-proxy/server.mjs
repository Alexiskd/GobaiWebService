import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGINS = new Set((process.env.CORS_ORIGINS || 'https://static-u4m0.onrender.com,https://www.gobaispace.com,https://gobaispace.com').split(',').map((v) => v.trim()).filter(Boolean));
const UPSTREAMS = Object.freeze({
  simbad: 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
  exoplanet: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
});
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const MAX_QUERY_LENGTH = 32_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const buckets = new Map();

function send(res, status, payload, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(payload));
}
function rateAllowed(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip) || { start: now, count: 0 };
  if (now - bucket.start >= RATE_WINDOW_MS) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1; buckets.set(ip, bucket);
  if (buckets.size > 5000) for (const [key, value] of buckets) if (now - value.start > RATE_WINDOW_MS) buckets.delete(key);
  return bucket.count <= RATE_LIMIT;
}
function isReadOnlyAdql(query) {
  const normalized = String(query || '').trim();
  return normalized.length > 0 && normalized.length <= MAX_QUERY_LENGTH
    && /^SELECT\b/i.test(normalized)
    && !/;|\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|GRANT|REVOKE|UPLOAD|EXECUTE)\b/i.test(normalized);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Accept, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') { send(res, 200, { ok: true, service: 'gobai-astronomy-proxy' }); return; }
  const match = /^\/tap\/(simbad|exoplanet)$/.exec(url.pathname);
  if (req.method !== 'GET' || !match) { send(res, 404, { error: 'Route introuvable.' }); return; }
  if (origin && !ALLOWED_ORIGINS.has(origin)) { send(res, 403, { error: 'Origine non autorisée.' }); return; }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!rateAllowed(ip)) { send(res, 429, { error: 'Limite de requêtes dépassée.' }); return; }
  const provider = match[1];
  const query = url.searchParams.get(provider === 'simbad' ? 'QUERY' : 'query');
  if (!isReadOnlyAdql(query)) { send(res, 400, { error: 'Requête TAP SELECT invalide ou trop longue.' }); return; }
  const upstreamUrl = new URL(UPSTREAMS[provider]);
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === 'query' || key.toLowerCase() === 'format' || key.toUpperCase() === 'REQUEST' || key.toUpperCase() === 'LANG') upstreamUrl.searchParams.set(key, value);
  }
  if (provider === 'simbad') {
    upstreamUrl.searchParams.set('REQUEST', 'doQuery');
    upstreamUrl.searchParams.set('LANG', 'ADQL');
    upstreamUrl.searchParams.set('FORMAT', 'json');
  } else {
    upstreamUrl.searchParams.set('format', 'json');
    upstreamUrl.searchParams.set('query', query);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const upstream = await fetch(upstreamUrl, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!upstream.ok) { send(res, 502, { error: `Le fournisseur ${provider} a répondu HTTP ${upstream.status}.`, provider }); return; }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES) { send(res, 502, { error: 'Réponse TAP trop volumineuse.' }); return; }
    const contentType = upstream.headers.get('content-type') || '';
    const body = new TextDecoder().decode(bytes);
    if (!/json/i.test(contentType) && /^\s*</.test(body)) { send(res, 502, { error: 'Le fournisseur a renvoyé du XML au lieu du JSON.' }); return; }
    try { JSON.parse(body); } catch { send(res, 502, { error: 'Réponse JSON TAP invalide.' }); return; }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' });
    res.end(body);
  } catch (error) {
    send(res, 502, { error: error?.name === 'AbortError' ? 'Délai fournisseur dépassé.' : 'Fournisseur astronomique injoignable.', provider });
  } finally { clearTimeout(timeout); }
});

server.listen(PORT, '0.0.0.0', () => process.stdout.write(`Gobai Astronomy Proxy listening on ${PORT}\n`));
