import { lonLatToXYZ } from './mercator.js';
import { MERCATOR } from './projection.js';

/**
 * Écart entre deux niveaux de tuiles (rayons), selon l'altitude de la caméra : les niveaux fins sont posés légèrement
 * au-dessus des grossiers (quand un ancêtre remplace une tuile pas encore chargée), sans jamais dépasser ≈ 9 % de
 * l'altitude au niveau 22. De loin : 1e-6 (≈ 6 m) comme avant ; à 15 m d'altitude : ≈ 4 cm.
 */
export const levelGap = (altitude) => Math.min(1e-6, Math.max(1e-10, altitude * 0.004));
/** Rayon d'une tuile de niveau z pour un écart donné (voir `levelGap`). */
export const tileRadius = (z, gap = 1e-6) => 1 + gap * (1 + z);

const MAX_SEGMENTS = 64;
const SEGMENT_DEG = 1; // un sommet tous les ~1° : les arêtes de tuiles voisines de niveaux différents restent quasi confondues

/**
 * Maillage d'une tuile sur la sphère, en tableaux bruts (convertis en BufferGeometry par l'appelant).
 * Les rangées sont réparties régulièrement dans l'espace de la projection (Mercator ou plate carrée), comme
 * l'image : un pixel de la texture tombe donc à la bonne latitude. uv.v = 1 en haut (Nord), pour une texture avec flipY.
 *
 * Précision : les sommets sont donnés RELATIVEMENT au centre de la tuile (`center`, sur la sphère unité) et à rayon 1.
 * Le maillage est placé par sa matrice (translation = center·r, échelle = r), calculée en double précision côté JS :
 * le GPU ne voit que de petites coordonnées, ce qui permet de descendre au zoom 22 (≈ 4 cm par pixel) sans tremblement.
 *
 * Jupes (`skirt` > 0, profondeur en rayons) : chaque bord reçoit une bande verticale qui descend vers le centre de
 * l'astre, avec les uv et la normale du bord. Entre deux tuiles voisines de niveaux différents, dont les arêtes ne
 * tombent pas exactement sur les mêmes points, la jupe bouche la fissure : on ne voit jamais l'espace à travers le sol.
 */
export function buildTileGrid(z, x, y, proj = MERCATOR, { skirt = 0 } = {}) {
  const west = proj.lon(x, z), east = proj.lon(x + 1, z);
  const north = proj.lat(y, z), south = proj.lat(y + 1, z);
  const nu = Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil((east - west) / SEGMENT_DEG)));
  const nv = Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil((north - south) / SEGMENT_DEG)));

  const center = lonLatToXYZ((west + east) / 2, proj.lat(y + 0.5, z));
  const gridCount = (nu + 1) * (nv + 1);
  const ring = skirt > 0 ? 2 * (nu + nv) : 0; // sommets du pourtour (un par sommet de bord)
  const positions = new Float32Array((gridCount + ring) * 3);
  const normals = new Float32Array(positions.length);
  const uvs = new Float32Array((gridCount + ring) * 2);
  let p = 0, t = 0;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const lat = proj.lat(y + v, z);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const [nx, ny, nz] = lonLatToXYZ(west + u * (east - west), lat);
      positions[p] = nx - center[0]; positions[p + 1] = ny - center[1]; positions[p + 2] = nz - center[2];
      normals[p] = nx; normals[p + 1] = ny; normals[p + 2] = nz;
      p += 3;
      uvs[t++] = u;
      uvs[t++] = 1 - v;
    }
  }

  const row = nu + 1;
  // Pourtour dans l'ordre (haut → droite → bas → gauche) : indices des sommets de bord.
  const border = [];
  if (ring) {
    for (let i = 0; i < nu; i++) border.push(i);
    for (let j = 0; j < nv; j++) border.push(j * row + nu);
    for (let i = nu; i > 0; i--) border.push(nv * row + i);
    for (let j = nv; j > 0; j--) border.push(j * row);
    const down = 1 - skirt;
    border.forEach((src, n) => {
      const dst = gridCount + n;
      const nx = normals[src * 3], ny = normals[src * 3 + 1], nz = normals[src * 3 + 2];
      positions[dst * 3] = nx * down - center[0];
      positions[dst * 3 + 1] = ny * down - center[1];
      positions[dst * 3 + 2] = nz * down - center[2];
      normals.set([nx, ny, nz], dst * 3);
      uvs[dst * 2] = uvs[src * 2]; uvs[dst * 2 + 1] = uvs[src * 2 + 1];
    });
  }

  const indices = new Uint16Array(nu * nv * 6 + ring * 6);
  let k = 0;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      // Sens antihoraire vu de l'extérieur de la sphère (face avant visible).
      indices[k++] = a; indices[k++] = c; indices[k++] = b;
      indices[k++] = b; indices[k++] = c; indices[k++] = d;
    }
  }
  // Jupes : un quadrilatère entre chaque arête du bord et sa copie enfoncée (vu de l'extérieur de la tuile).
  for (let n = 0; n < ring; n++) {
    const a = border[n], b = border[(n + 1) % ring];
    const a2 = gridCount + n, b2 = gridCount + ((n + 1) % ring);
    indices[k++] = a; indices[k++] = b; indices[k++] = a2;
    indices[k++] = b; indices[k++] = b2; indices[k++] = a2;
  }
  return { positions, center, normals, uvs, indices, nu, nv, skirtVertices: ring };
}
