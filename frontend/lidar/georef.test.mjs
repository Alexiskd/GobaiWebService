// Tests du géoréférencement : node --test lidar/georef.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { geoFrame, projectionForEpsg, resolveProjection } from './georef.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} ≠ ${b} (± ${tol})`);

test('Lambert-93 : origine et Paris', () => {
  const l93 = projectionForEpsg(2154);
  const [lon, lat] = l93.inverse(700000, 6600000);
  near(lon, 3, 1e-9, 'longitude origine');
  near(lat, 46.5, 1e-9, 'latitude origine');
  // Référence : formules et constantes publiées par l'IGN (n = 0,7256077650, C = 11 754 255,426 m).
  const [x, y] = l93.forward(2.3499, 48.8530);
  near(x, 652_296.973, 0.01, 'X Paris');
  near(y, 6_861_636.358, 0.01, 'Y Paris');
  const [lo2, la2] = l93.inverse(x, y);
  near(lo2, 2.3499, 1e-8, 'aller-retour lon');
  near(la2, 48.8530, 1e-8, 'aller-retour lat');
});

test('CC46 et UTM : allers-retours', () => {
  const cc46 = projectionForEpsg(3946);
  const [x, y] = cc46.forward(4.85, 45.76); // Lyon
  near(x, 1_842_000, 2_000, 'X Lyon CC46');
  near(y, 5_175_000, 2_000, 'Y Lyon CC46');
  const back = cc46.inverse(x, y);
  near(back[0], 4.85, 1e-8, 'lon'); near(back[1], 45.76, 1e-8, 'lat');

  const utm31 = projectionForEpsg(32631);
  const [ux, uy] = utm31.forward(3, 0);
  near(ux, 500000, 1e-6, 'UTM méridien central'); near(uy, 0, 1e-6, 'UTM équateur');
  const [px, py] = utm31.forward(2.35, 48.85);
  const [plo, pla] = utm31.inverse(px, py);
  near(plo, 2.35, 1e-7, 'UTM lon'); near(pla, 48.85, 1e-7, 'UTM lat');

  const utm40s = projectionForEpsg(2975); // La Réunion
  const r = utm40s.inverse(...utm40s.forward(55.45, -21.1));
  near(r[0], 55.45, 1e-7, 'RGR92 lon'); near(r[1], -21.1, 1e-7, 'RGR92 lat');
});

test('résolution depuis un WKT composé (LiDAR HD IGN)', () => {
  const wkt = 'COMPD_CS["RGF93 v1 / Lambert-93 + NGF-IGN69 height",PROJCS["RGF93 v1 / Lambert-93",AUTHORITY["EPSG","2154"]],VERT_CS["NGF-IGN69 height",AUTHORITY["EPSG","5720"]],AUTHORITY["EPSG","5698"]]';
  assert.equal(resolveProjection({ epsg: 5698, wkt }).epsg, 2154);
  assert.equal(resolveProjection({ wkt: 'PROJCS["WGS 84 / UTM zone 32N"]' }).epsg, 32632);
  assert.equal(resolveProjection({ epsg: 99999 }), null);
});

test('repère local : convergence et échelle', () => {
  const l93 = projectionForEpsg(2154);
  const center = [...l93.forward(7.25, 43.7), 120]; // Nice : loin du méridien central, convergence ≈ 3°
  const frame = geoFrame({ epsg: 2154 }, center);
  near(frame.lon, 7.25, 1e-8, 'lon'); near(frame.lat, 43.7, 1e-8, 'lat');
  assert.equal(frame.height, 120);
  const [ex, nx, ey, ny] = frame.matrix;
  const scale = Math.hypot(ex, nx);
  near(scale, 1, 2e-3, 'facteur d’échelle');
  const convergence = Math.atan2(nx, ex) * 180 / Math.PI;
  near(Math.abs(convergence), 2.9, 0.3, 'convergence des méridiens (°)');
  near(ex * ey + nx * ny, 0, 1e-6, 'axes orthogonaux');

  const geo = geoFrame({ epsg: 4326 }, [2.35, 48.85, 35]);
  near(geo.matrix[0], 111_320 * Math.cos(48.85 * Math.PI / 180), 300, 'mètres par degré de longitude');
  near(geo.matrix[3], 111_200, 300, 'mètres par degré de latitude');
  assert.equal(geoFrame({}, [0, 0, 0]), null);
});
