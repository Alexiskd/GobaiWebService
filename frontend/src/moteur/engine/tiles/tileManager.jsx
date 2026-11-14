// Importe uploadShare, la part des envois de tuiles autorisée, depuis powerSaver.
import { uploadShare } from '../powerSaver';
// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la source d'images des tuiles et les deux chargements d'image, depuis tileSource.
import { TileSource, loadImage, loadImageCached } from './tileSource';
// Importe les noms et plafonds des caches sur disque du LiDAR et du relief, et les fonctions du cache, depuis diskCache.
import { LIDAR_DISK, LIDAR_DISK_MAX, RELIEF_DISK, RELIEF_DISK_MAX, diskWritten, openDisk } from './diskCache';
// Importe la source des tuiles d'altitude et les fonctions de réglage du relief, depuis relief.
import { ReliefSource, groundFloorRadii, normalizeRelief, oceanChoice, reliefChoice, tuneRelief } from './relief';
// Importe xyzToLonLat, la conversion d'un point en longitude et latitude, depuis mercator.
import { xyzToLonLat } from './mercator';
// Importe TileLayer, la couche de tuiles, depuis tileLayer.
import { TileLayer } from './tileLayer';
// Importe l'identifiant du calque des rues et sa source, depuis roadSource.
import { ROADS_LAYER_ID, RoadSource } from './roadSource';
// Importe viewportBounds, les limites géographiques de la vue, depuis viewport.
import { viewportBounds } from './viewport';

/**
 * Altitude minimale de la caméra au-dessus du sol quand une carte est affichée, en rayons terrestres : ≈ 5 m, pour
 * qu'environ 10 m de terrain tiennent dans la largeur de l'écran (zoom 22, images au-delà de leur niveau natif agrandies).
 */
// Déclare et exporte la distance minimale de la caméra au centre quand une carte est affichée : 1 + 8e-7 rayon.
export const MIN_DISTANCE_WITH_TILES = 1 + 8e-7;

/**
 * Fait le lien entre le moteur 3D et les tuiles d'un astre : choix du fond et du calque, cadrage de la caméra
 * dans le repère de l'astre, état publié pour l'interface (fournisseur, zoom, attribution…).
 * Le moteur l'appelle une fois par image (`update`) après avoir placé la caméra.
 *
 * `body` décrit l'astre :
 *  name          nom du repère (débogage)
 *  parent        THREE.Object3D qui porte le repère des tuiles (positionné, orienté)
 *  mesh          sphère de fond (couleur unie) de l'astre, cachée quand la carte couvre toute la vue
 *  radius        rayon de l'astre en unités de la scène (les tuiles sont calculées sur une sphère de rayon 1)
 *  sunDir        THREE.Vector3 direction du Soleil dans le repère caméra
 *  airless       vrai pour un astre sans atmosphère (Lune)
 *  overlayMode   'blend' (calque transparent : routes, noms) ou 'relief' (ombrage qui module la luminosité du fond)
 *  Mode « composite » (setComposite) : couleurs = texture globale (setColorTexture), fond = détail en gris ou ombrage,
 *  calque = ombrage du relief.
 *  prefetch      préchargement prédictif (trajectoire de la caméra, cône de 120°) vers le cache RAM
 *  ramCapacity   images décodées gardées en RAM pour le préchargement (400 par défaut, 96 au plus sur mobile)
 *  persistentCache nom du cache persistant du navigateur (L3, Cache Storage) pour les fichiers de tuiles
 *  pinnedMaxZoom niveaux 0 à n de tout l'astre préchargés et gardés en mémoire (2 par défaut, plafonné à 2 sur mobile)
 *  syncRotation  (root) => void, optionnel : recopie la rotation propre de l'astre sur le repère des tuiles
 *  detail        'gas' ou 'rock' : détail simulé au-delà de la résolution des images (voir tileShaders.jsx) ; absent = aucun
 *  overzoom      niveaux affichés au-delà du niveau natif de la couche (3 par défaut)
 *  concurrency   téléchargements de tuiles simultanés (6 par défaut, moitié sur mobile si précisé)
 *  polarScale    rayon polaire / rayon équatorial (1 par défaut) : aplatissement des géantes gazeuses
 */
// Numéro de chaque type de détail simulé : 1 pour le gaz, 2 pour le sol.
const DETAIL_KINDS = { gas: 1, rock: 2 };
// Force de chaque type de détail simulé.
const DETAIL_GAIN = { gas: 0.34, rock: 0.3 };
/** Mention affichée avec les sources quand le zoom dépasse la résolution des images. */
// Déclare et exporte la mention affichée quand le détail est simulé.
export const SYNTHETIC_NOTE = 'détail simulé au-delà de la résolution des images';

