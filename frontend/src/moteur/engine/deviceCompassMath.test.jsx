// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis deviceCompassMath (début de la liste).
import {
  // Les deux constantes de vitesse maximale et les six fonctions testées.
  PAN_MAX_RAD_PER_S, ZOOM_MAX_PER_S, devicePitchDeg, deviceRollDeg, moveOnSphere, smoothValue, tiltPanRate, tiltZoomFactor,
// Fin de la liste : le module deviceCompassMath.
} from './deviceCompassMath';

// Test : l'inclinaison du téléphone selon l'orientation de l'écran.
test('gyroscope : l’inclinaison suit le haut de l’écran, en portrait comme en paysage', () => {
  // À plat : 0.
  assert.equal(devicePitchDeg({ beta: 0, gamma: 0 }), 0);
  // Écran droit : la valeur de beta, 60.
  assert.equal(devicePitchDeg({ beta: 60, gamma: 5 }), 60);
  // Écran tourné de 90° : l'opposé de gamma, 40.
  assert.equal(devicePitchDeg({ beta: 3, gamma: -40 }, 90), 40);
  // Écran tourné de 270° : gamma, 40.
  assert.equal(devicePitchDeg({ beta: 3, gamma: 40 }, 270), 40);
  // Écran tourné de 180° : l'opposé de beta, 50.
  assert.equal(devicePitchDeg({ beta: -50, gamma: 0 }, 180), 50);
  // Angle beta absent : null.
  assert.equal(devicePitchDeg({ beta: null, gamma: 0 }), null);
// Fin du test.
});

// Test : le lissage d'une valeur.
test('gyroscope : le lissage démarre sur la première mesure puis s’en rapproche', () => {
  // Sans valeur précédente : la nouvelle valeur, 30.
  assert.equal(smoothValue(null, 30), 30);
  // De 0 vers 40 avec un coefficient de 0,25 : 10.
  assert.equal(smoothValue(0, 40, 0.25), 10);
// Fin du test.
});

// Test : le sens du zoom au gyroscope.
test('gyroscope : pencher vers l’avant zoome, vers l’arrière dézoome, rien dans la zone morte', () => {
  // Écart nul : facteur 1.
  assert.equal(tiltZoomFactor(0, 0.016), 1);
  // Écart de −2°, dans la zone morte : facteur 1.
  assert.equal(tiltZoomFactor(-2, 0.016), 1);
  // Écart de −20° : facteur inférieur à 1.
  assert.ok(tiltZoomFactor(-20, 0.016) < 1);
  // Écart de 20° : facteur supérieur à 1.
  assert.ok(tiltZoomFactor(20, 0.016) > 1);
  // Symétrique : autant de zoom que de dézoom pour un même angle.
  // Les facteurs pour −20° et 20° ont un produit égal à 1, à 1e-12 près.
  assert.ok(Math.abs(tiltZoomFactor(-20, 0.1) * tiltZoomFactor(20, 0.1) - 1) < 1e-12);
// Fin du test.
});

// Test : la vitesse du zoom au gyroscope.
test('gyroscope : plus on penche, plus le zoom est rapide, jusqu’à la vitesse maximale', () => {
  // À 15°, le facteur sur une seconde est plus grand qu'à 8°.
  assert.ok(tiltZoomFactor(15, 1) > tiltZoomFactor(8, 1));
  // À 80°, il vaut le maximum par seconde.
  assert.ok(Math.abs(tiltZoomFactor(80, 1) - ZOOM_MAX_PER_S) < 1e-12);
  // À −80°, il vaut l'inverse de ce maximum.
  assert.ok(Math.abs(tiltZoomFactor(-80, 1) - 1 / ZOOM_MAX_PER_S) < 1e-12);
// Fin du test.
});

// Test : la bascule latérale selon l'orientation de l'écran.
test('gyroscope : la bascule latérale suit le côté droit de l’écran, en portrait comme en paysage', () => {
  // Écran droit : gamma, 25.
  assert.equal(deviceRollDeg({ beta: 40, gamma: 25 }), 25);
  // Écran tourné de 90° : beta, 25.
  assert.equal(deviceRollDeg({ beta: 25, gamma: 3 }, 90), 25);
  // Écran tourné de 270° : l'opposé de beta, −25.
  assert.equal(deviceRollDeg({ beta: 25, gamma: 3 }, 270), -25);
  // Écran tourné de 180° : l'opposé de gamma, −25.
  assert.equal(deviceRollDeg({ beta: 0, gamma: 25 }, 180), -25);
  // Événement sans angles : null.
  assert.equal(deviceRollDeg({}), null);
// Fin du test.
});

