// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { isDeviceSupported } from './deviceGate.jsx';

// Fonction IPHONE : l'identité d'un iPhone pour une version d'iOS.
const IPHONE = (os) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${os} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`;
// Identité d'un téléphone Android.
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

// Premier test : les iPhone.
test('iPhone : accepté à partir de l’iPhone 15 (écran 393 pt, iOS 17)', () => {
  // iPhone 15 : accepté.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('17_0'), screenWidth: 393, screenHeight: 852 }), true);   // iPhone 15
  // iPhone 15 Pro Max : accepté.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('18_6'), screenWidth: 430, screenHeight: 932 }), true);   // 15 Pro Max
  // En paysage : accepté.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('18_6'), screenWidth: 852, screenHeight: 393 }), true);   // en paysage
  // iPhone 14 : refusé.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('17_4'), screenWidth: 390, screenHeight: 844 }), false);  // iPhone 14
  // iPhone SE : refusé.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('17_4'), screenWidth: 375, screenHeight: 667 }), false);  // iPhone SE
  // iOS 16 : refusé.
  assert.equal(isDeviceSupported({ userAgent: IPHONE('16_7'), screenWidth: 393, screenHeight: 852 }), false);  // iOS trop ancien
// Fin du test.
});

// Deuxième test : les téléphones Android.
test('Android : au moins 8 Go de mémoire et 8 cœurs', () => {
  // 8 Go et 8 cœurs : accepté.
  assert.equal(isDeviceSupported({ userAgent: ANDROID, deviceMemory: 8, hardwareConcurrency: 8 }), true);
  // 4 Go : refusé.
  assert.equal(isDeviceSupported({ userAgent: ANDROID, deviceMemory: 4, hardwareConcurrency: 8 }), false);
  // 4 cœurs : refusé.
  assert.equal(isDeviceSupported({ userAgent: ANDROID, deviceMemory: 8, hardwareConcurrency: 4 }), false);
  // Sans information : accepté.
  assert.equal(isDeviceSupported({ userAgent: ANDROID }), true); // information absente : on laisse passer
// Fin du test.
});

// Troisième test : les autres appareils.
test('ordinateurs, tablettes et robots d’indexation : jamais bloqués', () => {
  // Un Mac : accepté.
  assert.equal(isDeviceSupported({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15' }), true);
  // Une tablette Android : acceptée.
  assert.equal(isDeviceSupported({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/126.0 Safari/537.36', deviceMemory: 4 }), true);
  // Un robot d'indexation : accepté.
  assert.equal(isDeviceSupported({ userAgent: `${ANDROID} (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`, deviceMemory: 2 }), true);
  // Sans rien : accepté.
  assert.equal(isDeviceSupported(), true);
// Fin du test.
});
