// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis mercator.
import { lonLatToXYZ } from './mercator';
// Importe MERCATOR, la projection par défaut, depuis projection.
import { MERCATOR } from './projection';

/**
 * Choisit les tuiles à afficher pour une caméra donnée. Fonction pure : aucun accès à three.js ni au DOM.
 *
 * Critère d'erreur à l'écran (SSE, « Screen Space Error », comme les moteurs de globe 3D) :
 *   erreur géométrique de la tuile = taille au sol d'un pixel de sa texture (taille de la tuile / tileSize) ;
 *   SSE = erreur / distance caméra–tuile × hauteur écran / (2·tan(FOV/2))   (en pixels d'écran).
 * Si SSE > `maxSSE` (2 px par défaut), la tuile n'est pas assez détaillée : on descend chercher ses 4 enfants.
 * Sinon elle part dans la liste de rendu et la branche s'arrête.
 * Élimination : horizon (courbure de l'astre) puis champ de vision (sphère englobante contre le tronc de cône).
 *
 * @param {object} view
 *  cam        [x,y,z] position de la caméra dans le repère de la Terre (rayon = 1)
 *  fovY       champ vertical, radians
 *  viewportH  hauteur du viewport en pixels
 *  inFrustum  (centre[x,y,z], rayon) => bool, optionnel
 * @param {object} [opts]  minZoom, maxZoom, tileSize (256), maxSSE (2 px), maxTiles (256, au-delà le seuil SSE augmente),
 *                         projection (MERCATOR par défaut, ou EQUIRECTANGULAR — voir projection.js).
 *                         Ancienne forme acceptée : maxTilePx (= maxSSE × tileSize).
 * @returns {{z,x,y,d,sse,c}[]} tuiles triées de la plus proche à la plus lointaine (d = distance, c = centre sur la sphère)
 */
// Déclare et exporte selectTiles : la vue et les options.
export function selectTiles(view, opts = {}) {
  // Taille d'une tuile (256 pixels) et nombre maximal de tuiles (256), par défaut.
  const { tileSize = 256, maxTiles = 256 } = opts;
  // Erreur maximale à l'écran : l'option maxSSE, ou l'ancienne option maxTilePx divisée par la taille d'une tuile, ou 2 pixels.
  const maxSSE = opts.maxSSE ?? (opts.maxTilePx ?? 2 * tileSize) / tileSize;
  // Trop de tuiles ? On tolère une erreur plus grande (image un peu plus floue) plutôt que de laisser des trous.
  // Un passage qui dépasse `maxTiles` est abandonné dès le dépassement (sauf le dernier) : pas de parcours inutile.
  // Résultat, et seuil d'erreur du passage en cours.
  let out = [], sse = maxSSE;
  // Six passages au plus, le seuil étant multiplié par 1,5 à chaque fois (début).
  for (let i = 0; i < 6; i++, sse *= 1.5) {
    // Sélection avec ce seuil ; les cinq premiers passages s'arrêtent dès que la limite est dépassée, le dernier va au bout.
    out = selectAt(view, { ...opts, tileSize, maxSSE: sse }, i < 5 ? maxTiles : Infinity);
    // Si le nombre de tuiles tient dans la limite : terminé.
    if (out.length <= maxTiles) break;
  // Fin de la boucle.
  }
  // Renvoie le résultat, coupé à la limite s'il la dépasse encore.
  return out.length > maxTiles ? out.slice(0, maxTiles) : out;
// Fin de selectTiles.
}

// Géométrie fixe d'une tuile (centre, rayon angulaire, latitude médiane), calculée une seule fois par découpage.
// Clé numérique exacte : z < 32, x et y < 2^23 → (z·2^23 + x)·2^23 + y < 2^51.
// Nombre maximal de géométries gardées par projection : 60 000.
const GEO_CACHE_MAX = 60000;
// Caches des géométries, un par projection.
const geoCaches = new Map(); // projection.id → Map(clé → géométrie)
// clamp1 : borne une valeur entre −1 et 1.
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
// RAD : nombre de radians dans un degré.
const RAD = Math.PI / 180;

// tileGeo : la géométrie fixe d'une tuile, calculée une fois puis gardée en cache (début).
function tileGeo(proj, cache, z, x, y) {
  // Clé numérique de la tuile.
  const key = (z * 8388608 + x) * 8388608 + y;
  // Géométrie déjà en cache.
  let g = cache.get(key);
  // Trouvée : renvoyée telle quelle.
  if (g) return g;
  // Latitudes des bords nord et sud.
  const north = proj.lat(y, z), south = proj.lat(y + 1, z);
  // Longitudes des bords ouest et est.
  const west = proj.lon(x, z), east = proj.lon(x + 1, z);
  // Latitude médiane.
  const midLat = (north + south) / 2;
  // Centre de la tuile sur la sphère.
  const c = lonLatToXYZ((west + east) / 2, midLat);
  // Rayon angulaire de la tuile : plus grand écart entre son centre et ses quatre coins (sans allocation).
  // Cosinus et sinus de la latitude nord.
  const cn = Math.cos(north * RAD), sn = Math.sin(north * RAD);
  // Cosinus et sinus de la latitude sud.
  const cs = Math.cos(south * RAD), ss = Math.sin(south * RAD);
  // Cosinus et sinus de la longitude ouest.
  const cw = Math.cos(west * RAD), sw = Math.sin(west * RAD);
  // Cosinus et sinus de la longitude est.
  const ceE = Math.cos(east * RAD), seE = Math.sin(east * RAD);
  // corner : angle entre le centre et un coin, donné par les cosinus et sinus de sa latitude et de sa longitude.
  const corner = (cl, sl, co, so) => Math.acos(clamp1(c[0] * cl * co + c[1] * sl - c[2] * cl * so));
  // Rayon angulaire : le plus grand des quatre angles.
  const rho = Math.max(corner(cn, sn, cw, sw), corner(cn, sn, ceE, seE), corner(cs, ss, cw, sw), corner(cs, ss, ceE, seE));
  // La géométrie : centre, rayon angulaire, taille au sol et rayon de la sphère englobante.
  g = { c, rho, size: proj.groundSize(z, midLat), bound: 2 * Math.sin(Math.min(rho, Math.PI / 2) / 2) + 1e-9 };
  // Cache plein : il est vidé.
  if (cache.size >= GEO_CACHE_MAX) cache.clear();
  // Range la géométrie dans le cache.
  cache.set(key, g);
  // La renvoie.
  return g;
// Fin de tileGeo.
}