// placeholderTexture : une texture d'un seul pixel gris, en attendant la vraie (début).
const placeholderTexture = () => {
  // La texture de données.
  const t = new THREE.DataTexture(new Uint8Array([140, 138, 133, 255]), 1, 1, THREE.RGBAFormat);
  // À envoyer à la carte graphique.
  t.needsUpdate = true;
  // La renvoie.
  return t;
// Fin de placeholderTexture.
};

// Déclare et exporte la classe TileManager (début).
export class TileManager {
  /** @param {{ engine: object, api: object, body: object, onChange?: () => void }} o  engine : SolarEngine (cam, renderer, H) */
  // Constructeur : le moteur, l'accès à l'API, la description de l'astre et la fonction de changement (début).
  constructor({ engine, api, body, onChange = () => {} }) {
    // Garde le moteur.
    this.engine = engine;
    // Garde l'accès à l'API.
    this.api = api;
    // Garde la description de l'astre.
    this.body = body;
    // Anciens caches de tuiles de cet astre (contenu remplacé côté serveur) : supprimés du navigateur.
    // Supprime du navigateur les anciens caches de l'astre ; une erreur est ignorée.
    for (const name of body.retiredCaches ?? []) globalThis.caches?.delete(name).catch(() => {});
    // Garde la fonction de changement.
    this.onChange = onChange;
    // Repère des tuiles.
    this.root = new THREE.Object3D();
    // Son nom : celui de l'astre suivi de « -tiles ».
    this.root.name = `${body.name}-tiles`;
    // Astre aplati : la sphère des tuiles est écrasée le long de l'axe des pôles (+Y du repère). Toute la sélection
    // des tuiles se fait dans le repère local (sphère de rayon 1), où l'horizon et la visibilité restent exacts.
    // Rayon de l'astre, ou 1.
    const radius = body.radius ?? 1;
    // Échelle du repère : le rayon, réduit le long de l'axe des pôles pour un astre aplati.
    this.root.scale.set(radius, radius * (body.polarScale ?? 1), radius);
    // L'ajoute au parent de l'astre.
    body.parent.add(this.root);

    // Variables uniformes partagées par toutes les tuiles (début).
    this.uniforms = {
      // La direction du Soleil, l'ombre à 1 et l'astre sans air.
      sunV: { value: body.sunDir }, shade: { value: 1 }, airless: { value: body.airless ? 1 : 0 },
      // Le mode du calque : 1 pour un ombrage de relief, sinon 0.
      ovMode: { value: body.overlayMode === 'relief' ? 1 : 0 },
      // La texture des couleurs provisoire, son interrupteur coupé et l'affinage coupé.
      colorMap: { value: placeholderTexture() }, colorOn: { value: 0 }, panOn: { value: 0 },
      // La lumière cendrée : 0,5.
      earthshine: { value: 0.5 },
      // Détail simulé : (type, force). Type 0 = aucun, 1 = gaz, 2 = sol.
      // Le détail simulé : son type et sa force, ou 0.
      detail: { value: new THREE.Vector2(DETAIL_KINDS[body.detail] ?? 0, DETAIL_GAIN[body.detail] ?? 0) },
      // Relief (relief.jsx), partagé par toutes les tuiles : exagération des hauteurs (0 = coupé), force de l'ombrage
      // des pentes, force du relief estimé d'après l'image (astres sans données d'altitude).
      // L'exagération du relief, la force de son ombrage et la force du relief estimé : tous à 0.
      reliefExag: { value: 0 }, reliefShade: { value: 0 }, reliefImg: { value: 0 },
      // Fond des océans creusé et ombré (1) ou mer plate (0) : suit le relief (voir setRelief).
      // Le fond des océans : coupé.
      oceanOn: { value: 0 },
    // Fin des variables uniformes.
    };
    // Relief de l'astre : vraies altitudes (« terrarium ») ou estimation d'après l'image (« image »), ou aucun.
    // Sur téléphone, un relief allégé (maillage, niveau des tuiles d'altitude) : voir tuneRelief.
    // Relief de l'astre : mis en forme, puis allégé sur téléphone.
    this.relief = tuneRelief(normalizeRelief(body.relief, body.radiusKm), /Mobi|Android|iPhone|iPad/.test(globalThis.navigator?.userAgent || ''));
    // Les tuiles d'altitude et de profondeur déjà vues restent sur le disque du navigateur (voir reliefLoader).
    // Accès du relief : le chargeur par le disque et la lecture d'une fiche JSON.
    const reliefIo = { ...reliefLoader(), fetchJson };
    // Source des tuiles d'altitude, pour un relief Terrarium.
    this.reliefSource = this.relief?.kind === 'terrarium' ? new ReliefSource(this.relief, reliefIo) : null;
    // Fond des océans : tuiles de profondeur, si l'astre en a et si l'utilisateur ne l'a pas coupé (« gobai:relief-ocean »).
    // Source des fonds marins, si l'astre en a et si l'utilisateur ne l'a pas coupée :
    this.oceanSource = this.relief?.ocean && oceanChoice(readOceanChoice())
      // une source sur le réglage des fonds ;
      ? new ReliefSource(this.relief.ocean, reliefIo)
      // sinon aucune.
      : null;
    // Relief coupé pour l'instant.
    this.reliefOn = false;
    // Dernière mesure de la hauteur du sol : instant et valeur.
    this.reliefProbe = { at: 0, floor: 0 };
    // Vecteur de travail.
    this.local = new THREE.Vector3();
    // Relief en volume (vraies altitudes : la Terre) : coupé tant que l'utilisateur ne l'a pas allumé — la carte est
    // à plat, sans tuiles d'altitude à télécharger. Ombrage estimé d'après l'image (autres astres) : toujours actif.
    // Règle le relief : pour un relief Terrarium,
    this.setRelief(this.relief?.kind === 'terrarium'
      // le choix gardé par l'utilisateur, coupé par défaut ;
      ? reliefChoice(readReliefChoice(), this.relief.exaggeration ?? 1, false)
      // sinon actif.
      : { on: true, exaggeration: this.relief?.exaggeration ?? 1 });
    // Numéro du type de détail simulé.
    this.detailKind = DETAIL_KINDS[body.detail] ?? 0;
    // Mode du calque de l'astre.
    this.overlayMode = body.overlayMode === 'relief' ? 1 : 0;
    // Fond : aucun.
    this.base = null;       // { id, source, layer }
    // Calque : aucun.
    this.overlay = null;    // { id, source }
    // Jeton qui invalide les chargements en cours.
    this.token = 0;         // invalide les chargements en cours quand on change de fond
    // Dernière erreur : aucune.
    this.lastError = null;
    // Dernier état publié.
    this.snap = null;
    // Sa signature.
    this.snapSig = '';

    // Champ de vision de la caméra.
    this.frustum = new THREE.Frustum();
    // Matrice de projection et de vue.
    this.proj = new THREE.Matrix4();
    // Inverse de la matrice du repère.
    this.inv = new THREE.Matrix4();
    // Sphère de travail.
    this.sphere = new THREE.Sphere();
    // Vecteur de travail.
    this.tmp = new THREE.Vector3();
    // Vecteur de travail pour la visée.
    this.fwd = new THREE.Vector3();
    // Vecteur de travail pour le haut de l'image.
    this.upv = new THREE.Vector3();
  // Fin du constructeur.
  }

