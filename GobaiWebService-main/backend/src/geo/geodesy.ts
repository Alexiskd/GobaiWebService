/**
 * Géodésie pure (sans dépendance Nest) : plans de découpe et aires sphériques.
 * Mêmes formules que le moteur 3D du frontend.
 */

// Taille visée du côté des plus petites tuiles : 5 mètres.
export const TARGET = 5; // côté visé pour les plus petites tuiles (m)

// Type Mode : découpage en triangles ou en quadrilatères.
export type Mode = 'tri' | 'quad';
// Type Vec3 : un vecteur de trois nombres (x, y, z).
export type Vec3 = [number, number, number];

// Forme de la description d'un niveau de découpage.
export interface LevelInfo {
  // level : le numéro du niveau.
  level: number;
  // shape : la forme des tuiles.
  shape: 'triangle' | 'carré' | 'rectangle';
  /** côtés nominaux en mètres : [long, court] */
  // sizeM : leurs deux côtés, en mètres.
  sizeM: [number, number];
  /** nombre de tuiles pour couvrir toute la Terre à ce niveau */
  // tilesOnEarth : leur nombre total, en texte formaté.
  tilesOnEarth: string;
  /** aire moyenne d'une tuile (m²) */
  // meanAreaM2 : leur aire moyenne, en m².
  meanAreaM2: number;
// Fin de LevelInfo.
}

// Forme du résumé d'un plan de découpage.
export interface PlanSummary {
  // mode : triangles ou quadrilatères.
  mode: Mode;
  // base : le polyèdre de départ.
  base: string;
  // planet : le nom de l'astre.
  planet: string;
  // radiusM : son rayon, en mètres.
  radiusM: number;
  /** grille de départ n×n sur chaque face du polyèdre */
  // n : le nombre de divisions de chaque face de départ.
  n: number;
  // rootCount : le nombre de tuiles au niveau 0.
  rootCount: number;
  // maxLevel : le niveau le plus fin.
  maxLevel: number;
  // finestEdgeM : le côté d'une tuile à ce niveau, en mètres.
  finestEdgeM: number;
  // levels : la description de chaque niveau.
  levels: LevelInfo[];
// Fin de PlanSummary.
}

// Fonction nz : ramène un vecteur à la longueur 1.
export const nz = (v: Vec3): Vec3 => {
  // Longueur du vecteur.
  const r = Math.hypot(v[0], v[1], v[2]);
  // Chaque coordonnée divisée par la longueur.
  return [v[0] / r, v[1] / r, v[2] / r];
// Fin de nz.
};
// Fonction dot : produit scalaire de deux vecteurs.
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Fonction cross : produit vectoriel de deux vecteurs, dont voici les trois coordonnées :
const cross = (a: Vec3, b: Vec3): Vec3 => [
  // x ;
  a[1] * b[2] - a[2] * b[1],
  // y ;
  a[2] * b[0] - a[0] * b[2],
  // z.
  a[0] * b[1] - a[1] * b[0],
// Fin de cross.
];

/** Triangles : icosaèdre, grille n×n puis L divisions par 4. 1,19 = étirement moyen de la projection. */
// Fonction triPlan : plan de découpage en triangles d'un astre de rayon R.
export function triPlan(R: number, planet: string): PlanSummary {
  // Surface de la sphère : 4πR².
  const SURFACE = 4 * Math.PI * R * R;
  // Nombre d'or, (1 + √5) / 2.
  const g = (1 + Math.sqrt(5)) / 2;
  // Longueur d'une arête de l'icosaèdre inscrit dans une sphère de rayon 1.
  const e = 2 / Math.sqrt(1 + g * g); // arête de l'icosaèdre inscrit dans la sphère unité
  // Meilleur plan trouvé jusqu'ici : divisions n, niveaux L, côté le plus fin, écart à la cible (infini au départ).
  let best = { n: 1, L: 0, fin: 0, err: Infinity };
  // Essaie chaque grille de départ, de 8 divisions à 1 :
  for (let n = 8; n >= 1; n--) {
    // nombre de divisions par 2 qui amène le côté au plus près de 5 m (jamais négatif) ; 1,19 corrige l'étirement moyen de la projection ;
    const L = Math.max(0, Math.round(Math.log2((1.19 * R * e) / (n * TARGET))));
    // côté obtenu au niveau le plus fin ;
    const fin = (1.19 * R * e) / (n * 2 ** L);
    // écart à la cible, mesuré en rapport (logarithme) pour traiter pareil « trop grand » et « trop petit » ;
    const err = Math.abs(Math.log(fin / TARGET));
    // on garde ce plan s'il est nettement meilleur que le précédent (marge de 1e-9 contre les égalités d'arrondi).
    if (err < best.err - 1e-9) best = { n, L, fin, err };
  // Fin de la recherche.
  }
  // Tuiles au niveau 0 : 20 faces × n × n.
  const rootCount = 20 * best.n * best.n;
  // Liste des niveaux, vide au départ.
  const levels: LevelInfo[] = [];
  // Pour chaque niveau, du plus grossier au plus fin :
  for (let L = 0; L <= best.L; L++) {
    // côté d'une tuile : le côté le plus fin, doublé à chaque niveau en moins ;
    const s = best.fin * 2 ** (best.L - L);
    // nombre de tuiles : multiplié par 4 à chaque niveau ;
    const count = rootCount * 4 ** L;
    // ajoute la description du niveau (triangle, deux côtés égaux, nombre formaté à la française, aire moyenne).
    levels.push({ level: L, shape: 'triangle', sizeM: [s, s], tilesOnEarth: count.toLocaleString('fr-FR'), meanAreaM2: SURFACE / count });
  // Fin de la boucle.
  }
  // Renvoie le résumé du plan.
  return { mode: 'tri', base: 'icosaèdre', planet, radiusM: R, n: best.n, rootCount, maxLevel: best.L, finestEdgeM: best.fin, levels };
// Fin de triPlan.
}

