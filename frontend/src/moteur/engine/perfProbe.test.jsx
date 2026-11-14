// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le nom court de la carte graphique, la sonde de performances et le calcul de pourcentage.
import { gpuLabel, PerfProbe, sharePercent } from './perfProbe';

// Test : la part d'un temps dans l'intervalle entre deux images.
test('part de l’intervalle : en %, bornée, 0 sans mesure', () => {
  // 4 ms sur 16 ms : 25 %.
  assert.equal(sharePercent(4, 16), 25);
  // 40 ms sur 16 ms : plafonné à 100 %.
  assert.equal(sharePercent(40, 16), 100);
  // 0 ms : 0 %.
  assert.equal(sharePercent(0, 16), 0);
  // Intervalle nul : 0 %.
  assert.equal(sharePercent(4, 0), 0);
// Fin du test.
});

// Test : le nom affiché de la carte graphique.
test('nom de la carte graphique : lisible et court', () => {
  // Chaîne ANGLE d'un Mac : « Apple M2 ».
  assert.equal(gpuLabel('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'), 'Apple M2');
  // Chaîne ANGLE d'une carte NVIDIA : « NVIDIA GeForce RTX 3060 », sans l'identifiant ni la version de Direct3D.
  assert.equal(gpuLabel('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)'), 'NVIDIA GeForce RTX 3060');
  // Nom simple : inchangé.
  assert.equal(gpuLabel('Apple GPU'), 'Apple GPU');
  // Nom absent : chaîne vide.
  assert.equal(gpuLabel(null), '');
  // Nom de 200 caractères : raccourci à 48 caractères au plus.
  assert.ok(gpuLabel('x'.repeat(200)).length <= 48);
// Fin du test.
});

/** Faux contexte WebGL 2 avec chronomètre : chaque mesure rend `ns` nanosecondes, disponible à l'image suivante. */
// fakeGl : faux contexte WebGL ; chronomètre présent et 6 millions de nanosecondes par mesure, par défaut (début).
function fakeGl({ timer = true, ns = 6e6 } = {}) {
  // Fausse extension du chronomètre, avec ses deux constantes.
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  // Journal des appels : mesures commencées, terminées, supprimées et ouvertes.
  const log = { begun: 0, ended: 0, deleted: 0, open: 0 };
  // Renvoie le faux contexte (début).
  return {
    // Le journal.
    log,
    // Constante RENDERER : 9.
    RENDERER: 9,
    // getExtension : renvoie l'extension du chronomètre si elle est demandée et présente, sinon null.
    getExtension: (name) => (name === 'EXT_disjoint_timer_query_webgl2' ? (timer ? ext : null) : null),
    // getParameter : « Apple GPU » pour le paramètre 9, faux pour les autres.
    getParameter: (p) => (p === 9 ? 'Apple GPU' : false),
    // createQuery : un objet vide.
    createQuery: () => ({}),
    // beginQuery : vérifie qu'aucune mesure n'est déjà ouverte, puis compte une mesure ouverte et une commencée.
    beginQuery() { assert.equal(log.open, 0, 'une seule mesure à la fois'); log.open++; log.begun++; },
    // endQuery : une mesure ouverte de moins, une terminée de plus.
    endQuery() { log.open--; log.ended++; },
    // deleteQuery : une mesure supprimée de plus.
    deleteQuery() { log.deleted++; },
    // getQueryParameter : vrai pour le paramètre 0x8867, sinon la durée en nanosecondes.
    getQueryParameter: (q, what) => (what === 0x8867 ? true : ns),
  // Fin du faux contexte.
  };
// Fin de fakeGl.
}

// Test : la sonde avec un chronomètre GPU.
test('sonde : temps GPU lu à l’image suivante, publication deux fois par seconde', async () => {
  // Faux contexte avec chronomètre.
  const gl = fakeGl();
  // Sonde créée sur ce contexte.
  const probe = new PerfProbe(gl);
  // Elle a lu le nom de la carte : « Apple GPU ».
  assert.equal(probe.gpuName, 'Apple GPU');
  // Dernière publication reçue : aucune au départ.
  let out = null;
  // Cinq images de suite (début).
  for (let i = 0; i < 5; i++) {
    // Début de l'image, 16 ms après la précédente.
    probe.frameStart(16);
    // Début du rendu.
    probe.renderStart();
    // Fin du rendu.
    probe.renderEnd();
    // Fin de l'image avec les compteurs du moteur de rendu ; garde la publication quand il y en a une.
    out = probe.frameEnd({ render: { calls: 120, triangles: 54321 }, memory: { textures: 30, geometries: 40 } }) || out;
  // Fin de la boucle.
  }
  // Aucune mesure n'est restée ouverte.
  assert.equal(gl.log.open, 0);
  // Au moins quatre mesures commencées, et autant de terminées.
  assert.ok(gl.log.begun >= 4 && gl.log.ended === gl.log.begun);
  // Recule très loin la date de la dernière publication.
  probe.publishedAt = -1e9; // force la publication
  // Début d'une sixième image.
  probe.frameStart(16);
  // Début du rendu.
  probe.renderStart();
  // Fin du rendu.
  probe.renderEnd();
  // Fin de l'image : la publication.
  out = probe.frameEnd({ render: { calls: 120, triangles: 54321 }, memory: { textures: 30, geometries: 40 } });
  // Temps GPU : 6 ms.
  assert.equal(out.gpuMs, 6);
  // Part du temps GPU : 38 % de 16 ms.
  assert.equal(out.gpuPct, 38);
  // Appels de dessin : 120.
  assert.equal(out.calls, 120);
  // Triangles : 54 321.
  assert.equal(out.triangles, 54321);
  // Textures : 30.
  assert.equal(out.textures, 30);
  // Temps CPU positif ou nul, et sa part entre 0 et 100 %.
  assert.ok(out.cpuMs >= 0 && out.cpuPct >= 0 && out.cpuPct <= 100);
  // Libère la sonde.
  probe.dispose();
// Fin du test.
});

// Test : la sonde sans chronomètre GPU ou sans contexte.
test('sonde : sans chronomètre GPU (Safari, iPhone) ou sans contexte, le temps GPU est absent, pas faux', () => {
  // Pour un contexte sans chronomètre, puis pour un contexte absent (début).
  for (const gl of [fakeGl({ timer: false }), null]) {
    // Sonde créée sur ce contexte.
    const probe = new PerfProbe(gl);
    // Force la publication.
    probe.publishedAt = -1e9;
    // Début de l'image, 33 ms après la précédente.
    probe.frameStart(33);
    // Début du rendu.
    probe.renderStart();
    // Fin du rendu.
    probe.renderEnd();
    // Fin de l'image sans compteurs : la publication.
    const out = probe.frameEnd(null);
    // Temps GPU : null.
    assert.equal(out.gpuMs, null);
    // Part du temps GPU : null.
    assert.equal(out.gpuPct, null);
    // Appels de dessin : 0.
    assert.equal(out.calls, 0);
  // Fin de la boucle.
  }
// Fin du test.
});