  /**
   * Règle le relief de l'astre : { on, exaggeration } (1 = hauteurs réelles). Sans données d'altitude, seul l'ombrage
   * estimé d'après l'image suit `on`. Effet immédiat sur les tuiles déjà affichées (réglages partagés).
   */
  // setRelief : règle le relief ; actif et sans exagération par défaut (début).
  setRelief({ on = true, exaggeration = 1 } = {}) {
    // Le relief de l'astre.
    const r = this.relief;
    // État précédent.
    const was = this.reliefOn;
    // Actif seulement si l'astre a un relief.
    this.reliefOn = Boolean(on && r);
    // Exagération : celle demandée pour un relief Terrarium actif, sinon 0.
    this.uniforms.reliefExag.value = this.reliefOn && r.kind === 'terrarium' ? exaggeration : 0;
    // Ombrage des pentes : celui du réglage pour un relief Terrarium actif, sinon 0.
    this.uniforms.reliefShade.value = this.reliefOn && r.kind === 'terrarium' ? r.shade : 0;
    // Relief estimé : sa force pour un relief par l'image actif, sinon 0.
    this.uniforms.reliefImg.value = this.reliefOn && r.kind === 'image' ? r.strength : 0;
    // Fond des océans : actif avec un relief Terrarium actif et une source des fonds.
    this.uniforms.oceanOn.value = this.reliefOn && r.kind === 'terrarium' && this.oceanSource ? 1 : 0;
    // Remet à zéro la mesure de la hauteur du sol.
    this.reliefProbe = { at: 0, floor: 0 };
    // Relief en volume allumé ou coupé : les tuiles affichées sont reconstruites (maillage à plat, sans tuiles
    // d'altitude, ou maillage soulevé). Les images viennent des caches : rien n'est retéléchargé.
    // Si l'état a changé pour un relief Terrarium et qu'un fond est affiché : reconstruit la couche.
    if (was !== this.reliefOn && r?.kind === 'terrarium' && this.base) this.rebuildLayer();
    // Renvoie l'état.
    return this.reliefOn;
  // Fin de setRelief.
  }

