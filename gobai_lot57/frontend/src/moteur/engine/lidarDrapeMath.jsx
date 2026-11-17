// Colorisation du nuage de points LiDAR par drapage : calculs purs (testés dans lidarDrapeMath.test.jsx).
//
// Le relevé laser n'a pas de couleur. On lui donne celle de l'orthophoto (photo aérienne redressée, vue du dessus) :
// chaque point prend la couleur du pixel situé à sa verticale. Les tuiles de l'orthophoto qui couvrent la dalle sont
// réunies en une seule image (« atlas »), et une transformation affine fait passer des mètres de la dalle aux
// coordonnées de cette image. Sur 1 km, l'écart entre cette transformation et la projection exacte (Web Mercator)
// reste sous 10 cm, soit moins d'un demi-pixel de la photo.
// Importe lidarToGeodetic, la conversion d'un point de la dalle en longitude et latitude, depuis lidarAnchor.
import { lidarToGeodetic } from './lidarAnchor';

// Taille d'une tuile de l'orthophoto : 256 pixels.
const TILE_PX = 256;

/** Web Mercator normalisé : x et y de 0 à 1 (x vers l'est depuis −180°, y vers le sud depuis ≈ 85° N). */
// Déclare et exporte mercatorOf : la longitude et la latitude en degrés.
export function mercatorOf(lon, lat) {
  // Sinus de la latitude.
  const s = Math.sin((lat * Math.PI) / 180);
  // Renvoie x, la longitude ramenée de 0 à 1, et y, la formule de Mercator ramenée de 0 à 1.
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
// Fin de mercatorOf.
}

/** Position Web Mercator normalisée d'un point de la dalle (mètres depuis le centre de l'emprise). */
// Déclare et exporte localToMercator : le manifeste de la dalle et un point en mètres depuis son centre.
export function localToMercator(manifest, x, y) {
  // L'emprise et le point d'ancrage du manifeste.
  const { bounds, anchor } = manifest;
  // Longitude et latitude du point : le centre de l'emprise décalé de x et y, à l'altitude minimale.
  const g = lidarToGeodetic({ x: (bounds.minX + bounds.maxX) / 2 + x, y: (bounds.minY + bounds.maxY) / 2 + y, z: bounds.minZ }, { bounds, anchor });
  // Renvoie sa position Mercator.
  return mercatorOf(g.lon, g.lat);
// Fin de localToMercator.
}

/**
 * Plan de drapage d'une dalle au niveau de tuiles `zoom` (abaissé tant que l'atlas dépasse `maxSize` pixels) :
 *   z, x0, y0, cols, rows   tuiles de l'orthophoto couvrant la dalle
 *   width, height           taille de l'atlas (px)
 *   a, b                    affine mètres de la dalle (depuis le centre) → coordonnées de l'atlas (0 à 1) :
 *                           u = a[0]·x + a[1]·y + b[0] ; v = a[2]·x + a[3]·y + b[1] (v vers le sud, comme l'image)
 */
// Déclare et exporte drapePlan : le manifeste, le niveau de tuiles voulu et la taille maximale de l'atlas (4096 pixels par défaut).
export function drapePlan(manifest, zoom, maxSize = 4096) {
  // Demi-côté de la dalle, en mètres.
  const half = (manifest.bounds.maxX - manifest.bounds.minX) / 2;
  // Positions Mercator des quatre coins de la dalle.
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => localToMercator(manifest, x, y));
  // Plus petit x et plus petit y des coins.
  const lo = [Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1]))];
  // Plus grand x et plus grand y des coins.
  const hi = [Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1]))];
  // Niveau de départ, arrondi, et variables de la grille de tuiles.
  let z = Math.round(zoom), x0, y0, cols, rows;
  // Boucle sans condition : sortie par break (début).
  for (;;) {
    // Nombre de tuiles par côté à ce niveau.
    const n = 2 ** z;
    // Colonne et ligne de la première tuile.
    x0 = Math.floor(lo[0] * n); y0 = Math.floor(lo[1] * n);
    // Nombre de colonnes et de lignes qui couvrent la dalle.
    cols = Math.floor(hi[0] * n) - x0 + 1; rows = Math.floor(hi[1] * n) - y0 + 1;
    // Niveau 0 atteint, ou atlas dans la taille permise : fin de la recherche.
    if (z <= 0 || Math.max(cols, rows) * TILE_PX <= maxSize) break;
    // Sinon, un niveau de moins.
    z--;
  // Fin de la boucle.
  }
  // Nombre de tuiles par côté au niveau retenu, largeur et hauteur de l'atlas en pixels.
  const n = 2 ** z, width = cols * TILE_PX, height = rows * TILE_PX;
  // Affine ajustée au centre de la dalle (différences centrées à ±400 m).
  // Écart utilisé pour mesurer les pentes : 400 m.
  const D = 400;
  // Position Mercator du centre de la dalle.
  const c = localToMercator(manifest, 0, 0);
  // Positions à 400 m à l'est et à 400 m à l'ouest.
  const ex = localToMercator(manifest, D, 0), wx = localToMercator(manifest, -D, 0);
  // Positions à 400 m au nord et à 400 m au sud.
  const ny = localToMercator(manifest, 0, D), sy = localToMercator(manifest, 0, -D);
  // toU et toV : convertissent un écart Mercator en fraction de la largeur et de la hauteur de l'atlas.
  const toU = (m) => (m * n) / cols, toV = (m) => (m * n) / rows;
  // Renvoie le plan (début).
  return {
    // Le niveau, la première tuile, la grille et la taille de l'atlas.
    z, x0, y0, cols, rows, width, height,
    // Les quatre coefficients de la transformation : variation de u et de v par mètre vers l'est et vers le nord.
    a: [toU(ex[0] - wx[0]) / (2 * D), toU(ny[0] - sy[0]) / (2 * D), toV(ex[1] - wx[1]) / (2 * D), toV(ny[1] - sy[1]) / (2 * D)],
    // Les coordonnées du centre de la dalle dans l'atlas.
    b: [(c[0] * n - x0) / cols, (c[1] * n - y0) / rows],
  // Fin du plan.
  };
