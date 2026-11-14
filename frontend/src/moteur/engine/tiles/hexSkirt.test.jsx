// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Passage d'une longitude et d'une latitude à un point de la sphère.
import { lonLatToXYZ } from './mercator';
// La cellule, son maillage, la découpe, la jupe et sa profondeur relative.
import { CELL_SKIRT, addCellSkirt, buildCellMesh, clipCellToTile, hexCell } from './hexCells';

// piece : un morceau de cellule entière (coordonnées de texture toutes au centre de l'image : rien n'est découpé).
const piece = (mesh) => clipCellToTile(mesh, new Float32Array(mesh.count * 2).fill(0.5));
// abs : position absolue (sphère de rayon 1) du sommet i d'un morceau.
const abs = (part, center, i) => [0, 1, 2].map((k) => part.positions[i * 3 + k] + center[k]);
// len : longueur d'un vecteur.
const len = (v) => Math.hypot(v[0], v[1], v[2]);

// Premier test : la jupe borde tout le pourtour de la cellule, et rien d'autre.
test('jupe des cellules : une bande sous chaque arête du pourtour', () => {
  // Cellule au-dessus de Paris et son maillage, deux segments par côté.
  const cell = hexCell(lonLatToXYZ(2.35, 48.85), 6);
  const mesh = buildCellMesh(cell, 2);
  // Morceau sans jupe.
  const part = piece(mesh);
  // Morceau avec une jupe de 1 % de rayon.
  const skirted = addCellSkirt(part, mesh.center, 0.01);
  // Nombre de segments par côté retenu par le maillage : sommets = côtés × n² × 3.
  const n = Math.round(Math.sqrt(part.count / 3 / cell.ring.length));
  // Six sommets de jupe pour chaque arête du pourtour (côtés × n arêtes).
  assert.equal(skirted.count - part.count, 6 * cell.ring.length * n);
  // Les sommets d'origine sont inchangés.
  assert.deepEqual([...skirted.positions.subarray(0, part.count * 3)], [...part.positions]);
// Fin du test.
});

// Deuxième test : bas de jupe enfoncé, triangles tournés vers l'extérieur de la cellule.
test('jupe des cellules : bas enfoncé de la profondeur demandée, faces vers l’extérieur', () => {
  // Cellule et morceau avec jupe.
  const cell = hexCell(lonLatToXYZ(-60, 10), 5);
  const mesh = buildCellMesh(cell, 1);
  const part = piece(mesh);
  const depth = 0.02;
  const s = addCellSkirt(part, mesh.center, depth);
  // Pour chaque triangle de jupe (début).
  for (let v = part.count; v < s.count; v += 3) {
    // Ses trois sommets absolus.
    const [a, b, c] = [0, 1, 2].map((k) => abs(s, mesh.center, v + k));
    // Chaque sommet est au sol (rayon 1) ou au bas de la jupe (rayon 1 − profondeur).
    for (const p of [a, b, c]) assert.ok(Math.abs(len(p) - 1) < 1e-5 || Math.abs(len(p) - (1 - depth)) < 1e-5);
    // Normale du triangle.
    const e1 = b.map((x, k) => x - a[k]), e2 = c.map((x, k) => x - a[k]);
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    // Milieu du triangle, vu depuis le centre de la cellule.
    const out = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3 - mesh.center[k]);
    // La face regarde vers l'extérieur de la cellule.
    assert.ok(nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] > 0);
  // Fin de la boucle.
  }
// Fin du test.
});

// Troisième test : profondeur nulle ou morceau vide, rien ne change ; profondeur relative prudente.
test('jupe des cellules : sans profondeur ni triangle, morceau inchangé', () => {
  // Un morceau quelconque.
  const mesh = buildCellMesh(hexCell(lonLatToXYZ(100, -30), 4), 1);
  const part = piece(mesh);
  // Profondeur nulle : le même objet.
  assert.equal(addCellSkirt(part, mesh.center, 0), part);
  // Morceau vide : le même objet.
  const empty = { positions: new Float32Array(0), normals: new Float32Array(0), uvs: new Float32Array(0), count: 0 };
  assert.equal(addCellSkirt(empty, mesh.center, 0.01), empty);
  // Profondeur relative : quelques pour cent du rayon de la cellule.
  assert.ok(CELL_SKIRT > 0 && CELL_SKIRT < 0.1);
// Fin du test.
});
