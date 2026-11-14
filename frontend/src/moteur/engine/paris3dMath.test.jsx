// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées de Paris en 3D.
import { GRID, PARIS_BOUNDS, buildingHeight, extrudeBuildings, loadRadius, needsSwap, projectRing, ringArea, tileBounds, tileFrame, tileIndexAt, tilesAround, wfsUrl } from './paris3dMath';
// Importe le rayon de la Terre en mètres.
import { EARTH_RADIUS_M } from './gps';

/** Triangulation en éventail, suffisante pour les contours convexes des tests (sans trous). */
// fan : triangles (0, i, i+1) d'un contour.
const fan = (shape) => shape.slice(2).map((_, i) => [0, i + 1, i + 2]);
/** Carré de `side` mètres autour du centre (lon0, lat0), en degrés, dans le sens voulu. */
// square : contour fermé d'un carré, en degrés.
function square(lon0, lat0, side, clockwise = false) {
  // Demi-côté en degrés de latitude et de longitude.
  const dLat = side / 2 / 111195, dLon = dLat / Math.cos(lat0 * (Math.PI / 180));
  // Quatre coins dans le sens inverse des aiguilles d'une montre, puis fermeture.
  const ring = [[lon0 - dLon, lat0 - dLat], [lon0 + dLon, lat0 - dLat], [lon0 + dLon, lat0 + dLat], [lon0 - dLon, lat0 + dLat]];
  // Sens des aiguilles d'une montre si demandé.
  if (clockwise) ring.reverse();
  // Ferme le contour.
  return [...ring, ring[0]];
}

// Test : la grille des carreaux.
test('carreaux : indices, emprise et grille de Paris', () => {
  // Le coin sud-ouest est dans le carreau 0, 0.
  assert.deepEqual(tileIndexAt(PARIS_BOUNDS.west + 1e-6, PARIS_BOUNDS.south + 1e-6), { ix: 0, iy: 0 });
  // L'emprise d'un carreau contient son centre, et le carreau du centre est bien lui.
  const b = tileBounds(10, 7);
  // Même carreau.
  assert.deepEqual(tileIndexAt(b.lon, b.lat), { ix: 10, iy: 7 });
  // La grille couvre toute la ville.
  assert.ok(tileBounds(GRID.cols - 1, GRID.rows - 1).east >= PARIS_BOUNDS.east - 1e-9);
  // Et pas plus d'un carreau au-delà.
  assert.ok(tileBounds(GRID.cols - 1, GRID.rows - 1).west < PARIS_BOUNDS.east);
});

// Test : les carreaux autour d'un point.
test('carreaux voisins : triés par distance, bornés à Paris, aucun loin de Paris', () => {
  // Autour de Notre-Dame, sur 800 m.
  const list = tilesAround(2.3499, 48.853, 800);
  // Il y en a plusieurs.
  assert.ok(list.length >= 9);
  // Le premier contient le point (distance nulle).
  assert.equal(list[0].d, 0);
  // Triés par distance.
  for (let i = 1; i < list.length; i++) assert.ok(list[i].d >= list[i - 1].d);
  // Tous dans le rayon et dans la grille.
  for (const t of list) { assert.ok(t.d <= 800); assert.ok(t.ix >= 0 && t.ix < GRID.cols && t.iy >= 0 && t.iy < GRID.rows); }
  // À Lyon, rien.
  assert.equal(tilesAround(4.835, 45.764, 3000).length, 0);
  // Le rayon de chargement est borné.
  assert.equal(loadRadius(10), 600); assert.equal(loadRadius(1e6), 3000);
});

// Test : l'adresse WFS.
test('adresse WFS : couche BD TOPO, GeoJSON, emprise latitude d’abord', () => {
  // Adresse d'un carreau.
  const u = new URL(wfsUrl({ west: 2.3, south: 48.85, east: 2.306, north: 48.854 }));
  // Service de la Géoplateforme.
  assert.equal(u.host, 'data.geopf.fr');
  // Couche des bâtiments.
  assert.equal(u.searchParams.get('TYPENAMES'), 'BDTOPO_V3:batiment');
  // GeoJSON.
  assert.equal(u.searchParams.get('OUTPUTFORMAT'), 'application/json');
  // Emprise : latitude d'abord, système nommé en entier.
  assert.equal(u.searchParams.get('BBOX'), '48.85,2.3,48.854,2.306,urn:ogc:def:crs:EPSG::4326');
});

// Test : la hauteur des bâtiments.
test('hauteur : mesurée, sinon étages, sinon toit − sol, sinon 6 m, bornée', () => {
  // Hauteur mesurée.
  assert.equal(buildingHeight({ hauteur: 21.4 }), 21.4);
  // Étages : 3 m par étage.
  assert.equal(buildingHeight({ hauteur: null, nombre_d_etages: 5 }), 15);
  // Toit moins sol.
  assert.equal(buildingHeight({ altitude_maximale_toit: 60, altitude_minimale_sol: 35 }), 25);
  // Rien : 6 m.
  assert.equal(buildingHeight({}), 6);
  // Bornes.
  assert.equal(buildingHeight({ hauteur: 0.5 }), 2); assert.equal(buildingHeight({ hauteur: 900 }), 330);
});

