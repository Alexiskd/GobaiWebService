// Découpage hexagonal du globe (étape 1 du découpage des tuiles en hexagones). Fonctions pures, sans three.js :
// testées par hexGrid.test.jsx.
//
// Principe : un icosaèdre posé avec un sommet à chaque pôle, chaque face divisée en f × f petits triangles, le tout
// projeté sur la sphère. Les cellules sont les zones « au plus près » de chaque sommet de ce maillage : des hexagones
// partout, sauf aux 12 sommets de l'icosaèdre, qui donnent des pentagones. Une sphère ne peut pas être couverte
// d'hexagones seuls : il en faut exactement 12 (formule d'Euler). Deux sont placés exactement sur les pôles ; les dix
// autres sont à ± 26,57° de latitude, tous les 72° de longitude.
//
// Repère : celui du moteur (sphère de rayon 1, axe des pôles = y, voir lonLatToVec dans ephemeris.jsx).

// D : le nombre de radians dans un degré.
const D = Math.PI / 180;
// norm : vecteur rendu unitaire ; une longueur nulle est remplacée par 1.
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// mix3 : combinaison de trois vecteurs A, B et C avec les poids a, b et c.
const mix3 = (A, B, C, a, b, c) => [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1], a * A[2] + b * B[2] + c * C[2]];
// fromLonLat : vecteur unitaire d'une longitude et d'une latitude en degrés.
const fromLonLat = (lon, lat) => [Math.cos(lat * D) * Math.cos(lon * D), Math.sin(lat * D), -Math.cos(lat * D) * Math.sin(lon * D)];

/** Latitude des dix sommets de l'icosaèdre hors pôles : atan(1/2) ≈ 26,57°. */
// Déclare et exporte la latitude des dix sommets hors pôles : l'arc tangente de 1/2, en degrés.
export const ICOSA_RING_LAT = Math.atan(0.5) / D;

// Les deux sommets des pôles.
const NORTH = [0, 1, 0], SOUTH = [0, -1, 0];
// Les cinq sommets de l'anneau nord, tous les 72°.
const UPPER = [0, 1, 2, 3, 4].map((k) => fromLonLat(72 * k, ICOSA_RING_LAT));
// Les cinq sommets de l'anneau sud, décalés de 36°.
const LOWER = [0, 1, 2, 3, 4].map((k) => fromLonLat(72 * k + 36, -ICOSA_RING_LAT));

/** Les 20 faces de l'icosaèdre : trois sommets [A, B, C] (vecteurs unitaires). */
// Déclare et exporte les vingt faces : quatre par fuseau (début).
export const ICOSA_FACES = [0, 1, 2, 3, 4].flatMap((k) => {
  // Numéro du fuseau suivant.
  const n = (k + 1) % 5;
  // Renvoie les quatre faces du fuseau (début).
  return [
    // La face qui touche le pôle nord.
    [NORTH, UPPER[k], UPPER[n]],
    // La face pointe en bas, entre les deux anneaux.
    [UPPER[k], LOWER[k], UPPER[n]],
    // La face pointe en haut, entre les deux anneaux.
    [LOWER[k], LOWER[n], UPPER[n]],
    // La face qui touche le pôle sud.
    [SOUTH, LOWER[n], LOWER[k]],
  // Fin des quatre faces.
  ];
// Fin de la liste des faces.
});

// Inverse de la matrice [A B C] de chaque face : p = a·A + b·B + c·C  ⇒  (a, b, c) = INV · p.
// Inverse de la matrice des trois sommets de chaque face (début).
const FACE_INVERSES = ICOSA_FACES.map(([A, B, C]) => {
  // Les trois produits vectoriels des sommets pris deux à deux.
  const bc = cross(B, C), ca = cross(C, A), ab = cross(A, B);
  // Déterminant de la matrice.
  const det = dot(A, bc);
  // Renvoie les trois lignes de l'inverse.
  return [bc.map((v) => v / det), ca.map((v) => v / det), ab.map((v) => v / det)];
// Fin du calcul des inverses.
});

