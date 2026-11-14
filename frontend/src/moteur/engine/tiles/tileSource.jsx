// Importe fillTemplate, le remplissage d'un modèle d'adresse, depuis mercator.
import { fillTemplate } from './mercator';
// Importe le test « cette adresse vise-t-elle une API déconnectée ? ».
import { isUrlBlocked } from '../../lib/apiBlock';
// Importe (début)
import {
  // les mémoires, la mesure des couleurs et les fonctions du chargement direct des images de la Terre,
  ColorStats, DirectBreaker, EmptyMemo, LevelGate, MissingMemo, THUMB, applyGain, blankRatio, blankZone, composeZoned, cropRect, farCandidatesAt,
  // ainsi que le remplissage d'une adresse, le test d'image vide, le choix de la source suivante et la validation du plan,
  fillDirect, isBlankPixels, nextAttempt, tileTouches, validPlan, worldOrigins,
// depuis earthDirect.
} from './earthDirect';
// Importe la lecture et l'enregistrement de la description d'une couche, depuis layerInfoCache.
import { readLayerInfo, saveLayerInfo } from './layerInfoCache';
// Importe diskWritten, le signal d'une écriture au cache sur disque, depuis diskCache.
import { diskWritten } from './diskCache';

// Délai minimal entre deux renouvellements du modèle d'adresse : 30 secondes.
const MIN_REFRESH_GAP_MS = 30_000;
// Durée de partage d'une image : 30 secondes.
const SHARED_IMAGE_MS = 30_000; // une image reste partagée 30 s (tuiles filles sur-zoomées qui réutilisent la même)
// Délai maximal d'une minuterie : 2³¹ − 1 millisecondes.
const MAX_TIMER_MS = 2 ** 31 - 1;
// Délai d'un chargement direct avant le repli sur le relais : 4 secondes.
const DIRECT_TIMEOUT_MS = 4000;  // tuile chargée chez son fournisseur : au-delà, on la demande au relais du serveur
// Nombre maximal de sources essayées pour une tuile : 12.
const DIRECT_MAX_STEPS = 12;     // sources essayées au plus pour une tuile (vides comprises) avant le relais
// Clé de l'interrupteur du chargement direct, dans le stockage du navigateur.
const DIRECT_SWITCH = 'gobai:tuiles-directes'; // « 0 » dans le stockage du navigateur : tout repasse par le relais

// Clé de l'interrupteur de l'accord des couleurs.
const COLOR_SWITCH = 'gobai:couleurs';       // « 0 » : pas d'accord des couleurs entre les couches
// Clé des mesures de couleur gardées.
const COLOR_STORE = 'gobai:couleurs-v1';     // mesures de couleur par source, gardées d'une visite à l'autre
// Taille des vignettes de comparaison des couleurs : 32 px.
const COLOR_PX = 32;                         // les couleurs sont comparées sur des vignettes de 32 px (tons d'ensemble)
// Part de vignette sans image au-delà de laquelle la tuile est vide : 99,5 %.
const NONE = 0.995;                          // part de la vignette sans image au-delà de laquelle la tuile est vide

// colorAllowed : l'accord des couleurs est-il permis dans ce navigateur (début).
function colorAllowed() {
  // Vrai sauf si l'interrupteur vaut « 0 » ; vrai aussi si le stockage est refusé.
  try { return globalThis.localStorage?.getItem(COLOR_SWITCH) !== '0'; } catch { return true; }
// Fin de colorAllowed.
}
/** Stockage du navigateur, ou null (navigation privée stricte, tests). */
// storage : le stockage du navigateur (début).
function storage() {
  // Le renvoie, ou null s'il est absent ou refusé.
  try { return globalThis.localStorage || null; } catch { return null; }
// Fin de storage.
}
// Origines déjà annoncées au navigateur.
const preconnected = new Set(); // origines déjà annoncées au navigateur

// readColors : les mesures de couleur gardées (début).
function readColors() {
  // Les lit dans le stockage ; un objet vide en cas d'absence ou d'erreur.
  try { return JSON.parse(globalThis.localStorage?.getItem(COLOR_STORE) || '{}') || {}; } catch { return {}; }
// Fin de readColors.
}

/** Chargement direct autorisé dans ce navigateur ? (interrupteur de secours, lu une fois par couche) */
// directAllowed : le chargement direct est-il permis dans ce navigateur (début).
function directAllowed() {
  // Vrai sauf si l'interrupteur vaut « 0 » ; vrai aussi si le stockage est refusé.
  try { return globalThis.localStorage?.getItem(DIRECT_SWITCH) !== '0'; } catch { return true; }
// Fin de directAllowed.
}

/**
 * Une couche de tuiles côté client : demande son modèle d'URL à l'API NestJS, le renouvelle avant son
 * expiration (ou si les tuiles se mettent à échouer), et charge les images.
 * Les images viennent directement du fournisseur : le backend ne les relaie pas.
 *
 * Couche unique de la Terre : `info.direct` donne les sources d'imagerie et leurs modèles d'adresse. Le navigateur
 * choisit alors lui-même la source de chaque tuile et la charge chez son fournisseur (voir earthDirect.jsx) ; le
 * relais du serveur (`urlTemplate`) ne sert plus que pour les services qu'on ne peut pas charger d'ici, et en secours
 * dès qu'un chargement direct échoue. Une tuile au-delà du niveau natif est découpée ici dans son ancêtre.
 *
 * Vue de loin (`lowZoom` d'une source nationale) : au-dessus de son niveau natif, la source est posée par-dessus
 * l'image du monde, pixel par pixel là où elle a une image : le pays garde son imagerie détaillée, en réduit.
 * Couleurs : chaque source nationale est accordée sur la mosaïque mondiale (gain et décalage par canal, mesurés sur
 * quelques tuiles puis gardés) ; le shader des tuiles applique la correction portée par l'image (`__color`).
 */
