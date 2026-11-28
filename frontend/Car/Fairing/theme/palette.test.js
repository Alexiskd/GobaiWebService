// Tests de la palette Orbite : contrastes et accord avec les variables CSS d'app.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAY, NIGHT, TEXT_TOKENS, contrast } from './palette.js';

// Variables d'un bloc CSS : { nom: valeur }.
const vars = (block) => Object.fromEntries([...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
const night = vars(css.slice(css.indexOf('@theme static'), css.indexOf('@layer base')));
const day = vars(css.slice(css.indexOf(':root[data-theme="day"]'), css.indexOf(':root { color-scheme: dark; }')));

test('contrastes : chaque jeton de texte ≥ 4,5 : 1 sur son panneau, dans les deux thèmes', () => {
  for (const [name, t] of [['nuit', NIGHT], ['jour', DAY]]) for (const k of TEXT_TOKENS) {
    assert.ok(contrast(t[k], t.panel) >= 4.5, `${name} ${k} : ${contrast(t[k], t.panel).toFixed(2)}`);
  }
});

test('CSS : les variables d’app.css sont celles de la palette', () => {
  const pairs = { panel: 'panel', raised: 'raised', ink: 'ink', soft: 'soft', faint: 'faint', primary: 'primary', 'primary-light': 'primaryLight', 'primary-dark': 'primaryDark', 'on-primary': 'onPrimary', gold: 'gold', coral: 'coral', violet: 'violet', success: 'green', info: 'cyan' };
  for (const [cssName, key] of Object.entries(pairs)) {
    assert.equal(night[cssName], NIGHT[key], `nuit --color-${cssName}`);
    assert.equal(day[cssName], DAY[key], `jour --color-${cssName}`);
  }
});
