// Importe uploadShare, la part des envois de tuiles autorisée, depuis powerSaver.
import { uploadShare } from '../powerSaver';
// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la source d'images des tuiles, le chargement d'une image (sans cache) et la limite par serveur, depuis tileSource.
import { HOST_GATE, TileSource, loadImage } from './tileSource';
// Importe les compteurs réseau des tuiles, depuis netLoads.
import { NET_STATS } from './netLoads';
// Importe la source des tuiles d'altitude et les fonctions de réglage du relief, depuis relief.
import { MAX_DEPTH_M, ReliefSource, groundFloorRadii, normalizeRelief, oceanChoice, reliefChoice, tuneRelief } from './relief';
// Importe les lumières de la nuit : la clé et la lecture de leur interrupteur, et leur source.
import { LIGHTS_MOSAIC_PX, LIGHTS_PAD, NIGHT_LIGHTS_KEY, NightLightsSource, assembleLightsMosaic, mosaicLevelFor, nightLightsChoice } from './nightLights';
// Importe xyzToLonLat, la conversion d'un point en longitude et latitude, depuis mercator.
import { xyzToLonLat } from './mercator';
// Importe TileLayer, la couche de tuiles, depuis tileLayer.
import { TileLayer } from './tileLayer';
// Importe backdropScale, le rayon de la sphère de fond sous la carte, depuis tileGeometry.
import { backdropScale } from './tileGeometry';
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
      // Lumières humaines de la nuit : allumées si l'astre en a (la Terre) et si l'utilisateur ne les a pas coupées.
      // L'interrupteur des lumières de la nuit.
      lightsOn: { value: body.nightLights && nightLightsChoice(readLightsChoice()) ? 1 : 0 },
      // Vue de la pollution lumineuse : mosaïque mondiale des lumières (en attente), sa présence, et le mode « toute la Terre de nuit ».
      lgMap: { value: placeholderTexture() }, lgOn: { value: 0 }, lightView: { value: 0 },
      // Modèle d'éclairage : 1 pour la Terre (lumière physique, voir surfaceLight.jsx), 0 pour le modèle général.
      surfModel: { value: body.lighting === 'earth' ? 1 : 0 },
      // Masque de l'eau (reflet du Soleil sur la mer) : en attente, absent.
      wMap: { value: placeholderTexture() }, wOn: { value: 0 },
      // Lumières : côté des textures de tuiles (bordure comprise) et de la mosaïque mondiale (en pixels), et lecture en
      // lumière linéaire (images stockées en sRGB et tuiles bordées par leurs voisines, WebGL 2 seulement).
      ltSize: { value: new THREE.Vector2().setScalar((body.nightLights?.tileSize || 256) + (engine.renderer?.capabilities?.isWebGL2 ? 2 * LIGHTS_PAD : 0)) },
      lgSize: { value: new THREE.Vector2(LIGHTS_MOSAIC_PX, LIGHTS_MOSAIC_PX) },
      ltLinear: { value: engine.renderer?.capabilities?.isWebGL2 ? 1 : 0 },
    // Fin des variables uniformes.
    };
    // Avec un masque de l'eau (la Terre) : chargé une fois, partagé par toutes les tuiles.
    if (body.waterMask) this.loadWaterMask(body.waterMask);
    // Relief de l'astre : vraies altitudes (« terrarium ») ou estimation d'après l'image (« image »), ou aucun.
    // Relief de l'astre : mis en forme et réglé (voir tuneRelief), le même sur tous les appareils.
    this.relief = tuneRelief(normalizeRelief(body.relief, body.radiusKm));
    // Facteur du rayon de la sphère de fond : 1 tant qu'aucune carte n'est affichée (la sphère est alors l'astre).
    this.backdropK = 1;
    // Accès du relief : le chargement d'une image (sans cache, en mémoire seulement) et la lecture d'une fiche JSON.
    const reliefIo = { loadImage: (url) => loadImage(url), fetchJson };
    // Source des tuiles d'altitude, pour un relief Terrarium.
    this.reliefSource = this.relief?.kind === 'terrarium' ? new ReliefSource(this.relief, reliefIo) : null;
    // Fond des océans : tuiles de profondeur, si l'astre en a et si l'utilisateur ne l'a pas coupé (« gobai:relief-ocean »).
    // Source des fonds marins, si l'astre en a et si l'utilisateur ne l'a pas coupée :
    this.oceanSource = this.relief?.ocean && oceanChoice(readOceanChoice())
      // une source sur le réglage des fonds ;
      ? new ReliefSource(this.relief.ocean, reliefIo)
      // sinon aucune.
      : null;
    // Source des lumières de la nuit, si l'astre en a (la Terre) : créée même coupées, pour pouvoir les rallumer.
    this.lightsSource = body.nightLights ? new NightLightsSource(body.nightLights) : null;
    // Lumières allumées dès le départ : couverture mondiale permanente chargée tout de suite (jamais de trou).
    if (this.lightsSource && this.uniforms.lightsOn.value > 0) this.loadLightsMosaic();
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
    // Fond des océans : actif avec un relief Terrarium actif et une source des fonds. Altitudes signées (la Lune) :
    // même passage du shader sans source des fonds, les valeurs négatives de la tuile creusent alors la surface.
    this.uniforms.oceanOn.value = this.reliefOn && r.kind === 'terrarium' && (this.oceanSource || r.signed) ? 1 : 0;
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
   * Lumières humaines de la nuit (pollution lumineuse) : allumées ou coupées. Le choix est gardé dans le navigateur
   * (« gobai:lumieres-nuit ») ; allumées, les tuiles affichées demandent leurs lumières (rien n'est rechargé du fond).
   */
  /**
   * Vue de la pollution lumineuse depuis l'espace : toute la Terre de nuit, ses lumières allumées partout. Le monde
   * entier est couvert par la mosaïque mondiale (chargée si elle ne l'est pas déjà), puis affiné par les tuiles affichées.
   */
  // setLightView : allume ou coupe la vue de nuit ; renvoie l'état (début).
  setLightView(on) {
    // Astre sans lumières : coupée.
    if (!this.lightsSource) return false;
    // Mode du shader.
    this.uniforms.lightView.value = on ? 1 : 0;
    // Allumée : charge toute la Terre (une seule fois).
    if (on) this.loadLightsMosaic();
    // Renvoie l'état.
    return Boolean(on);
  // Fin de setLightView.
  }

  /**
   * Masque mondial de l'eau (Web Mercator, blanc = mer, voir frontend/scripts/masque-eau.py) : le shader des tuiles
   * le lit avec globalRect pour ne poser le reflet du Soleil que sur la mer. Sans masque (échec), pas de reflet.
   */
  // loadWaterMask : charge le masque de l'eau (début).
  loadWaterMask(url) {
    // Charge l'image (début).
    loadImage(url).then((img) => {
      // Texture de l'image.
      const tex = new THREE.Texture(img);
      // Avec mipmaps, lissée, sans répétition aux bords.
      tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      // À envoyer au GPU.
      tex.needsUpdate = true;
      // Posée pour toutes les tuiles de l'astre, et allumée.
      this.uniforms.wMap.value = tex; this.uniforms.wOn.value = 1;
    // Échec : pas de reflet, rien d'autre ne change.
    }).catch(() => {});
  // Fin de loadWaterMask.
  }

  /**
   * Charge la mosaïque mondiale des lumières (2 048 px), une seule fois (un échec permet de réessayer plus tard) :
   * couverture permanente sous les tuiles fines, et source du halo des villes (une seule image, sans raccord).
   */
  // loadLightsMosaic : la mosaïque mondiale des lumières (début).
  loadLightsMosaic() {
    // Déjà chargée ou en cours : la même promesse.
    if (this.lightsMosaic) return this.lightsMosaic;
    // Assemble les tuiles du monde entier (début).
    this.lightsMosaic = assembleLightsMosaic(this.lightsSource, mosaicLevelFor(this.lightsSource.tileSize)).then(({ canvas, got }) => {
      // Aucune tuile : échec, à réessayer.
      if (!got) throw new Error('Lumières indisponibles');
      // Texture du canevas.
      const tex = new THREE.CanvasTexture(canvas);
      // Avec mipmaps, lissée ; continue à l'antiméridien (répétée en longitude), bornée aux pôles.
      tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
      // Stockée en sRGB quand la carte graphique le permet : lue en lumière linéaire, comme les tuiles (voir ltLinear).
      if (this.uniforms.ltLinear.value > 0) tex.internalFormat = 'SRGB8_ALPHA8';
      // Posée pour toutes les tuiles de l'astre, et allumée.
      this.uniforms.lgMap.value = tex; this.uniforms.lgOn.value = 1;
      // Prévient l'interface.
      this.onChange();
    // En cas d'échec : oubliée, pour réessayer.
    }).catch(() => { this.lightsMosaic = null; });
    // Renvoie la promesse.
    return this.lightsMosaic;
  // Fin de loadLightsMosaic.
  }

  // setNightLights : allume ou coupe les lumières de la nuit ; renvoie l'état (début).
  setNightLights(on) {
    // Astre sans lumières : coupées.
    if (!this.lightsSource) return false;
    // Garde le choix ; un refus est ignoré.
    try { globalThis.localStorage?.setItem(NIGHT_LIGHTS_KEY, on ? '1' : '0'); } catch { /* stockage refusé : valable pour la session */ }
    // Interrupteur du shader.
    this.uniforms.lightsOn.value = on ? 1 : 0;
    // Allumées : la couverture mondiale permanente (chargée une seule fois).
    if (on) this.loadLightsMosaic();
    // Renvoie l'état.
    return Boolean(on);
  // Fin de setNightLights.
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
    const source = new TileSource({ api: this.api, layerId, onChange: this.onChange });
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
    // Renvoie la couche, réglée de la même façon sur tous les appareils (début).
    return new TileLayer({
      // Son repère.
      root: this.root,
      // Sa source.
      source,
      // Les variables uniformes partagées.
      uniforms: this.uniforms,
      // Filtrage anisotrope : celui du profil (8), sans dépasser celui de la carte graphique.
      maxAnisotropy: Math.min(engine.power?.anisotropy ?? 8, engine.renderer.capabilities.getMaxAnisotropy()),
      // Nombre de tuiles gardées : 260.
      capacity: 260,
      // Téléchargements simultanés : ceux de l'astre (davantage pour un astre servi en HTTP/2 par l'API), sinon 6.
      concurrency: this.body.concurrency || 6,
      // Niveaux gardés en mémoire : ceux de l'astre, 4 au plus.
      pinnedMaxZoom: Math.min(4, this.body.pinnedMaxZoom ?? 2),
      // Préchargement prédictif.
      prefetch: Boolean(this.body.prefetch),
      // Images gardées en mémoire vive : celles de l'astre ; 0 sans préchargement.
      ramCapacity: this.body.prefetch ? this.body.ramCapacity ?? 400 : 0,
      // Niveaux au-delà du niveau natif.
      overzoom: this.body.overzoom,
      // Relief en volume coupé : tuiles à plat (maillage simple), aucune tuile d'altitude ni de profondeur demandée.
      // Relief en volume, s'il est actif.
      relief: this.reliefOn && this.relief?.kind === 'terrarium' ? this.relief : null,
      // Source des tuiles d'altitude.
      reliefSource: this.reliefSource,
      // Source des fonds marins.
      oceanSource: this.oceanSource,
      // Source des lumières de la nuit.
      nightLights: this.lightsSource,
      // Tuiles envoyées au GPU par image : 8.
      uploadsPerFrame: 8,
      // Rayon de l'astre en km : la distance affichée choisit le palier de zoom de la table du serveur.
      radiusKm: this.body.radiusKm || 0,
      // Appareil : tenu en main (budget du téléphone) et économie d'énergie (budget réduit), lus à chaque image.
      device: () => ({ handheld: Boolean(engine.power?.handheld), saving: Boolean(engine.saving) }),
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
    // Calque des rues : dessiné dans le navigateur à partir de tuiles vectorielles (voir roadSource.jsx).
    // Source : pour le calque des rues,
    const source = layerId === ROADS_LAYER_ID
      // la source des rues ;
      ? new RoadSource({ onChange: this.onChange })
      // sinon une source d'images.
      : new TileSource({ api: this.api, layerId, onChange: this.onChange });
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

  /**
   * Rayon de la sphère de fond, en facteur du rayon de l'astre. Seule sa géométrie est mise à l'échelle : ses enfants
   * (nuages LiDAR de la Terre) et sa forme (aplatissement des géantes gazeuses, porté par l'objet) ne bougent pas.
   */
  // placeBackdrop : le facteur voulu (début).
  placeBackdrop(k) {
    // Inchangé : rien (le calcul n'est refait que lorsque le mode ou le relief change).
    if (k === this.backdropK) return;
    // Géométrie ramenée du facteur courant au facteur voulu (normales et volumes englobants suivent).
    this.body.mesh.geometry.scale(k / this.backdropK, k / this.backdropK, k / this.backdropK);
    // Garde le facteur.
    this.backdropK = k;
  // Fin de placeBackdrop.
  }

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
    // Et reprend le rayon de l'astre : sans carte, c'est elle qui le dessine.
    this.placeBackdrop(1);
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
    // Hauteur de l'écran pour le détail des tuiles : en pixels à la densité plafond de l'appareil (engine.dprMax), pas à
    // la densité en cours. Quand la résolution adaptative baisse pour garder le rythme (téléphone surtout), l'image
    // est dessinée avec moins de pixels, mais les tuiles restent aussi détaillées : la Terre vue de l'espace garde
    // le même niveau de détail sur téléphone que sur ordinateur.
    const viewportH = engine.H * (engine.dprMax || engine.renderer.getPixelRatio());
    // Met à jour la couche avec la vue.
    b.layer.update({ cam: cl, fwd, up, aspect: cam.aspect, fovY, viewportH, inFrustum, planes });
    // Garde la vue pour l'état publié.
    this.view = { cam: cl, fovY, aspect: cam.aspect };

    // La sphère de fond n'est cachée que lorsque la carte couvre tout ce qui est visible, et jamais pendant un fondu :
    // une cellule qui apparaît là où il n'y avait rien (bord de l'écran) part de l'image de fond, pas du ciel noir.
    // Fondu en cours.
    const fading = b.layer.fading;
    // La sphère de fond est visible tant que la carte ne couvre pas tout, ou pendant un fondu.
    body.mesh.visible = !b.layer.fullCover || fading;
    // Fond des océans creusé par le relief, en rayons : la plus grande profondeur, exagération comprise.
    const seaFloor = this.uniforms.oceanOn.value > 0 && this.relief?.radiusM ? (MAX_DEPTH_M / this.relief.radiusM) * this.uniforms.reliefExag.value : 0;
    // La sphère de fond est posée sous la carte : elle ne perce jamais ses facettes (voir BACKDROP_DROP).
    this.placeBackdrop(backdropScale(b.layer.hexOn, seaFloor));
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
      // Caches : L1 = textures GPU, L2 = images décodées en RAM (rien sur le disque du navigateur).
      // Caches, s'il y a un fond (début) :
      caches: b ? {
        // textures en mémoire graphique et images en mémoire vive,
        gpu: b.layer.cache.size + b.layer.pinned.size, ram: b.layer.ram.size,
        // téléchargements.
        net: b.source.stats.network,
      // Fin des caches.
      } : null,
      // Performance : première tuile, débit, envoi au GPU, réseau de la session et places par serveur.
      perf: b ? { ...b.layer.perfSnapshot(), net: { ...NET_STATS }, hosts: HOST_GATE.limits() } : null,
      // Palier de zoom en cours (table du serveur) : identifiant, nom, niveau le plus fin et budget de tuiles ; null sans palier.
      tier: b?.layer.tier ? { id: b.layer.tier.id, label: b.layer.tier.label, maxZoom: b.layer.tier.maxZoom, budget: b.layer.budget } : null,
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


/** Choix des lumières de la nuit gardé dans le navigateur (« gobai:lumieres-nuit » : « 0 » = coupées), ou null. */
// readLightsChoice : le choix des lumières de la nuit (début).
function readLightsChoice() {
  // Le lit dans le stockage local ; null s'il est absent ou refusé.
  try { return globalThis.localStorage?.getItem(NIGHT_LIGHTS_KEY) ?? null; } catch { return null; }
// Fin de readLightsChoice.
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
