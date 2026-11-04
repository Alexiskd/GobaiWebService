// Interpolation de la table JPL Horizons (GET /ephemeris/moon), sans three.js (testable).

/**
 * Position Terre → Lune (km, écliptique J2000) à l'instant `t` (ms UTC), par spline de Catmull-Rom sur la table
 * (pas régulier de 30 min). Erreur d'interpolation de l'ordre du mètre. `null` hors de la table : le moteur
 * revient alors à la théorie ELP abrégée.
 * @param {{ t: number, x: number, y: number, z: number }[]} points  triés par date
 */
export function interpolateState(points, t) {
  const n = points.length;
  if (n < 4 || t < points[1].t || t > points[n - 2].t) return null;
  // Recherche dichotomique de l'intervalle [i, i + 1] qui contient t.
  let lo = 1, hi = n - 2;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid; else hi = mid;
  }
  const p0 = points[lo - 1], p1 = points[lo], p2 = points[lo + 1], p3 = points[Math.min(lo + 2, n - 1)];
  const u = (t - p1.t) / (p2.t - p1.t || 1);
  const u2 = u * u, u3 = u2 * u;
  const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), z: cr(p0.z, p1.z, p2.z, p3.z) };
}

/** Vecteur écliptique (km) → { lon, lat (degrés), distKm }. */
export function eclipticOf({ x, y, z }) {
  const distKm = Math.hypot(x, y, z);
  return { lon: (Math.atan2(y, x) * 180) / Math.PI, lat: (Math.asin(z / distKm) * 180) / Math.PI, distKm };
}
