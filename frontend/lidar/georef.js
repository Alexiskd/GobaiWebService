// Géoréférencement des nuages : système de coordonnées du fichier (EPSG ou WKT) → latitude / longitude WGS84,
// puis repère local Est-Nord-Haut (ENU, mètres) au centre du nuage. Aucune dépendance (testable avec node --test).
//
// Projections prises en charge (ellipsoïde GRS80 / WGS84, écart < 0,1 mm entre les deux) :
//   · Lambert-93 (EPSG:2154, 9793, 9794) et coniques conformes 9 zones CC42 à CC50 (EPSG:3942 à 3950)
//   · UTM WGS84 (EPSG:326zz / 327zz), ETRS89 (258zz) et zones UTM des outre-mer (RGFG95, RGR92, RGM04, RGAF09…)
//   · Web Mercator (EPSG:3857)
//   · coordonnées géographiques (EPSG:4326, 4171, 4258, 4269, 4979, 4937…), x = longitude, y = latitude
// RGF93 et ETRS89 coïncident avec WGS84 à quelques décimètres près : aucune transformation de datum n'est appliquée.

const D = Math.PI / 180;
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = 2 * F - F * F;
const E = Math.sqrt(E2);

// ------------------------------------------------------------------ Lambert conique conforme (2 parallèles)

const tFn = (phi) => {
  const s = Math.sin(phi);
  return Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - E * s) / (1 + E * s), E / 2);
};
const mFn = (phi) => Math.cos(phi) / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);

export function lambertConic({ lat0, lon0, lat1, lat2, x0, y0 }) {
  const p1 = lat1 * D, p2 = lat2 * D;
  const n = (Math.log(mFn(p1)) - Math.log(mFn(p2))) / (Math.log(tFn(p1)) - Math.log(tFn(p2)));
  const aF = A * (mFn(p1) / (n * Math.pow(tFn(p1), n)));
  const rho0 = aF * Math.pow(tFn(lat0 * D), n);
  const l0 = lon0 * D;
  return {
    forward(lon, lat) {
      const rho = aF * Math.pow(tFn(lat * D), n);
      const theta = n * (lon * D - l0);
      return [x0 + rho * Math.sin(theta), y0 + rho0 - rho * Math.cos(theta)];
    },
    inverse(x, y) {
      const dx = x - x0, dy = rho0 - (y - y0);
      const rho = Math.sign(n) * Math.hypot(dx, dy);
      const theta = Math.atan2(Math.sign(n) * dx, Math.sign(n) * dy);
      const t = Math.pow(rho / aF, 1 / n);
      let phi = Math.PI / 2 - 2 * Math.atan(t);
      for (let i = 0; i < 15; i++) {
        const s = Math.sin(phi);
        const next = Math.PI / 2 - 2 * Math.atan(t * Math.pow((1 - E * s) / (1 + E * s), E / 2));
        if (Math.abs(next - phi) < 1e-12) { phi = next; break; }
        phi = next;
      }
      return [(theta / n + l0) / D, phi / D];
    },
  };
}

// ------------------------------------------------------------------ Mercator transverse (UTM)

const EP2 = E2 / (1 - E2);
const meridianArc = (phi) => A * (
  (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi
  - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
  + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi)
  - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi)
);

export function transverseMercator({ lon0, k0 = 0.9996, x0 = 500000, y0 = 0 }) {
  const l0 = lon0 * D;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  return {
    forward(lon, lat) {
      const phi = lat * D;
      const s = Math.sin(phi), c = Math.cos(phi), tn = Math.tan(phi);
      const N = A / Math.sqrt(1 - E2 * s * s);
      const T = tn * tn, C = EP2 * c * c, a = (lon * D - l0) * c;
      const M = meridianArc(phi);
      const x = k0 * N * (a + (1 - T + C) * a ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * a ** 5 / 120);
      const y = k0 * (M + N * tn * (a * a / 2 + (5 - T + 9 * C + 4 * C * C) * a ** 4 / 24
        + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * a ** 6 / 720));
      return [x0 + x, y0 + y];
    },
    inverse(x, y) {
      const M = (y - y0) / k0;
      const mu = M / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
      const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
        + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
        + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
      const s = Math.sin(p1), c = Math.cos(p1), tn = Math.tan(p1);
      const C1 = EP2 * c * c, T1 = tn * tn;
      const N1 = A / Math.sqrt(1 - E2 * s * s);
      const R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5);
      const d = (x - x0) / (N1 * k0);
      const phi = p1 - (N1 * tn / R1) * (d * d / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * d ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * d ** 6 / 720);
      const lam = l0 + (d - (1 + 2 * T1 + C1) * d ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * d ** 5 / 120) / c;
      return [lam / D, phi / D];
    },
  };
}

const utm = (zone, south) => transverseMercator({ lon0: zone * 6 - 183, y0: south ? 10_000_000 : 0 });

// ------------------------------------------------------------------ Web Mercator et géographique

const webMercator = {
  forward: (lon, lat) => [A * lon * D, A * Math.log(Math.tan(Math.PI / 4 + (lat * D) / 2))],
  inverse: (x, y) => [x / A / D, (2 * Math.atan(Math.exp(y / A)) - Math.PI / 2) / D],
};
const geographic = { geographic: true, forward: (lon, lat) => [lon, lat], inverse: (x, y) => [x, y] };

// ------------------------------------------------------------------ Résolution du système de coordonnées

