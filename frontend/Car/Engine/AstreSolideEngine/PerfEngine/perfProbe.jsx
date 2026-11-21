// Sonde de performance du moniteur CPU / GPU (composante PerfMonitor).
//
// Une page web n'a pas accès à la charge réelle du processeur ni de la carte graphique (le navigateur ne la donne
// pas). Ce qui se mesure depuis la page, et que cette sonde relève :
//  - CPU : le temps de calcul du moteur par image sur le fil principal (du début de `frame` à l'envoi du dessin), et
//    sa part de l'intervalle entre deux images ;
//  - GPU : le temps de dessin de l'image, quand le navigateur expose le chronomètre du GPU
//    (EXT_disjoint_timer_query_webgl2 : Chrome et Edge sur ordinateur ; absent sur Safari et iPhone), et sa part de
//    l'intervalle entre deux images ;
//  - le travail demandé au GPU : appels de dessin, triangles, textures et maillages en mémoire ;
//  - le nom de la carte graphique et, sur Chrome, la mémoire JavaScript utilisée.
// Les valeurs sont lissées et publiées deux fois par seconde.

// Intervalle entre deux publications : 500 ms.
const PUBLISH_MS = 500;
// Coefficient de lissage des durées : 0,15.
const SMOOTH = 0.15; // lissage exponentiel des durées
// Constante WebGL : résultat de la mesure disponible.
const QUERY_RESULT_AVAILABLE = 0x8867;
// Constante WebGL : résultat de la mesure.
const QUERY_RESULT = 0x8866;

/** Part d'une durée dans l'intervalle entre deux images, en % entier borné à 0–100. */
// Déclare et exporte sharePercent : une durée et l'intervalle entre deux images.
export function sharePercent(ms, intervalMs) {
  // Durée ou intervalle nul, négatif ou non numérique : 0.
  if (!(ms > 0) || !(intervalMs > 0)) return 0;
  // Renvoie le pourcentage arrondi, borné entre 0 et 100.
  return Math.max(0, Math.min(100, Math.round((ms / intervalMs) * 100)));
// Fin de sharePercent.
}

/** Nom lisible de la carte graphique : « ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version) » → « Apple M2 ». */
// Déclare et exporte gpuLabel : le nom brut de la carte graphique.
export function gpuLabel(raw) {
  // Nom absent, ou qui n'est pas une chaîne : chaîne vide.
  if (!raw || typeof raw !== 'string') return '';
  // Nom sans espaces autour.
  let s = raw.trim();
  // Cherche la forme « ANGLE (…) ».
  const angle = /^ANGLE \((.*)\)$/.exec(s);
  // Si c'est cette forme (début).
  if (angle) {
    // Découpe le contenu des parenthèses aux virgules.
    const parts = angle[1].split(',').map((p) => p.trim());
    // Garde la deuxième partie, sinon la première.
    s = parts[1] || parts[0] || s;
    // Retire le préfixe « ANGLE Metal Renderer: ».
    s = s.replace(/^ANGLE Metal Renderer:\s*/i, '');
  // Fin du cas ANGLE.
  }
  // Retire la mention Direct3D et ce qui suit, les identifiants entre parenthèses, « /PCIe/SSE2 » et la mention OpenGL.
  s = s.replace(/\s+Direct3D.*$/i, '').replace(/\s+\(0x[0-9a-f]+\)/gi, '').replace(/\s*\/PCIe\/SSE2$/i, '').replace(/\s+OpenGL.*$/i, '');
  // Renvoie le nom, limité à 48 caractères.
  return s.trim().slice(0, 48);
// Fin de gpuLabel.
}

