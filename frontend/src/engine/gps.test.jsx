// Tests des coordonnées GPS à l'écran : node --test src/engine/gps.test.jsx (ou npm test)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_RADIUS_M, altitudeForView, formatLatLon, gpsDecimals, insetCorners, niceScale, parseLatLon, raySphere, screenGeo,
} from './gps.jsx';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} ≠ ${b} (± ${tol})`);
const RAD = Math.PI / 180;
const unitAt = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)];
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Caméra à la verticale d'un point, regard vers le centre ; « haut » de l'écran = nord local.
function nadirView(lon, lat, altitudeM, aspect = 16 / 9) {
  const up = unitAt(lon, lat);
  const r = 1 + altitudeM / EARTH_RADIUS_M;
  const north = [-Math.sin(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD), Math.sin(lat * RAD) * Math.sin(lon * RAD)];
  const east = [-Math.sin(lon * RAD), 0, -Math.cos(lon * RAD)];
  return {
    origin: up.map((v) => v * r), forward: up.map((v) => -v), up: north, right: east,
    tanY: Math.tan(22.5 * RAD), aspect, center: [0, 0, 0], radius: 1, toLocal: IDENTITY, widthPx: 1600,
  };
}

test('rayon / sphère : précis à quelques mètres du sol', () => {
  const h = 5 / EARTH_RADIUS_M;
  const t = raySphere([0, 1 + h, 0], [0, -1, 0], [0, 0, 0], 1);
  near(t * EARTH_RADIUS_M, 5, 1e-6, 'distance au sol (m)');
  assert.equal(raySphere([0, 2, 0], [0, 1, 0], [0, 0, 0], 1), null, 'sphère derrière la caméra');
  assert.equal(raySphere([0, 2, 0], [1, 0, 0], [0, 0, 0], 1), null, 'rayon qui passe à côté');
});

test('coins de l’écran à 10 m d’échelle au-dessus de la tour Eiffel', () => {
  const lat = 48.85837, lon = 2.294481;
  const alt = altitudeForView(10);                 // hauteur de l'écran = 10 m
  near(alt, 12.07, 0.01, 'altitude du survol');
  const g = screenGeo(nadirView(lon, lat, alt));
  near(g.center.lat, lat, 1e-9, 'latitude du centre');
  near(g.center.lon, lon, 1e-9, 'longitude du centre');
  near(g.altitudeM, alt, 1e-6, 'altitude');
  const [nw, ne, sw, se] = g.corners;
  // Demi-hauteur 5 m vers le nord, demi-largeur 5 × 16/9 m vers l'est.
  const dLat = 5 / EARTH_RADIUS_M / RAD, dLon = (5 * 16 / 9) / (EARTH_RADIUS_M * Math.cos(lat * RAD)) / RAD;
  near(nw.lat - lat, dLat, 1e-8, 'haut gauche : nord'); near(nw.lon - lon, -dLon, 1e-8, 'haut gauche : ouest');
  near(se.lat - lat, -dLat, 1e-8, 'bas droite : sud'); near(se.lon - lon, dLon, 1e-8, 'bas droite : est');
  near(ne.lat, nw.lat, 1e-9, 'haut : même latitude'); near(sw.lon, nw.lon, 1e-9, 'gauche : même longitude');
  // Échelle : 10 m sur 900 px de haut ≈ 1,1 cm/px ; ici largeur 1600 px pour 17,8 m.
  near(g.metersPerPixel, (10 * 16 / 9) / 1600, 2e-4, 'mètres par pixel');
  assert.equal(gpsDecimals(g.metersPerPixel), 7, 'décimales au centimètre');
  assert.deepEqual(niceScale(g.metersPerPixel).label, '1 m');
});

test('vue du globe entier : coins dans l’espace', () => {
  const g = screenGeo(nadirView(0, 0, 3 * EARTH_RADIUS_M));
  assert.ok(g.corners.every((c) => c.lat === null), 'aucun coin sur la Terre');
  assert.ok(g.center, 'centre sur la Terre');
  assert.equal(gpsDecimals(g.metersPerPixel), 1); // ≈ 18 km par pixel
});

test('précision et barre d’échelle', () => {
  assert.equal(gpsDecimals(0.01), 7);
  assert.equal(gpsDecimals(1), 6);
  assert.equal(gpsDecimals(100), 4);
  assert.equal(gpsDecimals(10_000), 2);
  const s = niceScale(0.08); // 8 cm/px
  assert.equal(s.label, '10 m'); near(s.px, 125, 1e-9, 'longueur de la barre');
  assert.equal(niceScale(500).label, '50 km');
  assert.equal(formatLatLon(48.858372, -2.29448, 5), '48.85837° N, 2.29448° O');
});

test('saisie de coordonnées', () => {
  const cases = {
    '48.8584, 2.2945': [48.8584, 2.2945],
    '48,8584 ; 2,2945': [48.8584, 2.2945],
    '48.8584,2.2945': [48.8584, 2.2945],
    '48.8584 2.2945': [48.8584, 2.2945],
    '-33.8568 151.2153': [-33.8568, 151.2153],
    '48.8584 N 2.2945 E': [48.8584, 2.2945],
    '40.6892 N, 74.0445 O': [40.6892, -74.0445],
    '74.0445 W 40.6892 N': [40.6892, -74.0445],
    '48°51\'30"N 2°17\'40"E': [48 + 51 / 60 + 30 / 3600, 2 + 17 / 60 + 40 / 3600],
    '22°54′S 43°10′O': [-(22 + 54 / 60), -(43 + 10 / 60)],
  };
  for (const [text, [lat, lon]] of Object.entries(cases)) {
    const r = parseLatLon(text);
    assert.ok(r, `lu : ${text}`);
    near(r.lat, lat, 1e-9, `${text} lat`); near(r.lon, lon, 1e-9, `${text} lon`);
  }
  for (const bad of ['Paris', '48.85', '95, 10', '10, 200', '', '1 2 3']) assert.equal(parseLatLon(bad), null, `refusé : ${bad}`);
});

test('zone réduite : coins juste au-dessus de la barre d’outils', () => {
  const pts = insetCorners({ bottom: 120 }, 400, 800);
  const sw = pts.find((p) => p.id === 'sw'), nw = pts.find((p) => p.id === 'nw');
  near(sw.y, -1 + 240 / 800, 1e-12, 'bas relevé'); assert.equal(nw.y, 1); assert.equal(sw.x, -1);
});