// Test : le déplacement latéral au gyroscope.
test('gyroscope : pencher à droite déplace à droite, à gauche à gauche, rien dans la zone morte', () => {
  // Écart nul : vitesse nulle.
  assert.equal(tiltPanRate(0), 0);
  // Écart de 2°, dans la zone morte : vitesse nulle.
  assert.equal(tiltPanRate(2), 0);
  // Écart de 20° : vitesse positive.
  assert.ok(tiltPanRate(20) > 0);
  // Écart de −20° : la vitesse opposée.
  assert.equal(tiltPanRate(-20), -tiltPanRate(20));
  // Écart de 90° : la vitesse maximale.
  assert.equal(tiltPanRate(90), PAN_MAX_RAD_PER_S);
// Fin du test.
});

// Test : l'effet de la sensibilité.
test('gyroscope : la sensibilité multiplie l’angle lu (à 2, on penche deux fois moins)', () => {
  // 5° avec une sensibilité de 2 : même vitesse que 10°.
  assert.equal(tiltPanRate(5, 2), tiltPanRate(10));
  // −5° avec une sensibilité de 2 : même facteur de zoom que −10°.
  assert.equal(tiltZoomFactor(-5, 0.1, 2), tiltZoomFactor(-10, 0.1));
  // 10° avec une sensibilité de 0,25 : vitesse nulle.
  assert.equal(tiltPanRate(10, 0.25), 0); // très peu sensible : 10° restent dans la zone morte
// Fin du test.
});

// near : vrai quand deux nombres sont égaux à eps près (1e-6 par défaut).
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Test : le déplacement du point survolé, nord en haut.
test('déplacement : nord en haut, avancer monte en latitude et aller à droite part vers l’est', () => {
  // Déplacement de 0,01 radian vers le haut.
  const fwd = moveOnSphere({ az: 0.4, el: 0.2, heading: 0 }, 0, 0.01);
  // La latitude augmente et la longitude ne change pas, à 1e-4 près.
  assert.ok(fwd.el > 0.2 && near(fwd.az, 0.4, 1e-4), JSON.stringify(fwd));
  // Déplacement de 0,01 radian vers la droite, depuis l'équateur.
  const right = moveOnSphere({ az: 0.4, el: 0, heading: 0 }, 0.01, 0);
  // La longitude augmente et la latitude ne change pas, à 1e-4 près.
  assert.ok(right.az > 0.4 && near(right.el, 0, 1e-4), JSON.stringify(right));
  // Vers la gauche : la longitude diminue.
  assert.ok(moveOnSphere({ az: 0.4, el: 0, heading: 0 }, -0.01, 0).az < 0.4);
  // Vers le bas : la latitude diminue.
  assert.ok(moveOnSphere({ az: 0.4, el: 0.2, heading: 0 }, 0, -0.01).el < 0.2);
// Fin du test.
});

// Test : le déplacement avec l'est en haut de l'écran.
test('déplacement : il suit le haut de l’écran quel que soit le cap (est en haut : avancer part vers l’est)', () => {
  // Déplacement de 0,01 radian vers le haut, avec un cap d'un quart de tour.
  const m = moveOnSphere({ az: 1, el: 0, heading: Math.PI / 2 }, 0, 0.01);
  // La longitude augmente et la latitude ne change pas, à 1e-4 près.
  assert.ok(m.az > 1 && near(m.el, 0, 1e-4), JSON.stringify(m));
// Fin du test.
});