// Déclare et exporte la classe PerfProbe (début).
export class PerfProbe {
  /** @param gl contexte WebGL du moteur de rendu (ou null : seules les mesures CPU sont faites). */
  // Constructeur : le contexte WebGL (début).
  constructor(gl) {
    // Garde le contexte, ou null.
    this.gl = gl || null;
    // Extension du chronomètre : aucune pour l'instant.
    this.ext = null;
    // Mesure en cours : aucune.
    this.query = null;      // requête en cours de mesure
    // Mesure en attente de résultat : aucune.
    this.pending = null;    // requête terminée, résultat pas encore disponible
    // Temps CPU lissé.
    this.cpuMs = 0;
    // Temps GPU lissé.
    this.gpuMs = 0;
    // Aucun temps GPU reçu pour l'instant.
    this.gpuSeen = false;
    // Intervalle lissé entre deux images.
    this.intervalMs = 0;
    // Instant du début de l'image.
    this.t0 = 0;
    // Instant de la dernière publication.
    this.publishedAt = 0;
    // Nom de la carte graphique.
    this.gpuName = '';
    // Essai (début).
    try {
      // Chronomètre du GPU : WebGL 2 seulement (createQuery).
      // Avec un contexte WebGL 2 : demande l'extension du chronomètre.
      if (gl && typeof gl.createQuery === 'function') this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      // Avec un contexte (début).
      if (gl) {
        // Demande l'extension qui donne le nom réel de la carte.
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        // Nom lisible de la carte : par cette extension, sinon par le paramètre RENDERER.
        this.gpuName = gpuLabel(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      // Fin du cas avec contexte.
      }
    // Erreur ignorée.
    } catch { /* extension refusée : mesures CPU seules */ }
  // Fin du constructeur.
  }

  /** Début d'une image dessinée. `rawDt` : temps écoulé depuis la précédente. */
  // frameStart : le temps écoulé depuis l'image précédente (début).
  frameStart(rawDt) {
    // Note l'instant du début.
    this.t0 = performance.now();
    // Pour un temps entre 0 et 250 ms : met à jour l'intervalle lissé ; la première valeur est prise telle quelle.
    if (rawDt > 0 && rawDt < 250) this.intervalMs += (rawDt - this.intervalMs) * (this.intervalMs ? SMOOTH : 1);
  // Fin de frameStart.
  }

  /** Juste avant le dessin : lit un résultat en attente, puis démarre une mesure s'il n'y en a aucune en cours. */
  // renderStart : juste avant le dessin (début).
  renderStart() {
    // Le contexte et l'extension.
    const { gl, ext } = this;
    // Sans chronomètre : rien à faire.
    if (!ext) return;
    // Essai (début).
    try {
      // S'il y a une mesure en attente (début).
      if (this.pending) {
        // Si son résultat est disponible (début).
        if (gl.getQueryParameter(this.pending, QUERY_RESULT_AVAILABLE)) {
          // Indicateur de mesure interrompue.
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT); // mesure interrompue (changement d'onglet…) : ignorée
          // Durée mesurée, en nanosecondes.
          const ns = gl.getQueryParameter(this.pending, QUERY_RESULT);
          // Supprime la requête.
          gl.deleteQuery(this.pending);
          // Plus de mesure en attente.
          this.pending = null;
          // Si la mesure est valable (début).
          if (!disjoint && ns > 0) {
            // Durée en millisecondes.
            const ms = ns / 1e6;
            // Met à jour le temps GPU lissé ; la première valeur est prise telle quelle.
            this.gpuMs += (ms - this.gpuMs) * (this.gpuSeen ? SMOOTH : 1);
            // Note qu'un temps GPU a été reçu.
            this.gpuSeen = true;
          // Fin du cas d'une mesure valable.
          }
        // Fin du cas d'un résultat disponible.
        }
        // Résultat pas encore disponible : aucune nouvelle mesure.
        if (this.pending) return; // une seule mesure à la fois
      // Fin du cas d'une mesure en attente.
      }
      // Crée une requête.
      this.query = gl.createQuery();
      // Démarre la mesure du temps écoulé.
      gl.beginQuery(ext.TIME_ELAPSED_EXT, this.query);
    // En cas d'erreur : le chronomètre est abandonné.
    } catch { this.ext = null; this.query = null; this.pending = null; }
  // Fin de renderStart.
  }

  /** Juste après le dessin. */
  // renderEnd : juste après le dessin (début).
  renderEnd() {
    // Sans chronomètre ou sans mesure en cours : rien à faire.
    if (!this.ext || !this.query) return;
    // Essai (début).
    try {
      // Termine la mesure.
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      // Elle passe en attente de résultat.
      this.pending = this.query;
    // En cas d'erreur : le chronomètre est abandonné.
    } catch { this.ext = null; this.pending = null; }
    // Plus de mesure en cours.
    this.query = null;
  // Fin de renderEnd.
  }

  /**
   * Fin de l'image. Renvoie les mesures à publier deux fois par seconde, sinon null.
   * @param info `renderer.info` de three.js (appels, triangles, textures, maillages)
   */
  // frameEnd : les compteurs du moteur de rendu (début).
  frameEnd(info) {
    // Instant actuel.
    const now = performance.now();
    // Temps de calcul de l'image.
    const cpu = now - this.t0;
    // Pour un temps entre 0 et 250 ms : met à jour le temps CPU lissé ; la première valeur est prise telle quelle.
    if (cpu >= 0 && cpu < 250) this.cpuMs += (cpu - this.cpuMs) * (this.cpuMs ? SMOOTH : 1);
    // Moins de 500 ms depuis la dernière publication : null.
    if (now - this.publishedAt < PUBLISH_MS) return null;
    // Note l'instant de la publication.
    this.publishedAt = now;
    // Mémoire JavaScript utilisée, quand le navigateur la donne.
    const heap = globalThis.performance?.memory?.usedJSHeapSize;
    // Renvoie les mesures (début).
    return {
      // Temps CPU, à un dixième de milliseconde.
      cpuMs: Math.round(this.cpuMs * 10) / 10,
      // Sa part de l'intervalle.
      cpuPct: sharePercent(this.cpuMs, this.intervalMs),
      // Temps GPU, à un dixième de milliseconde, ou null s'il n'a jamais été reçu.
      gpuMs: this.gpuSeen ? Math.round(this.gpuMs * 10) / 10 : null,
      // Sa part de l'intervalle, ou null.
      gpuPct: this.gpuSeen ? sharePercent(this.gpuMs, this.intervalMs) : null,
      // Appels de dessin.
      calls: info?.render?.calls ?? 0,
      // Triangles.
      triangles: info?.render?.triangles ?? 0,
      // Textures en mémoire.
      textures: info?.memory?.textures ?? 0,
      // Maillages en mémoire.
      geometries: info?.memory?.geometries ?? 0,
      // Mémoire JavaScript en mégaoctets, ou null.
      heapMb: heap > 0 ? Math.round(heap / 1048576) : null,
      // Nom de la carte graphique.
      gpuName: this.gpuName,
    // Fin des mesures.
    };
  // Fin de frameEnd.
  }