  /**
   * Hauteur du sol sous la caméra, en rayons de l'astre (exagération comprise) : la caméra ne doit pas descendre
   * dessous. Relue au plus trois fois par seconde, dans la tuile d'altitude la plus fine déjà chargée ; 0 sans relief.
   * @param camWorld position de la caméra dans la scène ; now en ms
   */
  // groundFloor : la hauteur du sol sous la caméra (début).
  groundFloor(camWorld, now) {
    // Exagération en vigueur.
    const exag = this.uniforms.reliefExag.value;
    // Couche du fond.
    const layer = this.base?.layer;
    // Sans exagération ou sans couche : 0.
    if (!(exag > 0) || !layer) return 0;
    // Mesure de moins de 300 ms : la même valeur.
    if (now - this.reliefProbe.at < 300) return this.reliefProbe.floor;
    // Met à jour la matrice du repère.
    this.root.updateWorldMatrix(true, false);
    // Position de la caméra.
    this.local.copy(camWorld);
    // Dans le repère de l'astre.
    this.root.worldToLocal(this.local);
    // Sa longitude et sa latitude.
    const [lon, lat] = xyzToLonLat([this.local.x, this.local.y, this.local.z]);
    // Altitude du sol à cet endroit, en mètres.
    const meters = layer.heightAt(lon, lat);
    // Nouvelle mesure ; sans altitude connue, l'ancienne valeur est gardée.
    this.reliefProbe = { at: now, floor: meters === null ? this.reliefProbe.floor : groundFloorRadii(meters, exag, this.relief.radiusM) };
    // Renvoie la hauteur.
    return this.reliefProbe.floor;
  // Fin de groundFloor.
  }

  /** Vrai dès qu'un fond cartographique est choisi (même s'il charge encore). */
  // active : vrai dès qu'un fond est choisi.
  get active() { return Boolean(this.base); }

  // -------------------------------------------------------------- commandes

  /** Choisit le fond (null = aucun : sphère de fond seule). Renvoie les infos de la couche, ou lève une erreur. */
  // setBase, asynchrone : choisit le fond (début).
  async setBase(layerId) {
    // Nouveau jeton.
    const token = ++this.token;
    // Sans identifiant : retire le fond, efface l'erreur et prévient l'interface.
    if (!layerId) { this.clearBase(); this.lastError = null; this.onChange(); return null; }
    // Même fond : ses informations.
    if (this.base?.id === layerId) return this.base.source.info;

    // Source d'images de la couche demandée.
    const source = new TileSource({ api: this.api, layerId, onChange: this.onChange, persistentCache: this.body.persistentCache, directCache: this.body.directCache });
    // Essai (début).
    try {
      // Attend son démarrage.
      await source.start();
    // En cas d'erreur : la source est libérée et l'erreur relancée.
    } catch (e) { source.dispose(); throw e; }
    // Si la source est en erreur (début).
    if (source.status === 'error') {
      // Son message.
      const message = source.error;
      // La libère.
      source.dispose();
      // Si la demande est toujours la dernière : garde le message et prévient l'interface.
      if (token === this.token) { this.lastError = message; this.onChange(); }
      // Lève une erreur.
      throw new Error(message || 'Couche indisponible');
    // Fin de ce cas.
    }
    // Une autre demande est arrivée entre-temps : la source est libérée.
    if (token !== this.token) { source.dispose(); return null; }

    // Retire le fond précédent.
    this.clearBase();
    // Couche de tuiles de la source.
    const layer = this.buildLayer(source);
    // Nouveau fond.
    this.base = { id: layerId, source, layer };
    // Lui branche le calque en cours.
    if (this.overlay) layer.setOverlaySource(this.overlay.source);
    // Efface l'erreur.
    this.lastError = null;
    // Prévient l'interface.
    this.onChange();
    // Renvoie les informations de la couche.
    return source.info;
  // Fin de setBase.
  }

  /** Reconstruit la couche de tuiles du fond en place (même source) : appelé quand le relief en volume change. */
  // rebuildLayer : reconstruit la couche du fond (début).
  rebuildLayer() {
    // L'identifiant et la source du fond.
    const { id, source } = this.base;
    // Libère l'ancienne couche.
    this.base.layer.dispose();
    // Nouvelle couche.
    const layer = this.buildLayer(source);
    // La garde.
    this.base = { id, source, layer };
    // Lui branche le calque en cours.
    if (this.overlay) layer.setOverlaySource(this.overlay.source);
    // Prévient l'interface.
    this.onChange();
  // Fin de rebuildLayer.
  }