// Déclare et exporte la classe TileSource (début).
export class TileSource {
  /**
   * @param {{ api: { layer(id, signal?): Promise<object> }, layerId: string, onChange?: () => void, persistentCache?: string }} opts
   *  persistentCache  nom d'un cache persistant du navigateur (Cache Storage, sur le disque) : cache L3, les fichiers
   *                   bruts y restent d'une visite à l'autre et ne sont plus redemandés au réseau. Images de même origine
   *                   seulement (ex. Lune via le cache disque du serveur).
   */
  // Constructeur : l'API, l'identifiant de la couche, la fonction de changement et les deux caches sur disque (début).
  constructor({ api, layerId, onChange = () => {}, persistentCache = null, directCache = null }) {
    // Garde l'API.
    this.api = api;
    // Garde l'identifiant de la couche.
    this.layerId = layerId;
    // Garde la fonction de changement.
    this.onChange = onChange;
    // Description de la couche : pas encore reçue.
    this.info = null;           // réponse de GET /tiles/layers/:id
    // Statut : en chargement.
    this.status = 'loading';    // 'loading' | 'ready' | 'error'
    // Aucune erreur.
    this.error = null;
    // Échecs consécutifs : 0.
    this.failures = 0;          // échecs consécutifs d'images
    // Instant du dernier renouvellement.
    this.lastRefresh = 0;
    // Minuterie du prochain renouvellement.
    this.timer = null;
    // Pas encore libérée.
    this.disposed = false;
    // Renouvellement en cours : aucun.
    this.refreshing = null;
    // Images partagées, par adresse.
    this.shared = new Map();    // url → promesse d'image (évite de télécharger 64 fois l'ancêtre d'une zone sur-zoomée)
    // Garde le nom du cache persistant.
    this.persistentCache = persistentCache;
    // Cache persistant : pas encore ouvert.
    this.l3 = null;             // promesse du Cache Storage ouvert (ou null si indisponible)
    // Compteurs : réseau, disque, direct et relais.
    this.stats = { network: 0, disk: 0, direct: 0, relay: 0 };
    // Chargement direct permis ?
    this.directOn = directAllowed();
    // Tuiles vues vides, par source.
    this.directEmpty = new EmptyMemo();     // tuiles vues vides, par source
    // Tuiles absentes chez une source qui fonctionne (erreur immédiate : mer, pays voisin) : oubliées après 10 minutes.
    // Tuiles absentes chez une source qui fonctionne.
    this.directMissing = new MissingMemo();
    // Sources en panne en direct.
    this.directBreaker = new DirectBreaker(); // sources en panne en direct
    // Variante d'adresse qui a répondu en dernier, par source.
    this.directVariant = new Map();         // source → variante d'adresse qui a répondu en dernier
    // Images déjà contrôlées : vides ou non.
    this.blankChecked = new WeakMap();      // image → vide ou non (un ancêtre partagé n'est contrôlé qu'une fois)
    // Fond instantané : fichiers des tuiles chargées en direct jusqu'au niveau `maxZoom`, et de la vue de loin, gardés
    // sur le disque du navigateur ({ name, maxZoom }) : aux visites suivantes ils ne repassent plus par le réseau.
    // Garde le cache des tuiles directes.
    this.directCache = directCache;
    // Ce cache : pas encore ouvert.
    this.directL3 = null;
    // Vue de loin : tuiles vues vides, par source.
    this.farEmpty = new EmptyMemo();        // vue de loin : tuiles vues vides, par source (mémoire séparée des niveaux natifs)
    // Tuiles natives vues entièrement couvertes, par source : leurs descendantes le sont aussi, donc plus aucun
    // contrôle de pixels pour elles (l'intérieur d'un pays se charge sans lecture d'image).
    // Tuiles natives vues entièrement couvertes, par source.
    this.directFull = new EmptyMemo();
    // Vue de loin : niveaux qu'une source ne sert pas.
    this.levelGate = new LevelGate();       // vue de loin : niveaux qu'une source ne sert pas
    // Accord des couleurs permis ?
    this.colorOn = colorAllowed();
    // État de couleur de chaque source.
    this.colors = new Map();                // source → { gain, offset, stats } (tableaux partagés avec le shader)
    // Sources dont une mesure est en cours.
    this.colorBusy = new Set();             // sources dont une mesure de couleur est en cours
    // Mesures gardées des visites précédentes.
    this.savedColors = readColors();
    // Demandes urgentes (tuiles à l'écran) : repérées par leur signal d'annulation, transmis tel quel jusqu'au réseau.
    // Signaux des demandes urgentes.
    this.urgent = new WeakSet();
  // Fin du constructeur.
  }

  /** Ouvre d'avance la connexion avec les serveurs des images du monde (une fois par origine). */
  // preconnect : ouvre d'avance les connexions vers les serveurs d'images (début).
  preconnect() {
    // Le document de la page.
    const doc = globalThis.document;
    // Le plan de chargement direct.
    const plan = this.directPlan;
    // Sans page ou sans plan : rien à faire.
    if (!doc?.head || !plan) return;
    // Pour chaque origine des images du monde (début).
    for (const origin of worldOrigins(plan)) {
      // Déjà annoncée : suivante.
      if (preconnected.has(origin)) continue;
      // La note.
      preconnected.add(origin);
      // Crée une balise link.
      const link = doc.createElement('link');
      // De type « preconnect ».
      link.rel = 'preconnect';
      // Vers l'origine.
      link.href = origin;
      // Sans identifiants.
      link.crossOrigin = 'anonymous';
      // L'ajoute à l'en-tête de la page.
      doc.head.appendChild(link);
    // Fin de la boucle.
    }
  // Fin de preconnect.
  }

  /** Cache disque des tuiles chargées en direct (fond instantané), ou null. */
  // openDirectL3 : ouvre le cache sur disque des tuiles directes (début).
  openDirectL3() {
    // Sans nom de cache, ou sans Cache Storage : null.
    if (!this.directCache?.name || typeof caches === 'undefined') return null;
    // L'ouvre à la première demande ; null en cas d'échec.
    if (!this.directL3) this.directL3 = caches.open(this.directCache.name).catch(() => null);
    // Renvoie la promesse.
    return this.directL3;
  // Fin de openDirectL3.
  }

  /** Accord des couleurs actif pour cette couche ? */
  // colorMatch : vrai si l'accord des couleurs est permis ici et non refusé par la couche.
  get colorMatch() { return this.colorOn && this.info?.colorMatch !== false; }

  /** État de couleur d'une source : gain et décalage (tableaux lus par le shader, mis à jour sur place) et mesures. */
  // colorState : l'état de couleur d'une source (début).
  colorState(id) {
    // État déjà créé.
    let st = this.colors.get(id);
    // S'il n'existe pas (début).
    if (!st) {
      // Gain de 1, décalage de 0 et mesures reprises de la visite précédente.
      st = { gain: new Float32Array([1, 1, 1]), offset: new Float32Array(3), stats: new ColorStats(this.savedColors[id]) };
      // Applique la correction déjà mesurée.
      applyColor(st);
      // Le garde.
      this.colors.set(id, st);
    // Fin de ce cas.
    }
    // Le renvoie.
    return st;
  // Fin de colorState.
  }

