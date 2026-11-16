// Tuiles hexagonales (étape 2 du découpage hexagonal). Fonctions pures, sans three.js : testées par hexCells.test.jsx.
//
// Les fournisseurs n'envoient que des images carrées. L'unité d'AFFICHAGE devient donc la cellule hexagonale :
//   - le globe est découpé en cellules (hexagones, pentagone à chaque pôle : voir ../hexGrid.jsx) ;
//   - chaque cellule se redécoupe en cellules deux fois plus petites, comme une tuile carrée en ses 4 enfants :
//     1 cellule au centre + 6 autour, à cheval sur les voisines (5 autour d'un pentagone) ;
//   - une cellule affiche les images carrées qui la recouvrent, découpées à sa forme, et ne passe à des images plus
//     fines que lorsque toutes celles qui la recouvrent sont prêtes : le détail arrive hexagone par hexagone.
//
// Niveau L : fréquence f = 2^(L+1) du découpage (L = 0 : 42 cellules, dont les 12 pentagones).

// Importe le découpage complet, le centre de la cellule d'un point, les faces qui contiennent un point et les faces de l'icosaèdre, depuis hexGrid.
import { buildHexGrid, cellCenterOf, facesContaining, ICOSA_FACES } from '../hexGrid';
// Importe les conversions entre point de la sphère et longitude/latitude, et la latitude maximale de Mercator, depuis mercator.
import { lonLatToXYZ, MAX_LATITUDE, xyzToLonLat } from './mercator';
// Importe MERCATOR, la projection, depuis projection.
import { MERCATOR } from './projection';

// RAD : le nombre de radians dans un degré.
const RAD = Math.PI / 180;
// norm : vecteur rendu unitaire ; une longueur nulle est remplacée par 1.
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// clamp1 : borne une valeur entre −1 et 1.
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
// mix3 : combinaison de trois vecteurs A, B et C avec les poids a, b et c.
const mix3 = (A, B, C, a, b, c) => [a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1], a * A[2] + b * B[2] + c * C[2]];

/** Fréquence de départ : niveau 0 = 42 cellules. */
// Déclare et exporte la fréquence du niveau 0 : 2.
export const HEX_ROOT_FREQUENCY = 2;
/** Niveau d'une fréquence (2 → 0, 4 → 1, 8 → 2…). */
// Déclare et exporte hexLevel : le logarithme en base 2 de la fréquence, moins 1.
export const hexLevel = (f) => Math.round(Math.log2(f)) - 1;

// Les six voisins d'un sommet du treillis triangulaire, dans l'ordre où ils tournent autour de lui.
// Décalages vers les six voisins d'un sommet du treillis, dans l'ordre où ils tournent autour de lui.
const AROUND = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];

/** Clé d'une cellule : fréquence + centre arrondi au 1/32 de l'écart entre deux centres. */
// keyAt : clé d'une cellule, faite de la fréquence et de son centre arrondi.
const keyAt = (p, f) => `${f}:${Math.round(p[0] * f * 32)},${Math.round(p[1] * f * 32)},${Math.round(p[2] * f * 32)}`;

/** Clé de la cellule de fréquence `f` qui contient la direction `p` (sans calculer son contour). */
// Déclare et exporte cellKeyOf : la clé de la cellule qui contient un point.
export const cellKeyOf = (p, f) => keyAt(cellCenterOf(p, f), f);

/**
 * Cellule de fréquence `f` qui contient la direction `p`.
 * @returns {{
 *   f: number, level: number, key: string, center: number[], pentagon: boolean,
 *   corners: number[][],  // coins (5 ou 6), en tournant autour du centre (sens antihoraire vu de l'extérieur)
 *   mids: number[][],     // milieu de chaque côté = centre d'une cellule enfant à cheval sur la voisine
 *   ring: number[][],     // contour : coin, milieu, coin, milieu… (les côtés sont des arcs de grand cercle)
 *   rho: number,          // rayon angulaire (rad) : du centre au coin le plus éloigné
 *   bound: number,        // rayon de la sphère englobante (corde)
 *   polar: number         // 1 = contient le pôle Nord, −1 = le pôle Sud, 0 sinon
 * }}
 */
