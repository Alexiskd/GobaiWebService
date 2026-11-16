// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les deux fonctions testées.
import { LAYER_INFO_MAX_AGE_MS, LAYER_INFO_PREFIX, readLayerInfo, saveLayerInfo } from './layerInfoCache';
// Importe worldOrigins, les serveurs des images du monde.
import { worldOrigins } from './earthDirect';

// memory : fabrique un faux stockage en mémoire (début).
const memory = () => {
  // Sa table.
  const map = new Map();
  // Renvoie la lecture, l'écriture et l'accès direct à la table.
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, map };
// Fin de memory.
};
// Plan de chargement direct d'essai (début).
const DIRECT = [
  // Une source régionale, limitée à une zone et aux niveaux 12 à 19.
  { id: 'ch', minZoom: 12, maxZoom: 19, bboxes: [[5.9, 45.8, 10.5, 47.85]], templates: ['https://wmts.geo.admin.ch/{z}/{x}/{y}.jpeg'] },
  // Une source mondiale, avec trois modèles d'adresse sur deux serveurs.
  { id: 'sentinel2', minZoom: 0, maxZoom: 14, templates: ['https://a.tiles.example/{z}/{y}/{x}.jpg', 'https://b.tiles.example/{z}/{y}/{x}.jpg', 'https://a.tiles.example/autre/{z}/{y}/{x}.jpg'] },
  // Une source relayée, sans modèle d'adresse.
  { id: 'relais', minZoom: 0, maxZoom: 8 },
// Fin du plan.
];
// info : fabrique une description de couche d'essai, complétée au besoin.
const info = (extra = {}) => ({ id: 'earth-hd', urlTemplate: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}', maxZoom: 19, direct: DIRECT, ...extra });

// Test : garder puis relire une description.
test('description de couche : gardée puis relue telle quelle à la visite suivante', () => {
  // Un stockage vide.
  const storage = memory();
  // Rien à lire au départ.
  assert.equal(readLayerInfo(storage, 'earth-hd', 1000), null);
  // L'enregistrement réussit.
  assert.equal(saveLayerInfo(storage, 'earth-hd', info(), 1000), true);
  // L'entrée est bien dans le stockage.
  assert.ok(storage.map.has(`${LAYER_INFO_PREFIX}earth-hd`));
  // La relecture rend la même description.
  assert.deepEqual(readLayerInfo(storage, 'earth-hd', 5000), info());
  // Une autre couche : rien.
  assert.equal(readLayerInfo(storage, 'autre', 5000), null);
// Fin du test.
});

// Test : les refus.
test('description de couche : refusée si trop ancienne, expirée, illisible ou sans chargement direct', () => {
  // Un stockage vide.
  const storage = memory();
  // Enregistre une description.
  saveLayerInfo(storage, 'earth-hd', info(), 1000);
  // Plus d'un jour après : refusée.
  assert.equal(readLayerInfo(storage, 'earth-hd', 1000 + LAYER_INFO_MAX_AGE_MS + 1), null, 'plus d’un jour');
  // Avant la date d'enregistrement : refusée.
  assert.equal(readLayerInfo(storage, 'earth-hd', 500), null, 'horloge reculée');
  // Une date d'essai.
  const at = Date.parse('2026-11-12T10:00:00Z');
  // Enregistre une description qui expire une heure plus tard.
  saveLayerInfo(storage, 'jeton', info({ expiresAt: '2026-11-12T11:00:00Z' }), at);
  // Une demi-heure après : acceptée.
  assert.ok(readLayerInfo(storage, 'jeton', at + 30 * 60_000));
  // Trente secondes avant l'expiration : refusée.
  assert.equal(readLayerInfo(storage, 'jeton', at + 59.5 * 60_000), null, 'expire dans moins d’une minute');
  // Couche sans plan direct : non enregistrée.
  assert.equal(saveLayerInfo(storage, 'relais', { urlTemplate: '/x/{z}/{x}/{y}' }, 1000), false, 'couche relayée : pas gardée');
  // Écrit une entrée abîmée.
  storage.setItem(`${LAYER_INFO_PREFIX}abime`, '{pas du json');
  // Elle est illisible : refusée.
  assert.equal(readLayerInfo(storage, 'abime', 1000), null);
  // Sans stockage : rien à lire.
  assert.equal(readLayerInfo(null, 'earth-hd', 1000), null);
  // Sans stockage : rien n'est enregistré.
  assert.equal(saveLayerInfo(null, 'earth-hd', info(), 1000), false);
  // Stockage plein : rien n'est enregistré.
  assert.equal(saveLayerInfo({ setItem() { throw new Error('quota'); } }, 'earth-hd', info(), 1000), false);
// Fin du test.
});

// Test : les serveurs des images du monde.
test('connexion d’avance : serveurs des images du monde seulement, sans doublon', () => {
  // Les deux serveurs de la source mondiale, sans doublon.
  assert.deepEqual(worldOrigins(DIRECT), ['https://a.tiles.example', 'https://b.tiles.example']);
  // Limité à un seul serveur.
  assert.deepEqual(worldOrigins(DIRECT, 1), ['https://a.tiles.example']);
  // Adresse relative : aucun serveur.
  assert.deepEqual(worldOrigins([{ id: 'x', minZoom: 0, maxZoom: 3, templates: ['/relatif/{z}'] }]), []);
  // Sans plan : aucun serveur.
  assert.deepEqual(worldOrigins(null), []);
// Fin du test.
});