  /** Plan de chargement direct de la couche (sources dans l'ordre du serveur), ou null : tout passe par le relais. */
  // directPlan : le plan de chargement direct de la couche (début).
  get directPlan() {
    // Plan donné par la description de la couche.
    const plan = this.info?.direct;
    // Le renvoie s'il est permis et valide, sinon null.
    return this.directOn && validPlan(plan) ? plan : null;
  // Fin de directPlan.
  }

  /** Cache L3 (disque du navigateur) si disponible : contexte sécurisé (https ou localhost) requis. */
  // openL3 : ouvre le cache persistant (début).
  openL3() {
    // Sans nom de cache, ou sans Cache Storage : null.
    if (!this.persistentCache || typeof caches === 'undefined') return null;
    // L'ouvre à la première demande ; null en cas d'échec.
    if (!this.l3) this.l3 = caches.open(this.persistentCache).catch(() => null);
    // Renvoie la promesse.
    return this.l3;
  // Fin de openL3.
  }

  // ready : vrai quand le statut est « ready ».
  get ready() { return this.status === 'ready'; }
  // minZoom : le niveau minimal de la couche, ou 0.
  get minZoom() { return this.info?.minZoom ?? 0; }
  // maxZoom : le niveau maximal de la couche, ou 0.
  get maxZoom() { return this.info?.maxZoom ?? 0; }

  /**
   * La couche a-t-elle une image pour cette tuile ? Vrai par défaut. Une couche limitée à une emprise (`info.bounds`,
   * ex. calque LiDAR HD sur la France) n'est demandée que pour les tuiles qui la touchent, à partir de son niveau
   * minimal : ailleurs sur le globe, aucune requête.
   */
  // covers : la couche a-t-elle une image pour cette tuile (début).
  covers({ z, x, y }) {
    // Emprises de la couche.
    const bounds = this.info?.bounds;
    // Aucune : vrai.
    if (!Array.isArray(bounds) || !bounds.length) return true;
    // Vrai à partir du niveau minimal, si la tuile touche une emprise.
    return z >= this.minZoom && bounds.some((box) => tileTouches(box, z, x, y));
  // Fin de covers.
  }

  // start, asynchrone : démarre la couche (début).
  async start() {
    // Description gardée de la visite précédente : les tuiles partent tout de suite, la description à jour arrive
    // en arrière-plan (voir layerInfoCache.jsx).
    // Description gardée de la visite précédente.
    const cached = readLayerInfo(storage(), this.layerId);
    // S'il y en a une (début).
    if (cached) {
      // Elle sert tout de suite.
      this.info = cached;
      // La couche est prête.
      this.status = 'ready';
      // Ouvre les connexions d'avance.
      this.preconnect();
      // Demande la description à jour, sans l'attendre.
      this.refresh(true);
      // Renvoie la source.
      return this;
    // Fin de ce cas.
    }
    // Sinon : attend la description.
    await this.refresh(true);
    // Renvoie la source.
    return this;
  // Fin de start.
  }

  /** (Re)demande le modèle d'URL. Les appels simultanés sont regroupés. */
  // refresh : demande le modèle d'adresse, de nouveau si besoin (début).
  refresh(force = false) {
    // Source libérée : rien.
    if (this.disposed) return Promise.resolve();
    // Demande déjà en cours : la même promesse.
    if (this.refreshing) return this.refreshing;
    // Sans forcer, moins de 30 secondes après la dernière : rien.
    if (!force && Date.now() - this.lastRefresh < MIN_REFRESH_GAP_MS) return Promise.resolve();
    // Demande la description à l'API.
    this.refreshing = this.api.layer(this.layerId)
      // À la réponse (début).
      .then((info) => {
        // Source libérée entre-temps : rien.
        if (this.disposed) return;
        // Garde la description.
        this.info = info;
        // La couche est prête.
        this.status = 'ready';
        // Efface l'erreur.
        this.error = null;
        // Remet les échecs à zéro.
        this.failures = 0;
        // Note l'instant.
        this.lastRefresh = Date.now();
        // Programme le renouvellement suivant.
        this.scheduleRefresh();
        // Enregistre la description pour la visite suivante.
        saveLayerInfo(storage(), this.layerId, info);
        // Ouvre les connexions d'avance.
        this.preconnect();
      // Fin de la réponse.
      })
      // En cas d'erreur (début).
      .catch((e) => {
        // Source libérée entre-temps : rien.
        if (this.disposed) return;
        // Garde le message.
        this.error = e.message || String(e);
        // Sans description : statut en erreur.
        if (!this.info) this.status = 'error'; // s'il y a déjà un modèle, on le garde et on réessaiera
        // Note l'instant.
        this.lastRefresh = Date.now();
      // Fin de l'erreur.
      })
      // Dans tous les cas (début).
      .finally(() => {
        // Plus de demande en cours.
        this.refreshing = null;
        // Prévient l'interface, si la source n'est pas libérée.
        if (!this.disposed) this.onChange();
      // Fin de ce bloc.
      });
    // Renvoie la promesse.
    return this.refreshing;
  // Fin de refresh.
  }

  // scheduleRefresh : programme le renouvellement avant l'expiration (début).
  scheduleRefresh() {
    // Annule la minuterie en place.
    clearTimeout(this.timer);
    // Instant d'expiration, s'il est donné.
    const at = this.info?.expiresAt ? Date.parse(this.info.expiresAt) : NaN;
    // Sans expiration : rien à programmer.
    if (!Number.isFinite(at)) return;
    // Délai : 10 minutes avant l'expiration, 30 secondes au moins, borné par la minuterie.
    const delay = Math.min(MAX_TIMER_MS, Math.max(MIN_REFRESH_GAP_MS, at - Date.now() - 10 * 60_000));
    // Lance la minuterie.
    this.timer = setTimeout(() => this.refresh(true), delay);
  // Fin de scheduleRefresh.
  }

  // url : l'adresse d'une tuile, d'après le modèle de la couche.
  url(coord) { return fillTemplate(this.info.urlTemplate, coord); }