// Déclare et exporte hexCell : un point et la fréquence.
export function hexCell(p, f) {
  // Centre de la cellule.
  const center = cellCenterOf(p, f);
  // Coins, milieux des côtés, et clés des milieux déjà vus.
  const corners = [], mids = [], seen = new Set();
  // Pour chaque face de l'icosaèdre qui contient le centre (début).
  for (const { face, a, b, c } of facesContaining(center)) {
    // Les trois sommets de la face.
    const [A, B, C] = ICOSA_FACES[face];
    // Coordonnées entières du centre dans le treillis de la face.
    const i = Math.round(a * f), j = Math.round(b * f), k = Math.round(c * f);
    // Pour chaque voisin : vrai s'il est dans la face.
    const ok = AROUND.map(([di, dj, dk]) => i + di >= 0 && j + dj >= 0 && k + dk >= 0);
    // Pour chacun des six voisins (début).
    for (let n = 0; n < 6; n++) {
      // Hors de la face : ignoré.
      if (!ok[n]) continue;
      // Son décalage.
      const [di, dj, dk] = AROUND[n];
      // Milieu du côté : milieu (dans le plan de la face) entre ce centre et son voisin.
      // Milieu du côté, entre le centre et ce voisin, ramené sur la sphère.
      const mid = norm(mix3(A, B, C, 2 * i + di, 2 * j + dj, 2 * k + dk));
      // Clé de ce milieu.
      const mk = keyAt(mid, 2 * f);
      // S'il est nouveau : il est gardé.
      if (!seen.has(mk)) { seen.add(mk); mids.push(mid); }
      // Voisin suivant.
      const m = (n + 1) % 6;
      // Hors de la face : pas de coin.
      if (!ok[m]) continue;
      // Coin : centre du petit triangle formé avec deux voisins consécutifs.
      // Décalage du voisin suivant.
      const [ei, ej, ek] = AROUND[m];
      // Coin : centre du triangle formé par le centre et ces deux voisins, ramené sur la sphère.
      corners.push(norm(mix3(A, B, C, 3 * i + di + ei, 3 * j + dj + ej, 3 * k + dk + ek)));
    // Fin de la boucle des voisins.
    }
  // Fin de la boucle des faces.
  }
  // Axe de référence : l'axe des pôles, ou l'axe x près des pôles.
  const ref = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  // Deux directions perpendiculaires au centre, pour mesurer les angles autour de lui.
  const e1 = norm(cross(ref, center)), e2 = cross(center, e1);
  // byAngle : range une liste de points par angle autour du centre (début) :
  const byAngle = (list) => list
    // chaque point avec son angle,
    .map((q) => ({ q, ang: Math.atan2(dot(q, e2), dot(q, e1)) }))
    // triés par angle.
    .sort((u, v) => u.ang - v.ang);
  // Coins et milieux triés.
  const sc = byAngle(corners), sm = byAngle(mids);
  // Contour : les coins et les milieux alternent. On part du coin de plus petit angle ; le milieu qui le suit est le
  // premier milieu d'angle supérieur (ou le tout premier, après un tour complet).
  // Premier milieu d'angle supérieur à celui du premier coin.
  let first = sm.findIndex((m) => m.ang > sc[0].ang);
  // Aucun : le tout premier milieu.
  if (first < 0) first = 0;
  // Contour.
  const ring = [];
  // Alterne un coin et le milieu qui le suit.
  for (let n = 0; n < sc.length; n++) ring.push(sc[n].q, sm[(first + n) % sm.length].q);
  // Rayon angulaire : 0 au départ.
  let rho = 0;
  // Le plus grand angle entre le centre et un coin.
  for (const { q } of sc) rho = Math.max(rho, Math.acos(clamp1(dot(center, q))));
  // Renvoie la cellule (début).
  return {
    // Sa fréquence, son niveau, sa clé, son centre, et si c'est un pentagone.
    f, level: hexLevel(f), key: keyAt(center, f), center, pentagon: sc.length === 5,
    // Ses coins, ses milieux et son contour.
    corners: sc.map((s) => s.q), mids: sm.map((s) => s.q), ring,
    // Son rayon angulaire et le rayon de sa sphère englobante.
    rho, bound: 2 * Math.sin(rho / 2) + 1e-9,
    // Polaire : 1 au pôle nord, −1 au pôle sud, 0 ailleurs.
    polar: center[1] > 1 - 1e-12 ? 1 : center[1] < -1 + 1e-12 ? -1 : 0,
  // Fin de la cellule.
  };
// Fin de hexCell.
}

/**
 * Enfants d'une cellule, deux fois plus petits : celui du centre, puis un par côté (à cheval sur la cellule voisine,
 * donc partagé avec elle). Ensemble, ils recouvrent toute la cellule.
 */
// Déclare et exporte hexChildren : la cellule.
export function hexChildren(cell) {
  // Fréquence double.
  const f = cell.f * 2;
  // Renvoie l'enfant du centre, puis un enfant par milieu de côté.
  return [hexCell(cell.center, f), ...cell.mids.map((m) => hexCell(m, f))];
// Fin de hexChildren.
}

// Cellules du niveau 0 : pas encore calculées.
let roots = null;
/** Les 42 cellules du niveau 0. */
// Déclare et exporte hexRoots.
export function hexRoots() {
  // Au premier appel : calcule les cellules du niveau 0 à partir du découpage complet.
  if (!roots) roots = buildHexGrid(HEX_ROOT_FREQUENCY).cells.map((c) => hexCell(c.center, HEX_ROOT_FREQUENCY));
  // Les renvoie.
  return roots;
// Fin de hexRoots.
}

// Cellules déjà calculées (le calcul d'une cellule coûte quelques microsecondes, mais la sélection en revoit des
// centaines à chaque mouvement de caméra).
// Nombre maximal de cellules gardées dans le cache des enfants : 6000.
const CELL_CACHE_MAX = 6000;
// Cache des enfants, par clé de cellule.
const cellCache = new Map();
// childrenOf : les enfants d'une cellule, gardés en cache (début).
function childrenOf(cell) {
  // Enfants déjà calculés.
  let kids = cellCache.get(cell.key);
  // Sinon (début).
  if (!kids) {
    // Cache plein : il est vidé.
    if (cellCache.size >= CELL_CACHE_MAX) cellCache.clear();
    // Calcule les enfants.
    kids = hexChildren(cell);
    // Les range dans le cache.
    cellCache.set(cell.key, kids);
  // Fin de ce cas.
  }
  // Les renvoie.
  return kids;
// Fin de childrenOf.
}

