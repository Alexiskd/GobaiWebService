// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le module de données de l'onglet « Théorie quantique ».
import {
  SYMBOLES, ELEMENTS, SOLARIUM, PROXIMUM, MOLECULE, COUCHES, MASSE_SOLEIL_KG, AUTEUR, NOMBRE_ELEMENTS, position, couchesElectroniques,
  EXCEPTIONS_COUCHES, ORBITES, comparaisonAtomeSysteme, ecartMoyenOrbites, energieNiveau, longueurOnde, nombreQuantique,
  rapportForces, rayonBohr, rayonBohrGravitationnel, rayonCouche, vitesseOrbitale,
} from './theorieQuantique.js';

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
  // Ses propriétés : bien « So » / « Solarium ».
  assert.equal(SOLARIUM.z, 119);
  assert.equal(SOLARIUM.symbole, 'So');
  assert.equal(SOLARIUM.nom, 'Solarium');
  // Le nom est affiché dans la case du tableau théorique.
  assert.ok(SOLARIUM.nom.length > 0);
  // La case affiche les quatre champs demandés : numéro atomique, masse atomique, nom, symbole.
  assert.equal(SOLARIUM.masse, '1,00 M☉');
  assert.ok(SOLARIUM.masseDetail.includes('10³⁰'));
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