const GEOGRAPHIC_CODES = new Set([4326, 4979, 4171, 4965, 4258, 4937, 4269, 4167, 4283, 4624, 4627, 7084, 7085, 9776, 9777, 9781, 9782]);
const LAMBERT93_CODES = new Set([2154, 9793, 9794]);
// Zones UTM des territoires français et autres codes nationaux courants : EPSG → [zone, hémisphère sud].
const UTM_EXTRA = {
  2969: [20, false], 2970: [20, false], 2972: [22, false], 2973: [20, false], 2975: [40, true], 2980: [38, true],
  4471: [38, true], 4559: [20, false], 5490: [20, false], 3727: [40, true],
};

/** Projection associée à un code EPSG, ou null si elle n'est pas prise en charge. */
export function projectionForEpsg(code) {
  const epsg = Number(code);
  if (!Number.isFinite(epsg)) return null;
  if (LAMBERT93_CODES.has(epsg)) {
    return { label: 'Lambert-93', ...lambertConic({ lat0: 46.5, lon0: 3, lat1: 44, lat2: 49, x0: 700000, y0: 6600000 }) };
  }
  if (epsg >= 3942 && epsg <= 3950) {
    const n = epsg - 3900;
    return {
      label: `Conique conforme CC${n}`,
      ...lambertConic({ lat0: n, lon0: 3, lat1: n - 0.75, lat2: n + 0.75, x0: 1700000, y0: (n - 42) * 1_000_000 + 1_200_000 }),
    };
  }
  if (epsg >= 32601 && epsg <= 32660) return { label: `UTM ${epsg - 32600}N`, ...utm(epsg - 32600, false) };
  if (epsg >= 32701 && epsg <= 32760) return { label: `UTM ${epsg - 32700}S`, ...utm(epsg - 32700, true) };
  if (epsg >= 25828 && epsg <= 25838) return { label: `ETRS89 UTM ${epsg - 25800}N`, ...utm(epsg - 25800, false) };
  if (UTM_EXTRA[epsg]) {
    const [zone, south] = UTM_EXTRA[epsg];
    return { label: `UTM ${zone}${south ? 'S' : 'N'}`, ...utm(zone, south) };
  }
  if (epsg === 3857 || epsg === 900913 || epsg === 3785) return { label: 'Web Mercator', ...webMercator };
  if (GEOGRAPHIC_CODES.has(epsg)) return { label: 'Géographique (degrés)', ...geographic };
  return null;
}

/** Codes EPSG candidats : clé GeoTIFF, puis toutes les autorités du WKT (système composé : horizontal d'abord). */
function candidateCodes(crs) {
  const codes = [];
  if (crs?.epsg) codes.push(crs.epsg);
  if (crs?.wkt) for (const m of crs.wkt.matchAll(/(?:AUTHORITY|ID)\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)) codes.push(Number(m[1]));
  return codes;
}

/** Projection décrite par l'en-tête LAS (`header.crs` de readLasHeader), ou null. */
export function resolveProjection(crs) {
  for (const code of candidateCodes(crs)) {
    const projection = projectionForEpsg(code);
    if (projection) return { epsg: code, ...projection };
  }
  const wkt = crs?.wkt || '';
  if (/lambert[-_ ]?93/i.test(wkt)) return { epsg: 2154, ...projectionForEpsg(2154) };
  const zone = wkt.match(/UTM[_ ]zone[_ ](\d{1,2})\s*([NS])/i);
  if (zone) {
    const z = Number(zone[1]), south = zone[2].toUpperCase() === 'S';
    return { epsg: (south ? 32700 : 32600) + z, label: `UTM ${z}${south ? 'S' : 'N'}`, ...utm(z, south) };
  }
  return null;
}

const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Repère local du nuage : position géographique du centre et matrice 2 × 2 qui convertit les écarts dans la grille
 * du fichier (x, y) en mètres vers l'est et le nord. Elle intègre la convergence des méridiens et le facteur d'échelle
 * de la projection (≈ 1 m d'erreur sur 10 km pour Lambert-93), ou le passage degrés → mètres en géographique.
 * @param {{epsg?: number, wkt?: string}} crs
 * @param {number[]} center  [x, y, z] du centre dans le système du fichier
 * @returns {null | { lon, lat, height, matrix: [ex, nx, ey, ny], epsg, label }}
 *   east = ex·dx + ey·dy ; north = nx·dx + ny·dy
 */
export function geoFrame(crs, center) {
  const projection = resolveProjection(crs);
  if (!projection) return null;
  const [cx, cy, cz] = center;
  const [lon, lat] = projection.inverse(cx, cy);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90) return null;
  const step = projection.geographic ? 1e-5 : 1;
  const [lonE, latE] = projection.inverse(cx + step, cy);
  const [lonN, latN] = projection.inverse(cx, cy + step);
  const s = Math.sin(lat * D);
  const w = Math.sqrt(1 - E2 * s * s);
  const primeVertical = A / w;                 // rayon de courbure est-ouest
  const meridional = (A * (1 - E2)) / (w * w * w); // rayon de courbure nord-sud
  const toEN = (lo, la) => [wrap180(lo - lon) * D * primeVertical * Math.cos(lat * D) / step, (la - lat) * D * meridional / step];
  const [ex, nx] = toEN(lonE, latE);
  const [ey, ny] = toEN(lonN, latN);
  return {
    lon: wrap180(lon), lat, height: Number.isFinite(cz) ? cz : 0,
    matrix: [ex, nx, ey, ny],
    epsg: projection.epsg, label: projection.label,
  };
}

/** Repère manuel (fichier sans système de coordonnées) : grille supposée en mètres, axes x = est, y = nord. */
export const manualFrame = (lat, lon, height = 0) => ({ lon, lat, height, matrix: [1, 0, 0, 1], epsg: null, label: 'Placement manuel' });
