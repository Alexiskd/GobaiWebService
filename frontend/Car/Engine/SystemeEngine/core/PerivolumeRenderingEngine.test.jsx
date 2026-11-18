import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PerivolumeRenderingEngine } from './PerivolumeRenderingEngine.js';
import { LOAD_STATE } from './PerivolumeManager.js';

// Construit un moteur rattaché à une scène neuve.
function setup() {
  const engine = new PerivolumeRenderingEngine({ THREE });
  const scene = new THREE.Scene();
  engine.attachScene(scene);
  return { engine, scene };
}

test('construction : THREE est requis', () => {
  assert.throws(() => new PerivolumeRenderingEngine({}), TypeError);
});

test('attachScene : la scène est requise', () => {
  const engine = new PerivolumeRenderingEngine({ THREE });
  assert.throws(() => engine.attachScene(null), TypeError);
});

test('register : crée une bulle de verre, un fil de fer et une enveloppe d\'arrière-plan dans la scène', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'system:solar', center: [0, 0, 0], radius: 10, backgroundRadius: 30 });
  assert.equal(scene.children.length, 1);
  const group = scene.children[0];
  assert.equal(group.name, 'perivolume:system:solar');
  assert.equal(group.children.length, 3);
  engine.setState('system:solar', LOAD_STATE.ACTIVE);
  const glass = group.children[0];
  assert.equal(glass.material.transparent, true);
  assert.ok(glass.material.opacity > 0 && glass.material.opacity < 0.5);
  assert.ok(glass.material.transmission > 0);
  assert.equal(glass.material.depthWrite, false);
  const background = group.children[2];
  assert.ok(background.geometry.parameters.radius > glass.geometry.parameters.radius);
});

test('register : la bulle est invisible tant qu\'aucun état n\'a été reçu', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'system:earth', center: [0, 0, 0], radius: 10 });
  assert.equal(scene.children[0].visible, false);
});

test('register : rejette un rayon invalide', () => {
  const { engine } = setup();
  assert.throws(() => engine.register({ id: 'x', radius: 0 }), RangeError);
  assert.throws(() => engine.register({ id: 'x', radius: 10, backgroundRadius: 5 }), RangeError);
});

test('setState : l\'état effectif est exposé dans l\'instantané', () => {
  const { engine } = setup();
  engine.register({ id: 'system:solar', center: [0, 0, 0], radius: 10, backgroundRadius: 30 });
  engine.setState('system:solar', LOAD_STATE.ACTIVE);
  assert.equal(engine.get('system:solar').state, LOAD_STATE.ACTIVE);
  assert.equal(engine.setState('inconnu', LOAD_STATE.ACTIVE), false);
});

test('setState : les opacités suivent l\'état effectif', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'system:solar', center: [0, 0, 0], radius: 10, backgroundRadius: 30 });
  const group = scene.children[0];
  const glass = group.children[0];
  const wire = group.children[1];
  engine.setState('system:solar', LOAD_STATE.ACTIVE);
  const activeOpacity = glass.material.opacity;
  engine.setState('system:solar', LOAD_STATE.BACKGROUND);
  assert.ok(glass.material.opacity < activeOpacity);
  assert.equal(group.visible, true);
  engine.setState('system:solar', LOAD_STATE.UNLOADED);
  assert.equal(group.visible, false);
  assert.ok(wire.material.wireframe);
});

test('sync : applique les états des décisions du SystemManager', () => {
  const { engine } = setup();
  engine.register({ id: 'system:solar', center: [0, 0, 0], radius: 10, backgroundRadius: 30 });
  engine.register({ id: 'system:exemple', center: [100, 0, 0], radius: 10, backgroundRadius: 30 });
  const applied = engine.sync([
    { id: 'system:solar', state: LOAD_STATE.ACTIVE },
    { id: 'system:exemple', state: LOAD_STATE.UNLOADED },
    { id: 'inconnu', state: LOAD_STATE.ACTIVE },
  ]);
  assert.equal(applied, 2);
  assert.equal(engine.get('system:solar').state, LOAD_STATE.ACTIVE);
  assert.equal(engine.get('system:exemple').state, LOAD_STATE.UNLOADED);
});

test('updateCenter : déplace la bulle avec le système', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'system:earth', center: [0, 0, 0], radius: 10 });
  engine.updateCenter('system:earth', [5, 6, 7]);
  assert.deepEqual(engine.get('system:earth').center, [5, 6, 7]);
  assert.equal(scene.children[0].position.x, 5);
  assert.equal(engine.updateCenter('inconnu', [1, 2, 3]), false);
});

test('unregister : retire la bulle de la scène', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'system:solar', center: [0, 0, 0], radius: 10 });
  assert.equal(engine.unregister('system:solar'), true);
  assert.equal(scene.children.length, 0);
  assert.equal(engine.get('system:solar'), null);
  assert.equal(engine.unregister('system:solar'), false);
});

test('stats et clear : comptage par état puis vidage complet', () => {
  const { engine, scene } = setup();
  engine.register({ id: 'a', center: [0, 0, 0], radius: 1 });
  engine.register({ id: 'b', center: [9, 0, 0], radius: 1 });
  engine.setState('a', LOAD_STATE.ACTIVE);
  assert.deepEqual(engine.stats(), { count: 2, byState: { ACTIVE: 1, BACKGROUND: 0, UNLOADED: 1 } });
  engine.clear();
  assert.deepEqual(engine.stats(), { count: 0, byState: { ACTIVE: 0, BACKGROUND: 0, UNLOADED: 0 } });
  assert.equal(scene.children.length, 0);
});

// Fin du test du moteur de rendu des périverolumes.
