// Fondus des cellules hexagonales (hexDisplay.jsx). Lancer : npm test.
// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la durée d'un fondu, sa courbe et la classe d'affichage des cellules, depuis hexDisplay.
import { FADE_MS, fadeEase, HexDisplay } from './hexDisplay';
// Importe cellKeyOf, la clé de la cellule d'un point, depuis hexCells.
import { cellKeyOf } from './hexCells';
// Importe la conversion longitude/latitude vers un point de la sphère et la clé d'une tuile, depuis mercator.
import { lonLatToXYZ, tileKey } from './mercator';
// Importe MERCATOR, la projection, depuis projection.
import { MERCATOR } from './projection';

/** Couche factice : toutes les images des niveaux 0 à `maxZoom` sont prêtes. */
// fakeLayer : fausse couche de tuiles, jusqu'au niveau 6 par défaut (début).
function fakeLayer(maxZoom = 6) {
  // Table des images déjà fabriquées.
  const entries = new Map();
  // Ensemble des maillages ajoutés au groupe.
  const meshes = new Set();
  // Renvoie la fausse couche (début).
  return {
    // Ses réglages : projection, pas de relief, envois par image, variables uniformes, écart et niveau maximal.
    projection: MERCATOR, reliefWanted: false, uploadsPerFrame: 8, uniforms: {}, gap: 1e-6, maxZoom,
    // Sa source, dont le niveau minimal est 0.
    source: { minZoom: 0 },
    // Son groupe : ajouter et retirer un maillage met à jour l'ensemble.
    group: { add: (m) => meshes.add(m), remove: (m) => meshes.delete(m) },
    // L'ensemble des maillages.
    meshes,
    // ready : renvoie l'image prête d'une clé (début).
    ready(key) {
      // Image déjà fabriquée.
      let e = entries.get(key);
      // Sinon (début).
      if (!e) {
        // Niveau, colonne et ligne lus dans la clé.
        const [z, x, y] = key.split('/').map(Number);
        // Au-delà du niveau maximal : aucune image.
        if (z > maxZoom) return null;
        // Faux matériau, avec une opacité de 1 et des shaders vides.
        const material = { uniforms: { alpha: { value: 1 } }, vertexShader: 'void main(){}', fragmentShader: 'void main(){}', extensions: {}, side: 2 };
        // Fausse image : sa clé, ses coordonnées et un maillage qui porte le matériau.
        e = { key: tileKey(z, x, y), z, x, y, mesh: { material } };
        // La range dans la table.
        entries.set(key, e);
      // Fin de ce cas.
      }
      // Renvoie l'image.
      return e;
    // Fin de ready.
    },
  // Fin de la fausse couche.
  };
// Fin de fakeLayer.
}
// viewAt : vue au-dessus de Paris à une altitude donnée, en rayons.
const viewAt = (alt) => ({ cam: lonLatToXYZ(2.35, 48.85).map((c) => c * (1 + alt)), fovY: 0.8, viewportH: 900 });
// Options de sélection : niveaux 0 à 6, projection de Mercator, tuiles de 256 pixels, erreur de 2 pixels.
const OPTS = { minZoom: 0, maxZoom: 6, projection: MERCATOR, tileSize: 256, maxSSE: 2 };

/** Avance les fondus image par image (16 ms) jusqu'à la fin ; `each` est appelé à chaque image. */
// run : fait avancer les fondus image par image (début).
function run(hex, from, each) {
  // Instant de départ.
  let now = from;
  // Tant que des fondus sont en cours, 200 images au plus : appelle la fonction reçue et avance de 16 ms.
  for (let i = 0; i < 200 && hex.animate(now); i++) { each?.(); now += 16; }
  // Renvoie l'instant final.
  return now;
// Fin de run.
}

// Test : la courbe du fondu.
test('fondu : courbe douce, de 0 à 1, sans à-coup aux extrémités', () => {
  // À 0 : 0.
  assert.equal(fadeEase(0), 0);
  // À 1 : 1.
  assert.equal(fadeEase(1), 1);
  // À 0,5 : 0,5.
  assert.equal(fadeEase(0.5), 0.5);
  // Plus lente que la droite près de 0, plus haute près de 1.
  assert.ok(fadeEase(0.05) < 0.05 && fadeEase(0.95) > 0.95);
// Fin du test.
});

