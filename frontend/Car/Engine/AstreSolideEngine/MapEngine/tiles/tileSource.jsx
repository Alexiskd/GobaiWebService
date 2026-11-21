// Importe fillTemplate, le remplissage d'un modèle d'adresse, depuis mercator.
import { fillTemplate } from '../mercator.jsx';
// Importe le test « cette adresse vise-t-elle une API déconnectée ? ».
import { isUrlBlocked } from '../../../shared/lib/app/apiBlock.jsx';
// Importe (début)
import {
  // les mémoires, la mesure des couleurs et les fonctions du chargement direct des images de la Terre,
  ColorStats, DirectBreaker, EmptyMemo, LevelGate, MissingMemo, THUMB, applyGain, blankRatio, blankZone, composeZoned, cropRect, farCandidatesAt,
  // ainsi que le remplissage d'une adresse, le test d'image vide, le choix de la source suivante, la validation du plan et le test de source quasi mondiale,
  fillDirect, isBlankPixels, nextAttempt, tileTouches, validPlan, worldwide, worldOrigins,
// depuis earthDirect.
} from '../earth/earthDirect.jsx';
// Importe la lecture et l'enregistrement de la description d'une couche, depuis layerInfoCache.
import { readLayerInfo, saveLayerInfo } from '../loading/layerInfoCache.jsx';
// Importe la description complétée par la table de priorité des sources, depuis earthPlan.
import { withPlan } from '../earth/earthPlan.jsx';
// Importe le partage avec annulation réelle, le délai adaptatif, la limite par serveur et les compteurs, depuis netLoads.
import { AdaptiveTimeout, HostGate, NET_STATS, SharedLoads, hostOf } from '../loading/netLoads.jsx';
// Importe la lecture des pixels hors du fil principal et la mémoire des fichiers d'origine, depuis tilePixels.
import { pixelsOffThread, rememberBlob } from './tilePixels.jsx';
// Importe le cache borné, depuis lru.
import { LruCache } from '../loading/lru.jsx';
// Importe la fusion des fonds marins : décodage des altitudes, part des fonds par pixel et mélange, depuis seafloorFusion.
import { blendSea, decodeTerrarium, seaMask } from '../earth/seafloorFusion.jsx';
// Importe la carte marine : part de GEBCO par niveau, mélange NOAA / GEBCO et isobathes, depuis marineChart.
import { drawIsobaths, marineMix, mixSea } from '../earth/marineChart.jsx';

// Délai minimal entre deux renouvellements du modèle d'adresse : 30 secondes.
const MIN_REFRESH_GAP_MS = 30_000;
// Durée de partage d'une image : 30 secondes.
const SHARED_IMAGE_MS = 30_000; // une image reste partagée 30 s (tuiles filles sur-zoomées qui réutilisent la même)
// Délai maximal d'une minuterie : 2³¹ − 1 millisecondes.
const MAX_TIMER_MS = 2 ** 31 - 1;
// Délai d'un chargement direct avant le repli sur le relais : mesuré par source (1,5 à 8 s, 4 s au départ).
const DIRECT_TIMEOUTS = new AdaptiveTimeout({ initial: 4000, min: 1500, max: 8000 });
// Téléchargements simultanés par serveur, réglés sur ce qu'il supporte (2 à 12, 6 au départ), pour toutes les couches.
export const HOST_GATE = new HostGate({ initial: 6, min: 2, max: 12 });
// Nombre maximal de sources essayées pour une tuile : 12.
const DIRECT_MAX_STEPS = 12;     // sources essayées au plus pour une tuile (vides comprises) avant le relais
// Clé de l'interrupteur du chargement direct, dans le stockage du navigateur.
const DIRECT_SWITCH = 'gobai:tuiles-directes'; // « 0 » dans le stockage du navigateur : tout repasse par le relais

