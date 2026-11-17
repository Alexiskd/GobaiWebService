// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ouvre l'import de ce qui est testé :
import {
  // les constantes et les fonctions du module ;
  FLY_ALTITUDE_MAX_M, FLY_ALTITUDE_MIN_M, HOME_NAME, flyAltitude, geolocationMessage, getHome, locate, normalizePlace, parseHome,
  // la suite des fonctions.
  placeFromPosition, setHome, subscribeHome,
// Fin de l'import.
} from './homePlace';

// Premier test : la validation d'un lieu.
test('lieu valide : latitude bornée, longitude ramenée dans −180 … 180', () => {
  // Un lieu valide est rendu tel quel.
  assert.deepEqual(normalizePlace({ lat: 48.99, lon: 2.09 }), { lat: 48.99, lon: 2.09 });
  // Des textes sont convertis ; 190° devient −170°.
  assert.deepEqual(normalizePlace({ lat: '10', lon: '190' }), { lat: 10, lon: -170 });
  // −190° devient 170°.
  assert.deepEqual(normalizePlace({ lat: 0, lon: -190 }), { lat: 0, lon: 170 });
  // 180° reste 180°.
  assert.deepEqual(normalizePlace({ lat: 0, lon: 180 }), { lat: 0, lon: 180 });
  // Latitude de 91° : null.
  assert.equal(normalizePlace({ lat: 91, lon: 0 }), null);
  // Latitude illisible : null.
  assert.equal(normalizePlace({ lat: 'x', lon: 0 }), null);
  // Latitude absente : null.
  assert.equal(normalizePlace({ lat: null, lon: 0 }), null);
  // Rien : null.
  assert.equal(normalizePlace(null), null);
// Fin du test.
});

// Deuxième test : l'altitude de survol.
test('altitude de survol : suit la précision, entre le plancher et le plafond', () => {
  // Précision de 5 m : le minimum.
  assert.equal(flyAltitude(5), FLY_ALTITUDE_MIN_M); // GPS précis : vue du quartier
  // Précision de 1 km : 4 km.
  assert.equal(flyAltitude(1000), 4000); // position par le réseau : vue plus large
  // Précision énorme : le maximum.
  assert.equal(flyAltitude(1e6), FLY_ALTITUDE_MAX_M);
  // Inconnue : le minimum.
  assert.equal(flyAltitude(undefined), FLY_ALTITUDE_MIN_M);
  // Négative : le minimum.
  assert.equal(flyAltitude(-3), FLY_ALTITUDE_MIN_M);
// Fin du test.
});

// Troisième test : de la position au lieu.
test('position de l’appareil → lieu à survoler', () => {
  // Lieu d'une position précise.
  const place = placeFromPosition({ coords: { latitude: 48.99, longitude: 2.09, accuracy: 20 } });
  // Son nom, ses coordonnées et l'altitude minimale.
  assert.deepEqual(place, { name: 'Ma position', lat: 48.99, lon: 2.09, altitudeM: FLY_ALTITUDE_MIN_M });
  // Latitude invalide : null.
  assert.equal(placeFromPosition({ coords: { latitude: NaN, longitude: 0 } }), null);
  // Rien : null.
  assert.equal(placeFromPosition(null), null);
  // Avec le nom de la Maison.
  assert.equal(placeFromPosition({ coords: { latitude: 1, longitude: 2 } }, HOME_NAME).name, 'Maison');
// Fin du test.
});

// Quatrième test : les messages.
test('messages de localisation : un texte par cas', () => {
  // Messages des codes 1, 2, 3 et d'un code absent.
  const texts = [1, 2, 3, undefined].map((code) => geolocationMessage({ code }));
  // Quatre textes différents.
  assert.equal(new Set(texts).size, 4);
  // Le premier parle de refus.
  assert.match(texts[0], /refusée/);
// Fin du test.
});

// Cinquième test : la lecture de la Maison.
test('Maison gardée : lecture tolérante du stockage', () => {
  // Un JSON valide.
  assert.deepEqual(parseHome('{"lat":48.99,"lon":2.09}'), { lat: 48.99, lon: 2.09 });
  // Une latitude impossible : null.
  assert.equal(parseHome('{"lat":999,"lon":2}'), null);
  // Un texte qui n'est pas du JSON : null.
  assert.equal(parseHome('pas du json'), null);
  // Rien : null.
  assert.equal(parseHome(null), null);
// Fin du test.
});