/**
 * Choisit les cellules à afficher pour une caméra donnée (même principe que selectTiles, quadtree.jsx) : une cellule
 * trop grande à l'écran est remplacée par ses enfants. Les cellules cachées par l'horizon ou hors du champ de la caméra
 * sont écartées.
 *
 * @param {object} view  cam, fovY, viewportH, inFrustum (comme selectTiles) ; `planes` : les plans du champ de la caméra
 *                       dans le repère de l'astre, [nx, ny, nz, d] tournés vers l'intérieur. Avec eux, une cellule n'est
 *                       gardée que si elle touche vraiment le champ (test sur son contour, vue de dessus comme vue 3/4),
 *                       au lieu du test plus large par sphère englobante.
 * @param {object} [opts]
 *  cellPx      largeur maximale d'une cellule à l'écran, en pixels (480)
 *  maxCells    au-delà, la largeur tolérée augmente (160)
 *  canRefine   (cellule, distance) => bool : faux quand les images ne peuvent pas être plus fines pour cette cellule
 *  foreshorten vrai par défaut : une cellule vue de biais (vue 3/4, près de l'horizon) est écrasée à l'écran ; elle
 *              compte pour moins de pixels, donc elle est moins redécoupée et demande des images moins fines
 *  lift        hauteur maximale du relief, en rayons (0 à plat) : une cellule sous le bord de l'écran dont les
 *              montagnes dépassent dans le champ est gardée
 * @returns {Array<object>} cellules (voir hexCell) avec `d` = distance à la caméra et `near` = distance utile pour le
 *          niveau de ses images (voir cellZoom), de la plus proche à la plus lointaine
 */
// Déclare et exporte selectHexCells : la vue et les options.
export function selectHexCells(view, opts = {}) {
  // Nombre maximal de cellules : 160 par défaut.
  const { maxCells = 160 } = opts;
  // Résultat, et largeur maximale d'une cellule à l'écran : 480 pixels par défaut.
  let out = [], cellPx = opts.cellPx ?? 480;
  // Six passages au plus, la largeur étant multipliée par 1,5 à chaque fois (début).
  for (let i = 0; i < 6; i++, cellPx *= 1.5) {
    // Sélection avec cette largeur ; les cinq premiers passages s'arrêtent dès que la limite est dépassée.
    out = selectAt(view, { ...opts, cellPx }, i < 5 ? maxCells : Infinity);
    // Si le nombre de cellules tient dans la limite : terminé.
    if (out.length <= maxCells) break;
  // Fin de la boucle.
  }
  // Renvoie le résultat, coupé à la limite s'il la dépasse encore.
  return out.length > maxCells ? out.slice(0, maxCells) : out;
// Fin de selectHexCells.
}

/**
 * La cellule est-elle entièrement hors du champ de la caméra ? Vrai si son centre et tout son contour sont du mauvais
 * côté d'un même plan du champ. Marge : la surface bombée dépasse un peu de ces points (flèche ≈ rho² / 8).
 */
// Déclare et exporte cellOutside : la cellule, les plans du champ et la hauteur du relief.
export function cellOutside(cell, planes, lift = 0) {
  // Marge : la flèche de la surface bombée.
  const margin = (cell.rho * cell.rho) / 8 + 1e-12;
  // Facteur de hauteur du relief.
  const up = 1 + lift;
  // Pour chaque plan du champ (début).
  for (const [nx, ny, nz, d] of planes) {
    // La cellule est supposée hors de ce plan.
    let out = true;
    // Son centre.
    const c = cell.center;
    // Projection du centre sur la normale du plan.
    const sc = nx * c[0] + ny * c[1] + nz * c[2];
    // Centre du bon côté, au sol ou à la hauteur du relief : plan suivant.
    if (sc + d >= -margin || sc * up + d >= -margin) continue;
    // Pour chaque point du contour (début).
    for (const p of cell.ring) {
      // Sa projection sur la normale du plan.
      const s = nx * p[0] + ny * p[1] + nz * p[2];
      // Du bon côté : la cellule n'est pas hors de ce plan.
      if (s + d >= -margin || s * up + d >= -margin) { out = false; break; }
    // Fin de la boucle du contour.
    }
    // Tout est du mauvais côté de ce plan : hors du champ.
    if (out) return true;
  // Fin de la boucle des plans.
  }
  // Sinon : pas hors du champ.
  return false;
// Fin de cellOutside.
}