// Test : le fondu pendant un zoom avant.
test('fondu : zoom avant, la nouvelle image monte en fondu par-dessus l’ancienne qui reste dessous', () => {
  // Fausse couche.
  const layer = fakeLayer();
  // Affichage des cellules sur cette couche.
  const hex = new HexDisplay(layer);
  // Durée normale du fondu.
  hex.fadeMs = FADE_MS;
  // Sélection des cellules pour une vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage à l'instant 0.
  hex.show(0);
  // Laisse finir les fondus.
  let now = run(hex, 0);
  // Plus aucun fondu en cours.
  assert.equal(hex.active.size, 0);
  // Copie des paires affichées.
  const before = [...hex.shown];
  // Il y en a au moins une.
  assert.ok(before.length > 0);
  // Chacune est visible, avec son matériau opaque d'origine.
  for (const p of before) { assert.ok(p.mesh.visible); assert.equal(p.mesh.material, p.base, 'opaque au repos'); }

  // Sélection pour une vue proche.
  hex.select(viewAt(0.05), OPTS);
  // Affichage à l'instant atteint.
  hex.show(now);
  // Paires qui entrent.
  const entering = hex.shown.filter((p) => !before.includes(p));
  // Paires qui sortent.
  const leaving = before.filter((p) => !hex.shown.includes(p));
  // Il y en a des deux sortes.
  assert.ok(entering.length > 0 && leaving.length > 0);
  // Pour chaque paire qui entre (début).
  for (const p of entering) {
    // Son fondu est en mode « in ».
    assert.equal(p.fx.mode, 'in');
    // Son matériau est transparent.
    assert.ok(p.mesh.material.transparent);
    // Son opacité part de 0.
    assert.equal(p.mesh.material.uniforms.alpha.value, 0, 'part de transparent');
    // Son opacité est une variable distincte de celle du matériau d'origine.
    assert.notEqual(p.mesh.material.uniforms.alpha, p.base.uniforms.alpha, 'opacité propre à la paire');
  // Fin de la boucle.
  }
  // Tant qu'un fondu entrant n'est pas fini, ce qui était à l'écran y reste (pas de trou, pas d'éclair).
  // Dernière opacité vue et nombre d'images.
  let last = -1, frames = 0;
  // Laisse finir les fondus, en contrôlant chaque image (début).
  now = run(hex, now, () => {
    // Une image de plus.
    frames++;
    // Paires qui entrent et sont encore en fondu.
    const fading = entering.filter((p) => p.fx);
    // Tant qu'il y en a : toutes les paires qui sortent sont encore visibles.
    if (fading.length) for (const p of leaving) assert.ok(p.mesh.visible, 'ancienne image encore dessous');
    // Opacité de la première paire qui entre, ou 1 une fois son fondu fini.
    const a = entering[0].fx ? entering[0].mesh.material.uniforms.alpha.value : 1;
    // Elle ne diminue jamais.
    assert.ok(a >= last, 'opacité croissante');
    // La mémorise.
    last = a;
  // Fin du contrôle.
  });
  // Le fondu a duré au moins sa durée normale, à une image près.
  assert.ok(frames >= FADE_MS / 16 - 1, `fondu étalé sur ${frames} images`);
  // Les paires entrées n'ont plus de fondu, ont retrouvé leur matériau d'origine et sont visibles.
  for (const p of entering) { assert.equal(p.fx, null); assert.equal(p.mesh.material, p.base); assert.ok(p.mesh.visible); }
  // Les paires sorties sont masquées.
  for (const p of leaving) assert.equal(p.mesh.visible, false);
// Fin du test.
});

