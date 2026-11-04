import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADING_RESPONSE_MS, TILT_FULL_RATIO, TILT_MAX_ANGLE, TILT_RESPONSE_MS, TILT_START_RATIO,
  approachAngle, approachTilt, tiltEngagement, tiltPose,
} from './cameraTilt.js';

const vec = () => ({
  x: 0, y: 0, z: 0,
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
  length() { return Math.hypot(this.x, this.y, this.z); },
  normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); },
});
const normal = (el, az) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];

test('inclinaison automatique : nulle en altitude, complète près du sol, sans saut', () => {
  assert.equal(tiltEngagement(2), 0);
  assert.ok(tiltEngagement(TILT_START_RATIO) < 1e-12);
  assert.ok(1 - tiltEngagement(TILT_FULL_RATIO) < 1e-12);
  assert.equal(tiltEngagement(1), 1);

  let prev = 0;
  for (let ratio = TILT_START_RATIO; ratio >= 1; ratio -= 0.002) {
    const e = tiltEngagement(ratio);
    assert.ok(e >= prev - 1e-12);
    assert.ok(e - prev < 0.03);
    prev = e;
  }
});

test('lissage temporel : même réponse à toute cadence, convergence douce', () => {
  assert.equal(approachTilt(0, 1, 0), 0);
  assert.ok(Math.abs(approachTilt(0, 1, TILT_RESPONSE_MS) - (1 - Math.exp(-1))) < 1e-12);

  let at60 = 0, at30 = 0;
  for (let i = 0; i < 120; i++) at60 = approachTilt(at60, 1, 1000 / 60);
  for (let i = 0; i < 60; i++) at30 = approachTilt(at30, 1, 1000 / 30);
  assert.ok(Math.abs(at60 - at30) < 1e-3);
  assert.ok(at60 > 0.94);
});

test('pose 3/4 : distance de zoom exacte, lieu visé centré, angle demandé', () => {
  const radius = 1, dist = 1.05, el = 0.4, az = 2.1;
  const pos = vec(), aim = vec(), up = vec();
  tiltPose({ radius, dist, el, az, angle: TILT_MAX_ANGLE, pos, aim, up });
  assert.ok(Math.abs(up.length() - 1) < 1e-12);

  assert.ok(Math.abs(pos.length() - dist) < 1e-12);
  const n = normal(el, az);
  for (const [got, want] of [[aim.x, n[0]], [aim.y, n[1]], [aim.z, n[2]]]) {
    assert.ok(Math.abs(got / radius - want) < 1e-12);
  }
  const sight = [pos.x - aim.x, pos.y - aim.y, pos.z - aim.z];
  const len = Math.hypot(...sight);
  const cos = (sight[0] * n[0] + sight[1] * n[1] + sight[2] * n[2]) / len;
  assert.ok(Math.abs(Math.acos(cos) - TILT_MAX_ANGLE) < 1e-12);
});

test('pose 3/4 : verticale et pôles sans singularité', () => {
  for (const el of [0, Math.PI / 2, -Math.PI / 2]) {
    const pos = vec(), aim = vec(), up = vec();
    tiltPose({ radius: 2.5, dist: 2.6, el, az: 0.7, angle: TILT_MAX_ANGLE, pos, aim, up });
    assert.ok([pos.x, pos.y, pos.z, aim.x, aim.y, aim.z, up.x, up.y, up.z].every(Number.isFinite));
    assert.ok(Math.abs(pos.length() - 2.6) < 1e-12);
    assert.ok(Math.abs(aim.length() - 2.5) < 1e-12);
  }

  const pos = vec(), aim = vec(), up = vec();
  tiltPose({ radius: 1, dist: 1.2, el: 0.3, az: 5, angle: 0, pos, aim, up });
  const n = normal(0.3, 5);
  for (const [got, want] of [[pos.x, n[0] * 1.2], [pos.y, n[1] * 1.2], [pos.z, n[2] * 1.2]]) {
    assert.ok(Math.abs(got - want) < 1e-12);
  }
  // À plat : le haut de l'image est la tangente nord (même orientation à l'écran que l'axe monde Y).
  assert.ok(Math.abs(up.x * n[0] + up.y * n[1] + up.z * n[2]) < 1e-12);
  assert.ok(up.y > 0);
});

test('dézoom en 3/4 : la caméra ne se retourne jamais (haut ⟂ visée, nord en haut, variation continue)', () => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const el of [-1.5, -0.7, 0, 0.45, 1.2, 1.5]) {
    for (const az of [0, 1.3, 3.9]) {
      const ce = Math.cos(el), se = Math.sin(el);
      const north = [-se * Math.sin(az), ce, -se * Math.cos(az)];
      let prev = null;
      // Inclinaison de 60° vers 0° (comme au dézoom), distance croissante.
      for (let k = 0; k <= 200; k++) {
        const angle = TILT_MAX_ANGLE * (1 - k / 200);
        const dist = 1.02 + k * 0.002;
        const pos = vec(), aim = vec(), up = vec();
        tiltPose({ radius: 1, dist, el, az, angle, pos, aim, up });
        const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
        const sl = Math.hypot(...sight);
        const u = [up.x, up.y, up.z];
        assert.ok(Math.abs(Math.hypot(...u) - 1) < 1e-12);
        assert.ok(Math.abs(dot(u, sight) / sl) < 1e-12);          // jamais aligné avec la visée
        assert.ok(dot(u, north) > 0.49);                          // le nord reste en haut de l'image
        assert.ok(Math.abs(pos.length() - dist) < 1e-12);         // distance de zoom inchangée
        if (prev) assert.ok(dot(u, prev) > 0.999);                // aucun saut d'orientation
        prev = u;
      }
    }
  }
});

