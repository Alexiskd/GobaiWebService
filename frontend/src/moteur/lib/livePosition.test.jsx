// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { LIVE_OPTIONS, LivePosition, groundDistanceM, pointChanged, pointFromPosition } from './livePosition';

// Fonction fix : une mesure de GPS.
const fix = (latitude, longitude, accuracy = 12, heading = null) => ({ coords: { latitude, longitude, accuracy, heading } });

/** GPS simulé : `emit(position)` et `fail(error)` appellent les fonctions du dernier suivi ouvert. */
// Fonction fakeGeo : un faux GPS.
function fakeGeo() {
  // Le faux GPS :
  const geo = {
    // ses compteurs et ses fonctions gardées ;
    watches: 0, cleared: [], options: null, ok: null, ko: null,
    // watchPosition : garde les fonctions et les options, et rend un numéro ;
    watchPosition(ok, ko, options) { geo.ok = ok; geo.ko = ko; geo.options = options; return ++geo.watches; },
    // clearWatch : note le suivi fermé ;
    clearWatch(id) { geo.cleared.push(id); },
    // emit : envoie une mesure ;
    emit: (p) => geo.ok(p),
    // fail : envoie une erreur.
    fail: (e) => geo.ko(e),
  // Fin du faux GPS.
  };
  // Le renvoie.
  return geo;
// Fin de fakeGeo.
}
// Fonction fakeDoc : un faux document.
function fakeDoc() {
  // Le faux document : visible, avec ses fonctions d'écoute.
  const doc = { visibilityState: 'visible', handlers: [], addEventListener: (_n, fn) => doc.handlers.push(fn), removeEventListener: (_n, fn) => { doc.handlers = doc.handlers.filter((h) => h !== fn); } };
  // set : change la visibilité et prévient ceux qui écoutent.
  doc.set = (state) => { doc.visibilityState = state; doc.handlers.forEach((fn) => fn()); };
  // Le renvoie.
  return doc;
// Fin de fakeDoc.
}

// Premier test : de la mesure au point.
test('mesure de l’appareil → point du moteur, avec cap du GPS ou de la boussole', () => {
  // Une mesure complète.
  assert.deepEqual(pointFromPosition(fix(48.99, 2.09, 8, 90)), { lat: 48.99, lon: 2.09, accuracyM: 8, headingDeg: 90 });
  // Cap illisible : null.
  assert.equal(pointFromPosition(fix(48.99, 2.09, 8, NaN)).headingDeg, null);
  // Sans cap du GPS : celui de la boussole.
  assert.equal(pointFromPosition(fix(48.99, 2.09, 8, null), 270).headingDeg, 270);
  // Précision négative : 0.
  assert.equal(pointFromPosition(fix(48.99, 2.09, -1)).accuracyM, 0);
  // Latitude impossible : null.
  assert.equal(pointFromPosition(fix(120, 2)), null);
  // Rien : null.
  assert.equal(pointFromPosition(null), null);
// Fin du test.
});

// Deuxième test : le changement visible.
test('changement visible : 1 m, précision, cap', () => {
  // Point de départ.
  const a = { lat: 48.99, lon: 2.09, accuracyM: 10, headingDeg: null };
  // Un cent-millième de degré fait environ 1,11 m.
  assert.ok(Math.abs(groundDistanceM(a, { ...a, lat: 48.99001 }) - 1.11) < 0.02);
  // Pas de point avant : changé.
  assert.equal(pointChanged(null, a), true);
  // 0,4 m : pas changé.
  assert.equal(pointChanged(a, { ...a, lat: 48.990004 }), false, '0,4 m');
  // 2,2 m : changé.
  assert.equal(pointChanged(a, { ...a, lat: 48.99002 }), true, '2,2 m');
  // Précision de 10 à 11 m : pas changé.
  assert.equal(pointChanged(a, { ...a, accuracyM: 11 }), false);
  // Précision de 10 à 30 m : changé.
  assert.equal(pointChanged(a, { ...a, accuracyM: 30 }), true);
  // Un cap qui apparaît : changé.
  assert.equal(pointChanged(a, { ...a, headingDeg: 10 }), true, 'cap qui apparaît');
  // 4° en passant par le nord : pas changé.
  assert.equal(pointChanged({ ...a, headingDeg: 358 }, { ...a, headingDeg: 2 }), false, '4° en passant par le nord');
  // 12° : changé.
  assert.equal(pointChanged({ ...a, headingDeg: 350 }, { ...a, headingDeg: 2 }), true);
// Fin du test.
});

