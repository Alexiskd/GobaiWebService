// Tests des calculs de la caméra du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ALTITUDE_M, PITCH_MAX_DEG, PITCH_MIN_DEG, approachPitch, clampPitch, tiltEngagement, moveAngles, pitchForTilt, wrapHeading, zoomStep, globeCacheOptions, fadeProgress } from './astre-solide.camera-math.js';

test('zoom : facteur sur l\'altitude, jamais sous le plancher', () => {
  assert.equal(zoomStep(1000, 0.5), 500);
  assert.equal(zoomStep(1000, 2), -1000);
  assert.equal(zoomStep(15, 0.1), 15 - MIN_ALTITUDE_M);
});

test('tangage borné et vue 3/4', () => {
  assert.equal(clampPitch(-120), PITCH_MIN_DEG);
  assert.equal(clampPitch(0), PITCH_MAX_DEG);
  assert.equal(pitchForTilt(false, 1000), PITCH_MIN_DEG);
});

test('vue 3/4 automatique : verticale loin du sol, ≈ 60° près du sol, comme three.js', () => {
  assert.equal(pitchForTilt(true, 15000e3), PITCH_MIN_DEG);
  assert.equal(tiltEngagement(3000e3), 0);
  assert.equal(tiltEngagement(100e3), 1);
  assert.equal(pitchForTilt(true, 100e3), PITCH_MAX_DEG);
  const mid = pitchForTilt(true, 1000e3);
  assert.ok(mid > PITCH_MIN_DEG && mid < PITCH_MAX_DEG);
  assert.ok(Math.abs(approachPitch(-90, -30, 1e6) + 30) < 1e-9);
  assert.equal(approachPitch(-90, -30, 0), -90);
});

test('déplacement : plus fin près du sol, borné loin', () => {
  const near = moveAngles(1, 1, 1000), far = moveAngles(1, 0, 1e9);
  assert.ok(near.right < 1e-3 && near.right > 0);
  assert.equal(far.right, 1);
  assert.equal(far.forward, 0);
});

test('cap ramené entre 0 et 360', () => {
  assert.equal(wrapHeading(-10), 350);
  assert.equal(wrapHeading(370), 10);
});

// Importe la traduction ECEF → repère des tuiles de three.js.
import { EARTH_RADIUS_M, ecefToTilesLocal } from './astre-solide.camera-math.js';
// Importe la longitude et la latitude d'une direction du repère des tuiles.
import { lonLatOf } from './astre-solide.handoff.js';

test('fond transparent : ECEF de CesiumJS → repère des tuiles three.js, même longitude et latitude', () => {
  // Point au-dessus de Paris (2,35° E, 48,85° N), à 1 000 km d'altitude, en ECEF sphérique.
  const lon = (2.35 * Math.PI) / 180, lat = (48.85 * Math.PI) / 180, r = EARTH_RADIUS_M + 1e6;
  // Coordonnées ECEF.
  const p = { x: r * Math.cos(lat) * Math.cos(lon), y: r * Math.cos(lat) * Math.sin(lon), z: r * Math.sin(lat) };
  // Traduit.
  const local = ecefToTilesLocal(p);
  // Même lieu.
  const ll = lonLatOf(local);
  // Longitude et latitude retrouvées.
  assert.ok(Math.abs(ll.lon - 2.35) < 1e-9 && Math.abs(ll.lat - 48.85) < 1e-9);
  // Distance au centre en rayons terrestres.
  assert.ok(Math.abs(Math.hypot(...local) - r / EARTH_RADIUS_M) < 1e-12);
  // Une direction (échelle 1) garde sa longueur : le pôle Nord ECEF devient +Y.
  assert.deepEqual(ecefToTilesLocal({ x: 0, y: 0, z: 1 }, 1), [0, 1, -0]);
});

// Importe les gestes du globe.
import { KEY_ROTATE_SPEED, dragMove, keyMove, surfaceRotation } from './astre-solide.camera-math.js';
// Importe la conversion du glisser de three.js, pour comparer.
import { dragRadPerPx, dragStep } from '../../Engine/AstreSolideEngine/InputEngine/touchMath.jsx';

// rodrigues : tourne v de +a (sens direct) autour de l'axe unitaire k.
const rodrigues = (v, k, a) => {
  const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
};

test('gestes : glisser identique à la scène three.js (sol sous le doigt, vue 3/4)', () => {
  // 1 000 km d'altitude, ouverture 45°, écran de 900 px, regard vertical.
  const m = dragMove(30, -20, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -90 });
  // Même résultat que three.js.
  const ref = dragStep(30, -20, dragRadPerPx(1e6 / EARTH_RADIUS_M, 45, 900), 0);
  assert.ok(Math.abs(m.right - ref.right) < 1e-15 && Math.abs(m.forward - ref.forward) < 1e-15);
  // Doigt vers la droite : la caméra part à gauche.
  assert.ok(m.right < 0);
  // Vue inclinée de 60° : déplacement vertical agrandi.
  const tilted = dragMove(0, 10, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -30 });
  const flat = dragMove(0, 10, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -90 });
  assert.ok(tilted.forward > flat.forward * 1.9);
});

