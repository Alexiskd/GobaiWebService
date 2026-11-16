// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les six fonctions testées des satellites.
import { eclipticKmToScene, fallbackRelKm, orbitBasis, relDistanceKm, satelliteState, synchronousBasis } from './satelliteMath';

// Satellite d'essai : Io, avec son demi-grand axe en kilomètres et sa période en jours.
const IO = { id: 'io', aKm: 421700, periodDays: 1.769138 };
// near : vérifie que deux nombres sont égaux à eps près, avec un message qui donne les deux valeurs.
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg} : ${a} ≠ ${b}`);
// dot : produit scalaire de deux vecteurs à trois composantes.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// len : longueur d'un vecteur.
const len = (a) => Math.hypot(...a);

// Test : le passage du repère écliptique (km) au repère de la scène (rayons terrestres).
test('écliptique (km) → scène : (x, y, z) → (x, z, −y) en rayons terrestres', () => {
  // same : compare un vecteur obtenu au vecteur attendu, composante par composante, à 1e-12 près.
  const same = (got, want) => want.forEach((v, i) => near(got[i], v, 1e-12, `composante ${i}`));
  // 6371 km sur x : 1 sur le premier axe de la scène.
  same(eclipticKmToScene({ x: 6371, y: 0, z: 0 }), [1, 0, 0]);
  // 6371 km sur y : −1 sur le troisième axe de la scène.
  same(eclipticKmToScene({ x: 0, y: 6371, z: 0 }), [0, 0, -1]);
  // 6371 km sur z : 1 sur le deuxième axe de la scène.
  same(eclipticKmToScene({ x: 0, y: 0, z: 6371 }), [0, 1, 0]);
// Fin du test.
});

// Test : l'orbite circulaire de repli.
test('orbite de repli : rayon constant, une période ramène au même point', () => {
  // Instant d'essai : le 9 novembre 2026 à 0 h UTC (les mois sont comptés depuis 0).
  const t = Date.UTC(2026, 10, 9);
  // Position d'Io à cet instant.
  const a = fallbackRelKm(IO, t);
  // Position d'Io une période plus tard (864e5 millisecondes par jour).
  const b = fallbackRelKm(IO, t + IO.periodDays * 864e5);
  // La distance au centre vaut le demi-grand axe, à 1e-6 km près.
  near(Math.hypot(a.x, a.y, a.z), IO.aKm, 1e-6, 'rayon');
  // Même x après une période, à 1e-3 km près.
  near(a.x, b.x, 1e-3, 'x');
  // Même y après une période, à 1e-3 km près.
  near(a.y, b.y, 1e-3, 'y');
// Fin du test.
});

// Test : l'orbite de repli avec un pôle de planète donné.
test('orbite de repli dans le plan équatorial de la planète', () => {
  // Pôle d'essai, unitaire : (0, 0,6, 0,8).
  const pole = [0, 0.6, 0.8];
  // Pour trois instants (début de la boucle).
  for (const t of [0, 1e7, 5e7]) {
    // Position de repli dans la scène, à partir du 1er janvier 2026 décalé de t millisecondes, avec ce pôle.
    const r = eclipticKmToScene(fallbackRelKm(IO, Date.UTC(2026, 0, 1) + t, pole));
    // Elle est perpendiculaire au pôle : produit scalaire nul, à 1e-9 près.
    near(dot(r, pole) / len(r), 0, 1e-9, 'perpendiculaire au pôle');
    // Sa distance vaut le demi-grand axe, à 1e-3 km près.
    near(relDistanceKm(r), IO.aKm, 1e-3, 'rayon');
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : le choix entre la table Horizons et le repli.
test('état : table Horizons utilisée quand elle couvre l’instant, sinon repli', () => {
  // Instant de départ de la table : le 9 novembre 2026 à 0 h UTC.
  const t0 = Date.UTC(2026, 10, 9);
  // Vitesse angulaire d'Io, en radians par milliseconde.
  const w = (2 * Math.PI) / (IO.periodDays * 864e5);
  // Table d'essai de douze points (début).
  const points = Array.from({ length: 12 }, (_, i) => {
    // Instant du point : un toutes les vingt minutes.
    const t = t0 + i * 20 * 60_000;
    // Le point : sur un cercle du rayon d'Io, à 1000 km au-dessus du plan.
    return { t, x: IO.aKm * Math.cos(w * t), y: IO.aKm * Math.sin(w * t), z: 1000 };
  // Fin de la table.
  });
  // État demandé 67 minutes après le départ, entre deux points de la table.
  const st = satelliteState(IO, points, t0 + 3 * 20 * 60_000 + 7 * 60_000);
  // La table couvre cet instant : exact vaut vrai.
  assert.equal(st.exact, true);
  // La distance interpolée vaut celle des points de la table, à 5 km près.
  near(relDistanceKm(st.rel), Math.hypot(IO.aKm, 1000), 5, 'distance interpolée');
  // Vitesse ≈ 2πa/P (≈ 17,3 km/s pour Io), en rayons terrestres par seconde.
  // La longueur de la vitesse, reconvertie en km/s, vaut 2πa/P, à 0,05 km/s près.
  near(len(st.vel) * 6371, (2 * Math.PI * IO.aKm) / (IO.periodDays * 86400), 0.05, 'vitesse');
  // État demandé dix jours après le départ, hors de la table.
  const out = satelliteState(IO, points, t0 + 10 * 864e5);
  // exact vaut faux.
  assert.equal(out.exact, false);
  // La distance est celle de l'orbite de repli, à 1e-3 km près.
  near(relDistanceKm(out.rel), IO.aKm, 1e-3, 'repli');
// Fin du test.
});

// Test : le repère d'un satellite en rotation synchrone.
test('rotation synchrone : x vers la planète, y normale de l’orbite, z dans le sens du mouvement', () => {
  // Position relative d'essai : 10 sur x.
  const rel = [10, 0, 0];
  // Vitesse d'essai : −1 sur z.
  const vel = [0, 0, -1]; // mouvement vers −z, orbite dans le plan xz
  // Les trois axes du repère.
  const { x, y, z } = synchronousBasis(rel, vel);
  // L'axe x pointe vers −x, donc vers la planète.
  near(x[0], -1, 1e-12, 'x vers la planète');
  // Les trois axes sont de longueur 1, à 1e-12 près.
  [x, y, z].forEach((v) => near(len(v), 1, 1e-12, 'norme'));
  // x et y sont perpendiculaires.
  near(dot(x, y), 0, 1e-12, 'x·y');
  // y et z sont perpendiculaires.
  near(dot(y, z), 0, 1e-12, 'y·z');
  // z est aligné avec la vitesse.
  near(dot(z, vel) / len(vel), 1, 1e-12, 'z suit le mouvement (hémisphère avant à 90° O)');
  // Le pôle est perpendiculaire au plan de l'orbite.
  // L'axe y est porté par le deuxième axe de la scène, dans un sens ou dans l'autre.
  near(Math.abs(y[1]), 1, 1e-12, 'pôle');
// Fin du test.
});

// Test : le repère du cercle d'orbite.
test('repère de l’orbite : le cercle unité passe par le satellite', () => {
  // Position relative d'essai : (3, 4, 0).
  const rel = [3, 4, 0];
  // Les axes x et y du repère, pour une vitesse sur z.
  const { x, y } = orbitBasis(rel, [0, 0, 1]);
  // x est aligné avec la position du satellite.
  near(dot(x, rel) / len(rel), 1, 1e-12, 'x vers le satellite');
  // y est perpendiculaire à la position du satellite.
  near(dot(y, rel), 0, 1e-12, 'normale ⟂ satellite');
// Fin du test.
});
