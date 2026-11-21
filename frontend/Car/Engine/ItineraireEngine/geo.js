/**
 * Géométrie sphérique de l'itinéraire : fonctions pures (aucun React, aucun three.js), partagées par les moteurs et
 * les deux rendus. Une position est { lat, lon } en degrés (Nord et Est positifs), la Terre une sphère de 6 371 km.
 */

/** Rayon moyen de la Terre (km). */
export const EARTH_R_KM = 6371;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Distance au sol entre deux positions (km, formule de haversine). */
export function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longueur d'un tracé (km). */
export function polylineKm(points) {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/** Vecteur unitaire (x, y, z) d'une position : y vers le pôle Nord, z vers (0°, 0°), x vers l'Est. Rayon `r` facultatif. */
export function latLonToVec(lat, lon, r = 1) {
  const cl = Math.cos(lat * RAD);
  return [r * cl * Math.sin(lon * RAD), r * Math.sin(lat * RAD), r * cl * Math.cos(lon * RAD)];
}

/** Position d'un vecteur (de n'importe quelle norme non nulle). */
export function vecToLatLon([x, y, z]) {
  const n = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(Math.max(-1, Math.min(1, y / n))) * DEG, lon: Math.atan2(x, z) * DEG };
}

/** Position à la fraction `t` (0 à 1) du grand cercle de a à b. */
export function lerpGreatCircle(a, b, t) {
  const va = latLonToVec(a.lat, a.lon), vb = latLonToVec(b.lat, b.lon);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const w = Math.acos(dot);
  if (w < 1e-9) return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  const s = Math.sin(w), ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
  return vecToLatLon([ka * va[0] + kb * vb[0], ka * va[1] + kb * vb[1], ka * va[2] + kb * vb[2]]);
}

/** Cap (degrés, 0 = Nord, 90 = Est) en allant de a vers b. */
export function bearingDeg(a, b) {
  const p1 = a.lat * RAD, p2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

/** Distances cumulées d'un tracé : [0, d1, d1+d2, …] (km). */
export function cumulativeKm(points) {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + haversineKm(points[i - 1], points[i]));
  return out;
}

/**
 * Rééchantillonne un tracé en `n` points (n ≥ 2) équidistants le long du tracé, chaque arête suivant le grand cercle.
 * Chaque point porte `d`, sa distance depuis le départ (km). Un tracé de longueur nulle donne n copies du départ.
 */
export function sampleAlong(points, n) {
  const count = Math.max(2, Math.floor(n));
  const cum = cumulativeKm(points);
  const total = cum[cum.length - 1];
  if (!(total > 0)) return Array.from({ length: count }, () => ({ lat: points[0].lat, lon: points[0].lon, d: 0 }));
  const out = [];
  let edge = 0;
  for (let k = 0; k < count; k++) {
    const d = (total * k) / (count - 1);
    while (edge < cum.length - 2 && cum[edge + 1] < d) edge++;
    const span = cum[edge + 1] - cum[edge];
    const t = span > 0 ? Math.min(1, Math.max(0, (d - cum[edge]) / span)) : 0;
    out.push({ ...lerpGreatCircle(points[edge], points[edge + 1], t), d });
  }
  return out;
}

/** Lisse un tracé par la méthode de Chaikin (coins coupés), extrémités conservées. */
export function chaikin(points, iterations = 1) {
  let pts = points;
  for (let it = 0; it < iterations && pts.length > 2; it++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      next.push({ lat: 0.75 * a.lat + 0.25 * b.lat, lon: 0.75 * a.lon + 0.25 * b.lon }, { lat: 0.25 * a.lat + 0.75 * b.lat, lon: 0.25 * a.lon + 0.75 * b.lon });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/** Longitudes rendues continues d'un point au suivant (pas de saut de 360° à l'antiméridien). */
export function unwrapLongitudes(points) {
  let prev = null;
  return points.map((p) => {
    let lon = p.lon;
    if (prev !== null) while (lon - prev > 180) lon -= 360;
    if (prev !== null) while (lon - prev < -180) lon += 360;
    prev = lon;
    return { ...p, lon };
  });
}

/**
 * Projection plane (équirectangulaire corrigée de cos(latitude)) qui fait tenir des points dans un cadre
 * `width` × `height` avec une marge `pad`, en conservant les proportions. `project({lat, lon})` donne [x, y] en pixels
 * (y vers le bas). Les points doivent avoir des longitudes continues (voir unwrapLongitudes).
 */
export function fitProjection(points, width, height, pad = 24) {
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const k = Math.max(0.05, Math.cos(((minLat + maxLat) / 2) * RAD));
  // Étendue minimale : un tracé minuscule (quelques mètres) ne doit pas donner une échelle infinie.
  const w = Math.max((maxLon - minLon) * k, 1e-5), h = Math.max(maxLat - minLat, 1e-5);
  const scale = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  const cx = (minLon + maxLon) / 2, cy = (minLat + maxLat) / 2;
  return {
    scale,
    project: (p) => [width / 2 + (p.lon - cx) * k * scale, height / 2 - (p.lat - cy) * scale],
  };
}

/** Point d'un tracé échantillonné à la fraction u (0 à 1), interpolé entre ses deux voisins : { lat, lon, alt, heading }. */
export function pointAt(points, u) {
  const f = Math.min(1, Math.max(0, u)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  const t = f - i, a = points[i], b = points[i + 1];
  return {
    lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t,
    alt: (a.alt ?? 0) + ((b.alt ?? 0) - (a.alt ?? 0)) * t, heading: bearingDeg(a, b),
  };
}

/** Exagération de l'altitude pour le rendu 3D : le point le plus haut s'élève d'au moins 4 % du rayon du globe (jamais réduite). */
export function altitudeScale(maxAltKm) {
  return maxAltKm > 0 ? Math.max(1, 0.04 / (maxAltKm / EARTH_R_KM)) : 1;
}
