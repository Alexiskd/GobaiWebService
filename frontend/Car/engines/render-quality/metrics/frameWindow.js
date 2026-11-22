/**
 * Fenêtre de mesure des images : cumule, pendant une seconde, les intervalles entre deux images dessinées, puis
 * rend un résumé (images par seconde, temps de frame moyen, image la plus lente).
 *
 * Pourquoi une fenêtre fixe d'une seconde : le mode Auto et l'estimation de la chauffe décident une fois par
 * seconde ; ils ont besoin d'une valeur stable par seconde, pas d'une moyenne qui glisse à chaque image.
 *
 * Coût par image : quelques additions, aucune allocation. Un objet n'est créé qu'une fois par seconde, à la
 * fermeture de la fenêtre.
 */

// Durée d'une fenêtre de mesure : une seconde.
export const WINDOW_MS = 1000;
// Au-delà de cet intervalle, l'image ne compte pas : onglet caché, pause, point d'arrêt.
export const GAP_MS = 250;

// Déclare et exporte la classe FrameWindow.
export class FrameWindow {
  // Constructeur : durée de la fenêtre (une seconde par défaut).
  constructor({ windowMs = WINDOW_MS } = {}) {
    // Garde la durée de la fenêtre.
    this.windowMs = windowMs;
    // Remet les compteurs à zéro.
    this.reset();
  // Fin du constructeur.
  }

  // Remet la fenêtre à zéro : rien de mesuré.
  reset() {
    // Instant d'ouverture de la fenêtre (aucun tant qu'aucune image n'est arrivée).
    this.openedAt = -1;
    // Nombre d'intervalles comptés.
    this.count = 0;
    // Somme des intervalles, en ms.
    this.sumMs = 0;
    // Plus long intervalle, en ms.
    this.worstMs = 0;
  // Fin de reset.
  }

  /**
   * Une image dessinée à l'instant `now`, `rawDt` ms après la précédente.
   * Renvoie le résumé de la fenêtre qui vient de se fermer, sinon null.
   */
  record(now, rawDt) {
    // Première image : la fenêtre s'ouvre ici.
    if (this.openedAt < 0) this.openedAt = now;
    // Intervalle valable : ni nul, ni négatif, ni trop long (onglet caché…).
    if (rawDt > 0 && rawDt <= GAP_MS) {
      // Un intervalle de plus.
      this.count += 1;
      // Ajoute sa durée.
      this.sumMs += rawDt;
      // Garde le plus long.
      if (rawDt > this.worstMs) this.worstMs = rawDt;
    // Fin du cas valable.
    }
    // La fenêtre n'est pas encore écoulée : rien à rendre.
    if (now - this.openedAt < this.windowMs) return null;
    // Aucun intervalle valable dans la fenêtre : on la rouvre sans résumé.
    if (this.count === 0) { this.reset(); this.openedAt = now; return null; }
    // Temps de frame moyen, en ms.
    const frameMs = this.sumMs / this.count;
    // Résumé : images par seconde (1000 ÷ temps moyen), temps moyen et image la plus lente, arrondis au dixième.
    const summary = {
      // Images par seconde, arrondies à l'unité.
      fps: Math.round(1000 / frameMs),
      // Temps de frame moyen, au dixième de ms.
      frameMs: Math.round(frameMs * 10) / 10,
      // Image la plus lente, au dixième de ms.
      worstMs: Math.round(this.worstMs * 10) / 10,
      // Nombre d'images mesurées.
      frames: this.count,
    // Fin du résumé.
    };
    // Remet les compteurs à zéro.
    this.reset();
    // La fenêtre suivante s'ouvre maintenant.
    this.openedAt = now;
    // Rend le résumé.
    return summary;
  // Fin de record.
  }
// Fin de FrameWindow.
}
