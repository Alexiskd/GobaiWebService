// Dalles LiDAR en vrais points 3D : calculs purs (testés dans lidarPointsMath.test.jsx), sans three.js.
// Format des fichiers : voir backend/src/services/lidar-tiles/lidar-tiles.ts.
//
// Une dalle est un octree additif : la racine couvre toute la dalle en basse densité, chaque niveau ajoute des points
// deux fois plus serrés. À chaque instant on affiche les nœuds dont les points seraient trop espacés à l'écran sans
// leurs enfants, du plus grossier au plus fin, dans la limite d'un budget de points.
// Importe lidarToGlobe, la conversion d'un point du nuage en point du globe, depuis lidarAnchor.
import { lidarToGlobe } from './lidarAnchor';

/** Couleur de chaque classe d'affichage (octet « classe » d'un point), avant luminosité. */
// Déclare et exporte la palette des classes d'affichage (début).
export const LIDAR_PALETTE = [
  // Classe 0 : gris.
  [0.62, 0.62, 0.63],   // 0 divers (véhicules, mobilier urbain)
  // Classe 1 : gris beige.
  [0.60, 0.585, 0.555], // 1 sol
  // Classe 2 : vert clair.
  [0.47, 0.57, 0.33],   // 2 végétation basse
  // Classe 3 : vert moyen.
  [0.37, 0.52, 0.27],   // 3 végétation moyenne
  // Classe 4 : vert foncé.
  [0.27, 0.45, 0.22],   // 4 végétation haute
  // Classe 5 : gris bleuté.
  [0.60, 0.645, 0.69],  // 5 toit
  // Classe 6 : beige clair.
  [0.86, 0.80, 0.69],   // 6 façade
  // Classe 7 : bleu sombre.
  [0.25, 0.38, 0.46],   // 7 eau
  // Classe 8 : gris clair.
  [0.70, 0.68, 0.64],   // 8 pont
  // Classe 9 : gris.
  [0.62, 0.62, 0.64],   // 9 sursol
// Fin de la palette.
];
/** Valeur de l'octet « luminosité » qui laisse la couleur de la classe telle quelle. */
// Déclare et exporte la luminosité neutre : 170.
export const LUM_NEUTRAL = 170;
/** Diamètre d'un point, en multiple de l'espacement des points autour de lui : les surfaces sont pleines. */
// Déclare et exporte le diamètre d'un point : 1,3 fois l'espacement.
export const POINT_FILL = 1.3;

// Motif d'une clé de nœud : quatre nombres séparés par des tirets.
const KEY = /^(\d+)-(\d+)-(\d+)-(\d+)$/;
// Déclare et exporte la clé de la racine.
export const ROOT_KEY = '0-0-0-0';

/** « niveau-x-y-z » → { level, x, y, z }, ou null. */
// Déclare et exporte parseNodeKey : la clé.
export function parseNodeKey(key) {
  // Compare la clé au motif.
  const m = KEY.exec(key);
  // Renvoie le niveau et les trois coordonnées, ou null.
  return m ? { level: Number(m[1]), x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) } : null;
// Fin de parseNodeKey.
}

/** Clé du nœud parent, ou null pour la racine. */
// Déclare et exporte parentKey : la clé.
export function parentKey(key) {
  // La clé décomposée.
  const k = parseNodeKey(key);
  // Clé illisible ou racine : null ; sinon le niveau moins un et les coordonnées divisées par deux.
  return !k || k.level === 0 ? null : `${k.level - 1}-${k.x >> 1}-${k.y >> 1}-${k.z >> 1}`;
// Fin de parentKey.
}

/** Espacement des points d'un niveau (m) : celui de la racine, divisé par deux à chaque niveau. */
// Déclare et exporte levelSpacing : l'espacement de la racine divisé par 2 puissance le niveau.
export const levelSpacing = (rootSpacing, level) => rootSpacing / 2 ** level;