// selectAt : un passage de sélection, avec une limite de cellules (début).
function selectAt(view, opts, limit) {
  // Options avec leurs valeurs par défaut : niveau maximal 22, pas de relief, écrasement pris en compte.
  const { cellPx, canRefine, maxLevel = 22, lift = 0, foreshorten = true } = opts;
  // La caméra, le champ, la hauteur de l'écran, le test large et les plans.
  const { cam, fovY, viewportH, inFrustum, planes } = view;
  // Distance de la caméra au centre.
  const camLen = Math.hypot(cam[0], cam[1], cam[2]);
  // Caméra à la surface ou à l'intérieur : aucune cellule.
  if (!(camLen > 1)) return [];
  // Pixels par unité de longueur vue à une distance de 1.
  const pxPerUnit = viewportH / (2 * Math.tan(fovY / 2));
  // Angle de l'horizon.
  const horizon = Math.acos(1 / camLen);
  // Direction unitaire de la caméra.
  const dir = [cam[0] / camLen, cam[1] / camLen, cam[2] / camLen];
  // Cellules retenues et clés déjà vues.
  const out = [], seen = new Set();
  // Indicateur de dépassement de la limite.
  let overflow = false;
  // visit : examine une cellule (début).
  const visit = (cell) => {
    // Limite dépassée ou cellule déjà vue : arrêt.
    if (overflow || seen.has(cell.key)) return;
    // Note la cellule.
    seen.add(cell.key);
    // Son centre.
    const c = cell.center;
    // Au-delà de l'horizon plus son rayon : cachée.
    if (Math.acos(clamp1(dot(dir, c))) > horizon + cell.rho) return;
    // Avec les plans : écartée si elle est hors du champ ; sinon, écartée par le test large.
    if (planes) { if (cellOutside(cell, planes, lift)) return; } else if (inFrustum && !inFrustum(c, cell.bound)) return;
    // Distance de la caméra au centre de la cellule.
    const dist = Math.hypot(cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]);
    // Distance utile : jusqu'au bord le plus proche, jamais nulle.
    let near = Math.max(dist - cell.bound, 1e-9);
    // Pour une cellule vue de biais et assez loin (début).
    if (foreshorten && dist > cell.bound * 2) {
      // Écrasement à l'écran d'une surface vue de biais : cosinus de l'angle entre le regard et la verticale du lieu.
      // Racine carrée : seule la profondeur est écrasée, pas la largeur. Jamais moins de la moitié (un niveau).
      // Cosinus de l'angle entre le regard et la verticale du lieu.
      const cosI = -((c[0] - cam[0]) * c[0] + (c[1] - cam[1]) * c[1] + (c[2] - cam[2]) * c[2]) / dist;
      // La distance utile est divisée par la racine de ce cosinus, jamais moins de 0,5.
      near /= Math.max(0.5, Math.sqrt(Math.max(0, cosI)));
    // Fin de ce cas.
    }
    // Largeur de la cellule à l'écran, en pixels.
    const px = ((2 * cell.bound) / near) * pxPerUnit;
    // Trop large, sous le niveau maximal, et des images plus fines existent (début).
    if (px > cellPx && cell.level < maxLevel && (!canRefine || canRefine(cell, near))) {
      // Examine ses enfants.
      for (const kid of childrenOf(cell)) visit(kid);
    // Sinon (début).
    } else {
      // Retient la cellule, avec sa distance et sa distance utile.
      out.push({ ...cell, d: dist, near });
      // Limite dépassée : le note.
      if (out.length > limit) overflow = true;
    // Fin du choix.
    }
  // Fin de visit.
  };
  // Examine chaque cellule du niveau 0.
  for (const r of hexRoots()) visit(r);
  // Trie de la plus proche à la plus lointaine.
  out.sort((a, b) => a.d - b.d);
  // Renvoie les cellules.
  return out;
// Fin de selectAt.
}

// ------------------------------------------------------------------ cellule ↔ images carrées

/** Colonne (fractionnaire) d'une longitude dans le découpage `proj` au niveau z. */
// Déclare et exporte colOf : la colonne, avec décimales, d'une longitude.
export const colOf = (proj, z, lon) => ((lon + 180) / 360) * proj.cols(z);
/** Rangée (fractionnaire, 0 au Nord) d'une latitude. En Mercator, au-delà de ±85,05° : la première ou la dernière. */
// Déclare et exporte rowOf : la projection, le niveau et la latitude.
export function rowOf(proj, z, lat) {
  // Nombre de rangées à ce niveau.
  const rows = proj.rows(z);
  // Hors Mercator : rangée proportionnelle à la latitude.
  if (proj.id !== MERCATOR.id) return ((90 - lat) / 180) * rows;
  // Latitude bornée à celle de Mercator, en radians.
  const la = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat)) * RAD;
  // Rangée par la formule de Mercator.
  return ((1 - Math.asinh(Math.tan(la)) / Math.PI) / 2) * rows;
// Fin de rowOf.
}

/**
 * Emprise d'une cellule en degrés. `west` et `east` sont donnés autour de la longitude du centre (ils peuvent donc
 * sortir de ±180° quand la cellule est à cheval sur l'antiméridien). Une cellule polaire couvre toutes les longitudes.
 */
// Déclare et exporte cellBox : la cellule.
export function cellBox(cell) {
  // Longitude du centre.
  const [clon] = xyzToLonLat(cell.center);
  // Limites, relatives au centre en longitude.
  let west = 0, east = 0, south = 90, north = -90;
  // Pour le centre et chaque point du contour (début).
  for (const p of [cell.center, ...cell.ring]) {
    // Sa longitude et sa latitude.
    const [lon, lat] = xyzToLonLat(p);
    // Écart de longitude avec le centre.
    let d = lon - clon;
    // Ramené entre −180° et 180°.
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    // Limite ouest.
    if (d < west) west = d;
    // Limite est.
    if (d > east) east = d;
    // Limite sud.
    if (lat < south) south = lat;
    // Limite nord.
    if (lat > north) north = lat;
  // Fin de la boucle.
  }
  // Marge de 8 % : les côtés sont des arcs de grand cercle, qui débordent un peu du rectangle de leurs extrémités.
  // Marges de 8 % en latitude et en longitude.
  const padLat = (north - south) * 0.08, padLon = (east - west) * 0.08;
  // Limites sud et nord élargies, sans dépasser les pôles.
  south = Math.max(-90, south - padLat); north = Math.min(90, north + padLat);
  // Cellule polaire : toutes les longitudes, jusqu'au pôle.
  if (cell.polar) return { west: -180, east: 180, south: cell.polar > 0 ? south : -90, north: cell.polar > 0 ? 90 : north, all: true };
  // Sinon : les limites élargies, autour de la longitude du centre.
  return { west: clon + west - padLon, east: clon + east + padLon, south, north, all: false };
// Fin de cellBox.
}

