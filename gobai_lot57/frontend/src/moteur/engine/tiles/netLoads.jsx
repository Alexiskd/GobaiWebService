// Téléchargements des tuiles : partage, annulation réelle, délai d'abandon adaptatif, limite par serveur, compteurs.
//
//  - SharedLoads : un seul téléchargement par adresse, partagé entre les tuiles qui en ont besoin (un ancêtre
//    sur-zoomé sert jusqu'à 64 tuiles filles). Chaque appelant garde son signal d'annulation ; quand plus aucun
//    appelant n'attend l'image, le téléchargement lui-même est annulé (avant, il continuait jusqu'au bout).
//  - AdaptiveTimeout : délai d'abandon d'une source mesuré sur ses temps de réponse (moyenne + 4 écarts, comme TCP),
//    entre 1,5 et 8 secondes, au lieu de 4 secondes fixes.
//  - HostGate : téléchargements simultanés par serveur, réglés sur ce que le serveur supporte (+1 après une série de
//    réponses rapides, divisé par 2 après un délai dépassé ou une erreur), entre 2 et 12.
//  - NET_STATS : compteurs de la session (requêtes, octets, annulations, délais dépassés, erreurs).

/** Compteurs réseau des tuiles, pour la session. */
// Requêtes lancées, terminées, octets reçus, annulées, délais dépassés, erreurs.
export const NET_STATS = { requests: 0, done: 0, bytes: 0, aborted: 0, timeouts: 0, errors: 0 };

/** Erreur d'annulation, reconnue par son nom. */
// abortError : une erreur nommée « AbortError ».
const abortError = () => Object.assign(new Error('annulé'), { name: 'AbortError' });

/** Serveur d'une adresse (« host »), ou « local » pour une adresse relative. */
// Déclare et exporte hostOf : l'adresse (début).
export function hostOf(url) {
  // Adresse relative au site : le serveur de l'app.
  if (typeof url !== 'string' || (url.startsWith('/') && !url.startsWith('//'))) return 'local';
  // Sinon le nom du serveur, ou « local » si l'adresse est illisible.
  try { return new URL(url, 'https://local.invalid').host; } catch { return 'local'; }
// Fin de hostOf.
}

// Déclare et exporte la classe AdaptiveTimeout (début).
export class AdaptiveTimeout {
  /** @param {{ initial?: number, min?: number, max?: number }} opts délais en millisecondes */
  // Constructeur : délai de départ, minimum et maximum.
  constructor({ initial = 4000, min = 1500, max = 8000 } = {}) {
    // Garde les bornes et le délai de départ.
    this.initial = initial; this.min = min; this.max = max;
    // Mesures par source : moyenne lissée et écart lissé.
    this.est = new Map();
  // Fin du constructeur.
  }

  /** Délai d'abandon d'une source (ms) : moyenne + 4 écarts, borné ; le délai de départ tant qu'elle n'a pas répondu. */
  // timeoutFor : le délai d'une source.
  timeoutFor(id) { const e = this.est.get(id); return e ? Math.round(Math.min(this.max, Math.max(this.min, e.mean + 4 * e.dev))) : this.initial; }

  /** Note un temps de réponse réussi (ms). Lissage à 1/8 et 1/4, comme le calcul du délai de TCP. */
  // record : un temps de réponse (début).
  record(id, ms) {
    // Mesure invalide : ignorée.
    if (!(ms >= 0)) return;
    // Mesures de la source.
    const e = this.est.get(id);
    // Première mesure : moyenne = mesure, écart = moitié.
    if (!e) { this.est.set(id, { mean: ms, dev: ms / 2 }); return; }
    // Écart lissé, puis moyenne lissée.
    e.dev = 0.75 * e.dev + 0.25 * Math.abs(ms - e.mean); e.mean = 0.875 * e.mean + 0.125 * ms;
  // Fin de record.
  }
// Fin de la classe AdaptiveTimeout.
}