  /** Couche de tuiles d'une source, réglée pour l'astre et l'appareil. */
  // buildLayer : crée la couche de tuiles d'une source (début).
  buildLayer(source) {
    // Le moteur.
    const { engine } = this;
    // Vrai sur téléphone ou tablette.
    const small = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
    // Renvoie la couche (début).
    return new TileLayer({
      // Son repère.
      root: this.root,
      // Sa source.
      source,
      // Les variables uniformes partagées.
      uniforms: this.uniforms,
      // Filtrage anisotrope : 8 sur ordinateur, 2 sur téléphone (moins de lectures de texture par pixel).
      // Filtrage anisotrope : celui du profil, sans dépasser celui de la carte graphique.
      maxAnisotropy: Math.min(engine.power?.anisotropy ?? 8, engine.renderer.capabilities.getMaxAnisotropy()),
      // Nombre de tuiles gardées : 120 sur téléphone, 260 sinon.
      capacity: small ? 120 : 260,
      // Téléchargements simultanés : 6 par défaut (4 sur mobile) ; davantage pour un astre servi en HTTP/2 par l'API.
      // Téléchargements simultanés : ceux de l'astre (la moitié sur téléphone), sinon 4 ou 6.
      concurrency: this.body.concurrency ? (small ? Math.ceil(this.body.concurrency / 2) : this.body.concurrency) : (small ? 4 : 6),
      // Niveaux gardés en mémoire : ceux de l'astre, 2 au plus sur téléphone et 4 sinon.
      pinnedMaxZoom: Math.min(small ? 2 : 4, this.body.pinnedMaxZoom ?? 2),
      // Préchargement prédictif.
      prefetch: Boolean(this.body.prefetch),
      // Images gardées en mémoire vive : celles de l'astre, 96 au plus sur téléphone ; 0 sans préchargement.
      ramCapacity: this.body.prefetch ? Math.min(small ? 96 : Infinity, this.body.ramCapacity ?? 400) : 0,
      // Niveaux au-delà du niveau natif.
      overzoom: this.body.overzoom,
      // Relief en volume coupé : tuiles à plat (maillage simple), aucune tuile d'altitude ni de profondeur demandée.
      // Relief en volume, s'il est actif.
      relief: this.reliefOn && this.relief?.kind === 'terrarium' ? this.relief : null,
      // Source des tuiles d'altitude.
      reliefSource: this.reliefSource,
      // Source des fonds marins.
      oceanSource: this.oceanSource,
      // Tuiles envoyées au GPU par image : 8 sur ordinateur, 4 sur téléphone (pas de saccade).
      // Envois par image : 4 sur téléphone, 8 sinon.
      uploadsPerFrame: small ? 4 : 8,
    // Fin de la couche.
    });
  // Fin de buildLayer.
  }