// Troisième test : le suivi.
test('suivi : première position, mises à jour, pas de travail sans changement', async () => {
  // Faux GPS et faux document.
  const geo = fakeGeo(), doc = fakeDoc();
  // Suivi branché dessus.
  const live = new LivePosition({ geolocation: geo, doc });
  // Nombre de changements.
  let changes = 0;
  // S'abonne.
  live.subscribe(() => { changes++; });
  // Démarre.
  const first = live.start();
  // État : en attente.
  assert.equal(live.getState().status, 'waiting');
  // Un second démarrage rend la même promesse.
  assert.equal(live.start(), first, 'un seul démarrage à la fois');
  // Les options sont celles du suivi.
  assert.deepEqual(geo.options, LIVE_OPTIONS);
  // Une mesure arrive.
  geo.emit(fix(48.99, 2.09));
  // La première position est rendue.
  assert.deepEqual(await first, { lat: 48.99, lon: 2.09, accuracyM: 12, headingDeg: null });
  // État : en marche.
  assert.equal(live.getState().status, 'on');
  // Nombre de changements avant.
  const before = changes;
  // Une mesure au même endroit.
  geo.emit(fix(48.990001, 2.09));
  // Aucun changement.
  assert.equal(changes, before, 'même endroit : rien');
  // Une mesure plus loin.
  geo.emit(fix(48.9905, 2.09));
  // Un changement.
  assert.equal(changes, before + 1);
  // Le point est mis à jour.
  assert.equal(live.getState().point.lat, 48.9905);
  // Un démarrage de plus rend la position connue.
  assert.deepEqual(await live.start(), live.getState().point, 'déjà en marche : position connue');
  // Un seul suivi a été ouvert.
  assert.equal(geo.watches, 1);
  // Donne le cap de la boussole.
  live.setCompass(123);
  // Le point le prend.
  assert.equal(live.getState().point.headingDeg, 123);
// Fin du test.
});

// Quatrième test : pause, reprise et arrêt.
test('suivi : pause quand l’onglet est caché, reprise au retour, arrêt', async () => {
  // Faux GPS et faux document.
  const geo = fakeGeo(), doc = fakeDoc();
  // Suivi branché dessus.
  const live = new LivePosition({ geolocation: geo, doc });
  // Démarre.
  const first = live.start();
  // Une mesure arrive.
  geo.emit(fix(10, 20));
  // Attend la première position.
  await first;
  // L'onglet est caché.
  doc.set('hidden');
  // Le suivi est fermé.
  assert.deepEqual(geo.cleared, [1]);
  // L'état reste « en marche ».
  assert.equal(live.getState().status, 'on', 'toujours voulu');
  // L'onglet revient.
  doc.set('visible');
  // Un second suivi est ouvert.
  assert.equal(geo.watches, 2);
  // Arrête.
  live.stop();
  // Les deux suivis sont fermés.
  assert.deepEqual(geo.cleared, [1, 2]);
  // État : à l'arrêt.
  assert.equal(live.getState().status, 'off');
  // Le dernier point est gardé.
  assert.equal(live.getState().point.lat, 10, 'dernier point gardé');
  // Une mesure arrive encore.
  geo.emit(fix(11, 21));
  // Elle est ignorée.
  assert.equal(live.getState().point.lat, 10, 'plus de mise à jour après l’arrêt');
  // L'onglet revient.
  doc.set('visible');
  // Aucun suivi n'est rouvert.
  assert.equal(geo.watches, 2, 'pas de reprise après un arrêt');
// Fin du test.
});

