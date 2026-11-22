/**
 * Découpe exacte des cellules hexagonales entre deux niveaux.
 *
 * Une cellule redécoupée a sept enfants : celui du centre, et six posés à cheval sur ses côtés (voir hexChildren).
 * Quand la voisine n'est pas redécoupée, un enfant à cheval déborde à moitié sur elle : deux cellules de niveaux
 * différents se chevauchent, et le bord entre deux niveaux dessine des dents de scie hexagonales.
 *
 * Ici, chaque enfant est coupé au contour EXACT de sa cellule mère (telle qu'elle est dessinée : éventail de
 * triangles du centre vers le contour). Les morceaux obtenus recouvrent la mère sans trou ni recouvrement, à tous
 * les niveaux, sur tous les astres. Un morceau est une liste de polygones convexes sur la sphère de rayon 1.
 */

// Normalise un vecteur (longueur 1).
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// Produit scalaire.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Produit vectoriel.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Tolérance des tests de côté (un point posé sur un bord compte comme dedans).
const SIDE_EPS = 1e-12;
// Part minimale de l'aire d'une cellule pour garder un morceau : en dessous, c'est un éclat numérique.
const MIN_AREA_SHARE = 1e-7;

/** Centre d'un polygone : moyenne de ses sommets, ramenée sur la sphère. */
export function polyCentroid(poly) {
  // Somme des sommets.
  let x = 0, y = 0, z = 0;
  // Chaque sommet.
  for (const p of poly) { x += p[0]; y += p[1]; z += p[2]; }
  // Moyenne normalisée.
  return norm([x, y, z]);
// Fin de polyCentroid.
}

/**
 * Aire d'un polygone convexe sur la sphère de rayon 1 (excès sphérique, éventail depuis le premier sommet). Exacte :
 * redécouper un polygone ne change pas la somme des aires (ce que ferait une aire mesurée sur les cordes).
 */
export function polyArea(poly) {
  // Aire cumulée.
  let area = 0;
  // Premier sommet.
  const a = poly[0];
  // Chaque triangle de l'éventail.
  for (let i = 1; i + 1 < poly.length; i++) {
    // Ses deux autres sommets.
    const b = poly[i], c = poly[i + 1];
    // Produit mixte : volume du triangle vu du centre.
    const triple = Math.abs(dot(a, cross(b, c)));
    // Excès sphérique du triangle (formule de Van Oosterom et Strackee).
    area += 2 * Math.atan2(triple, 1 + dot(a, b) + dot(b, c) + dot(c, a));
  // Fin des triangles.
  }
  // Rend l'aire.
  return area;
// Fin de polyArea.
}

/** Plans d'un polygone convexe : un par côté, passant par le centre de l'astre, normale tournée vers l'intérieur. */
export function polyPlanes(poly) {
  // Centre du polygone, pour orienter les normales.
  const c = polyCentroid(poly);
  // Un plan par côté.
  return poly.map((p, i) => {
    // Normale du grand cercle qui porte le côté.
    const n = cross(p, poly[(i + 1) % poly.length]);
    // Tournée vers l'intérieur du polygone.
    return dot(n, c) >= 0 ? n : [-n[0], -n[1], -n[2]];
  // Fin des plans.
  });
// Fin de polyPlanes.
}

/**
 * Coupe un polygone convexe par un autre (Sutherland-Hodgman sur la sphère : chaque côté du second est un plan qui
 * passe par le centre de l'astre). Les points créés sont sur la sphère et sur le plan de coupe.
 * @returns {number[][] | null} le polygone commun, ou null s'il est vide
 */
