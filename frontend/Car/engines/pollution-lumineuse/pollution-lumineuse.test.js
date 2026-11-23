// Tests de l'engine pollution-lumineuse (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicUv, nightAmount } from './pollution-lumineuse.math.js';
import { pollutionFragmentShader } from './pollution-lumineuse.shader.js';
import { LightPollutionLayer, POLLUTION_LAYER, POLLUTION_RENDER_ORDER, POLLUTION_SHELL_RADIUS } from './pollution-lumineuse.layer.js';
import * as THREE from 'three';

test('mosaïque : longitude 0 et équateur au centre, nord en haut, bornée au Web Mercator', () => {
  // Longitude 0, latitude 0 : centre.
  const c = mosaicUv([1, 0, 0]);
  assert.ok(Math.abs(c.u - 0.5) < 1e-12 && Math.abs(c.v - 0.5) < 1e-12);
  // Longitude 90° est (−z dans le repère des tuiles) : u = 0,75.
  assert.ok(Math.abs(mosaicUv([0, 0, -1]).u - 0.75) < 1e-12);
  // Pôle Nord : haut de l'image (v = 0), sans infini.
  assert.ok(Math.abs(mosaicUv([0, 1, 0]).v) < 1e-9);
  // Paris (48,85° N) : dans la moitié nord.
  const lat = (48.85 * Math.PI) / 180;
  assert.ok(mosaicUv([Math.cos(lat), Math.sin(lat), 0]).v < 0.5);
});

test('nuit : jour sans lumière, nuit noire pleine, crépuscule entre les deux, vue de nuit partout', () => {
  assert.equal(nightAmount(0.5), 0);
  assert.equal(nightAmount(-0.5), 1);
  const t = nightAmount(-0.035);
  assert.ok(t > 0.3 && t < 0.7);
  assert.equal(nightAmount(0.9, 1), 1);
});

test('shader : même crépuscule, lumière coupée sans ombre ni interrupteur', () => {
  assert.match(pollutionFragmentShader, /smoothstep\(\.05,-\.12,c\)/);
  assert.match(pollutionFragmentShader, /if\(lightsOn<\.5\|\|lgOn<\.5\)\{discard;\}/);
  assert.match(pollutionFragmentShader, /lightView>\.5\?1\.:shade/);
});

test('couche : coque sous les nuages, sur son propre calque, dessinée avant l\'atmosphère, variables partagées', () => {
  // Repère des tuiles et variables des tuiles (faux).
  const root = new THREE.Object3D();
  const uniforms = { lgMap: { value: null }, lgOn: { value: 1 }, lightsOn: { value: 1 }, lightView: { value: 0 }, ltLinear: { value: 0 } };
  const layer = new LightPollutionLayer({ root, uniforms });
  // Rattachée au repère, au-dessus du sol de 3 km.
  assert.equal(layer.mesh.parent, root);
  assert.ok(POLLUTION_SHELL_RADIUS > 1 && POLLUTION_SHELL_RADIUS < 1.001);
  // Seulement sur son calque (pas le calque 0 de la scène).
  const scene = new THREE.Layers();
  assert.equal(layer.mesh.layers.test(scene), false);
  const own = new THREE.Layers(); own.set(POLLUTION_LAYER);
  assert.equal(layer.mesh.layers.test(own), true);
  // Avant l'atmosphère et les nuages.
  assert.ok(layer.mesh.renderOrder < 0 && layer.mesh.renderOrder === POLLUTION_RENDER_ORDER);
  // Mêmes objets que les tuiles : l'interrupteur des lumières suit.
  assert.equal(layer.uniforms.lightsOn, uniforms.lightsOn);
  // Soleil et ombre.
  layer.update([0, 1, 0], 0.4);
  assert.deepEqual(layer.uniforms.sunDir.value.toArray(), [0, 1, 0]);
  assert.equal(layer.uniforms.shade.value, 0.4);
  // Libération.
  layer.dispose();
  assert.equal(root.children.length, 0);
});
