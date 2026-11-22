/**
 * Boucle de rendu de l'application complète : un seul requestAnimationFrame pour tous les moteurs.
 * Chaque moteur est une variable de la boucle : il s'enregistre avec un identifiant et une
 * fonction update(now, dt), appelée à chaque image dans l'ordre d'enregistrement.
 * La boucle est démarrée au niveau de l'app (RenderLoopRoot) et se met elle-même en pause
 * quand l'onglet est caché, sans saut de temps au retour.
 */

// Durée maximale d'une image : au-delà (retour d'onglet…), l'écart est borné.
export const DT_MAX_MS = 100;

// Déclare et exporte la classe RenderLoop.
export class RenderLoop {
  // Constructeur : injections optionnelles pour les tests (début).
  constructor({ raf, caf, clock, dtMaxMs = DT_MAX_MS } = {}) {
    // Variables de la boucle : identifiant -> fonction update(now, dt).
    this.engines = new Map();
    // Identifiant de la prochaine image demandée.
    this.rafId = 0;
    // Instant de la dernière image.
    this.lastNow = 0;
    // La boucle tourne-t-elle ?
    this.running = false;
    // Onglet caché ?
    this.hidden = false;
    // Durée maximale d'une image.
    this.dtMaxMs = dtMaxMs;
    // Horloge injectable (tests) : par défaut, performance.now du navigateur.
    this.clock = clock || (() => performance.now());
    // Demande d'image injectable (tests) : par défaut, requestAnimationFrame du navigateur.
    this.raf = raf || ((cb) => globalThis.requestAnimationFrame(cb));
    // Annulation injectable (tests) : par défaut, cancelAnimationFrame du navigateur.
    this.caf = caf || ((id) => globalThis.cancelAnimationFrame(id));
    // Écouteur de visibilité : posé au démarrage, retiré à l'arrêt.
    this.onVisibility = () => this.setHidden(typeof document !== 'undefined' && document.hidden);
  // Fin du constructeur.
  }

  // Enregistre un moteur : un identifiant et sa fonction update(now, dt).
  register(id, update) {
    // La fonction de mise à jour est requise.
    if (typeof update !== 'function') throw new TypeError(`update doit être une fonction pour ${id}.`);
    // Garde le moteur.
    this.engines.set(id, update);
    // Chaînable.
    return this;
  // Fin de register.
  }

  // Retire un moteur de la boucle.
  unregister(id) { return this.engines.delete(id); }

  // Un moteur est-il enregistré ?
  has(id) { return this.engines.has(id); }

  // Démarre la boucle : une seule fois.
  start() {
    // Déjà en route : rien.
    if (this.running) return;
    // La boucle tourne.
    this.running = true;
    // Onglet déjà caché au démarrage ?
    this.hidden = typeof document !== 'undefined' && document.hidden;
    // L'horloge part de maintenant.
    this.lastNow = this.clock();
    // Écoute la visibilité de l'onglet.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    // Onglet visible : demande la première image.
    if (!this.hidden) this.rafId = this.raf(this.tick);
  // Fin de start.
  }

  // Arrête la boucle : les moteurs restent enregistrés.
  stop() {
    // Pas en route : rien.
    if (!this.running) return false;
    // Ne tourne plus.
    this.running = false;
    // Annule l'image demandée.
    this.caf(this.rafId);
    // N'écoute plus la visibilité de l'onglet.
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    // Arrêt effectué.
    return true;
  // Fin de stop.
  }

  // Met la boucle en pause (onglet caché) ou la relance sans saut de temps.
  setHidden(hidden) {
    // Garde l'état.
    this.hidden = Boolean(hidden);
    // Pas en route : l'état suffira au démarrage.
    if (!this.running) return;
    // Onglet caché : annule l'image demandée.
    if (this.hidden) this.caf(this.rafId);
    // Onglet de retour : l'horloge repart de maintenant, puis nouvelle image.
    else { this.lastNow = this.clock(); this.rafId = this.raf(this.tick); }
  // Fin de setHidden.
  }

  // Une image : avance l'horloge, appelle chaque moteur, redemande une image.
  tick = (now) => {
    // Arrêtée ou cachée : rien.
    if (!this.running || this.hidden) return;
    // Temps écoulé, borné (retour d'onglet : pas de saut).
    const dt = Math.min(Math.max(now - this.lastNow, 0), this.dtMaxMs);
    // Note l'instant.
    this.lastNow = now;
    // Appelle chaque moteur, dans l'ordre d'enregistrement.
    for (const update of this.engines.values()) {
      // Une erreur d'un moteur n'arrête pas les autres ; elle est ignorée en silence (aucun log en console).
      try { update(now, dt); } catch { /* moteur en échec : on passe au suivant */ }
    // Fin des moteurs.
    }
    // Demande l'image suivante.
    this.rafId = this.raf(this.tick);
  // Fin de tick.
  };
}

// Boucle de rendu unique de l'application : chaque moteur s'y enregistre.
export const renderLoop = new RenderLoop();
