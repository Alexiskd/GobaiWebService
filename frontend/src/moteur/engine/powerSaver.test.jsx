// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis powerSaver (début de la liste).
import {
  // Les durées d'image, les deux profils, les deux qualités et les premières fonctions testées.
  COVERED_FRAME_MS, DESKTOP_PROFILE, IDLE_FRAME_MS, targetFrameMs, FULL_QUALITY, HANDHELD_PROFILE, LITE_QUALITY, fbmNorm, isHandheld, normalizedFrameMs,
  // Le cadenceur, le profil de rendu, la qualité des shaders, le limiteur, le rythme visé et la part des envois.
  paceFrame, renderProfile, shaderQuality, skipFrame, TARGET_FPS, TARGET_FRAME_MS, uploadShare,
// Fin de la liste : le module powerSaver.
} from './powerSaver';

// win : fausse fenêtre dont matchMedia répond vrai aux requêtes données en arguments.
const win = (...matching) => ({ matchMedia: (q) => ({ matches: matching.includes(q) }) });

// Test : la détection d'un appareil tenu en main.
test('appareil tenu en main : tactile sans pointeur fin', () => {
  // Pointeur principal imprécis seul : vrai.
  assert.equal(isHandheld(win('(pointer: coarse)')), true); // téléphone
  // Pointeur principal imprécis avec un pointeur précis : faux.
  assert.equal(isHandheld(win('(pointer: coarse)', '(any-pointer: fine)')), false); // ordinateur tactile avec souris
  // Pointeur précis seul : faux.
  assert.equal(isHandheld(win('(any-pointer: fine)')), false); // ordinateur
  // Sans fenêtre : faux.
  assert.equal(isHandheld(null), false);
  // Profil d'un appareil à pointeur imprécis : celui du téléphone.
  assert.equal(renderProfile(win('(pointer: coarse)')), HANDHELD_PROFILE);
  // Profil d'une fenêtre qui ne répond à aucune requête : celui de l'ordinateur.
  assert.equal(renderProfile(win()), DESKTOP_PROFILE);
// Fin du test.
});

// Test : la comparaison des deux profils.
test('profil téléphone : moins de pixels et moins d’images que l’ordinateur', () => {
  // La densité maximale du téléphone est inférieure à celle de l'ordinateur.
  assert.ok(HANDHELD_PROFILE.dprMax < DESKTOP_PROFILE.dprMax);
  // Elle vaut au moins 1.
  assert.ok(HANDHELD_PROFILE.dprMax >= 1);
  // L'ordinateur vise la durée d'image commune.
  assert.equal(DESKTOP_PROFILE.frameMs, TARGET_FRAME_MS);
  // Le téléphone aussi.
  assert.equal(HANDHELD_PROFILE.frameMs, TARGET_FRAME_MS);
  // Le rythme visé est de 50 images par seconde.
  assert.equal(TARGET_FPS, 50);
  // Le téléphone n'a pas d'anticrénelage.
  assert.equal(HANDHELD_PROFILE.antialias, false);
// Fin du test.
});

// Test : le limiteur simple.
test('limiteur simple : une image sur deux à 60 Hz, une sur quatre à 120 Hz', () => {
  // rendered : nombre d'images rendues en une seconde, pour un écran et une durée visée (début).
  const rendered = (hz, frameMs) => {
    // Instant de la dernière image rendue.
    let last = 0;
    // Compteur d'images.
    let count = 0;
    // Pour chaque rappel de l'écran pendant une seconde (début).
    for (let i = 1; i <= hz; i += 1) {
      // Instant du rappel.
      const now = (i * 1000) / hz;
      // Si l'image n'est pas sautée : note l'instant et compte l'image.
      if (!skipFrame(now - last, frameMs)) { last = now; count += 1; }
    // Fin de la boucle.
    }
    // Renvoie le compte.
    return count;
  // Fin de rendered.
  };
  // Écran à 60 Hz, durée visée de 1/30 s : 30 images.
  assert.equal(rendered(60, 1000 / 30), 30);
  // Écran à 120 Hz, même durée : 30 images.
  assert.equal(rendered(120, 1000 / 30), 30);
  // Sans durée visée : les 60 images.
  assert.equal(rendered(60, 0), 60);
  // Temps écoulé négatif : l'image n'est pas sautée.
  assert.equal(skipFrame(-5, 1000 / 30), false); // horloge incohérente : on rend
// Fin du test.
});