/** Clé d'un point de la sphère (les sommets partagés par deux faces retombent sur la même clé). */
// keyOf : clé d'un point, ses coordonnées arrondies au millionième.
const keyOf = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)},${Math.round(p[2] * 1e6)}`;

/**
 * Face de l'icosaèdre qui contient la direction `p`, et ses coordonnées barycentriques (a + b + c = 1) dans le plan
 * de cette face.
 * @returns {{ face: number, a: number, b: number, c: number }}
 */
// Déclare et exporte faceOf : une direction.
export function faceOf(p) {
  // Meilleure face, son plus petit poids, et ses trois poids.
  let best = -1, bestMin = -Infinity, out = null;
  // Pour chacune des vingt faces (début).
  for (let i = 0; i < 20; i++) {
    // L'inverse de la face.
    const inv = FACE_INVERSES[i];
    // Les trois poids de la direction sur les sommets de la face.
    const a = dot(inv[0], p), b = dot(inv[1], p), c = dot(inv[2], p);
    // Le plus petit des trois.
    const m = Math.min(a, b, c);
    // S'il est le plus grand trouvé : la face devient la meilleure.
    if (m > bestMin) { bestMin = m; best = i; out = [a, b, c]; }
  // Fin de la boucle.
  }
  // Somme des trois poids.
  const s = out[0] + out[1] + out[2];
  // Renvoie la face et les poids ramenés à une somme de 1.
  return { face: best, a: out[0] / s, b: out[1] / s, c: out[2] / s };
// Fin de faceOf.
}

/**
 * Toutes les faces de l'icosaèdre qui contiennent la direction `p` (une seule en général, deux sur une arête, cinq sur
 * un sommet), avec ses coordonnées barycentriques dans le plan de chacune.
 * @returns {Array<{ face: number, a: number, b: number, c: number }>}
 */
// Déclare et exporte facesContaining : une direction et une tolérance (1e-9 par défaut).
export function facesContaining(p, eps = 1e-9) {
  // Liste des faces trouvées.
  const out = [];
  // Pour chacune des vingt faces (début).
  for (let i = 0; i < 20; i++) {
    // L'inverse de la face.
    const inv = FACE_INVERSES[i];
    // Les trois poids de la direction.
    const a = dot(inv[0], p), b = dot(inv[1], p), c = dot(inv[2], p);
    // Leur somme.
    const s = a + b + c;
    // s > 0 : la face est du même côté de la sphère que p (la face opposée a ses trois coordonnées négatives).
    // Somme positive et aucun poids négatif, à la tolérance près : la face est retenue avec ses poids ramenés à une somme de 1.
    if (s > 0 && Math.min(a, b, c) / s >= -eps) out.push({ face: i, a: a / s, b: b / s, c: c / s });
  // Fin de la boucle.
  }
  // Renvoie la liste.
  return out;
// Fin de facesContaining.
}

/**
 * Centre de la cellule qui contient la direction `p`, à la fréquence `f` : le sommet du maillage le plus proche dans
 * le plan de la face (arrondi hexagonal des coordonnées barycentriques).
 * @returns {number[]} vecteur unitaire du centre de la cellule
 */
// Déclare et exporte cellCenterOf : une direction et la fréquence du découpage.
export function cellCenterOf(p, f) {
  // La face et les poids de la direction.
  const { face, a, b, c } = faceOf(p);
  // Les poids multipliés par la fréquence.
  const x = a * f, y = b * f, z = c * f;
  // Leurs arrondis.
  let i = Math.round(x), j = Math.round(y), k = Math.round(z);
  // Les écarts d'arrondi.
  const di = Math.abs(i - x), dj = Math.abs(j - y), dk = Math.abs(k - z);
  // Le plus grand écart est sur i : i est recalculé pour que la somme vaille f.
  if (di >= dj && di >= dk) i = f - j - k;
  // Il est sur j : j est recalculé.
  else if (dj >= dk) j = f - i - k;
  // Sinon : k est recalculé.
  else k = f - i - j;
  // Les trois sommets de la face.
  const [A, B, C] = ICOSA_FACES[face];
  // Renvoie le sommet du maillage correspondant, sur la sphère.
  return norm(mix3(A, B, C, i, j, k));
// Fin de cellCenterOf.
}

/**
 * Découpage complet du globe à la fréquence `f` (chaque arête de l'icosaèdre est divisée en f) : 10·f² + 2 cellules,
 * dont 12 pentagones.
 * @returns {{
 *   f: number,
 *   cells: Array<{ id: number, center: number[], corners: number[][], pentagon: boolean }>,
 *   index: Map<string, number>,           // clé du centre → id (voir cellOf)
 *   edges: Array<[number[], number[], number[]]>  // limites entre deux cellules : [coin, milieu, coin]
 * }}
 * Les coins d'une cellule tournent autour de son centre ; la limite entre deux coins voisins passe par le milieu de
 * `edges` (deux arcs de grand cercle), ce qui compte seulement pour les cellules à cheval sur deux faces.
 */
// Déclare et exporte buildHexGrid : la fréquence du découpage.
export function buildHexGrid(f) {
  // Fréquence qui n'est pas un entier d'au moins 1 : erreur.
  if (!Number.isInteger(f) || f < 1) throw new Error(`Fréquence du découpage invalide : ${f}`);
  // Table qui donne l'identifiant d'un centre à partir de sa clé.
  const index = new Map();
  // Liste des centres des cellules.
  const centers = [];
  // idOf : identifiant d'un point, créé à la première rencontre (début).
  const idOf = (p) => {
    // Sa clé.
    const key = keyOf(p);
    // Identifiant déjà connu.
    let id = index.get(key);
    // Inconnu : le point reçoit le numéro suivant et entre dans la table et dans la liste.
    if (id === undefined) { id = centers.length; index.set(key, id); centers.push(p); }
    // Renvoie l'identifiant.
    return id;
  // Fin de idOf.
  };
  // Liste des petits triangles.
  const triangles = [];           // { v: [id, id, id], c: centre du petit triangle sur la sphère }
  // Pour chaque sommet, les petits triangles qui le touchent.
  const around = [];              // id du sommet → indices des petits triangles qui le touchent
  // Table des arêtes entre deux sommets.
  const edgeTris = new Map();     // 'u:w' → { u, w, mid, tris: [indices] }
  // Pour chaque face de l'icosaèdre (début).
  for (const [A, B, C] of ICOSA_FACES) {
    // Point du plan de la face : (a, b) pas vers B et C depuis A.
    // flat : point du plan de la face, à a pas vers B et b pas vers C depuis A.
    const flat = (a, b) => mix3(A, B, C, (f - a - b) / f, a / f, b / f);
    // add : ajoute un petit triangle donné par ses trois sommets (début).
    const add = (p0, p1, p2) => {
      // Les trois sommets dans le plan de la face.
      const flats = [flat(...p0), flat(...p1), flat(...p2)];
      // Leurs identifiants, après projection sur la sphère.
      const v = flats.map((q) => idOf(norm(q)));
      // Numéro du triangle.
      const t = triangles.length;
      // Ajoute le triangle, avec son centre projeté sur la sphère.
      triangles.push({ v, c: norm([0, 1, 2].map((n) => flats[0][n] + flats[1][n] + flats[2][n])) });
      // Pour chacun de ses trois sommets (début).
      for (let n = 0; n < 3; n++) {
        // Note que ce triangle touche le sommet.
        (around[v[n]] || (around[v[n]] = [])).push(t);
        // Le sommet et le suivant : une arête.
        const u = v[n], w = v[(n + 1) % 3];
        // Clé de l'arête, le plus petit identifiant en premier.
        const key = u < w ? `${u}:${w}` : `${w}:${u}`;
        // Arête déjà connue.
        let e = edgeTris.get(key);
        // Si elle est nouvelle (début).
        if (!e) {
          // Ses deux bouts dans le plan de la face.
          const fu = flats[n], fw = flats[(n + 1) % 3];
          // L'arête, avec son milieu projeté sur la sphère et la liste de ses triangles.
          e = { mid: norm([fu[0] + fw[0], fu[1] + fw[1], fu[2] + fw[2]]), tris: [] };
          // La range dans la table.
          edgeTris.set(key, e);
        // Fin de ce cas.
        }
        // Note que ce triangle borde l'arête.
        e.tris.push(t);
      // Fin de la boucle des sommets.
      }
    // Fin de add.
    };
    // Pour chaque rangée de la face (début).
    for (let a = 0; a < f; a++) {
      // Pour chaque position de la rangée (début).
      for (let b = 0; a + b < f; b++) {
        // Le petit triangle de même sens que la face.
        add([a, b], [a + 1, b], [a, b + 1]);
        // Le petit triangle retourné, s'il existe à cette position.
        if (a + b < f - 1) add([a + 1, b], [a + 1, b + 1], [a, b + 1]);
      // Fin de la boucle des positions.
      }
    // Fin de la boucle des rangées.
    }
  // Fin de la boucle des faces.
  }
  // Une cellule par centre (début).
  const cells = centers.map((center, id) => {
    // Coins = centres des petits triangles autour du sommet, rangés par angle autour de lui.
    // Axe de référence : l'axe des pôles, ou l'axe x près des pôles.
    const ref = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    // Deux directions perpendiculaires au centre, pour mesurer les angles autour de lui.
    const e1 = norm(cross(ref, center)), e2 = cross(center, e1);
    // Coins de la cellule : à partir des triangles qui touchent le centre,
    const corners = around[id]
      // leurs centres,
      .map((t) => triangles[t].c)
      // chacun avec son angle autour du centre de la cellule,
      .map((c) => ({ c, ang: Math.atan2(dot(c, e2), dot(c, e1)) }))
      // triés par angle,
      .sort((p, q) => p.ang - q.ang)
      // puis réduits à leur position.
      .map((p) => p.c);
    // Renvoie la cellule ; c'est un pentagone si elle a cinq coins.
    return { id, center, corners, pentagon: corners.length === 5 };
  // Fin de la construction des cellules.
  });
  // Liste des limites.
  const edges = [];
  // Pour chaque arête : le centre de son premier triangle, son milieu et le centre de son second triangle.
  for (const e of edgeTris.values()) edges.push([triangles[e.tris[0]].c, e.mid, triangles[e.tris[1]].c]);
  // Renvoie la fréquence, les cellules, la table et les limites.
  return { f, cells, index, edges };
// Fin de buildHexGrid.
}

/** Identifiant de la cellule de `grid` qui contient la direction `p`. */
// Déclare et exporte cellOf : le découpage et une direction.
export function cellOf(grid, p) {
  // Renvoie l'identifiant du centre de la cellule qui contient la direction.
  return grid.index.get(keyOf(cellCenterOf(p, grid.f)));
// Fin de cellOf.
}

/**
 * Tracé du découpage : segments (paires de points) pour THREE.LineSegments, sur la sphère de rayon 1. Chaque limite
 * est un arc de grand cercle, découpé pour suivre la courbure (au plus `maxStepDeg` par segment).
 * @returns {Float32Array}
 */
// Déclare et exporte hexGridSegments : le découpage et le pas maximal en degrés (0,5 par défaut).
export function hexGridSegments(grid, maxStepDeg = 0.5) {
  // Liste des coordonnées.
  const out = [];
  // arc : trace un arc de grand cercle entre deux points (début).
  const arc = (p, q) => {
    // Angle entre les deux points.
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(p, q))));
    // Nombre de segments : l'angle divisé par le pas, au moins 1.
    const steps = Math.max(1, Math.ceil(ang / (maxStepDeg * D)));
    // Point précédent : le départ.
    let prev = p;
    // Pour chaque segment (début).
    for (let n = 1; n <= steps; n++) {
      // Avancement de 0 à 1.
      const t = n / steps;
      // Point courant : interpolé puis projeté sur la sphère ; le dernier est exactement l'arrivée.
      const cur = n === steps ? q : norm([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
      // Ajoute le segment du point précédent au point courant.
      out.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2]);
      // Le point courant devient le précédent.
      prev = cur;
    // Fin de la boucle.
    }
  // Fin de arc.
  };
  // Pour chaque limite : un arc du premier coin au milieu, puis du milieu au second coin.
  for (const [c1, mid, c2] of grid.edges) { arc(c1, mid); arc(mid, c2); }
  // Renvoie les coordonnées dans un tableau de nombres flottants.
  return new Float32Array(out);
// Fin de hexGridSegments.
}
