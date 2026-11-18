// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis cameraTilt (début de la liste).
import {
  // Les cinq constantes de l'inclinaison et du cap.
  HEADING_RESPONSE_MS, TILT_FULL_RATIO, TILT_MAX_ANGLE, TILT_RESPONSE_MS, TILT_START_RATIO,
  // Les quatre fonctions testées.
  approachAngle, approachTilt, tiltEngagement, tiltPose,
// Fin de la liste : le module cameraTilt.
} from './cameraTilt';

// vec : fabrique un faux vecteur à trois composantes (début).
const vec = () => ({
  // Ses trois coordonnées, nulles au départ.
  x: 0, y: 0, z: 0,
  // set : remplace les trois coordonnées et renvoie le vecteur.
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
  // length : sa longueur.
  length() { return Math.hypot(this.x, this.y, this.z); },
  // normalize : le rend unitaire ; une longueur nulle est remplacée par 1.
  normalize() { const l = this.length() || 1; return this.set(this.x / l, this.y / l, this.z / l); },
// Fin du faux vecteur.
});
// normal : normale à la sphère au point d'élévation el et d'azimut az.
const normal = (el, az) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];

// Test : la part d'inclinaison selon l'altitude.
test('inclinaison automatique : nulle en altitude, complète près du sol, sans saut', () => {
  // À 2 rayons : 0.
  assert.equal(tiltEngagement(2), 0);
  // À l'altitude de début : pratiquement 0.
  assert.ok(tiltEngagement(TILT_START_RATIO) < 1e-12);
  // À l'altitude d'inclinaison complète : pratiquement 1.
  assert.ok(1 - tiltEngagement(TILT_FULL_RATIO) < 1e-12);
  // À 1 rayon, au sol : 1.
  assert.equal(tiltEngagement(1), 1);

  // Valeur précédente : 0 au départ.
  let prev = 0;
  // De l'altitude de début jusqu'au sol, par pas de 0,002 (début).
  for (let ratio = TILT_START_RATIO; ratio >= 1; ratio -= 0.002) {
    // Part d'inclinaison à cette altitude.
    const e = tiltEngagement(ratio);
    // Elle ne diminue jamais.
    assert.ok(e >= prev - 1e-12);
    // Elle augmente de moins de 0,03 par pas.
    assert.ok(e - prev < 0.03);
    // Mémorise la valeur.
    prev = e;
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : le lissage dans le temps.
test('lissage temporel : même réponse à toute cadence, convergence douce', () => {
  // Sans temps écoulé : la valeur ne bouge pas.
  assert.equal(approachTilt(0, 1, 0), 0);
  // Après une constante de temps : 1 − 1/e du chemin, à 1e-12 près.
  assert.ok(Math.abs(approachTilt(0, 1, TILT_RESPONSE_MS) - (1 - Math.exp(-1))) < 1e-12);

  // Deux valeurs, pour 60 et 30 images par seconde.
  let at60 = 0, at30 = 0;
  // Deux secondes à 60 images par seconde.
  for (let i = 0; i < 120; i++) at60 = approachTilt(at60, 1, 1000 / 60);
  // Deux secondes à 30 images par seconde.
  for (let i = 0; i < 60; i++) at30 = approachTilt(at30, 1, 1000 / 30);
  // Les deux résultats sont égaux à 0,001 près.
  assert.ok(Math.abs(at60 - at30) < 1e-3);
  // La valeur dépasse 0,94.
  assert.ok(at60 > 0.94);
// Fin du test.
});

// Test : la pose inclinée.
test('pose 3/4 : distance de zoom exacte, lieu visé centré, angle demandé', () => {
  // Rayon, distance, élévation et azimut d'essai.
  const radius = 1, dist = 1.05, el = 0.4, az = 2.1;
  // Trois vecteurs à remplir : position, point visé et haut de l'image.
  const pos = vec(), aim = vec(), up = vec();
  // Calcule la pose à l'inclinaison maximale.
  tiltPose({ radius, dist, el, az, angle: TILT_MAX_ANGLE, pos, aim, up });
  // Le haut de l'image est de longueur 1.
  assert.ok(Math.abs(up.length() - 1) < 1e-12);

  // La caméra est exactement à la distance demandée du centre.
  assert.ok(Math.abs(pos.length() - dist) < 1e-12);
  // Normale au point visé.
  const n = normal(el, az);
  // Pour chaque coordonnée du point visé (début).
  for (const [got, want] of [[aim.x, n[0]], [aim.y, n[1]], [aim.z, n[2]]]) {
    // Elle vaut celle de la normale, à 1e-12 près.
    assert.ok(Math.abs(got / radius - want) < 1e-12);
  // Fin de la boucle.
  }
  // Vecteur du point visé vers la caméra.
  const sight = [pos.x - aim.x, pos.y - aim.y, pos.z - aim.z];
  // Sa longueur.
  const len = Math.hypot(...sight);
  // Cosinus de l'angle entre ce vecteur et la normale.
  const cos = (sight[0] * n[0] + sight[1] * n[1] + sight[2] * n[2]) / len;
  // Cet angle est l'inclinaison maximale, à 1e-12 près.
  assert.ok(Math.abs(Math.acos(cos) - TILT_MAX_ANGLE) < 1e-12);
// Fin du test.
});

// Test : la pose à l'équateur et aux deux pôles.
test('pose 3/4 : verticale et pôles sans singularité', () => {
  // Pour une élévation de 0, de π/2 et de −π/2 (début).
  for (const el of [0, Math.PI / 2, -Math.PI / 2]) {
    // Trois vecteurs à remplir.
    const pos = vec(), aim = vec(), up = vec();
    // Calcule la pose à l'inclinaison maximale.
    tiltPose({ radius: 2.5, dist: 2.6, el, az: 0.7, angle: TILT_MAX_ANGLE, pos, aim, up });
    // Toutes les coordonnées sont des nombres finis.
    assert.ok([pos.x, pos.y, pos.z, aim.x, aim.y, aim.z, up.x, up.y, up.z].every(Number.isFinite));
    // La caméra est à 2,6 du centre.
    assert.ok(Math.abs(pos.length() - 2.6) < 1e-12);
    // Le point visé est à 2,5 du centre.
    assert.ok(Math.abs(aim.length() - 2.5) < 1e-12);
  // Fin de la boucle.
  }

  // Trois vecteurs à remplir.
  const pos = vec(), aim = vec(), up = vec();
  // Calcule une pose sans inclinaison.
  tiltPose({ radius: 1, dist: 1.2, el: 0.3, az: 5, angle: 0, pos, aim, up });
  // Normale au point visé.
  const n = normal(0.3, 5);
  // Pour chaque coordonnée de la caméra (début).
  for (const [got, want] of [[pos.x, n[0] * 1.2], [pos.y, n[1] * 1.2], [pos.z, n[2] * 1.2]]) {
    // Elle vaut celle de la normale multipliée par la distance : la caméra est à la verticale du point.
    assert.ok(Math.abs(got - want) < 1e-12);
  // Fin de la boucle.
  }
  // À plat : le haut de l'image est la tangente nord (même orientation à l'écran que l'axe monde Y).
  // Le haut de l'image est perpendiculaire à la normale.
  assert.ok(Math.abs(up.x * n[0] + up.y * n[1] + up.z * n[2]) < 1e-12);
  // Sa composante y est positive.
  assert.ok(up.y > 0);
// Fin du test.
});

// Test : la continuité de la pose pendant un dézoom.
test('dézoom en 3/4 : la caméra ne se retourne jamais (haut ⟂ visée, nord en haut, variation continue)', () => {
  // dot : produit scalaire de deux vecteurs.
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Pour six élévations (début).
  for (const el of [-1.5, -0.7, 0, 0.45, 1.2, 1.5]) {
    // Pour trois azimuts (début).
    for (const az of [0, 1.3, 3.9]) {
      // Cosinus et sinus de l'élévation.
      const ce = Math.cos(el), se = Math.sin(el);
      // Tangente nord au point.
      const north = [-se * Math.sin(az), ce, -se * Math.cos(az)];
      // Haut de l'image précédent : aucun.
      let prev = null;
      // Inclinaison de 60° vers 0° (comme au dézoom), distance croissante.
      // Deux cent une étapes (début).
      for (let k = 0; k <= 200; k++) {
        // Inclinaison : de la valeur maximale à 0.
        const angle = TILT_MAX_ANGLE * (1 - k / 200);
        // Distance : de 1,02 à 1,42.
        const dist = 1.02 + k * 0.002;
        // Trois vecteurs à remplir.
        const pos = vec(), aim = vec(), up = vec();
        // Calcule la pose.
        tiltPose({ radius: 1, dist, el, az, angle, pos, aim, up });
        // Vecteur de la caméra vers le point visé.
        const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
        // Sa longueur.
        const sl = Math.hypot(...sight);
        // Haut de l'image, en tableau.
        const u = [up.x, up.y, up.z];
        // Il est de longueur 1.
        assert.ok(Math.abs(Math.hypot(...u) - 1) < 1e-12);
        // Il est perpendiculaire à la visée.
        assert.ok(Math.abs(dot(u, sight) / sl) < 1e-12);          // jamais aligné avec la visée
        // Son produit scalaire avec la tangente nord dépasse 0,49.
        assert.ok(dot(u, north) > 0.49);                          // le nord reste en haut de l'image
        // La caméra est à la distance demandée.
        assert.ok(Math.abs(pos.length() - dist) < 1e-12);         // distance de zoom inchangée
        // Il diffère très peu du haut de l'image de l'étape précédente.
        if (prev) assert.ok(dot(u, prev) > 0.999);                // aucun saut d'orientation
        // Mémorise le haut de l'image.
        prev = u;
      // Fin de la boucle des étapes.
      }
    // Fin de la boucle des azimuts.
    }
  // Fin de la boucle des élévations.
  }
// Fin du test.
});

// Test : le haut de l'image à toutes les latitudes.
test('haut de l’image : nord à plat, sol sous l’horizon à toutes les latitudes', () => {
  // Pour sept élévations (début).
  for (const el of [-1.5, -0.9, -0.25, 0, 0.25, 0.9, 1.5]) {
    // Trois vecteurs à remplir.
    const pos = vec(), aim = vec(), up = vec();
    // Calcule la pose à l'inclinaison maximale.
    tiltPose({ radius: 1, dist: 1.07, el, az: 0.4, angle: TILT_MAX_ANGLE, pos, aim, up });
    // Normale au point visé.
    const n = normal(el, 0.4);
    // Le haut de l'image est de longueur 1.
    assert.ok(Math.abs(up.length() - 1) < 1e-12);
    // Le haut de l'écran doit rester du côté du ciel local, sinon l'horizon s'affiche à l'envers.
    // Son produit scalaire avec la normale dépasse 0,3.
    assert.ok(up.x * n[0] + up.y * n[1] + up.z * n[2] > 0.3);
  // Fin de la boucle.
  }
// Fin du test.
});

// dot3 : produit scalaire de deux vecteurs.
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// tangentN : tangente nord au point d'élévation el et d'azimut az.
const tangentN = (el, az) => [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)];
// tangentE : tangente est à l'azimut az.
const tangentE = (az) => [Math.cos(az), 0, -Math.sin(az)];

// Test : le lissage du cap.
test('cap de la boussole : lissage par le plus court chemin, sans tour complet', () => {
  // De 0 vers 0 : 0.
  assert.equal(approachAngle(0, 0, 10), 0);
  // 3,0 → −3,0 : le plus court chemin passe par ±π (+0,283 rad), pas par 0.
  // De 3 vers −3 après une constante de temps : la valeur dépasse 3.
  assert.ok(approachAngle(3, -3, HEADING_RESPONSE_MS) > 3);
  // Cap de départ : 3.
  let h = 3;
  // Cinq secondes à 60 images par seconde vers −3.
  for (let i = 0; i < 300; i++) h = approachAngle(h, -3, 1000 / 60);
  // L'écart avec −3, ramené entre −π et π, est inférieur à 0,001.
  assert.ok(Math.abs(Math.atan2(Math.sin(h + 3), Math.cos(h + 3))) < 1e-3);

  // Même réponse à 60 et 30 images/s.
  // Deux valeurs de départ, pour 60 et 30 images par seconde.
  let at60 = 0.4, at30 = 0.4;
  // Deux secondes à 60 images par seconde.
  for (let i = 0; i < 120; i++) at60 = approachAngle(at60, -2.5, 1000 / 60);
  // Deux secondes à 30 images par seconde.
  for (let i = 0; i < 60; i++) at30 = approachAngle(at30, -2.5, 1000 / 30);
  // Les deux résultats sont égaux à 0,001 près.
  assert.ok(Math.abs(at60 - at30) < 1e-3);
// Fin du test.
});

// Test : la pose avec un cap.
test('cap : nord en haut au cap 0, est en haut au cap 90°, pose invariante', () => {
  // Pour trois élévations (début).
  for (const el of [-1.2, 0, 0.9]) {
    // Normale, tangente nord et tangente est au point.
    const n = normal(el, 1.7), t = tangentN(el, 1.7), e = tangentE(1.7);
    // Pour quatre caps : 0, un quart de tour dans chaque sens et un demi-tour (début).
    for (const heading of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      // Trois vecteurs à remplir.
      const pos = vec(), aim = vec(), up = vec();
      // Calcule la pose avec ce cap.
      tiltPose({ radius: 1, dist: 1.06, el, az: 1.7, angle: TILT_MAX_ANGLE, heading, pos, aim, up });
      // Direction horizontale du cap : mélange des tangentes nord et est.
      const th = [0, 1, 2].map((i) => t[i] * Math.cos(heading) + e[i] * Math.sin(heading));
      // Haut de l'image, en tableau.
      const u = [up.x, up.y, up.z];
      // Il est de longueur 1.
      assert.ok(Math.abs(up.length() - 1) < 1e-12);
      // La caméra est à 1,06 du centre.
      assert.ok(Math.abs(pos.length() - 1.06) < 1e-12);
      // Le haut horizontal de l'image suit exactement le cap.
      // Son produit scalaire avec la direction du cap vaut le cosinus de l'inclinaison.
      assert.ok(Math.abs(dot3(u, th) - Math.cos(TILT_MAX_ANGLE)) < 1e-12);
      // Son produit scalaire avec la normale vaut le sinus de l'inclinaison.
      assert.ok(Math.abs(dot3(u, n) - Math.sin(TILT_MAX_ANGLE)) < 1e-12);
      // Vecteur de la caméra vers le point visé.
      const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
      // Le haut de l'image lui est perpendiculaire.
      assert.ok(Math.abs(dot3(u, sight) / Math.hypot(...sight)) < 1e-12);
    // Fin de la boucle des caps.
    }
  // Fin de la boucle des élévations.
  }
  // Cap 0 : la pose est identique à celle sans cap (compatibilité).
  // Deux séries de trois vecteurs.
  const a = [vec(), vec(), vec()], b = [vec(), vec(), vec()];
  // Pose calculée sans cap.
  tiltPose({ radius: 1, dist: 1.05, el: 0.3, az: 4.2, angle: 0.7, pos: a[0], aim: a[1], up: a[2] });
  // Même pose calculée avec un cap de 0.
  tiltPose({ radius: 1, dist: 1.05, el: 0.3, az: 4.2, angle: 0.7, heading: 0, pos: b[0], aim: b[1], up: b[2] });
  // Les trois vecteurs sont identiques ; l'ajout de 0 transforme un éventuel −0 en 0.
  for (let i = 0; i < 3; i++) assert.deepEqual([a[i].x + 0, a[i].y + 0, a[i].z + 0], [b[i].x + 0, b[i].y + 0, b[i].z + 0]);
// Fin du test.
});

// Test : le recalage sur le nord géographique.
test('recalage au nord vrai : le nord géographique passe en haut de l’image', () => {
  // Axe de rotation terrestre incliné de 0,409 rad (comme dans le moteur).
  // Axe de rotation de la Terre dans la scène.
  const axis = [0, Math.cos(0.409), -Math.sin(0.409)];
  // Pour quatre points (début).
  for (const [el, az] of [[0.2, 0.6], [-0.7, 2.4], [1.1, 5.2], [-1.3, 0.1]]) {
    // Normale, tangente nord et tangente est au point.
    const n = normal(el, az), t = tangentN(el, az), e = tangentE(az);
    // Axe projeté dans le plan horizontal du point.
    const raw = axis.map((v, i) => v - dot3(axis, n) * n[i]);
    // Longueur de cette projection.
    const len = Math.hypot(...raw);
    // Direction du nord géographique, unitaire.
    const nt = raw.map((v) => v / len);
    // Cap de cette direction, mesuré depuis la tangente nord vers la tangente est.
    const bearing = Math.atan2(dot3(nt, e), dot3(nt, t));

    // Trois vecteurs à remplir.
    const pos = vec(), aim = vec(), up = vec();
    // Calcule la pose avec ce cap.
    tiltPose({ radius: 1, dist: 1.05, el, az, angle: TILT_MAX_ANGLE, heading: bearing, pos, aim, up });
    // Haut de l'image, en tableau.
    const u = [up.x, up.y, up.z];
    // La composante horizontale du haut de l'image coïncide avec le nord vrai.
    // Son produit scalaire avec le nord géographique vaut le cosinus de l'inclinaison.
    assert.ok(Math.abs(dot3(u, nt) - Math.cos(TILT_MAX_ANGLE)) < 1e-12);
    // Il est de longueur 1.
    assert.ok(Math.abs(up.length() - 1) < 1e-12);
    // Vecteur de la caméra vers le point visé.
    const sight = [aim.x - pos.x, aim.y - pos.y, aim.z - pos.z];
    // Le haut de l'image lui est perpendiculaire.
    assert.ok(Math.abs(dot3(u, sight) / Math.hypot(...sight)) < 1e-12);
  // Fin de la boucle.
  }
// Fin du test.
});