  /** Calque transparent (routes, noms) fondu sur le fond. null = aucun. */
  // setOverlay, asynchrone : choisit le calque (début).
  async setOverlay(layerId) {
    // Sans identifiant (début).
    if (!layerId) {
      // Libère la source du calque.
      this.overlay?.source.dispose();
      // Plus de calque.
      this.overlay = null;
      // Le retire de la couche du fond.
      this.base?.layer.setOverlaySource(null);
      // Prévient l'interface.
      this.onChange();
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Même calque : rien à faire.
    if (this.overlay?.id === layerId) return;
    // Calques LiDAR HD : tous les niveaux déjà vus restent sur le disque du navigateur, dans leur propre cache à plafond.
    // Cache sur disque : pour un calque LiDAR HD,
    const directCache = layerId.startsWith('lidar-hd-')
      // un cache à part, jusqu'au niveau 22, plafonné selon l'appareil ;
      ? { name: LIDAR_DISK, maxZoom: 22, maxEntries: HANDHELD.test(globalThis.navigator?.userAgent || '') ? LIDAR_DISK_MAX.handheld : LIDAR_DISK_MAX.desktop }
      // sinon celui de l'astre.
      : this.body.directCache;
    // Calque des rues : dessiné dans le navigateur à partir de tuiles vectorielles (voir roadSource.jsx).
    // Source : pour le calque des rues,
    const source = layerId === ROADS_LAYER_ID
      // la source des rues ;
      ? new RoadSource({ onChange: this.onChange, handheld: HANDHELD.test(globalThis.navigator?.userAgent || '') })
      // sinon une source d'images.
      : new TileSource({ api: this.api, layerId, onChange: this.onChange, persistentCache: this.body.persistentCache, directCache });
    // Attend son démarrage.
    await source.start();
    // En erreur : la source est libérée et une erreur est levée.
    if (source.status === 'error') { const m = source.error; source.dispose(); throw new Error(m || 'Calque indisponible'); }
    // Libère la source du calque précédent.
    this.overlay?.source.dispose();
    // Nouveau calque.
    this.overlay = { id: layerId, source };
    // Le branche sur la couche du fond.
    this.base?.layer.setOverlaySource(source);
    // Prévient l'interface.
    this.onChange();
  // Fin de setOverlay.
  }

  /** Texture globale des couleurs (2:1 équirectangulaire), utilisée en mode composite. */
  // setColorTexture : pose la texture globale des couleurs (début).
  setColorTexture(texture) {
    // La texture.
    this.uniforms.colorMap.value = texture;
    // Son interrupteur.
    this.uniforms.colorOn.value = texture ? 1 : 0;
  // Fin de setColorTexture.
  }
  /**
   * Mode composite : couleurs naturelles (texture globale) + fond + calque.
   * pan = vrai : le fond est une image de détail en gris (luminosité fine), le calque un ombrage du relief.
   * pan = faux : le fond est l'ombrage du relief lui-même.
   */
  // setComposite : active ou coupe le mode composite (début).
  setComposite(on, { pan = false } = {}) {
    // Mode 2 quand il est actif, sinon le mode de l'astre.
    this.uniforms.ovMode.value = on ? 2 : this.overlayMode;
    // Affinage par le détail, si demandé.
    this.uniforms.panOn.value = on && pan ? 1 : 0;
  // Fin de setComposite.
  }

  /** Détail simulé au-delà de la résolution des images (astres qui en ont un : géantes gazeuses, satellites). */
  // setDetail : active ou coupe le détail simulé.
  setDetail(on) { this.uniforms.detail.value.x = on ? this.detailKind : 0; }
  /** Vrai quand la vue dépasse la résolution réelle de la carte et que le détail simulé la complète. */
  // synthetic : vrai quand le détail simulé complète la carte (début).
  get synthetic() {
    // Le fond.
    const b = this.base;
    // Vrai s'il y a un fond, un détail actif et un niveau affiché au-delà de celui de la source.
    return Boolean(b && this.uniforms.detail.value.x > 0 && b.layer.visibleZoom > b.source.maxZoom);
  // Fin de synthetic.
  }

  /** Éclairage jour/nuit sur la carte. */
  // setShade : active ou coupe l'éclairage jour/nuit.
  setShade(on) { this.uniforms.shade.value = on ? 1 : 0; }

  // clearBase : retire le fond (début).
  clearBase() {
    // Aucun : rien à faire.
    if (!this.base) return;
    // Libère la couche.
    this.base.layer.dispose();
    // Libère la source.
    this.base.source.dispose();
    // Plus de fond.
    this.base = null;
    // La sphère de fond redevient visible.
    this.body.mesh.visible = true;
  // Fin de clearBase.
  }

  // ------------------------------------------------------------------ image

  // update : à chaque image (début).
  update() {
    // Le fond.
    const b = this.base;
    // Aucun : rien à faire.
    if (!b) return;
    // Le moteur et l'astre.
    const { engine, body } = this;
    // La caméra.
    const { cam } = engine;

    // Ex. Terre : le repère des tuiles suit la rotation propre (le maillage), pas l'inclinaison déjà portée par le groupe.
    // Recopie la rotation propre de l'astre sur le repère, si l'astre le demande.
    body.syncRotation?.(this.root);
    // Seulement la chaîne parent → repère des tuiles (pas les centaines de tuiles : le rendu s'en charge).
    // Met à jour la matrice du repère.
    this.root.updateWorldMatrix(true, false);
    // Repère local = sphère de rayon 1 (l'échelle du repère contient le rayon de l'astre).
    // Son inverse.
    this.inv.copy(this.root.matrixWorld).invert();
    // Position de la caméra dans le repère de l'astre.
    const camLocal = this.tmp.copy(cam.position).applyMatrix4(this.inv);

    // Matrice de projection et de vue de la caméra.
    this.proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // Champ de vision correspondant.
    this.frustum.setFromProjectionMatrix(this.proj);
    // Matrice du repère.
    const world = this.root.matrixWorld;
    // Rayon de l'astre.
    const scale = body.radius ?? 1;
    // inFrustum : test large d'une sphère contre le champ de vision (début).
    const inFrustum = (c, r) => {
      // Centre de la sphère dans la scène.
      this.sphere.center.set(c[0], c[1], c[2]).applyMatrix4(world);
      // Son rayon, avec 15 % de marge.
      this.sphere.radius = r * scale * 1.15;
      // Vrai si elle touche le champ.
      return this.frustum.intersectsSphere(this.sphere);
    // Fin de inFrustum.
    };

    // Plans du champ de la caméra dans le repère de l'astre ([nx, ny, nz, d], tournés vers l'intérieur) : les cellules
    // hexagonales sont triées sur leur contour exact, vue de dessus comme vue 3/4 (voir cellOutside, hexCells.jsx).
    // Plans de travail, créés à la première image.
    if (!this.localPlanes) this.localPlanes = this.frustum.planes.map(() => new THREE.Plane());
    // Pour chaque plan du champ (début).
    const planes = this.frustum.planes.map((p, i) => {
      // Le plan dans le repère de l'astre.
      const q = this.localPlanes[i].copy(p).applyMatrix4(this.inv);
      // Sa normale et sa constante.
      return [q.normal.x, q.normal.y, q.normal.z, q.constant];
    // Fin de la boucle.
    });

    // Position de la caméra, en tableau.
    const cl = [camLocal.x, camLocal.y, camLocal.z];
    // Champ vertical en radians.
    const fovY = (cam.fov * Math.PI) / 180;
    // Direction de visée dans le repère de l'astre (priorités et prédiction).
    // Direction de visée dans le repère de l'astre.
    const f = cam.getWorldDirection(this.fwd).transformDirection(this.inv);
    // En tableau.
    const fwd = [f.x, f.y, f.z];
    // Haut de l'image dans le repère de l'astre : avec la visée, il fixe l'orientation du champ de vision
    // (la couche réutilise sa sélection tant que la vue ne bouge pas).
    // Haut de l'image dans le repère de l'astre.
    const u = this.upv.copy(cam.up).transformDirection(this.inv);
    // En tableau.
    const up = [u.x, u.y, u.z];
    // Rythme d'images sous l'objectif : moins de tuiles envoyées au GPU par image, pour ne pas le faire chuter.
    // Part des envois de tuiles autorisée, selon le rythme d'images.
    b.layer.uploadShare = uploadShare(engine.dprFrameMs ?? 0);
    // Met à jour la couche avec la vue.
    b.layer.update({ cam: cl, fwd, up, aspect: cam.aspect, fovY, viewportH: engine.H * engine.renderer.getPixelRatio(), inFrustum, planes });
    // Garde la vue pour l'état publié.
    this.view = { cam: cl, fovY, aspect: cam.aspect };

    // La sphère de fond n'est cachée que lorsque la carte couvre tout ce qui est visible, et jamais pendant un fondu :
    // une cellule qui apparaît là où il n'y avait rien (bord de l'écran) part de l'image de fond, pas du ciel noir.
    // Fondu en cours.
    const fading = b.layer.fading;
    // La sphère de fond est visible tant que la carte ne couvre pas tout, ou pendant un fondu.
    body.mesh.visible = !b.layer.fullCover || fading;
    // Téléphone au repos (20 images par seconde) : plein rythme le temps du fondu, sinon il avance par à-coups.
    // Pendant un fondu : le moteur est noté actif.
    if (fading) engine.activeAt = performance.now();
  // Fin de update.
  }

  /** État résumé pour l'interface, objet stable tant que rien d'affiché n'a changé. */
  // snapshot : l'état résumé pour l'interface (début).
  snapshot() {
    // Le fond.
    const b = this.base;
    // Les informations de sa source.
    const info = b?.source.info;
    // Limites géographiques de la vue.
    const bounds = b && this.view ? viewportBounds(this.view.cam, this.view.fovY, this.view.aspect) : null;
    // r : arrondi à deux décimales.
    const r = (v) => Math.round(v * 100) / 100;
    // État (début).
    const state = {
      // Identifiant du fond.
      layerId: b?.id ?? null,
      // Identifiant du calque.
      overlayId: this.overlay?.id ?? null,
      // Statut : coupé ou en erreur sans fond ; sinon en erreur, en chargement ou prêt.
      status: !b ? (this.lastError ? 'error' : 'off') : b.source.status === 'error' ? 'error' : b.layer.loading > 0 ? 'loading' : 'ready',
      // Message d'erreur.
      error: this.lastError || b?.source.error || null,
      // Fournisseur.
      provider: info?.provider ?? null,
      // Couche expérimentale.
      experimental: Boolean(info?.experimental),
      // Au-delà de la résolution réelle, l'image est complétée par un détail simulé : on le dit avec les sources.
      // Le calque affiché (ex. LiDAR HD de l'IGN) est cité avec le fond.
      // Texte des sources : le fond, le calque et la mention du détail simulé,
      attributionText: [info?.attribution?.text, b ? this.overlay?.source.info?.attribution?.text : null, this.synthetic ? SYNTHETIC_NOTE : null]
        // sans vide ni doublon, séparés par un point médian.
        .filter((text, i, all) => text && all.indexOf(text) === i).join(' · '),
      // Détail simulé.
      synthetic: this.synthetic,
      // Niveau affiché.
      zoom: b?.layer.visibleZoom ?? 0,
      // Tuiles en chargement.
      loading: b?.layer.loading ?? 0,
      // Avancement du préchargement.
      preload: b ? b.layer.preload : { done: 0, total: 0 },
      // Caches : L1 = textures GPU, L2 = images décodées en RAM, L3 = disque du navigateur (lus / téléchargés).
      // Caches, s'il y a un fond (début) :
      caches: b ? {
        // textures en mémoire graphique et images en mémoire vive,
        gpu: b.layer.cache.size + b.layer.pinned.size, ram: b.layer.ram.size,
        // lectures sur disque et téléchargements.
        disk: b.source.stats.disk, net: b.source.stats.network,
      // Fin des caches.
      } : null,
      // Limites de la vue, arrondies, avec le niveau borné entre 0 et 22.
      bounds: bounds ? { north: r(bounds.north), south: r(bounds.south), east: r(bounds.east), west: r(bounds.west), zoom: Math.max(0, Math.min(22, b.layer.visibleZoom)) } : null,
    // Fin de l'état.
    };
    // Signature de l'état.
    const sig = JSON.stringify(state);
    // Si elle a changé : garde la signature et l'état.
    if (sig !== this.snapSig) { this.snapSig = sig; this.snap = state; }
    // Renvoie l'état gardé.
    return this.snap ?? (this.snap = state);
  // Fin de snapshot.
  }

  // dispose : libère tout (début).
  dispose() {
    // Invalide les chargements en cours.
    this.token++;
    // Retire le fond.
    this.clearBase();
    // Libère la source du calque.
    this.overlay?.source.dispose();
    // Plus de calque.
    this.overlay = null;
    // Retire le repère du parent.
    this.body.parent.remove(this.root);
  // Fin de dispose.
  }
// Fin de la classe TileManager.
}


/** Choix « fond des océans » gardé dans le navigateur (« gobai:relief-ocean » : « 0 » = mer plate), ou null. */
// readOceanChoice : le choix du fond des océans gardé dans le navigateur (début).
function readOceanChoice() {
  // Le lit dans le stockage local ; null s'il est absent ou refusé.
  try { return globalThis.localStorage?.getItem('gobai:relief-ocean') ?? null; } catch { return null; }
// Fin de readOceanChoice.
}

/**
 * Choix du relief en volume de la Terre gardé dans le navigateur (« gobai:relief-3d » : « 0 » = coupé, nombre =
 * exagération), ou null (jamais choisi : coupé). L'ancienne clé « gobai:relief », allumée par défaut, n'est plus lue.
 */
// Déclare et exporte la clé du choix du relief en volume.
export const RELIEF_KEY = 'gobai:relief-3d';
// readReliefChoice : le choix du relief gardé dans le navigateur (début).
function readReliefChoice() {
  // Le lit dans le stockage local ; null s'il est absent ou refusé.
  try { return globalThis.localStorage?.getItem(RELIEF_KEY) ?? null; } catch { return null; }
// Fin de readReliefChoice.
}

/** Lit une fiche JSON d'un fournisseur (5 s au plus). */
// Motif qui reconnaît un téléphone ou une tablette.
const HANDHELD = /Mobi|Android|iPhone|iPad/;

/**
 * Chargement (`loadImage`) et préchargement (`warm`) d'une tuile de relief à travers le disque du navigateur : lue sur place si elle y est déjà (aucune
 * requête), sinon téléchargée, enregistrée puis décodée. Le cache est partagé par tous les astres et plafonné.
 * Sans Cache Storage, ou si ce chemin échoue (fournisseur qui refuse `fetch`), l'image est chargée comme avant.
 */
// reliefLoader : les accès du relief à travers le disque du navigateur (début).
function reliefLoader() {
  // Plafond du cache, selon l'appareil.
  const max = HANDHELD.test(globalThis.navigator?.userAgent || '') ? RELIEF_DISK_MAX.handheld : RELIEF_DISK_MAX.desktop;
  // Compteurs de chargements.
  const stats = { network: 0, disk: 0 };
  // Cache sur disque : pas encore ouvert.
  let disk; // ouvert à la première tuile
  // open : ouvre le cache à la première demande.
  const open = () => { if (disk === undefined) disk = openDisk(RELIEF_DISK); return disk; };
  // stored : signale une écriture au cache.
  const stored = () => diskWritten(RELIEF_DISK, disk, max);
  // Renvoie les accès (début).
  return {
    // loadImage : par le cache sur disque, avec repli sur le chargement direct ; direct sans cache.
    loadImage: (url) => (open() ? loadImageCached(url, disk, stats, false, stored).catch(() => loadImage(url)) : loadImage(url)),
    // Préchargement : fichier téléchargé en priorité basse et enregistré, sans décodage ni mémoire graphique.
    // warm, asynchrone : précharge un fichier (début).
    warm: async (url) => {
      // Le cache.
      const cache = open() && await disk;
      // Sans cache, ou fichier déjà présent : rien.
      if (!cache || await cache.match(url).catch(() => null)) return false;
      // Télécharge le fichier en priorité basse.
      const res = await fetch(url, { priority: 'low' });
      // Réponse en erreur, ou qui n'est pas une image : rien.
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return false;
      // L'enregistre dans le cache.
      await cache.put(url, res);
      // Signale l'écriture.
      stored();
      // Préchargé.
      return true;
    // Fin de warm.
    },
  // Fin des accès.
  };
// Fin de reliefLoader.
}

// fetchJson, asynchrone : lit un document JSON (début).
async function fetchJson(url) {
  // Contrôleur d'annulation.
  const ctrl = new AbortController();
  // Annulation après 5 secondes.
  const timer = setTimeout(() => ctrl.abort(), 5000);
  // Essai (début).
  try {
    // Télécharge le document.
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    // Réponse en erreur : exception avec le code HTTP.
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Renvoie le JSON.
    return await res.json();
  // Dans tous les cas (début).
  } finally {
    // Annule la minuterie.
    clearTimeout(timer);
  // Fin de l'essai.
  }
// Fin de fetchJson.
}
