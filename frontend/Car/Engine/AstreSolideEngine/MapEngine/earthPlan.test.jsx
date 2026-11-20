// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { planToDirect, validEarthPlan, withPlan } from './earthPlan.jsx';

// Table d'essai, telle que le serveur la sert, volontairement dans le désordre des rangs.
const PLAN = {
  // Version, couche, relais et accord des couleurs.
  version: 1, layerId: 'earth-hd', relay: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}', colorMatch: true,
  // Sources (début).
  sources: [
    // Sentinel-2, rang 2, mondiale, chargeable d'ici.
    { id: 'sentinel2', label: 'Sentinel-2', attribution: 'EOX', priority: 2, minZoom: 0, maxZoom: 14, templates: ['https://eox/{z}/{y}/{x}.jpg'] },
    // L'IGN, rang 1, sur la France, avec une vue de loin.
    { id: 'ign', label: 'IGN', attribution: 'IGN', priority: 1, minZoom: 12, maxZoom: 19, bboxes: [[-5.5, 41.2, 9.8, 51.2]], templates: ['https://ign/{z}/{x}/{y}'], lowZoom: 8 },
    // Un service WMS, rang 3, sans adresse directe : il passe par le relais.
    { id: 'de-by', label: 'Bavière', attribution: 'LDBV', priority: 3, minZoom: 12, maxZoom: 19, bboxes: [[8.95, 47.25, 13.85, 50.6]] },
  // Fin des sources.
  ],
// Fin de la table.
};

// Test : la table est vérifiée avant usage.
test('table de priorité valide ou non', () => {
  // La table d'essai est valide.
  assert.equal(validEarthPlan(PLAN), true);
  // Sans source, sans version, ou avec une source sans rang : refusée.
  assert.equal(validEarthPlan({ version: 1, sources: [] }), false);
  // Sans version.
  assert.equal(validEarthPlan({ sources: PLAN.sources }), false);
  // Source sans rang.
  assert.equal(validEarthPlan({ version: 1, sources: [{ id: 'a', minZoom: 0, maxZoom: 3 }] }), false);
  // Rien du tout.
  assert.equal(validEarthPlan(null), false);
// Fin du test.
});

// Test : le plan direct suit les rangs de la table et ne garde que l'utile.
test('plan direct trié par rang, sans les champs d’affichage', () => {
  // Le plan direct.
  const direct = planToDirect(PLAN);
  // Ordre des rangs : l'IGN, Sentinel-2, la Bavière.
  assert.deepEqual(direct.map((s) => s.id), ['ign', 'sentinel2', 'de-by']);
  // L'IGN garde son emprise, ses adresses et son niveau bas, sans nom ni mention.
  assert.deepEqual(direct[0], { id: 'ign', priority: 1, minZoom: 12, maxZoom: 19, bboxes: [[-5.5, 41.2, 9.8, 51.2]], templates: ['https://ign/{z}/{x}/{y}'], lowZoom: 8 });
  // La Bavière n'a pas d'adresse directe : elle passera par le relais.
  assert.equal(direct[2].templates, undefined);
  // Table inutilisable : aucun plan.
  assert.equal(planToDirect({ version: 1, sources: [] }), null);
// Fin du test.
});

// Test : la description de la couche reçoit le plan, ou le perd si la table manque.
test('description de la couche complétée par la table', () => {
  // Description reçue du serveur, avec un ancien plan direct.
  const info = { id: 'earth-hd', urlTemplate: '/relais/{z}/{x}/{y}', plan: '/api/v1/tiles/earth/plan', direct: [{ id: 'ancien', minZoom: 0, maxZoom: 1 }] };
  // Avec la table : le plan direct vient d'elle, avec sa version et l'accord des couleurs.
  const full = withPlan(info, { ...PLAN, colorMatch: false });
  // Ordre des sources et version.
  assert.deepEqual([full.direct.map((s) => s.id), full.planVersion, full.colorMatch], [['ign', 'sentinel2', 'de-by'], 1, false]);
  // Sans table : plus de plan direct, tout passe par le relais.
  assert.equal('direct' in withPlan(info, null), false);
  // Le reste de la description est gardé.
  assert.equal(withPlan(info, null).urlTemplate, '/relais/{z}/{x}/{y}');
// Fin du test.
});

// Test : la carte marine de la table passe dans la description si elle est utilisable.
test('carte marine de la table recopiée dans la description', () => {
  // Carte marine bien formée, comme le serveur la sert.
  const marine = { noaa: { template: '/n', maxZoom: 10 }, gebco: { template: '/g', maxZoom: 10 }, flat: { template: '/f', maxZoom: 10 }, mask: { template: '/t', maxZoom: 10 }, fadeMs: 600, isobaths: { bands: 12, strength: 0.45 } };
  // Recopiée telle quelle.
  assert.deepEqual(withPlan({ id: 'earth-hd' }, { ...PLAN, marine }).marine, marine);
  // Coupée sur le serveur (null) ou mal formée : absente, la description garde ses fonds GEBCO d'avant.
  assert.deepEqual(['marine' in withPlan({ id: 'earth-hd' }, { ...PLAN, marine: null }), 'marine' in withPlan({ id: 'earth-hd' }, { ...PLAN, marine: { ...marine, flat: null } })], [false, false]);
// Fin du test.
});
