// Forme du résultat d'une lecture du cache.
export interface CacheLookup<T> {
  // value : la valeur.
  value: T;
  // hit : vrai si elle vient du cache.
  hit: boolean;
  // stale : vrai si elle est périmée mais encore servie.
  stale: boolean;
  // ageMs : son âge.
  ageMs: number;
  // ttlMs : sa durée de vie.
  ttlMs: number;
// Fin de CacheLookup.
}

// Forme d'une entrée du cache.
interface CacheEntry<T> {
  // value : la valeur.
  value: T;
  // storedAt : l'heure où elle a été rangée.
  storedAt: number;
// Fin de CacheEntry.
}

// Classe TtlCache : un cache à durée de vie.
export class TtlCache<T> {
  // Entrées, par clé.
  private readonly entries = new Map<string, CacheEntry<T>>();
  // Chargements en cours, par clé.
  private readonly inflight = new Map<string, Promise<T>>();

  // Constructeur ; ses paramètres :
  constructor(
    // le nombre maximal d'entrées ;
    private readonly maxEntries: number,
    // la durée de vie ;
    private readonly ttlMs: number,
    // la durée pendant laquelle une valeur périmée est encore servie (0 par défaut).
    private readonly staleMs = 0,
  // Corps du constructeur vide.
  ) {}

  // Accesseur size.
  get size(): number {
    // Nombre d'entrées.
    return this.entries.size;
  // Fin de size.
  }

  // Accesseur ttl.
  get ttl(): number {
    // Durée de vie.
    return this.ttlMs;
  // Fin de ttl.
  }

  // Méthode get.
  get(key: string): CacheLookup<T> | null {
    // Cherche l'entrée.
    const entry = this.entries.get(key);
    // Absente :
    if (!entry) {
      // null.
      return null;
    // Fin du cas.
    }

    // Âge de l'entrée.
    const ageMs = Date.now() - entry.storedAt;
    // Trop vieille, même pour être servie périmée :
    if (ageMs >= this.ttlMs + this.staleMs) {
      // la retire ;
      this.entries.delete(key);
      // null.
      return null;
    // Fin du cas.
    }

    // La retire,
    this.entries.delete(key);
    // et la remet : elle devient la plus récente.
    this.entries.set(key, entry);

    // Renvoie
    return {
      // la valeur ;
      value: entry.value,
      // « vient du cache » ;
      hit: true,
      // périmée si elle a dépassé sa durée de vie ;
      stale: ageMs >= this.ttlMs,
      // son âge ;
      ageMs,
      // la durée de vie.
      ttlMs: this.ttlMs,
    // Fin de l'objet.
    };
  // Fin de get.
  }

  // Méthode peek.
  peek(key: string): T | undefined {
    // La valeur seule, ou undefined.
    return this.get(key)?.value;
  // Fin de peek.
  }

  // Méthode set.
  set(key: string, value: T): void {
    // Retire l'ancienne entrée.
    this.entries.delete(key);
    // Range la nouvelle, avec l'heure.
    this.entries.set(key, { value, storedAt: Date.now() });
    // Retire les entrées en trop.
    this.evict();
  // Fin de set.
  }

  // Méthode getOrLoad ; ses paramètres :
  async getOrLoad(
    // la clé ;
    key: string,
    // la fonction qui charge la valeur.
    loader: () => Promise<T>,
  // Elle renvoie le résultat de la lecture.
  ): Promise<CacheLookup<T>> {
    // Lit le cache.
    const cached = this.get(key);
    // Trouvée :
    if (cached) {
      // si elle est périmée,
      if (cached.stale) {
        // la recharge en arrière-plan, sans attendre ni remonter l'erreur.
        void this.load(key, loader).catch(() => undefined);
      // Fin du cas.
      }
      // Renvoie la valeur du cache.
      return cached;
    // Fin du cas.
    }

    // Sinon charge la valeur.
    const value = await this.load(key, loader);
    // La renvoie, marquée « pas du cache ».
    return { value, hit: false, stale: false, ageMs: 0, ttlMs: this.ttlMs };
  // Fin de getOrLoad.
  }

  // Méthode delete.
  delete(key: string): boolean {
    // Retire une entrée ; vrai si elle existait.
    return this.entries.delete(key);
  // Fin de delete.
  }

  // Méthode clear.
  clear(): void {
    // Vide le cache.
    this.entries.clear();
  // Fin de clear.
  }

  // Méthode privée load.
  private load(key: string, loader: () => Promise<T>): Promise<T> {
    // Cherche un chargement en cours.
    const pending = this.inflight.get(key);
    // Trouvé :
    if (pending) {
      // le renvoie.
      return pending;
    // Fin du cas.
    }

    // Lance le chargement ;
    const task = loader()
      // quand il réussit :
      .then((value) => {
        // range la valeur ;
        this.set(key, value);
        // la rend.
        return value;
      // Fin du traitement.
      })
      // Dans tous les cas :
      .finally(() => {
        // si c'est toujours ce chargement qui est inscrit,
        if (this.inflight.get(key) === task) {
          // le retire de la liste.
          this.inflight.delete(key);
        // Fin du cas.
        }
      // Fin du traitement.
      });
    // L'inscrit dans la liste.
    this.inflight.set(key, task);
    // Renvoie la promesse.
    return task;
  // Fin de load.
  }

  // Méthode privée evict.
  private evict(): void {
    // Tant qu'il y a trop d'entrées :
    while (this.entries.size > this.maxEntries) {
      // clé de la plus ancienne ;
      const oldest = this.entries.keys().next();
      // aucune :
      if (oldest.done) {
        // fin.
        return;
      // Fin du cas.
      }
      // La retire.
      this.entries.delete(oldest.value);
    // Fin de la boucle.
    }
  // Fin de evict.
  }
// Fin de la classe.
}
