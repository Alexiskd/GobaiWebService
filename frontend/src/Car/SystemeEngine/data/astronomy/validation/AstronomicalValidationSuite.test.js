import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAstronomicalPipeline, assertAstronomicalPipelineValid } from './AstronomicalValidationSuite.js';

const fixture = () => [
  {
    id: 'gaia-record-1', kind: 'star', source: 'ESA Gaia DR3', sourceId: '1234567890123456789', name: 'Validation Star',
    coordinates: { raDeg: 101.287, decDeg: -16.716, epoch: 2016, frame: 'ICRS' },
    astrometry: { parallaxMas: 100, properMotionRaMasYr: 10, properMotionDecMasYr: -5, radialVelocityKmS: 20 },
    provenance: { retrievedAt: '2026-11-16T00:00:00Z' },
  },
  {
    id: 'nasa-planet-1', kind: 'exoplanet', source: 'NASA Exoplanet Archive', sourceId: 'Validation b', name: 'Validation b',
    host: { name: 'Validation Star', gaiaDr3Id: '1234567890123456789' },
    orbit: { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0.1, inclinationDeg: 5, longitudeAscendingNodeDeg: 15, argumentOfPeriastronDeg: 25, meanAnomalyAtEpochDeg: 0, epochJulianDate: 2451545 },
    physical: { radiusEarth: 1.2 }, provenance: { source: 'NASA Exoplanet Archive' },
  },
];

test('valide le pipeline complet catalogue -> astrométrie -> orbite -> scène -> mapping persistance', () => {
  const report = validateAstronomicalPipeline(fixture(), {
    targetEpochJulianYear: 2026,
    targetJulianDate: 2461350.5,
    sceneOptions: { auToSceneUnits: 100 },
  });
  assert.equal(report.status, 'passed-with-warnings');
  assert.equal(report.statistics.systems, 1);
  assert.equal(report.statistics.attachedExoplanets, 1);
  assert.equal(report.statistics.calculatedOrbits, 1);
  assert.equal(report.checks.find((item) => item.id === 'identity.gaia-linkage').status, 'passed');
  assert.equal(report.checks.find((item) => item.id === 'orbit.kepler-solutions').status, 'passed');
  assert.equal(report.checks.find((item) => item.id === 'scene.model-generation').status, 'passed');
  assert.equal(report.checks.find((item) => item.id === 'persistence.mapping').status, 'passed');
  assert.equal(report.checks.find((item) => item.id === 'database.live-connectivity').status, 'warning');
});

test('signale les hôtes non vérifiés sans les rattacher automatiquement', () => {
  const records = fixture();
  records[1].host.gaiaDr3Id = '9999999999999999999';
  const report = validateAstronomicalPipeline(records, { targetJulianDate: 2461350.5 });
  assert.equal(report.checks.find((item) => item.id === 'identity.gaia-linkage').status, 'warning');
  assert.equal(report.statistics.attachedExoplanets, 0);
});

test('rejette une entrée non tabulaire et expose le rapport', () => {
  assert.equal(validateAstronomicalPipeline(null).status, 'failed');
  assert.throws(() => assertAstronomicalPipelineValid(null), (error) => Boolean(error.report));
});

test('ne prétend pas avoir testé les services externes', () => {
  const report = validateAstronomicalPipeline(fixture());
  assert.equal(report.checks.find((item) => item.id === 'provider.live-connectivity').status, 'warning');
  assert.equal(report.checks.find((item) => item.id === 'provider.live-connectivity').tested, false);
});