// Test : le repère d'un carreau.
test('repère : axes orthogonaux, d’un mètre, verticale vers le haut', () => {
  // Repère au centre de Paris, à 35 m.
  const f = tileFrame(2.35, 48.85, 35);
  // Produit scalaire et longueur.
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a);
  // Chaque axe mesure un mètre (en rayons terrestres), à 1e-6 près.
  for (const a of [f.ex, f.ey, f.ez]) assert.ok(Math.abs(len(a) * EARTH_RADIUS_M - 1) < 1e-4);
  // Axes orthogonaux.
  assert.ok(Math.abs(dot(f.ex, f.ey)) / dot(f.ex, f.ex) < 1e-6); assert.ok(Math.abs(dot(f.ex, f.ez)) / dot(f.ex, f.ex) < 1e-6);
  // La verticale est dans le sens de l'origine (vers l'extérieur).
  assert.ok(dot(f.ez, f.origin) > 0);
  // Origine à 35 m au-dessus de la sphère.
  assert.ok(Math.abs((len(f.origin) - 1) * EARTH_RADIUS_M - 35) < 1e-3);
  // Repère direct : est × nord = haut.
  const c = [f.ex[1] * f.ey[2] - f.ex[2] * f.ey[1], f.ex[2] * f.ey[0] - f.ex[0] * f.ey[2], f.ex[0] * f.ey[1] - f.ex[1] * f.ey[0]];
  // Même sens que la verticale.
  assert.ok(dot(c, f.ez) > 0);
});

// Test : les contours et l'ordre des axes.
test('contours : projection en mètres, fermeture retirée, axes inversés détectés', () => {
  // Carré de 20 m.
  const ring = projectRing(square(2.35, 48.85, 20), 2.35, 48.85);
  // Quatre points, sans la fermeture.
  assert.equal(ring.length, 4);
  // Aire de 400 m², dans le sens inverse des aiguilles d'une montre.
  assert.ok(Math.abs(ringArea(ring) - 400) < 0.5);
  // Lu dans l'ordre (longitude, latitude) : pas d'inversion.
  assert.equal(needsSwap([{ geometry: { type: 'Polygon', coordinates: [square(2.35, 48.85, 20)] } }], 2.35, 48.85), false);
  // Rendu (latitude, longitude) : inversion détectée.
  const swapped = square(2.35, 48.85, 20).map(([x, y]) => [y, x]);
  // Inversé.
  assert.equal(needsSwap([{ geometry: { type: 'Polygon', coordinates: [swapped] } }], 2.35, 48.85), true);
});

// Test : l'extrusion.
test('extrusion : murs tournés vers l’extérieur, toit vers le haut, à la bonne hauteur', () => {
  // Deux bâtiments : un carré dans le sens des aiguilles d'une montre (à réorienter), un autre en MultiPolygon.
  const features = [
    // Premier bâtiment : 12 m, sol à 40 m.
    { id: 'a', properties: { hauteur: 12, altitude_minimale_sol: 40 }, geometry: { type: 'Polygon', coordinates: [square(2.35, 48.85, 20, true)] } },
    // Second : 4 étages, sol à 30 m.
    { id: 'b', properties: { nombre_d_etages: 4, altitude_minimale_sol: 30 }, geometry: { type: 'MultiPolygon', coordinates: [[square(2.3506, 48.85, 10)]] } },
  ];
  // Extrusion autour de leur centre.
  const m = extrudeBuildings(features, 2.35, 48.85, fan);
  // Deux bâtiments.
  assert.equal(m.buildings, 2);
  // Sommets : 4 murs × 6 + 2 triangles × 3, par bâtiment.
  assert.equal(m.count, 2 * (4 * 6 + 2 * 3));
  // Sol du carreau : médiane des sols (le second des deux, triés).
  assert.equal(m.groundM, 40);
  // Pour chaque sommet du premier bâtiment (début).
  for (let v = 0; v < 30; v++) {
    // Position et normale.
    const x = m.positions[v * 3], y = m.positions[v * 3 + 1], z = m.positions[v * 3 + 2];
    // Normale.
    const nx = m.normals[v * 3], ny = m.normals[v * 3 + 1], nz = m.normals[v * 3 + 2];
    // Hauteur : au sol ou au toit.
    assert.ok(Math.abs(z) < 1e-6 || Math.abs(z - 12) < 1e-6);
    // Mur : la normale pointe vers l'extérieur (même sens que la position, le carré étant centré).
    if (nz === 0) assert.ok(nx * x + ny * y > 0);
    // Toit : la normale est verticale et le sommet en haut.
    else { assert.equal(nz, 1); assert.ok(Math.abs(z - 12) < 1e-6); }
  // Fin des sommets.
  }
  // Second bâtiment : 12 m de haut (4 étages) et 10 m plus bas que le sol du carreau.
  assert.ok(Math.abs(Math.max(...m.positions.filter((_, i) => i % 3 === 2 && i / 3 >= 30)) - 12) < 1e-6);
  // Son soulèvement en relief.
  assert.equal(m.lifts[30], -10);
  // Les triangles du toit tournent dans le sens inverse des aiguilles d'une montre, vus d'en haut.
  const a = 24 * 3, ax = m.positions[a], ay = m.positions[a + 1], bx = m.positions[a + 3], by = m.positions[a + 4], cx = m.positions[a + 6], cy = m.positions[a + 7];
  // Produit en croix positif.
  assert.ok((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0);
  // Sans bâtiment : rien.
  assert.equal(extrudeBuildings([], 2.35, 48.85, fan).count, 0);
});