// Déclare et exporte la classe HostGate (début).
export class HostGate {
  /** @param {{ initial?: number, min?: number, max?: number, fastMs?: number, streak?: number }} opts */
  // Constructeur : limite de départ, bornes, seuil d'une réponse rapide et série nécessaire pour monter.
  constructor({ initial = 6, min = 2, max = 12, fastMs = 600, streak = 8 } = {}) {
    // Garde les réglages.
    this.initial = initial; this.min = min; this.max = max; this.fastMs = fastMs; this.streak = streak;
    // État par serveur : limite, en cours, file d'attente, réponses rapides d'affilée.
    this.hosts = new Map();
  // Fin du constructeur.
  }

  /** État d'un serveur, créé à la première demande. */
  // host : l'état d'un serveur (début).
  host(name) {
    // État existant.
    let h = this.hosts.get(name);
    // Sinon : créé.
    if (!h) { h = { limit: this.initial, active: 0, queue: [], fast: 0 }; this.hosts.set(name, h); }
    // Le renvoie.
    return h;
  // Fin de host.
  }

  /**
   * Lance `task()` quand le serveur a une place ; la promesse rend son résultat. Annulée par `signal` tant qu'elle
   * attend sa place (rien n'est alors parti sur le réseau).
   */
  // run : lance une tâche pour un serveur (début).
  run(name, task, signal) {
    // État du serveur.
    const h = this.host(name);
    // Déjà annulée : rejet.
    if (signal?.aborted) return Promise.reject(abortError());
    // Promesse de la tâche (début).
    return new Promise((resolve, reject) => {
      // Entrée de la file.
      const entry = { start: () => {
        // Retire l'écoute d'annulation de l'attente.
        signal?.removeEventListener('abort', onAbort);
        // Une place prise.
        h.active++;
        // Lance la tâche ; à la fin, libère la place et lance la suivante.
        Promise.resolve().then(task).then(resolve, reject).finally(() => { h.active--; this.next(h); });
      } };
      // onAbort : retire l'entrée de la file et rejette.
      const onAbort = () => { const i = h.queue.indexOf(entry); if (i >= 0) h.queue.splice(i, 1); reject(abortError()); };
      // Écoute l'annulation pendant l'attente.
      signal?.addEventListener('abort', onAbort, { once: true });
      // Met en file, puis lance ce qui peut l'être.
      h.queue.push(entry); this.next(h);
    // Fin de la promesse.
    });
  // Fin de run.
  }

  /** Lance les tâches en attente tant que le serveur a des places. */
  // next : vide la file autant que possible.
  next(h) { while (h.active < h.limit && h.queue.length) h.queue.shift().start(); }

  /** Réponse réussie en `ms` : après une série de réponses rapides, une place de plus. */
  // success : une réussite (début).
  success(name, ms) {
    // État du serveur.
    const h = this.host(name);
    // Réponse lente : la série repart de zéro.
    if (!(ms < this.fastMs)) { h.fast = 0; return; }
    // Série atteinte : une place de plus, série remise à zéro, et lance ce qui attend.
    if (++h.fast >= this.streak) { h.fast = 0; h.limit = Math.min(this.max, h.limit + 1); this.next(h); }
  // Fin de success.
  }

  /** Délai dépassé ou erreur : deux fois moins de places. */
  // failure : un échec.
  failure(name) { const h = this.host(name); h.fast = 0; h.limit = Math.max(this.min, Math.floor(h.limit / 2)); }

  /** Limites par serveur, pour les compteurs. */
  // limits : { serveur: limite }.
  limits() { return Object.fromEntries([...this.hosts].map(([k, h]) => [k, h.limit])); }
// Fin de la classe HostGate.
}