  /**
   * Charge l'image d'une tuile (avec 1 nouvel essai). Rejette en AbortError si `signal` est déclenché.
   * `urgent` : tuile à l'écran, demandée au réseau en priorité haute (les préchargements gardent la priorité normale).
   */
  // loadImage, asynchrone : charge l'image d'une tuile (début).
  async loadImage(coord, signal, urgent = false) {
    // Demande urgente : note son signal.
    if (urgent && signal) this.urgent.add(signal);
    // Plan de chargement direct.
    const plan = this.directPlan;
    // S'il y en a un (début).
    if (plan) {
      // Chargement direct d'abord ; au moindre échec (hors annulation), la tuile est demandée au relais comme avant.
      // Essai (début).
      try {
        // Charge la tuile chez son fournisseur.
        const img = await this.loadDirect(plan, coord, signal);
        // Si une image est arrivée (début).
        if (img) {
          // Remet les échecs à zéro.
          this.failures = 0;
          // Compte un chargement direct.
          this.stats.direct++;
          // La renvoie.
          return img;
        // Fin de ce cas.
        }
      // En cas d'erreur (début).
      } catch (e) {
        // Une annulation est relancée ; toute autre erreur mène au relais.
        if (e.name === 'AbortError') throw e;
      // Fin de l'essai.
      }
      // Compte un passage par le relais.
      this.stats.relay++;
    // Fin du chargement direct.
    }
    // Dernière erreur.
    let lastError;
    // Deux essais au plus (début).
    for (let attempt = 0; attempt < 2; attempt++) {
      // Demande annulée : erreur d'abandon.
      if (signal?.aborted) throw abortError();
      // Essai (début).
      try {
        // Charge l'image à l'adresse du relais.
        const img = await this.sharedImage(this.url(coord), signal);
        // Remet les échecs à zéro.
        this.failures = 0;
        // Efface l'erreur affichée, si la couche est prête.
        if (this.status === 'ready' && this.error) this.error = null;
        // Renvoie l'image.
        return img;
      // En cas d'erreur (début).
      } catch (e) {
        // Une annulation est relancée.
        if (e.name === 'AbortError') throw e;
        // Garde l'erreur.
        lastError = e;
        // Un échec de plus.
        this.failures++;
        // Plusieurs échecs d'affilée : le modèle d'URL est probablement périmé (session expirée, clé refusée).
        // À partir de 4 échecs d'affilée : redemande le modèle d'adresse.
        if (this.failures >= 4) this.refresh();
        // Attend 300 ms, puis 600 ms.
        await sleep(300 * (attempt + 1), signal);
      // Fin de l'essai.
      }
    // Fin de la boucle.
    }
    // Les deux essais ont échoué : relance la dernière erreur.
    throw lastError;
  // Fin de loadImage.
  }

  /**
   * Tuile chargée chez son fournisseur : la source la plus détaillée qui couvre l'endroit, la suivante si elle
   * répond par une tuile vide, un ancêtre découpé au-delà du niveau natif. Renvoie null quand la tuile doit passer
   * par le relais (source non chargeable d'ici, panne, délai dépassé).
   */
  // loadDirect, asynchrone : charge une tuile chez son fournisseur (début).
  async loadDirect(plan, { z, x, y }, signal) {
    // Vue de loin : sources nationales posées sur l'image du monde. Sans résultat, chemin habituel.
    // Sources nationales de la vue de loin : utilisables, servant ce niveau,
    const far = farCandidatesAt(plan, z, x, y).filter((s) => this.directBreaker.usable(s.id) && this.levelGate.usable(s.id, z)
      // et pas déjà vues vides ici.
      && !this.farEmpty.isEmpty(s.id, z, x, y, s.lowZoom));
    // S'il y en a (début).
    if (far.length) {
      // Compose la mosaïque de la vue de loin.
      const img = await this.loadFar(plan, far, z, x, y, signal);
      // Obtenue : la renvoie.
      if (img) return img;
    // Fin de ce cas.
    }
    // Sinon : chemin habituel.
    return this.loadNative(plan, z, x, y, signal);
  // Fin de loadDirect.
  }

  /**
   * Vue de loin : mosaïque de la tuile. Chaque source nationale est lue à ce niveau (sa mosaïque réduite) ; une tuile
   * entièrement couverte par la première est rendue telle quelle, sinon les sources sont posées sur l'image du monde
   * là où elles ont une image. null : rien à poser ici (ou image du monde indisponible), chemin habituel.
   */
  // loadFar, asynchrone : la mosaïque d'une tuile en vue de loin (début).
  async loadFar(plan, far, z, x, y, signal) {
    // Couches à poser.
    const layers = [];
    // Pour chaque source (début).
    for (const source of far) {
      // Demande annulée : erreur d'abandon.
      if (signal?.aborted) throw abortError();
      // Image de la source à ce niveau.
      const img = await this.farImage(source, z, x, y, signal);
      // Sa vignette.
      const thumb = img && this.pixels(img, THUMB);
      // Sans vignette : source suivante.
      if (!thumb) continue;
      // Vignette presque vide : la tuile est notée vide pour cette source ; suivante.
      if (blankRatio(thumb) > NONE) { this.farEmpty.mark(source.id, z, x, y); continue; }
      // Zone sans image.
      const zone = blankZone(thumb);
      // État de couleur de la source, si l'accord est actif.
      const st = this.colorMatch ? this.colorState(source.id) : null;
      // Image complète et aucune couche avant elle (début).
      if (!zone && !layers.length) {
        // Elle porte sa correction de couleur.
        if (st) img.__color = st;
        // Elle est renvoyée telle quelle.
        return img;
      // Fin de ce cas.
      }
      // Ajoute la couche.
      layers.push({ img, zone, st });
      // Image complète : inutile de lire les sources suivantes.
      if (!zone) break; // cette source couvre tout ce qui reste
    // Fin de la boucle.
    }
    // Aucune couche : rien à poser.
    if (!layers.length) return null;
    // Image du monde, par le chemin habituel.
    const base = await this.loadNative(plan, z, x, y, signal);
    // Ses pixels.
    const out = base && this.basePixels(base);
    // Sans pixels : rien.
    if (!out) return null;
    // De la moins prioritaire à la plus prioritaire : chacune recouvre les précédentes là où elle a une image.
    // Pose les couches, de la moins prioritaire à la plus prioritaire.
    for (const layer of layers.reverse()) this.layOver(out, layer.img, layer.zone, layer.st);
    // Renvoie le canevas.
    return this.canvasFrom(out);
  // Fin de loadFar.
  }

  /** Pixels (256 px) d'une image de fond, avec sa correction de couleur déjà appliquée si elle en porte une. */
  // basePixels : les pixels d'une image de fond, en 256 px (début).
  basePixels(img) {
    // Lit les pixels.
    const data = this.pixels(img, 256);
    // Correction de couleur portée par l'image.
    const st = img.__color;
    // Si elle est prête : l'applique.
    if (data && st?.stats.ready) applyGain(data, st.gain, st.offset);
    // Renvoie les pixels.
    return data;
  // Fin de basePixels.
  }

  /** Pose une image sur des pixels de fond, sauf dans sa zone sans image ; applique sa correction de couleur. */
  // layOver : pose une image sur des pixels de fond (début).
  layOver(out, img, zone, st) {
    // Ses pixels.
    const data = this.pixels(img, 256);
    // Les compose hors de la zone sans image, avec sa correction de couleur si elle est prête.
    if (data) composeZoned(out, { data, gain: st?.stats.ready ? st.gain : null, offset: st?.offset }, zone);
  // Fin de layOver.
  }

