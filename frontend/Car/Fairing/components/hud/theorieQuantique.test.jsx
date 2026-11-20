// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le module de données de l'onglet « Théorie quantique ».
import { SYMBOLES, ELEMENTS, SOLARIUM, PROXIMUM, MOLECULE, COUCHES, MASSE_SOLEIL_KG, NOMBRE_ELEMENTS, position, couchesElectroniques } from './theorieQuantique.js';

// Test : le tableau périodique contient bien les 118 éléments connus.
test('118 symboles, du hydrogène (1) à l’oganesson (118)', () => {
  // Le nombre d'éléments est 118.
  assert.equal(NOMBRE_ELEMENTS, 118);
  // Autant de symboles que d'éléments.
  assert.equal(SYMBOLES.length, 118);
  // Le premier est H, le dernier Og.
  assert.equal(SYMBOLES[0], 'H');
  assert.equal(SYMBOLES[117], 'Og');
// Fin du test.
});

// Test : chaque élément a un numéro atomique unique, de 1 à 118, et un symbole unique.
test('numéros atomiques et symboles tous distincts', () => {
  // Les numéros sont 1 à 118 dans l'ordre.
  assert.deepEqual(ELEMENTS.map((e) => e.z), Array.from({ length: 118 }, (_, i) => i + 1));
  // Aucun symbole en double.
  assert.equal(new Set(ELEMENTS.map((e) => e.symbole)).size, 118);
// Fin du test.
});

// Test : les positions des cas particuliers du dessin sont justes.
test('positions : H en (1,1), He en (1,18), Og en (7,18), lanthanides et actinides en bloc f', () => {
  // H : période 1, groupe 1.
  assert.deepEqual(position(1), { periode: 1, groupe: 1 });
  // He : période 1, groupe 18.
  assert.deepEqual(position(2), { periode: 1, groupe: 18 });
  // Oganesson : période 7, groupe 18.
  assert.deepEqual(position(118), { periode: 7, groupe: 18 });
  // Lanthane (57) : première case du bloc f, ligne 9.
  assert.deepEqual(position(57), { blocF: 9, colonneF: 1 });
  // Lutétium (71) : dernière case des lanthanides.
  assert.deepEqual(position(71), { blocF: 9, colonneF: 15 });
  // Actinium (89) : première case de la ligne 10.
  assert.deepEqual(position(89), { blocF: 10, colonneF: 1 });
  // Hafnium (72) : retour au bloc principal, groupe 4.
  assert.deepEqual(position(72), { periode: 6, groupe: 4 });
// Fin du test.
});

// Test : le Solarium est l'élément hypothétique n° 119, symbole « So », période 8, groupe 1.
test('le Solarium ajouté au tableau : So, 119, période 8, groupe 1', () => {
  // Ses propriétés.
  assert.equal(SOLARIUM.z, 119);
  assert.equal(SOLARIUM.symbole, 'So');
  assert.equal(SOLARIUM.nom, 'Solarium');
  assert.equal(SOLARIUM.periode, 8);
  assert.equal(SOLARIUM.groupe, 1);
  // Son symbole ne collisionne avec aucun des 118 symboles connus.
  assert.ok(!SYMBOLES.includes(SOLARIUM.symbole));
// Fin du test.
});

// Test : les huit couches K à R correspondent aux huit planètes, de Mercure à Neptune, avec 2n² comme capacité.
test('couches atomiques K à R = orbites de Mercure à Neptune, capacité 2n²', () => {
  // Huit couches.
  assert.equal(COUCHES.length, 8);
  // Les lettres K à R et n de 1 à 8.
  assert.deepEqual(COUCHES.map((c) => c.couche), ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R']);
  assert.deepEqual(COUCHES.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  // Les planètes dans l'ordre, de la plus proche à la plus lointaine.
  assert.deepEqual(COUCHES.map((c) => c.planete), ['Mercure', 'Vénus', 'Terre', 'Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune']);
  // Chaque capacité vaut 2n².
  for (const c of COUCHES) assert.equal(c.capacite, 2 * c.n * c.n);
// Fin du test.
});

// Test : la masse du Soleil est bien de l'ordre de 10^30 kg.
test('la masse du Soleil est d’environ 2 × 10^30 kg', () => {
  // Entre 1 et 3 × 10^30 kg.
  assert.ok(MASSE_SOLEIL_KG >= 1e30 && MASSE_SOLEIL_KG < 3e30);
// Fin du test.
});

// Test : la répartition des électrons par couche atomique (K, L, M…) suit l'ordre de remplissage.
test('couches électroniques : H [1], Fe [2, 8, 14, 2], Og [2, 8, 18, 32, 32, 18, 8]', () => {
  // Hydrogène : un électron sur K.
  assert.deepEqual(couchesElectroniques(1), [1]);
  // Hélium : K pleine.
  assert.deepEqual(couchesElectroniques(2), [2]);
  // Fer (26) : 2, 8, 14, 2 (le 4s se remplit avant le 3d).
  assert.deepEqual(couchesElectroniques(26), [2, 8, 14, 2]);
  // Oganesson (118) : les sept couches complètes.
  assert.deepEqual(couchesElectroniques(118), [2, 8, 18, 32, 32, 18, 8]);
  // Chaque élément du tableau porte sa répartition, dont la somme fait z.
  for (const e of ELEMENTS) assert.equal(e.couches.reduce((s, n) => s + n, 0), e.z);
// Fin du test.
});

// Test : le Proximium est l'élément hypothétique n° 120, symbole « Px », placé en n = 3 (période 3, groupe 3).
test('le Proximium ajouté au tableau : Px, 120, n = 3 (période 3, groupe 3)', () => {
  // Ses propriétés.
  assert.equal(PROXIMUM.z, 120);
  assert.equal(PROXIMUM.symbole, 'Px');
  assert.equal(PROXIMUM.nom, 'Proximium');
  assert.equal(PROXIMUM.periode, 3);
  assert.equal(PROXIMUM.groupe, 3);
  // Sa répartition : 119 complété d'un électron sur la couche R (n = 8) → [2, 8, 18, 32, 32, 18, 8, 2].
  assert.deepEqual(PROXIMUM.couches, [2, 8, 18, 32, 32, 18, 8, 2]);
  // Son symbole ne collisionne avec aucun des 118 symboles connus ni avec le Solarium.
  assert.ok(!SYMBOLES.includes(PROXIMUM.symbole) && PROXIMUM.symbole !== SOLARIUM.symbole);
  // Le Solarium (119) a lui [2, 8, 18, 32, 32, 18, 8, 1].
  assert.deepEqual(SOLARIUM.couches, [2, 8, 18, 32, 32, 18, 8, 1]);
// Fin du test.
});

// Test : la molécule SoPr réunit le Solarium et le Proximium.
test('la molécule SoPr = Solarium (119) + Proximium (120)', () => {
  // Son nom et sa formule.
  assert.equal(MOLECULE.nom, 'SoPr');
  assert.equal(MOLECULE.formule, 'So–Px');
  // Ses deux atomes, dans l'ordre : Solarium puis Proximium.
  assert.deepEqual(MOLECULE.atomes.map((a) => a.z), [SOLARIUM.z, PROXIMUM.z]);
  assert.equal(MOLECULE.atomes[0], SOLARIUM);
  assert.equal(MOLECULE.atomes[1], PROXIMUM);
// Fin du test.
});