// Sixième test : enregistrer et oublier.
test('Maison : enregistrer, prévenir les abonnés, oublier', () => {
  // Nombre d'appels de l'abonné.
  let calls = 0;
  // S'abonne.
  const off = subscribeHome(() => { calls += 1; });
  // Enregistre : seules la latitude et la longitude sont gardées.
  assert.deepEqual(setHome({ lat: 1, lon: 2, name: 'ignoré' }), { lat: 1, lon: 2 });
  // La Maison est lue.
  assert.deepEqual(getHome(), { lat: 1, lon: 2 });
  // Oublie.
  assert.equal(setHome(null), null);
  // Plus de Maison.
  assert.equal(getHome(), null);
  // Deux appels.
  assert.equal(calls, 2);
  // Se désabonne.
  off();
  // Enregistre encore.
  setHome({ lat: 3, lon: 4 });
  // Toujours deux appels.
  assert.equal(calls, 2);
  // Remet à zéro.
  setHome(null);
// Fin du test.
});

// Septième test : la localisation.
test('localisation : une seule mesure, refus si l’appareil n’en a pas', async () => {
  // Options reçues par le faux GPS.
  let options = null;
  // Faux GPS qui répond tout de suite.
  const fake = { getCurrentPosition: (ok, ko, o) => { options = o; ok({ coords: { latitude: 1, longitude: 2, accuracy: 3 } }); } };
  // Demande la position.
  const position = await locate(fake);
  // La latitude est la bonne.
  assert.equal(position.coords.latitude, 1);
  // Une mesure d'une minute au plus est acceptée.
  assert.equal(options.maximumAge, 60_000);
  // Sans GPS : rejet.
  await assert.rejects(locate(null));
// Fin du test.
});

// Huitième test : la boussole lue une fois.
test('boussole lue une fois : cap du premier événement, capteurs relâchés ensuite', async () => {
  // Fonctions qui écoutent.
  const listeners = new Map();
  // Fausse fenêtre :
  const target = {
    // l'autorisation est accordée ;
    DeviceOrientationEvent: { requestPermission: async () => 'granted' },
    // l'écran est tactile ;
    navigator: { maxTouchPoints: 5 },
    // écouter ajoute la fonction ;
    addEventListener: (name, fn) => listeners.set(name, fn),
    // ne plus écouter la retire.
    removeEventListener: (name) => listeners.delete(name),
  // Fin de la fausse fenêtre.
  };
  // Charge la fonction testée.
  const { readCompassOnce } = await import('./homePlace');
  // Lance la lecture du cap.
  const pending = readCompassOnce((e) => e.heading ?? null, { target, timeoutMs: 500 });
  // Laisse passer 5 ms.
  await new Promise((r) => setTimeout(r, 5));
  // Deux événements sont écoutés.
  assert.equal(listeners.size, 2);
  // Un événement sans cap : rien.
  listeners.get('deviceorientation')({}); // événement sans cap : on attend le suivant
  // Un événement avec un cap de 123°.
  listeners.get('deviceorientation')({ heading: 123 });
  // Le cap rendu est 123.
  assert.equal(await pending, 123);
  // Plus rien n'est écouté.
  assert.equal(listeners.size, 0);
// Fin du test.
});

// Neuvième test : la boussole absente.
test('boussole : null sans capteur, sur refus ou sans réponse', async () => {
  // Charge la fonction testée.
  const { readCompassOnce } = await import('./homePlace');
  // Sans capteur : null.
  assert.equal(await readCompassOnce(() => 1, { target: {} }), null); // ordinateur
  // Base d'une fausse fenêtre tactile.
  const base = { navigator: { maxTouchPoints: 5 }, addEventListener() {}, removeEventListener() {} };
  // Autorisation refusée : null.
  assert.equal(await readCompassOnce(() => 1, { target: { ...base, DeviceOrientationEvent: { requestPermission: async () => 'denied' } } }), null);
  // Demande d'autorisation en échec : null.
  assert.equal(await readCompassOnce(() => 1, { target: { ...base, DeviceOrientationEvent: { requestPermission: () => Promise.reject(new Error('x')) } } }), null);
  // Sans réponse : null.
  assert.equal(await readCompassOnce(() => 1, { target: { ...base, DeviceOrientationEvent: {} }, timeoutMs: 10 }), null);
// Fin du test.
});
