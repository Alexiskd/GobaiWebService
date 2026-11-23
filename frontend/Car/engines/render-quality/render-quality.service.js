/**
 * Service de qualité du rendu : point d'entrée unique des mesures (et, aux lots suivants, des profils, du mode
 * Auto et de la surchauffe). Les autres engines le lisent au lieu de calculer leurs budgets eux-mêmes.
 *
 * Lot 1 : mesures seulement. Le moteur lui donne chaque image dessinée (recordFrame) et chaque sonde de
 * performance (recordPerf) ; une fois par seconde, le service publie un relevé figé et prévient ses abonnés.
 * Rien n'est affiché, rien n'est écrit en console.
 */

// Importe la fenêtre de mesure des images.
import { FrameWindow } from './metrics/frameWindow.js';
// Importe la construction du relevé et le relevé vide.
import { buildMetrics, EMPTY_METRICS } from './metrics/metricsSnapshot.js';

// Déclare et exporte la classe RenderQualityService.
export class RenderQualityService {
  // Constructeur : la fenêtre de mesure peut être injectée (tests).
  constructor({ frameWindow } = {}) {
    // Fenêtre d'une seconde.
    this.frameWindow = frameWindow || new FrameWindow();
    // Dernière sonde reçue du moteur (renderer.info, temps CPU et GPU).
    this.lastPerf = null;
    // Dernière mesure de la couche de tuiles de la Terre.
    this.lastTiles = null;
    // Dernier relevé publié.
    this.metrics = EMPTY_METRICS;
    // Abonnés au relevé de chaque seconde.
    this.listeners = new Set();
    // Service arrêté ?
    this.disposed = false;
  // Fin du constructeur.
  }

  /**
   * Une image dessinée par le moteur, à l'instant `now`, `rawDt` ms après la précédente. Appelé à chaque image :
   * aucune allocation, sauf une fois par seconde à la publication du relevé.
   */
  recordFrame(now, rawDt) {
    // Service arrêté : rien.
    if (this.disposed) return;
    // Ajoute l'image à la fenêtre ; un résumé revient quand la seconde est écoulée.
    const frames = this.frameWindow.record(now, rawDt);
    // Seconde pas encore écoulée : rien à publier.
    if (!frames) return;
    // Construit le relevé de la seconde.
    this.metrics = buildMetrics(now, frames, this.lastPerf, this.lastTiles);
    // Prévient chaque abonné.
    for (const listener of this.listeners) {
      // Un abonné en échec n'empêche pas les autres (et n'écrit rien en console).
      try { listener(this.metrics); } catch { /* abonné en échec : ignoré */ }
    // Fin des abonnés.
    }
  // Fin de recordFrame.
  }

  /** Dernière sonde du moteur (PerfProbe.frameEnd), deux fois par seconde. */
  recordPerf(perf) {
    // Garde la sonde si elle existe.
    if (perf) this.lastPerf = perf;
  // Fin de recordPerf.
  }

  /** Dernière mesure de la couche de tuiles de la Terre (TileLayer.qualityMetrics), deux fois par seconde. */
  recordTiles(tiles) {
    // Garde la mesure si elle existe.
    if (tiles) this.lastTiles = tiles;
  // Fin de recordTiles.
  }

  /** Dernier relevé publié (figé). */
  getMetrics() {
    // Rend le relevé.
    return this.metrics;
  // Fin de getMetrics.
  }

  /** S'abonne au relevé de chaque seconde ; renvoie la fonction de désabonnement. */
  subscribe(listener) {
    // Ajoute l'abonné.
    this.listeners.add(listener);
    // Fonction de désabonnement.
    return () => this.listeners.delete(listener);
  // Fin de subscribe.
  }

  /** Arrête le service : plus de mesures, plus d'abonnés. */
  dispose() {
    // Marque l'arrêt.
    this.disposed = true;
    // Oublie les abonnés.
    this.listeners.clear();
  // Fin de dispose.
  }
// Fin de RenderQualityService.
}