/** Images carrées du niveau z qui recouvrent l'emprise `box` : [{ z, x, y }]. */
// Déclare et exporte tilesForBox : la projection, le niveau et l'emprise.
export function tilesForBox(proj, z, box) {
  // Nombres de colonnes et de rangées.
  const cols = proj.cols(z), rows = proj.rows(z);
  // Première rangée : celle du nord de l'emprise.
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(rowOf(proj, z, box.north) + 1e-9)));
  // Dernière rangée : celle du sud de l'emprise.
  const y1 = Math.max(0, Math.min(rows - 1, Math.ceil(rowOf(proj, z, box.south) - 1e-9) - 1));
  // Première colonne : celle de l'ouest.
  let x0 = Math.floor(colOf(proj, z, box.west) + 1e-9);
  // Dernière colonne : celle de l'est.
  let x1 = Math.ceil(colOf(proj, z, box.east) - 1e-9) - 1;
  // Emprise qui fait le tour : toutes les colonnes.
  if (box.all || x1 - x0 + 1 >= cols) { x0 = 0; x1 = cols - 1; }
  // Liste des images.
  const out = [];
  // Pour chaque rangée (début).
  for (let y = y0; y <= Math.max(y0, y1); y++) {
    // Pour chaque colonne : ajoute l'image, la colonne étant ramenée dans le découpage.
    for (let x = x0; x <= Math.max(x0, x1); x++) out.push({ z, x: ((x % cols) + cols) % cols, y });
  // Fin de la boucle.
  }
  // Renvoie la liste.
  return out;
// Fin de tilesForBox.
}

/**
 * Niveau des images d'une cellule : le plus grossier dont un pixel de texture fait moins de `maxSSE` pixels d'écran
 * (même règle que selectTiles), borné à [minZoom, maxZoom].
 */
// Déclare et exporte cellZoom : la projection, la cellule, la distance utile, l'échelle et les options.
export function cellZoom(proj, cell, near, pxPerUnit, { minZoom = 0, maxZoom = 19, maxSSE = 2, tileSize = 256 } = {}) {
  // Latitude du centre.
  const lat = Math.asin(clamp1(cell.center[1])) / RAD;
  // Niveau de départ : le minimum.
  let z = Math.max(0, minZoom);
  // Monte d'un niveau tant qu'un pixel d'image couvre plus de pixels d'écran que le seuil.
  while (z < maxZoom && (proj.groundSize(z, lat) / tileSize / near) * pxPerUnit > maxSSE) z++;
  // Renvoie le niveau.
  return z;
// Fin de cellZoom.
}

/**
 * Images carrées d'une cellule au niveau z ; si elles sont trop nombreuses (cellule polaire, qui touche toutes les
 * longitudes), le niveau baisse jusqu'à en avoir au plus `maxTiles`.
 * @returns {{ z: number, tiles: Array<{z,x,y}> }}
 */
// Déclare et exporte cellTiles : la projection, l'emprise, le niveau, le niveau minimal et le nombre maximal d'images.
export function cellTiles(proj, box, z, minZoom = 0, maxTiles = 16) {
  // Images du niveau.
  let tiles = tilesForBox(proj, z, box);
  // Tant qu'il y en a trop : un niveau de moins.
  while (tiles.length > maxTiles && z > minZoom) { z--; tiles = tilesForBox(proj, z, box); }
  // Renvoie le niveau et les images.
  return { z, tiles };
// Fin de cellTiles.
}

/**
 * Niveaux d'images à essayer pour une cellule dont le niveau voulu est z, dans l'ordre : z, puis les niveaux PLUS
 * FINS (z + 1, z + 2…), puis les plus grossiers. Les plus fins d'abord : quand on dézoome, les images nettes déjà à
 * l'écran restent affichées jusqu'à ce que celles du nouveau niveau soient prêtes, au lieu de revenir un instant à
 * une image floue.
 */
// Déclare et exporte fallbackLevels : le niveau voulu, les bornes et le nombre de niveaux plus fins à essayer (2 par défaut).
export function fallbackLevels(z, minZoom, maxZoom, finer = 2) {
  // Le niveau voulu d'abord.
  const out = [z];
  // Puis les niveaux plus fins.
  for (let k = 1; k <= finer && z + k <= maxZoom; k++) out.push(z + k);
  // Puis les niveaux plus grossiers, du plus proche au minimum.
  for (let k = z - 1; k >= minZoom; k--) out.push(k);
  // Renvoie la liste.
  return out;
// Fin de fallbackLevels.
}

// ------------------------------------------------------------------ maillage d'une cellule

/**
 * Maillage d'une cellule sur la sphère : éventail de triangles du centre vers le contour, chaque triangle redécoupé
 * en n × n pour suivre la courbure (et le relief). Triangles indépendants (sans index) : chaque sommet porte la
 * longitude et la latitude qui servent à calculer sa position dans chaque image carrée (voir cellUVs).
 * Comme les tuiles carrées, les positions sont RELATIVES au centre de la cellule (précision au zoom maximal).
 * @returns {{ center, positions: Float32Array, normals: Float32Array, lonLat: Float64Array, count: number }}
 *          lonLat : (lon°, lat°) par sommet ; un sommet posé exactement sur un pôle a pour longitude NaN.
 */
