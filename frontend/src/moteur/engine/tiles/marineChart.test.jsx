// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { colorBand, drawIsobaths, marineMix, mixSea, validMarine } from './marineChart.jsx';

// Les huit paliers de la table du serveur (earth-plan.ts), dans le désordre pour vérifier le tri : distance max,
// niveau max et étape de la carte marine.
const TIERS = [
  // Espace : sans limite, niveau 3, NOAA.
  { id: 'espace', maxKm: null, maxZoom: 3, maxTiles: { desktop: 85, phone: 85 }, details: { marine: 'noaa' } },
  // Rue : 0,4 km, niveau 19, GEBCO.
  { id: 'rue', maxKm: 0.4, maxZoom: 19, maxTiles: { desktop: 280, phone: 210 }, details: { marine: 'gebco' } },
  // Quartier : 3 km, niveau 19, GEBCO.
  { id: 'quartier', maxKm: 3, maxZoom: 19, maxTiles: { desktop: 280, phone: 210 }, details: { marine: 'gebco' } },
  // Ville : 40 km, niveau 17, GEBCO.
  { id: 'ville', maxKm: 40, maxZoom: 17, maxTiles: { desktop: 280, phone: 210 }, details: { marine: 'gebco' } },
  // Région : 400 km, niveau 14, fondu.
  { id: 'region', maxKm: 400, maxZoom: 14, maxTiles: { desktop: 260, phone: 200 }, details: { marine: 'fondu' } },
  // Pays : 2 500 km, niveau 10, fondu.
  { id: 'pays', maxKm: 2500, maxZoom: 10, maxTiles: { desktop: 220, phone: 170 }, details: { marine: 'fondu' } },
  // Continent : 9 000 km, niveau 8, NOAA.
  { id: 'continent', maxKm: 9000, maxZoom: 8, maxTiles: { desktop: 180, phone: 140 }, details: { marine: 'noaa' } },
  // Planète : 120 000 km, niveau 6, NOAA.
  { id: 'planete', maxKm: 120000, maxZoom: 6, maxTiles: { desktop: 120, phone: 100 }, details: { marine: 'noaa' } },
// Fin des paliers.
];

// Carte marine d'essai, comme la table du serveur la sert.
const MARINE = {
  // NOAA, GEBCO, carte plate et masque, jusqu'au niveau 10.
  noaa: { template: '/n/{z}/{x}/{y}', maxZoom: 10 }, gebco: { template: '/g/{z}/{x}/{y}', maxZoom: 10 },
  // Carte plate et masque.
  flat: { template: '/f/{z}/{x}/{y}', maxZoom: 10 }, mask: { template: '/t/{z}/{x}/{y}.png', maxZoom: 10 },
  // Durée du fondu et isobathes.
  fadeMs: 600, isobaths: { bands: 12, strength: 0.45 },
// Fin de la carte marine d'essai.
};

// Test : la table est vérifiée avant usage.
test('carte marine de la table vérifiée', () => {
  // Bien formée : utilisable.
  assert.equal(validMarine(MARINE), true);
  // Sans carte plate, sans fondu, ou avec une force hors bornes : inutilisable.
  assert.deepEqual([validMarine({ ...MARINE, flat: null }), validMarine({ ...MARINE, fadeMs: -1 }), validMarine({ ...MARINE, isobaths: { bands: 12, strength: 2 } }), validMarine(null)], [false, false, false, false]);
// Fin du test.
});