  /**
   * Bord de couverture (frontière, côte) : si la tuile d'une source nationale a une zone sans image, le trou est
   * comblé par la source suivante (autre pays, ou image du monde). Renvoie la tuile comblée, ou null s'il n'y a
   * rien à combler (ou rien pour combler).
   */
  // patchHoles, asynchrone : comble le trou d'une tuile au bord d'une couverture (début).
  async patchHoles(plan, a, img, st, z, x, y, signal) {
    // La source.
    const source = a.source;
    // Vignette de l'image.
    const thumb = this.pixels(img, THUMB);
    // Zone sans image.
    const zone = thumb && blankZone(thumb);
    // Sans trou (début).
    if (!zone) {
      // Tuile native entièrement couverte : notée, ses descendantes ne seront plus contrôlées.
      // Vignette lue, au niveau natif : la tuile est notée entièrement couverte.
      if (thumb && !a.depth) this.directFull.mark(source.id, z, x, y);
      // Rien à combler.
      return null;
    // Fin de ce cas.
    }
    // Image des sources suivantes du plan.
    const under = await this.loadNative(plan.slice(plan.indexOf(source) + 1), z, x, y, signal);
    // Ses pixels.
    const out = under && this.basePixels(under);
    // Sans pixels : rien.
    if (!out) return null;
    // Pose l'image par-dessus, hors du trou.
    this.layOver(out, img, zone, st);
    // Renvoie le canevas.
    return this.canvasFrom(out);
  // Fin de patchHoles.
  }

  /** Tuile d'une source nationale au-dessus de son niveau natif : image, ou null (niveau non servi, échec). */
  // farImage, asynchrone : la tuile d'une source nationale en vue de loin (début).
  async farImage(source, z, x, y, signal) {
    // Modèles d'adresse de la source.
    const templates = source.templates;
    // Variante qui a répondu en dernier, ou la première.
    const first = this.directVariant.get(source.id) ?? 0;
    // Pour chaque variante (début).
    for (let i = 0; i < templates.length; i++) {
      // Son indice, en partant de la dernière bonne.
      const k = (first + i) % templates.length;
      // Essai (début).
      try {
        // Charge l'image, 4 secondes au plus, en la gardant sur le disque.
        const img = await withTimeout(this.sharedImage(fillDirect(templates[k], z, x, y), signal, true), DIRECT_TIMEOUT_MS);
        // La source sert ce niveau.
        this.levelGate.ok(source.id, z);
        // Renvoie l'image.
        return img;
      // En cas d'erreur (début).
      } catch (e) {
        // Une annulation est relancée.
        if (e.name === 'AbortError') throw e;
      // Fin de l'essai.
      }
    // Fin de la boucle.
    }
    // Aucune variante n'a répondu : échec noté pour ce niveau.
    this.levelGate.fail(source.id, z);
    // Rien.
    return null;
  // Fin de farImage.
  }