/** Carrés : cube gonflé (projection équi-angulaire), grille n×n puis carré → 2 rectangles → 2 carrés. */
// Fonction quadPlan : plan de découpage en carrés et rectangles.
export function quadPlan(R: number, planet: string): PlanSummary {
  // Surface de la sphère.
  const SURFACE = 4 * Math.PI * R * R;
  // Longueur d'un côté de face du cube une fois gonflé sur la sphère : un quart de tour, πR / 2.
  const arc = (R * Math.PI) / 2; // côté d'une face du cube sur la planète
  // Meilleur plan trouvé jusqu'ici.
  let best = { n: 1, k: 0, fin: 0, err: Infinity };
  // Essaie chaque grille de départ, de 8 divisions à 1 :
  for (let n = 8; n >= 1; n--) {
    // nombre de divisions par 2 qui amène le côté au plus près de 5 m ;
    const k = Math.max(0, Math.round(Math.log2(arc / (n * TARGET))));
    // côté obtenu ;
    const fin = arc / (n * 2 ** k);
    // écart à la cible ;
    const err = Math.abs(Math.log(fin / TARGET));
    // on garde ce plan s'il est nettement meilleur.
    if (err < best.err - 1e-9) best = { n, k, fin, err };
  // Fin de la recherche.
  }
  // Tuiles au niveau 0 : 6 faces × n × n.
  const rootCount = 6 * best.n * best.n;
  // Liste des niveaux.
  const levels: LevelInfo[] = [];
  // Deux niveaux par division : un carré est coupé en deux rectangles, puis chaque rectangle en deux carrés.
  for (let L = 0; L <= 2 * best.k; L++) {
    // Côté du carré à ce niveau (il ne change qu'un niveau sur deux).
    const sq = arc / (best.n * 2 ** Math.floor(L / 2));
    // Nombre de tuiles : doublé à chaque niveau.
    const count = rootCount * 2 ** L;
    // Ajoute la description du niveau :
    levels.push({
      // son numéro ;
      level: L,
      // sa forme : rectangle aux niveaux impairs, carré aux niveaux pairs ;
      shape: L % 2 ? 'rectangle' : 'carré',
      // ses côtés : moitié de largeur pour un rectangle ;
      sizeM: L % 2 ? [sq, sq / 2] : [sq, sq],
      // nombre de tuiles, formaté à la française ;
      tilesOnEarth: count.toLocaleString('fr-FR'),
      // aire moyenne.
      meanAreaM2: SURFACE / count,
    // Fin de la description.
    });
  // Fin de la boucle.
  }
  // Renvoie le résumé du plan.
  return { mode: 'quad', base: 'cube', planet, radiusM: R, n: best.n, rootCount, maxLevel: 2 * best.k, finestEdgeM: best.fin, levels };
// Fin de quadPlan.
}

/** Longitude/latitude (degrés) → vecteur unitaire. Convention : +y = pôle Nord, longitude 0 sur +z. */
// Fonction lonLatToVec : longitude et latitude en degrés → point sur la sphère de rayon 1.
export function lonLatToVec(lon: number, lat: number): Vec3 {
  // Longitude en radians.
  const lo = (lon * Math.PI) / 180;
  // Latitude en radians.
  const la = (lat * Math.PI) / 180;
  // Coordonnées : y vers le pôle Nord, longitude 0 sur l'axe z.
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
// Fin de lonLatToVec.
}

/**
 * Aire d'un polygone sphérique convexe (sommets dans l'ordre), en m².
 * Découpage en éventail ; chaque triangle par la formule de Van Oosterom–Strackee :
 * tan(E/2) = |a·(b×c)| / (1 + a·b + b·c + c·a).
 */
// Fonction sphericalPolygonArea : aire d'un polygone tracé sur la sphère.
export function sphericalPolygonArea(vs: Vec3[], R: number): number {
  // Excès sphérique cumulé (la somme des angles au-delà de celle d'un polygone plat).
  let excess = 0;
  // Découpe le polygone en triangles qui partent tous du premier sommet :
  for (let i = 1; i < vs.length - 1; i++) {
    // les trois sommets du triangle ;
    const a = vs[0], b = vs[i], c = vs[i + 1];
    // numérateur de la formule : |a · (b × c)| ;
    const num = Math.abs(dot(a, cross(b, c)));
    // dénominateur : 1 + a·b + b·c + c·a ;
    const den = 1 + dot(a, b) + dot(b, c) + dot(c, a);
    // excès de ce triangle : 2 × arctangente du rapport, ajouté au total.
    excess += 2 * Math.atan2(num, den);
  // Fin de la boucle.
  }
  // Aire : excès × R².
  return excess * R * R;
// Fin de sphericalPolygonArea.
}

/** Périmètre en m (arcs de grand cercle). */
// Fonction sphericalPerimeter : périmètre d'un polygone tracé sur la sphère.
export function sphericalPerimeter(vs: Vec3[], R: number): number {
  // Longueur cumulée.
  let p = 0;
  // Pour chaque côté :
  for (let i = 0; i < vs.length; i++) {
    // ses deux sommets (le dernier côté revient au premier sommet) ;
    const a = vs[i], b = vs[(i + 1) % vs.length];
    // angle entre les deux sommets (arctangente du produit vectoriel sur le produit scalaire), multiplié par R.
    p += Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) * R;
  // Fin de la boucle.
  }
  // Renvoie le périmètre.
  return p;
// Fin de sphericalPerimeter.
}
