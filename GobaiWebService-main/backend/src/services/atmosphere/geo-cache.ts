// Cache géographique du moteur atmosphérique (sans NestJS, donc testable seul).
//
// - TtlCache : garde chaque réponse d'un fournisseur pendant sa durée de rafraîchissement. Les demandes simultanées
//   partagent une seule lecture ; un fournisseur en panne ne bloque rien : la dernière réponse connue est rendue,
//   marquée périmée, et le fournisseur n'est pas rappelé avant un délai de repos (respect des quotas).
// - Tuiles : le globe est découpé en carrés de N degrés ; le détail (points chauds un par un) n'est servi que par
//   tuile, pour ne jamais envoyer le monde entier en pleine résolution.

/** Résultat d'une lecture du cache. */
// Forme du résultat.
export interface CacheResult<T> {
  // data : la donnée, ou null si aucune n'a jamais été lue.
  data: T | null;
  // fetchedAt : l'heure de la lecture (ms), ou null.
  fetchedAt: number | null;
  // stale : vrai si la donnée est plus vieille que sa durée de validité (fournisseur en panne).
  stale: boolean;
  // error : le dernier échec du fournisseur, ou null.
  error: string | null;
// Fin de CacheResult.
}

/** Cache à durée de vie, avec lecture partagée, repli sur la dernière donnée et repos après un échec. */
// Classe TtlCache, générique sur le type de donnée.
export class TtlCache<T> {
  // Entrées gardées : clé → { heure, donnée } ; l'ordre de la Map sert d'ordre d'usage (la plus ancienne d'abord).
  private entries = new Map<string, { at: number; data: T }>();
  // Lectures en cours, par clé.
  private inFlight = new Map<string, Promise<CacheResult<T>>>();
  // Dernier échec par clé : { heure, message }.
  private failures = new Map<string, { at: number; message: string }>();

  // Constructeur : durée de validité, nombre maximal d'entrées, délai de repos après un échec et horloge.
  constructor(private readonly ttlMs: number, private readonly maxEntries = 64, private readonly retryMs = 120_000, private readonly now: () => number = Date.now) {}

  /** Lit la clé : donnée fraîche, sinon lecture (une seule à la fois), sinon dernière donnée connue. */
  // Méthode get : la clé et la fonction de lecture (null ou exception : échec).
  get(key: string, loader: () => Promise<T | null>): Promise<CacheResult<T>> {
    // Entrée gardée.
    const entry = this.entries.get(key);
    // Heure courante.
    const t = this.now();
    // Entrée fraîche : rendue sans appel (et marquée récemment utilisée).
    if (entry && t - entry.at < this.ttlMs) { this.touch(key, entry); return Promise.resolve(this.result(key, entry, false)); }
    // Dernier échec de cette clé.
    const failure = this.failures.get(key);
    // Échec récent : pas de nouvel appel, la dernière donnée connue (ou rien), marquée périmée.
    if (failure && t - failure.at < this.retryMs) return Promise.resolve(this.result(key, entry ?? null, true));
    // Lecture déjà en cours : partagée.
    const pending = this.inFlight.get(key);
    // La rend.
    if (pending) return pending;
    // Nouvelle lecture, retirée de la liste des lectures en cours quand elle se termine.
    const run = this.load(key, loader).finally(() => this.inFlight.delete(key));
    // La note.
    this.inFlight.set(key, run);
    // La rend.
    return run;
  // Fin de get.
  }

  /** La dernière donnée connue d'une clé, sans appel, ou null. */
  // Méthode peek : la clé.
  peek(key: string): T | null {
    // Donnée gardée, ou null.
    return this.entries.get(key)?.data ?? null;
  // Fin de peek.
  }

  /** État du cache : nombre d'entrées et dernier échec, pour le contrôle des fournisseurs. */
  // Méthode stats.
  stats(): { entries: number; lastFailure: { key: string; at: string; message: string } | null } {
    // Dernier échec, le plus récent de tous.
    let last: { key: string; at: number; message: string } | null = null;
    // Pour chaque échec : garde le plus récent.
    for (const [key, f] of this.failures) if (!last || f.at > last.at) last = { key, ...f };
    // Nombre d'entrées et dernier échec en heure ISO.
    return { entries: this.entries.size, lastFailure: last ? { key: last.key, at: new Date(last.at).toISOString(), message: last.message } : null };
  // Fin de stats.
  }

  // Méthode privée load : appelle le fournisseur et range le résultat.
  private async load(key: string, loader: () => Promise<T | null>): Promise<CacheResult<T>> {
    // Donnée lue ; message d'échec.
    let data: T | null = null, message = 'réponse vide ou illisible';
    // Essaie
    try {
      // d'appeler le fournisseur ;
      data = await loader();
    // en cas d'exception,
    } catch (err) {
      // garde son message.
      message = err instanceof Error ? err.message : String(err);
    // Fin du cas.
    }
    // Échec : noté, et la dernière donnée connue est rendue, périmée.
    if (data === null) { this.failures.set(key, { at: this.now(), message }); return this.result(key, this.entries.get(key) ?? null, true); }
    // Réussite : l'échec précédent est oublié.
    this.failures.delete(key);
    // Nouvelle entrée.
    const entry = { at: this.now(), data };
    // Rangée en dernière position (la plus récente).
    this.touch(key, entry);
    // Trop d'entrées : les plus anciennes sont retirées.
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
    // Résultat frais.
    return this.result(key, entry, false);
  // Fin de load.
  }

