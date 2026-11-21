// Surfaces LiDAR : transforme les points d'un nœud en un maillage de triangles, pour dessiner des surfaces pleines
// (sol, toits, façades) au lieu de points séparés. Calcul pur, sans moteur 3D : testé dans lidarMeshMath.test.jsx.
//
// Principe : l'emprise du nœud est découpée en cases ; chaque case garde son point le plus haut (ce que l'on voit
// d'en haut : le toit, la cime, le sol nu). Ces points deviennent les sommets, placés là où le laser les a mesurés,
// et chaque carré de quatre cases voisines donne deux triangles. Un écart de hauteur entre deux cases voisines
// (bord d'un toit) donne des triangles presque verticaux : ce sont les façades.

/** Nombre maximal de cases par côté : au plus 65 536 sommets par nœud. */
export const MESH_MAX_CELLS = 256;
/** Passes de comblement des trous : une case vide entourée de cases remplies reçoit un sommet. */
export const MESH_FILL_PASSES = 2;

/** Cases par côté pour un nœud de `count` points, à raison de `perCell` points par case en moyenne. */
// meshCells : choisit la finesse du maillage.
export function meshCells(count, perCell = 4) {
  // Racine du nombre de cases voulu, bornée entre 2 et le maximum.
  return Math.max(2, Math.min(MESH_MAX_CELLS, Math.ceil(Math.sqrt(Math.max(1, count) / perCell))));
// Fin de meshCells.
}

/**
 * Maillage d'un nœud décodé.
 *
 * @param {Uint16Array} position x, y, z de chaque point, en pas depuis le coin du nœud (voir decodeNode)
 * @param {Uint8Array} attr classe et luminosité de chaque point
 * @param {number} count nombre de points
 * @param {number} sizeUnits côté du nœud, en pas
 * @param {number} [cells] cases par côté (par défaut : meshCells(count))
 * @param {number} [fillPasses] passes de comblement des trous (par défaut : MESH_FILL_PASSES ; 0 pour aucun)
 * @returns {{ position: Uint16Array, attr: Uint8Array, index: Uint32Array, vertices: number, triangles: number }}
 *   sommets (mêmes unités et mêmes attributs que les points) et triangles (trois indices de sommets chacun).
 */