export function clipConvex(subject, planes) {
  // Polygone courant.
  let poly = subject;
  // Chaque plan de coupe.
  for (const n of planes) {
    // Polygone après cette coupe.
    const next = [];
    // Chaque côté du polygone courant.
    for (let i = 0; i < poly.length; i++) {
      // Ses deux extrémités.
      const a = poly[i], b = poly[(i + 1) % poly.length];
      // Leur côté du plan.
      const da = dot(n, a), db = dot(n, b);
      // Extrémité de départ dedans : gardée.
      if (da >= -SIDE_EPS) next.push(a);
      // Le côté traverse le plan : ajoute le point de traversée.
      if ((da >= -SIDE_EPS) !== (db >= -SIDE_EPS)) {
        // Position de la traversée le long de la corde.
        const t = da / (da - db);
        // Point de la corde ramené sur la sphère (il reste sur le plan, qui passe par le centre).
        next.push(norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
      // Fin de la traversée.
      }
    // Fin des côtés.
    }
    // Moins de trois sommets : plus rien.
    if (next.length < 3) return null;
    // Polygone suivant.
    poly = next;
  // Fin des plans.
  }
  // Rend le polygone commun.
  return poly;
// Fin de clipConvex.
}

/** Triangles d'une cellule entière, tels qu'elle est dessinée : du centre vers chaque côté du contour (mis en cache). */
export function cellFan(cell) {
  // Déjà calculés : les mêmes.
  if (cell.fan) return cell.fan;
  // Un triangle par côté du contour.
  const fan = cell.ring.map((p, i) => [cell.center, p, cell.ring[(i + 1) % cell.ring.length]]);
  // Gardés sur la cellule (les cellules sont elles-mêmes en cache).
  Object.defineProperty(cell, 'fan', { value: fan, enumerable: false });
  // Rend les triangles.
  return fan;
// Fin de cellFan.
}

/** Polygones convexes qui forment une cellule ou un morceau : les siens, sinon l'éventail de la cellule entière. */
export const regionPolys = (cell) => cell.polys || cellFan(cell);

/** Plans des polygones d'une région, calculés une fois et gardés sur la région. */
function regionPlanes(cell) {
  // Déjà calculés : les mêmes.
  if (cell.planes) return cell.planes;
  // Les plans de chaque polygone.
  const planes = regionPolys(cell).map(polyPlanes);
  // Gardés sur la région, sans apparaître dans ses copies.
  Object.defineProperty(cell, 'planes', { value: planes, enumerable: false });
  // Rend les plans.
  return planes;
// Fin de regionPlanes.
}

/**
 * Partie d'un enfant qui est dans sa mère.
 * @param kid    cellule entière de niveau fin (hexCell)
 * @param parent cellule entière ou morceau du niveau au-dessus
 * @returns l'enfant lui-même s'il est entièrement dans la mère, un morceau (copie de l'enfant avec `polys`,
 *          `hex` = l'enfant entier, `hexKey`, un centre, un contour et un rayon recalculés), ou null s'il n'y a rien
 */
export function clipKidToParent(kid, parent) {
  // Triangles de l'enfant.
  const kidFan = cellFan(kid);
  // Aire de l'enfant entier.
  const kidArea = kidFan.reduce((s, t) => s + polyArea(t), 0);
  // Plans des polygones de la mère.
  const parentPlanes = regionPlanes(parent);
  // Polygones communs.
  const polys = [];
  // Aire commune.
  let area = 0;
  // Chaque triangle de l'enfant.
  for (const tri of kidFan) {
    // Chaque polygone convexe de la mère.
    for (const planes of parentPlanes) {
      // Leur partie commune.
      const part = clipConvex(tri, planes);
      // Vide : suivant.
      if (!part) continue;
      // Son aire.
      const a = polyArea(part);
      // Éclat numérique : ignoré.
      if (a <= kidArea * MIN_AREA_SHARE) continue;
      // Gardé.
      polys.push(part);
      // Aire cumulée.
      area += a;
    // Fin des polygones de la mère.
    }
  // Fin des triangles de l'enfant.
  }
  // Résultat : rien, l'enfant entier, ou un morceau.
  let result;
  // Rien en commun.
  if (!polys.length) result = null;
  // Tout l'enfant est dans la mère : l'enfant lui-même (même clé, mêmes caches que d'habitude).
  else if (area >= kidArea * (1 - 1e-9)) result = kid;
  // Une partie seulement : un morceau.
  else result = makePiece(kid, polys);
  // Rend le résultat.
  return result;
// Fin de clipKidToParent.
}

/**
 * Parties des enfants d'une cellule ou d'un morceau, chacune coupée au contour de la mère (voir clipKidToParent).
 * Calculées une fois et gardées sur la mère : les cellules et les morceaux restent en cache d'une image à l'autre,
 * donc une caméra qui bouge ne refait aucune découpe, sans clé texte à construire.
 * @param parent cellule entière ou morceau
 * @param kids   enfants de la cellule entière (hexChildren, en cache)
 */
export function partsOf(parent, kids) {
  // Déjà calculées pour ces enfants : les mêmes.
  if (parent.parts && parent.parts.kids === kids) return parent.parts.list;
  // Les parties non vides, dans l'ordre des enfants.
  const list = [];
  // Chaque enfant.
  for (const kid of kids) {
    // Sa partie dans la mère.
    const part = clipKidToParent(kid, parent);
    // Gardée si elle existe.
    if (part) list.push(part);
  // Fin des enfants.
  }
  // Gardées sur la mère, sans apparaître dans ses copies.
  Object.defineProperty(parent, 'parts', { value: { kids, list }, enumerable: false, writable: true, configurable: true });
  // Rend les parties.
  return list;
// Fin de partsOf.
}

/** Morceau d'une cellule : mêmes niveau et fréquence, géométrie recalculée sur ses polygones. */
function makePiece(kid, polys) {
  // Tous les sommets du morceau (contour approché, pour les tests de champ et d'emprise).
  const ring = polys.flat();
  // Centre du morceau.
  const center = polyCentroid(ring);
  // Rayon angulaire : du centre au sommet le plus éloigné.
  let rho = 0;
  // Chaque sommet.
  for (const p of ring) rho = Math.max(rho, Math.acos(Math.max(-1, Math.min(1, dot(center, p)))));
  // Clé propre au morceau : celle de la cellule et la position de son centre (deux morceaux d'une même cellule
  // sont disjoints, leurs centres diffèrent).
  const key = `${kid.key}~${Math.round(center[0] * kid.f * 256)},${Math.round(center[1] * kid.f * 256)},${Math.round(center[2] * kid.f * 256)}`;
  // Le morceau.
  return {
    // Niveau et fréquence de la cellule.
    f: kid.f, level: kid.level,
    // Clé du morceau.
    key,
    // Clé de la cellule entière (pour les recherches par point, voir cellKeyOf).
    hexKey: kid.key,
    // La cellule entière (ses enfants sont ceux de la cellule).
    hex: kid,
    // Centre, contour, rayon et sphère englobante du morceau.
    center, ring, rho, bound: 2 * Math.sin(rho / 2) + 1e-9,
    // Pôle contenu : seulement si la cellule le contient et qu'un polygone du morceau le couvre.
    polar: kid.polar && polys.some((poly) => polyPlanes(poly).every((n) => dot(n, [0, kid.polar, 0]) >= -SIDE_EPS)) ? kid.polar : 0,
    // Les polygones convexes du morceau.
    polys,
  // Fin du morceau.
  };
// Fin de makePiece.
}
