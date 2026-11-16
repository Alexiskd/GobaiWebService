import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeAdqlString, normalizeExoplanet, normalizeGaiaSource, normalizeSimbadObject } from './AstronomicalDataNormalizer.js';

test('normalise Gaia DR3 sans convertir source_id en nombre non sûr', () => {
  const star = normalizeGaiaSource({ source_id: '5853498713190525696', ra: 217.4, dec: -62.6, parallax: 768.5, pmra: -3781, pmdec: 769, ref_epoch: 2016.0 });
  assert.equal(star.id, 'gaia-dr3:5853498713190525696');
  assert.equal(star.coordinates.frame, 'ICRS');
  assert.equal(star.coordinates.epoch, 2016);
  assert.equal(star.astrometry.parallaxMas, 768.5);
  assert.equal(star.astrometry.radialVelocityKmS, null);
});

test('ignore une ligne Gaia sans source_id', () => {
  assert.equal(normalizeGaiaSource({ ra: 10 }), null);
});

test('normalise une identification SIMBAD et sa classification', () => {
  const object = normalizeSimbadObject({ main_id: 'Proxima Centauri', ra: 217.429, dec: -62.679, otype: '*', sp_type: 'M5.5Ve' });
  assert.equal(object.name, 'Proxima Centauri');
  assert.equal(object.classification.spectralType, 'M5.5Ve');
  assert.equal(object.coordinates.raDeg, 217.429);
});

test('normalise les paramètres orbitaux NASA en conservant unités et provenance', () => {
  const planet = normalizeExoplanet({ pl_name: 'Proxima Cen b', hostname: 'Proxima Cen', pl_orbper: 11.186, pl_orbsmax: 0.0485, pl_orbeccen: 0.04, pl_orbincl: 89, pl_orblper: 120, pl_orbtper: 2458000, pl_rade: 1.1, pl_bmasse: 1.27, sy_dist: 1.3, ra: 217.4, dec: -62.6, gaia_dr3_id: '5853498713190525696' });
  assert.equal(planet.kind, 'exoplanet');
  assert.equal(planet.orbit.periodDays, 11.186);
  assert.equal(planet.orbit.semiMajorAxisAu, 0.0485);
  assert.equal(planet.orbit.argumentOfPeriastronDeg, 120);
  assert.match(planet.orbit.argumentOfPeriastronConvention, /as-reported/);
  assert.equal(planet.orbit.timeOfPeriastronRawDays, 2458000);
  assert.equal(planet.physical.massEarthBestEstimate, 1.27);
  assert.equal(planet.host.gaiaDr3Id, '5853498713190525696');
  assert.equal(planet.provenance.table, 'pscomppars');
});

test('échappe les apostrophes dans les littéraux ADQL', () => {
  assert.equal(escapeAdqlString("Barnard's Star"), "Barnard''s Star");
});
