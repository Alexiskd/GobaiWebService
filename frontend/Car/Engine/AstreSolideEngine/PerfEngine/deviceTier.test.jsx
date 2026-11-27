// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { currentDeviceInfo, deviceTier } from './deviceTier.jsx';

// Identité d'un iPhone pour une version d'iOS.
const IPHONE = (os) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`;
// Identité d'un téléphone Android.
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

// Test : les iPhone.
test('iPhone : haut de gamme à partir de l’iPhone 15, gamme moyenne et basse en dessous', () => {
  // iPhone 15 et 15 Pro Max (et en paysage) : haut de gamme.
  assert.equal(deviceTier({ userAgent: IPHONE('17_0'), screenWidth: 393, screenHeight: 852 }), 'high');
  assert.equal(deviceTier({ userAgent: IPHONE('18_6'), screenWidth: 932, screenHeight: 430 }), 'high');
  // iPhone 13 / 14 (390 pt) : gamme moyenne.
  assert.equal(deviceTier({ userAgent: IPHONE('17_5'), screenWidth: 390, screenHeight: 844 }), 'mid');
  // iOS 16 sur grand écran : gamme moyenne.
  assert.equal(deviceTier({ userAgent: IPHONE('16_7'), screenWidth: 414, screenHeight: 896 }), 'mid');
  // iPhone 8 / SE (375 pt) : gamme basse.
  assert.equal(deviceTier({ userAgent: IPHONE('16_7'), screenWidth: 375, screenHeight: 667 }), 'low');
  // iOS 14 : gamme basse.
  assert.equal(deviceTier({ userAgent: IPHONE('14_8'), screenWidth: 414, screenHeight: 896 }), 'low');
  // Écran inconnu, iOS récent : haut de gamme.
  assert.equal(deviceTier({ userAgent: IPHONE('18_0') }), 'high');
// Fin du test.
});

// Test : les Android.
test('Android : gamme selon la mémoire et les cœurs annoncés', () => {
  // 8 Go et 8 cœurs : haut de gamme.
  assert.equal(deviceTier({ userAgent: ANDROID, deviceMemory: 8, hardwareConcurrency: 8 }), 'high');
  // 4 Go : gamme moyenne.
  assert.equal(deviceTier({ userAgent: ANDROID, deviceMemory: 4, hardwareConcurrency: 8 }), 'mid');
  // 2 Go : gamme basse.
  assert.equal(deviceTier({ userAgent: ANDROID, deviceMemory: 2, hardwareConcurrency: 8 }), 'low');
  // 2 cœurs : gamme basse.
  assert.equal(deviceTier({ userAgent: ANDROID, hardwareConcurrency: 2 }), 'low');
  // Mémoire inconnue (Firefox) : gamme moyenne, jamais basse.
  assert.equal(deviceTier({ userAgent: ANDROID, hardwareConcurrency: 8 }), 'mid');
// Fin du test.
});

// Test : les autres appareils et les informations absentes.
test('autres appareils : gamme moyenne par défaut, lecture sûre hors navigateur', () => {
  // Rien de connu : gamme moyenne.
  assert.equal(deviceTier(), 'mid');
  // Tablette à 8 Go : haut de gamme.
  assert.equal(deviceTier({ userAgent: 'Mozilla/5.0 (iPad)', deviceMemory: 8 }), 'high');
  // Hors navigateur : objet sans identité.
  assert.equal(currentDeviceInfo(null).userAgent, '');
// Fin du test.
});
