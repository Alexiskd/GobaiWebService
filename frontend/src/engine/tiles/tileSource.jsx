import { fillTemplate } from './mercator';

const MIN_REFRESH_GAP_MS = 30_000;
const SHARED_IMAGE_MS = 30_000; // une image reste partagée 30 s (tuiles filles sur-zoomées qui réutilisent la même)
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Une couche de tuiles côté client : demande son modèle d'URL à l'API NestJS, le renouvelle avant son
 * expiration (ou si les tuiles se mettent à échouer), et charge les images.
 * Les images viennent directement du fournisseur : le backend ne les relaie pas.
 */
export class TileSource {
  /**
   * @param {{ api: { layer(id, signal?): Promise<object> }, layerId: string, onChange?: () => void, persistentCache?: string }} opts
   *  persistentCache  nom d'un cache persistant du navigateur (Cache Storage, sur le disque) : cache L3, les fichiers
   *                   bruts y restent d'une visite à l'autre et ne sont plus redemandés au réseau. Images de même origine
   *                   seulement (ex. Lune via le cache disque du serveur).
   */
  constructor({ api, layerId, onChange = () => {}, persistentCache = null }) {
    this.api = api;
    this.layerId = layerId;
    this.onChange = onChange;
    this.info = null;           // réponse de GET /tiles/layers/:id
    this.status = 'loading';    // 'loading' | 'ready' | 'error'
    this.error = null;
    this.failures = 0;          // échecs consécutifs d'images
    this.lastRefresh = 0;
    this.timer = null;
    this.disposed = false;
    this.refreshing = null;
    this.shared = new Map();    // url → promesse d'image (évite de télécharger 64 fois l'ancêtre d'une zone sur-zoomée)
    this.persistentCache = persistentCache;
    this.l3 = null;             // promesse du Cache Storage ouvert (ou null si indisponible)
    this.stats = { network: 0, disk: 0 };
  }

  /** Cache L3 (disque du navigateur) si disponible : contexte sécurisé (https ou localhost) requis. */
  openL3() {
    if (!this.persistentCache || typeof caches === 'undefined') return null;
    if (!this.l3) this.l3 = caches.open(this.persistentCache).catch(() => null);
    return this.l3;
  }

  get ready() { return this.status === 'ready'; }
  get minZoom() { return this.info?.minZoom ?? 0; }
  get maxZoom() { return this.info?.maxZoom ?? 0; }

  async start() {
    await this.refresh(true);
    return this;
  }

  /** (Re)demande le modèle d'URL. Les appels simultanés sont regroupés. */
  refresh(force = false) {
    if (this.disposed) return Promise.resolve();
    if (this.refreshing) return this.refreshing;
    if (!force && Date.now() - this.lastRefresh < MIN_REFRESH_GAP_MS) return Promise.resolve();
    this.refreshing = this.api.layer(this.layerId)
      .then((info) => {
        if (this.disposed) return;
        this.info = info;
        this.status = 'ready';
        this.error = null;
        this.failures = 0;
        this.lastRefresh = Date.now();
        this.scheduleRefresh();
      })
      .catch((e) => {
        if (this.disposed) return;
        this.error = e.message || String(e);
        if (!this.info) this.status = 'error'; // s'il y a déjà un modèle, on le garde et on réessaiera
        this.lastRefresh = Date.now();
      })
      .finally(() => {
        this.refreshing = null;
        if (!this.disposed) this.onChange();
      });
    return this.refreshing;
  }

  scheduleRefresh() {
    clearTimeout(this.timer);
    const at = this.info?.expiresAt ? Date.parse(this.info.expiresAt) : NaN;
    if (!Number.isFinite(at)) return;
    const delay = Math.min(MAX_TIMER_MS, Math.max(MIN_REFRESH_GAP_MS, at - Date.now() - 10 * 60_000));
    this.timer = setTimeout(() => this.refresh(true), delay);
  }

  url(coord) { return fillTemplate(this.info.urlTemplate, coord); }

  /** Charge l'image d'une tuile (avec 1 nouvel essai). Rejette en AbortError si `signal` est déclenché. */
  async loadImage(coord, signal) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        const img = await this.sharedImage(this.url(coord), signal);
        this.failures = 0;
        if (this.status === 'ready' && this.error) this.error = null;
        return img;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastError = e;
        this.failures++;
        // Plusieurs échecs d'affilée : le modèle d'URL est probablement périmé (session expirée, clé refusée).
        if (this.failures >= 4) this.refresh();
        await sleep(300 * (attempt + 1), signal);
      }
    }
    throw lastError;
  }

  /** Chargement partagé : un seul téléchargement par URL, chaque appelant garde son propre signal d'annulation. */
  sharedImage(url, signal) {
    let p = this.shared.get(url);
    if (!p) {
      p = this.loadLocal(url);
      this.shared.set(url, p);
      p.then(
        () => setTimeout(() => { if (this.shared.get(url) === p) this.shared.delete(url); }, SHARED_IMAGE_MS),
        () => { if (this.shared.get(url) === p) this.shared.delete(url); },
      );
    }
    return withSignal(p, signal);
  }

  loadLocal(url) {
    const sameOrigin = url.startsWith('/') && !url.startsWith('//');
    const l3 = sameOrigin ? this.openL3() : null;
    return l3 ? loadImageCached(url, l3, this.stats) : loadImage(url);
  }

  /**
   * Réchauffe le cache L3 : télécharge le fichier d'une tuile et l'enregistre sur le disque du navigateur, sans le
   * décoder ni l'envoyer au GPU. Renvoie false si rien n'a été fait (pas de cache L3, déjà présent).
   */
  async warm(coord) {
    const url = this.url(coord);
    const cacheP = url.startsWith('/') && !url.startsWith('//') ? this.openL3() : null;
    const cache = cacheP && await cacheP;
    if (!cache) return false;
    if (await cache.match(url).catch(() => null)) return false;
    const res = await fetch(url);
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('Tuile indisponible');
    await cache.put(url, res).catch(() => {});
    this.stats.network++;
    return true;
  }

  dispose() {
    this.disposed = true;
    this.shared.clear();
    clearTimeout(this.timer);
  }
}

const abortError = () => Object.assign(new Error('annulé'), { name: 'AbortError' });

function withSignal(p, signal) {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then((img) => { signal.removeEventListener('abort', onAbort); resolve(img); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); });
  });
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
});

/**
 * Chargement à travers le cache L3 : fichier brut lu sur le disque du navigateur s'il y est (10 à 50 ms), sinon
 * téléchargé, enregistré, puis décodé. Le décodage se fait hors du fil principal (`img.decode`).
 */
async function loadImageCached(url, cacheP, stats) {
  const cache = await cacheP;
  if (!cache) return loadImage(url);
  let res = await cache.match(url).catch(() => null);
  if (res) stats.disk++;
  else {
    res = await fetch(url);
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('Tuile indisponible');
    stats.network++;
    cache.put(url, res.clone()).catch(() => {}); // quota plein : on continue sans l'enregistrer
  }
  const blobUrl = URL.createObjectURL(await res.blob());
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = blobUrl;
    await img.decode();
    return img;
  } catch {
    cache.delete(url).catch(() => {}); // fichier abîmé : retéléchargé au prochain essai
    throw new Error('Tuile illisible');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const onAbort = () => { img.src = ''; reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
    img.onload = () => { signal?.removeEventListener('abort', onAbort); resolve(img); };
    img.onerror = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('Tuile indisponible')); };
    img.src = url;
  });
}