// Déclare et exporte buildCellMesh : la cellule et le nombre minimal de segments.
export function buildCellMesh(cell, minSegments = 1) {
  // Nombre de segments : un par degré de rayon, au moins le minimum, entre 1 et 12.
  const n = Math.max(1, Math.min(12, Math.max(Math.floor(minSegments), Math.ceil(cell.rho / RAD))));
  // Le centre et le contour.
  const { center, ring } = cell;
  // Nombre de petits triangles.
  const tris = ring.length * n * n;
  // Tableaux des positions, des normales et des longitudes/latitudes.
  const positions = new Float32Array(tris * 9), normals = new Float32Array(tris * 9), lonLat = new Float64Array(tris * 6);
  // Indices d'écriture.
  let p = 0, q = 0;
  // put : écrit un sommet (début).
  const put = (v) => {
    // Sa position, relative au centre.
    positions[p] = v[0] - center[0]; positions[p + 1] = v[1] - center[1]; positions[p + 2] = v[2] - center[2];
    // Sa normale.
    normals[p] = v[0]; normals[p + 1] = v[1]; normals[p + 2] = v[2];
    // Sommet suivant.
    p += 3;
    // Sa longitude et sa latitude.
    const [lon, lat] = xyzToLonLat(v);
    // La longitude, ou NaN sur un pôle.
    lonLat[q++] = Math.abs(v[1]) > 1 - 1e-12 ? NaN : lon;
    // La latitude.
    lonLat[q++] = lat;
  // Fin de put.
  };
  // Pour chaque côté du contour (début).
  for (let s = 0; s < ring.length; s++) {
    // Le triangle : le centre et deux points voisins du contour.
    const A = center, B = ring[s], C = ring[(s + 1) % ring.length];
    // at : point du triangle à a pas vers B et b pas vers C, sur la sphère.
    const at = (a, b) => norm(mix3(A, B, C, n - a - b, a, b));
    // Pour chaque rangée (début).
    for (let a = 0; a < n; a++) {
      // Pour chaque position de la rangée (début).
      for (let b = 0; a + b < n; b++) {
        // Le petit triangle de même sens.
        put(at(a, b)); put(at(a + 1, b)); put(at(a, b + 1));
        // Le petit triangle retourné, s'il existe.
        if (a + b < n - 1) { put(at(a + 1, b)); put(at(a + 1, b + 1)); put(at(a, b + 1)); }
      // Fin de la boucle des positions.
      }
    // Fin de la boucle des rangées.
    }
  // Fin de la boucle des côtés.
  }
  // Renvoie le maillage.
  return { center, positions, normals, lonLat, count: tris * 3 };
// Fin de buildCellMesh.
}

/**
 * Coordonnées de texture des sommets d'une cellule dans l'image carrée (z, x, y) : (u, v) avec v = 1 au Nord, comme
 * les tuiles carrées. Hors de l'image, u ou v sortent de [0, 1] : le shader n'y dessine rien, une autre image de la
 * cellule s'en charge. Calcul triangle par triangle : les longitudes sont ramenées du même côté de l'antiméridien que
 * l'image (le triangle entier, d'un bloc), et un sommet posé sur un pôle prend la longitude moyenne des deux autres.
 */
// Déclare et exporte cellUVs : le maillage, la projection et l'image.
export function cellUVs(mesh, proj, z, x, y) {
  // Les longitudes/latitudes et le nombre de sommets.
  const { lonLat, count } = mesh;
  // Tableau des coordonnées de texture.
  const uvs = new Float32Array(count * 2);
  // Nombre de colonnes du niveau.
  const cols = proj.cols(z);
  // Longitude du centre de l'image.
  const tileLon = ((x + 0.5) / cols) * 360 - 180;
  // Longitudes des trois sommets du triangle en cours.
  const lon = [0, 0, 0];
  // Pour chaque triangle (début).
  for (let t = 0; t < count; t += 3) {
    // 1. Les sommets du triangle sont d'abord ramenés du même côté de l'antiméridien les uns que les autres…
    // Longitude de référence, somme et nombre de longitudes connues.
    let ref = NaN, sum = 0, known = 0;
    // Pour chacun de ses trois sommets (début).
    for (let k = 0; k < 3; k++) {
      // Sa longitude.
      let l = lonLat[(t + k) * 2];
      // Si elle est définie (début).
      if (!Number.isNaN(l)) {
        // La première sert de référence.
        if (Number.isNaN(ref)) ref = l;
        // Elle est ramenée à moins d'un demi-tour de la référence.
        l -= 360 * Math.round((l - ref) / 360);
        // Ajoutée à la somme.
        sum += l; known++;
      // Fin de ce cas.
      }
      // La garde.
      lon[k] = l;
    // Fin de la boucle des sommets.
    }
    // 2. … puis le triangle entier est ramené du côté de l'image (jamais sommet par sommet : un triangle proche de
    // l'antiméridien serait sinon étiré tout autour du globe pour une image éloignée).
    // Longitude moyenne du triangle, ou celle de l'image si aucune n'est définie.
    const mean = known ? sum / known : tileLon;
    // Nombre de tours à retirer pour se placer du côté de l'image.
    const shift = 360 * Math.round((mean - tileLon) / 360);
    // Pour chacun des trois sommets (début).
    for (let k = 0; k < 3; k++) {
      // Sa longitude, la moyenne pour un pôle, décalée du même nombre de tours.
      const l = (Number.isNaN(lon[k]) ? mean : lon[k]) - shift;
      // Coordonnée u : sa colonne, relative à l'image.
      uvs[(t + k) * 2] = colOf(proj, z, l) - x;
      // Coordonnée v : 1 au nord de l'image.
      uvs[(t + k) * 2 + 1] = 1 - (rowOf(proj, z, lonLat[(t + k) * 2 + 1]) - y);
    // Fin de la boucle des sommets.
    }
  // Fin de la boucle des triangles.
  }
  // Renvoie les coordonnées.
  return uvs;
// Fin de cellUVs.
}

/** Marge autour d'une image, en fraction de son côté (un demi-pixel de texture) : pas de fente entre deux images. */
// Déclare et exporte la marge autour d'une image : 0,002.
export const TILE_CLIP_MARGIN = 0.002;