// Test : NOAA vue de l'espace, fondu aux zooms moyens, GEBCO seule avec isobathes aux zooms forts.
test('choix NOAA / GEBCO par niveau, d’après la colonne « marine » des paliers', () => {
  // Niveaux 0 à 8 (espace, planète, continent) : NOAA seule, sans isobathes.
  for (let z = 0; z <= 8; z++) assert.deepEqual(marineMix(TIERS, z), { gebco: 0, isobaths: false }, `niveau ${z}`);
  // Niveaux 9 à 14 (pays, région) : fondu, la part de GEBCO croît strictement, sans isobathes.
  const fade = [9, 10, 11, 12, 13, 14].map((z) => marineMix(TIERS, z));
  // Aucune isobathe pendant le fondu.
  assert.equal(fade.every((m) => !m.isobaths), true);
  // Parts : 1/7 à 6/7 (du dernier niveau NOAA, 8, au premier niveau GEBCO, 15).
  assert.deepEqual(fade.map((m) => Math.round(m.gebco * 7)), [1, 2, 3, 4, 5, 6]);
  // Niveaux 15 à 20 (ville, quartier, rue, et au-delà) : GEBCO seule avec isobathes.
  for (let z = 15; z <= 20; z++) assert.deepEqual(marineMix(TIERS, z), { gebco: 1, isobaths: true }, `niveau ${z}`);
  // Sans paliers : GEBCO seule, sans isobathes (comportement d'avant la table).
  assert.deepEqual(marineMix(null, 5), { gebco: 1, isobaths: false });
// Fin du test.
});

// Test : le fondu suit la table — un autre seuil change le niveau du passage.
test('seuil du fondu lu dans la table', () => {
  // Même table, mais le pays passe en NOAA : le fondu ne couvre plus que la région (niveaux 11 à 14).
  const tiers = TIERS.map((t) => (t.id === 'pays' ? { ...t, details: { marine: 'noaa' } } : t));
  // Niveau 10 : NOAA seule.
  assert.equal(marineMix(tiers, 10).gebco, 0);
  // Niveau 11 : premier niveau du fondu (1/5 : du niveau 10 au niveau 15).
  assert.equal(marineMix(tiers, 11).gebco, 0.2);
// Fin du test.
});

// Test : le mélange des deux images.
test('mélange NOAA et GEBCO pixel par pixel', () => {
  // Un pixel NOAA rouge et un pixel GEBCO bleu.
  const noaa = new Uint8ClampedArray([200, 0, 0, 255]), gebco = new Uint8ClampedArray([0, 0, 100, 255]);
  // Moitié-moitié, dans une sortie à part.
  assert.deepEqual([...mixSea(noaa, gebco, 0.5, new Uint8ClampedArray(4))], [100, 0, 50, 255]);
  // Part 0 : la NOAA ; part 1 : GEBCO.
  assert.deepEqual([[...mixSea(noaa, gebco, 0, new Uint8ClampedArray(4))], [...mixSea(noaa, gebco, 1, new Uint8ClampedArray(4))]], [[200, 0, 0, 255], [0, 0, 100, 255]]);
// Fin du test.
});

// Test : les isobathes suivent les limites de couleur de la carte plate, en pleine mer seulement.
test('isobathes tirées des limites de couleur de la carte plate', () => {
  // Tuile d'essai de 8 × 8 pixels.
  const size = 8;
  // Carte plate : colonnes 0 à 3 claires (peu profond), 4 à 7 sombres (profond).
  const flat = new Uint8ClampedArray(size * size * 4);
  // Pour chaque pixel : gris clair ou sombre selon sa colonne.
  for (let k = 0; k < size * size; k++) { const v = k % size < 4 ? 200 : 40; flat.set([v, v, v, 255], k * 4); }
  // Parts de mer : pleine mer partout, sauf la ligne 0 (côte : part 0,5).
  const mask = new Float32Array(size * size).fill(1);
  // Ligne 0 : côte.
  for (let i = 0; i < size; i++) mask[i] = 0.5;
  // Fonds : gris moyen uniforme.
  const out = new Uint8ClampedArray(size * size * 4).fill(100);
  // Trace les isobathes.
  const drawn = drawIsobaths(out, flat, mask, { bands: 12, strength: 0.5 }, size);
  // Une isobathe par ligne de pleine mer (lignes 1 à 7), sur la colonne 3, juste avant la limite.
  assert.equal(drawn, 7);
  // Ligne 2, colonne 3 : assombrie de moitié.
  assert.equal(out[(2 * size + 3) * 4], 50);
  // Ligne 2, colonne 4 (même bande que son voisin) et ligne 0 (côte) : intactes.
  assert.deepEqual([out[(2 * size + 4) * 4], out[3 * 4]], [100, 100]);
  // Les deux gris sont bien dans deux bandes différentes.
  assert.notEqual(colorBand(200, 200, 200, 12), colorBand(40, 40, 40, 12));
// Fin du test.
});