  // Méthode privée touch : range l'entrée en dernière position (récemment utilisée).
  private touch(key: string, entry: { at: number; data: T }): void {
    // Retire puis remet : la Map garde l'ordre d'insertion.
    this.entries.delete(key); this.entries.set(key, entry);
  // Fin de touch.
  }

  // Méthode privée result : habille une entrée en résultat.
  private result(key: string, entry: { at: number; data: T } | null, stale: boolean): CacheResult<T> {
    // Dernier échec de la clé, s'il y en a un.
    const failure = this.failures.get(key);
    // Donnée, heure, péremption et message d'échec.
    return { data: entry?.data ?? null, fetchedAt: entry?.at ?? null, stale: stale && entry !== null, error: failure?.message ?? null };
  // Fin de result.
  }
// Fin de TtlCache.
}

/** Taille des tuiles de détail, en degrés : 10° (environ 1 100 km à l'équateur). */
// Taille des tuiles : 10 degrés.
export const TILE_DEG = 10;

/** Indices de la tuile qui contient un point : colonne (depuis −180°) et ligne (depuis −90°). */
// Fonction tileOf : longitude, latitude et taille des tuiles.
export function tileOf(lon: number, lat: number, sizeDeg = TILE_DEG): { tx: number; ty: number } {
  // Nombre de colonnes et de lignes.
  const cols = Math.round(360 / sizeDeg), rows = Math.round(180 / sizeDeg);
  // Colonne, bornée (la longitude 180° tombe dans la dernière colonne).
  const tx = Math.min(cols - 1, Math.max(0, Math.floor((lon + 180) / sizeDeg)));
  // Ligne, bornée (la latitude 90° tombe dans la dernière ligne).
  const ty = Math.min(rows - 1, Math.max(0, Math.floor((lat + 90) / sizeDeg)));
  // Les deux indices.
  return { tx, ty };
// Fin de tileOf.
}

/** Vrai si les indices désignent une tuile du globe. */
// Fonction isTile : colonne, ligne et taille.
export function isTile(tx: number, ty: number, sizeDeg = TILE_DEG): boolean {
  // Entiers dans la grille du globe.
  return Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < Math.round(360 / sizeDeg) && ty < Math.round(180 / sizeDeg);
// Fin de isTile.
}

/** Bornes d'une tuile : [ouest, sud, est, nord], en degrés. */
// Fonction tileBounds : colonne, ligne et taille.
export function tileBounds(tx: number, ty: number, sizeDeg = TILE_DEG): [number, number, number, number] {
  // Ouest et sud.
  const w = -180 + tx * sizeDeg, s = -90 + ty * sizeDeg;
  // Les quatre bornes.
  return [w, s, w + sizeDeg, s + sizeDeg];
// Fin de tileBounds.
}

/**
 * Limite de débit glissante : au plus `max` appels sur `windowMs` (par exemple 80 par minute, sous la limite de
 * 100 par minute et par adresse IP d'un fournisseur). `take` attend qu'une place se libère, ou rejette si l'attente
 * dépasserait `maxWaitMs` : l'appel est alors refusé plutôt que de faire dépasser la limite au serveur.
 */
// Classe RateGate.
export class RateGate {
  // Heures des appels de la fenêtre, de la plus ancienne à la plus récente.
  private stamps: number[] = [];

  // Constructeur : maximum, fenêtre, horloge et attente (remplaçables pour les tests).
  constructor(private readonly max: number, private readonly windowMs = 60_000, private readonly now: () => number = Date.now, private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {}

  // Méthode privée prune : retire les appels sortis de la fenêtre.
  private prune(t: number): void {
    // Tant que le plus ancien est sorti : retiré.
    while (this.stamps.length && t - this.stamps[0] >= this.windowMs) this.stamps.shift();
  // Fin de prune.
  }

  /** Prend une place (attend au besoin) ; rejette si l'attente dépasserait `maxWaitMs`. */
  // Méthode take : attente maximale.
  async take(maxWaitMs = 15_000): Promise<void> {
    // Début de l'attente.
    const start = this.now();
    // Boucle d'attente (début).
    for (;;) {
      // Instant courant.
      const t = this.now();
      // Fenêtre à jour.
      this.prune(t);
      // Place libre : prise.
      if (this.stamps.length < this.max) { this.stamps.push(t); return; }
      // Attente jusqu'à la sortie du plus ancien appel.
      const wait = this.stamps[0] + this.windowMs - t;
      // Trop longue : refus.
      if (t - start + wait > maxWaitMs) throw new Error(`limite de ${this.max} requêtes par ${Math.round(this.windowMs / 1000)} s atteinte`);
      // Attente, par pas d'une seconde au plus.
      await this.sleep(Math.min(wait, 1_000));
    // Fin de la boucle.
    }
  // Fin de take.
  }

  /** Nombre d'appels dans la fenêtre courante. */
  // Méthode used.
  used(): number {
    // Fenêtre à jour.
    this.prune(this.now());
    // Nombre d'appels.
    return this.stamps.length;
  // Fin de used.
  }
// Fin de RateGate.
}
