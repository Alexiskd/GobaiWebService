// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { ATMOSPHERE_DEFAULTS, ATMOSPHERE_UPCOMING, aerosolHint, cycloneHint, fireHint, lightningHint, precipitationHint, sanitizeAtmosphere, stormHint, windHint } from './atmosphereSettings';

// Test : les réglages.
test('atmosphère : réglages bornés, calques éteints par défaut, fenêtre parmi celles proposées', () => {
  // Rien de gardé : valeurs par défaut.
  assert.deepEqual(sanitizeAtmosphere(null), ATMOSPHERE_DEFAULTS);
  // Valeurs hors bornes ou illisibles.
  const s = sanitizeAtmosphere({ fires: { on: 'oui', opacity: 5, intensity: 'x', windowHours: 7 }, cyclones: { on: true, opacity: 0, intensity: 3 } });
  // Incendies : « oui » n'est pas vrai, opacité ramenée à 1, intensité par défaut, fenêtre de 24 h.
  assert.deepEqual(s.fires, { on: false, opacity: 1, intensity: 1, windowHours: 24 });
  // Cyclones : allumés, opacité au minimum, intensité au maximum.
  assert.deepEqual(s.cyclones, { on: true, opacity: 0.1, intensity: 2 });
  // Fenêtre proposée gardée.
  assert.equal(sanitizeAtmosphere({ fires: { windowHours: 6 } }).fires.windowHours, 6);
// Fin du test.
});

// Test : les textes d'aide des incendies.
test('atmosphère : le texte des incendies distingue les points chauds des incendies confirmés', () => {
  // Réponse d'essai : 3 + 2 points chauds, un incendie confirmé, une source en panne.
  const t = fireHint({ cells: { n: [3, 2] }, confirmed: [{}], stale: true });
  // Points chauds non confirmés.
  assert.match(t, /^5 points chauds détectés en 24 h \(non confirmés\)/);
  // Un incendie confirmé, au singulier.
  assert.match(t, /1 incendie confirmé \(anneaux\)/);
  // Péremption signalée.
  assert.match(t, /dernières données connues/);
  // Échec.
  assert.match(fireHint('erreur'), /indisponible/);
// Fin du test.
});

// Test : les textes d'aide des cyclones.
test('atmosphère : le texte des cyclones dit clairement quand aucun cyclone actif n’est confirmé', () => {
  // Aucun cyclone, deux suivis écartés.
  assert.match(cycloneHint({ cyclones: [], excluded: [{}, {}] }), /^Aucun cyclone actif confirmé · 2 suivis écartés \(aucune position récente\)/);
  // Un cyclone : son texte court.
  assert.match(cycloneHint({ cyclones: [{ id: 'a', name: 'Pena', lon: -173, lat: 10, details: { category: 'TS', windKt: 50 } }], excluded: [] }), /^Pena · TS 50 kt \(93 km\/h\)/);
// Fin du test.
});

// Test : les textes d'aide de la foudre.
test('atmosphère : le texte de la foudre dit ce qui est mesuré, et pourquoi rien n’arrive', () => {
  // Sans identifiants : la raison.
  assert.match(lightningHint({ available: false, reason: 'Identifiants Xweather absents' }), /^Identifiants Xweather absents/);
  // Accès refusé par l'API : invitation à vérifier l'abonnement.
  assert.match(lightningHint({ available: true, reason: 'Xweather : access denied' }), /vérifier que l'abonnement inclut la foudre/);
  // Données : nombre, natures, fréquence.
  assert.match(lightningHint({ available: true, reason: null, stats: { count: 12, cg: 9, ic: 3, perMin: 2.4 } }), /^12 impacts en 5 min dans 100 km autour du point visé \(9 nuage-sol, 3 intra-nuage, 2.4\/min\)/);
  // Trop loin : invitation à se rapprocher.
  assert.match(lightningHint(null, true), /rapprochez-vous/);
  // Réglages de la foudre bornés.
  assert.deepEqual(sanitizeAtmosphere({ lightning: { on: true, opacity: 3 } }).lightning, { on: true, opacity: 1, intensity: 1 });
// Fin du test.
});

// Test : le radar et les orages.
test('atmosphère : radar et orages bornés, textes d’aide sur la mesure, l’estimation et la portée des radars', () => {
  // Radar : allumé, opacité ramenée, animation refusée, couverture gardée par défaut.
  assert.deepEqual(sanitizeAtmosphere({ precipitation: { on: true, opacity: 9, animate: false } }).precipitation, { on: true, opacity: 1, intensity: 1, animate: false, coverage: true });
  // Orages : éteints par défaut.
  assert.deepEqual(sanitizeAtmosphere(null).storms, { on: false, opacity: 0.9, intensity: 1 });
  // Plus annoncés « à venir ».
  assert.equal(['Orages', 'Précipitations', 'Radar'].some((n) => ATMOSPHERE_UPCOMING.includes(n)), false);
  // Radar : âge de la dernière image et absence de mesure hors de portée.
  assert.match(precipitationHint({ available: true, ageMin: 7, frames: [{ id: 'abcd', time: '2026-11-15T14:20:00Z' }] }), /il y a 7 min\).*hors de portée des radars.*aucune mesure · Rain Viewer/);
  // Radar indisponible : la raison.
  assert.match(precipitationHint({ available: false, reason: 'HTTP 503' }), /^HTTP 503 · Rain Viewer/);
  // Orages : cellules estimées, fortes, suivies, avertissements dont tornade.
  assert.match(stormHint({ stats: { cells: 12, strong: 3, persistent: 9, warnings: 2, tornado: 1 }, frame: null }), /^12 cellules convectives estimées, dont 3 fortes \(≥ 50 dBZ\) et 9 suivies sur plusieurs images · 2 avertissements officiels en vigueur, dont 1 de tornade/);
  // Aucun avertissement : dit explicitement.
  assert.match(stormHint({ stats: { cells: 1, strong: 0, persistent: 0, warnings: 0 } }), /^1 cellule convective estimée.*aucun avertissement officiel en vigueur/);
// Fin du test.
});

