// Index spatial des points : octree « à échantillonnage de grille » (même principe que Potree).
// Chaque nœud découpe son cube en une grille de G³ cellules et garde au plus un point par cellule ;
// les points refusés descendent dans l'octant enfant. La racine contient donc un aperçu régulier de tout le nuage,
// et chaque niveau double la densité : on affiche peu de points au loin et tout le détail de près.
// Aucune dépendance (testable avec node --test).

export const DEFAULT_GRID = 64;

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Float32Array} positions  x, y, z × count (coordonnées relatives au centre du nuage)
 * @param {number} count
 * @param {{ min: number[], max: number[] }} bounds  emprise des points
 * @returns {{ nodes: object[], order: Uint32Array, root: { min: number[], size: number } }}
 *   `order` liste les indices de points regroupés par nœud : le nœud k occupe order[start … start + count[.
 */
export function buildOctree(positions, count, bounds, { grid = DEFAULT_GRID, maxDepth, minSpacing = 0.001, minNodePoints = 20_000, seed = 1, onProgress } = {}) {
  const extent = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]);
  const size = Math.max(...extent, 1e-6) * 1.000001;
  const rootMin = [0, 1, 2].map((i) => (bounds.min[i] + bounds.max[i]) / 2 - size / 2);
  const depthLimit = maxDepth ?? Math.max(1, Math.min(20, Math.ceil(Math.log2(size / grid / minSpacing))));

  const cells = grid * grid * grid;
  const words = Math.ceil(cells / 32);
  const nodes = [];
  const createNode = (key, level, parent, min, nodeSize) => {
    nodes.push({
      key, level, parent, min, size: nodeSize, spacing: nodeSize / grid,
      children: [-1, -1, -1, -1, -1, -1, -1, -1], count: 0, start: 0,
      bits: level < depthLimit ? new Uint32Array(words) : null,
    });
    return nodes.length - 1;
  };
  createNode('r', 0, -1, rootMin, size);

  // Ordre d'insertion aléatoire : chaque nœud reçoit un échantillon uniforme, pas les premières lignes de scan.
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  const random = rng(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }

  const pointNode = new Uint32Array(count);
  const step = Math.max(1, Math.floor(count / 50));
  for (let k = 0; k < count; k++) {
    const i = order[k];
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    let n = 0;
    for (;;) {
      const node = nodes[n];
      if (!node.bits) break; // profondeur maximale : le nœud garde tout
      const cs = node.size / grid;
      const cx = Math.min(grid - 1, Math.max(0, Math.floor((px - node.min[0]) / cs)));
      const cy = Math.min(grid - 1, Math.max(0, Math.floor((py - node.min[1]) / cs)));
      const cz = Math.min(grid - 1, Math.max(0, Math.floor((pz - node.min[2]) / cs)));
      const cell = cx + grid * (cy + grid * cz);
      const w = cell >>> 5, b = 1 << (cell & 31);
      if ((node.bits[w] & b) === 0) { node.bits[w] |= b; break; }
      const half = node.size / 2;
      const ix = px >= node.min[0] + half ? 1 : 0;
      const iy = py >= node.min[1] + half ? 1 : 0;
      const iz = pz >= node.min[2] + half ? 1 : 0;
      const octant = ix | (iy << 1) | (iz << 2);
      let child = node.children[octant];
      if (child < 0) {
        child = createNode(
          node.key + octant,
          node.level + 1,
          n,
          [node.min[0] + ix * half, node.min[1] + iy * half, node.min[2] + iz * half],
          half,
        );
        node.children[octant] = child;
      }
      n = child;
    }
    pointNode[i] = n;
    nodes[n].count++;
    if (onProgress && k % step === 0) onProgress(k / count);
  }

  for (const node of nodes) node.bits = null; // les grilles d'occupation ne servent plus

  // Fusion des petites feuilles dans leur parent : beaucoup moins de nœuds (donc d'appels de dessin), aucun point perdu.
  // Le nœud fusionné contient toute la densité de ses enfants : son espacement devient celui du plus fin d'entre eux.
  if (minNodePoints > 0 && nodes.length > 1) {
    const mergedInto = new Int32Array(nodes.length).fill(-1);
    for (let n = nodes.length - 1; n >= 0; n--) { // enfants créés après leurs parents : parcours du bas vers le haut
      const node = nodes[n];
      const kids = node.children.filter((c) => c >= 0);
      if (!kids.length || kids.some((c) => nodes[c].children.some((g) => g >= 0))) continue;
      const total = node.count + kids.reduce((sum, c) => sum + nodes[c].count, 0);
      if (total > minNodePoints) continue;
      for (const c of kids) {
        mergedInto[c] = n;
        node.spacing = Math.min(node.spacing, nodes[c].spacing);
      }
      node.count = total;
      node.children = [-1, -1, -1, -1, -1, -1, -1, -1];
    }
    // Nœud final de chaque nœud (le parent a toujours un indice plus petit), puis renumérotation compacte.
    const final = new Int32Array(nodes.length);
    for (let n = 0; n < nodes.length; n++) final[n] = mergedInto[n] < 0 ? n : final[mergedInto[n]];
    const newIndex = new Int32Array(nodes.length).fill(-1);
    const kept = [];
    nodes.forEach((node, n) => { if (mergedInto[n] < 0) { newIndex[n] = kept.length; kept.push(node); } });
    for (const node of kept) {
      node.parent = node.parent >= 0 ? newIndex[node.parent] : -1;
      node.children = node.children.map((c) => (c >= 0 ? newIndex[c] : -1));
      node.count = 0;
    }
    for (let i = 0; i < count; i++) {
      const n = newIndex[final[pointNode[i]]];
      pointNode[i] = n;
      kept[n].count++;
    }
    nodes.length = 0;
    nodes.push(...kept);
  }

  // Regroupement par nœud (tri par comptage).
  let start = 0;
  for (const node of nodes) { node.start = start; start += node.count; }

  // Espacement réel : la grille peut être plus fine que les données (feuilles, nœuds fusionnés). Pour un relevé
  // aérien (surface), l'écart moyen entre points d'un nœud vaut environ côté / √nombre de points.
  for (const node of nodes) node.spacing = Math.max(node.spacing, node.size / Math.sqrt(Math.max(1, node.count)));
  const cursor = nodes.map((node) => node.start);
  const grouped = new Uint32Array(count);
  for (let k = 0; k < count; k++) {
    const i = order[k];
    grouped[cursor[pointNode[i]]++] = i;
  }
  onProgress?.(1);
  return { nodes, order: grouped, root: { min: rootMin, size }, grid, maxDepth: depthLimit };
}
