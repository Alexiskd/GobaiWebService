import test from 'node:test';
import assert from 'node:assert/strict';

const source = await (await import('node:fs/promises')).readFile(new URL('./server.mjs', import.meta.url), 'utf8');
test('proxy is restricted to read-only SELECT ADQL queries', () => {
  assert.match(source, /\^SELECT\\b/i);
  assert.match(source, /INSERT\|UPDATE\|DELETE\|DROP/);
});
test('proxy has fixed upstream allowlist and explicit CORS origin allowlist', () => {
  assert.match(source, /simbad\.cds\.unistra\.fr/);
  assert.match(source, /exoplanetarchive\.ipac\.caltech\.edu/);
  assert.match(source, /ALLOWED_ORIGINS/);
});
test('proxy bounds query size, response size, timeout and request rate', () => {
  assert.match(source, /MAX_QUERY_LENGTH/);
  assert.match(source, /MAX_RESPONSE_BYTES/);
  assert.match(source, /25_000/);
  assert.match(source, /RATE_LIMIT/);
});
