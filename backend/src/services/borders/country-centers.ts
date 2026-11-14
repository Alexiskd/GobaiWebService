/* -------------------------------------------------------------------------------------------------
 * Milieu de chaque pays, calculé à partir de ses frontières (TopoJSON world-atlas, objet `countries`).
 *
 * Le « milieu » retenu est le pôle d'inaccessibilité (algorithme polylabel de Mapbox) : le point intérieur le plus
 * éloigné de toutes les frontières et côtes. Contrairement au centroïde, il tombe toujours dans le pays, même pour
 * une forme concave ou en croissant (Chili, Croatie, Norvège…), et c'est là que le nom a le plus de place.
 * Calculé pour chaque morceau d'un pays (continent, îles) : le client garde celui où se trouve son point d'ancrage.
 * ----------------------------------------------------------------------------------------------- */

// Type Point : deux nombres, x et y (ou longitude et latitude).
type Point = [number, number];

// Forme d'un morceau de pays (continent, île).
export interface CountryPart {
  /** Milieu du morceau (pôle d'inaccessibilité), degrés. */
  // lon : longitude de son milieu.
  lon: number;
  // lat : latitude de son milieu.
  lat: number;
  /** Distance du milieu à la frontière la plus proche (degrés de grand cercle, approx.) : place disponible pour le nom. */
  // r : distance du milieu à la frontière la plus proche.
  r: number;
  /** Aire approximative (degrés², longitude corrigée par cos(latitude)). */
  // area : son aire approximative.
  area: number;
  /** Contour extérieur simplifié, liste plate [lon1, lat1, lon2, lat2, …] : sert à savoir dans quel morceau tombe un point. */
  // ring : son contour extérieur simplifié, en liste plate.
  ring: number[];
// Fin de CountryPart.
}

// Forme d'un pays.
export interface CountryShape {
  // id : son code.
  id: string;
  // name : son nom.
  name: string;
  // parts : ses morceaux.
  parts: CountryPart[];
// Fin de CountryShape.
}

// Forme minimale de la topologie dont ce fichier a besoin.
interface TopoLike {
  // objects : pour chaque objet, la liste de ses géométries (type, identifiant, arcs, propriétés).
  objects: Record<string, { geometries?: { type: string; id?: string | number; arcs?: unknown; properties?: Record<string, unknown> }[] }>;
// Fin de TopoLike.
}

/** Morceaux plus petits ignorés (≈ 60 km²) : îlots sans place pour un nom. */
// Aire minimale d'un morceau, en degrés carrés.
const MIN_PART_AREA = 0.005;
/** Tolérance de simplification des contours envoyés au client (degrés). */
// Tolérance de simplification, en degrés.
const RING_TOLERANCE = 0.05;
/** Précision du pôle d'inaccessibilité (degrés, ≈ 1 km). */
// Précision de la recherche du milieu, en degrés.
const PRECISION = 0.01;

/** Anneau à partir de ses indices d'arcs TopoJSON (indice négatif = arc parcouru à l'envers). */
// Fonction ringFromArcs : reconstitue un anneau à partir de ses numéros d'arcs.
function ringFromArcs(indices: number[], arcs: Point[][]): Point[] {
  // Anneau produit.
  const ring: Point[] = [];
  // Pour chaque numéro d'arc :
  for (const i of indices) {
    // un numéro négatif désigne l'arc ~i, pris dans une copie retournée ; sinon l'arc tel quel ; liste vide si l'arc manque.
    const arc = i < 0 ? [...(arcs[~i] ?? [])].reverse() : arcs[i] ?? [];
    // Ajoute ses points ; à partir du deuxième arc, le premier point est sauté, car il répète le dernier point de l'arc précédent.
    for (let k = ring.length ? 1 : 0; k < arc.length; k++) ring.push(arc[k]);
  // Fin de la boucle.
  }
  // Renvoie l'anneau.
  return ring;
// Fin de ringFromArcs.
}

/** Polygones (anneau extérieur puis trous) d'une géométrie Polygon ou MultiPolygon. */
// Fonction polygonsOf : rend les polygones d'une géométrie, chacun fait d'un anneau extérieur puis de ses trous.
function polygonsOf(type: string, arcsIdx: unknown, arcs: Point[][]): Point[][][] {
  // Polygon : un seul polygone, chaque liste d'arcs devient un anneau.
  if (type === 'Polygon') return [(arcsIdx as number[][]).map((r) => ringFromArcs(r, arcs))];
  // MultiPolygon : plusieurs polygones, traités de la même façon.
  if (type === 'MultiPolygon') return (arcsIdx as number[][][]).map((p) => p.map((r) => ringFromArcs(r, arcs)));
  // Tout autre type : aucun polygone.
  return [];
// Fin de polygonsOf.
}