test('haut de l’image : nord à plat, sol sous l’horizon à toutes les latitudes', () => {
  for (const el of [-1.5, -0.9, -0.25, 0, 0.25, 0.9, 1.5]) {
    const pos = vec(), aim = vec(), up = vec();
    tiltPose({ radius: 1, dist: 1.07, el, az: 0.4, angle: TILT_MAX_ANGLE, pos, aim, up });
    const n = normal(el, 0.4);
    assert.ok(Math.abs(up.length() - 1) < 1e-12);
    // Le haut de l'écran doit rester du côté du ciel local, sinon l'horizon s'affiche à l'envers.
    assert.ok(up.x * n[0] + up.y * n[1] + up.z * n[2] > 0.3);
  }
});

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const tangentN = (el, az) => [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)];
const tangentE = (az) => [Math.cos(az), 0, -Math.sin(az)];

test('cap de la boussole : lissage par le plus court chemin, sans tour complet', () => {
  assert.equal(approachAngle(0, 0, 10), 0);
  // 3,0 → −3,0 : le plus court chemin passe par ±π (+0,283 rad), pas par 0.
  assert.ok(approachAngle(3, -3, HEADING_RESPONSE_MS) > 3);
  let h = 3;
  for (let i = 0; i < 300; i++) h = approachAngle(h, -3, 1000 / 60);
  assert.ok(Math.abs(Math.atan2(Math.sin(h + 3), Math.cos(h + 3))) < 1e-3);

  // Même réponse à 60 et 30 images/s.
  let at60 = 0.4, at30 = 0.4;
  for (let i = 0; i < 120; i++) at60 = approachAngle(at60, -2.5, 1000 / 60);
  for (let i = 0; i < 60; i++) at30 = approachAngle(at30, -2.5, 1000 / 30);
  assert.ok(Math.abs(at60 - at30) < 1e-3);
});

test('cap : nord en haut au cap 0, est en haut au cap 90°, pose invariante', () => {
  for (const el of [-1.2, 0, 0.9]) {
    const n = normal(el, 1.7), t = tangentN(el, 1.7), e = tangentE(1.7);
    for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const pos = vec(), aim = vec(), up = vec();
      tiltPose({ radius: 1, dist: 1.06, el, az: 1.7, angle: TILT_MAX_ANGLE, heading, pos, aim, up });
      const th = [0, 1, 2].map((i) => t[i] * Math.cos(heading) + e[i] * Math.sin(heading));
      const u = [up.x, up.y, up.z];
      assert.ok(Math.abs(up.length() - 1) < 1e-12);
      assert.ok(Math.abs(pos.length() - 1.06) < 1e-12);
      // Le haut horizontal de l'image suit exactement le cap.
      assert.ok(Math.abs(dot3(u, th) - Math.cos(TILT_MAX_ANGLE)) < 1e-12);
      assert.ok(Math.abs(dot3(u, n) - Math.sin(TILT_MAX_ANGLE)) < 1e-12);
      const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
      assert.ok(Math.abs(dot3(u, sight) / Math.hypot(...sight)) < 1e-12);
    }
  }
  // Cap 0 : la pose est identique à celle sans cap (compatibilité).
  const a = [vec(), vec(), vec()], b = [vec(), vec(), vec()];
  tiltPose({ radius: 1, dist: 1.05, el: 0.3, az: 4.2, angle: 0.7, pos: a[0], aim: a[1], up: a[2] });
  tiltPose({ radius: 1, dist: 1.05, el: 0.3, az: 4.2, angle: 0.7, heading: 0, pos: b[0], aim: b[1], up: b[2] });
  for (let i = 0; i < 3; i++) assert.deepEqual([a[i].x + 0, a[i].y + 0, a[i].z + 0], [b[i].x + 0, b[i].y + 0, b[i].z + 0]);
});

test('recalage au nord vrai : le nord géographique passe en haut de l’image', () => {
  // Axe de rotation terrestre incliné de 0,409 rad (comme dans le moteur).
  const axis = [0, Math.cos(0.409), -Math.sin(0.409)];
  for (const [el, az] of [[0.2, 0.6], [-0.7, 2.4], [1.1, 5.2], [-1.3, 0.1]]) {
    const n = normal(el, az), t = tangentN(el, az), e = tangentE(az);
    const raw = axis.map((v, i) => v - dot3(axis, n) * n[i]);
    const len = Math.hypot(...raw);
    const nt = raw.map((v) => v / len);
    const bearing = Math.atan2(dot3(nt, e), dot3(nt, t));

    const pos = vec(), aim = vec(), up = vec();
    tiltPose({ radius: 1, dist: 1.05, el, az, angle: TILT_MAX_ANGLE, heading: bearing, pos, aim, up });
    const u = [up.x, up.y, up.z];
    // La composante horizontale du haut de l'image coïncide avec le nord vrai.
    assert.ok(Math.abs(dot3(u, nt) - Math.cos(TILT_MAX_ANGLE)) < 1e-12);
    assert.ok(Math.abs(up.length() - 1) < 1e-12);
    const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
    assert.ok(Math.abs(dot3(u, sight) / Math.hypot(...sight)) < 1e-12);
  }
});
