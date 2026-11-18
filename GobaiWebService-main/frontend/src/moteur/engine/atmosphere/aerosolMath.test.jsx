// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { AEROSOL_PRODUCTS, AOD_SCALE, aerosolLegend, aerosolProduct, aerosolValue, normalizeAerosols } from './aerosolMath';

// Test : produits, codage, légendes.
test('aérosols : produits bornés, codes des images, légendes des produits observés', () => {
  // Produits proposés ; produit inconnu ramené à l'épaisseur optique.
  assert.deepEqual([AEROSOL_PRODUCTS, aerosolProduct('dust'), aerosolProduct('x')], [['aod', 'ai', 'dust'], 'dust', 'aod']);
  // Codes : 51 → 1 ; 0 → aucune mesure.
  assert.deepEqual([aerosolValue(51), aerosolValue(1), aerosolValue(0)], [1, 0, null]);
  // Légendes : autant de paliers que l'échelle ; indice de 0,7 à 5.
  assert.deepEqual([aerosolLegend('aod').length, aerosolLegend('ai')[0].label, aerosolLegend('ai').at(-1).value], [AOD_SCALE.length, '0,7', 5]);
// Fin du test.
});

// Test : la réponse du serveur.
test('aérosols : réponse mise en forme (produits, heures de prévision triées et contrôlées, zones)', () => {
  // Réponse d'essai.
  const n = normalizeAerosols({ days: { today: '2026-11-15' }, products: [{ id: 'aod', available: true, measured: { today: 0.31, yesterday: 0.42 } }, { id: 'ai', available: false, reason: 'HTTP 503' }], forecast: { available: true, times: ['2026-11-15T18:00:00Z', '2026-11-15T12:00:00Z', 'pas une heure'] }, plumes: [{ lon: 5, lat: 20, intensity: { value: 1.6 }, details: { aiMax: 2.1 } }, { lon: null, lat: 1, intensity: { value: 1 } }] });
  // Produits.
  assert.deepEqual(n.products.aod, { available: true, reason: null, today: 0.31, yesterday: 0.42 });
  // Raison d'une indisponibilité.
  assert.equal(n.products.ai.reason, 'HTTP 503');
  // Heures : deux, triées.
  assert.deepEqual(n.forecast.times.map((t) => t.iso), ['2026-11-15T12:00:00Z', '2026-11-15T18:00:00Z']);
  // Zones : une lisible, absorbante.
  assert.deepEqual(n.plumes, [{ lon: 5, lat: 20, aod: 1.6, absorbing: true }]);
// Fin du test.
});
