// Tests des coordonnées GPS à l'écran : node --test src/engine/gps.test.jsx (ou npm test)
// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis gps.jsx (début de la liste).
import {
  // Le rayon de la Terre et les huit fonctions testées.
  EARTH_RADIUS_M, altitudeForView, formatLatLon, gpsDecimals, insetCorners, niceScale, parseLatLon, raySphere, screenGeo,
// Fin de la liste : le module gps.jsx.
} from './gps.jsx';

// near : vérifie que deux nombres sont égaux à une tolérance près, avec un message qui donne les valeurs.
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} ≠ ${b} (± ${tol})`);
// RAD : nombre de radians dans un degré.
const RAD = Math.PI / 180;
// unitAt : vecteur unitaire d'un point de la sphère à partir de sa longitude et de sa latitude.
const unitAt = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)];
// Matrice identité 4 × 4.
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Caméra à la verticale d'un point, regard vers le centre ; « haut » de l'écran = nord local.
// nadirView : vue à la verticale d'un point, à une altitude en mètres ; écran 16/9 par défaut (début).
function nadirView(lon, lat, altitudeM, aspect = 16 / 9) {
  // Direction du point : la verticale locale.
  const up = unitAt(lon, lat);
  // Distance de la caméra au centre, en rayons terrestres.
  const r = 1 + altitudeM / EARTH_RADIUS_M;
  // Direction du nord au point.
  const north = [-Math.sin(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD), Math.sin(lat * RAD) * Math.sin(lon * RAD)];
  // Direction de l'est au point.
  const east = [-Math.sin(lon * RAD), 0, -Math.cos(lon * RAD)];
  // Renvoie la vue (début).
  return {
    // Position de la caméra, direction du regard (vers le centre), haut (le nord) et droite (l'est).
    origin: up.map((v) => v * r), forward: up.map((v) => -v), up: north, right: east,
    // Tangente du demi-angle de champ vertical (22,5°), proportions, centre et rayon de la sphère, repère local et largeur de 1600 pixels.
    tanY: Math.tan(22.5 * RAD), aspect, center: [0, 0, 0], radius: 1, toLocal: IDENTITY, widthPx: 1600,
  // Fin de la vue.
  };
// Fin de nadirView.
}

// Test : l'intersection d'un rayon et d'une sphère.
test('rayon / sphère : précis à quelques mètres du sol', () => {
  // Hauteur de 5 m, en rayons terrestres.
  const h = 5 / EARTH_RADIUS_M;
  // Rayon lancé vers le bas depuis cette hauteur.
  const t = raySphere([0, 1 + h, 0], [0, -1, 0], [0, 0, 0], 1);
  // La distance trouvée vaut 5 m, à un micromètre près.
  near(t * EARTH_RADIUS_M, 5, 1e-6, 'distance au sol (m)');
  // Rayon qui s'éloigne de la sphère : null.
  assert.equal(raySphere([0, 2, 0], [0, 1, 0], [0, 0, 0], 1), null, 'sphère derrière la caméra');
  // Rayon qui passe à côté : null.
  assert.equal(raySphere([0, 2, 0], [1, 0, 0], [0, 0, 0], 1), null, 'rayon qui passe à côté');
// Fin du test.
});

// Test : les coins de l'écran au-dessus de la tour Eiffel.
test('coins de l’écran à 10 m d’échelle au-dessus de la tour Eiffel', () => {
  // Latitude et longitude de la tour.
  const lat = 48.85837, lon = 2.294481;
  // Altitude qui donne 10 m de haut à l'écran.
  const alt = altitudeForView(10);                 // hauteur de l'écran = 10 m
  // Elle vaut 12,07 m, à 1 cm près.
  near(alt, 12.07, 0.01, 'altitude du survol');
  // Géographie de l'écran pour la vue verticale à cette altitude.
  const g = screenGeo(nadirView(lon, lat, alt));
  // Latitude du centre : celle de la tour.
  near(g.center.lat, lat, 1e-9, 'latitude du centre');
  // Longitude du centre : celle de la tour.
  near(g.center.lon, lon, 1e-9, 'longitude du centre');
  // Altitude retrouvée.
  near(g.altitudeM, alt, 1e-6, 'altitude');
  // Les quatre coins : nord-ouest, nord-est, sud-ouest et sud-est.
  const [nw, ne, sw, se] = g.corners;
  // Demi-hauteur 5 m vers le nord, demi-largeur 5 × 16/9 m vers l'est.
  // Écarts attendus en degrés : 5 m en latitude, 5 × 16/9 m en longitude.
  const dLat = 5 / EARTH_RADIUS_M / RAD, dLon = (5 * 16 / 9) / (EARTH_RADIUS_M * Math.cos(lat * RAD)) / RAD;
  // Coin nord-ouest : plus au nord et plus à l'ouest que le centre.
  near(nw.lat - lat, dLat, 1e-8, 'haut gauche : nord'); near(nw.lon - lon, -dLon, 1e-8, 'haut gauche : ouest');
  // Coin sud-est : plus au sud et plus à l'est.
  near(se.lat - lat, -dLat, 1e-8, 'bas droite : sud'); near(se.lon - lon, dLon, 1e-8, 'bas droite : est');
  // Les deux coins du haut ont la même latitude ; les deux coins de gauche la même longitude.
  near(ne.lat, nw.lat, 1e-9, 'haut : même latitude'); near(sw.lon, nw.lon, 1e-9, 'gauche : même longitude');
  // Échelle : 10 m sur 900 px de haut ≈ 1,1 cm/px ; ici largeur 1600 px pour 17,8 m.
  // Mètres par pixel : 17,8 m sur 1600 pixels.
  near(g.metersPerPixel, (10 * 16 / 9) / 1600, 2e-4, 'mètres par pixel');
  // Sept décimales à cette échelle.
  assert.equal(gpsDecimals(g.metersPerPixel), 7, 'décimales au centimètre');
  // Barre d'échelle : « 1 m ».
  assert.deepEqual(niceScale(g.metersPerPixel).label, '1 m');
// Fin du test.
});

// Test : la vue du globe entier.
test('vue du globe entier : coins dans l’espace', () => {
  // Géographie de l'écran à trois rayons terrestres d'altitude.
  const g = screenGeo(nadirView(0, 0, 3 * EARTH_RADIUS_M));
  // Aucun coin ne touche la Terre.
  assert.ok(g.corners.every((c) => c.lat === null), 'aucun coin sur la Terre');
  // Le centre est sur la Terre.
  assert.ok(g.center, 'centre sur la Terre');
  // Une seule décimale à cette échelle.
  assert.equal(gpsDecimals(g.metersPerPixel), 1); // ≈ 18 km par pixel
// Fin du test.
});

// Test : le nombre de décimales et la barre d'échelle.
test('précision et barre d’échelle', () => {
  // 1 cm par pixel : 7 décimales.
  assert.equal(gpsDecimals(0.01), 7);
  // 1 m par pixel : 6 décimales.
  assert.equal(gpsDecimals(1), 6);
  // 100 m par pixel : 4 décimales.
  assert.equal(gpsDecimals(100), 4);
  // 10 km par pixel : 2 décimales.
  assert.equal(gpsDecimals(10_000), 2);
  // Barre d'échelle à 8 cm par pixel.
  const s = niceScale(0.08); // 8 cm/px
  // Elle indique « 10 m » et mesure 125 pixels.
  assert.equal(s.label, '10 m'); near(s.px, 125, 1e-9, 'longueur de la barre');
  // À 500 m par pixel : « 50 km ».
  assert.equal(niceScale(500).label, '50 km');
  // Mise en forme d'une position avec cinq décimales : nord et ouest.
  assert.equal(formatLatLon(48.858372, -2.29448, 5), '48.85837° N, 2.29448° O');
// Fin du test.
});

// Test : la lecture de coordonnées saisies.
test('saisie de coordonnées', () => {
  // Saisies d'essai et coordonnées attendues (début).
  const cases = {
    // Décimales avec un point, séparées par une virgule.
    '48.8584, 2.2945': [48.8584, 2.2945],
    // Décimales avec une virgule, séparées par un point-virgule.
    '48,8584 ; 2,2945': [48.8584, 2.2945],
    // Séparées par une virgule sans espace.
    '48.8584,2.2945': [48.8584, 2.2945],
    // Séparées par un espace.
    '48.8584 2.2945': [48.8584, 2.2945],
    // Latitude négative.
    '-33.8568 151.2153': [-33.8568, 151.2153],
    // Lettres N et E.
    '48.8584 N 2.2945 E': [48.8584, 2.2945],
    // Lettre O pour l'ouest.
    '40.6892 N, 74.0445 O': [40.6892, -74.0445],
    // Longitude d'abord, avec la lettre W.
    '74.0445 W 40.6892 N': [40.6892, -74.0445],
    // Degrés, minutes et secondes.
    '48°51\'30"N 2°17\'40"E': [48 + 51 / 60 + 30 / 3600, 2 + 17 / 60 + 40 / 3600],
    // Degrés et minutes, sud et ouest.
    '22°54′S 43°10′O': [-(22 + 54 / 60), -(43 + 10 / 60)],
  // Fin des saisies d'essai.
  };
  // Pour chaque saisie (début).
  for (const [text, [lat, lon]] of Object.entries(cases)) {
    // Lecture de la saisie.
    const r = parseLatLon(text);
    // Elle est comprise.
    assert.ok(r, `lu : ${text}`);
    // Latitude et longitude lues : celles attendues, à 1e-9 près.
    near(r.lat, lat, 1e-9, `${text} lat`); near(r.lon, lon, 1e-9, `${text} lon`);
  // Fin de la boucle.
  }
  // Six saisies invalides : toutes refusées.
  for (const bad of ['Paris', '48.85', '95, 10', '10, 200', '', '1 2 3']) assert.equal(parseLatLon(bad), null, `refusé : ${bad}`);
// Fin du test.
});

// Test : les coins d'une zone réduite.
test('zone réduite : coins juste au-dessus de la barre d’outils', () => {
  // Coins pour une marge basse de 120 pixels, sur un écran de 400 × 800.
  const pts = insetCorners({ bottom: 120 }, 400, 800);
  // Le coin sud-ouest et le coin nord-ouest.
  const sw = pts.find((p) => p.id === 'sw'), nw = pts.find((p) => p.id === 'nw');
  // Le bas est relevé de 240 / 800, le haut reste à 1 et la gauche à −1.
  near(sw.y, -1 + 240 / 800, 1e-12, 'bas relevé'); assert.equal(nw.y, 1); assert.equal(sw.x, -1);
// Fin du test.
});