test('gestes : flèches maintenues, même vitesse que three.js, plus fines près du sol', () => {
  // Haut et droite pendant 100 ms, à 1 000 km.
  const m = keyMove({ up: true, right: true }, 100, 1e6);
  // Pas attendu.
  const step = 0.1 * KEY_ROTATE_SPEED * Math.min(1, (0.9 * 1e6) / EARTH_RADIUS_M);
  assert.ok(Math.abs(m.forward - step) < 1e-15 && Math.abs(m.right - step) < 1e-15);
  // Gauche et droite ensemble : rien horizontalement.
  assert.equal(keyMove({ left: true, right: true }, 50, 1e6).right, 0);
  // Retour d'onglet (dt énorme) : borné à 100 ms.
  assert.equal(keyMove({ up: true }, 5000, 1e6).forward, step);
});

test('gestes : rotation qui déplace la caméra vers le haut et la droite de l\'écran posés sur le sol', () => {
  // Caméra au-dessus de l'équateur, longitude 0, cap nord.
  const p = { x: 7e6, y: 0, z: 0 };
  // Vers le haut de l'écran (nord) de 0,1 rad.
  const up = surfaceRotation(p, 0, 0, 0.1);
  // CesiumJS tourne de −angle autour de l'axe : on applique +0,1 en sens direct.
  const moved = rodrigues([1, 0, 0], up.axis, -up.angle);
  // La caméra est montée vers le nord (z > 0) et n'a pas bougé en longitude.
  assert.ok(Math.abs(moved[2] - Math.sin(0.1)) < 1e-12 && Math.abs(moved[1]) < 1e-12);
  // Vers la droite de l'écran avec le cap nord : vers l'est (y > 0).
  const right = surfaceRotation(p, 0, 0.1, 0);
  assert.ok(rodrigues([1, 0, 0], right.axis, -right.angle)[1] > 0.09);
  // Cap est (90°) : le haut de l'écran est l'est.
  const east = surfaceRotation(p, Math.PI / 2, 0, 0.1);
  assert.ok(rodrigues([1, 0, 0], east.axis, -east.angle)[1] > 0.09);
  // Rien à faire : null.
  assert.equal(surfaceRotation(p, 0, 0, 0), null);
  // Au pôle exact : pas de NaN.
  const pole = surfaceRotation({ x: 0, y: 0, z: 7e6 }, 0, 0, 0.1);
  assert.ok(pole.axis.every(Number.isFinite));
});

// Importe la rotation automatique et l'ombre du globe.
import { AUTO_ROTATE_SPEED, autoRotateAngle, cesiumShade, SHADE_FADE_SPAN_M } from './astre-solide.camera-math.js';

test('rotation automatique : même vitesse que three.js, multiplicateur, ralentie près du sol', () => {
  // Une seconde (bornée à 100 ms), multiplicateur 2, au-dessus d'un rayon terrestre : vitesse pleine.
  assert.ok(Math.abs(autoRotateAngle(100, 2, 2 * EARTH_RADIUS_M) - AUTO_ROTATE_SPEED * 2 * 0.1) < 1e-15);
  // Retour d'onglet : borné à 100 ms.
  assert.equal(autoRotateAngle(5000, 1, 2 * EARTH_RADIUS_M), autoRotateAngle(100, 1, 2 * EARTH_RADIUS_M));
  // À un dixième de rayon d'altitude : dix fois plus lent.
  assert.ok(Math.abs(autoRotateAngle(100, 1, 0.1 * EARTH_RADIUS_M) - AUTO_ROTATE_SPEED * 0.01) < 1e-15);
});

test('ombre du globe : coupée à 0, face nuit à l\'obscurité de CesiumJS à 1, fondu entre les deux', () => {
  assert.equal(cesiumShade(0).enableLighting, false); assert.equal(cesiumShade(0).vertexShadowDarkness, 1);
  assert.equal(cesiumShade(1).enableLighting, true); assert.equal(cesiumShade(1).vertexShadowDarkness, 0.3);
  assert.ok(Math.abs(cesiumShade(0.5).vertexShadowDarkness - 0.65) < 1e-12 && cesiumShade(0.5).enableLighting);
  // Valeur illisible : ombre pleine.
  assert.equal(cesiumShade(undefined).enableLighting, true);
});