// Fin de drapePlan.
}

/** Coordonnées de l'atlas (u, v) d'un point de la dalle (mètres depuis le centre). */
// Déclare et exporte drapeUv : le plan et un point en mètres depuis le centre.
export function drapeUv(plan, x, y) {
  // Renvoie u et v par la transformation affine.
  return [plan.a[0] * x + plan.a[1] * y + plan.b[0], plan.a[2] * x + plan.a[3] * y + plan.b[1]];
// Fin de drapeUv.
}

/**
 * Affine d'un nœud : de ses coordonnées quantifiées (pas de `step` mètres, origine `origin` en mètres depuis le
 * centre de la dalle) aux coordonnées de l'atlas. Renvoie { a, b } pour le shader.
 */
// Déclare et exporte nodeDrape : le plan, l'origine du nœud et son pas de quantification.
export function nodeDrape(plan, origin, step) {
  // Coordonnées de l'origine du nœud dans l'atlas.
  const [u, v] = drapeUv(plan, origin[0], origin[1]);
  // Renvoie les coefficients multipliés par le pas, et ces coordonnées comme décalage.
  return { a: plan.a.map((k) => k * step), b: [u, v] };
// Fin de nodeDrape.
}

/**
 * Tuiles à charger : d'abord quelques tuiles grossières (`coarse`, 3 niveaux au-dessus) qui couvrent toute la dalle
 * en une fraction de seconde, puis les tuiles fines (`fine`), du centre vers les bords.
 */
// Déclare et exporte drapeTiles : le plan.
export function drapeTiles(plan) {
  // Nombre de niveaux à remonter (3, ou moins si le plan est plus bas) et le rapport de taille correspondant.
  const drop = Math.min(3, plan.z), k = 2 ** drop;
  // Liste des tuiles grossières.
  const coarse = [];
  // Pour chaque ligne de tuiles grossières qui touche le plan (début).
  for (let y = Math.floor(plan.y0 / k); y <= Math.floor((plan.y0 + plan.rows - 1) / k); y++) {
    // Pour chaque colonne : ajoute la tuile grossière.
    for (let x = Math.floor(plan.x0 / k); x <= Math.floor((plan.x0 + plan.cols - 1) / k); x++) coarse.push({ z: plan.z - drop, x, y });
  // Fin de la boucle des lignes.
  }
  // Liste des tuiles fines.
  const fine = [];
  // Ajoute chaque tuile du plan, ligne par ligne.
  for (let y = 0; y < plan.rows; y++) for (let x = 0; x < plan.cols; x++) fine.push({ z: plan.z, x: plan.x0 + x, y: plan.y0 + y });
  // Centre du plan, en coordonnées de tuile.
  const cx = plan.x0 + (plan.cols - 1) / 2, cy = plan.y0 + (plan.rows - 1) / 2;
  // Trie les tuiles fines par distance croissante à ce centre.
  fine.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
  // Renvoie les deux listes ; sans niveau à remonter, pas de tuiles grossières.
  return { coarse: drop ? coarse : [], fine };
// Fin de drapeTiles.
}

/** Rectangle de l'atlas (px) où dessiner une tuile de niveau ≤ plan.z : { x, y, size } (peut dépasser de l'atlas). */
// Déclare et exporte tileRect : le plan et une tuile.
export function tileRect(plan, { z, x, y }) {
  // Nombre de tuiles du plan couvertes par un côté de cette tuile.
  const k = 2 ** (plan.z - z);
  // Renvoie la position de la tuile dans l'atlas et sa taille, en pixels.
  return { x: (x * k - plan.x0) * TILE_PX, y: (y * k - plan.y0) * TILE_PX, size: TILE_PX * k };
// Fin de tileRect.
}
