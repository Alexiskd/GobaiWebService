/**
 * Rappel des dons : la fenêtre « Dons » s'ouvre d'elle-même à l'ouverture de l'application, puis toutes les dix
 * minutes. Calcul pur, sans React ni minuterie : le crochet useDonationPrompt l'anime.
 *
 * Règles :
 *  - première ouverture FIRST_MS après que la scène est prête (elle apparaît d'abord) ;
 *  - ensuite EVERY_MS après la fermeture de la fenêtre des dons : le temps passé dedans ne compte pas ;
 *  - le compte à rebours se met en pause pendant qu'une autre fenêtre est ouverte (recherche, paramètres, galerie…)
 *    ou que l'onglet est caché : la fenêtre des dons ne remplace jamais une autre fenêtre ;
 *  - au moins RESUME_MS après la reprise, pour ne pas surgir à la seconde où l'on ferme une fenêtre.
 */
export const DONATION_PROMPT = { FIRST_MS: 2_500, EVERY_MS: 600_000, RESUME_MS: 3_000 };

export class DonationPromptClock {
  constructor(now = 0, { FIRST_MS, EVERY_MS, RESUME_MS } = DONATION_PROMPT) {
    this.every = EVERY_MS;
    this.resume = RESUME_MS;
    // Temps restant avant le prochain rappel, et instant à partir duquel il s'écoule (null : en pause).
    this.remaining = FIRST_MS;
    this.since = null;
    this.update(now, { paused: true });
  }

  /**
   * État à l'instant `now` : `paused` vrai si une fenêtre est ouverte ou l'onglet caché, `donateOpen` vrai si c'est
   * la fenêtre des dons. Renvoie le délai avant le prochain rappel (ms), ou null en pause.
   */
  update(now, { paused = false, donateOpen = false } = {}) {
    if (donateOpen) {
      // Fenêtre des dons ouverte (rappel ou ouverture à la main) : le prochain rappel partira de sa fermeture.
      this.remaining = this.every;
      this.since = null;
      return null;
    }
    if (paused) {
      if (this.since !== null) this.remaining = Math.max(0, this.remaining - (now - this.since));
      this.since = null;
      return null;
    }
    if (this.since === null) {
      this.since = now;
      this.remaining = Math.max(this.remaining, this.resume);
    }
    return Math.max(0, this.remaining - (now - this.since));
  }

  /** Vrai s'il est temps d'ouvrir la fenêtre des dons. */
  due(now) {
    return this.since !== null && now - this.since >= this.remaining;
  }
}