  // dispose : libère la sonde (début).
  dispose() {
    // Essai (début).
    try {
      // Termine et supprime la mesure en cours.
      if (this.query) { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.gl.deleteQuery(this.query); }
      // Supprime la mesure en attente.
      if (this.pending) this.gl.deleteQuery(this.pending);
    // Erreur ignorée.
    } catch { /* contexte déjà perdu */ }
    // Oublie les mesures et l'extension.
    this.query = null; this.pending = null; this.ext = null;
  // Fin de dispose.
  }
// Fin de la classe PerfProbe.
}

// Fenêtre glissante de la mesure des images par seconde, en millisecondes.
const FPS_WINDOW_MS = 1000;
// Au-delà de cet écart entre deux images, c'est une pause (onglet caché, moteur suspendu) : la mesure repart.
const FPS_GAP_MS = 1000;
// Durée minimale observée avant de publier une première valeur.
const FPS_MIN_SPAN_MS = 250;
// Délai minimal entre deux publications.
const FPS_PUBLISH_MS = 250;
// Nombre maximal d'instants gardés (écrans 240 Hz compris).
const FPS_MAX_SAMPLES = 300;

/**
 * Images par seconde, calculées sur une fenêtre glissante d'une seconde : (nombre d'intervalles) ÷ (durée réellement
 * couverte par ces intervalles). Contrairement à un comptage par tranches d'une demi-seconde, la valeur ne saute pas
 * d'une tranche à l'autre et ne dépend pas de l'endroit où la tranche est coupée. `low` est le rythme de l'image la
 * plus lente de la fenêtre (1000 ÷ plus long intervalle) : il montre les à-coups que la moyenne cache.
 */
// Déclare et exporte la classe FpsMeter.
export class FpsMeter {
  // Constructeur : aucune image vue.
  constructor() {
    // Instants des images de la fenêtre, du plus ancien au plus récent.
    this.times = [];
    // Dernières valeurs publiées.
    this.fps = 0; this.low = 0;
    // Instant de la dernière publication.
    this.publishedAt = -Infinity;
  // Fin du constructeur.
  }

  /** Une image dessinée à l'instant `now` (ms). Renvoie { fps, low } quand la valeur publiée change, sinon null. */
  // tick : enregistre une image (début).
  tick(now) {
    // Raccourci vers les instants.
    const t = this.times;
    // Instant de l'image précédente.
    const last = t[t.length - 1];
    // Pause ou horloge revenue en arrière : la fenêtre repart de cette image.
    if (last !== undefined && (now - last > FPS_GAP_MS || now < last)) t.length = 0;
    // Ajoute l'instant de cette image.
    t.push(now);
    // Retire les instants sortis de la fenêtre, en gardant toujours au moins un intervalle.
    while (t.length > 2 && (now - t[0] > FPS_WINDOW_MS || t.length > FPS_MAX_SAMPLES)) t.shift();
    // Durée couverte par la fenêtre.
    const span = now - t[0];
    // Pas encore assez de recul, ou publication trop récente : rien.
    if (t.length < 2 || span < FPS_MIN_SPAN_MS || now - this.publishedAt < FPS_PUBLISH_MS) return null;
    // Retient l'instant de cette publication.
    this.publishedAt = now;
    // Moyenne : intervalles de la fenêtre ramenés à la seconde.
    const fps = Math.round(((t.length - 1) * 1000) / span);
    // Plus long intervalle de la fenêtre.
    let worst = 0;
    // Parcourt les intervalles.
    for (let i = 1; i < t.length; i++) worst = Math.max(worst, t[i] - t[i - 1]);
    // Rythme de l'image la plus lente.
    const low = worst > 0 ? Math.round(1000 / worst) : fps;
    // Valeurs inchangées : rien à publier.
    if (fps === this.fps && low === this.low) return null;
    // Garde les nouvelles valeurs.
    this.fps = fps; this.low = low;
    // Les renvoie.
    return { fps, low };
  // Fin de tick.
  }

  /** Oublie la mesure (moteur relancé). */
  // reset : remet le compteur à zéro.
  reset() {
    // Vide la fenêtre et les valeurs.
    this.times.length = 0; this.fps = 0; this.low = 0; this.publishedAt = -Infinity;
  // Fin de reset.
  }
// Fin de la classe FpsMeter.
}