/**
 * Arbre des nœuds d'une dalle : clé → { key, level, n, h, min: [x, y, z], size, children: [clés], fine }.
 * `min` est le coin du cube du nœud, en mètres depuis le coin de la dalle (X, Y) et depuis son bas (Z) ; `size` son
 * côté ; `fine` le niveau le plus profond sous ce nœud (lui compris) : la densité maximale des points à cet endroit.
 */
// Déclare et exporte buildTree : le manifeste de la dalle.
export function buildTree(manifest) {
  // Côté de la dalle en mètres.
  const side = manifest.bounds.maxX - manifest.bounds.minX;
  // L'arbre : une table par clé.
  const tree = new Map();
  // Pour chaque nœud du manifeste (début).
  for (const node of manifest.nodes) {
    // Sa clé décomposée.
    const k = parseNodeKey(node.k);
    // Clé illisible : ignoré.
    if (!k) continue;
    // Côté de son cube.
    const size = side / 2 ** k.level;
    // Range le nœud : clé, niveau, nombre de points, empreinte, coin et côté du cube, sans enfants, niveau le plus profond égal au sien.
    tree.set(node.k, { key: node.k, level: k.level, n: node.n, h: node.h, min: [k.x * size, k.y * size, k.z * size], size, children: [], fine: k.level });
  // Fin de la boucle.
  }
  // Pour chaque nœud de l'arbre (début).
  for (const node of tree.values()) {
    // S'ajoute aux enfants de son parent.
    tree.get(parentKey(node.key))?.children.push(node.key);
    // Pour chacun de ses ancêtres (début).
    for (let up = parentKey(node.key); up; up = parentKey(up)) {
      // L'ancêtre.
      const ancestor = tree.get(up);
      // S'il existe : son niveau le plus profond devient au moins celui de ce nœud.
      if (ancestor) ancestor.fine = Math.max(ancestor.fine, node.level);
    // Fin de la boucle des ancêtres.
    }
  // Fin de la boucle des nœuds.
  }
  // Renvoie l'arbre.
  return tree;
// Fin de buildTree.
}

/** Adresse du fichier d'un nœud, d'après le modèle du manifeste ({k} = clé, {h} = empreinte). */
// Déclare et exporte nodeUrl : le modèle d'adresse du manifeste, rempli avec la clé et l'empreinte du nœud.
export const nodeUrl = (manifest, node) => manifest.nodeUrl.replace('{k}', node.key ?? node.k).replace('{h}', node.h);

/**
 * Décode le fichier d'un nœud (déjà décompressé par le navigateur) : 8 octets par point, rangés par plans.
 * Renvoie { position: Uint16Array (x, y, z en pas, depuis le coin du nœud et le bas de la dalle), attr: Uint8Array
 * (classe, luminosité) }. Lève une erreur si la taille ne correspond pas au nombre de points annoncé.
 */
// Déclare et exporte decodeNode : le fichier du nœud et son nombre de points.
export function decodeNode(buffer, count) {
  // Les octets du fichier.
  const raw = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  // Taille différente de huit octets par point : erreur.
  if (raw.length !== count * 8) throw new Error(`Nœud LiDAR : ${raw.length} octets reçus pour ${count} points.`);
  // Tableau des positions : trois entiers de 16 bits par point.
  const position = new Uint16Array(count * 3);
  // Tableau des attributs : deux octets par point.
  const attr = new Uint8Array(count * 2);
  // Pour chacun des trois axes (début).
  for (let axis = 0; axis < 3; axis++) {
    // Positions des deux plans d'octets de l'axe : poids faible et poids fort.
    const lo = axis * 2 * count, hi = lo + count;
    // Valeur cumulée : 0 au départ.
    let acc = 0;
    // Pour chaque point (début).
    for (let i = 0; i < count; i++) {
      // Entier de 16 bits reconstitué à partir des deux plans.
      const v = raw[lo + i] | (raw[hi + i] << 8);
      // Ajoute l'écart, décodé du zigzag.
      acc += (v >>> 1) ^ -(v & 1); // zigzag : 0, −1, 1, −2, 2…
      // Range la coordonnée.
      position[i * 3 + axis] = acc;
    // Fin de la boucle des points.
    }
  // Fin de la boucle des axes.
  }
  // Positions des plans de la classe et de la luminosité.
  const cls = 6 * count, lum = 7 * count;
  // Pour chaque point (début).
  for (let i = 0; i < count; i++) {
    // Sa classe.
    attr[i * 2] = raw[cls + i];
    // Sa luminosité.
    attr[i * 2 + 1] = raw[lum + i];
  // Fin de la boucle.
  }
  // Renvoie les positions et les attributs.
  return { position, attr };
// Fin de decodeNode.
}

