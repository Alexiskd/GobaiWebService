// Tests du style unique des calques.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LABELS, LINES, hexNumber, labelFont, labelText, moonCountryColor } from './astre-solide.style.js';
import { MAP_GRAYS, NIGHT } from '../../Fairing/theme/palette.js';

test('style : couleurs de la palette, trois tailles de noms, pays en majuscules espacées', () => {
  // Frontières et littoraux en gris (noir et blanc), littoraux plus discrets que les frontières.
  assert.equal(LINES.border.color, MAP_GRAYS.g80); assert.equal(LINES.coast.color, MAP_GRAYS.g50); assert.ok(LINES.coast.alpha < LINES.border.alpha);
  // Tailles : pays > grands noms > petits noms.
  assert.ok(LABELS.country.size > LABELS.major.size && LABELS.major.size > LABELS.minor.size);
  assert.match(labelFont('minor'), /11px "Google Sans"/);
  // Pays : majuscules espacées ; autres : tels quels.
  assert.equal(labelText('Lune', 'country'), 'L U N E'); assert.equal(labelText('Paris', 'major'), 'Paris');
  // Couleur d'un pays lunaire, bleu de la marque par défaut.
  assert.equal(moonCountryColor('lunovie'), NIGHT.coral); assert.equal(moonCountryColor('?'), NIGHT.primary);
  assert.equal(hexNumber('#e8c46a'), 0xe8c46a);
});
