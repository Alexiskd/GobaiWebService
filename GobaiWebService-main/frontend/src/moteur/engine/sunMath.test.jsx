// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les planètes des données du backend.
import { PLANETS } from '../../../../backend/src/services/data/bodies.data';
// Importe les trois fonctions testées.
import { nextApsides, nextSeasons, sunLive } from './sunMath';

// Les éléments orbitaux de la Terre.
const EARTH = PLANETS.find((p) => p.earth).elements;
// Une heure, en millisecondes.
const H = 3600e3;

/*
 * Les deux instants de référence sont ceux des éphémérides publiées. L'équinoxe de mars 2027 tombe vers
 * 20 h 25 UTC : la version précédente de ce test portait 14 h 25, qui est l'instant de l'équinoxe de **2026**,
 * et seule une tolérance de six heures le laissait passer. Avec les dérives séculaires des éléments d'orbite
 * rétablies et l'échelle de Temps terrestre, le calcul tombe à quelques minutes : la tolérance passe à une heure.
 */

// Test : les prochaines saisons à partir du 9 novembre 2026.
test('Solstice de décembre 2026 (21/12 vers 20 h 50 UTC) et équinoxe de mars 2027 (20/03 vers 20 h 25 UTC)', () => {
  // Calcule les saisons.
  const s = nextSeasons(EARTH, Date.parse('2026-11-09T00:00Z'));
  // La première : le solstice de décembre.
  assert.equal(s[0].name, 'Solstice de décembre');
  // Sa date, à 6 heures près.
  assert.ok(Math.abs(s[0].ms - Date.parse('2026-12-21T20:50Z')) < H, new Date(s[0].ms).toISOString());
  // La deuxième : l'équinoxe de mars.
  assert.equal(s[1].name, 'Équinoxe de mars');
  // Sa date, à 6 heures près.
  assert.ok(Math.abs(s[1].ms - Date.parse('2027-03-20T20:25Z')) < H, new Date(s[1].ms).toISOString());
// Fin du test.
});

// Test : le périhélie et l'aphélie.
test('Périhélie début janvier, aphélie début juillet', () => {
  // Calcule les apsides.
  const a = nextApsides(EARTH, Date.parse('2026-11-09T00:00Z'));
  // Leurs deux dates.
  const p = new Date(a.perihelion.ms), q = new Date(a.aphelion.ms);
  // Périhélie en janvier, le 6 au plus tard.
  assert.equal(p.getUTCMonth(), 0); assert.ok(p.getUTCDate() <= 6, p.toISOString());
  // Aphélie en juillet, le 8 au plus tard.
  assert.equal(q.getUTCMonth(), 6); assert.ok(q.getUTCDate() <= 8, q.toISOString());
  // Distance au périhélie : 0,9833 UA, à 0,001 près.
  assert.ok(Math.abs(a.perihelion.au - 0.9833) < 0.001);
// Fin du test.
});

// Test : les grandeurs en direct.
test('Grandeurs en direct plausibles', () => {
  // Calcule les grandeurs au 9 novembre 2026.
  const l = sunLive(EARTH, Date.parse('2026-11-09T00:00Z'));
  // Distance entre 0,985 et 0,995 UA.
  assert.ok(l.au > 0.985 && l.au < 0.995, String(l.au));
  // Trajet de la lumière entre 490 et 500 secondes.
  assert.ok(l.lightSeconds > 490 && l.lightSeconds < 500);
  // Diamètre apparent entre 32 et 32,6 minutes d'arc.
  assert.ok(l.diameterArcmin > 32 && l.diameterArcmin < 32.6);
// Fin du test.
});