// Fonction signedArea : aire d'un anneau, dont le signe dépend du sens de parcours.
function signedArea(ring: Point[]): number {
  // Somme.
  let s = 0;
  // Pour chaque côté (du point j au point i, j suivant i d'un cran), ajoute le terme de la formule du trapèze.
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  // La moitié de la somme.
  return s / 2;
// Fin de signedArea.
}

/** Distance signée d'un point au polygone (> 0 dedans), anneaux en coordonnées projetées. */
// Fonction pointToPolygonDist : distance d'un point au bord du polygone, positive dedans, négative dehors.
function pointToPolygonDist(x: number, y: number, rings: Point[][]): number {
  // Le point est-il dedans ? Non au départ.
  let inside = false;
  // Plus petite distance au carré trouvée, infinie au départ.
  let minSq = Infinity;
  // Pour chaque anneau (extérieur et trous) :
  for (const ring of rings) {
    // pour chaque côté, du point j au point i :
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      // ses deux extrémités ;
      const a = ring[i], b = ring[j];
      // si une demi-droite horizontale partant du point coupe ce côté, on bascule dedans/dehors (nombre impair de coupes = dedans) ;
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      // et on garde la plus petite distance au carré entre le point et ce côté.
      minSq = Math.min(minSq, segDistSq(x, y, a, b));
    // Fin de la boucle des côtés.
    }
  // Fin de la boucle des anneaux.
  }
  // Renvoie la distance, avec le signe.
  return (inside ? 1 : -1) * Math.sqrt(minSq);
// Fin de pointToPolygonDist.
}

// Fonction segDistSq : distance au carré d'un point à un segment.
function segDistSq(px: number, py: number, a: Point, b: Point): number {
  // Point du segment le plus proche, au départ l'extrémité a.
  let x = a[0], y = a[1];
  // Vecteur de a vers b.
  let dx = b[0] - x, dy = b[1] - y;
  // Si le segment n'est pas réduit à un point :
  if (dx !== 0 || dy !== 0) {
    // position de la projection du point sur la droite, de 0 (en a) à 1 (en b) ;
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    // au-delà de b : le plus proche est b ; entre les deux : le point projeté ; avant a : a reste.
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  // Fin du cas.
  }
  // Écart entre le point et ce point le plus proche.
  dx = px - x; dy = py - y;
  // Son carré.
  return dx * dx + dy * dy;
// Fin de segDistSq.
}

// Forme d'une cellule carrée de la recherche : centre (x, y), demi-côté h, distance d du centre au bord du polygone, et max, la meilleure distance possible dans la cellule.
interface Cell { x: number; y: number; h: number; d: number; max: number }

/** File de priorité minimale (tas binaire) sur -max : on explore d'abord les cellules les plus prometteuses. */
// Classe Heap : une file qui rend toujours la cellule la plus prometteuse.
class Heap {
  // Tableau des cellules, rangé en tas.
  private a: Cell[] = [];
  // Nombre de cellules en attente.
  get size() { return this.a.length; }
  // Méthode push : ajoute une cellule.
  push(c: Cell) {
    // L'ajoute à la fin du tableau.
    const a = this.a; a.push(c);
    // Sa position.
    let i = a.length - 1;
    // Tant qu'elle n'est pas en tête :
    while (i > 0) {
      // position de son parent dans le tas ;
      const p = (i - 1) >> 1;
      // parent au moins aussi prometteur : elle est à sa place ;
      if (a[p].max >= a[i].max) break;
      // sinon on les échange et on remonte.
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    // Fin de la remontée.
    }
  // Fin de push.
  }
  // Méthode pop : retire et rend la cellule la plus prometteuse.
  pop(): Cell {
    // La tête du tas, et le dernier élément, retiré du tableau.
    const a = this.a; const top = a[0]; const last = a.pop()!;
    // S'il reste des cellules :
    if (a.length) {
      // le dernier prend la tête ;
      a[0] = last;
      // sa position ;
      let i = 0;
      // boucle de descente :
      for (;;) {
        // positions de ses deux enfants ;
        const l = 2 * i + 1, r = l + 1;
        // le plus prometteur des trois, au départ lui-même ;
        let m = i;
        // l'enfant gauche s'il est plus prometteur ;
        if (l < a.length && a[l].max > a[m].max) m = l;
        // l'enfant droit s'il l'est encore plus ;
        if (r < a.length && a[r].max > a[m].max) m = r;
        // aucun enfant plus prometteur : il est à sa place ;
        if (m === i) break;
        // sinon on échange et on descend.
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      // Fin de la descente.
      }
    // Fin du cas.
    }
    // Rend l'ancienne tête.
    return top;
  // Fin de pop.
  }
// Fin de Heap.
}