// Cinquième test : le refus.
test('suivi : refus ou appareil sans localisation', async () => {
  // Faux GPS.
  const geo = fakeGeo();
  // Suivi branché dessus.
  const live = new LivePosition({ geolocation: geo, doc: fakeDoc() });
  // Démarre.
  const first = live.start();
  // Le GPS refuse (code 1).
  geo.fail({ code: 1 });
  // La promesse est rompue avec ce code.
  await assert.rejects(first, (e) => e.code === 1);
  // État : à l'arrêt.
  assert.equal(live.getState().status, 'off');
  // Sans GPS : rejet « indisponible ».
  await assert.rejects(new LivePosition({ geolocation: {}, doc: fakeDoc() }).start(), /indisponible/);
  // Panne passagère après une première position : le suivi continue avec le dernier point.
  // Redémarre.
  const again = live.start();
  // Une mesure arrive.
  geo.emit(fix(1, 2));
  // Attend la position.
  await again;
  // Panne passagère (code 3).
  geo.fail({ code: 3 });
  // État : toujours en marche.
  assert.equal(live.getState().status, 'on');
  // Autorisation retirée (code 1).
  geo.fail({ code: 1 });
  // État : à l'arrêt.
  assert.equal(live.getState().status, 'off', 'autorisation retirée');
// Fin du test.
});

// Sixième test : la reprise à l'ouverture.
test('ouverture du site : le suivi reprend seul si l’autorisation est déjà donnée, sinon rien', async () => {
  // Permissions qui accordent la localisation.
  const granted = { query: async () => ({ state: 'granted' }) };
  // Faux GPS.
  const geo = fakeGeo();
  // Suivi branché dessus.
  const live = new LivePosition({ geolocation: geo, doc: fakeDoc() });
  // La reprise est lancée.
  assert.equal(await live.resumeIfAllowed(granted), true);
  // Un suivi est ouvert.
  assert.equal(geo.watches, 1);
  // Une mesure arrive.
  geo.emit(fix(48.99, 2.09));
  // État : en marche.
  assert.equal(live.getState().status, 'on');
  // Une seconde reprise : déjà lancée.
  assert.equal(await live.resumeIfAllowed(granted), true, 'déjà lancé');
  // Toujours un seul suivi.
  assert.equal(geo.watches, 1);
  // Pour chaque cas sans autorisation (à demander, refusée, en erreur, sans API, absente) :
  for (const permissions of [{ query: async () => ({ state: 'prompt' }) }, { query: async () => ({ state: 'denied' }) }, { query: async () => { throw new Error('non géré'); } }, {}, undefined]) {
    // faux GPS ;
    const g = fakeGeo();
    // suivi ;
    const l = new LivePosition({ geolocation: g, doc: fakeDoc() });
    // pas de reprise ;
    assert.equal(await l.resumeIfAllowed(permissions ?? null), false);
    // aucun suivi ouvert.
    assert.equal(g.watches, 0, 'aucune demande à l’utilisateur');
  // Fin de la boucle.
  }
  // Autorisation donnée mais GPS en panne : échec silencieux.
  // Faux GPS.
  const g = fakeGeo();
  // Suivi.
  const l = new LivePosition({ geolocation: g, doc: fakeDoc() });
  // Reprise autorisée.
  await l.resumeIfAllowed(granted);
  // Le GPS tombe en panne.
  g.fail({ code: 2 });
  // Laisse passer un tour.
  await new Promise((r) => setImmediate(r));
  // État : à l'arrêt.
  assert.equal(l.getState().status, 'off');
// Fin du test.
});