// meshNode : construit le maillage (début).
export function meshNode(position, attr, count, sizeUnits, cells = meshCells(count), fillPasses = MESH_FILL_PASSES) {
  // Cases par côté, et nombre de cases.
  const g = Math.max(2, Math.min(MESH_MAX_CELLS, Math.floor(cells))), total = g * g;
  // Point retenu par case (-1 : case vide).
  const best = new Int32Array(total).fill(-1);
  // Facteur qui ramène une coordonnée à un numéro de case.
  const scale = g / Math.max(1, sizeUnits);
  // Chaque point (début).
  for (let i = 0; i < count; i++) {
    // Sa case, bornée à l'emprise.
    const cx = Math.min(g - 1, Math.floor(position[i * 3] * scale)), cy = Math.min(g - 1, Math.floor(position[i * 3 + 1] * scale));
    // Numéro de la case.
    const c = cy * g + cx;
    // Point déjà retenu dans cette case.
    const b = best[c];
    // Garde le plus haut.
    if (b < 0 || position[i * 3 + 2] > position[b * 3 + 2]) best[c] = i;
  // Fin des points.
  }
  // Comblement des trous : une case vide qui a au moins trois voisines remplies (sur huit) emprunte le point de
  // sa voisine la plus basse — le sol caché sous un surplomb, plutôt qu'un toit étiré. `filled` retient ces cases,
  // dont le sommet sera posé au centre de la case.
  const filled = new Uint8Array(total);
  // Chaque passe (début).
  for (let pass = 0; pass < fillPasses; pass++) {
    // Cases comblées pendant cette passe : appliquées à la fin, pour ne pas se propager dans la même passe.
    const add = [];
    // Chaque case.
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) {
      // Case déjà remplie : rien.
      if (best[y * g + x] >= 0) continue;
      // Voisines remplies, et la plus basse.
      let near = 0, low = -1;
      // Les huit voisines.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        // Coordonnées de la voisine.
        const nx = x + dx, ny = y + dy;
        // La case elle-même, ou hors de l'emprise : ignorée.
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= g || ny >= g) continue;
        // Point de la voisine.
        const b = best[ny * g + nx];
        // Voisine vide : ignorée.
        if (b < 0) continue;
        // Une voisine de plus.
        near++;
        // Garde la plus basse.
        if (low < 0 || position[b * 3 + 2] < position[low * 3 + 2]) low = b;
      // Fin des voisines.
      }
      // Assez entourée : sera comblée.
      if (near >= 3) add.push(y * g + x, low);
    // Fin des cases.
    }
    // Plus rien à combler : arrêt.
    if (!add.length) break;
    // Applique les comblements de la passe.
    for (let i = 0; i < add.length; i += 2) { best[add[i]] = add[i + 1]; filled[add[i]] = 1; }
  // Fin des passes.
  }
  // Numéro de sommet de chaque case (-1 : aucune).
  const vertexOf = new Int32Array(total).fill(-1);
  // Nombre de sommets.
  let vertices = 0;
  // Numérote les cases remplies.
  for (let c = 0; c < total; c++) if (best[c] >= 0) vertexOf[c] = vertices++;
  // Sommets : position et attributs du point retenu.
  const outPosition = new Uint16Array(vertices * 3), outAttr = new Uint8Array(vertices * 2);
  // Chaque case remplie (début).
  for (let c = 0; c < total; c++) {
    // Son sommet.
    const v = vertexOf[c];
    // Case vide : rien.
    if (v < 0) continue;
    // Le point retenu.
    const p = best[c];
    // Case comblée : sommet au centre de la case, à la hauteur du point emprunté.
    if (filled[c]) { outPosition[v * 3] = Math.round(((c % g) + 0.5) / scale); outPosition[v * 3 + 1] = Math.round((Math.floor(c / g) + 0.5) / scale); outPosition[v * 3 + 2] = position[p * 3 + 2]; }
    // Sinon : la position mesurée du point.
    else { outPosition[v * 3] = position[p * 3]; outPosition[v * 3 + 1] = position[p * 3 + 1]; outPosition[v * 3 + 2] = position[p * 3 + 2]; }
    // Copie sa classe et sa luminosité.
    outAttr[v * 2] = attr[p * 2]; outAttr[v * 2 + 1] = attr[p * 2 + 1];
  // Fin des cases.
  }
  // Triangles : au plus deux par carré de cases.
  const index = new Uint32Array((g - 1) * (g - 1) * 6);
  // Nombre d'indices écrits.
  let n = 0;
  // Hauteur d'un sommet.
  const z = (v) => outPosition[v * 3 + 2];
  // Chaque carré de quatre cases voisines (début).
  for (let y = 0; y < g - 1; y++) {
    // Chaque colonne.
    for (let x = 0; x < g - 1; x++) {
      // Ses quatre sommets : bas-gauche, bas-droite, haut-gauche, haut-droite.
      const a = vertexOf[y * g + x], b = vertexOf[y * g + x + 1], c = vertexOf[(y + 1) * g + x], d = vertexOf[(y + 1) * g + x + 1];
      // Nombre de sommets présents.
      const present = (a >= 0) + (b >= 0) + (c >= 0) + (d >= 0);
      // Moins de trois : aucun triangle.
      if (present < 3) continue;
      // Les quatre sont là : deux triangles, coupés par la diagonale la moins pentue (les arêtes de toit restent nettes).
      if (present === 4) {
        // Diagonale a–d moins pentue que b–c.
        if (Math.abs(z(a) - z(d)) <= Math.abs(z(b) - z(c))) { index[n++] = a; index[n++] = b; index[n++] = d; index[n++] = a; index[n++] = d; index[n++] = c; }
        // Sinon : diagonale b–c.
        else { index[n++] = a; index[n++] = b; index[n++] = c; index[n++] = b; index[n++] = d; index[n++] = c; }
      // Trois sommets : un seul triangle, dans le même sens de parcours.
      } else if (a < 0) { index[n++] = b; index[n++] = d; index[n++] = c; }
      // Sans le bas-droite.
      else if (b < 0) { index[n++] = a; index[n++] = d; index[n++] = c; }
      // Sans le haut-gauche.
      else if (c < 0) { index[n++] = a; index[n++] = b; index[n++] = d; }
      // Sans le haut-droite.
      else { index[n++] = a; index[n++] = b; index[n++] = c; }
    // Fin des colonnes.
    }
  // Fin des carrés.
  }
  // Renvoie les sommets et les seuls indices écrits.
  return { position: outPosition, attr: outAttr, index: index.slice(0, n), vertices, triangles: n / 3 };
// Fin de meshNode.
}
