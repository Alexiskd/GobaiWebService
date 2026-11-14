// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les tables et les fonctions testées des atmosphères.
import { ATMOSPHERES, ATMOSPHERE_THICKNESS, atmosphereThickness, cloudRadiusFactor, scatterParams, underCloudFloorRadii, simCloudFade } from './atmosphereData';

// Test : la liste des astres dont l'atmosphère est modélisée.
test('atmosphères : Vénus, la Terre et Mars sont modélisées, pas Mercure ni la Lune', () => {
  // Les clés de la table, triées : earth, mars, venus.
  assert.deepEqual(Object.keys(ATMOSPHERES).sort(), ['earth', 'mars', 'venus']);
  // Mercure : pas de paramètres de diffusion.
  assert.equal(scatterParams('mercury'), null);
  // La Lune : pas de paramètres de diffusion.
  assert.equal(scatterParams('moon'), null);
// Fin du test.
});

// Test : l'atmosphère de Vénus.
test('atmosphère de Vénus : nuages à 70 km, diffusion au-dessus des nuages seulement', () => {
  // Facteur de rayon de la couche de nuages de Vénus.
  const f = cloudRadiusFactor('venus');
  // Il vaut 1 + 70 / 6051,8, à 1e-12 près.
  assert.ok(Math.abs(f - (1 + 70 / 6051.8)) < 1e-12);
  // Paramètres de diffusion de Vénus.
  const p = scatterParams('venus');
  // Leur sol est ce facteur : le sommet des nuages.
  assert.equal(p.ground, f);
  // Le sommet de l'atmosphère est au-dessus de ce sol.
  assert.ok(p.top > p.ground);
  // Mars : pas de facteur de nuages.
  assert.equal(cloudRadiusFactor('mars'), null); // Mars et la Terre : pas de couche opaque, le sol reste visible
  // La Terre : pas de facteur de nuages.
  assert.equal(cloudRadiusFactor('earth'), null);
// Fin du test.
});

// Test : l'atmosphère de la Terre.
test('atmosphère de la Terre : paramètres en rayons terrestres', () => {
  // Paramètres de diffusion de la Terre.
  const p = scatterParams('earth');
  // Sol : 1 rayon.
  assert.equal(p.ground, 1);
  // Sommet : 1 + 100 / 6371, à 1e-12 près.
  assert.ok(Math.abs(p.top - (1 + 100 / 6371)) < 1e-12);
  // Hauteur d'échelle de Rayleigh : 8 / 6371, à 1e-12 près.
  assert.ok(Math.abs(p.hR - 8 / 6371) < 1e-12);
  // Troisième coefficient de Rayleigh (bleu) : 33,1e-6 × 6 371 000, à 1e-9 près.
  assert.ok(Math.abs(p.betaR[2] - 33.1e-6 * 6371000) < 1e-9);
  // Les coefficients de Rayleigh croissent du premier au troisième.
  assert.ok(p.betaR[2] > p.betaR[1] && p.betaR[1] > p.betaR[0]); // le bleu diffuse le plus : ciel bleu
// Fin du test.
});

// Test : l'atmosphère de Mars.
test('atmosphère de Mars : la poussière domine et absorbe le bleu', () => {
  // Paramètres de diffusion de Mars.
  const p = scatterParams('mars');
  // Le rapport betaE / betaM est plus grand pour la troisième composante (bleu) que pour la première.
  assert.ok(p.betaE[2] / p.betaM[2] > p.betaE[0] / p.betaM[0]); // le bleu est le plus absorbé
  // Le premier coefficient de Mie dépasse 50 fois celui de Rayleigh.
  assert.ok(p.betaM[0] > 50 * p.betaR[0]);
// Fin du test.
});

// Test : le fondu des nuages simulés.
test('nuages simulés de la Terre : effacés près du sol, entiers vus de loin, absents ailleurs', () => {
  // Terre, altitude de 100 km : 0.
  assert.equal(simCloudFade('earth', 100), 0);
  // Terre, altitude de 600 km : 0.
  assert.equal(simCloudFade('earth', 600), 0);
  // Terre, altitude de 3000 km : 1.
  assert.equal(simCloudFade('earth', 3000), 1);
  // Terre, altitude de 40000 km : 1.
  assert.equal(simCloudFade('earth', 40000), 1);
  // Terre, altitude de 1800 km : fondu intermédiaire.
  const mid = simCloudFade('earth', 1800);
  // Il est compris entre 0,4 et 0,6.
  assert.ok(mid > 0.4 && mid < 0.6);
  // Mars, altitude de 40000 km : 0.
  assert.equal(simCloudFade('mars', 40000), 0);
// Fin du test.
});

// Test : la table des épaisseurs d'atmosphère.
test('épaisseur de l’atmosphère : renseignée pour les huit planètes et Pluton', () => {
  // Ses clés triées : les huit planètes et Pluton.
  assert.deepEqual(Object.keys(ATMOSPHERE_THICKNESS).sort(), ['earth', 'jupiter', 'mars', 'mercury', 'neptune', 'pluto', 'saturn', 'uranus', 'venus']);
  // Pour chaque entrée de la table (début de la boucle).
  for (const [id, a] of Object.entries(ATMOSPHERE_THICKNESS)) {
    // L'épaisseur en kilomètres est un nombre fini, positif ou nul.
    assert.ok(Number.isFinite(a.km) && a.km >= 0, id);
    // Une note est renseignée.
    assert.ok(a.note, id);
  // Fin de la boucle.
  }
  // Mercure : 0 km.
  assert.equal(atmosphereThickness('mercury').km, 0); // simple exosphère
  // Uranus : la valeur est marquée comme un maximum.
  assert.equal(atmosphereThickness('uranus').max, true); // borne supérieure
  // La Lune : null.
  assert.equal(atmosphereThickness('moon'), null);
  // L'exobase se trouve au-dessus du sommet retenu pour dessiner la diffusion de la lumière.
  // Pour chaque atmosphère modélisée : l'épaisseur est au moins égale au sommet retenu pour la diffusion.
  for (const id of Object.keys(ATMOSPHERES)) assert.ok(atmosphereThickness(id).km >= ATMOSPHERES[id].topKm, id);
// Fin du test.
});

// Test : le plancher sous les nuages.
test('sous les nuages sans carte : plancher entre le sol et le sommet des nuages, seulement pour Vénus', () => {
  // Plancher de Vénus, en rayons.
  const floor = underCloudFloorRadii('venus');
  // Il dépasse 20 / 6051,8.
  assert.ok(floor > 20 / 6051.8, 'au-dessus des facettes du globe simple');
  // 1 + plancher reste inférieur au facteur de rayon des nuages.
  assert.ok(1 + floor < cloudRadiusFactor('venus'), 'sous le sommet des nuages');
  // La Terre : null.
  assert.equal(underCloudFloorRadii('earth'), null);
  // Mars : null.
  assert.equal(underCloudFloorRadii('mars'), null);
  // Un astre inconnu : null.
  assert.equal(underCloudFloorRadii('inconnu'), null);
// Fin du test.
});
