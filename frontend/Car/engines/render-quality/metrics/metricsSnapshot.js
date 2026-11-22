/**
 * Relevé des mesures du rendu, publié une fois par seconde par le service de qualité.
 *
 * Il réunit la fenêtre d'images (FrameWindow) et la dernière sonde du moteur (PerfProbe.frameEnd, qui lit
 * `renderer.info` de three.js). Fonction pure : testable sans navigateur ni three.js.
 *
 * Mémoire GPU : WebGL ne donne aucun nombre d'octets. On publie ce que three.js compte vraiment : le nombre de
 * textures et de géométries chargées sur la carte graphique.
 */

// Relevé vide : avant la première seconde mesurée.
export const EMPTY_METRICS = Object.freeze({
  // Instant du relevé (ms), 0 = jamais mesuré.
  at: 0,
  // Images par seconde.
  fps: 0,
  // Temps de frame moyen, en ms.
  frameMs: 0,
  // Image la plus lente de la seconde, en ms.
  worstMs: 0,
  // Temps de calcul d'une image côté processeur, en ms.
  cpuMs: 0,
  // Temps de dessin côté carte graphique, en ms (null si le navigateur ne le mesure pas).
  gpuMs: null,
  // Appels de dessin de la dernière image.
  drawCalls: 0,
  // Triangles de la dernière image.
  triangles: 0,
  // Mémoire GPU : textures et géométries chargées (nombres, pas des octets).
  gpuMemory: Object.freeze({ textures: 0, geometries: 0 }),
  // Mémoire JavaScript utilisée, en Mo (null hors Chrome).
  heapMb: null,
// Fin du relevé vide.
});

/**
 * Construit un relevé figé.
 * @param at instant du relevé (ms)
 * @param frames résumé de FrameWindow.record ({ fps, frameMs, worstMs })
 * @param perf dernière mesure de PerfProbe.frameEnd, ou null
 */
export function buildMetrics(at, frames, perf) {
  // Sonde absente : objet vide, pour lire chaque champ sans test.
  const p = perf || {};
  // Relevé figé (personne ne doit le modifier après publication).
  return Object.freeze({
    // Instant du relevé.
    at,
    // Images par seconde de la fenêtre.
    fps: frames?.fps ?? 0,
    // Temps de frame moyen de la fenêtre.
    frameMs: frames?.frameMs ?? 0,
    // Image la plus lente de la fenêtre.
    worstMs: frames?.worstMs ?? 0,
    // Temps processeur lissé par la sonde.
    cpuMs: p.cpuMs ?? 0,
    // Temps carte graphique lissé par la sonde, ou null.
    gpuMs: p.gpuMs ?? null,
    // Appels de dessin (renderer.info.render.calls).
    drawCalls: p.calls ?? 0,
    // Triangles (renderer.info.render.triangles).
    triangles: p.triangles ?? 0,
    // Textures et géométries chargées (renderer.info.memory).
    gpuMemory: Object.freeze({ textures: p.textures ?? 0, geometries: p.geometries ?? 0 }),
    // Mémoire JavaScript, ou null.
    heapMb: p.heapMb ?? null,
  // Fin du relevé.
  });
// Fin de buildMetrics.
}