// Clé de l'interrupteur de l'accord des couleurs.
const COLOR_SWITCH = 'gobai:couleurs';       // « 0 » : pas d'accord des couleurs entre les couches
// Clé des mesures de couleur gardées.
const COLOR_STORE = 'gobai:couleurs-v1';     // mesures de couleur par source, gardées d'une visite à l'autre
// Clé de l'interrupteur de la fusion des fonds marins.
const SEA_SWITCH = 'gobai:fonds-marins';     // « 0 » : l'imagerie de la Terre reste sans les fonds marins
// Pause de la fusion après un échec (fonds ou altitudes injoignables) : une minute.
const SEA_PAUSE_MS = 60_000;
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
// seaAllowed : la fusion des fonds marins est-elle permise dans ce navigateur (début).
function seaAllowed() {
  // Vrai sauf si l'interrupteur vaut « 0 » ; vrai aussi si le stockage est refusé.
  try { return globalThis.localStorage?.getItem(SEA_SWITCH) !== '0'; } catch { return true; }
// Fin de seaAllowed.
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

/**
 * Dernière description reçue de chaque couche pendant la session (mémoire vive seulement, partagée par toutes
 * les sources) : une couche resélectionnée peu après (aller-retour entre deux fonds, calque coupé puis rallumé,
 * changement d'astre) repart avec elle sans redemander GET /tiles/layers/:id au serveur. Valable
 * MIN_REFRESH_GAP_MS, et jamais à moins d'une minute de l'expiration de son jeton.
 */
const sessionLayerInfo = new Map(); // layerId → { info, at }
// Marge avant l'expiration annoncée : une minute (comme layerInfoCache.jsx).
const SESSION_EXPIRY_MARGIN_MS = 60_000;

/** Description de la couche reçue il y a peu dans cette session, encore valable ; sinon null. */
export function freshSessionInfo(layerId, now = Date.now()) {
  const hit = sessionLayerInfo.get(layerId);
  if (!hit || now - hit.at > MIN_REFRESH_GAP_MS) return null;
  const expires = hit.info?.expiresAt ? Date.parse(hit.info.expiresAt) : NaN;
  if (Number.isFinite(expires) && expires - now <= SESSION_EXPIRY_MARGIN_MS) return null;
  return hit.info;
}

/** Garde la description reçue pour la session. */
export function rememberSessionInfo(layerId, info, now = Date.now()) {
  if (info) sessionLayerInfo.set(layerId, { info, at: now });
}

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
   * @param {{ api: { layer(id, signal?): Promise<object> }, layerId: string, onChange?: () => void }} opts
   * Rien n'est gardé sur le disque du navigateur : les tuiles sont téléchargées sans cache et gardées en mémoire seulement.
   */
  // Constructeur : l'API, l'identifiant de la couche et la fonction de changement (début).
  constructor({ api, layerId, onChange = () => {} }) {
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
    // Téléchargements partagés, par adresse : annulés pour de bon quand plus aucune tuile n'attend l'image.
    this.loads = new SharedLoads(fetchTile, { keepMs: SHARED_IMAGE_MS });
    // Compteurs : réseau, direct et relais.
    this.stats = { network: 0, direct: 0, relay: 0 };
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
    // Fusion des fonds marins permise ?
    this.seaOn = seaAllowed();
    // Altitudes décodées des tuiles Terrarium, par tuile (promesses partagées) : 64 au plus.
    this.seaElev = new LruCache(64);
    // Images des fonds (NOAA, GEBCO, carte plate), par couche et par tuile (promesses partagées) : 48 au plus.
    this.seaImages = new LruCache(48);
    // Instant jusqu'auquel la fusion est en pause après un échec.
    this.seaPauseUntil = 0;
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

  // ready : vrai quand le statut est « ready ».
  get ready() { return this.status === 'ready'; }
  // minZoom : le niveau minimal de la couche, ou 0.
  get minZoom() { return this.info?.minZoom ?? 0; }
  // maxZoom : le niveau maximal de la couche, ou 0.
  get maxZoom() { return this.info?.maxZoom ?? 0; }

  /**
   * La couche a-t-elle une image pour cette tuile ? Vrai par défaut. Une couche limitée à une emprise (`info.bounds`,
   * ex. un calque limité à la France) n'est demandée que pour les tuiles qui la touchent, à partir de son niveau
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
    // Description reçue il y a peu dans cette session : la couche repart avec elle, sans requête au serveur. Le
    // renouvellement avant expiration reste programmé comme d'habitude.
    const session = freshSessionInfo(this.layerId);
    if (session) {
      this.info = session;
      this.status = 'ready';
      // lastRefresh reste à 0 : si les tuiles se mettent à échouer, la description peut être redemandée aussitôt.
      this.scheduleRefresh();
      this.preconnect();
      return this;
    }
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
      // Couche unique de la Terre : sa description donne l'adresse de la table de priorité des sources, lue ensuite ;
      // la description en est complétée (plan direct). Table illisible : tout passe par le relais du serveur.
      .then((info) => (info?.plan && this.api.earthPlan ? this.api.earthPlan().then((plan) => withPlan(info, plan), () => withPlan(info, null)) : info))
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
        // Et pour une resélection de la couche pendant cette session.
        rememberSessionInfo(this.layerId, info);
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
   * Charge l'image d'une tuile, avec les fonds marins fondus dedans quand la couche les prévoit (voir withSeafloor).
   * Rejette en AbortError si `signal` est déclenché.
   */
  // loadImage, asynchrone : l'image d'une tuile, puis la fusion des fonds marins.
  async loadImage(coord, signal, urgent = false) { return this.withSeafloor(await this.loadBaseImage(coord, signal, urgent), coord, signal); }

  /**
   * Fonds marins (couche unique de la Terre : carte marine `marine` de sa table, sinon champ `seafloor` de sa
   * description) : là où les altitudes Terrarium sont sous la mer, l'image des fonds (NOAA, GEBCO ou leur mélange,
   * voir marinePixelsAt) remplace peu à peu l'image satellite (voir seafloorFusion.jsx). Les deux sont
   * lues au niveau `maxZoom` au plus, puis découpées : une tuile grossière sert toutes celles qu'elle couvre. Une
   * tuile sans mer ne demande que ses altitudes. En cas d'échec, l'image satellite est rendue telle quelle et la
   * fusion se met en pause une minute.
   */
  // withSeafloor, asynchrone : l'image d'une tuile avec les fonds marins (début).
  async withSeafloor(img, { z, x, y }, signal) {
    // Carte marine de la table (NOAA, GEBCO, isobathes), s'il y en a une.
    const marine = this.info?.marine;
    // Réglage de la fusion : la carte marine, sinon les fonds GEBCO de la description de la couche.
    const sf = marine || this.info?.seafloor;
    // Sans réglage, fusion coupée ou en pause : l'image telle quelle.
    if (!sf || !this.seaOn || Date.now() < this.seaPauseUntil) return img;
    // Essai (début).
    try {
      // Part de l'image des fonds par pixel, d'après les altitudes ; null sans mer.
      const mask = await this.seaMaskAt(sf.mask, z, x, y);
      // Sans mer : l'image telle quelle.
      if (!mask) return img;
      // Demande annulée : erreur d'abandon.
      if (signal?.aborted) throw abortError();
      // Pixels de l'image des fonds : la carte marine de la table, ou GEBCO seule sans table.
      const sea = marine ? await this.marinePixelsAt(marine, z, x, y, mask) : await this.seaPixelsAt(sf, z, x, y);
      // Pixels de l'image satellite, avec sa correction de couleur.
      const out = sea && await this.basePixels(img);
      // Pixels illisibles : l'image telle quelle.
      if (!out) return img;
      // Mélange les fonds dans l'image satellite.
      blendSea(out, sea, mask);
      // Renvoie le canevas.
      return this.canvasFrom(out);
    // En cas d'erreur (début).
    } catch (e) {
      // Une annulation est relancée.
      if (e.name === 'AbortError') throw e;
      // Sinon : pause d'une minute.
      this.seaPauseUntil = Date.now() + SEA_PAUSE_MS;
      // L'image telle quelle.
      return img;
    // Fin de l'essai.
    }
  // Fin de withSeafloor.
  }

  /** Part de l'image des fonds pour chaque pixel de la tuile, d'après les altitudes de son ancêtre ; null sans mer. */
  // seaMaskAt, asynchrone : les parts des fonds d'une tuile (début).
  async seaMaskAt(mask, z, x, y) {
    // Niveau des altitudes, écart avec la tuile, et clé de l'ancêtre.
    const mz = Math.min(z, mask.maxZoom), d = z - mz, key = `${mz}/${x >> d}/${y >> d}`;
    // Altitudes de l'ancêtre, déjà demandées ?
    let p = this.seaElev.get(key);
    // Sinon (début).
    if (!p) {
      // Charge la tuile Terrarium (sans annulation : elle sert aux tuiles voisines), lit ses pixels et les décode.
      p = this.sharedImage(fillTemplate(mask.template, { z: mz, x: x >> d, y: y >> d })).then((im) => this.pixelsAsync(im, 256))
        // Pixels illisibles : erreur ; sinon les altitudes.
        .then((px) => { if (!px) throw new Error('Altitudes illisibles'); return decodeTerrarium(px); });
      // Gardée pour les tuiles suivantes.
      this.seaElev.set(key, p);
      // En cas d'échec : oubliée, pour être redemandée plus tard.
      p.catch(() => this.seaElev.delete(key));
    // Fin de ce cas.
    }
    // Parts des fonds de la tuile, dans la portion de l'ancêtre qu'elle couvre.
    return seaMask(await p, d, x, y);
  // Fin de seaMaskAt.
  }

  /**
   * Pixels de la carte marine d'une tuile (voir marineChart.jsx) : la NOAA seule vue de l'espace, la NOAA fondue dans
   * GEBCO aux zooms moyens, GEBCO seule avec les isobathes de sa carte plate aux zooms forts, d'après la colonne
   * « marine » des paliers de la table. Seules les images utiles au niveau de la tuile sont demandées. null si une
   * image manque.
   */
  // marinePixelsAt, asynchrone : les pixels de la carte marine d'une tuile (début).
  async marinePixelsAt(m, z, x, y, mask) {
    // Part de GEBCO et isobathes, pour le niveau de la tuile.
    const mix = marineMix(this.info?.tiers, z);
    // Images demandées en même temps : la NOAA si sa part n'est pas nulle, GEBCO si la sienne ne l'est pas.
    const [noaa, gebco] = await Promise.all([mix.gebco < 1 ? this.seaPixelsAt(m.noaa, z, x, y) : null, mix.gebco > 0 ? this.seaPixelsAt(m.gebco, z, x, y) : null]);
    // Image des fonds : GEBCO seule, NOAA seule, ou leur mélange (null si une image manque).
    const sea = mix.gebco >= 1 ? gebco : mix.gebco <= 0 ? noaa : (noaa && gebco ? mixSea(noaa, gebco, mix.gebco) : null);
    // Sans image, ou sans isobathes à ce niveau : l'image telle quelle.
    if (!sea || !mix.isobaths) return sea;
    // Carte plate de GEBCO, d'où sont tirées les isobathes.
    const flat = await this.seaPixelsAt(m.flat, z, x, y);
    // Isobathes tracées en pleine mer, si la carte plate est arrivée.
    if (flat) drawIsobaths(sea, flat, mask, m.isobaths);
    // Renvoie l'image des fonds.
    return sea;
  // Fin de marinePixelsAt.
  }

  /** Pixels (256 px) de l'image des fonds de la tuile, découpés dans un ancêtre au-delà du niveau `maxZoom`. */
  // seaPixelsAt, asynchrone : les pixels des fonds d'une tuile (début).
  async seaPixelsAt(sf, z, x, y) {
    // Niveau des fonds, écart avec la tuile, et clé de l'ancêtre (avec la couche : NOAA, GEBCO et carte plate).
    const gz = Math.min(z, sf.maxZoom), d = z - gz, key = `${sf.template}|${gz}/${x >> d}/${y >> d}`;
    // Image de l'ancêtre, déjà demandée ?
    let p = this.seaImages.get(key);
    // Sinon (début).
    if (!p) {
      // Charge l'image des fonds (sans annulation : elle sert aux tuiles voisines).
      p = this.sharedImage(fillTemplate(sf.template, { z: gz, x: x >> d, y: y >> d }));
      // Gardée pour les tuiles suivantes.
      this.seaImages.set(key, p);
      // En cas d'échec : oubliée, pour être redemandée plus tard.
      p.catch(() => this.seaImages.delete(key));
    // Fin de ce cas.
    }
    // L'image.
    const im = await p;
    // Ses pixels, ou ceux de la portion couverte par la tuile.
    return this.pixelsAsync(im, 256, d ? cropRect(im.naturalWidth || im.width || 256, d, x, y) : null);
  // Fin de seaPixelsAt.
  }

  /**
   * Charge l'image d'une tuile (avec 1 nouvel essai). Rejette en AbortError si `signal` est déclenché.
   * `urgent` : tuile à l'écran, demandée au réseau en priorité haute (les préchargements gardent la priorité normale).
   */
  // loadBaseImage, asynchrone : charge l'image d'une tuile, sans les fonds marins (début).
  async loadBaseImage(coord, signal, urgent = false) {
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
  // Fin de loadBaseImage.
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
      const thumb = img && await this.pixelsAsync(img, THUMB);
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
    const out = base && await this.basePixels(base);
    // Sans pixels : rien.
    if (!out) return null;
    // De la moins prioritaire à la plus prioritaire : chacune recouvre les précédentes là où elle a une image.
    // Pose les couches, de la moins prioritaire à la plus prioritaire.
    for (const layer of layers.reverse()) await this.layOver(out, layer.img, layer.zone, layer.st);
    // Renvoie le canevas.
    return this.canvasFrom(out);
  // Fin de loadFar.
  }

  /** Pixels (256 px) d'une image de fond, avec sa correction de couleur déjà appliquée si elle en porte une. */
  // basePixels, asynchrone : les pixels d'une image de fond, en 256 px (début).
  async basePixels(img) {
    // Lit les pixels (hors du fil principal si possible).
    const data = await this.pixelsAsync(img, 256);
    // Correction de couleur portée par l'image.
    const st = img.__color;
    // Si elle est prête : l'applique.
    if (data && st?.stats.ready) applyGain(data, st.gain, st.offset);
    // Renvoie les pixels.
    return data;
  // Fin de basePixels.
  }

  /** Pose une image sur des pixels de fond, sauf dans sa zone sans image ; applique sa correction de couleur. */
  // layOver, asynchrone : pose une image sur des pixels de fond (début).
  async layOver(out, img, zone, st) {
    // Ses pixels (hors du fil principal si possible).
    const data = await this.pixelsAsync(img, 256);
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
    const thumb = await this.pixelsAsync(img, THUMB);
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
    const out = under && await this.basePixels(under);
    // Sans pixels : rien.
    if (!out) return null;
    // Pose l'image par-dessus, hors du trou.
    await this.layOver(out, img, zone, st);
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
        // Charge l'image, dans le délai mesuré pour cette source.
        const img = await this.timedImage(fillDirect(templates[k], z, x, y), signal, source.id);
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
      // Source nationale (pas quasi mondiale) : l'image porte sa correction de couleur, et sert de mesure tant qu'il en manque.
      // État de couleur, pour une source nationale avec l'accord actif.
      const st = !worldwide(a.source) && this.colorMatch ? this.colorState(a.source.id) : null;
      // Mesures incomplètes, au niveau natif : lance une mesure de couleur.
      if (st && !st.stats.full && !a.depth) this.sampleColor(plan, a.source, img, z, x, y);
      // Au-delà du niveau natif : découpe la tuile dans son ancêtre.
      const out = a.depth ? cropFromAncestor(img, a.depth, x, y) : img;
      // L'image porte sa correction de couleur.
      if (st) out.__color = st;
      // Source nationale (pas quasi mondiale), tuile pas encore vue entièrement couverte (début).
      if (a.source.bboxes && !worldwide(a.source) && !this.directFull.isEmpty(a.source.id, a.z, a.x, a.y, a.source.minZoom)) {
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
      // Sources mondiales du plan (une emprise qui fait le tour du globe compte encore : par ex. Sentinel-2, bordé au sud de −70°).
      const world = plan.filter(worldwide);
      // Tentative pour l'image du monde au même endroit.
      const a = nextAttempt(world, z, x, y, { usable: (id) => this.directBreaker.usable(id) });
      // Si ce n'est pas un chargement direct : rien.
      if (a.kind !== 'direct') return;
      // Image de référence.
      const ref = await this.directImage(a.source, a.z, a.x, a.y);
      // Absente ou vide : rien.
      if (!ref || ref === EMPTY) return;
      // Vignette de la référence, découpée dans son ancêtre si besoin.
      const refPx = await this.pixelsAsync(ref, COLOR_PX, a.depth ? cropRect(ref.naturalWidth || ref.width || 256, a.depth, x, y) : null);
      // Vignette de la source.
      const srcPx = await this.pixelsAsync(img, COLOR_PX);
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
        // Charge l'image, dans le délai mesuré pour cette source.
        const img = await this.timedImage(fillDirect(templates[k], z, x, y), signal, source.id);
        // Retient la variante.
        this.directVariant.set(source.id, k);
        // Note le succès de la source.
        this.directBreaker.success(source.id);
        // Source nationale, tuile pas vue entièrement couverte et image vide (début).
        if (source.bboxes && !this.directFull.isEmpty(source.id, z, x, y, source.minZoom) && await this.isBlank(img)) {
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

  /** Image vide (blanche, noire ou transparente) ? Lue sur une vignette de 16 px, hors du fil principal si possible ; résultat gardé par image. */
  // isBlank, asynchrone : l'image est-elle vide (début).
  async isBlank(img) {
    // Résultat déjà connu.
    let blank = this.blankChecked.get(img);
    // S'il ne l'est pas (début).
    if (blank === undefined) {
      // Pixels de la vignette de 16 px.
      const data = await this.pixelsAsync(img, SCRATCH_PX);
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

  /**
   * Pixels RGBA d'une image réduite à `size` px (ou de sa portion `crop`), lus dans le Worker à partir du fichier
   * téléchargé ; sur le fil principal (pixels) si le Worker est indisponible ou si l'image n'a pas de fichier.
   */
  // pixelsAsync, asynchrone : l'image, la taille et la portion.
  async pixelsAsync(img, size, crop = null) { const data = await pixelsOffThread(img, size, crop); return data === undefined ? this.pixels(img, size, crop) : data; }

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

  /**
   * Chargement partagé : un seul téléchargement par adresse, chaque appelant garde son propre signal d'annulation ;
   * quand plus aucun appelant n'attend l'image, le téléchargement est annulé (voir SharedLoads).
   */
  // sharedImage : un seul téléchargement par adresse.
  sharedImage(url, signal) { return this.loads.get(url, signal, Boolean(signal) && this.urgent.has(signal)); }

  /**
   * Image d'une source en direct, dans le délai mesuré pour cette source (AdaptiveTimeout). Délai dépassé : le
   * téléchargement est annulé s'il ne sert plus personne, le serveur perd des places (HostGate), et l'erreur
   * « TimeoutError » mène à la source suivante ou au relais.
   */
  // timedImage, asynchrone : l'adresse, le signal de l'appelant et la source (début).
  async timedImage(url, signal, id) {
    // Déjà annulée : rejet.
    if (signal?.aborted) throw abortError();
    // Délai de la source.
    const ms = DIRECT_TIMEOUTS.timeoutFor(id);
    // Contrôleur propre à cet essai : abandonné par l'appelant ou par le délai.
    const ctrl = new AbortController();
    // L'abandon de l'appelant se transmet.
    const onAbort = () => ctrl.abort();
    // Écoute l'appelant.
    signal?.addEventListener('abort', onAbort, { once: true });
    // Délai dépassé ? Non pour l'instant.
    let timedOut = false;
    // Minuterie du délai.
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms);
    // Instant du départ.
    const t0 = performance.now();
    // Urgence : celle de l'appelant.
    if (signal && this.urgent.has(signal)) this.urgent.add(ctrl.signal);
    // Essai (début).
    try {
      // L'image, partagée.
      const img = await this.sharedImage(url, ctrl.signal);
      // Durée de la réponse ; une image déjà là (moins de 15 ms) ne compte pas dans la mesure.
      const dt = performance.now() - t0;
      // La note pour la source.
      if (dt > 15) DIRECT_TIMEOUTS.record(id, dt);
      // Renvoie l'image.
      return img;
    // En cas d'erreur (début).
    } catch (e) {
      // Délai dépassé : compté, le serveur perd des places, erreur « TimeoutError ».
      if (timedOut) { NET_STATS.timeouts++; HOST_GATE.failure(hostOf(url)); throw Object.assign(new Error('Délai dépassé'), { name: 'TimeoutError' }); }
      // Sinon : l'erreur telle quelle.
      throw e;
    // Dans tous les cas : minuterie arrêtée, écoute retirée.
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  // Fin de timedImage.
  }

  // dispose : libère la source (début).
  dispose() {
    // Note la libération.
    this.disposed = true;
    // Oublie les images partagées.
    this.loads.clear();
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

// sleep : attend une durée, sauf annulation (début).
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  // Minuterie.
  const t = setTimeout(resolve, ms);
  // À l'annulation : annule la minuterie et rejette.
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
// Fin de sleep.
});

/**
 * Téléchargement d'une tuile à travers la limite de son serveur (HOST_GATE) : une réponse rapide peut lui donner une
 * place de plus, une panne réseau lui en retire la moitié. Une tuile absente (erreur HTTP) ne compte pas comme panne.
 */
// fetchTile, asynchrone : l'adresse, le signal et l'urgence (début).
function fetchTile(url, signal, urgent) {
  // Serveur de l'adresse.
  const host = hostOf(url);
  // Attend une place chez ce serveur, puis télécharge (début).
  return HOST_GATE.run(host, async () => {
    // Instant du départ.
    const t0 = performance.now();
    // Essai (début).
    try {
      // L'image.
      const img = await loadImage(url, signal, urgent);
      // Réussite notée avec sa durée.
      HOST_GATE.success(host, performance.now() - t0);
      // Renvoie l'image.
      return img;
    // Panne réseau : le serveur perd des places ; l'erreur est relancée.
    } catch (e) { if (e.name === 'NetworkError') HOST_GATE.failure(host); throw e; }
  // Fin de la tâche, liée au signal (annulée tant qu'elle attend sa place).
  }, signal);
// Fin de fetchTile.
}

/**
 * Charge une image par son adresse, sans aucun cache : le fichier est téléchargé à chaque demande (`cache: 'no-store'`,
 * rien n'est écrit sur l'appareil), puis décodé hors du fil principal. L'image ne vit qu'en mémoire.
 */
// Déclare et exporte loadImage : charge une image par son adresse (début).
export async function loadImage(url, signal, urgent = false) {
  // API déconnectée (onglet « API ») : aucune demande ne part, la tuile est indisponible.
  if (isUrlBlocked(url)) throw new Error('Tuile indisponible');
  // Déjà annulée : rejet d'annulation.
  if (signal?.aborted) throw abortError();
  // Réponse du téléchargement.
  let res;
  // Une requête de plus.
  NET_STATS.requests++;
  // Essai (début).
  try {
    // Téléchargement sans cache ni identifiants ; une tuile à l'écran passe devant.
    res = await fetch(url, { signal, cache: 'no-store', credentials: 'omit', priority: urgent ? 'high' : 'auto' });
  // Échec : annulation voulue, sinon panne réseau (« NetworkError », comptée).
  } catch (e) { if (signal?.aborted) throw abortError(); NET_STATS.errors++; throw Object.assign(new Error('Tuile indisponible'), { name: 'NetworkError' }); }
  // Réponse en erreur (tuile absente chez le fournisseur) : « HttpError », sans pénaliser le serveur.
  if (!res.ok) throw Object.assign(new Error('Tuile indisponible'), { name: 'HttpError', status: res.status });
  // Les octets de l'image.
  const blob = await res.blob();
  // Comptés, requête terminée.
  NET_STATS.bytes += blob.size; NET_STATS.done++;
  // Adresse locale du fichier en mémoire (même origine : ses pixels restent lisibles).
  const blobUrl = URL.createObjectURL(blob);
  // Essai (début).
  try {
    // Crée une image.
    const img = new Image();
    // Décodage asynchrone.
    img.decoding = 'async';
    // Pose l'adresse locale.
    img.src = blobUrl;
    // Décodage hors du fil principal : l'envoi au GPU ne bloque plus l'affichage.
    await img.decode();
    // Garde le fichier d'origine : les lectures de pixels se feront dans le Worker (voir tilePixels.jsx).
    rememberBlob(img, blob);
    // Renvoie l'image.
    return img;
  // Fichier illisible : tuile indisponible.
  } catch { throw new Error('Tuile illisible'); }
  // Dans tous les cas : libère l'adresse locale.
  finally { URL.revokeObjectURL(blobUrl); }
// Fin de loadImage.
}
