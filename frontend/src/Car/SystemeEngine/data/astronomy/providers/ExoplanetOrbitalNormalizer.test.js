import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExoplanet } from './AstronomicalDataNormalizer.js';

test('normalise les angles orbitaux NASA et conserve le temps de périastre sans supposer son échelle', () => {
  const planet = normalizeExoplanet({
    pl_name: 'Example b', hostname: 'Example', pl_orbper: 12.5,
    pl_orbsmax: 0.1, pl_orbeccen: 0.2, pl_orbincl: 88,
    pl_orblper: 125, pl_orbtper: 2459000.5,
  });
  assert.equal(planet.orbit.argumentOfPeriastronDeg, 125);
  assert.match(planet.orbit.argumentOfPeriastronConvention, /as-reported/);
  assert.equal(planet.orbit.timeOfPeriastronRawDays, 2459000.5);
  assert.equal(planet.orbit.timeOfPeriastronSourceField, 'pl_orbtper');
  assert.equal(planet.orbit.periastronEpochJulianDate, undefined);
});