  /** Chemin habituel : la source la plus détaillée au niveau natif, sinon un ancêtre découpé. */
  // loadNative, asynchrone : le chemin habituel d'une tuile en direct (début).
  async loadNative(plan, z, x, y, signal) {
    // isEmpty : la tuile est-elle notée vide ou absente pour cette source.
    const isEmpty = (s, tz, tx, ty) => this.directEmpty.isEmpty(s.id, tz, tx, ty, s.minZoom) || this.directMissing.isEmpty(s.id, tz, tx, ty, s.minZoom);
    // usable : la source est-elle utilisable.
    const usable = (id) => this.directBreaker.usable(id);
    // Douze étapes au plus (début).
    for (let step = 0; step < DIRECT_MAX_STEPS; step++) {
      // Demande annulée : erreur d'abandon.
      if (signal?.aborted) throw abortError();
      // Prochaine tentative, d'après le plan.
      const a = nextAttempt(plan, z, x, y, { isEmpty, usable });
      // Si ce n'est pas un chargement direct : rien, la tuile passera par le relais.
      if (a.kind !== 'direct') return null;
      // Image de la source.
      const img = await this.directImage(a.source, a.z, a.x, a.y, signal);
      // Tuile vide : étape suivante.
      if (img === EMPTY) continue; // source hors de son territoire ici : notée, on passe à la suivante
      // Panne : rien.
      if (!img) return null;
      // Source nationale : l'image porte sa correction de couleur, et sert de mesure tant qu'il en manque.
      // État de couleur, pour une source nationale avec l'accord actif.
      const st = a.source.bboxes && this.colorMatch ? this.colorState(a.source.id) : null;
      // Mesures incomplètes, au niveau natif : lance une mesure de couleur.
      if (st && !st.stats.full && !a.depth) this.sampleColor(plan, a.source, img, z, x, y);
      // Au-delà du niveau natif : découpe la tuile dans son ancêtre.
      const out = a.depth ? cropFromAncestor(img, a.depth, x, y) : img;
      // L'image porte sa correction de couleur.
      if (st) out.__color = st;
      // Source nationale, tuile pas encore vue entièrement couverte (début).
      if (a.source.bboxes && !this.directFull.isEmpty(a.source.id, a.z, a.x, a.y, a.source.minZoom)) {
        // Trou au bord de la couverture : comblé par la source suivante. Un échec ici laisse la tuile telle quelle.
        // Comble un trou éventuel ; une annulation est relancée, tout autre échec est ignoré.
        const patched = await this.patchHoles(plan, a, out, st, z, x, y, signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; });
        // Tuile comblée : la renvoie.
        if (patched) return patched;
      // Fin de ce cas.
      }
      // Renvoie l'image.
      return out;
    // Fin de la boucle.
    }
    // Rien après douze étapes.
    return null;
  // Fin de loadNative.
  }

  /**
   * Mesure de couleur (en arrière-plan, une à la fois par source) : la tuile de la source est comparée au même
   * endroit de la mosaïque mondiale, sur des vignettes. Le résultat met à jour la correction de toutes les tuiles
   * de la source déjà affichées (tableaux partagés) et il est gardé pour les visites suivantes.
   */
  // sampleColor, asynchrone : mesure la couleur d'une source (début).
  async sampleColor(plan, source, img, z, x, y) {
    // Mesure déjà en cours pour cette source : rien.
    if (this.colorBusy.has(source.id)) return;
    // Note la mesure en cours.
    this.colorBusy.add(source.id);
    // Essai (début).
    try {
      // État de couleur de la source.
      const st = this.colorState(source.id);
      // Sources mondiales du plan.
      const world = plan.filter((s) => !s.bboxes);
      // Tentative pour l'image du monde au même endroit.
      const a = nextAttempt(world, z, x, y, { usable: (id) => this.directBreaker.usable(id) });
      // Si ce n'est pas un chargement direct : rien.
      if (a.kind !== 'direct') return;
      // Image de référence.
      const ref = await this.directImage(a.source, a.z, a.x, a.y);
      // Absente ou vide : rien.
      if (!ref || ref === EMPTY) return;
      // Vignette de la référence, découpée dans son ancêtre si besoin.
      const refPx = this.pixels(ref, COLOR_PX, a.depth ? cropRect(ref.naturalWidth || ref.width || 256, a.depth, x, y) : null);
      // Vignette de la source.
      const srcPx = this.pixels(img, COLOR_PX);
      // Sans vignettes, ou mesure refusée : rien.
      if (!refPx || !srcPx || !st.stats.add(srcPx, refPx)) return;
      // Reporte la correction.
      applyColor(st);
      // Garde les mesures.
      this.savedColors[source.id] = st.stats.toJSON();
      // Les enregistre dans le stockage ; un refus est ignoré.
      try { globalThis.localStorage?.setItem(COLOR_STORE, JSON.stringify(this.savedColors)); } catch { /* stockage refusé : valable pour la session */ }
    // Toute erreur est ignorée ; dans tous les cas (début).
    } catch { /* mesure facultative : la tuile est déjà affichée */ } finally {
      // La mesure n'est plus en cours.
      this.colorBusy.delete(source.id);
    // Fin de l'essai.
    }
  // Fin de sampleColor.
  }

  /**
   * Une source en direct : image, EMPTY si la source n'a rien à cet endroit, null en cas de panne.
   * EMPTY : tuile vide (source nationale hors de son territoire), ou erreur immédiate d'une source qui vient de
   * donner d'autres images — le fournisseur répond « pas de tuile ici » (mer, pays voisin dans son emprise). La
   * source suivante sert alors la tuile, en direct ; la source n'est pas comptée en panne, donc pas coupée pour
   * les tuiles voisines. Un délai dépassé, ou une source qui n'a encore rien donné, reste une panne.
   */
  // directImage, asynchrone : l'image d'une source en direct, EMPTY ou null (début).
  async directImage(source, z, x, y, signal) {
    // Modèles d'adresse de la source.
    const templates = source.templates;
    // Variante qui a répondu en dernier, ou la première.
    const first = this.directVariant.get(source.id) ?? 0;
    // Délai dépassé ? Non pour l'instant.
    let timedOut = false;
    // Pour chaque variante (début).
    for (let i = 0; i < templates.length; i++) {
      // Son indice, en partant de la dernière bonne.
      const k = (first + i) % templates.length;
      // Essai (début).
      try {
        // À garder sur le disque : jusqu'au niveau maximal du cache.
        const persist = Boolean(this.directCache) && z <= this.directCache.maxZoom;
        // Charge l'image, 4 secondes au plus.
        const img = await withTimeout(this.sharedImage(fillDirect(templates[k], z, x, y), signal, persist), DIRECT_TIMEOUT_MS);
        // Retient la variante.
        this.directVariant.set(source.id, k);
        // Note le succès de la source.
        this.directBreaker.success(source.id);
        // Source nationale, tuile pas vue entièrement couverte et image vide (début).
        if (source.bboxes && !this.directFull.isEmpty(source.id, z, x, y, source.minZoom) && this.isBlank(img)) {
          // La tuile est notée vide.
          this.directEmpty.mark(source.id, z, x, y);
          // Renvoie EMPTY.
          return EMPTY;
        // Fin de ce cas.
        }
        // Renvoie l'image.
        return img;
      // En cas d'erreur (début).
      } catch (e) {
        // Une annulation est relancée.
        if (e.name === 'AbortError') throw e;
        // Un délai dépassé est noté.
        if (e.name === 'TimeoutError') timedOut = true;
      // Fin de l'essai.
      }
    // Fin de la boucle.
    }
    // Hors ligne, tout échoue tout de suite : ce n'est pas la tuile qui manque.
    // Sans délai dépassé, en ligne, avec une source qui vient de répondre (début).
    if (!timedOut && globalThis.navigator?.onLine !== false && this.directBreaker.recent(source.id)) {
      // La tuile est notée absente.
      this.directMissing.mark(source.id, z, x, y);
      // Renvoie EMPTY.
      return EMPTY;
    // Fin de ce cas.
    }
    // Note la panne de la source.
    this.directBreaker.failure(source.id);
    // Rien.
    return null;
  // Fin de directImage.
  }

  /** Image vide (blanche, noire ou transparente) ? Lue sur une vignette de 16 px ; résultat gardé par image. */
  // isBlank : l'image est-elle vide (début).
  isBlank(img) {
    // Résultat déjà connu.
    let blank = this.blankChecked.get(img);
    // S'il ne l'est pas (début).
    if (blank === undefined) {
      // Pixels de la vignette de 16 px.
      const data = this.pixels(img, SCRATCH_PX);
      // Vide d'après ses pixels ; non vide s'ils sont illisibles.
      blank = data ? isBlankPixels(data) : false;
      // Garde le résultat.
      this.blankChecked.set(img, blank);
    // Fin de ce cas.
    }
    // Le renvoie.
    return blank;
  // Fin de isBlank.
  }

  /** Pixels RGBA d'une image réduite à `size` px (ou de sa portion `crop`), ou null si le navigateur refuse la lecture. */
  // pixels : les pixels d'une image réduite, ou d'une portion (début).
  pixels(img, size, crop = null) {
    // Essai (début).
    try {
      // Canevas de travail de cette taille.
      const ctx = scratchContext(size);
      // Indisponible : null.
      if (!ctx) return null;
      // L'efface.
      ctx.clearRect(0, 0, size, size);
      // Avec une portion : la dessine seule.
      if (crop) ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);
      // Sinon : dessine l'image entière.
      else ctx.drawImage(img, 0, 0, size, size);
      // Renvoie les pixels.
      return ctx.getImageData(0, 0, size, size).data;
    // Lecture refusée (début).
    } catch {
      // null.
      return null;
    // Fin de l'essai.
    }
  // Fin de pixels.
  }

  /** Canevas de 256 px à partir de pixels RGBA (mosaïque d'une tuile). */
  // canvasFrom : un canevas de 256 px à partir de pixels (début).
  canvasFrom(data) {
    // Crée le canevas.
    const canvas = document.createElement('canvas');
    // Carré de 256 px.
    canvas.width = canvas.height = 256;
    // Y pose les pixels.
    canvas.getContext('2d').putImageData(new ImageData(data, 256, 256), 0, 0);
    // Le renvoie.
    return canvas;
  // Fin de canvasFrom.
  }

  /** Chargement partagé : un seul téléchargement par URL, chaque appelant garde son propre signal d'annulation. */
  // sharedImage : un seul téléchargement par adresse (début).
  sharedImage(url, signal, persist = false) {
    // Chargement déjà en cours ou récent.
    let p = this.shared.get(url);
    // S'il n'y en a pas (début).
    if (!p) {
      // Le lance, en priorité haute pour une demande urgente.
      p = this.loadLocal(url, persist, Boolean(signal) && this.urgent.has(signal));
      // Le partage.
      this.shared.set(url, p);
      // À la fin (début) :
      p.then(
        // réussi : il reste partagé 30 secondes ;
        () => setTimeout(() => { if (this.shared.get(url) === p) this.shared.delete(url); }, SHARED_IMAGE_MS),
        // échoué : il est retiré tout de suite.
        () => { if (this.shared.get(url) === p) this.shared.delete(url); },
      // Fin de ce bloc.
      );
    // Fin de ce cas.
    }
    // Renvoie la promesse, liée au signal de l'appelant.
    return withSignal(p, signal);
  // Fin de sharedImage.
  }

  /** `persist` : tuile chargée en direct à garder sur le disque du navigateur (fond instantané, vue de loin). */
  // loadLocal : charge une image, par le cache sur disque s'il y en a un (début).
  loadLocal(url, persist = false, urgent = false) {
    // Même origine : adresse qui commence par un seul « / ».
    const sameOrigin = url.startsWith('/') && !url.startsWith('//');
    // Cache : le cache persistant pour la même origine, sinon celui des tuiles directes si demandé.
    const l3 = sameOrigin ? this.openL3() : (persist ? this.openDirectL3() : null);
    // Cache à plafond (calques LiDAR HD, tous niveaux) : ménage des plus anciens fichiers au fil des enregistrements.
    // onStore : le ménage d'un cache à plafond, pour une autre origine.
    const onStore = !sameOrigin && this.directCache?.maxEntries ? () => diskWritten(this.directCache.name, l3, this.directCache.maxEntries) : undefined;
    // Par le cache s'il y en a un, sinon chargement simple.
    return l3 ? loadImageCached(url, l3, this.stats, urgent, onStore) : loadImage(url, undefined, urgent);
  // Fin de loadLocal.
  }

  /**
   * Réchauffe le cache L3 : télécharge le fichier d'une tuile et l'enregistre sur le disque du navigateur, sans le
   * décoder ni l'envoyer au GPU. Renvoie false si rien n'a été fait (pas de cache L3, déjà présent).
   */
  // warm, asynchrone : enregistre le fichier d'une tuile sur le disque sans le décoder (début).
  async warm(coord) {
    // Son adresse.
    const url = this.url(coord);
    // Cache persistant, pour une adresse de même origine.
    const cacheP = url.startsWith('/') && !url.startsWith('//') ? this.openL3() : null;
    // Attend son ouverture.
    const cache = cacheP && await cacheP;
    // Sans cache : faux.
    if (!cache) return false;
    // Déjà présent : faux.
    if (await cache.match(url).catch(() => null)) return false;
    // Télécharge le fichier.
    const res = await fetch(url);
    // Réponse en erreur, ou qui n'est pas une image : exception.
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('Tuile indisponible');
    // L'enregistre ; un échec est ignoré.
    await cache.put(url, res).catch(() => {});
    // Compte un téléchargement.
    this.stats.network++;
    // Vrai.
    return true;
  // Fin de warm.
  }

  // dispose : libère la source (début).
  dispose() {
    // Note la libération.
    this.disposed = true;
    // Oublie les images partagées.
    this.shared.clear();
    // Annule la minuterie.
    clearTimeout(this.timer);
  // Fin de dispose.
  }