/** Pôle d'inaccessibilité (polylabel) d'un polygone en coordonnées projetées. */
// Fonction polylabel : cherche le point intérieur le plus éloigné des bords.
export function polylabel(rings: Point[][], precision = PRECISION): { x: number; y: number; d: number } {
  // Anneau extérieur.
  const outer = rings[0];
  // Emprise de cet anneau, vide au départ.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // Pour chacun de ses points :
  for (const [x, y] of outer) {
    // élargit l'emprise vers le bas et la gauche ;
    if (x < minX) minX = x; if (y < minY) minY = y;
    // et vers le haut et la droite.
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  // Fin de la boucle.
  }
  // Largeur et hauteur de l'emprise.
  const w = maxX - minX, hgt = maxY - minY;
  // Côté des premières cellules : la plus petite des deux dimensions.
  const size = Math.min(w, hgt);
  // Fonction make : crée une cellule de centre (x, y) et de demi-côté h.
  const make = (x: number, y: number, h: number): Cell => {
    // Distance de son centre au bord du polygone.
    const d = pointToPolygonDist(x, y, rings);
    // max = d + h × √2 : aucun point de la cellule ne peut être plus loin du bord que cela.
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  // Fin de make.
  };
  // Polygone sans épaisseur : son coin suffit, distance 0.
  if (size === 0) return { x: minX, y: minY, d: 0 };

  // File des cellules à explorer.
  const queue = new Heap();
  // Demi-côté des premières cellules.
  const h0 = size / 2;
  // Couvre l'emprise de cellules carrées et les met dans la file.
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) queue.push(make(x + h0, y + h0, h0));

  // Premier candidat : le centroïde de l'anneau extérieur, puis le centre de l'emprise.
  // Meilleur point connu : d'abord le centroïde de l'anneau extérieur.
  let best = centroidCell(outer, make);
  // Autre candidat : le centre de l'emprise.
  const bbox = make(minX + w / 2, minY + hgt / 2, 0);
  // On garde le plus éloigné du bord des deux.
  if (bbox.d > best.d) best = bbox;

  // Garde-fou : compteur de tours.
  let guard = 0;
  // Tant qu'il reste des cellules, et 200 000 tours au plus :
  while (queue.size && guard++ < 200_000) {
    // prend la cellule la plus prometteuse ;
    const cell = queue.pop();
    // son centre devient le meilleur point s'il est plus loin du bord ;
    if (cell.d > best.d) best = cell;
    // si elle ne peut pas faire mieux que le meilleur point à la précision près, on l'abandonne ;
    if (cell.max - best.d <= precision) continue;
    // sinon on la coupe en quatre : demi-côté des nouvelles cellules ;
    const h = cell.h / 2;
    // quart bas gauche ;
    queue.push(make(cell.x - h, cell.y - h, h));
    // quart bas droit ;
    queue.push(make(cell.x + h, cell.y - h, h));
    // quart haut gauche ;
    queue.push(make(cell.x - h, cell.y + h, h));
    // quart haut droit.
    queue.push(make(cell.x + h, cell.y + h, h));
  // Fin de la recherche.
  }
  // Renvoie le meilleur point et sa distance au bord.
  return { x: best.x, y: best.y, d: best.d };
// Fin de polylabel.
}

// Fonction centroidCell : cellule placée au centre de gravité d'un anneau.
function centroidCell(ring: Point[], make: (x: number, y: number, h: number) => Cell): Cell {
  // Sommes de la formule du centroïde.
  let area = 0, x = 0, y = 0;
  // Pour chaque côté :
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    // ses deux extrémités ;
    const a = ring[i], b = ring[j];
    // produit en croix des deux points ;
    const f = a[0] * b[1] - b[0] * a[1];
    // cumule les coordonnées pondérées et le triple de ce produit.
    x += (a[0] + b[0]) * f; y += (a[1] + b[1]) * f; area += f * 3;
  // Fin de la boucle.
  }
  // Aire nulle : cellule au premier point ; sinon au centroïde.
  return area === 0 ? make(ring[0][0], ring[0][1], 0) : make(x / area, y / area, 0);
// Fin de centroidCell.
}