// Test : le fondu pendant un zoom arrière.
test('fondu : zoom arrière, les petites cellules s’effacent par-dessus la grande posée d’un coup', () => {
  // Fausse couche.
  const layer = fakeLayer();
  // Affichage des cellules.
  const hex = new HexDisplay(layer);
  // Durée normale du fondu.
  hex.fadeMs = FADE_MS;
  // Sélection pour une vue proche.
  hex.select(viewAt(0.05), OPTS);
  // Affichage à l'instant 0.
  hex.show(0);
  // Laisse finir les fondus.
  let now = run(hex, 0);
  // Copie des paires affichées.
  const before = [...hex.shown];

  // Sélection pour une vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage à l'instant atteint.
  hex.show(now);
  // Paires qui sortent.
  const leaving = before.filter((p) => !hex.shown.includes(p));
  // Celles dont le fondu est en mode « out ».
  const out = leaving.filter((p) => p.fx?.mode === 'out');
  // Il y en a.
  assert.ok(out.length > 0, 'des cellules fines s’effacent en fondu');
  // Leur opacité part de 1.
  for (const p of out) assert.equal(p.mesh.material.uniforms.alpha.value, 1, 'part d’opaque');
  // Paires affichées situées sous une paire qui s'efface.
  const under = hex.shown.filter((p) => out.some((q) => q.over === p.cellKey));
  // Il y en a.
  assert.ok(under.length > 0);
  // Elles n'ont pas de fondu et sont visibles.
  for (const p of under) { assert.equal(p.fx, null, 'la grande cellule est opaque tout de suite'); assert.ok(p.mesh.visible); }
  // Laisse finir les fondus.
  run(hex, now);
  // Plus aucun fondu en cours.
  assert.equal(hex.active.size, 0);
  // Les paires sorties sont masquées.
  for (const p of leaving) assert.equal(p.mesh.visible, false);
  // Les paires affichées sont visibles, avec leur matériau d'origine.
  for (const p of hex.shown) { assert.ok(p.mesh.visible); assert.equal(p.mesh.material, p.base); }
// Fin du test.
});

// Test : le demi-tour pendant un fondu.
test('fondu : demi-tour en cours de route, on repart de l’opacité atteinte ; images en retard sans saut', () => {
  // Fausse couche.
  const layer = fakeLayer();
  // Affichage des cellules.
  const hex = new HexDisplay(layer);
  // Durée normale du fondu.
  hex.fadeMs = FADE_MS;
  // Sélection pour une vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage à l'instant 0.
  hex.show(0);
  // Laisse finir les fondus.
  let now = run(hex, 0);
  // Sélection pour une vue proche.
  hex.select(viewAt(0.05), OPTS);
  // Affichage à l'instant atteint.
  hex.show(now);
  // Paires en fondu entrant.
  const entering = hex.shown.filter((p) => p.fx?.mode === 'in');
  // Huit images de 16 ms.
  for (let i = 0; i < 8; i++) { now += 16; hex.animate(now); }
  // Avancement du premier fondu.
  const mid = entering[0].fx.t;
  // Il est entre 0,2 et 0,8.
  assert.ok(mid > 0.2 && mid < 0.8);
  // Une image très en retard (2 s) n'avance le fondu que d'un pas borné.
  // Deux secondes passent d'un coup.
  now += 2000;
  // Une image est animée.
  hex.animate(now);
  // Le fondu n'est pas terminé.
  assert.ok(entering[0].fx && entering[0].fx.t < 1);
  // Avancement atteint.
  const reached = entering[0].fx.t;
  // Sélection de nouveau pour la vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage.
  hex.show(now);
  // Le fondu est passé en mode « out ».
  assert.equal(entering[0].fx.mode, 'out');
  // Son avancement n'a pas changé.
  assert.equal(entering[0].fx.t, reached, 'pas de saut au demi-tour');
  // Laisse finir les fondus.
  run(hex, now);
  // Plus aucun fondu en cours.
  assert.equal(hex.active.size, 0);
  // Les paires affichées sont visibles, avec leur matériau d'origine.
  for (const p of hex.shown) { assert.ok(p.mesh.visible); assert.equal(p.mesh.material, p.base); }
  // Aucun maillage visible en dehors de l'affichage voulu.
  // Tout maillage visible appartient à une paire affichée.
  for (const m of layer.meshes) if (m.visible) assert.ok(hex.shown.some((p) => p.mesh === m));
// Fin du test.
});