/** Classe d'affichage « sol » (voir LIDAR_PALETTE). */
// Numéro de la classe « sol » : 1.
const CLASS_GROUND = 1;

/**
 * Hauteur du sol d'un nœud décodé (m au-dessus du bas de la dalle) : médiane des points classés « sol ».
 * null s'il y en a moins de 50 (nœud sans sol : toits seuls, eau).
 */
// Déclare et exporte groundLevel : les positions, les attributs et le pas en mètres.
export function groundLevel(position, attr, step) {
  // Hauteurs des points du sol.
  const z = [];
  // Garde la hauteur de chaque point de classe « sol ».
  for (let i = 0, n = attr.length / 2; i < n; i++) if (attr[i * 2] === CLASS_GROUND) z.push(position[i * 3 + 2]);
  // Moins de 50 points : null.
  if (z.length < 50) return null;
  // Trie les hauteurs.
  z.sort((a, b) => a - b);
  // Renvoie la hauteur du milieu, en mètres.
  return z[z.length >> 1] * step;
// Fin de groundLevel.
}

/** Distance (m) d'un point au cube d'un nœud (0 à l'intérieur). */
// Déclare et exporte boxDistance : le point, le coin du cube et son côté.
export function boxDistance(p, min, size) {
  // Carré de la distance : 0 au départ.
  let d2 = 0;
  // Pour chacun des trois axes (début).
  for (let i = 0; i < 3; i++) {
    // Écart du point au cube sur cet axe, nul s'il est entre les deux faces.
    const d = Math.max(min[i] - p[i], 0, p[i] - (min[i] + size));
    // Ajoute son carré.
    d2 += d * d;
  // Fin de la boucle.
  }
  // Renvoie la distance.
  return Math.sqrt(d2);
// Fin de boxDistance.
}

/**
 * Nœuds à afficher et à charger pour une vue.
 *
 * @param {Map} tree arbre de la dalle (buildTree)
 * @param {object} view
 *   eye           position de la caméra, repère des cubes (m)
 *   pxPerUnit     pixels couverts par 1 m vu à 1 m de distance (hauteur du dessin / (2 tan(champ / 2)))
 *   spacing       espacement des points de la racine (m)
 *   maxSpacingPx  écart maximal toléré entre deux points voisins à l'écran : au-delà, les enfants sont demandés
 *   budget        nombre maximal de points affichés
 *   visible       (nœud) => booléen : cube dans le champ de la caméra (absent : tout est visible)
 * @param {(key: string) => boolean} isReady nœud déjà chargé
 * @returns {{ show: string[], load: string[] }} `show` : nœuds chargés à dessiner ; `load` : nœuds à charger, les
 *   plus utiles d'abord.
 *
 * Taille des points (voir lidarPoints.jsx) : une fois le détail voulu chargé, deux points voisins sont à
 * `maxSpacingPx` au plus à l'écran ; chaque point est donc dessiné à cette taille, quel que soit son niveau, et ne
 * grossit que de tout près, quand le niveau le plus fin de la dalle est atteint. Un nœud dont le détail n'est pas
 * encore arrivé montre des points épars, jamais de gros disques.
 */
