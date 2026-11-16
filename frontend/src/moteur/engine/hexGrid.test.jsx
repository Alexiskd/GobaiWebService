// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la construction du découpage, la cellule d'un point, le tracé des limites et la latitude des pentagones.
import { buildHexGrid, cellOf, hexGridSegments, ICOSA_RING_LAT } from './hexGrid';

// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// norm : vecteur rendu unitaire.
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };

// Générateur pseudo-aléatoire fixe : les mêmes points à chaque passage.
// rng : générateur pseudo-aléatoire à partir d'une graine (début).
function rng(seed) {
  // État du générateur.
  let s = seed;
  // Renvoie une fonction qui fait avancer l'état (générateur congruentiel) et donne un nombre entre 0 et 1.
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
// Fin de rng.
}
// randomPoints : n points de la sphère, graine 7 par défaut (début).
function randomPoints(n, seed = 7) {
  // Générateur pour cette graine.
  const r = rng(seed);
  // n vecteurs aléatoires rendus unitaires.
  return Array.from({ length: n }, () => norm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]));
// Fin de randomPoints.
}

/** Aire d'un polygone sphérique (rayon 1) découpé en triangles autour de `center` (formule de l'angle solide). */
// fanArea : aire d'un polygone sphérique à partir de son centre et de son contour (début).
function fanArea(center, ring) {
  // Aire : 0 au départ.
  let area = 0;
  // Pour chaque côté du contour (début).
  for (let i = 0; i < ring.length; i++) {
    // Triangle : le centre et les deux bouts du côté.
    const a = center, b = ring[i], c = ring[(i + 1) % ring.length];
    // Ajoute l'angle solide de ce triangle.
    area += Math.abs(2 * Math.atan2(dot(a, cross(b, c)), 1 + dot(a, b) + dot(b, c) + dot(c, a)));
  // Fin de la boucle.
  }
  // Renvoie l'aire.
  return area;
// Fin de fanArea.
}

// Pour quatre finesses de découpage : 1, 2, 3 et 8 (début).
for (const f of [1, 2, 3, 8]) {
  // Test : le nombre de cellules et de pentagones à cette finesse.
  test(`découpage f = ${f} : 10·f² + 2 cellules, 12 pentagones, un à chaque pôle`, () => {
    // Découpage à cette finesse.
    const grid = buildHexGrid(f);
    // Nombre de cellules : 10·f² + 2.
    assert.equal(grid.cells.length, 10 * f * f + 2);
    // Les cellules pentagonales.
    const pentagons = grid.cells.filter((c) => c.pentagon);
    // Il y en a douze.
    assert.equal(pentagons.length, 12);
    // Chaque cellule a cinq coins si c'est un pentagone, six sinon.
    for (const c of grid.cells) assert.equal(c.corners.length, c.pentagon ? 5 : 6);
    // Pôle nord et pôle sud : chacun au centre exact d'un pentagone.
    // Pour le pôle nord puis le pôle sud (début).
    for (const pole of [[0, 1, 0], [0, -1, 0]]) {
      // Cellule qui contient le pôle.
      const cell = grid.cells[cellOf(grid, pole)];
      // C'est un pentagone.
      assert.equal(cell.pentagon, true);
      // Son centre est le pôle, à 1e-12 près.
      assert.ok(Math.abs(dot(cell.center, pole) - 1) < 1e-12);
    // Fin de la boucle des pôles.
    }
    // Les dix autres pentagones : à ± 26,57° de latitude.
    // Les pentagones qui ne sont pas aux pôles.
    const others = pentagons.filter((c) => Math.abs(c.center[1]) < 0.99);
    // Il y en a dix.
    assert.equal(others.length, 10);
    // Leur latitude, en valeur absolue, vaut ICOSA_RING_LAT, à 1e-9 degré près.
    for (const c of others) assert.ok(Math.abs(Math.abs(Math.asin(c.center[1])) * 180 / Math.PI - ICOSA_RING_LAT) < 1e-9);
    // Limites : 30·f² entre deux cellules.
    // Nombre de limites : 30·f².
    assert.equal(grid.edges.length, 30 * f * f);
  // Fin du test.
  });
// Fin de la boucle des finesses.
}

