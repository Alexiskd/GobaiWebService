// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe les zones du téléphone.
import { HUD_BOTTOM, HUD_TOP, freeZoneTop } from './layout.jsx';
// Importe les marges de sécurité.
import { safe } from './mediaQueries.jsx';

// Test : marges de sécurité.
test('marge de sécurité : celle du système, ou la variable --safe-* si elle est posée', () => {
  // Variable d'abord, système ensuite, 0 par défaut.
  assert.equal(safe('top'), 'var(--safe-top, env(safe-area-inset-top, 0px))');
// Fin du test.
});

// Test : zones mesurées.
test('zones du téléphone : variables mesurées, avec une valeur de repli marge de sécurité comprise', () => {
  // Haut : --hud-top, sinon marge du haut + 64 px.
  assert.equal(HUD_TOP, 'var(--hud-top, calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 64px))');
  // Bas : --hud-bottom, sinon marge du bas + 60 px.
  assert.equal(HUD_BOTTOM, 'var(--hud-bottom, calc(var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 60px))');
  // Placement centré dans la zone libre, jamais au-dessus de la zone du titre.
  const top = freeZoneTop(120);
  // Borne basse : 8 px sous la zone du titre.
  assert.ok(top.startsWith(`max(calc(${HUD_TOP} + 8px)`));
  // Centrage : la place libre moins la hauteur, divisée par deux.
  assert.ok(top.includes(`(100dvh - ${HUD_TOP} - ${HUD_BOTTOM} - 120px) / 2`));
// Fin du test.
});