// Déclare et exporte selectNodes : l'arbre, la vue et le test de chargement.
export function selectNodes(tree, view, isReady) {
  // Les champs de la vue.
  const { eye, pxPerUnit, spacing, maxSpacingPx, budget, visible } = view;
  // Liste des nœuds voulus.
  const wanted = [];
  // visit : examine un nœud (début).
  const visit = (key) => {
    // Le nœud.
    const node = tree.get(key);
    // Inconnu : ignoré.
    if (!node) return;
    // Hors du champ de la caméra, sauf la racine : ignoré.
    if (key !== ROOT_KEY && visible && !visible(node)) return;
    // Écart à l'écran entre deux de ses points : son espacement, vu à la distance de son cube (au moins 0,5 m).
    const px = (levelSpacing(spacing, node.level) * pxPerUnit) / Math.max(boxDistance(eye, node.min, node.size), 0.5);
    // L'ajoute aux nœuds voulus.
    wanted.push({ key, px, n: node.n });
    // Écart trop grand : examine ses enfants.
    if (px > maxSpacingPx) for (const child of node.children) visit(child);
  // Fin de visit.
  };
  // Part de la racine.
  visit(ROOT_KEY);
  // Un enfant a toujours un écart à l'écran au moins deux fois plus petit que son parent : trier par écart
  // décroissant place les ancêtres avant leurs descendants, et les nœuds proches avant les lointains.
  // Trie par écart décroissant.
  wanted.sort((a, b) => b.px - a.px);
  // Nœuds à dessiner, nœuds à charger et nœuds écartés.
  const show = [], load = [], dropped = new Set();
  // Nombre de points retenus.
  let points = 0;
  // Pour chaque nœud voulu (début).
  for (const w of wanted) {
    // Budget atteint : le nœud est écarté, et ses descendants avec lui (pas de détail sans son contexte).
    // Hors la racine, si le budget serait dépassé ou si son parent est écarté : il est écarté.
    if (w.key !== ROOT_KEY && (points + w.n > budget || dropped.has(parentKey(w.key)))) { dropped.add(w.key); continue; }
    // Ajoute ses points au total.
    points += w.n;
    // Chargé : à dessiner ; sinon : à charger.
    if (isReady(w.key)) show.push(w.key); else load.push(w.key);
  // Fin de la boucle.
  }
  // Renvoie les deux listes.
  return { show, load };
// Fin de selectNodes.
}

/**
 * Avancement du chargement pour la vue en cours : points déjà dessinés (`show`) sur points voulus (`show` + `load`,
 * voir selectNodes). `ratio` vaut 1 quand tout le détail voulu est à l'écran.
 */
// Déclare et exporte loadProgress : l'arbre, les nœuds dessinés et les nœuds à charger.
export function loadProgress(tree, show, load) {
  // sum : nombre total de points d'une liste de nœuds.
  const sum = (keys) => keys.reduce((total, key) => total + (tree.get(key)?.n ?? 0), 0);
  // Points dessinés, et points voulus.
  const shown = sum(show), wanted = shown + sum(load);
  // Renvoie les deux nombres et leur rapport, 1 quand rien n'est voulu.
  return { shown, wanted, ratio: wanted > 0 ? shown / wanted : 1 };
// Fin de loadProgress.
}

/**
 * Repère local d'une dalle sur la sphère unité de la Terre : origine au centre de l'emprise, en bas du nuage, et
 * vecteurs (par mètre) de ses axes X (est de la grille), Y (nord de la grille) et Z (haut). Sur 1 km, la dalle est
 * posée à plat : l'écart avec la courbure de la Terre reste sous 4 cm.
 */