// Test : le zoom continu.
test('fondu : zoom continu, toujours une image opaque sous celles qui apparaissent, et aucun plan partagé', () => {
  // Fausse couche.
  const layer = fakeLayer();
  // Affichage des cellules.
  const hex = new HexDisplay(layer);
  // Durée normale du fondu.
  hex.fadeMs = FADE_MS;
  // Sélection pour une vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage à l'instant 0.
  hex.show(0);
  // Laisse finir les fondus.
  let now = run(hex, 0);
  // opaque : vrai pour une paire visible sans fondu, ou en mode « hold ».
  const opaque = (p) => p.mesh.visible && (!p.fx || p.fx.mode === 'hold');
  // check : contrôle l'état de l'affichage (début).
  const check = (label) => {
    // Maillages visibles de la couche.
    const visible = [...layer.meshes].filter((m) => m.visible);
    // Paires dont le maillage est visible.
    const pairs = [...hex.pairs.values()].filter((p) => p.mesh && p.mesh.visible);
    // Autant de maillages visibles que de paires visibles.
    assert.equal(visible.length, pairs.length);
    // Chaque cellule voulue a sous elle une image opaque : la sienne, ou celle d'une cellule plus grande qui la contient.
    // Pour chaque cellule voulue (début).
    for (const cell of hex.cells) {
      // Cherche une paire opaque, de cellule aussi grande ou plus grande, qui contient son centre.
      const ok = pairs.some((p) => opaque(p) && p.f <= cell.f && cellKeyOf(cell.center, p.f) === p.cellKey);
      // Il doit y en avoir une.
      assert.ok(ok, `${label} : cellule ${cell.key} sans image opaque`);
    // Fin de la boucle.
    }
    // Deux paires visibles de la même cellule ne sont jamais à la même hauteur avec deux images différentes de même emprise.
    // Table des plans déjà vus.
    const seen = new Map();
    // Pour chaque paire visible (début).
    for (const p of pairs) {
      // Identifiant du plan : la cellule et la hauteur de son fondu.
      const id = `${p.cellKey}|${p.fx ? p.fx.lift : 0}`;
      // Niveau de son image.
      const z = Number(p.entryKey.split('/')[0]);
      // Si ce plan a déjà été vu : même niveau d'image.
      if (seen.has(id)) assert.equal(seen.get(id), z, `${label} : deux niveaux d'images sur le même plan (${id})`);
      // Note le niveau de ce plan.
      seen.set(id, z);
    // Fin de la boucle.
    }
  // Fin de check.
  };
  // Zoom avant sans pause : la vue change toutes les 3 images, bien plus vite qu'un fondu (320 ms).
  // Altitude de départ et compteur d'images.
  let alt = 2, n = 0;
  // Tant que l'altitude dépasse 0,02 (début).
  while (alt > 0.02) {
    // L'altitude diminue de 10 %.
    alt *= 0.9;
    // Sélection pour cette altitude.
    hex.select(viewAt(alt), OPTS);
    // Si la sélection a changé : affichage.
    if (hex.changed) hex.show(now);
    // Trois images : animation, contrôle, avance de 16 ms.
    for (let i = 0; i < 3; i++) { hex.animate(now); check(`altitude ${alt.toFixed(3)}`); now += 16; n++; }
  // Fin de la boucle.
  }
  // Plus de cent images ont été jouées.
  assert.ok(n > 100);
  // Des matériaux de fondu ont été créés.
  assert.ok(hex.pool.length + hex.active.size > 0, 'des fondus ont eu lieu');
  // Laisse finir les fondus.
  run(hex, now);
  // Plus aucun fondu en cours.
  assert.equal(hex.active.size, 0);
  // L'indicateur de fondu est retombé.
  assert.equal(hex.fading, false);
  // Les paires affichées sont visibles, avec leur matériau d'origine et sans fondu.
  for (const p of hex.shown) { assert.ok(p.mesh.visible); assert.equal(p.mesh.material, p.base); assert.equal(p.fx, null); }
  // Tout maillage visible appartient à une paire affichée.
  for (const m of layer.meshes) if (m.visible) assert.ok(hex.shown.some((p) => p.mesh === m));
  // Les matériaux de fondu resservent : bien moins de matériaux créés que de fondus joués.
  // La réserve de matériaux de fondu ne dépasse pas 128.
  assert.ok(hex.pool.length <= 128);
// Fin du test.
});

// Test : le changement sans fondu.
test('fondu : « réduire les animations » → changement immédiat', () => {
  // Affichage des cellules sur une fausse couche.
  const hex = new HexDisplay(fakeLayer());
  // Durée de fondu nulle.
  hex.fadeMs = 0;
  // Sélection pour une vue lointaine.
  hex.select(viewAt(2), OPTS);
  // Affichage à l'instant 0.
  hex.show(0);
  // Aucun fondu en cours.
  assert.equal(hex.active.size, 0);
  // L'animation n'a rien à faire.
  assert.equal(hex.animate(16), false);
  // Les paires affichées sont visibles, avec leur matériau d'origine.
  for (const p of hex.shown) { assert.ok(p.mesh.visible); assert.equal(p.mesh.material, p.base); }
// Fin du test.
});
