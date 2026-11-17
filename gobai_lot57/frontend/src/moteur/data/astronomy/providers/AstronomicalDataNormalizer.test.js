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


test('conserve le nœud ascendant uniquement lorsqu’une source le fournit explicitement', async () => {
  const { normalizeExoplanet } = await import('./AstronomicalDataNormalizer.js');
  const record = normalizeExoplanet({ pl_name: 'Node test b', hostname: 'Node test', pl_orblnode: 123.4, st_rad: 0.14 });
  assert.equal(record.orbit.longitudeAscendingNodeDeg, 123.4);
  assert.equal(record.host.radiusSolar, 0.14);
  const missing = normalizeExoplanet({ pl_name: 'Node test c', hostname: 'Node test' });
  assert.equal(missing.orbit.longitudeAscendingNodeDeg, null);
  assert.equal(missing.host.radiusSolar, null);
});

test('convertit un rayon NASA exprimé en rayons joviens vers des rayons terrestres', async () => {
  const { normalizeExoplanet } = await import('./AstronomicalDataNormalizer.js');
  const record = normalizeExoplanet({ pl_name: 'Radius test b', hostname: 'Radius test', pl_radj: 1 });
  assert.ok(Math.abs(record.physical.radiusEarth - 11.2089) < 1e-10);
  assert.equal(record.physical.radiusSourceField, 'pl_radj-converted-to-earth-radii');
});

test('conserve la covariance Gaia DR3 lorsque les erreurs et corrélations sont disponibles', () => {
  const star = normalizeGaiaSource({
    source_id: '123456', ref_epoch: 2016, ra: 10, dec: 20, parallax: 100, pmra: 1, pmdec: 2,
    ra_error: 0.1, dec_error: 0.2, parallax_error: 0.3, pmra_error: 0.4, pmdec_error: 0.5,
    ra_dec_corr: 0.25, pmra_pmdec_corr: -0.2,
  });
  assert.equal(star.astrometry.covariance.length, 5);
  assert.ok(Math.abs(star.astrometry.covariance[0][1] - 0.005) < 1e-12);
  assert.ok(Math.abs(star.astrometry.covariance[3][4] + 0.04) < 1e-12);
});
