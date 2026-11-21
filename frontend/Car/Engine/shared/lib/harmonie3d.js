// Copie de la stack @go-/harmonie-3d du dépôt GO- (Alexiskd/Go-, stacks/go-/harmonie-3d/src/harmonie.js).
// Le paquet n'est pas publié sur npm : le fichier est repris tel quel. Toute évolution se fait d'abord dans GO-.
/**
 * @go-/harmonie-3d — disposition harmonieuse d'une arborescence en 3D.
 *
 * Entrée : un arbre quelconque (dossiers et fichiers). Sortie : une position [x, y, z] par nœud visible.
 * Aucune dépendance, aucun accès au DOM ni au GPU : le calcul est pur et se teste avec `node --test`.
 *
 * Règles de la disposition :
 *  1. chaque dossier porte ses sous-dossiers sur une couronne, un étage au-dessus de lui ;
 *  2. un sous-dossier reçoit une part d'angle proportionnelle à la largeur de sa propre couronne : les gros
 *     sous-arbres ont plus de place, et deux couronnes voisines ne se rentrent pas dedans ;
 *  3. les fichiers d'un dossier forment une collerette plus basse et plus serrée, à l'intérieur de la couronne ;
 *  4. un sous-dossier unique monte tout droit (une chaîne a/b/c devient une tige) ;
 *  5. les étages raccourcissent avec la profondeur, et chaque étage est tourné de l'angle d'or par rapport au
 *     précédent pour que les branches ne s'alignent pas.
 */

const TAU = Math.PI * 2;
/** Angle d'or (≈ 137,5°), en radians. */
export const ANGLE_OR = Math.PI * (3 - Math.sqrt(5));

/** Réglages par défaut ; chacun peut être remplacé dans `options`. */
export const REGLAGES = {
  layer: 4.8,        // hauteur du premier étage
  taper: 0.94,       // chaque étage mesure 94 % du précédent
  minLayer: 0.6,     // sans descendre sous 60 % du premier
  dirSize: 1.5,      // demi-largeur réservée à un dossier sans enfant visible
  fileSize: 0.24,    // demi-largeur réservée à un fichier
  gap: 0.9,          // marge entre deux sous-dossiers voisins
  overlap: 0.8,      // part de la couronne d'un sous-dossier comptée dans sa largeur (1 = aucun recouvrement)
  minRadius: 3.2,    // rayon minimal d'une couronne de sous-dossiers
  maxRadius: 48,     // rayon maximal d'une couronne de sous-dossiers
  fileRing: 0.55,    // rayon maximal de la collerette de fichiers, en part de la couronne de sous-dossiers
  fileLift: 0.45,    // hauteur de la collerette de fichiers, en part de l'étage
  fileMaxRadius: 22, // rayon maximal de la collerette d'un dossier sans sous-dossier
};

const borne = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Calcule la position de chaque nœud visible.
 *
 * @param {object} root nœud racine.
 * @param {object} [options] réglages (voir REGLAGES), plus :
 *   - kids(node)   : enfants visibles du nœud (défaut : `node.children`) ; renvoyer [] pour un dossier replié ;
 *   - isFile(node) : vrai pour un fichier (défaut : `node.file`).
 * @returns {Map<object, number[]>} position [x, y, z] par nœud, racine en [0, 0, 0], parents avant enfants.
 */
export function harmoniser(root, options = {}) {
  const o = { ...REGLAGES, ...options };
  const kids = o.kids || ((n) => n.children || []);
  const isFile = o.isFile || ((n) => !!n.file);
  const mesures = new Map();

  // 1. Mesure, des feuilles vers la racine : rayon de la couronne de chaque dossier.
  const mesurer = (node) => {
    const all = kids(node) || [];
    const dirs = all.filter((k) => !isFile(k));
    const files = all.filter((k) => isFile(k));
    let need = 0;
    const widths = dirs.map((d) => {
      const w = 2 * Math.max(o.dirSize, mesurer(d) * o.overlap) + o.gap;
      need += w;
      return w;
    });
    // Périmètre nécessaire → rayon ; corrigé pour les petites couronnes, où la corde est bien plus courte que l'arc.
    const n = dirs.length;
    const radius = n < 2 ? 0 : borne((need / TAU) * ((Math.PI / n) / Math.sin(Math.PI / n)), o.minRadius, o.maxRadius);
    const fileMax = n >= 2 ? Math.max(1.1, radius * o.fileRing) : o.fileMaxRadius;
    const fileRadius = files.length ? borne((files.length * 2 * o.fileSize) / TAU, 1.1, fileMax) : 0;
    mesures.set(node, { dirs, files, widths, need, radius, fileRadius });
    return Math.max(radius, fileRadius);
  };
  mesurer(root);

  // 2. Placement, de la racine vers les feuilles.
  const positions = new Map();
  const placer = (node, p, angle, depth) => {
    positions.set(node, p);
    const m = mesures.get(node);
    const step = o.layer * Math.max(o.minLayer, Math.pow(o.taper, depth));
    const start = angle + ANGLE_OR * (depth + 1);
    let acc = 0;
    m.dirs.forEach((d, i) => {
      const share = (m.widths[i] / m.need) * TAU;
      const a = start + acc + share / 2;
      acc += share;
      placer(d, [p[0] + m.radius * Math.cos(a), p[1] + step, p[2] + m.radius * Math.sin(a)], a, depth + 1);
    });
    m.files.forEach((f, i) => {
      const a = start + ANGLE_OR / 2 + (i / m.files.length) * TAU;
      positions.set(f, [p[0] + m.fileRadius * Math.cos(a), p[1] + step * o.fileLift, p[2] + m.fileRadius * Math.sin(a)]);
    });
  };
  placer(root, [0, 0, 0], 0, 0);
  return positions;
}

/** Rayon horizontal occupé autour de l'axe de la racine (pour poser plusieurs arbres côte à côte). */
export function emprise(positions) {
  let r = 0;
  for (const p of positions.values()) r = Math.max(r, Math.hypot(p[0], p[2]));
  return r;
}