/**
 * Découpe le maillage d'une cellule au bord d'une image carrée : ne garde que la partie de chaque triangle qui est
 * dans l'image (u et v entre 0 et 1, à la marge près). Le GPU ne dessine alors que là où l'image existe, au lieu de
 * dessiner toute la cellule pour chaque image et de jeter les pixels hors de l'image.
 * Les sommets créés sur le bord sont interpolés le long des arêtes : la surface dessinée reste la même.
 * @param mesh  maillage de buildCellMesh    @param uvs  coordonnées de cellUVs pour cette image
 * @returns {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, count: number }}  count = 0 si
 *          l'image ne touche pas la cellule
 */
// Déclare et exporte clipCellToTile : le maillage, ses coordonnées de texture et la marge.
export function clipCellToTile(mesh, uvs, margin = TILE_CLIP_MARGIN) {
  // Les positions, les normales et le nombre de sommets.
  const { positions, normals, count } = mesh;
  // Bornes basse et haute, marge comprise.
  const lo = -margin, hi = 1 + margin;
  // Sommets gardés.
  const out = [];        // sommets gardés : 8 nombres chacun (position, normale, u, v)
  // Polygone en cours et polygone suivant.
  let poly = [], next = [];
  // Garde la partie du polygone où s·(valeur − limite) ≥ 0, valeur = u (axe 6) ou v (axe 7).
  // cut : coupe le polygone par une limite sur un axe (début).
  const cut = (axis, limit, sign) => {
    // Vide le polygone suivant.
    next.length = 0;
    // Pour chaque arête du polygone (début).
    for (let i = 0; i < poly.length; i++) {
      // Ses deux bouts.
      const a = poly[i], b = poly[(i + 1) % poly.length];
      // Leur distance signée à la limite.
      const da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
      // Premier bout du bon côté : gardé.
      if (da >= 0) next.push(a);
      // Si l'arête traverse la limite (début).
      if ((da >= 0) !== (db >= 0)) {
        // Position du croisement le long de l'arête.
        const t = da / (da - db);
        // Nouveau sommet.
        const m = new Array(8);
        // Ses huit valeurs, interpolées.
        for (let k = 0; k < 8; k++) m[k] = a[k] + (b[k] - a[k]) * t;
        // L'ajoute.
        next.push(m);
      // Fin de ce cas.
      }
    // Fin de la boucle.
    }
    // Échange les deux polygones.
    const swap = poly; poly = next; next = swap;
  // Fin de cut.
  };
  // Pour chaque triangle du maillage (début).
  for (let v = 0; v < count; v += 3) {
    // Les coordonnées u de ses trois sommets.
    const u0 = uvs[v * 2], u1 = uvs[v * 2 + 2], u2 = uvs[v * 2 + 4];
    // Leurs coordonnées v.
    const w0 = uvs[v * 2 + 1], w1 = uvs[v * 2 + 3], w2 = uvs[v * 2 + 5];
    // Triangle entièrement hors de l'image, d'un même côté : rien à dessiner.
    // Triangle entièrement d'un même côté hors de l'image, en u
    if ((u0 < lo && u1 < lo && u2 < lo) || (u0 > hi && u1 > hi && u2 > hi)
      // ou en v : ignoré.
      || (w0 < lo && w1 < lo && w2 < lo) || (w0 > hi && w1 > hi && w2 > hi)) continue;
    // Vide le polygone.
    poly.length = 0;
    // Pour chacun des trois sommets (début).
    for (let k = 0; k < 3; k++) {
      // Son indice dans les tableaux.
      const i = (v + k) * 3;
      // L'ajoute au polygone : position, normale et coordonnées de texture.
      poly.push([positions[i], positions[i + 1], positions[i + 2], normals[i], normals[i + 1], normals[i + 2], uvs[(v + k) * 2], uvs[(v + k) * 2 + 1]]);
    // Fin de la boucle.
    }
    // Triangle entièrement dans l'image, en u
    const inside = u0 >= lo && u1 >= lo && u2 >= lo && u0 <= hi && u1 <= hi && u2 <= hi
      // et en v.
      && w0 >= lo && w1 >= lo && w2 >= lo && w0 <= hi && w1 <= hi && w2 <= hi;
    // Sinon (début).
    if (!inside) {
      // Coupe par les limites basse et haute de u.
      cut(6, lo, 1); if (poly.length >= 3) cut(6, hi, -1);
      // Coupe par les limites basse et haute de v.
      if (poly.length >= 3) cut(7, lo, 1); if (poly.length >= 3) cut(7, hi, -1);
      // Moins de trois sommets restants : ignoré.
      if (poly.length < 3) continue;
    // Fin de ce cas.
    }
    // Polygone convexe → éventail de triangles.
    // Découpe le polygone en triangles autour de son premier sommet.
    for (let k = 1; k + 1 < poly.length; k++) out.push(poly[0], poly[k], poly[k + 1]);
  // Fin de la boucle des triangles.
  }
  // Nombre de sommets gardés.
  const n = out.length;
  // Tableaux du résultat.
  const res = { positions: new Float32Array(n * 3), normals: new Float32Array(n * 3), uvs: new Float32Array(n * 2), count: n };
  // Pour chaque sommet gardé (début).
  for (let i = 0; i < n; i++) {
    // Le sommet.
    const q = out[i];
    // Sa position.
    res.positions[i * 3] = q[0]; res.positions[i * 3 + 1] = q[1]; res.positions[i * 3 + 2] = q[2];
    // Sa normale.
    res.normals[i * 3] = q[3]; res.normals[i * 3 + 1] = q[4]; res.normals[i * 3 + 2] = q[5];
    // Ses coordonnées de texture.
    res.uvs[i * 2] = q[6]; res.uvs[i * 2 + 1] = q[7];
  // Fin de la boucle.
  }
  // Renvoie le résultat.
  return res;
// Fin de clipCellToTile.
}

