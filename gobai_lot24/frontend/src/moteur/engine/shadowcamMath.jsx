// Mosaïques ShadowCam (Danuri) : géométrie en projection stéréographique polaire. Fonctions pures, testées.
// Importe la conversion d'une longitude et d'une latitude en point 3D.
import { lonLatToXYZ } from './tiles/mercator';

// Facteur de conversion des degrés en radians.
const D = Math.PI / 180;

/** Inverse de la stéréographique polaire sphérique (mêmes paramètres que le backend : pole, lon0, k0, radius). */
// Déclare et exporte polarToLonLat : les coordonnées projetées et les paramètres de la projection.
export function polarToLonLat(x, y, p) {
  // Distance angulaire au pôle.
  const c = 2 * Math.atan(Math.hypot(x, y) / (2 * p.radius * p.k0));
  // Pôle Sud : longitude ramenée entre -180 et 180, latitude négative.
  if (p.pole === 'south') return [wrap(p.lon0 + Math.atan2(x, y) / D), -(90 - c / D)];
  // Pôle Nord : longitude ramenée entre -180 et 180, latitude positive.
  return [wrap(p.lon0 + Math.atan2(x, -y) / D), 90 - c / D];
// Fin de polarToLonLat.
}
// wrap : ramène une longitude entre -180 et 180.
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * Maillage d'une mosaïque sur la sphère unité, sommets relatifs à son centre (comme les tuiles).
 * uv : u vers la droite, v = 1 en haut de l'image (texture avec flipY).
 */
// Déclare et exporte buildMosaicGrid : les métadonnées de la mosaïque et le nombre de divisions (48 par défaut).
export function buildMosaicGrid(meta, n = 48) {
  // Largeur et hauteur de la mosaïque, en unités de la projection.
  const w = meta.width * meta.resX, h = meta.height * meta.resY;
  // Points de la grille.
  const pts = [];
  // Pour chaque ligne et chaque colonne de la grille.
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    // Coordonnées projetées du point.
    const x = meta.originX + (i / n) * w, y = meta.originY - (j / n) * h;
    // Son point 3D sur la sphère.
    pts.push(lonLatToXYZ(...polarToLonLat(x, y, meta)));
  // Fin de la grille.
  }
  // Le point central.
  const mid = pts[(n / 2) * (n + 1) + n / 2];
  // Tableaux des positions, des normales et des coordonnées de texture.
  const positions = new Float32Array(pts.length * 3), normals = new Float32Array(pts.length * 3), uvs = new Float32Array(pts.length * 2);
  // Pour chaque point.
  pts.forEach((p, k) => {
    // Sa position, relative au centre.
    positions.set([p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]], k * 3);
    // Sa normale : le point lui-même.
    normals.set(p, k * 3);
    // Ses coordonnées de texture, v = 1 en haut.
    uvs.set([(k % (n + 1)) / n, 1 - Math.floor(k / (n + 1)) / n], k * 2);
  // Fin du parcours.
  });
  // Tableau des indices : deux triangles par case.
  const indices = new Uint16Array(n * n * 6);
  // Position d'écriture.
  let q = 0;
  // Pour chaque case de la grille.
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    // Ses quatre coins.
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    // Ses deux triangles ; avance de six indices.
    indices.set([a, c, b, b, c, d], q); q += 6;
  // Fin des cases.
  }
  // Rayon angulaire (rad) : pour savoir si la caméra est au-dessus.
  // Rayon angulaire de la mosaïque.
  let radius = 0;
  // Pour chacun des quatre coins.
  for (const p of [pts[0], pts[n], pts[pts.length - 1 - n], pts[pts.length - 1]]) {
    // Garde le plus grand angle avec le centre.
    radius = Math.max(radius, Math.acos(Math.min(1, p[0] * mid[0] + p[1] * mid[1] + p[2] * mid[2])));
  // Fin du parcours.
  }
  // Renvoie les tableaux, le centre et le rayon.
  return { positions, normals, uvs, indices, center: mid, radius };
// Fin de buildMosaicGrid.
}