// Déclare et exporte la classe SharedLoads (début).
export class SharedLoads {
  /**
   * @param {(url: string, signal: AbortSignal, urgent: boolean) => Promise<any>} load téléchargement d'une adresse
   * @param {{ keepMs?: number, setTimer?: Function }} opts durée de partage d'une image reçue (30 s)
   */
  // Constructeur : la fonction de téléchargement et la durée de partage.
  constructor(load, { keepMs = 30_000, setTimer = (f, ms) => setTimeout(f, ms) } = {}) {
    // Garde la fonction, la durée et la minuterie.
    this.load = load; this.keepMs = keepMs; this.setTimer = setTimer;
    // Téléchargements par adresse.
    this.entries = new Map();
  // Fin du constructeur.
  }

  /**
   * L'image d'une adresse. Sans `signal`, l'appelant attend jusqu'au bout (préchargement, mesure de couleur) ; avec,
   * il peut abandonner : quand plus aucun appelant n'attend, le téléchargement est annulé.
   */
  // get : demande l'image d'une adresse (début).
  get(url, signal, urgent = false) {
    // Déjà annulé par l'appelant : rejet.
    if (signal?.aborted) return Promise.reject(abortError());
    // Téléchargement en cours ou reçu récemment.
    let e = this.entries.get(url);
    // S'il n'y en a pas (début).
    if (!e) {
      // Contrôleur d'annulation du téléchargement.
      const ctrl = new AbortController();
      // Nouvelle entrée : appelants qui peuvent abandonner, appelant qui attend jusqu'au bout, fini ou non.
      e = { ctrl, waiters: 0, pinned: false, settled: false };
      // Lance le téléchargement.
      e.promise = this.load(url, ctrl.signal, urgent);
      // Le range.
      this.entries.set(url, e);
      // À la fin : reçu, partagé encore `keepMs` ; échoué, retiré tout de suite.
      const entry = e;
      e.promise.then(
        // Reçu : gardé pour les tuiles filles, puis oublié.
        () => { entry.settled = true; this.setTimer(() => { if (this.entries.get(url) === entry) this.entries.delete(url); }, this.keepMs); },
        // Échoué ou annulé : oublié.
        () => { entry.settled = true; if (this.entries.get(url) === entry) this.entries.delete(url); },
      );
    // Fin de ce cas.
    }
    // Sans signal : attend jusqu'au bout, et le téléchargement ne sera jamais annulé.
    if (!signal) { e.pinned = true; return e.promise; }
    // Un appelant de plus qui peut abandonner.
    e.waiters++;
    // L'entrée, pour la suite.
    const entry = e;
    // Promesse de cet appelant (début).
    return new Promise((resolve, reject) => {
      // Cet appelant a fini (reçu, échec ou abandon) : une seule fois.
      let gone = false;
      // leave : l'appelant s'en va.
      const leave = () => { if (gone) return false; gone = true; entry.waiters--; signal.removeEventListener('abort', onAbort); return true; };
      // onAbort : l'appelant abandonne ; si plus personne n'attend, le téléchargement est annulé.
      const onAbort = () => {
        // Déjà parti : rien.
        if (!leave()) return;
        // Plus personne et téléchargement pas fini : annulé, compté, oublié.
        if (entry.waiters <= 0 && !entry.pinned && !entry.settled) { entry.ctrl.abort(); NET_STATS.aborted++; if (this.entries.get(url) === entry) this.entries.delete(url); }
        // Rejet d'annulation pour cet appelant.
        reject(abortError());
      // Fin de onAbort.
      };
      // Écoute l'annulation.
      signal.addEventListener('abort', onAbort, { once: true });
      // Rend le résultat à cet appelant.
      entry.promise.then((v) => { if (leave()) resolve(v); }, (err) => { if (leave()) reject(err); });
    // Fin de la promesse.
    });
  // Fin de get.
  }

  /** Oublie tout (couche libérée). */
  // clear : vide les entrées.
  clear() { this.entries.clear(); }
// Fin de la classe SharedLoads.
}