// Fin de la classe TileSource.
}

// abortError : crée une erreur d'abandon.
const abortError = () => Object.assign(new Error('annulé'), { name: 'AbortError' });

/** Marqueur : la source a répondu, mais par une tuile vide. */
// EMPTY : le marqueur d'une tuile vide.
const EMPTY = Symbol('tuile vide');
// Taille de la vignette du contrôle de vide : 16 px.
const SCRATCH_PX = 16;
// Contextes de dessin de travail, par taille.
const scratch = new Map(); // taille → contexte 2D (ou false si indisponible)

/** Canevas partagé d'une taille donnée pour lire les pixels d'une tuile (créé au premier besoin). */
// scratchContext : le contexte de travail d'une taille donnée (début).
function scratchContext(size) {
  // S'il n'existe pas (début).
  if (!scratch.has(size)) {
    // Crée un canevas, si la page existe.
    const canvas = globalThis.document?.createElement('canvas');
    // Carré de la taille demandée.
    if (canvas) canvas.width = canvas.height = size;
    // Son contexte, prévu pour des lectures fréquentes ; faux s'il est indisponible.
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }) || false;
    // Réduction soignée : un pixel de vignette représente la moyenne de son bloc, pas un point pris au hasard.
    // Réduction lissée, de haute qualité.
    if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    // Le garde.
    scratch.set(size, ctx);
  // Fin de ce cas.
  }
  // Le renvoie, ou null.
  return scratch.get(size) || null;
// Fin de scratchContext.
}

/** Reporte la correction mesurée dans les tableaux lus par le shader. */
// applyColor : reporte la correction mesurée dans les tableaux du shader (début).
function applyColor(st) {
  // Correction calculée.
  const t = st.stats.solve();
  // Aucune : rien.
  if (!t) return;
  // Recopie le gain.
  st.gain.set(t.gain);
  // Recopie le décalage.
  st.offset.set(t.offset);
// Fin de applyColor.
}

/** Tuile de 256 px découpée dans son ancêtre (situé `depth` niveaux plus haut) puis agrandie. */
// cropFromAncestor : découpe une tuile de 256 px dans son ancêtre (début).
function cropFromAncestor(img, depth, x, y) {
  // Rectangle à prendre dans l'ancêtre.
  const { sx, sy, sw, sh } = cropRect(img.naturalWidth || img.width || 256, depth, x, y);
  // Crée un canevas.
  const canvas = document.createElement('canvas');
  // Carré de 256 px.
  canvas.width = canvas.height = 256;
  // Son contexte.
  const ctx = canvas.getContext('2d');
  // Agrandissement lissé.
  ctx.imageSmoothingEnabled = true;
  // De haute qualité.
  ctx.imageSmoothingQuality = 'high';
  // Dessine le rectangle sur tout le canevas.
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
  // Le renvoie.
  return canvas;
// Fin de cropFromAncestor.
}

