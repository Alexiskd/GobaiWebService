// Tests des profils de tuiles par astre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_PROFILES, profileCacheOptions, profileScreenError, tileProfile } from './astre-solide.tiles.js';

test('profils : finesse et mémoire par astre et par appareil', () => {
  // Terre : valeurs d'avant la refonte (ordinateur 2, téléphone 3/4/6, mémoire 400 et 150/90/50).
  assert.equal(profileScreenError({ bodyId: 'earth' }), 2);
  assert.equal(profileScreenError({ bodyId: 'earth', touch: true, tier: 'low', moving: true }), 8);
  assert.equal(profileCacheOptions({ bodyId: 'earth' }).tileCacheSize, 400);
  // Vénus (données au niveau 5) : plus grossière, moins de mémoire.
  assert.ok(profileScreenError({ bodyId: 'venus' }) > profileScreenError({ bodyId: 'earth' }));
  assert.ok(profileCacheOptions({ bodyId: 'venus', touch: true }).tileCacheSize < profileCacheOptions({ bodyId: 'earth', touch: true }).tileCacheSize);
  // Astre inconnu : profil de la Terre ; gamme inconnue : haut de gamme.
  assert.equal(tileProfile('pluton'), TILE_PROFILES.earth);
  assert.equal(profileScreenError({ bodyId: 'moon', touch: true, tier: '?' }), TILE_PROFILES.moon.sse.high);
  // Fond des océans en relief : la Terre seule.
  assert.deepEqual(Object.entries(TILE_PROFILES).filter(([, p]) => p.oceanFloor).map(([id]) => id), ['earth']);
  // Chaque profil a toutes ses clés.
  for (const p of Object.values(TILE_PROFILES)) for (const k of ['desktop', 'high', 'mid', 'low']) { assert.ok(p.sse[k] > 0); assert.ok(p.cache[k] > 0); }
});
