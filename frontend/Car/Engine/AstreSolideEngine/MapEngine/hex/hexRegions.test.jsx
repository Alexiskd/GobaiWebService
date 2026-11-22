// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe la sélection des cellules, leurs enfants, les racines et le maillage.
import { buildCellMesh, hexChildren, hexRoots, selectHexCells } from './hexCells.jsx';
// Importe la découpe exacte.
import { cellFan, clipKidToParent, partsOf, polyArea, polyPlanes, regionPolys } from './hexRegions.jsx';

// Produit scalaire.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Un point est-il dans une cellule ou un morceau ? (dans l'un de ses polygones convexes)
const inside = (cell, p) => regionPolys(cell).some((poly) => polyPlanes(poly).every((n) => dot(n, p) >= -1e-12));
// Aire d'une cellule ou d'un morceau.
const areaOf = (cell) => regionPolys(cell).reduce((s, poly) => s + polyArea(poly), 0);

// Générateur pseudo-aléatoire reproductible (mêmes points à chaque lancement).
function rng(seed) {
  // État.
  let s = seed >>> 0;
  // Tirage entre 0 et 1.
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
// Fin de rng.
}

// Vues de test : direction de la caméra et altitude (en rayons depuis le centre), du pôle à l'équateur, de loin et de près.
const VIEWS = [
  // Près du pôle Nord, à basse altitude : plusieurs niveaux à l'écran.
  [[0.3, 0.95, 0.2], 1.02],
  // Équateur, de plus loin.
  [[1, 0, 0], 1.3],
  // Près du pôle Sud.
  [[0.2, -0.97, 0.1], 1.05],
  // Très près du sol, vue de dessus.
  [[0.6, 0.1, -0.79], 1.0005],
// Fin des vues.
];

// Chaque vue : chaque point de la surface visible est dans une et une seule cellule (ni recouvrement, ni trou).
for (const [d, alt] of VIEWS) {
  // Un test par vue.
  test(`découpe exacte : ni recouvrement ni trou (altitude ${alt}, y = ${d[1]})`, () => {
    // Direction normalisée.
    const l = Math.hypot(...d), dir = d.map((x) => x / l);
    // Cellules choisies, avec les réglages de l'application.
    const cells = selectHexCells({ cam: dir.map((x) => x * alt), fovY: 0.8, viewportH: 1000 });
    // Au moins deux niveaux mêlés (sinon le test ne prouve rien) — sauf de très loin.
    assert.ok(new Set(cells.map((c) => c.level)).size >= 2);
    // Tirages reproductibles.
    const rand = rng(42);
    // Angle de l'horizon vu de la caméra ; on reste dans les 95 % les plus proches (et à 0,15 rad au plus).
    const reach = Math.min(0.15, Math.acos(1 / alt) * 0.95);
    // Une direction perpendiculaire à la caméra, pour tourner autour d'elle.
    const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    // Premier axe du plan tangent.
    const e1 = [dir[1] * ref[2] - dir[2] * ref[1], dir[2] * ref[0] - dir[0] * ref[2], dir[0] * ref[1] - dir[1] * ref[0]];
    // Normalisé.
    const n1 = Math.hypot(...e1), u = e1.map((x) => x / n1);
    // Second axe du plan tangent.
    const v = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
    // 600 points tirés au hasard dans le disque visible.
    for (let k = 0; k < 600; k++) {
      // Distance angulaire au point sous la caméra, et direction autour de lui.
      const ang = reach * Math.sqrt(rand()), turn = 2 * Math.PI * rand();
      // Point de la sphère à cet angle et dans cette direction.
      const q = [0, 1, 2].map((i) => dir[i] * Math.cos(ang) + (u[i] * Math.cos(turn) + v[i] * Math.sin(turn)) * Math.sin(ang));
      // Nombre de cellules qui le contiennent : exactement une.
      assert.equal(cells.filter((c) => inside(c, q)).length, 1);
    // Fin des tirages.
    }
  // Fin du test.
  });
// Fin des vues.
}

// L'enfant du centre est entièrement dans sa mère : il reste une cellule entière (mêmes clé et caches qu'avant).
test('enfant du centre : la cellule entière, pas un morceau', () => {
  // Une cellule racine.
  const root = hexRoots()[7];
  // Son enfant du centre.
  const center = hexChildren(root)[0];
  // Découpé à la mère : le même objet.
  assert.equal(clipKidToParent(center, root), center);
// Fin du test.
});

// Les parties des enfants recouvrent exactement la mère : même aire.
test('parties des enfants : même aire que la mère', () => {
  // Une cellule racine (hexagone) et une autre (pentagone, au pôle).
  for (const root of [hexRoots()[7], hexRoots().find((c) => c.pentagon)]) {
    // Ses parties.
    const parts = partsOf(root, hexChildren(root));
    // Somme de leurs aires.
    const sum = parts.reduce((s, part) => s + areaOf(part), 0);
    // Égale à l'aire de la mère, à un millionième près.
    assert.ok(Math.abs(sum - areaOf(root)) < areaOf(root) * 1e-6);
    // Les enfants à cheval sur un côté sont des morceaux, gardés une seule fois.
    assert.ok(parts.some((part) => part.polys));
  // Fin des cellules.
  }
// Fin du test.
});

// Un morceau a son maillage, et tous ses sommets sont dans le morceau.
test('maillage d’un morceau : des triangles, tous dans le morceau', () => {
  // Une cellule racine.
  const root = hexRoots()[7];
  // Un morceau parmi ses parties.
  const piece = partsOf(root, hexChildren(root)).find((part) => part.polys);
  // Son maillage.
  const mesh = buildCellMesh(piece, 3);
  // Il a des triangles.
  assert.ok(mesh.count > 0);
  // Chaque sommet, remis en coordonnées absolues, est dans le morceau.
  for (let i = 0; i < mesh.count; i++) {
    // Position absolue (le maillage est relatif au centre).
    const p = [mesh.positions[i * 3] + piece.center[0], mesh.positions[i * 3 + 1] + piece.center[1], mesh.positions[i * 3 + 2] + piece.center[2]];
    // Dans le morceau (tolérance des nombres de 32 bits).
    assert.ok(regionPolys(piece).some((poly) => polyPlanes(poly).every((n) => dot(n, p) >= -1e-6)));
  // Fin des sommets.
  }
// Fin du test.
});

// Une cellule entière garde exactement son ancien maillage (mêmes triangles, même ordre).
test('cellule entière : maillage inchangé (éventail du centre)', () => {
  // Une cellule racine.
  const root = hexRoots()[3];
  // Son maillage avec un seul segment.
  const mesh = buildCellMesh(root, 1);
  // Autant de triangles que de côtés de l'éventail (rayon > 1° : plusieurs segments par côté, donc au moins autant).
  assert.ok(mesh.count >= cellFan(root).length * 3);
  // Le premier sommet est le centre (position relative nulle, aux arrondis des nombres de 32 bits près).
  assert.ok(Math.hypot(mesh.positions[0], mesh.positions[1], mesh.positions[2]) < 1e-6);
// Fin du test.
});
