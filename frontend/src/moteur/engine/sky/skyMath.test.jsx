// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis skyMath (début de la liste).
import {
  // La liste des objets du ciel profond, la taille d'une étoile dans le catalogue, et les fonctions du voile de jour, du catalogue et des galaxies.
  DEEP_SKY, STAR_RECORD_BYTES, daySkyVeil, decodeStarCatalog, deepSkyBasis, encodeStar,
  // Les conversions de coordonnées, le repère galactique, la visibilité du ciel, l'éblouissement et la couleur selon la température.
  equatorialDegToScene, equatorialToScene, galacticFrame, skyVisibility, sunGlare, temperatureToRgb,
// Fin de la liste : le module skyMath.
} from './skyMath';

// D : nombre de radians dans un degré.
const D = Math.PI / 180;
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// len : longueur d'un vecteur.
const len = (a) => Math.hypot(a[0], a[1], a[2]);
// near : vérifie que deux nombres sont égaux à eps près, avec un message qui donne les deux valeurs.
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg} : ${a} ≠ ${b}`);
// nearVec : même vérification, composante par composante, pour deux vecteurs.
const nearVec = (a, b, eps, msg) => a.forEach((v, i) => near(v, b[i], eps, `${msg}[${i}]`));

// Test : la conversion des coordonnées équatoriales vers la scène.
test('équatorial → scène : point vernal sur +x, pôle de l’écliptique sur +y', () => {
  // Ascension droite 0 et déclinaison 0 : l'axe +x.
  nearVec(equatorialDegToScene(0, 0), [1, 0, 0], 1e-12, 'point vernal');
  // Pôle nord de l'écliptique : AD 18 h, Déc 90° − ε.
  // Ascension droite 270° et déclinaison 90° moins l'obliquité : l'axe +y.
  nearVec(equatorialDegToScene(270, 90 - 23.4392911), [0, 1, 0], 1e-9, 'pôle écliptique');
  // Solstice de juin (λ = 90°) : écliptique (0, 1, 0) → scène (0, 0, −1).
  // Ascension droite 90° et déclinaison égale à l'obliquité : l'axe −z.
  nearVec(equatorialDegToScene(90, 23.4392911), [0, 0, -1], 1e-9, 'solstice');
// Fin du test.
});

// Test : le repère galactique.
test('repère galactique : orthonormé, pôle et centre aux latitudes écliptiques connues', () => {
  // Les trois axes du repère.
  const { x, y, z } = galacticFrame();
  // Chacun est de longueur 1.
  [x, y, z].forEach((v) => near(len(v), 1, 1e-12, 'norme'));
  // x et y sont perpendiculaires.
  near(dot(x, y), 0, 1e-12, 'x·y');
  // y et z sont perpendiculaires.
  near(dot(y, z), 0, 1e-12, 'y·z');
  // x et z sont perpendiculaires.
  near(dot(x, z), 0, 1e-12, 'x·z');
  // Pôle nord galactique : β ≈ +29,81° ; centre galactique : β ≈ −5,54°.
  // Latitude écliptique de l'axe z : 29,81°, à 0,05° près.
  near(Math.asin(z[1]) / D, 29.81, 0.05, 'latitude écliptique du pôle galactique');
  // Latitude écliptique de l'axe x : −5,54°, à 0,05° près.
  near(Math.asin(x[1]) / D, -5.54, 0.05, 'latitude écliptique du centre galactique');
  // Trièdre direct.
  // Le produit vectoriel de x et y vaut z.
  nearVec([x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], z, 1e-12, 'x × y = z');
// Fin du test.
});

// Test : la base locale de chaque objet du ciel profond.
test('galaxies proches : base locale orthonormée centrée sur l’objet', () => {
  // Pour chaque objet (début).
  for (const o of DEEP_SKY) {
    // Sa base : centre, grand axe et petit axe.
    const { center, major, minor } = deepSkyBasis(o.ra, o.dec, o.pa);
    // Le centre est la direction de l'objet.
    nearVec(center, equatorialDegToScene(o.ra, o.dec), 1e-12, `${o.id} centre`);
    // Les trois vecteurs sont de longueur 1.
    [center, major, minor].forEach((v) => near(len(v), 1, 1e-12, `${o.id} norme`));
    // Le centre et le grand axe sont perpendiculaires.
    near(dot(center, major), 0, 1e-12, `${o.id} centre·majeur`);
    // Le centre et le petit axe sont perpendiculaires.
    near(dot(center, minor), 0, 1e-12, `${o.id} centre·mineur`);
    // Le grand axe et le petit axe sont perpendiculaires.
    near(dot(major, minor), 0, 1e-12, `${o.id} majeur·mineur`);
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : la couleur d'une étoile selon sa température.
test('couleur des étoiles : chaudes bleutées, froides orangées, jamais au-delà de 1', () => {
  // Étoile chaude : 25 000 K.
  const hot = temperatureToRgb(25000);
  // Étoile froide : 3200 K.
  const cool = temperatureToRgb(3200);
  // Étoile de type solaire : 5800 K.
  const sun = temperatureToRgb(5800);
  // La chaude a plus de bleu que de rouge.
  assert.ok(hot[2] > hot[0], 'étoile chaude plus bleue que rouge');
  // La froide a plus de rouge que de bleu.
  assert.ok(cool[0] > cool[2], 'étoile froide plus rouge que bleue');
  // Pour les trois couleurs (début).
  for (const c of [hot, cool, sun]) {
    // La plus grande composante vaut 1.
    near(Math.max(...c), 1, 1e-12, 'composante maximale');
    // Toutes les composantes sont entre 0 et 1.
    c.forEach((v) => assert.ok(v >= 0 && v <= 1));
  // Fin de la boucle.
  }
  // La plus petite composante de la couleur solaire dépasse 0,75.
  assert.ok(Math.min(...sun) > 0.75, 'type solaire presque blanc');
// Fin du test.
});

// Test : l'encodage puis le décodage du catalogue d'étoiles.
test('catalogue binaire : aller-retour fidèle (Sirius, Polaris)', () => {
  // Deux étoiles d'essai (début).
  const stars = [
    // Sirius : ascension droite, déclinaison, magnitude −1,46 et 9750 K.
    { ra: (6 + 45 / 60 + 8.9 / 3600) * 15 * D, dec: -(16 + 42 / 60 + 58 / 3600) * D, mag: -1.46, kelvin: 9750 },
    // Polaris : ascension droite, déclinaison, magnitude 2,02 et 6000 K.
    { ra: (2 + 31 / 60 + 48.7 / 3600) * 15 * D, dec: (89 + 15 / 60 + 51 / 3600) * D, mag: 2.02, kelvin: 6000 },
  // Fin des étoiles d'essai.
  ];
  // Tampon binaire de la taille de deux étoiles.
  const buf = new ArrayBuffer(stars.length * STAR_RECORD_BYTES);
  // Vue pour y écrire des nombres.
  const view = new DataView(buf);
  // Encode chaque étoile et écrit ses valeurs sur 16 bits, octet de poids faible en premier.
  stars.forEach((s, i) => encodeStar(s).forEach((v, k) => view.setUint16(i * STAR_RECORD_BYTES + k * 2, v, true)));

  // Décode le tampon.
  const cat = decodeStarCatalog(buf);
  // Le catalogue contient deux étoiles.
  assert.equal(cat.count, 2);
  // Pour chaque étoile (début).
  stars.forEach((s, i) => {
    // Sa position décodée.
    const p = Array.from(cat.positions.slice(i * 3, i * 3 + 3));
    // Écart angulaire < 30″ (résolution de l'encodage 16 bits ≈ 20″).
    // L'angle avec la position d'origine est inférieur à 30 secondes d'arc.
    assert.ok(Math.acos(Math.min(1, dot(p, equatorialToScene(s.ra, s.dec)))) < 30 / 3600 * D, `position ${i}`);
    // La magnitude est retrouvée, à 0,001 près.
    near(cat.mags[i], s.mag, 1e-3, `magnitude ${i}`);
    // La couleur décodée est celle de sa température, à 1e-6 près.
    nearVec(Array.from(cat.colors.slice(i * 3, i * 3 + 3)), temperatureToRgb(s.kelvin), 1e-6, `couleur ${i}`);
  // Fin de la boucle.
  });
// Fin du test.
});

// Test : l'éblouissement par le Soleil.
test('éblouissement : maximal Soleil au centre, nul hors du champ', () => {
  // Demi-diagonale du champ : 30°.
  const half = 30 * D;
  // Soleil au centre de l'écran : 1.
  near(sunGlare(1, half), 1, 1e-12, 'Soleil au centre');
  // Soleil à 90° du centre : 0.
  near(sunGlare(Math.cos(90 * D), half), 0, 1e-12, 'Soleil hors champ');
  // À 20° du centre, l'éblouissement est plus fort qu'à 30°.
  assert.ok(sunGlare(Math.cos(20 * D), half) > sunGlare(Math.cos(30 * D), half), 'décroît en s’éloignant du centre');
  // Un Soleil apparent très gros (vue rapprochée) éblouit même centré hors champ.
  // À 60° du centre mais avec un rayon apparent de 50° : plus de 0,9.
  assert.ok(sunGlare(Math.cos(60 * D), half, 50 * D) > 0.9);
// Fin du test.
});

// Test : le voile du ciel de jour et la visibilité du ciel.
test('ciel de jour : étoiles masquées au sol en plein jour, visibles la nuit et en orbite', () => {
  // Altitude 0 et Soleil au zénith : voile de 1.
  near(daySkyVeil(0, 1), 1, 1e-12, 'midi au sol');
  // Altitude 0 et Soleil à 12° sous l'horizon : voile de 0.
  near(daySkyVeil(0, Math.sin(-12 * D)), 0, 1e-12, 'nuit au sol');
  // Altitude de 400 km : voile inférieur à 1e-20.
  assert.ok(daySkyVeil(400, 1) < 1e-20, 'orbite basse');
  // Avec le voile de midi au sol : visibilité 0.
  near(skyVisibility({ veil: daySkyVeil(0, 1) }), 0, 1e-12, 'jour : ciel invisible');
  // Avec le voile en orbite : visibilité 1.
  near(skyVisibility({ veil: daySkyVeil(400, 1) }), 1, 1e-12, 'orbite : ciel visible');
  // Avec un éblouissement de 1 : visibilité 0,3.
  near(skyVisibility({ glare: 1 }), 0.3, 1e-12, 'Soleil au centre : atténué, pas éteint');
  // Sans argument : visibilité 1.
  near(skyVisibility(), 1, 1e-12, 'par défaut');
// Fin du test.
});