// Test : la page « Théorie quantique » est signée par son auteur (même nom que la balise meta author du site).
test('la théorie est signée « Alexis Bouvet-Mallet »', () => {
  // La signature affichée en bas de page.
  assert.equal(AUTEUR, 'Alexis Bouvet-Mallet');
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

// Test : le Proximium est l'élément hypothétique n° 120, symbole « Pr » — retiré du tableau théorique (qui garde le
// Solarium) et présent dans le tableau hypothétique, au rang 1 (Alpha Centauri, Proxima Centauri).
test('le Proximium : Pr, 120, Proxima Centauri du tableau hypothétique', () => {
  // Ses propriétés.
  assert.equal(PROXIMUM.z, 120);
  assert.equal(PROXIMUM.symbole, 'Pr');
  assert.equal(PROXIMUM.nom, 'Proximium');
  assert.equal(PROXIMUM.periode, 3);
  assert.equal(PROXIMUM.groupe, 3);
  // Sa répartition : 119 complété d'un électron sur la couche R (n = 8) → [2, 8, 18, 32, 32, 18, 8, 2].
  assert.deepEqual(PROXIMUM.couches, [2, 8, 18, 32, 32, 18, 8, 2]);
  // Son symbole « Pr » est celui demandé (il reprend celui du praséodyme, 59, dans le tableau réel) et diffère du Solarium.
  assert.notEqual(PROXIMUM.symbole, SOLARIUM.symbole);
  // Le Solarium (119) a lui [2, 8, 18, 32, 32, 18, 8, 1].
  assert.deepEqual(SOLARIUM.couches, [2, 8, 18, 32, 32, 18, 8, 1]);
// Fin du test.
});

// Test : l'assemblage SoaCen (So–aCen) réunit le Solarium et le Proximium ; « Pr » est remplacé par « aCen ».
test('l’assemblage SoaCen = Solarium (119) + aCen (120), symboles So et aCen', () => {
  // Son nom, sa formule et ses symboles affichés.
  assert.equal(MOLECULE.nom, 'SoaCen');
  assert.equal(MOLECULE.formule, 'So–aCen');
  assert.deepEqual(MOLECULE.symboles, ['So', 'aCen']);
  // Aucun « Pr » dans l'assemblage.
  assert.ok(!MOLECULE.nom.includes('Pr') && !MOLECULE.formule.includes('Pr'));
  // Ses deux atomes, dans l'ordre : Solarium puis Proximium.
  assert.deepEqual(MOLECULE.atomes.map((a) => a.z), [SOLARIUM.z, PROXIMUM.z]);
  assert.equal(MOLECULE.atomes[0], SOLARIUM);
  assert.equal(MOLECULE.atomes[1], PROXIMUM);
// Fin du test.
});

// Les éléments à configuration irrégulière portent leur répartition mesurée, et gardent le bon nombre d'électrons.
test('exceptions à Klechkowski : Cr [2, 8, 13, 1], Cu [2, 8, 18, 1], Au [2, 8, 18, 32, 18, 1], 20 éléments en tout', () => {
  assert.deepEqual(couchesElectroniques(24), [2, 8, 13, 1]);
  assert.deepEqual(couchesElectroniques(29), [2, 8, 18, 1]);
  assert.deepEqual(couchesElectroniques(46), [2, 8, 18, 18]);
  assert.deepEqual(couchesElectroniques(79), [2, 8, 18, 32, 18, 1]);
  assert.deepEqual(couchesElectroniques(92), [2, 8, 18, 32, 21, 9, 2]);
  assert.equal(Object.keys(EXCEPTIONS_COUCHES).length, 20);
  for (const [z, couches] of Object.entries(EXCEPTIONS_COUCHES)) assert.equal(couches.reduce((s, n) => s + n, 0), Number(z), z);
  // La table n'est pas exposée : modifier le résultat ne la change pas.
  couchesElectroniques(24).push(99);
  assert.deepEqual(couchesElectroniques(24), [2, 8, 13, 1]);
});

// Les grandeurs du modèle de Bohr, calculées à partir des constantes.
test('Bohr : a₀ ≈ 5,2918 × 10⁻¹¹ m, E₁ ≈ −13,606 eV, r_n = n² a₀, E_n = E₁ / n²', () => {
  assert.ok(Math.abs(rayonBohr() / 5.29177e-11 - 1) < 1e-5, rayonBohr());
  assert.ok(Math.abs(energieNiveau(1) + 13.6057) < 1e-3, energieNiveau(1));
  assert.ok(Math.abs(rayonCouche(3) / rayonBohr() - 9) < 1e-12);
  assert.ok(Math.abs(energieNiveau(2) / energieNiveau(1) - 0.25) < 1e-12);
});

// La force électrique domine la gravité de 39 ordres de grandeur entre un proton et un électron.
test('rapport force électrique / gravité ≈ 2,27 × 10³⁹', () => {
  assert.ok(rapportForces() > 2.26e39 && rapportForces() < 2.28e39, rapportForces());
});

// Les demi-grands axes viennent du catalogue du moteur ; la loi en n² est comparée au réel.
test('orbites : demi-grands axes du catalogue, loi en n² confrontée au réel', () => {
  assert.equal(ORBITES.length, 8);
  assert.ok(Math.abs(ORBITES[2].ua - 1) < 0.001, ORBITES[2].ua);
  assert.ok(Math.abs(ORBITES[7].ua - 30.07) < 0.01, ORBITES[7].ua);
  assert.deepEqual(ORBITES.map((o) => o.predit), [1, 4, 9, 16, 25, 36, 49, 64]);
  assert.equal(ORBITES[0].ecart, 0);
  // Uranus tombe juste (≈ +1 %), la Terre est à −71 % de la prédiction.
  assert.ok(Math.abs(ORBITES[6].ecart) < 3, ORBITES[6].ecart);
  assert.ok(ORBITES[2].ecart < -65 && ORBITES[2].ecart > -75, ORBITES[2].ecart);
  assert.ok(ecartMoyenOrbites() > 35 && ecartMoyenOrbites() < 50, ecartMoyenOrbites());
  for (let i = 1; i < 8; i += 1) assert.ok(ORBITES[i].a > ORBITES[i - 1].a && ORBITES[i].vitesse < ORBITES[i - 1].vitesse);
});

// La Terre : 29,8 km/s, longueur d'onde ~10⁻⁶³ m, nombre quantique ~10⁷⁴ — un objet classique.
test('la Terre est classique : v ≈ 29,8 km/s, λ ≈ 3,7 × 10⁻⁶³ m, n ≈ 2,5 × 10⁷⁴', () => {
  const terre = ORBITES[2];
  assert.ok(Math.abs(vitesseOrbitale(terre.a) - 29785) < 30, terre.vitesse);
  assert.ok(terre.lambda > 3.6e-63 && terre.lambda < 3.8e-63, terre.lambda);
  assert.ok(terre.nQuantique > 2.4e74 && terre.nQuantique < 2.6e74, terre.nQuantique);
  assert.equal(longueurOnde(terre.masse, terre.a), terre.lambda);
  // Cohérence : l'orbite réelle vaut n² fois le rayon de Bohr gravitationnel.
  assert.ok(Math.abs((nombreQuantique(terre.masse, terre.a) ** 2 * rayonBohrGravitationnel(terre.masse)) / terre.a - 1) < 1e-9);
});

// La comparaison atome / système solaire : presque vides, presque toute la masse au centre.
test('comparaison : noyau ≈ 1,6 × 10⁻⁵ de l’atome, Soleil ≈ 1,5 × 10⁻⁴ du système, masse centrale > 99,8 %', () => {
  const [vide, masse, taille, voisin] = comparaisonAtomeSysteme();
  assert.ok(vide.atome > 1.5e-5 && vide.atome < 1.7e-5, vide.atome);
  assert.ok(vide.systeme > 1.5e-4 && vide.systeme < 1.6e-4, vide.systeme);
  assert.ok(masse.atome > 0.9994 && masse.atome < 0.9995);
  assert.ok(masse.systeme > 0.9986 && masse.systeme < 0.9987, masse.systeme);
  assert.ok(taille.rapport > 1e21 && taille.rapport < 1.2e21);
  assert.ok(voisin.atome > 1.3 && voisin.atome < 1.5 && voisin.systeme > 8000 && voisin.systeme < 10000);
  for (const l of [vide, masse, taille, voisin]) assert.ok(Math.abs(l.rapport - l.systeme / l.atome) < 1e-9 * l.rapport);
});