// Déclare et exporte tileFrame : l'emprise et l'ancrage de la dalle, et l'altitude du bas du nuage (celle de l'ancrage par défaut).
export function tileFrame({ bounds, anchor }, altitude = anchor.alt) {
  // Centre de l'emprise et bas du nuage.
  const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2, z0 = bounds.minZ;
  // `altitude` : hauteur du bas du nuage au-dessus de la sphère (m). Par défaut sa vraie altitude ; sur une carte à
  // plat (relief en volume coupé), l'opposé de la hauteur du sol dans le nuage, pour poser le sol sur la carte.
  // Nuage avec l'altitude voulue.
  const cloud = { bounds, anchor: { ...anchor, alt: altitude } };
  // at : point du globe à un décalage en mètres du centre.
  const at = (dx, dy, dz) => lidarToGlobe({ x: cx + dx, y: cy + dy, z: z0 + dz }, cloud);
  // Écart utilisé pour mesurer les axes : 200 m.
  const D = 200;
  // axis : différence de deux points, divisée par 400 m.
  const axis = (a, b) => a.map((v, i) => (v - b[i]) / (2 * D));
  // Renvoie le repère (début).
  return {
    // L'origine.
    origin: at(0, 0, 0),
    // L'axe X, par mètre.
    ex: axis(at(D, 0, 0), at(-D, 0, 0)),
    // L'axe Y, par mètre.
    ey: axis(at(0, D, 0), at(0, -D, 0)),
    // L'axe Z, par mètre.
    ez: axis(at(0, 0, D), at(0, 0, -D)),
  // Fin du repère.
  };
// Fin de tileFrame.
}

// smoothstep : passage progressif de 0 à 1 entre deux bornes (début).
const smoothstep = (a, b, x) => {
  // Avancement entre les bornes, entre 0 et 1.
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  // Courbe en S.
  return t * t * (3 - 2 * t);
// Fin de smoothstep.
};

/**
 * Teinte jour / nuit des points, identique à celle des tuiles de la Terre (tileShaders.jsx) : `sunDot` = cosinus de
 * l'angle entre la verticale de la dalle et le Soleil, `shade` = 1 quand l'ombrage est actif, 0 sinon.
 */
// Déclare et exporte dayTint : le cosinus de l'angle avec le Soleil et l'ombrage (1 par défaut).
export function dayTint(sunDot, shade = 1) {
  // Éclairement : le cosinus, jamais négatif.
  const m0 = Math.max(sunDot, 0);
  // Part de jour, progressive entre −0,12 et 0,22.
  const day = smoothstep(-0.12, 0.22, sunDot);
  // Facteur de jour : de 0,38 à 1,1.
  const lit = 0.38 + 0.72 * m0;
  // Facteur de nuit, par composante.
  const night = [0.024, 0.034, 0.06];
  // Renvoie, par composante, le mélange nuit/jour, ramené vers 1 quand l'ombrage est coupé.
  return night.map((n) => 1 + ((n + (lit - n) * day) - 1) * shade);
// Fin de dayTint.
}

/**
 * Hauteur de caméra (m) en deçà de laquelle le nuage de points LiDAR est dessiné : 150 m, soit les 0,15 km que le
 * HUD affiche. C'est la même grandeur que la distance du zoom lue à l'écran — la hauteur au-dessus du sol — et non
 * la distance à la dalle : à 0,15 km, le nuage apparaît, au-dessus il reste masqué.
 *
 * Le nuage ne sert qu'à bout portant : un bâtiment vu point par point. Le garder masqué plus haut épargne au
 * téléphone le dessin de centaines de milliers de points qui ne couvriraient que quelques pixels.
 */
// Hauteur d'affichage du nuage de points : 150 mètres.
export const CLOUD_HEIGHT_M = 150;

/**
 * Le nuage de points est-il dessiné ? Deux conditions : la dalle est dans le champ de la caméra, et la caméra est
 * assez basse. `heightM` est la hauteur de la caméra au-dessus du plan de la dalle, en mètres.
 */
// Déclare et exporte showCloud : reçoit la hauteur, la présence dans le champ et la hauteur limite.
export function showCloud(heightM, inView, limitM = CLOUD_HEIGHT_M) {
  // Dessiné si la dalle est dans le champ et que la caméra est sous la hauteur limite.
  return Boolean(inView) && heightM > 0 && heightM < limitM;
// Fin de showCloud.
}
