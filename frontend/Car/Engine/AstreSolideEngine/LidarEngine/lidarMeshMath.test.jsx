// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe le maillage des nœuds LiDAR.
import { MESH_MAX_CELLS, meshCells, meshNode } from './lidarMeshMath.jsx';

// Fabrique un nuage : `points` = liste de [x, y, z, classe, luminosité].
function cloud(points) {
  // Tableaux au format de decodeNode.
  const position = new Uint16Array(points.length * 3), attr = new Uint8Array(points.length * 2);
  // Remplit chaque point.
  points.forEach(([x, y, z, c = 2, l = 170], i) => { position.set([x, y, z], i * 3); attr.set([c, l], i * 2); });
  // Renvoie le nuage.
  return { position, attr, count: points.length };
// Fin de cloud.
}

// Test : finesse du maillage.
test('finesse : quatre points par case en moyenne, bornée', () => {
  // 400 points : 10 cases par côté.
  assert.equal(meshCells(400), 10);
  // Très peu de points : au moins 2 cases.
  assert.equal(meshCells(1), 2);
  // Énormément de points : plafonné.
  assert.equal(meshCells(10_000_000), MESH_MAX_CELLS);
// Fin du test.
});

// Test : un plan plein.
test('plan plein : un sommet par case, deux triangles par carré, indices valides', () => {
  // Grille 4 × 4 de points au centre de chaque case d'un nœud de côté 40.
  const pts = [];
  // Remplit la grille.
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) pts.push([x * 10 + 5, y * 10 + 5, 100]);
  // Nuage et maillage à 4 cases par côté.
  const c = cloud(pts), m = meshNode(c.position, c.attr, c.count, 40, 4);
  // 16 sommets, 18 triangles.
  assert.equal(m.vertices, 16);
  assert.equal(m.triangles, 18);
  // Chaque indice désigne un sommet existant.
  assert.ok(m.index.every((i) => i < m.vertices));
  // Aucun triangle dégénéré.
  for (let t = 0; t < m.index.length; t += 3) assert.equal(new Set([m.index[t], m.index[t + 1], m.index[t + 2]]).size, 3);
// Fin du test.
});

// Test : le point le plus haut de chaque case.
test('chaque case garde son point le plus haut, à sa position mesurée, avec sa classe', () => {
  // Deux points dans la même case : le sol (classe 2) et un toit (classe 6) plus haut.
  const c = cloud([[1, 1, 10, 2, 100], [3, 2, 250, 6, 200], [15, 5, 20], [5, 15, 20], [15, 15, 20]]);
  // Maillage à 2 cases par côté d'un nœud de côté 20.
  const m = meshNode(c.position, c.attr, c.count, 20, 2);
  // Quatre sommets.
  assert.equal(m.vertices, 4);
  // Le premier est le toit, à sa position exacte.
  assert.deepEqual([...m.position.slice(0, 3)], [3, 2, 250]);
  // Avec sa classe et sa luminosité.
  assert.deepEqual([...m.attr.slice(0, 2)], [6, 200]);
// Fin du test.
});

// Test : les trous.
test('trous, sans comblement : trois cases remplies donnent un triangle, moins de trois n’en donnent aucun', () => {
  // Trois coins sur quatre.
  const trois = cloud([[5, 5, 1], [15, 5, 1], [5, 15, 1]]);
  // Un seul triangle.
  assert.equal(meshNode(trois.position, trois.attr, trois.count, 20, 2, 0).triangles, 1);
  // Deux coins seulement.
  const deux = cloud([[5, 5, 1], [15, 15, 1]]);
  // Aucun triangle, mais les sommets restent.
  const m = meshNode(deux.position, deux.attr, deux.count, 20, 2, 0);
  assert.equal(m.triangles, 0);
  assert.equal(m.vertices, 2);
  // Nœud vide : rien.
  assert.equal(meshNode(new Uint16Array(0), new Uint8Array(0), 0, 20).vertices, 0);
// Fin du test.
});

// Test : la diagonale.
test('arête de toit : le carré est coupé par la diagonale la moins pentue', () => {
  // Un coin surélevé (haut-droite) : la diagonale bas-droite – haut-gauche est à plat.
  const c = cloud([[5, 5, 0], [15, 5, 0], [5, 15, 0], [15, 15, 500]]);
  // Maillage.
  const m = meshNode(c.position, c.attr, c.count, 20, 2);
  // Deux triangles.
  assert.equal(m.triangles, 2);
  // Le premier ne contient pas le sommet surélevé : il reste à plat.
  const premier = [...m.index.slice(0, 3)];
  assert.ok(!premier.includes(3));
  // Le second le contient.
  assert.ok([...m.index.slice(3, 6)].includes(3));
// Fin du test.
});

// Test : un point au bord.
test('un point exactement au bord de l’emprise tombe dans la dernière case', () => {
  // Points aux quatre coins extrêmes d'un nœud de côté 100.
  const c = cloud([[0, 0, 1], [100, 0, 1], [0, 100, 1], [100, 100, 1]]);
  // Maillage à 2 cases : les quatre cases sont remplies.
  assert.equal(meshNode(c.position, c.attr, c.count, 100, 2).vertices, 4);
// Fin du test.
});

// Test : le comblement des trous.
test('comblement : une case vide bien entourée reçoit un sommet au centre, à la hauteur de sa voisine la plus basse', () => {
  // Grille 3 × 3 d'un nœud de côté 30, sans le centre ; un coin est un toit plus haut.
  const pts = [];
  // Remplit le tour.
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 1 || y !== 1) pts.push([x * 10 + 5, y * 10 + 5, x === 2 && y === 2 ? 400 : 50 + x, 2, 120]);
  // Nuage.
  const c = cloud(pts);
  // Sans comblement : 8 sommets et un trou au milieu.
  const troue = meshNode(c.position, c.attr, c.count, 30, 3, 0);
  assert.equal(troue.vertices, 8);
  // Avec comblement : 9 sommets et les 8 triangles du plan entier.
  const plein = meshNode(c.position, c.attr, c.count, 30, 3);
  assert.equal(plein.vertices, 9);
  assert.equal(plein.triangles, 8);
  // Le sommet ajouté (case 4) est au centre de sa case, à la hauteur la plus basse du tour (50).
  assert.deepEqual([...plein.position.slice(12, 15)], [15, 15, 50]);
// Fin du test.
});

// Test : le comblement ne s'étend pas dans le vide.
test('comblement : une case isolée ou au bord du vide n’est pas comblée', () => {
  // Une seule rangée de points en bas d'un nœud de côté 40 : le reste est vide.
  const c = cloud([[5, 5, 1], [15, 5, 1], [25, 5, 1], [35, 5, 1]]);
  // Maillage à 4 cases par côté.
  const m = meshNode(c.position, c.attr, c.count, 40, 4);
  // Deux passes comblent au plus les cases touchant trois voisines : la rangée du dessus (2 cases), pas davantage.
  assert.ok(m.vertices <= 8, `sommets : ${m.vertices}`);
// Fin du test.
});