// Test : le cadenceur.
test('cadenceur : 50 images par seconde quel que soit l’écran, sans jamais freiner un moteur plus lent', () => {
  // Images rendues en 10 secondes sur un écran à `hz`, pour un moteur qui met `costMs` à calculer une image.
  // rendered : images par seconde sur dix secondes, pour un écran, une durée visée et un coût de calcul par image (début).
  const rendered = (hz, frameMs, costMs = 0) => {
    // Cadenceur neuf.
    const pacer = { due: 0 };
    // Compteur d'images et instant jusqu'auquel le moteur est occupé.
    let count = 0, busyUntil = 0;
    // Pour chaque rappel de l'écran pendant dix secondes (début).
    for (let i = 1; i <= hz * 10; i += 1) {
      // Instant du rappel.
      const now = (i * 1000) / hz;
      // Moteur encore occupé : rappel ignoré.
      if (now < busyUntil) continue; // le navigateur n'appelle pas pendant qu'une image se calcule
      // Si le cadenceur demande de rendre : compte l'image et occupe le moteur pendant le coût.
      if (paceFrame(pacer, now, frameMs)) { count += 1; busyUntil = now + costMs; }
    // Fin de la boucle.
    }
    // Renvoie la moyenne par seconde.
    return count / 10;
  // Fin de rendered.
  };
  // Pour sept fréquences d'écran, de 60 à 240 Hz (début).
  for (const hz of [60, 75, 90, 120, 144, 165, 240]) {
    // Images par seconde obtenues avec la durée visée commune.
    const fps = rendered(hz, TARGET_FRAME_MS);
    // Elles valent 50, à 0,5 près.
    assert.ok(Math.abs(fps - 50) <= 0.5, `${hz} Hz : ${fps} images par seconde`);
  // Fin de la boucle.
  }
  // Écran à 50 Hz : 50 images par seconde, à 0,5 près.
  assert.ok(Math.abs(rendered(50, TARGET_FRAME_MS) - 50) <= 0.5);      // écran à 50 Hz : tout est rendu
  // Durée visée de 1/20 s à 60 Hz : 20 images par seconde, à 0,5 près.
  assert.ok(Math.abs(rendered(60, 1000 / 20) - 20) <= 0.5);            // repos sur téléphone
  // Sans durée visée à 60 Hz : 60 images par seconde.
  assert.equal(rendered(60, 0), 60);                                   // sans limite
  // Moteur plus lent que l'objectif (une image en 30 ms à 60 Hz → 30 par seconde) : le cadenceur n'enlève rien.
  // Moteur qui met 30 ms par image à 60 Hz : 30 images par seconde, à 0,5 près.
  assert.ok(Math.abs(rendered(60, TARGET_FRAME_MS, 30) - 30) <= 0.5);
  // Retour d'onglet après une longue pause : l'image est rendue tout de suite, sans rafale de rattrapage.
  // Cadenceur neuf.
  const pacer = { due: 0 };
  // Première image à 100 ms : rendue.
  assert.equal(paceFrame(pacer, 100, TARGET_FRAME_MS), true);
  // Image à 60 secondes, après une longue pause : rendue.
  assert.equal(paceFrame(pacer, 60000, TARGET_FRAME_MS), true);
  // Compteur des images qui suivent.
  let burst = 0;
  // Pendant les 100 ms suivantes, à 120 rappels par seconde : compte les images rendues.
  for (let t = 60000 + 1000 / 120; t < 60100; t += 1000 / 120) if (paceFrame(pacer, t, TARGET_FRAME_MS)) burst += 1;
  // Six au plus.
  assert.ok(burst <= 6, `${burst} images en 100 ms`);
// Fin du test.
});

// Test : la part des envois de tuiles.
test('envois de tuiles : pleins quand le rythme est tenu, réduits quand il fléchit', () => {
  // Durée moyenne nulle : tous les envois.
  assert.equal(uploadShare(0), 1);
  // 16,7 ms : tous les envois.
  assert.equal(uploadShare(1000 / 60), 1);                                   // 50 images par seconde tenues
  // 45 images par seconde, durée normalisée : la moitié.
  assert.equal(uploadShare(normalizedFrameMs(1000 / 45, TARGET_FRAME_MS)), 0.5);
  // 38 images par seconde, durée normalisée : un quart.
  assert.equal(uploadShare(normalizedFrameMs(1000 / 38, TARGET_FRAME_MS)), 0.25);
// Fin du test.
});