// Test : la couverture de la sphère.
test('découpage : les cellules couvrent toute la sphère, sans trou ni recouvrement', () => {
  // Découpage de finesse 6.
  const grid = buildHexGrid(6);
  // Chaque coin est partagé par exactement trois cellules.
  // Compteur d'utilisations de chaque coin.
  const uses = new Map();
  // Pour chaque coin de chaque cellule (début).
  for (const c of grid.cells) for (const k of c.corners) {
    // Clé du coin : ses coordonnées arrondies au millionième.
    const key = k.map((v) => Math.round(v * 1e6)).join(',');
    // Une utilisation de plus.
    uses.set(key, (uses.get(key) || 0) + 1);
  // Fin de la boucle.
  }
  // Chaque coin est utilisé trois fois.
  for (const n of uses.values()) assert.equal(n, 3);
  // Nombre de coins : 20 × 6 × 6.
  assert.equal(uses.size, 20 * 6 * 6);
  // La somme des aires vaut 4π (limites tracées par le milieu, comme le découpage réel).
  // Table des milieux des limites, par paire de coins.
  const mids = new Map();
  // ck : clé d'un point, coordonnées arrondies au millionième.
  const ck = (p) => p.map((v) => Math.round(v * 1e6)).join(',');
  // Range le milieu de chaque limite dans les deux sens.
  for (const [c1, mid, c2] of grid.edges) { mids.set(`${ck(c1)}|${ck(c2)}`, mid); mids.set(`${ck(c2)}|${ck(c1)}`, mid); }
  // Aire totale : 0 au départ.
  let total = 0;
  // Pour chaque cellule (début).
  for (const c of grid.cells) {
    // Contour de la cellule.
    const ring = [];
    // Ajoute chaque coin, suivi du milieu de la limite qui le relie au coin suivant.
    c.corners.forEach((k, i) => { ring.push(k, mids.get(`${ck(k)}|${ck(c.corners[(i + 1) % c.corners.length])}`)); });
    // Tous les milieux ont été trouvés.
    assert.ok(ring.every(Boolean), 'deux coins voisins sont reliés par une limite');
    // Ajoute l'aire de la cellule.
    total += fanArea(c.center, ring);
  // Fin de la boucle.
  }
  // L'aire totale vaut 4π, à 1e-9 près.
  assert.ok(Math.abs(total - 4 * Math.PI) < 1e-9, `aire totale ${total}`);
// Fin du test.
});

// Test : la recherche de la cellule d'un point.
test('cellule d’un point : son centre est bien une cellule, et le point est dans le polygone de ses coins', () => {
  // Découpage de finesse 8.
  const grid = buildHexGrid(8);
  // Le centre de chaque cellule est trouvé dans cette cellule.
  for (const c of grid.cells) assert.equal(cellOf(grid, c.center), c.id);
  // Pour 4000 points aléatoires (début).
  for (const p of randomPoints(4000)) {
    // Cellule du point.
    const id = cellOf(grid, p);
    // Une cellule est trouvée.
    assert.notEqual(id, undefined);
    // Cette cellule.
    const cell = grid.cells[id];
    // Du même côté de chaque limite que le centre (tolérance : limites légèrement brisées entre deux faces).
    // Pour chaque côté de la cellule (début).
    for (let i = 0; i < cell.corners.length; i++) {
      // Les deux coins du côté.
      const a = cell.corners[i], b = cell.corners[(i + 1) % cell.corners.length];
      // Normale du plan qui contient ce côté et le centre de la sphère.
      const n = cross(a, b);
      // Le point est du même côté de ce plan que le centre de la cellule, à 2e-3 près.
      assert.ok(dot(n, p) * Math.sign(dot(n, cell.center)) > -2e-3, `point hors de sa cellule ${id}`);
    // Fin de la boucle des côtés.
    }
  // Fin de la boucle des points.
  }
// Fin du test.
});

// Test : le tracé des limites en segments.
test('tracé : segments sur la sphère, deux arcs par limite, pas de segment plus long que le pas', () => {
  // Découpage de finesse 4.
  const grid = buildHexGrid(4);
  // Segments du tracé, avec un pas de 0,5°.
  const seg = hexGridSegments(grid, 0.5);
  // Six nombres par segment.
  assert.equal(seg.length % 6, 0);
  // Au moins deux segments par limite.
  assert.ok(seg.length / 6 >= grid.edges.length * 2);
  // Pour chaque segment (début).
  for (let i = 0; i < seg.length; i += 6) {
    // Ses deux extrémités.
    const p = [seg[i], seg[i + 1], seg[i + 2]], q = [seg[i + 3], seg[i + 4], seg[i + 5]];
    // Elles sont sur la sphère, à 1e-6 près.
    assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-6 && Math.abs(Math.hypot(...q) - 1) < 1e-6);
    // L'angle entre elles ne dépasse pas le pas.
    assert.ok(Math.acos(Math.min(1, dot(p, q))) <= 0.5 * Math.PI / 180 + 1e-4);
  // Fin de la boucle.
  }
// Fin du test.
});