// selectAt : un passage de sélection, avec une limite de tuiles (aucune par défaut) (début).
function selectAt(view, opts, limit = Infinity) {
  // Options avec leurs valeurs par défaut : niveaux 0 à 19, tuiles de 256 pixels, erreur de 2 pixels, projection de Mercator.
  const { minZoom = 0, maxZoom = 19, tileSize = 256, maxSSE = 2, projection: proj = MERCATOR } = opts;
  // La caméra, le champ vertical, la hauteur de l'écran et le test du champ de vision.
  const { cam, fovY, viewportH, inFrustum } = view;
  // Distance de la caméra au centre.
  const camLen = Math.hypot(cam[0], cam[1], cam[2]);
  // Caméra à la surface ou à l'intérieur : aucune tuile.
  if (!(camLen > 1)) return []; // caméra dans la Terre : rien à afficher
  // Nombre de pixels d'écran par unité de longueur vue à une distance de 1.
  const pxPerUnit = viewportH / (2 * Math.tan(fovY / 2));
  // Angle de l'horizon.
  const horizon = Math.acos(1 / camLen); // angle (rad) entre la verticale de la caméra et l'horizon
  // Direction unitaire de la caméra.
  const dx = cam[0] / camLen, dy = cam[1] / camLen, dz = cam[2] / camLen;
  // Cache des géométries de cette projection.
  let cache = geoCaches.get(proj.id);
  // Créé s'il n'existe pas encore.
  if (!cache) geoCaches.set(proj.id, (cache = new Map()));

  // Liste des tuiles retenues.
  const out = [];
  // Indicateur de dépassement de la limite.
  let overflow = false;
  // visit : examine une tuile (début).
  const visit = (z, x, y) => {
    // Limite dépassée : arrêt.
    if (overflow) return;
    // Géométrie de la tuile.
    const g = tileGeo(proj, cache, z, x, y);
    // Son centre.
    const c = g.c;

    // Horizon : la tuile est cachée si son centre est à plus de (horizon + rho) de la verticale caméra.
    // Angle entre la direction de la caméra et le centre de la tuile.
    const ang = Math.acos(clamp1(dx * c[0] + dy * c[1] + dz * c[2]));
    // Au-delà de l'horizon plus le rayon de la tuile : cachée.
    if (ang > horizon + g.rho) return;
    // Hors du champ de vision : écartée.
    if (inFrustum && !inFrustum(c, g.bound)) return;

    // Distance de la caméra au centre de la tuile.
    const dist = Math.hypot(cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]);
    // Taille au sol (en rayons de l'astre) : dépend du découpage (Mercator : (2π/2^z)·cos(lat)).
    // Taille au sol de la tuile.
    const size = g.size;
    // Distance au point le plus proche de la tuile, jamais nulle.
    const near = Math.max(dist - size / 2, 1e-9);
    // Erreur géométrique : la taille au sol d'un pixel de la texture.
    const geometricError = size / tileSize;           // taille au sol d'un pixel de texture
    // Erreur à l'écran, en pixels.
    const sse = (geometricError / near) * pxPerUnit;  // erreur projetée à l'écran, en pixels

    // Sous le niveau minimal, ou erreur trop grande avant le niveau maximal (début).
    if (z < minZoom || (sse > maxSSE && z < maxZoom)) {
      // Niveau suivant et coordonnées doublées.
      const z1 = z + 1, x2 = x * 2, y2 = y * 2;
      // Examine les quatre tuiles enfants.
      visit(z1, x2, y2); visit(z1, x2 + 1, y2); visit(z1, x2, y2 + 1); visit(z1, x2 + 1, y2 + 1);
    // Sinon (début).
    } else {
      // Retient la tuile, avec sa distance, son erreur et son centre.
      out.push({ z, x, y, d: dist, sse, c });
      // Limite dépassée : le note.
      if (out.length > limit) overflow = true;
    // Fin du choix.
    }
  // Fin de visit.
  };
  // Examine chaque tuile racine de la projection.
  for (const r of proj.roots) visit(r.z, r.x, r.y);

  // Trie les tuiles de la plus proche à la plus lointaine.
  out.sort((a, b) => a.d - b.d);
  // Les renvoie.
  return out;
// Fin de selectAt.
}
