// Mosaïques ShadowCam (Danuri) : géométrie en projection stéréographique polaire. Fonctions pures, testées.
import { lonLatToXYZ } from './tiles/mercator';

const D = Math.PI / 180;

/** Inverse de la stéréographique polaire sphérique (mêmes paramètres que le backend : pole, lon0, k0, radius). */
export function polarToLonLat(x, y, p) {
  const c = 2 * Math.atan(Math.hypot(x, y) / (2 * p.radius * p.k0));
  if (p.pole === 'south') return [wrap(p.lon0 + Math.atan2(x, y) / D), -(90 - c / D)];
  return [wrap(p.lon0 + Math.atan2(x, -y) / D), 90 - c / D];
}
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * Maillage d'une mosaïque sur la sphère unité, sommets relatifs à son centre (comme les tuiles).
 * uv : u vers la droite, v = 1 en haut de l'image (texture avec flipY).
 */
export function buildMosaicGrid(meta, n = 48) {
  const w = meta.width * meta.resX, h = meta.height * meta.resY;
  const pts = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = meta.originX + (i / n) * w, y = meta.originY - (j / n) * h;
    pts.push(lonLatToXYZ(...polarToLonLat(x, y, meta)));
  }
  const mid = pts[(n / 2) * (n + 1) + n / 2];
  const positions = new Float32Array(pts.length * 3), normals = new Float32Array(pts.length * 3), uvs = new Float32Array(pts.length * 2);
  pts.forEach((p, k) => {
    positions.set([p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]], k * 3);
    normals.set(p, k * 3);
    uvs.set([(k % (n + 1)) / n, 1 - Math.floor(k / (n + 1)) / n], k * 2);
  });
  const indices = new Uint16Array(n * n * 6);
  let q = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    indices.set([a, c, b, b, c, d], q); q += 6;
  }
  // Rayon angulaire (rad) : pour savoir si la caméra est au-dessus.
  let radius = 0;
  for (const p of [pts[0], pts[n], pts[pts.length - 1 - n], pts[pts.length - 1]]) {
    radius = Math.max(radius, Math.acos(Math.min(1, p[0] * mid[0] + p[1] * mid[1] + p[2] * mid[2])));
  }
  return { positions, normals, uvs, indices, center: mid, radius };
}
