// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les cellules hexagonales : racines, enfants, cellule d'un point et maillage.
import { buildCellMesh, hexCell, hexChildren, hexRoots } from './hexCells.jsx';
// Importe le maillage des tuiles carrées, le rayon des niveaux et la sphère de fond.
import { BACKDROP_DROP, backdropScale, buildTileGrid, tileRadius } from '../tiles/tileGeometry.jsx';
// Importe les deux découpages des tuiles carrées.
import { EQUIRECTANGULAR, MERCATOR } from '../projection.jsx';

// Régression « grille de points noirs » : la sphère de fond (THREE.SphereGeometry, sommets posés sur la sphère) ne
// doit jamais dépasser de la carte, faite de facettes planes qui passent sous la sphère entre leurs sommets.

// sub : différence de deux vecteurs.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
// cross : produit vectoriel.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// dot : produit scalaire.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Creux le plus profond des triangles d'un maillage sous la sphère de rayon 1 (échantillonnage barycentrique fin). */
// sagOf : positions relatives, centre, nombre de sommets (triangles indépendants) ou indices.
function sagOf(pos, center, count, indices) {
  // vertex : le sommet i, replacé autour du centre de l'astre.
  const vertex = (i) => [pos[i * 3] + center[0], pos[i * 3 + 1] + center[1], pos[i * 3 + 2] + center[2]];
  // Liste des indices de sommets, trois par triangle.
  const idx = indices ?? Array.from({ length: count }, (_, i) => i);
  // Creux le plus profond trouvé.
  let sag = 0;
  // Pour chaque triangle :
  for (let t = 0; t < idx.length; t += 3) {
    // ses trois sommets ;
    const A = vertex(idx[t]), B = vertex(idx[t + 1]), C = vertex(idx[t + 2]);
    // points du triangle sur une grille barycentrique de pas 1/8 : le plus proche du centre de l'astre.
    for (let i = 0; i <= 8; i++) for (let j = 0; i + j <= 8; j++) {
      // Poids barycentriques.
      const a = i / 8, b = j / 8, c = 1 - a - b;
      // Distance du point au centre de l'astre.
      const r = Math.hypot(A[0] * c + B[0] * a + C[0] * b, A[1] * c + B[1] * a + C[1] * b, A[2] * c + B[2] * a + C[2] * b);
      // Creux du point.
      sag = Math.max(sag, 1 - r);
    // Fin de la grille.
    }
  // Fin des triangles.
  }
  // Renvoie le creux.
  return sag;
// Fin de sagOf.
}

/** Rayon de la carte (maillage d'une cellule) le long d'une direction issue du centre de l'astre, ou null. */
// meshRadius : le maillage et la direction (unitaire).
function meshRadius(mesh, d) {
  // Centre et positions relatives.
  const C = mesh.center, P = mesh.positions;
  // vertex : le sommet i, replacé autour du centre de l'astre.
  const vertex = (i) => [P[i * 3] + C[0], P[i * 3 + 1] + C[1], P[i * 3 + 2] + C[2]];
  // Pour chaque triangle :
  for (let t = 0; t < mesh.count; t += 3) {
    // ses sommets et sa normale ;
    const A = vertex(t), B = vertex(t + 1), D = vertex(t + 2), n = cross(sub(B, A), sub(D, A));
    // intersection du rayon avec son plan ;
    const den = dot(n, d);
    // rayon parallèle : triangle suivant ;
    if (Math.abs(den) < 1e-15) continue;
    // distance au centre le long du rayon ;
    const s = dot(n, A) / den;
    // point d'intersection ;
    const X = [d[0] * s, d[1] * s, d[2] * s];
    // dans le triangle (les trois côtés le laissent du même côté que la normale) : rayon trouvé.
    if (s > 0 && dot(cross(sub(B, A), sub(X, A)), n) >= -1e-14 && dot(cross(sub(D, B), sub(X, B)), n) >= -1e-14 && dot(cross(sub(A, D), sub(X, D)), n) >= -1e-14) return s;
  // Fin des triangles.
  }
  // Aucun triangle traversé.
  return null;
// Fin de meshRadius.
}

/**
 * Sommets d'une THREE.SphereGeometry (wSeg × hSeg) qui dépassent de la carte de niveau L, pour une sphère de fond au
 * facteur de rayon k : { total, above }.
 */