test('ombre du globe plat : le fondu de CesiumJS vu de la caméra vaut l\'intensité', () => {
  // Fondu calculé comme dans le shader du globe de CesiumJS (GlobeFS : clamp((d − début) / (fin − début), 0, 1)).
  const fade = (s, d) => Math.max(0, Math.min(1, (d - s.lightingFadeOutDistance) / (s.lightingFadeInDistance - s.lightingFadeOutDistance)));
  for (const d of [7e6, 4e7, 4e8]) for (const v of [0, 0.25, 0.5, 1]) assert.ok(Math.abs(fade(cesiumShade(v, d), d) - v) < 1e-9);
  // Caméra qui a bougé de 1 000 km depuis le réglage : écart négligeable.
  assert.ok(Math.abs(fade(cesiumShade(0.5, 4e7), 4.1e7) - 0.5) < 1e-3);
  assert.ok(SHADE_FADE_SPAN_M > 1e9);
});

// Importe la vue de three.js traduite pour le globe.
import { threeViewToCesium, tilesLocalToEcef } from './astre-solide.camera-math.js';

test('Terre toujours en CesiumJS : vue three.js traduite pour la caméra du globe', () => {
  // Aller-retour ECEF → tuiles → ECEF.
  const p = { x: 1.2e6, y: -3.4e6, z: 5.6e6 };
  const back = tilesLocalToEcef(ecefToTilesLocal(p));
  assert.ok(Math.abs(back.x - p.x) < 1e-6 && Math.abs(back.y - p.y) < 1e-6 && Math.abs(back.z - p.z) < 1e-6);
  // Caméra à 10 rayons sur +X, regard vers la Terre, haut = pôle (+Y du repère des tuiles).
  const v = threeViewToCesium({ pos: [10, 0, 0], dir: [-1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 2 });
  // La Terre est à l'écran.
  assert.equal(v.inView, true);
  // Haut = pôle Nord ECEF, regard vers −X.
  assert.deepEqual([v.up.x, v.up.y, v.up.z], [0, -0, 1]);
  assert.equal(v.direction.x, -1);
  // Ouverture horizontale sur un écran deux fois plus large que haut.
  assert.ok(Math.abs(v.fov - 2 * Math.atan(Math.tan(Math.PI / 8) * 2)) < 1e-12);
  // Plans qui encadrent la Terre.
  assert.ok(v.near < 9 * EARTH_RADIUS_M && v.far > 11 * EARTH_RADIUS_M);
  // Regard à l'opposé de la Terre : hors de l'écran.
  assert.equal(threeViewToCesium({ pos: [10, 0, 0], dir: [1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 2 }).inView, false);
  // Près du sol : plan proche d'au moins 1 m.
  assert.equal(threeViewToCesium({ pos: [1.00001, 0, 0], dir: [-1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 1 }).near, 1);
  // Terre minuscule (vue de très loin, moins d'un pixel) : three.js la dessine.
  assert.equal(threeViewToCesium({ pos: [1e6, 0, 0], dir: [-1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 1, viewportH: 900 }).inView, false);
  // À 10 rayons sur un écran de 900 px : bien visible.
  assert.equal(threeViewToCesium({ pos: [10, 0, 0], dir: [-1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 1, viewportH: 900 }).inView, true);
});

// Importe le zoom calé sur three.js.
import { ZOOM_TAU_MS, easeAltitude, zoomGoal } from './astre-solide.camera-math.js';

test('zoom calé sur three.js : altitude visée multipliée, rapprochement lissé à 96 ms', () => {
  // Deux crans de 0,65 à 1 000 km : 422,5 km visés (les crans s'additionnent sur la visée).
  assert.ok(Math.abs(zoomGoal(zoomGoal(1e6, 0.65), 0.65) - 422500) < 1e-6);
  // Jamais sous l'altitude minimale de l'astre.
  assert.equal(zoomGoal(1000, 0.1, 500), 500);
  // Une image de 16 ms : même part du chemin que three.js.
  const k = 1 - Math.exp(-16 / ZOOM_TAU_MS);
  assert.ok(Math.abs(easeAltitude(1e6, 5e5, 16) - 1e6 * Math.pow(0.5, k)) < 1e-6);
  // Au bout d'une seconde, arrivé (à 0,1 % près).
  let alt = 1e6; for (let t = 0; t < 1000; t += 16) alt = easeAltitude(alt, 5e5, 16);
  assert.ok(Math.abs(alt - 5e5) / 5e5 < 1e-3);
});

// Importe les calculs du double-clic.
import { DBLCLICK_IN, DBLCLICK_OUT, panGoal, panStep } from './astre-solide.camera-math.js';

test('double-clic : facteurs, point cliqué amené au centre, plus court chemin', () => {
  assert.ok(DBLCLICK_IN < 1 && DBLCLICK_OUT > 1);
  const g = panGoal({ lon: 0, lat: 0.1 }, { lon: 0.01, lat: 0.2 }, { lon: 0.03, lat: 0.25 });
  assert.ok(Math.abs(g.lon - 0.02) < 1e-12); assert.ok(Math.abs(g.lat - 0.15) < 1e-12);
  // À travers l'antiméridien : petit écart, pas un tour complet.
  const a = panGoal({ lon: 3.1, lat: 0 }, { lon: 3.1, lat: 0 }, { lon: -3.1, lat: 0 });
  assert.ok(Math.abs(Math.atan2(Math.sin(a.lon - 3.1), Math.cos(a.lon - 3.1)) - (2 * Math.PI - 6.2)) < 1e-9);
  assert.equal(panGoal({ lon: 0, lat: 1.5 }, { lon: 0, lat: 0 }, { lon: 0, lat: 0.5 }).lat, Math.PI / 2);
});

test('double-clic : la caméra avance vers la visée au rythme du zoom', () => {
  const p = panStep({ lon: 0, lat: 0 }, { lon: 0.1, lat: -0.1 }, 96);
  assert.ok(Math.abs(p.lon - 0.1 * (1 - Math.exp(-1))) < 1e-12);
  assert.ok(Math.abs(p.lat + 0.1 * (1 - Math.exp(-1))) < 1e-12);
  assert.deepEqual(panStep({ lon: 0, lat: 0 }, { lon: 0.1, lat: 0.1 }, 0), { lon: 0, lat: 0 });
  // À travers l'antiméridien : la caméra passe par ±π, pas par 0.
  const w = panStep({ lon: 3.1, lat: 0 }, { lon: -3.1, lat: 0 }, 96);
  assert.ok(Math.abs(w.lon) > 3.1);
});

// Importe le test du ciel visible.
import { skyVisible } from './astre-solide.camera-math.js';

test('ciel visible : vue vers le sol de près, non ; vers l\'horizon ou de loin, oui', () => {
  const R = 6371000, fovy = Math.PI / 3;
  // À 2 km, regard vertical vers le sol : le sol remplit l'image.
  const pos = { x: R + 2000, y: 0, z: 0 };
  assert.equal(skyVisible({ position: pos, direction: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 }, fovy, aspect: 16 / 9, radiusM: R }), false);
  // Regard horizontal : le ciel est visible.
  assert.equal(skyVisible({ position: pos, direction: { x: 0, y: 1, z: 0 }, up: { x: 1, y: 0, z: 0 }, fovy, aspect: 16 / 9, radiusM: R }), true);
  // À 20 000 km, regard vers le centre : le globe ne remplit pas l'image.
  assert.equal(skyVisible({ position: { x: R + 2e7, y: 0, z: 0 }, direction: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 }, fovy, aspect: 1, radiusM: R }), true);
  // Vue 3/4 à 60° du vertical, à 2 km : l'horizon est dans l'image.
  const a = Math.PI / 3;
  assert.equal(skyVisible({ position: pos, direction: { x: -Math.cos(a), y: Math.sin(a), z: 0 }, up: { x: Math.sin(a), y: Math.cos(a), z: 0 }, fovy, aspect: 1, radiusM: R }), true);
  // Valeurs illisibles : ciel dessiné par prudence.
  assert.equal(skyVisible({ position: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 0, z: 1 }, fovy, radiusM: R }), true);
});

// Importe la finesse des tuiles du globe.
import { globeScreenError } from './astre-solide.camera-math.js';

test('finesse des tuiles : plus grossière en mouvement et sur écran tactile', () => {
  assert.equal(globeScreenError(), 2);
  assert.equal(globeScreenError({ touch: true }), 3);
  assert.equal(globeScreenError({ moving: true }), 4);
  assert.equal(globeScreenError({ moving: true, touch: true }), 5);
});

test('globe : mémoire des tuiles et voisines préchargées sur ordinateur, allégées sur téléphone', () => {
  assert.deepEqual(globeCacheOptions(), { tileCacheSize: 400, preloadSiblings: true, preloadAncestors: true });
  assert.deepEqual(globeCacheOptions({ touch: true }), { tileCacheSize: 150, preloadSiblings: false, preloadAncestors: true });
});

test('fondu d\'apparition du globe : 0 avant les tuiles, courbe en S, 1 de près', () => {
  assert.equal(fadeProgress(null, 1000, 400), 0);
  assert.equal(fadeProgress(-Infinity, 1000, 400), 1);
  assert.equal(fadeProgress(1000, 1000, 400), 0);
  assert.equal(fadeProgress(1000, 1200, 400), 0.5);
  assert.equal(fadeProgress(1000, 1400, 400), 1);
  assert.ok(fadeProgress(1000, 1100, 400) < 0.25);
});