// Test : la durée d'image normalisée.
test('durée d’image normalisée : 20 ms à 50 images par seconde vaut 16,7 ms à 60', () => {
  // 20 ms pour une durée visée de 20 ms : 16,7 ms, à 1e-9 près.
  assert.ok(Math.abs(normalizedFrameMs(1000 / 50, HANDHELD_PROFILE.frameMs) - 1000 / 60) < 1e-9);
  // Sans durée visée : la durée brute.
  assert.equal(normalizedFrameMs(20, 0), 20);
  // 50 ms pour une durée visée de 20 ms : plus de 24 ms.
  assert.ok(normalizedFrameMs(50, HANDHELD_PROFILE.frameMs) > 24); // 20 images par seconde : jugé trop lent
// Fin du test.
});

// Test : les réglages allégés du téléphone.
test('téléphone : shaders allégés, démarrage à la densité 1, filtrage réduit', () => {
  // Le téléphone utilise la qualité allégée.
  assert.equal(shaderQuality(HANDHELD_PROFILE.lite), LITE_QUALITY);
  // L'ordinateur utilise la qualité complète.
  assert.equal(shaderQuality(DESKTOP_PROFILE.lite), FULL_QUALITY);
  // cost : nombre d'échantillons de diffusion d'une qualité.
  const cost = (q) => q.scatterSteps * q.lightSteps;
  // La qualité allégée en demande au moins quatre fois moins.
  assert.ok(cost(LITE_QUALITY) * 4 <= cost(FULL_QUALITY)); // diffusion : au moins 4 fois moins d'échantillons
  // Elle a moins d'octaves.
  assert.ok(LITE_QUALITY.octaves < FULL_QUALITY.octaves);
  // Le téléphone démarre à la densité 1.
  assert.equal(HANDHELD_PROFILE.dprStart, 1);
  // L'ordinateur démarre à sa densité maximale.
  assert.equal(DESKTOP_PROFILE.dprStart, DESKTOP_PROFILE.dprMax);
  // L'anisotropie du téléphone est inférieure à celle de l'ordinateur.
  assert.ok(HANDHELD_PROFILE.anisotropy < DESKTOP_PROFILE.anisotropy);
// Fin du test.
});

// Test : la somme des amplitudes du bruit.
test('bruit : somme des amplitudes selon le nombre d’octaves', () => {
  // 5 octaves : 0,96875.
  assert.equal(fbmNorm(5), 0.96875);
  // 3 octaves : 0,875.
  assert.equal(fbmNorm(3), 0.875);
// Fin du test.
});

// Test : le rythme sous l'écran de chargement.
test('scène recouverte par l’écran de chargement : 8 images par seconde au plus', () => {
  // Instant de la dernière image rendue.
  let last = 0;
  // Compteur d'images.
  let count = 0;
  // Pour 60 rappels en une seconde (début).
  for (let i = 1; i <= 60; i += 1) {
    // Instant du rappel.
    const now = (i * 1000) / 60;
    // Si l'image n'est pas sautée : note l'instant et compte l'image.
    if (!skipFrame(now - last, COVERED_FRAME_MS)) { last = now; count += 1; }
  // Fin de la boucle.
  }
  // Entre 6 et 8 images rendues.
  assert.ok(count <= 8 && count >= 6);
// Fin du test.
});

// Test : la durée visée selon l'état.
test('rythme visé : 20 images par seconde au repos sur téléphone et en mode économie', () => {
  // Téléphone sans état particulier : la durée commune.
  assert.equal(targetFrameMs(HANDHELD_PROFILE), TARGET_FRAME_MS);                       // téléphone, en mouvement : 50
  // Téléphone au repos : la durée de repos.
  assert.equal(targetFrameMs(HANDHELD_PROFILE, { idle: true }), IDLE_FRAME_MS);         // téléphone au repos : 20
  // Ordinateur au repos : la durée commune.
  assert.equal(targetFrameMs(DESKTOP_PROFILE, { idle: true }), TARGET_FRAME_MS);        // ordinateur : jamais ralenti seul, plafonné à 50
  // Ordinateur en mode économie : la durée de repos.
  assert.equal(targetFrameMs(DESKTOP_PROFILE, { saving: true }), IDLE_FRAME_MS);        // mode économie : partout
  // Mode économie et scène recouverte : la durée sous l'écran de chargement.
  assert.equal(targetFrameMs(DESKTOP_PROFILE, { saving: true, covered: true }), COVERED_FRAME_MS);
// Fin du test.
});