// protruding : segments, niveau des cellules et facteur.
function protruding(wSeg, hSeg, L, k) {
  // Fréquence du niveau, rayon des cellules (écart de loin : 1e-6) et maillages déjà construits.
  const f = 2 ** (L + 1), r = tileRadius(L, 1e-6), meshes = new Map();
  // Compteurs.
  let total = 0, above = 0;
  // Pour chaque sommet de la sphère hors pôles (mêmes formules que three.js) :
  for (let iy = 1; iy < hSeg; iy++) for (let ix = 0; ix < wSeg; ix++) {
    // ses angles ;
    const phi = (ix / wSeg) * 2 * Math.PI, theta = (iy / hSeg) * Math.PI;
    // sa direction ;
    const d = [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
    // la cellule qui le contient et son maillage ;
    const cell = hexCell(d, f);
    // maillage gardé, ou construit ;
    let mesh = meshes.get(cell.key);
    // construit au besoin.
    if (!mesh) { mesh = buildCellMesh(cell); meshes.set(cell.key, mesh); }
    // Rayon de la carte le long du sommet.
    const s = meshRadius(mesh, d);
    // Rayon introuvable (sommet sur une arête, cas limite) : ignoré.
    if (s === null) continue;
    // Un sommet de plus ; il dépasse si la sphère de fond est plus haute que la carte.
    total++; if (k > s * r) above++;
  // Fin des sommets.
  }
  // Renvoie les compteurs.
  return { total, above };
// Fin de protruding.
}

// Test : la reproduction du défaut et sa correction, avec la sphère de fond de la Terre (128 × 96).
test('sphère de fond : au rayon exact, ses sommets percent la carte ; abaissée, plus aucun', () => {
  // Pour les cellules du niveau 0 (vue lointaine) et du niveau 2 :
  for (const L of [0, 2]) {
    // Avant : sphère au rayon de l'astre.
    const before = protruding(128, 96, L, 1);
    // Presque tous ses sommets dépassaient : la grille de points.
    assert.ok(before.above > before.total * 0.9, `niveau ${L} : ${before.above}/${before.total}`);
    // Après : sphère abaissée sous la carte hexagonale.
    const after = protruding(128, 96, L, backdropScale(true));
    // Aucun sommet ne dépasse.
    assert.equal(after.above, 0, `niveau ${L} : ${after.above}/${after.total}`);
  // Fin des niveaux.
  }
// Fin du test.
});

// Test : la Lune (sphère de fond 96 × 64).
test('sphère de fond de la Lune : aucun sommet au-dessus de la carte une fois abaissée', () => {
  // Niveau 1.
  assert.equal(protruding(96, 64, 1, backdropScale(true)).above, 0);
// Fin du test.
});

// Test : la marge couvre le creux le plus profond de chaque affichage.
test('sphère de fond : sous le creux le plus profond des cellules hexagonales et des tuiles carrées', () => {
  // Cellules des niveaux 0 à 2.
  let cells = hexRoots(), hexSag = 0;
  // Pour chaque niveau :
  for (let L = 0; L <= 2; L++) {
    // le creux de chaque cellule ;
    for (const c of cells) { const m = buildCellMesh(c); hexSag = Math.max(hexSag, sagOf(m.positions, m.center, m.count)); }
    // les enfants, sans doublon, pour le niveau suivant.
    cells = [...new Map(cells.flatMap(hexChildren).map((c) => [c.key, c])).values()];
  // Fin des niveaux.
  }
  // Creux des cellules : de l'ordre de 1,2e-4 rayon, sous la marge.
  assert.ok(hexSag > 5e-5 && hexSag < BACKDROP_DROP.hex, `cellules : ${hexSag}`);
  // Creux des tuiles carrées des niveaux 0 à 2, dans les deux découpages.
  let squareSag = 0;
  // Pour chaque découpage et chaque niveau, chaque tuile :
  for (const proj of [MERCATOR, EQUIRECTANGULAR]) for (let z = 0; z <= 2; z++) for (let x = 0; x < proj.cols(z); x++) for (let y = 0; y < proj.rows(z); y++) {
    // son maillage ;
    const g = buildTileGrid(z, x, y, proj);
    // son creux.
    squareSag = Math.max(squareSag, sagOf(g.positions, g.center, 0, g.indices));
  // Fin des tuiles.
  }
  // Creux des tuiles carrées : sous leur marge.
  assert.ok(squareSag < BACKDROP_DROP.square, `tuiles carrées : ${squareSag}`);
  // La marge des cellules reste discrète : moins de 0,03 % du rayon (1,9 km sur la Terre).
  assert.ok(BACKDROP_DROP.hex <= 3e-4);
// Fin du test.
});

// Test : le relief des océans.
test('sphère de fond : sous le fond des océans quand le relief les creuse', () => {
  // Sans relief : la marge seule.
  assert.equal(backdropScale(true), 1 - BACKDROP_DROP.hex);
  // Fond à 11 500 m sur la Terre, exagération 2 : la sphère descend d'autant en plus.
  const sea = (11500 / 6371000) * 2;
  // Facteur attendu.
  assert.ok(Math.abs(backdropScale(true, sea) - (1 - BACKDROP_DROP.hex - sea)) < 1e-12);
  // Valeur illisible ou négative : ignorée.
  assert.deepEqual([backdropScale(false, NaN), backdropScale(false, -1)], [1 - BACKDROP_DROP.square, 1 - BACKDROP_DROP.square]);
// Fin du test.
});
