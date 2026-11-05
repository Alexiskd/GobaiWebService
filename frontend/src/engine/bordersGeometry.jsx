// Géométrie des frontières, sans three.js (testable) : polylignes lon/lat → segments 3D sur la sphère unité.
import { lonLatToXYZ } from './tiles/mercator';

const MAX_STEP_DEG = 0.25; // découpe : la corde d'un segment de 0,25° s'enfonce de ≈ 2,4e-6 rayon (≈ 15 m) sous la sphère

/**
 * @param {number[][]} lines  polylignes plates [lon1, lat1, lon2, lat2, …] (degrés), format de GET /borders
 * @returns {Float32Array} positions de segments (paires de points) pour THREE.LineSegments, sur la sphère de rayon 1
 */
export function buildBorderSegments(lines) {
  const out = [];
  for (const line of lines) {
    for (let i = 2; i + 1 < line.length; i += 2) {
      const lon0 = line[i - 2], lat0 = line[i - 1], lon1 = line[i], lat1 = line[i + 1];
      if (Math.abs(lon1 - lon0) > 180) continue; // saut de l'antiméridien : pas de segment à travers le globe
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon1 - lon0), Math.abs(lat1 - lat0)) / MAX_STEP_DEG));
      let prev = lonLatToXYZ(lon0, lat0);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const p = lonLatToXYZ(lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t);
        out.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
        prev = p;
      }
    }
  }
  return new Float32Array(out);
}

/**
 * Hauteur des frontières au-dessus du sol (rayons) selon l'altitude de la caméra : juste au-dessus des tuiles de près
 * (elles montent jusqu'à ≈ 2e-5), plus haut de loin pour éviter tout scintillement avec la surface.
 */
export const borderLift = (altitude) => Math.min(2e-3, Math.max(2.6e-5, altitude * 0.01));
