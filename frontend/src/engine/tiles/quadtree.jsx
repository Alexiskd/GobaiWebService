import { lonLatToXYZ } from './mercator';
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
export function selectTiles(view, opts = {}) {
  const { tileSize = 256, maxTiles = 256 } = opts;
  const maxSSE = opts.maxSSE ?? (opts.maxTilePx ?? 2 * tileSize) / tileSize;
  // Trop de tuiles ? On tolère une erreur plus grande (image un peu plus floue) plutôt que de laisser des trous.
  // Un passage qui dépasse `maxTiles` est abandonné dès le dépassement (sauf le dernier) : pas de parcours inutile.
  let out = [], sse = maxSSE;
  for (let i = 0; i < 6; i++, sse *= 1.5) {
    out = selectAt(view, { ...opts, tileSize, maxSSE: sse }, i < 5 ? maxTiles : Infinity);
    if (out.length <= maxTiles) break;
  }
  return out.length > maxTiles ? out.slice(0, maxTiles) : out;
}

// Géométrie fixe d'une tuile (centre, rayon angulaire, latitude médiane), calculée une seule fois par découpage.
// Clé numérique exacte : z < 32, x et y < 2^23 → (z·2^23 + x)·2^23 + y < 2^51.
const GEO_CACHE_MAX = 60000;
const geoCaches = new Map(); // projection.id → Map(clé → géométrie)
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
const RAD = Math.PI / 180;

function tileGeo(proj, cache, z, x, y) {
  const key = (z * 8388608 + x) * 8388608 + y;
  let g = cache.get(key);
  if (g) return g;
  const north = proj.lat(y, z), south = proj.lat(y + 1, z);
  const west = proj.lon(x, z), east = proj.lon(x + 1, z);
  const midLat = (north + south) / 2;
  const c = lonLatToXYZ((west + east) / 2, midLat);
  // Rayon angulaire de la tuile : plus grand écart entre son centre et ses quatre coins (sans allocation).
  const cn = Math.cos(north * RAD), sn = Math.sin(north * RAD);
  const cs = Math.cos(south * RAD), ss = Math.sin(south * RAD);
  const cw = Math.cos(west * RAD), sw = Math.sin(west * RAD);
  const ceE = Math.cos(east * RAD), seE = Math.sin(east * RAD);
  const corner = (cl, sl, co, so) => Math.acos(clamp1(c[0] * cl * co + c[1] * sl - c[2] * cl * so));
  const rho = Math.max(corner(cn, sn, cw, sw), corner(cn, sn, ceE, seE), corner(cs, ss, cw, sw), corner(cs, ss, ceE, seE));
  g = { c, rho, size: proj.groundSize(z, midLat), bound: 2 * Math.sin(Math.min(rho, Math.PI / 2) / 2) + 1e-9 };
  if (cache.size >= GEO_CACHE_MAX) cache.clear();
  cache.set(key, g);
  return g;
}

function selectAt(view, opts, limit = Infinity) {
  const { minZoom = 0, maxZoom = 19, tileSize = 256, maxSSE = 2, projection: proj = MERCATOR } = opts;
  const { cam, fovY, viewportH, inFrustum } = view;
  const camLen = Math.hypot(cam[0], cam[1], cam[2]);
  if (!(camLen > 1)) return []; // caméra dans la Terre : rien à afficher
  const pxPerUnit = viewportH / (2 * Math.tan(fovY / 2));
  const horizon = Math.acos(1 / camLen); // angle (rad) entre la verticale de la caméra et l'horizon
  const dx = cam[0] / camLen, dy = cam[1] / camLen, dz = cam[2] / camLen;
  let cache = geoCaches.get(proj.id);
  if (!cache) geoCaches.set(proj.id, (cache = new Map()));

  const out = [];
  let overflow = false;
  const visit = (z, x, y) => {
    if (overflow) return;
    const g = tileGeo(proj, cache, z, x, y);
    const c = g.c;

    // Horizon : la tuile est cachée si son centre est à plus de (horizon + rho) de la verticale caméra.
    const ang = Math.acos(clamp1(dx * c[0] + dy * c[1] + dz * c[2]));
    if (ang > horizon + g.rho) return;
    if (inFrustum && !inFrustum(c, g.bound)) return;

    const dist = Math.hypot(cam[0] - c[0], cam[1] - c[1], cam[2] - c[2]);
    // Taille au sol (en rayons de l'astre) : dépend du découpage (Mercator : (2π/2^z)·cos(lat)).
    const size = g.size;
    const near = Math.max(dist - size / 2, 1e-9);
    const geometricError = size / tileSize;           // taille au sol d'un pixel de texture
    const sse = (geometricError / near) * pxPerUnit;  // erreur projetée à l'écran, en pixels

    if (z < minZoom || (sse > maxSSE && z < maxZoom)) {
      const z1 = z + 1, x2 = x * 2, y2 = y * 2;
      visit(z1, x2, y2); visit(z1, x2 + 1, y2); visit(z1, x2, y2 + 1); visit(z1, x2 + 1, y2 + 1);
    } else {
      out.push({ z, x, y, d: dist, sse, c });
      if (out.length > limit) overflow = true;
    }
  };
  for (const r of proj.roots) visit(r.z, r.x, r.y);

  out.sort((a, b) => a.d - b.d);
  return out;
}