/** Rejette (« Délai dépassé ») si la promesse n'a pas abouti après `ms`. La promesse d'origine continue : son résultat reste partagé. */
// withTimeout : rejette si la promesse n'a pas abouti après un délai (début).
function withTimeout(p, ms) {
  // Renvoie une promesse (début).
  return new Promise((resolve, reject) => {
    // Minuterie : rejet « Délai dépassé ».
    const t = setTimeout(() => reject(Object.assign(new Error('Délai dépassé'), { name: 'TimeoutError' })), ms);
    // À la fin de la promesse : annule la minuterie et transmet le résultat ou l'erreur.
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  // Fin de la promesse.
  });
// Fin de withTimeout.
}

// withSignal : lie une promesse à un signal d'annulation (début).
function withSignal(p, signal) {
  // Sans signal : la promesse elle-même.
  if (!signal) return p;
  // Signal déjà déclenché : rejet immédiat.
  if (signal.aborted) return Promise.reject(abortError());
  // Renvoie une promesse (début).
  return new Promise((resolve, reject) => {
    // onAbort : rejet par une erreur d'abandon.
    const onAbort = () => reject(abortError());
    // Écoute l'annulation, une seule fois.
    signal.addEventListener('abort', onAbort, { once: true });
    // À la réussite : retire l'écoute et transmet l'image ;
    p.then((img) => { signal.removeEventListener('abort', onAbort); resolve(img); },
      // à l'échec : retire l'écoute et transmet l'erreur.
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); });
  // Fin de la promesse.
  });
// Fin de withSignal.
}

// sleep : attend une durée, sauf annulation (début).
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  // Minuterie.
  const t = setTimeout(resolve, ms);
  // À l'annulation : annule la minuterie et rejette.
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
// Fin de sleep.
});

/**
 * Chargement à travers le cache L3 : fichier brut lu sur le disque du navigateur s'il y est (10 à 50 ms), sinon
 * téléchargé, enregistré, puis décodé. Le décodage se fait hors du fil principal (`img.decode`).
 * `onStore` : appelé après chaque fichier enregistré (ménage des caches à plafond, voir diskCache.jsx).
 */
// Déclare et exporte loadImageCached, asynchrone : charge une image à travers le cache sur disque (début).
export async function loadImageCached(url, cacheP, stats, urgent = false, onStore = null) {
  // Attend l'ouverture du cache.
  const cache = await cacheP;
  // Sans cache : chargement simple.
  if (!cache) return loadImage(url, undefined, urgent);
  // Cherche le fichier dans le cache.
  let res = await cache.match(url).catch(() => null);
  // Octets du fichier.
  let blob;
  // S'il y est (début).
  if (res) {
    // Compte une lecture sur disque.
    stats.disk++;
    // Lit ses octets.
    blob = await res.blob();
  // Sinon (début).
  } else {
    // Le télécharge, en priorité haute si demandé.
    res = await fetch(url, urgent ? { priority: 'high' } : undefined);
    // Type du contenu.
    const type = res.headers.get('content-type') || '';
    // Réponse en erreur, ou qui n'est pas une image : exception.
    if (!res.ok || !type.startsWith('image/')) throw new Error('Tuile indisponible');
    // Compte un téléchargement.
    stats.network++;
    // Le fichier est lu une fois, puis enregistré à partir de ses octets : pas de double lecture du flux réseau
    // (un flux dédoublé avance au rythme du fil principal et traîne quand l'affichage est chargé).
    // Lit ses octets.
    blob = await res.blob();
    // L'enregistre dans le cache, puis signale l'écriture ; un échec est ignoré.
    cache.put(url, new Response(blob, { headers: { 'content-type': type } })).then(() => onStore?.(), () => {}); // quota plein : on continue sans l'enregistrer
  // Fin du choix.
  }
  // Adresse temporaire des octets.
  const blobUrl = URL.createObjectURL(blob);
  // Essai (début).
  try {
    // Crée une image.
    const img = new Image();
    // Décodage asynchrone.
    img.decoding = 'async';
    // Lui donne l'adresse temporaire.
    img.src = blobUrl;
    // Attend le décodage.
    await img.decode();
    // Renvoie l'image.
    return img;
  // En cas d'erreur (début).
  } catch {
    // Retire le fichier du cache.
    cache.delete(url).catch(() => {}); // fichier abîmé : retéléchargé au prochain essai
    // Exception « Tuile illisible ».
    throw new Error('Tuile illisible');
  // Dans tous les cas (début).
  } finally {
    // Libère l'adresse temporaire.
    URL.revokeObjectURL(blobUrl);
  // Fin de l'essai.
  }
// Fin de loadImageCached.
}

// Déclare et exporte loadImage : charge une image par son adresse (début).
export function loadImage(url, signal, urgent = false) {
  // Renvoie une promesse (début).
  return new Promise((resolve, reject) => {
    // API déconnectée (onglet « API ») : aucune demande ne part, la tuile est indisponible.
    if (isUrlBlocked(url)) { reject(new Error('Tuile indisponible')); return; }
    // Crée une image.
    const img = new Image();
    // Sans identifiants, pour pouvoir lire ses pixels.
    img.crossOrigin = 'anonymous';
    // Décodage asynchrone.
    img.decoding = 'async';
    // Image créée hors de la page : le navigateur la charge en priorité basse par défaut. Une tuile à l'écran passe devant.
    // Demande urgente : priorité haute.
    if (urgent) img.fetchPriority = 'high';
    // onAbort : vide l'adresse et rejette.
    const onAbort = () => { img.src = ''; reject(abortError()); };
    // Écoute l'annulation, une seule fois.
    signal?.addEventListener('abort', onAbort, { once: true });
    // Au chargement (début).
    img.onload = () => {
      // Retire l'écoute.
      signal?.removeEventListener('abort', onAbort);
      // Décodage hors du fil principal avant de rendre l'image : la lecture de pixels et l'envoi au GPU ne bloquent
      // plus l'affichage (pas de saccade à l'arrivée des tuiles). Sans `decode`, ou s'il échoue, l'image sert quand même.
      // Si le décodage existe : l'attend, et rend l'image même s'il échoue.
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), () => resolve(img));
      // Sinon : rend l'image.
      else resolve(img);
    // Fin du chargement.
    };
    // En cas d'erreur : retire l'écoute et rejette « Tuile indisponible ».
    img.onerror = () => { signal?.removeEventListener('abort', onAbort); reject(new Error('Tuile indisponible')); };
    // Lance le chargement.
    img.src = url;
  // Fin de la promesse.
  });
// Fin de loadImage.
}