// Test : la continuité de la longitude et la limite de latitude.
test('déplacement : la longitude reste continue et la latitude s’arrête avant le pôle', () => {
  // Déplacement vers la droite depuis une longitude de deux tours et demi environ.
  const far = moveOnSphere({ az: 3.14 + 4 * Math.PI, el: 0, heading: 0 }, 0.02, 0);
  // La longitude augmente de 0,02 sans revenir d'un ou plusieurs tours.
  assert.ok(Math.abs(far.az - (3.14 + 4 * Math.PI) - 0.02) < 1e-3, String(far.az));
  // Vue de départ : près du pôle, à 1,45 radian de latitude.
  let p = { az: 0, el: 1.45, heading: 0 };
  // Deux cents déplacements de 0,01 radian vers le haut, le cap étant remis à 0.
  for (let i = 0; i < 200; i++) p = { ...moveOnSphere(p, 0, 0.01), heading: 0 };
  // La latitude ne dépasse pas 1,5 radian.
  assert.ok(p.el <= 1.5 + 1e-12);
  // Un déplacement nul renvoie la même longitude et la même latitude.
  assert.deepEqual(moveOnSphere({ az: 0.3, el: 0.1, heading: 0.7 }, 0, 0), { az: 0.3, el: 0.1 });
// Fin du test.
});

// Point survolé et haut de l'écran d'une vue { az, el, heading } (mêmes formules que moveOnSphere).
// pose : point survolé et haut de l'écran d'une vue (début).
function pose({ az, el, heading }) {
  // Sinus et cosinus de az et de el.
  const sa = Math.sin(az), ca = Math.cos(az), se = Math.sin(el), ce = Math.cos(el);
  // Normale, tangente nord et tangente est.
  const n = [ce * sa, se, ce * ca], t = [-se * sa, ce, -se * ca], e = [ca, 0, -sa];
  // Cosinus et sinus du cap.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  // Renvoie la normale et le haut de l'écran.
  return { n, up: [0, 1, 2].map((i) => t[i] * ch + e[i] * sh) };
// Fin de pose.
}
// close : vrai quand deux vecteurs sont égaux à 1e-9 près.
const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

// Test, asynchrone : le passage d'un pôle.
test('passage du pôle : la vue réécrite de l’autre côté est exactement la même', async () => {
  // Importe à la demande crossPole et arrowSign.
  const { crossPole, arrowSign } = await import('./deviceCompassMath');
  // Pour trois vues situées au-delà d'un pôle (début).
  for (const view of [{ az: 0.4, el: 1.62, heading: 0 }, { az: -2.1, el: -1.7, heading: 0.3 }, { az: 5, el: 1.58, heading: Math.PI }]) {
    // Point survolé et haut de l'écran avant.
    const before = pose(view);
    // La vue réécrite de l'autre côté.
    const c = crossPole(view);
    // Le pôle est noté franchi.
    assert.equal(c.crossed, true);
    // La nouvelle latitude ne dépasse pas un quart de tour.
    assert.ok(Math.abs(c.el) <= Math.PI / 2);
    // Point survolé et haut de l'écran après.
    const after = pose(c);
    // Le point survolé est le même.
    assert.ok(close(before.n, after.n), 'même point survolé');
    // Le haut de l'écran est le même.
    assert.ok(close(before.up, after.up), 'même haut de l’écran');
  // Fin de la boucle.
  }
  // Une vue qui n'a pas dépassé le pôle est rendue inchangée, pôle non franchi.
  assert.deepEqual(crossPole({ az: 1, el: 1.2, heading: 0 }), { az: 1, el: 1.2, heading: 0, crossed: false });
  // Flèche « haut » maintenue : on franchit le pôle Nord, puis on continue à descendre de l'autre côté sans rebrousser chemin.
  // Vue de départ : à 1,5 radian de latitude, nord en haut.
  let v = { az: 0, el: 1.5, heading: 0 };
  // Liste des valeurs relevées.
  const path = [];
  // Quarante pas (début).
  for (let i = 0; i < 40; i++) {
    // Avance de 0,02 radian dans le sens donné par arrowSign.
    v.el += arrowSign(v.heading) * 0.02;
    // Réécrit la vue si le pôle est dépassé.
    v = crossPole(v);
    // Relève la composante z du point survolé.
    path.push(pose(v).n[2]); // z : positif du côté de départ, négatif une fois le pôle passé
  // Fin de la boucle.
  }
  // La première valeur est positive et la dernière négative.
  assert.ok(path[0] > 0 && path[path.length - 1] < 0, 'on passe de l’autre côté');
  // Chaque valeur est plus petite que la précédente.
  for (let i = 1; i < path.length; i++) assert.ok(path[i] < path[i - 1], 'toujours dans le même sens');
// Fin du test.
});
