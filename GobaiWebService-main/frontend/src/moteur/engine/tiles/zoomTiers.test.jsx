// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { MIN_BUDGET, keptKeys, offFieldKeys, tierFor, tileBudget, validTiers, withinBudget } from './zoomTiers.jsx';
// Importe la sélection des tuiles du champ de la caméra.
import { selectTiles } from './quadtree.jsx';
// Importe la conversion d'une position et la clé d'une tuile.
import { lonLatToXYZ, tileKey, xyzToLonLat } from './mercator.jsx';

// Paliers d'essai, comme la table du serveur les sert (dans le désordre, pour vérifier le tri).
const TIERS = [
  // Espace : sans limite, niveau 3.
  { id: 'espace', maxKm: null, maxZoom: 3, maxTiles: { desktop: 85, phone: 85 }, details: { marine: 'gebco' } },
  // Rue : jusqu'à 0,4 km, niveau 19.
  { id: 'rue', maxKm: 0.4, maxZoom: 19, maxTiles: { desktop: 280, phone: 210 }, details: { marine: 'noaa' } },
  // Ville : jusqu'à 40 km, niveau 17.
  { id: 'ville', maxKm: 40, maxZoom: 17, maxTiles: { desktop: 280, phone: 210 }, details: { marine: 'noaa' } },
  // Pays : jusqu'à 2 500 km, niveau 10.
  { id: 'pays', maxKm: 2500, maxZoom: 10, maxTiles: { desktop: 220, phone: 170 }, details: { marine: 'fondu' } },
// Fin des paliers.
];

// Test : le palier suit la distance affichée en km.
test('palier choisi d’après la distance en km', () => {
  // Les paliers d'essai sont utilisables, une liste vide ou mal formée non.
  assert.deepEqual([validTiers(TIERS), validTiers([]), validTiers([{ id: 'x', maxKm: 1 }])], [true, false, false]);
  // 0,2 km : la rue ; 0,4 km : encore la rue.
  assert.deepEqual([tierFor(TIERS, 0.2).id, tierFor(TIERS, 0.4).id], ['rue', 'rue']);
  // 12 km : la ville ; 900 km : le pays ; 30 000 km : l'espace.
  assert.deepEqual([tierFor(TIERS, 12).id, tierFor(TIERS, 900).id, tierFor(TIERS, 30_000).id], ['ville', 'pays', 'espace']);
  // Sans paliers ou sans distance : aucun palier.
  assert.deepEqual([tierFor(null, 10), tierFor(TIERS, NaN)], [null, null]);
// Fin du test.
});

// Test : le budget dépend de l'appareil et du mode économie d'énergie.
test('budget de tuiles par appareil et en économie d’énergie', () => {
  // Palier « ville ».
  const ville = tierFor(TIERS, 12);
  // Ordinateur, téléphone, téléphone en économie d'énergie (60 %).
  assert.deepEqual([tileBudget(ville), tileBudget(ville, { handheld: true }), tileBudget(ville, { handheld: true, saving: true })], [280, 210, 126]);
  // Jamais sous le minimum, même dans l'espace en économie d'énergie.
  assert.equal(tileBudget(tierFor(TIERS, 50_000), { saving: true }), MIN_BUDGET);
  // Sans palier : aucune limite.
  assert.equal(tileBudget(null), Infinity);
// Fin du test.
});

// Test : seules les tuiles du champ de la caméra sont demandées, et les autres sont déchargées.
test('aucune requête hors champ, tuiles hors champ déchargées', () => {
  // Champ de 45°, écran de 1 000 px.
  const FOV = (45 * Math.PI) / 180;
  // Caméra à 800 km au-dessus de Paris.
  const cam = lonLatToXYZ(2.35, 48.85, 1 + 800 / 6371);
  // Direction de Paris.
  const dir = lonLatToXYZ(2.35, 48.85);
  // Champ de la caméra : les tuiles à moins de 0,12 rad (≈ 760 km) de la verticale.
  const inFrustum = (c, r) => Math.acos(Math.min(1, c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2])) < 0.12 + r;
  // Tuiles du champ, jusqu'au niveau du palier « pays ».
  const field = selectTiles({ cam, fovY: FOV, viewportH: 1000, inFrustum }, { maxZoom: tierFor(TIERS, 800).maxZoom });
  // Demandes : les tuiles du champ, dans le budget du téléphone.
  const asked = withinBudget(field.map((t) => ({ ...t, p: t.d })), tileBudget(tierFor(TIERS, 800), { handheld: true }));
  // Il y a des demandes, dans le budget.
  assert.ok(asked.length > 0 && asked.length <= 170);
  // Aucune demande à plus de 30° de Paris (le champ fait ≈ 7°) : rien hors champ.
  for (const t of asked) {
    // Centre de la tuile, en longitude et latitude.
    const [lo, la] = xyzToLonLat(t.c);
    // À moins de 30° de Paris en longitude et en latitude.
    assert.ok(Math.abs(lo - 2.35) < 30 && Math.abs(la - 48.85) < 30, `tuile ${t.z}/${t.x}/${t.y} hors champ`);
  // Fin de la boucle.
  }
  // Tuiles en mémoire graphique : celles du champ, plus deux tuiles du Pacifique vues avant.
  const loaded = [...asked.map((t) => tileKey(t.z, t.x, t.y)), '8/5/120', '8/6/120'];
  // À décharger : les deux tuiles du Pacifique seulement (ni gardées, ni épinglées).
  assert.deepEqual(offFieldKeys(loaded, keptKeys(asked)), ['8/5/120', '8/6/120']);
  // Une tuile épinglée (mosaïque instantanée) n'est jamais déchargée.
  assert.deepEqual(offFieldKeys(['2/0/1'], new Set(), new Set(['2/0/1'])), []);
// Fin du test.
});

// Test : le budget garde les tuiles les plus prioritaires, et les ancêtres restent gardés.
test('budget : les plus prioritaires d’abord, ancêtres gardés', () => {
  // Quatre tuiles de priorités 3, 1, 4 et 2.
  const wanted = [{ z: 5, x: 1, y: 1, p: 3 }, { z: 5, x: 2, y: 1, p: 1 }, { z: 5, x: 3, y: 1, p: 4 }, { z: 5, x: 4, y: 1, p: 2 }];
  // Budget de 2 : les priorités 1 et 2.
  assert.deepEqual(withinBudget(wanted, 2).map((t) => t.p), [1, 2]);
  // Dans le budget : la liste telle quelle.
  assert.equal(withinBudget(wanted, 10), wanted);
  // Ancêtres gardés de 5/2/1 sur deux niveaux : 5/2/1, 4/1/0, 3/0/0.
  assert.deepEqual([...keptKeys([{ z: 5, x: 2, y: 1 }], 2)], ['5/2/1', '4/1/0', '3/0/0']);
// Fin du test.
});