// Test : les aérosols.
test('atmosphère : aérosols bornés, textes d’aide qui distinguent mesure, nature estimée et prévision', () => {
  // Produit inconnu ramené à l'épaisseur optique ; animation gardée par défaut.
  assert.deepEqual(sanitizeAtmosphere({ aerosols: { on: true, product: 'smog', opacity: 0 } }).aerosols, { on: true, opacity: 0.1, intensity: 1, product: 'aod', animate: true });
  // Plus annoncés « à venir ».
  assert.equal(['Aérosols', 'Poussières', 'Fumées'].some((n) => ATMOSPHERE_UPCOMING.includes(n)), false);
  // Réponse d'essai.
  const info = { days: { today: '2026-11-15' }, products: [{ id: 'aod', available: true, measured: { today: 0.31, yesterday: 0.42 } }, { id: 'ai', available: true, measured: { today: 0.5, yesterday: 0.6 } }], plumes: [{ lon: 5, lat: 20, intensity: { value: 1.6 }, details: { aiMax: 2.1 } }], forecast: { available: true, times: ['2026-11-15T12:00:00Z', '2026-11-17T12:00:00Z'] } };
  // Épaisseur optique : parts mesurées, limites, zones et nature estimée.
  assert.match(aerosolHint(info, 'aod'), /^Mesuré aujourd’hui sur 31 % du globe, hier sur 42 % \(aucune mesure sous les nuages, la nuit ni sur la neige\) · 1 zone de forte charge \(AOD ≥ 1\), dont 1 absorbante \(poussières ou fumées, nature estimée\)/);
  // Indice : voit au-dessus des nuages.
  assert.match(aerosolHint(info, 'ai'), /l’indice voit aussi au-dessus des nuages\) · NASA GIBS · OMPS/);
  // Prévision : pas une mesure.
  assert.match(aerosolHint(info, 'dust'), /^Poussières prévues par le modèle CAMS, toutes les 6 h du .* : une prévision, pas une mesure/);
  // Prévision indisponible : la raison.
  assert.match(aerosolHint({ ...info, forecast: { available: false, reason: 'HTTP 403' } }, 'dust'), /^Prévision indisponible \(HTTP 403\)/);
// Fin du test.
});

// Test : les vents.
test('atmosphère : vents bornés, texte d’aide (niveau, vitesse maximale, courants-jets estimés, source)', () => {
  // Niveau inconnu ramené à 250 hPa ; axes gardés par défaut.
  assert.deepEqual(sanitizeAtmosphere({ winds: { on: true, level: '100hPa' } }).winds, { on: true, opacity: 0.85, intensity: 1, level: '250hPa', jets: true });
  // Plus annoncés « à venir ».
  assert.deepEqual(ATMOSPHERE_UPCOMING, ['Pollution gazeuse', 'Brouillard']);
  // Réponse d'essai.
  const info = { available: true, validAt: '2026-11-15T15:00:00.000Z', grid: { width: 2, height: 2, lonStart: -180, lonStep: 180, latStart: -40, latStep: 80 }, levels: [{ id: '250hPa', label: '250 hPa (≈ 10,4 km)', altKm: 10.4, available: true, u: [50, 0, 0, 0], v: [0, 0, 0, 0], maxMs: 61 }], jets: [{ geometry: { coordinates: [[0, 40], [12, 42]] }, intensity: { value: 220 } }] };
  // Texte : niveau, vitesse maximale, courant-jet, source.
  assert.match(windHint(info, '250hPa'), /^250 hPa \(≈ 10,4 km\), vent du modèle à .*, jusqu’à 220 km\/h sur une grille de 12° × 10° · 1 courant-jet \(jusqu’à 220 km\/h, axes estimés\) · Open-Meteo/);
  // Niveau absent : le dire.
  assert.match(windHint(info, '10m'), /^Niveau indisponible/);
// Fin du test.
});