/** Douglas-Peucker itératif sur un anneau [lon, lat]. */
// Fonction simplify : retire les points d'un anneau qui s'écartent peu de son tracé.
function simplify(ring: Point[], tol: number): Point[] {
  // Quatre points ou moins : rien à simplifier.
  if (ring.length <= 4) return ring;
  // Un octet par point : 1 si le point est gardé.
  const keep = new Uint8Array(ring.length);
  // Le premier et le dernier point sont toujours gardés.
  keep[0] = keep[ring.length - 1] = 1;
  // Pile des tronçons à examiner, au départ l'anneau entier.
  const stack: [number, number][] = [[0, ring.length - 1]];
  // Tolérance au carré, pour comparer des distances au carré.
  const tolSq = tol * tol;
  // Tant qu'il reste un tronçon :
  while (stack.length) {
    // on le sort de la pile : ses deux bouts ;
    const [s, e] = stack.pop()!;
    // point le plus écarté du segment qui joint les deux bouts, et son écart ;
    let maxD = 0, idx = -1;
    // pour chaque point entre les deux bouts :
    for (let i = s + 1; i < e; i++) {
      // son écart au carré à ce segment ;
      const d = segDistSq(ring[i][0], ring[i][1], ring[s], ring[e]);
      // on retient le plus grand.
      if (d > maxD) { maxD = d; idx = i; }
    // Fin de la boucle.
    }
    // S'il dépasse la tolérance : ce point est gardé, et les deux moitiés du tronçon sont à examiner.
    if (idx >= 0 && maxD > tolSq) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  // Fin de la boucle des tronçons.
  }
  // Ne garde que les points marqués.
  const out = ring.filter((_, i) => keep[i]);
  // Si la simplification laisse moins de quatre points, on rend l'anneau d'origine.
  return out.length >= 4 ? out : ring;
// Fin de simplify.
}

// Fonction r3 : arrondit à 3 décimales.
const r3 = (v: number) => Math.round(v * 1000) / 1000;
// Fonction r2 : arrondit à 2 décimales.
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Milieu de chaque morceau de chaque pays. `arcs` : arcs dé-quantifiés en [lon, lat]. */
// Fonction countryCenters : reçoit la topologie, ses arcs décodés et le nom de l'objet des pays.
export function countryCenters(topo: TopoLike, arcs: Point[][], objectName = 'countries'): CountryShape[] {
  // Géométries des pays, liste vide si l'objet manque.
  const geometries = topo.objects[objectName]?.geometries ?? [];
  // Pays produits.
  const out: CountryShape[] = [];
  // Pour chaque pays :
  for (const g of geometries) {
    // ses morceaux.
    const parts: CountryPart[] = [];
    // Pour chacun de ses polygones :
    for (const poly of polygonsOf(g.type, g.arcs, arcs)) {
      // son anneau extérieur ;
      const outer = poly[0];
      // absent ou trop court : on passe.
      if (!outer || outer.length < 4) continue;
      // Latitudes extrêmes de l'anneau.
      let minLat = Infinity, maxLat = -Infinity;
      // Parcourt ses points pour les trouver.
      for (const [, lat] of outer) { if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; }
      // Projection locale : longitude × cos(latitude moyenne), pour que les distances soient comparables dans les deux sens.
      // Facteur de la projection : cosinus de la latitude moyenne, jamais sous 0,05 (près des pôles).
      const k = Math.max(0.05, Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180));
      // Polygone projeté : chaque longitude multipliée par ce facteur.
      const projected = poly.map((ring) => ring.map(([lon, lat]) => [lon * k, lat] as Point));
      // Aire : celle de l'anneau extérieur, moins celle de chaque trou.
      const area = Math.abs(signedArea(projected[0])) - projected.slice(1).reduce((s, r) => s + Math.abs(signedArea(r)), 0);
      // Trop petit : on passe.
      if (area < MIN_PART_AREA) continue;
      // Cherche son milieu.
      const p = polylabel(projected);
      // Ajoute le morceau :
      parts.push({
        // milieu ramené en longitude réelle et arrondi, distance au bord (jamais négative), aire ;
        lon: r3(p.x / k), lat: r3(p.y), r: r3(Math.max(0, p.d)), area: r3(area),
        // contour extérieur simplifié, aplati et arrondi à 2 décimales.
        ring: simplify(outer, RING_TOLERANCE).flatMap(([lon, lat]) => [r2(lon), r2(lat)]),
      // Fin du morceau.
      });
    // Fin de la boucle des polygones.
    }
    // Pays sans morceau retenu : on passe.
    if (!parts.length) continue;
    // Trie ses morceaux du plus grand au plus petit.
    parts.sort((a, b) => b.area - a.area);
    // Ajoute le pays, avec son code et son nom en texte.
    out.push({ id: String(g.id ?? ''), name: String(g.properties?.name ?? ''), parts });
  // Fin de la boucle des pays.
  }
  // Renvoie les pays.
  return out;
// Fin de countryCenters.
}
