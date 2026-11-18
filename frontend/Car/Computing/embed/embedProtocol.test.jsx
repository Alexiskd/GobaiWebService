// Tests du protocole d'embarquement : enveloppes des messages postMessage échangés avec l'hôte.
// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert, avec les comparaisons strictes.
import assert from 'node:assert/strict';
// Importe le protocole testé : constantes, reconnaissance, validation et enveloppes.
import {
  COMMAND_GET_STATE, COMMAND_GO_TO, COMMAND_SET_PLANET, COMMAND_SET_SKY, COMMAND_ZOOM,
  EMBED_SOURCE, EVENT_ERROR, EVENT_PLANET, EVENT_READY, HOST_SOURCE, REPLY_TYPE,
  foldSlug, isCommand, makeEvent, makeReply, normalizeCommand,
} from './embedProtocol.js';

// Premier test : foldSlug retire accents, majuscules et bords, comme focusBySlug du moteur.
test('foldSlug : sans accents, sans majuscules, sans bords', () => {
  // Un nom français tout simple.
  assert.equal(foldSlug('Terre'), 'terre');
  // Une majuscule accentuée, avec des espaces parasites.
  assert.equal(foldSlug('  Île de Pâques  '), 'ile de paques');
  // Valeurs absentes : chaîne vide, jamais d'erreur.
  assert.equal(foldSlug(undefined), '');
  assert.equal(foldSlug(null), '');
// Fin du premier test.
});

// Second test : isCommand reconnaît une commande de l'hôte, et refuse tout le reste.
test('isCommand : forme complète acceptée, hors protocole refusé', () => {
  // Une commande bien formée, avec charge utile.
  assert.ok(isCommand({ source: HOST_SOURCE, id: 'gobai-1', type: COMMAND_SET_PLANET, payload: { slug: 'mars' } }));
  // Une commande sans charge utile (get-state).
  assert.ok(isCommand({ source: HOST_SOURCE, id: 2, type: COMMAND_GET_STATE }));
  // Source inconnue : refuse.
  assert.ok(!isCommand({ source: 'autre', id: 1, type: COMMAND_SET_PLANET }));
  // Marqueur de la page embarquée : refuse (une page ne se commande pas elle-même).
  assert.ok(!isCommand({ source: EMBED_SOURCE, id: 1, type: COMMAND_SET_PLANET, payload: {} }));
  // Type sans préfixe du protocole : refuse.
  assert.ok(!isCommand({ source: HOST_SOURCE, id: 1, type: 'autre:set-planet', payload: {} }));
  // Sans identifiant : refuse (les réponses ne pourraient pas être appariées).
  assert.ok(!isCommand({ source: HOST_SOURCE, type: COMMAND_SET_PLANET, payload: {} }));
  // Valeur constante (chaîne, nombre) : refuse.
  assert.ok(!isCommand('gobai:set-planet'));
  // Sans rien : refuse.
  assert.ok(!isCommand(null));
// Fin du second test.
});

// Troisième test : les charges valides sont normalisées, les invalides sont refusées (null).
test('normalizeCommand : charges valides nettoyées, invalides nulles', () => {
  // set-planet : le slug est requis.
  assert.deepEqual(normalizeCommand(COMMAND_SET_PLANET, { slug: 'mars' }), { slug: 'mars' });
  assert.equal(normalizeCommand(COMMAND_SET_PLANET, { slug: '   ' }), null);
  assert.equal(normalizeCommand(COMMAND_SET_PLANET, {}), null);
  // go-to : longitude et latitude finies requises, altitude optionnelle.
  assert.deepEqual(normalizeCommand(COMMAND_GO_TO, { lon: '2.35', lat: 48.85 }), { lon: 2.35, lat: 48.85, name: '', altitudeM: undefined });
  assert.equal(normalizeCommand(COMMAND_GO_TO, { lon: Number.NaN, lat: 0 }), null);
  assert.equal(normalizeCommand(COMMAND_GO_TO, { lat: 0 }), null);
  // set-sky : booléen strict.
  assert.deepEqual(normalizeCommand(COMMAND_SET_SKY, { visible: true }), { visible: true });
  assert.equal(normalizeCommand(COMMAND_SET_SKY, { visible: 'oui' }), null);
  // zoom : facteur fini strictement positif.
  assert.deepEqual(normalizeCommand(COMMAND_ZOOM, { factor: '0.5' }), { factor: 0.5 });
  assert.equal(normalizeCommand(COMMAND_ZOOM, { factor: 0 }), null);
  assert.equal(normalizeCommand(COMMAND_ZOOM, { factor: -2 }), null);
  // get-state : charge vide.
  assert.deepEqual(normalizeCommand(COMMAND_GET_STATE, {}), {});
  // Commande inconnue : null.
  assert.equal(normalizeCommand('gobai:inconnue', {}), null);
// Fin du troisième test.
});

// Quatrième test : les enveloppes sortantes portent la marque de la page embarquée.
test('makeEvent et makeReply : marqueur de source, charge étalée, identifiant conservé', () => {
  // Un événement de préparation, avec son astre.
  assert.deepEqual(makeEvent(EVENT_READY, { planet: 'terre' }), { source: EMBED_SOURCE, type: EVENT_READY, planet: 'terre' });
  // Un événement sans charge.
  assert.deepEqual(makeEvent(EVENT_PLANET), { source: EMBED_SOURCE, type: EVENT_PLANET });
  // Une réponse d'erreur, avec l'identifiant de la commande d'origine.
  assert.deepEqual(makeReply(REPLY_TYPE, 'gobai-7', { ok: false, message: 'nop' }), { source: EMBED_SOURCE, type: REPLY_TYPE, id: 'gobai-7', ok: false, message: 'nop' });
  // Les quatre constantes d'événement commencent bien par le préfixe du protocole.
  for (const t of [EVENT_READY, EVENT_PLANET, EVENT_ERROR, REPLY_TYPE]) assert.ok(t.startsWith('gobai:'), t);
// Fin du quatrième test.
});