/** Centre d'une image carrée sur la sphère (pour sa priorité de chargement). */
// Déclare et exporte tileCenter : la projection et l'image.
export function tileCenter(proj, z, x, y) {
  // Renvoie le point de la sphère au milieu de l'image.
  return lonLatToXYZ((proj.lon(x, z) + proj.lon(x + 1, z)) / 2, proj.lat(y + 0.5, z));
// Fin de tileCenter.
}

/** Profondeur de la jupe d'une cellule, en fraction de son rayon angulaire (comme les tuiles carrées : ≈ 1,5 % de leur taille). */
// Déclare et exporte la profondeur relative de la jupe : 3 % du rayon de la cellule.
export const CELL_SKIRT = 0.03;

/**
 * Ajoute une jupe à un morceau de cellule (sortie de clipCellToTile) : sous chaque arête du bord du morceau, une bande
 * qui descend vers le centre de l'astre. Deux cellules voisines, chacune placée autour de son propre centre en nombres
 * de 32 bits, ne tombent pas exactement sur les mêmes sommets : sans jupe, leurs coins laissent de minuscules trous
 * par lesquels on voit la sphère de fond (une grille de points clairs sur tout le globe). La jupe reprend l'image de
 * la cellule (mêmes coordonnées de texture que le bord) : le trou montre la carte, plus le fond.
 * `center` : centre de la cellule (sphère de rayon 1) ; `depth` : profondeur, en rayons de l'astre.
 */
// Déclare et exporte addCellSkirt : le morceau, le centre de la cellule et la profondeur (début).
export function addCellSkirt(part, center, depth) {
  // Rien à faire sans triangle ou sans profondeur.
  if (!part.count || !(depth > 0)) return part;
  // Les tableaux du morceau.
  const { positions: P, normals: N, uvs: U, count } = part;
  // key : clé d'un sommet, sa position arrondie (les sommets partagés ont la même).
  const key = (i) => `${Math.round(P[i * 3] * 1e7)},${Math.round(P[i * 3 + 1] * 1e7)},${Math.round(P[i * 3 + 2] * 1e7)}`;
  // Arêtes : clé non orientée → { nombre de triangles, sommets dans le sens extérieur }.
  const edges = new Map();
  // Pour chaque triangle (début).
  for (let v = 0; v < count; v += 3) {
    // Ses trois sommets.
    const a = v, b = v + 1, c = v + 2;
    // Deux côtés du triangle.
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
    const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    // Sa normale (produit vectoriel).
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    // Vrai si le triangle est vu de l'extérieur dans l'ordre a, b, c (normale du côté du ciel).
    const up = n[0] * (P[a * 3] + center[0]) + n[1] * (P[a * 3 + 1] + center[1]) + n[2] * (P[a * 3 + 2] + center[2]) >= 0;
    // Ses trois arêtes, dans le sens où l'intérieur est à gauche vu du ciel.
    const sides = up ? [[a, b], [b, c], [c, a]] : [[b, a], [c, b], [a, c]];
    // Pour chaque arête (début).
    for (const [i, j] of sides) {
      // Clés de ses deux sommets, et clé de l'arête sans orientation.
      const ki = key(i), kj = key(j), k = ki < kj ? `${ki}|${kj}` : `${kj}|${ki}`;
      // Arête déjà vue : un triangle de plus ; sinon elle est notée avec ses sommets.
      const e = edges.get(k);
      if (e) e.n++; else edges.set(k, { n: 1, i, j });
    // Fin de la boucle des arêtes.
    }
  // Fin de la boucle des triangles.
  }
  // Arêtes du bord : celles d'un seul triangle.
  const border = [...edges.values()].filter((e) => e.n === 1);
  // Aucun bord : morceau inchangé.
  if (!border.length) return part;
  // Nombre de sommets avec la jupe : six par arête du bord.
  const total = count + border.length * 6;
  // Nouveaux tableaux, qui reprennent le morceau.
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  pos.set(P); nor.set(N); uv.set(U);
  // Sommet suivant à écrire.
  let w = count;
  // put : écrit le sommet i du morceau, enfoncé ou non.
  const put = (i, down) => {
    // Position relative au centre ; enfoncée : ramenée vers le centre de l'astre de `depth` rayons.
    for (let k = 0; k < 3; k++) pos[w * 3 + k] = down ? P[i * 3 + k] * (1 - depth) - center[k] * depth : P[i * 3 + k];
    // Même normale et même coordonnée de texture que le sommet du bord.
    nor[w * 3] = N[i * 3]; nor[w * 3 + 1] = N[i * 3 + 1]; nor[w * 3 + 2] = N[i * 3 + 2];
    uv[w * 2] = U[i * 2]; uv[w * 2 + 1] = U[i * 2 + 1];
    // Sommet suivant.
    w++;
  // Fin de put.
  };
  // Pour chaque arête du bord i → j : deux triangles tournés vers l'extérieur de la cellule (i, i', j') et (i, j', j).
  for (const { i, j } of border) { put(i, false); put(i, true); put(j, true); put(i, false); put(j, true); put(j, false); }
  // Renvoie le morceau avec sa jupe.
  return { positions: pos, normals: nor, uvs: uv, count: total };
// Fin de addCellSkirt.
}

