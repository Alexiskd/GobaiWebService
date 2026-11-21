// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe EARTH_RADIUS_M, le rayon de la Terre en mètres, depuis gps.
import { EARTH_RADIUS_M } from '../InputEngine/gps.jsx';
// Importe xyzToLonLat, la longitude et la latitude d'un point de la sphère, depuis mercator.
import { xyzToLonLat } from '../MapEngine/mercator.jsx';
// Importe LidarDrape, l'orthophoto drapée sur les points, depuis lidarDrape.
import { LidarDrape } from './lidarDrape.jsx';
// Importe drapePlan et nodeDrape, le plan du drapage et son calage par nœud, depuis lidarDrapeMath.
import { drapePlan, nodeDrape } from './lidarDrapeMath.jsx';
// Importe la base de données des nuages, en mémoire, et ses capacités, depuis lidarStore.
import { LIDAR_STORE_BYTES, LidarStore } from './lidarStore.jsx';
// Importe la palette, les constantes et les fonctions de calcul des dalles LiDAR, depuis lidarPointsMath.
import { DOWNSCALE_FILL, LIDAR_PALETTE, boxDistance2D, budgetForHeight, densityOrder, domeBudget, domeRadius, expandLonLatBox, inDome, lonLatDistanceM, LUM_NEUTRAL, POINT_FILL, ROOT_KEY, buildTree, dayTint, decodeNode, downscalePoints, groundLevel, levelSpacing, loadProgress, boxShiftM, nodeUrl, selectNodes, showCloud, tileFrame } from './lidarPointsMath.jsx';

// Dalles LiDAR en vrais points 3D sur la Terre (LiDAR HD de l'IGN). Chaque dalle est un octree additif servi par
// l'API (GET /lidar) : la racine donne la dalle entière, les niveaux suivants la densifient.
//
// Fonctionnement en dôme : un cercle net centré sous la caméra (rayon : 4 × sa hauteur, entre 800 m et 4 km), non
// dessiné. Chaque nuage dans le dôme est téléchargé et chargé par densité : les racines de toutes les dalles d'abord,
// puis le niveau suivant de chacune, uniformément (voir pump). La densité est adaptée à la taille du dôme, quel que
// soit le zoom : le budget de points est réparti sur tout le cercle, niveau par niveau, du centre vers le bord
// (domeBudget) ; plus le dôme est grand, moins il est dense. Le budget lui-même est fixé par la hauteur de la caméra
// (budgetForHeight). Chaque nœud téléchargé s'écrit en même temps dans une base de données en mémoire (1 Go sur
// ordinateur, 256 Mo sur téléphone, voir lidarStore.jsx) : un nœud qui revient dans le dôme y est relu sans réseau. Dès que le dôme bouge et qu'un nuage (ou
// une partie de nuage) en sort, il est supprimé aussitôt : points libérés, téléchargements abandonnés, dalle retirée.
// Rien n'est gardé sur l'appareil : les nœuds sont téléchargés sans cache (`cache: 'no-store'`), et à la mise à jour
// de l'app les nuages déjà téléchargés sont désinstallés (voir storagePurge.jsx). Seuls les nœuds dans le champ de la
// caméra sont dessinés. Les points sont rattachés au groupe de la Terre et recopient sa rotation propre, comme les tuiles et les
// frontières : la sphère de fond, elle, est masquée dès que la carte couvre toute la vue, et ses enfants avec elle.
//
// Affichage sans effet : un point apparaît dès que son fichier est décodé, à sa couleur définitive (classe du point
// × luminosité calculée à la préparation), avec la même teinte jour / nuit que les tuiles. Taille d'un point : celle
// qui remplit les surfaces une fois le détail chargé (l'écart toléré entre deux points à l'écran) ; de tout près, quand
// le niveau le plus fin est atteint, la taille réelle de ce niveau prend le relais.
//
// Couleur : le relevé laser n'en a pas. Par défaut les points prennent celle de l'orthophoto à leur verticale
// (drapage, voir lidarDrape.jsx), fondue avec ce que le laser sait : la luminosité calculée à la préparation garde
// le relief lisible, et les façades, que la photo vue du dessus ne montre pas, gardent en partie leur teinte de
// classe. Sans photo (mode « classes », ou zone pas encore reçue) : couleur de la classe du point.
//
// Profondeur : le relief des tuiles (30 m par pixel, toits compris) passe au-dessus des rues mesurées au laser.
// Dans l'emprise de la dalle, trois passes règlent cela : (1) la boîte de la dalle remet la profondeur au plus loin,
// (2) les points se dessinent avec leur propre profondeur logarithmique, précise au millimètre près du sol,
// (3) la boîte réécrit une profondeur normale pour ce qui est dessiné ensuite (atmosphère, nuages).

// La hauteur d'affichage du nuage (750 m, soit 0,75 km au HUD) et la règle d'affichage vivent dans le module de
// calcul, avec les autres fonctions pures : voir lidarPointsMath.jsx.
/** Budget maximal du dôme (le budget réel suit la hauteur, voir budgetForHeight), points gardés, écart minimal (px), chargements simultanés. */
// Réglages sur ordinateur : 3 millions de points dessinés au plus, 5 millions gardés, écart de 1,5 px, 6 chargements, orthophoto au niveau 18 sur 4 096 px.
const DESKTOP = { budget: 3_000_000, keep: 5_000_000, maxSpacingPx: 1.5, parallel: 6, drapeZoom: 18, drapeSize: 4096 };
// Réglages sur téléphone ou tablette : 1,2 million dessinés, 2 millions gardés, écart de 2,2 px, 4 chargements, orthophoto au niveau 17 sur 2 048 px.
const HANDHELD = { budget: 1_200_000, keep: 2_000_000, maxSpacingPx: 2.2, parallel: 4, drapeZoom: 17, drapeSize: 2048 };
// Délai entre deux sélections des nœuds : 120 ms.
const SELECT_EVERY_MS = 120;
/** Dôme : il n'existe que sous 3 km d'altitude ; recherche de ses dalles au plus toutes les 1,5 s, après 300 m de déplacement d'un bord. */
// Altitude du dôme, délai et déplacement minimal.
const DISCOVER_ALT_M = 3000, DISCOVER_EVERY_MS = 1500, DISCOVER_MOVE_M = 300;
/** Dalles gardées au plus, par sécurité (les plus éloignées du centre du dôme sortent d'abord). */
// Soixante-quatre dalles : un dôme de 4 km de rayon en contient une cinquantaine.
const MAX_TILES = 64;
// Délai avant un nouvel essai après un échec : 15 secondes.
const RETRY_AFTER_MS = 15_000;
/** Profondeur des points : logarithme de la distance, de 10 cm à 1 000 km. */
// Bornes de la profondeur des points : 10 cm et 1 000 km.
const DEPTH_NEAR_M = 0.1, DEPTH_FAR_M = 1_000_000;

/** Gain de luminosité des points : accordé à la clarté des orthophotos autour de la dalle. */
// Gain de luminosité des points : 1,3.
const POINT_GAIN = 1.3;
/** Drapage : part du relief du laser dans la couleur de la photo, gain de la photo, part de la teinte de classe sur les façades. */
// Drapage : part du relief à 0,4, gain de la photo à 1,08 et part de la teinte de classe sur les façades à 0,5.
const DRAPE_SHADE = 0.4, DRAPE_GAIN = 1.08, DRAPE_FACADE = 0.5;

// Shader de sommet des points, écrit ligne par ligne (début).
const pointVertex = [
  // Attribut du point : sa classe et sa luminosité.
  'attribute vec2 attr;',
  // Variables uniformes : taille, pixels par unité, bornes de taille, profondeur, teinte et palette des dix classes.
  'uniform float uSize;uniform float uPx;uniform vec2 uRange;uniform vec2 uDepth;uniform vec3 uTint;uniform vec3 uPal[10];',
  // Drapage : uOrtho = atlas de l'orthophoto (transparent là où elle n'est pas arrivée), uUvA / uUvB = affine des
  // coordonnées du nœud vers l'atlas, uDrape = 1 en mode photo, 2 en mode carte (couleur de la photo, sans retouche).
  // Variables uniformes du drapage : l'atlas, les deux parties du calage et l'interrupteur.
  'uniform sampler2D uOrtho;uniform vec4 uUvA;uniform vec2 uUvB;uniform float uDrape;',
  // Couleur et taille à l'écran transmises au shader de fragment.
  'varying vec3 vCol;varying float vSz;',
  // Fonction principale (début).
  'void main(){',
  // Position dans le repère de la caméra, puis à l'écran.
  'vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;',
  // Distance à la caméra, jamais nulle.
  'float w=max(gl_Position.w,1e-12);',
  // Taille du point en pixels, bornée.
  'gl_PointSize=clamp(uSize*uPx/w,uRange.x,uRange.y);vSz=gl_PointSize;',
  // Profondeur logarithmique, écrite dans la position.
  'float d=clamp((log2(w)-uDepth.x)*uDepth.y,0.,.999999);gl_Position.z=(2.*d-1.)*gl_Position.w;',
  // Couleur de la classe du point, lue dans la palette.
  'vec3 c=uPal[0];for(int i=1;i<10;i++){if(attr.x>float(i)-.5)c=uPal[i];}',
  // Luminosité du point, puis couleur de classe éclairée avec le gain.
  `float lum=attr.y/${LUM_NEUTRAL}.;vec3 col=c*lum*${POINT_GAIN.toFixed(2)};`,
  // En mode photo (début) : lit l'orthophoto à la verticale du point.
  'if(uDrape>.5){vec4 t=texture2D(uOrtho,vec2(dot(uUvA.xy,position.xy),dot(uUvA.zw,position.xy))+uUvB);',
  // Fusion : couleur de la photo, relief du laser (luminosité à 40 %), façades à moitié dans leur teinte de classe.
  // Couleur de la photo, modulée par le relief du laser et le gain.
  `vec3 photo=t.rgb*mix(1.,lum,${DRAPE_SHADE.toFixed(2)})*${DRAPE_GAIN.toFixed(2)};`,
  // Façades (classe 6) : mélange avec la teinte de classe.
  `if(attr.x>5.5&&attr.x<6.5)photo=mix(photo,col,${DRAPE_FACADE.toFixed(2)});`,
  // Mélange selon la transparence de la photo ; fin du mode photo.
  // Mode carte : la couleur de la photo telle quelle, comme la carte satellite dessous.
  'if(uDrape>1.5)photo=t.rgb;',
  'col=mix(col,photo,t.a);}',
  // Couleur finale, avec la teinte jour / nuit.
  'vCol=col*uTint;',
  // Fin de la fonction principale.
  '}',
// Fin du shader de sommet : les lignes sont jointes.
].join('\n');
// Shader de fragment des points (début).
const pointFragment = [
  // Couleur et taille reçues du shader de sommet.
  'varying vec3 vCol;varying float vSz;',
  // Fonction principale : sous 2 px, un carré suffit (pas de discard, le test de profondeur précoce reste actif) ;
  // au-dessus, écarte ce qui sort du disque. Puis écrit la couleur.
  'void main(){if(vSz>=2.){vec2 d=gl_PointCoord-.5;if(dot(d,d)>.25)discard;}gl_FragColor=vec4(vCol,1.);}',
// Fin du shader de fragment : les lignes sont jointes.
].join('\n');

// Passe 1 : profondeur remise au plus loin dans l'emprise (rien n'est dessiné).
// Shader de sommet de la passe 1 : la profondeur est poussée au plus loin.
const resetVertex = 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.9999995;}';
// Passe 3 : profondeur logarithmique normale du moteur (rien n'est dessiné non plus).
// Shader de sommet de la passe 3 : les inclusions de three.js,
const sealVertex = ['#include <common>', '#include <logdepthbuf_pars_vertex>',
  // la position à l'écran et la profondeur logarithmique du moteur.
  'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);', '#include <logdepthbuf_vertex>', '}'].join('\n');
// Shader de fragment de la passe 3 : la profondeur logarithmique, sans couleur.
const sealFragment = ['#include <logdepthbuf_pars_fragment>', 'void main(){', '#include <logdepthbuf_fragment>', 'gl_FragColor=vec4(0.);}'].join('\n');

// Déclare et exporte la classe LidarPoints (début).
export class LidarPoints {
  /** @param {{ earth: { group: THREE.Object3D, mesh: THREE.Mesh, def: { radius: number } }, power?: { handheld?: boolean } }} engine */
  // Constructeur : le moteur et la fonction qui complète une adresse (début).
  constructor(engine, { resolveUrl = (u) => u } = {}) {
    // Garde le moteur.
    this.engine = engine;
    // Garde la fonction d'adresse.
    this.resolveUrl = resolveUrl;
    // Réglages selon l'appareil.
    this.profile = engine.power?.handheld ? HANDHELD : DESKTOP;
    // Base de données des nuages, en mémoire : 1 Go sur ordinateur, 256 Mo sur téléphone.
    this.store = new LidarStore(engine.power?.handheld ? LIDAR_STORE_BYTES.handheld : LIDAR_STORE_BYTES.desktop);
    // Budget de points du moment, fixé par la hauteur de la caméra.
    this.budget = this.profile.budget;
    // Rayon de la Terre dans la scène, ou 1.
    this.radius = engine.earth.def.radius || 1;
    // Repère des points.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'lidar-points';
    // Masqué au départ.
    this.root.visible = false;
    // Parent : le groupe de la Terre, sinon le parent du maillage, sinon le maillage.
    this.parent = engine.earth.group || engine.earth.mesh.parent || engine.earth.mesh;
    // Y ajoute le repère.
    this.parent.add(this.root);
    // Affichage actif.
    this.enabled = true;
    // Carte en relief au départ.
    this.flat = false; // carte à plat (relief en volume coupé) : voir setGroundFlat
    // Soulèvement du sol dessiné (m), sur une carte à plat : 0 au départ.
    this.groundLiftM = 0;
    // Dalles, par identifiant.
    this.tiles = new Map();          // id → dalle
    // Chargements en cours : 0.
    this.active = 0;                 // chargements en cours
    // Points en mémoire : 0.
    this.loaded = 0;                 // points en mémoire
    // Numéro de la dernière sélection : 0.
    this.stamp = 0;                  // numéro de la dernière sélection (ancienneté des nœuds)
    // Instant de la dernière sélection.
    this.selectAt = 0;
    // Rien à recalculer.
    this.dirty = false;
    // Mode de couleur : carte.
    this.colorMode = 'carte';        // « carte » (couleur de la carte satellite), « photo » (drapage retouché) ou « classes »
    // Texture transparente d'un pixel.
    this.blank = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); // photo pas encore reçue : transparente
    // À envoyer à la carte graphique.
    this.blank.needsUpdate = true;
    // Avancement : aucun.
    this.progress = null;            // avancement de la dalle à l'écran ({ id, name, shown, wanted, ratio }), ou null
    // Variables uniformes partagées par tous les points (début).
    this.shared = {
      // Pixels par unité, bornes de taille et profondeur.
      uPx: { value: 1 }, uRange: { value: new THREE.Vector2(2, 48) }, uDepth: { value: new THREE.Vector2(0, 1) },
      // Palette des classes, en vecteurs.
      uPal: { value: LIDAR_PALETTE.map((c) => new THREE.Vector3(...c)) },
    // Fin des variables partagées.
    };
    // Matrice de travail.
    this.tmpM = new THREE.Matrix4();
    // Vecteur de travail.
    this.tmpV = new THREE.Vector3();
    // Vecteur de travail pour la verticale.
    this.tmpN = new THREE.Vector3();
    // Champ de vision de travail.
    this.frustum = new THREE.Frustum();
    // Boîte de travail.
    this.box = new THREE.Box3();
    // Recherche des dalles autour de la caméra : fonction (lon, lat) → promesse des manifestes, fournie par l'interface.
    this.discovery = null;
    // Recherche en cours, instant et lieu de la dernière.
    this.discovering = false; this.discoverAt = -Infinity; this.discoverLon = NaN; this.discoverLat = NaN; this.discoverBox = null;
    // Rappel à chaque nouvelle liste de dalles (lieux pour l'interface), ou null.
    this.onTiles = null;
    // Rayon du dôme à la dernière recherche (m).
    this.domeR = 0;
  // Fin du constructeur.
  }

  /**
   * Ajoute les dalles du dôme (GET /lidar?bbox → items) sans retirer celles déjà en place. Une dalle reçue mais hors du
   * cercle (coins de l'emprise carrée demandée) est ignorée ; au-delà de MAX_TILES, les plus éloignées sortent.
   */
  // addTiles : ajoute les dalles reçues (début).
  addTiles(manifests = []) {
    // Distance (m) du centre d'une dalle au centre du dôme.
    const away = (m) => lonLatDistanceM(m.anchor.lon, m.anchor.lat, this.discoverLon, this.discoverLat);
    // Pour chaque fiche reçue (début).
    for (const m of manifests) {
      // Fiche incomplète, ou dalle déjà en place : ignorée.
      if (!m?.id || !m.bounds || !m.anchor || !Array.isArray(m.nodes) || !m.nodeUrl || this.tiles.has(m.id)) continue;
      // Demi-diagonale de la dalle (m) : un coin peut toucher le cercle même si son centre est dehors.
      const reach = ((m.bounds.maxX - m.bounds.minX) * Math.SQRT2) / 2;
      // Hors du dôme : ignorée.
      if (Number.isFinite(this.discoverLat) && !inDome(Math.max(0, away(m) - reach), this.domeR)) continue;
      // Crée la dalle et la range.
      this.tiles.set(m.id, this.createTile(m));
    // Fin de la boucle.
    }
    // Trop de dalles : les plus éloignées du centre du dôme sortent.
    if (this.tiles.size > MAX_TILES && Number.isFinite(this.discoverLat)) {
      // Dalles de la plus lointaine à la plus proche.
      const order = [...this.tiles.values()].sort((a, b) => away(b.manifest) - away(a.manifest));
      // Retire les plus lointaines.
      for (const t of order.slice(0, this.tiles.size - MAX_TILES)) this.deleteTile(t);
    // Fin de ce cas.
    }
    // Prévient l'interface.
    this.onTiles?.(this.places());
    // Sélection à refaire.
    this.dirty = true;
  // Fin de addTiles.
  }

  /** Supprime une dalle : ses points, ses téléchargements, sa photo, et la dalle elle-même. */
  // deleteTile : la dalle (début).
  deleteTile(tile) {
    // Libère tout ce qu'elle porte.
    this.removeTile(tile);
    // La retire de la liste.
    this.tiles.delete(tile.manifest.id);
  // Fin de deleteTile.
  }

  /** Supprime toutes les dalles (dôme éteint : LiDAR coupé, Terre masquée). */
  // clearTiles : (début).
  clearTiles() {
    // Rien à supprimer : rien à faire.
    if (!this.tiles.size) return;
    // Supprime chaque dalle.
    for (const tile of [...this.tiles.values()]) this.deleteTile(tile);
    // Plus de dôme connu : la prochaine recherche repart de zéro.
    this.discoverBox = null;
    // Prévient l'interface.
    this.onTiles?.(this.places());
  // Fin de clearTiles.
  }

  /**
   * Recherche des dalles LiDAR HD de l'IGN dans le dôme : l'emprise carrée qui contient le cercle centré sous la
   * caméra. Sous 3 km d'altitude, au plus toutes les 1,5 seconde et seulement quand un bord a bougé de 300 m. Les dalles
   * reçues s'ajoutent à celles en place ; leurs nœuds se chargent ensuite par densité.
   */
  // discover : la caméra, le repère et l'instant (début).
  discover(cam, frame, now) {
    // Pas de fonction de recherche, ou recherche en cours : rien.
    if (!this.discovery || this.discovering) return;
    // Caméra dans le repère de la Terre, ramenée à la sphère unité.
    const local = this.tmpN.copy(cam.position).applyMatrix4(this.tmpM.copy(frame.matrixWorld).invert()).divideScalar(this.radius);
    // Altitude de la caméra (m).
    const alt = (local.length() - 1) * EARTH_RADIUS_M;
    // Trop haut : pas de dôme, rien.
    if (!(alt > 0 && alt < DISCOVER_ALT_M)) return;
    // Trop tôt : rien.
    if (now - this.discoverAt < DISCOVER_EVERY_MS) return;
    // Point sous la caméra : le centre du dôme.
    const [lon, lat] = xyzToLonLat([local.x, local.y, local.z]);
    // Rayon du dôme, d'après l'altitude.
    const radius = domeRadius(alt);
    // Emprise carrée qui contient le cercle.
    const box = expandLonLatBox([lon, lat, lon, lat], radius);
    // Aucun bord n'a assez bougé : rien.
    if (boxShiftM(this.discoverBox, box) < DISCOVER_MOVE_M) return;
    // Recherche en cours, notée à cet instant, à ce centre, avec ce rayon et cette emprise.
    this.discovering = true; this.discoverAt = now; this.discoverLon = lon; this.discoverLat = lat; this.domeR = radius; this.discoverBox = box;
    // Demande les dalles du dôme, les ajoute ; un échec est ignoré (nouvel essai au prochain déplacement).
    Promise.resolve(this.discovery(lon, lat, box)).then((items) => this.addTiles(items)).catch(() => { this.discoverBox = null; }).finally(() => { this.discovering = false; });
  // Fin de discover.
  }

  /** Dalles de l'API (GET /lidar → items). Remplace les dalles en place. */
  // setTiles : remplace les dalles par celles de l'API (début).
  setTiles(manifests = []) {
    // Retire chaque dalle en place.
    for (const tile of this.tiles.values()) this.removeTile(tile);
    // Vide la liste.
    this.tiles.clear();
    // Pour chaque fiche reçue (début).
    for (const m of manifests) {
      // Fiche incomplète : ignorée.
      if (!m?.id || !m.bounds || !m.anchor || !Array.isArray(m.nodes) || !m.nodeUrl) continue;
      // Crée la dalle et la range.
      this.tiles.set(m.id, this.createTile(m));
    // Fin de la boucle.
    }
    // Sélection à refaire.
    this.dirty = true;
  // Fin de setTiles.
  }

  /** Affiche ou coupe les nuages de points (coupés : le dôme s'éteint et tous les nuages sont supprimés, voir update). */
  // setEnabled : affiche ou masque les points (début).
  setEnabled(on) {
    // Garde le choix, en booléen.
    this.enabled = Boolean(on);
    // Coupé : le repère est masqué.
    if (!this.enabled) this.root.visible = false;
    // Sélection à refaire.
    this.dirty = true;
  // Fin de setEnabled.
  }

  /** Couleur des points : « carte » (couleur de la carte satellite, par défaut), « photo » (photo retouchée par le relief) ou « classes » (type de point). */
  // setColorMode : choisit le mode de couleur (début).
  setColorMode(mode) {
    // « classes » ou « photo » si demandé, sinon « carte ».
    this.colorMode = mode === 'classes' || mode === 'photo' ? mode : 'carte';
    // Règle l'interrupteur du drapage de chaque dalle.
    for (const tile of this.tiles.values()) tile.uDrape.value = this.drapeValue(tile.plan);
  // Fin de setColorMode.
  }

  /** Valeur de l'interrupteur du drapage : 0 sans photo (classes, ou dalle sans plan), 1 en mode photo, 2 en mode carte. */
  drapeValue(plan) {
    // Pas de plan ou mode « classes » : pas de photo.
    if (!plan || this.colorMode === 'classes') return 0;
    // Mode « photo » : 1 ; mode « carte » : 2.
    return this.colorMode === 'photo' ? 1 : 2;
  }

  /** Lieux des dalles, pour s'y rendre : [{ id, name, lat, lon, points }]. */
  // places : les lieux des dalles (début).
  places() {
    // Pour chaque dalle : identifiant, nom, latitude, longitude et nombre de points.
    return [...this.tiles.values()].map(({ manifest: m }) => ({ id: m.id, name: m.name, lat: m.anchor.lat, lon: m.anchor.lon, points: m.points }));
  // Fin de places.
  }

  /**
   * Pose la dalle sur le globe. Carte en relief : à sa vraie altitude. Carte à plat (relief en volume coupé) : le
   * sol du nuage (médiane des points « sol » de la racine, connue une fois la racine chargée) est posé sur la carte,
   * pour que les rues mesurées au laser tombent sur celles de la photo quelle que soit l'inclinaison de la vue.
   */
  // placeTile : pose la dalle sur le globe (début).
  placeTile(tile) {
    // Repère local de la dalle (sol posé sur la carte à plat, sinon vraie altitude) et rayon.
    // Carte à plat : sol du nuage posé sur le sol dessiné (soulevé de `groundLiftM` selon le niveau des tuiles affiché).
    const f = tileFrame(tile.manifest, this.flat ? this.groundLiftM - (tile.groundM ?? 0) : tile.manifest.anchor.alt), R = this.radius;
    // Écrit la matrice du groupe (début) :
    tile.group.matrix.set(
      // première ligne : les composantes x des trois axes et de l'origine ;
      f.ex[0] * R, f.ey[0] * R, f.ez[0] * R, f.origin[0] * R,
      // deuxième ligne : les composantes y ;
      f.ex[1] * R, f.ey[1] * R, f.ez[1] * R, f.origin[1] * R,
      // troisième ligne : les composantes z ;
      f.ex[2] * R, f.ey[2] * R, f.ez[2] * R, f.origin[2] * R,
      // dernière ligne : 0, 0, 0, 1.
      0, 0, 0, 1,
    // Fin de la matrice.
    );
    // Matrice dans la scène à recalculer.
    tile.group.matrixWorldNeedsUpdate = true;
  // Fin de placeTile.
  }

  /** Carte à plat (vrai) ou en relief (faux) : les dalles sont reposées en conséquence. */
  // setGroundFlat : carte à plat ou en relief (début).
  setGroundFlat(flat, groundLiftM = this.groundLiftM) {
    // Même état et soulèvement presque identique (à 25 cm près) : rien à faire.
    if (this.flat === Boolean(flat) && Math.abs(groundLiftM - this.groundLiftM) <= 0.25) return;
    // Garde l'état.
    this.flat = Boolean(flat);
    // Garde le soulèvement du sol dessiné.
    this.groundLiftM = groundLiftM;
    // Repose chaque dalle.
    for (const tile of this.tiles.values()) this.placeTile(tile);
  // Fin de setGroundFlat.
  }

  // createTile : crée une dalle à partir de sa fiche (début).
  createTile(manifest) {
    // Groupe de la dalle.
    const group = new THREE.Group();
    // Son nom.
    group.name = `lidar-points:${manifest.id}`;
    // Matrice fixée à la main.
    group.matrixAutoUpdate = false;
    // Masqué au départ.
    group.visible = false;
    // L'ajoute au repère des points.
    this.root.add(group);

    // Côté de la dalle, en mètres.
    const side = manifest.bounds.maxX - manifest.bounds.minX;
    // Hauteur de la dalle, en mètres.
    const height = manifest.bounds.maxZ - manifest.bounds.minZ;
    // Boîte de l'emprise (repère local : mètres depuis le centre, Z depuis le bas), avec une marge.
    // Boîte de l'emprise : 20 m de marge en côté, 14 m en hauteur.
    const boxGeo = new THREE.BoxGeometry(side + 20, side + 20, height + 14);
    // Décalée pour dépasser de 10 m sous le bas de la dalle.
    boxGeo.translate(0, 0, (height + 14) / 2 - 10);
    // Maillage de la passe 1 (début).
    const reset = new THREE.Mesh(boxGeo, new THREE.ShaderMaterial({
      // Ses shaders.
      vertexShader: resetVertex, fragmentShader: 'void main(){gl_FragColor=vec4(0.);}',
      // Aucune couleur écrite, profondeur toujours écrite, deux faces.
      colorWrite: false, depthFunc: THREE.AlwaysDepth, side: THREE.DoubleSide,
    // Fin de la passe 1.
    }));
    // Maillage de la passe 3 (début).
    const seal = new THREE.Mesh(boxGeo, new THREE.ShaderMaterial({
      // Ses shaders, avec l'écriture de la profondeur par fragment.
      vertexShader: sealVertex, fragmentShader: sealFragment, extensions: { fragDepth: true },
      // Aucune couleur écrite, profondeur toujours écrite, deux faces.
      colorWrite: false, depthFunc: THREE.AlwaysDepth, side: THREE.DoubleSide,
    // Fin de la passe 3.
    }));
    // La passe 1 se dessine au rang 5.
    reset.renderOrder = 5;
    // La passe 3 au rang 7.
    seal.renderOrder = 7;
    // La passe 1 n'est jamais écartée par le champ de vision.
    reset.frustumCulled = false;
    // La passe 3 non plus.
    seal.frustumCulled = false;
    // Ajoute les deux maillages au groupe.
    group.add(reset, seal);

    // Arbre des nœuds de la dalle.
    const tree = buildTree(manifest);
    // Drapage : plan des tuiles de l'orthophoto qui couvrent la dalle (photo chargée au premier affichage).
    // Modèle d'adresse de l'orthophoto.
    const template = manifest.imagery?.template;
    // Taille maximale de l'atlas : celle du profil, sans dépasser celle de la carte graphique (2 048 par défaut).
    const maxSize = Math.min(this.profile.drapeSize, this.engine.renderer?.capabilities?.maxTextureSize ?? 2048);
    // Plan du drapage, s'il y a une orthophoto ; sinon aucun.
    const plan = template ? drapePlan(manifest, Math.min(this.profile.drapeZoom, manifest.imagery.maxZoom ?? 19), maxSize) : null;
    // Prépare l'état de chaque nœud : sans points, sans chargement, sans échec, jamais utilisé.
    for (const node of tree.values()) Object.assign(node, { points: null, loading: false, abort: null, failedAt: 0, usedAt: 0 });
    // La dalle (début).
    const tile = {
      // Sa fiche, son groupe, son arbre, ses dimensions, sa boîte et ses deux passes.
      manifest, group, tree, side, height, boxGeo, reset, seal,
      // Sa teinte jour / nuit.
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      // Son plan de drapage, sa photo (transparente au départ) et l'interrupteur du drapage.
      plan, drape: null, uOrtho: { value: this.blank }, uDrape: { value: this.drapeValue(plan) },
      // Ses matrices, la position de la caméra, la file d'attente et l'avancement.
      world: new THREE.Matrix4(), inverse: new THREE.Matrix4(), eye: [0, 0, 0], queue: [], progress: null,
      // Nœuds en cours de téléchargement.
      loading: new Set(), // nœuds en cours de téléchargement
      // Hauteur du sol : pas encore connue.
      groundM: null, // hauteur du sol au-dessus du bas de la dalle (m), connue une fois la racine chargée
    // Fin de la dalle.
    };
    // La pose sur le globe.
    this.placeTile(tile);
    // La renvoie.
    return tile;
  // Fin de createTile.
  }

  // removeTile : retire une dalle (début).
  removeTile(tile) {
    // Vide sa file d'attente.
    tile.queue = [];
    // Abandonne ses téléchargements.
    this.cancelStale(tile);
    // Libère chacun de ses nœuds.
    for (const node of tile.tree.values()) this.dropNode(tile, node);
    // Libère sa photo.
    tile.drape?.dispose();
    // Libère sa boîte.
    tile.boxGeo.dispose();
    // Libère le matériau de la passe 1.
    tile.reset.material.dispose();
    // Libère celui de la passe 3.
    tile.seal.material.dispose();
    // Retire son groupe du repère.
    this.root.remove(tile.group);
  // Fin de removeTile.
  }

  // dropNode : libère les points d'un nœud (début).
  dropNode(tile, node) {
    // Sans points : rien à faire.
    if (!node.points) return;
    // Les retire du groupe.
    tile.group.remove(node.points);
    // Libère la géométrie.
    node.points.geometry.dispose();
    // Libère le matériau.
    node.points.material.dispose();
    // Plus de points.
    node.points = null;
    // Décompte les points en mémoire (ceux gardés après réduction).
    this.loaded -= node.kept ?? node.n;
  // Fin de dropNode.
  }

  /** Fichier d'un nœud → objet de points, masqué jusqu'à la prochaine sélection. */
  // addNode : transforme le fichier d'un nœud en points (début).
  addNode(tile, node, buffer) {
    // Décode les positions et les attributs : le nombre de points est celui du fichier (8 octets par point), le
    // serveur ayant écarté le bruit et les points virtuels du nombre annoncé par la hiérarchie COPC.
    const decoded = decodeNode(buffer, Math.floor((buffer.byteLength ?? buffer.length) / 8));
    // Pas de quantification et demi-côté de la dalle.
    const step = tile.manifest.step, half = tile.side / 2;
    // Racine : elle couvre toute la dalle et donne la hauteur du sol, qui sert à poser la dalle sur une carte à plat.
    // Pour la racine, si le sol n'est pas encore connu (début).
    if ((node.key ?? node.k) === ROOT_KEY && tile.groundM === null) {
      // Calcule la hauteur du sol.
      // (calculée sur tous les points reçus, avant la réduction, pour rester précise).
      tile.groundM = groundLevel(decoded.position, decoded.attr, step);
      // Sur une carte à plat : repose la dalle.
      if (tile.groundM !== null && this.flat) this.placeTile(tile);
    // Fin de ce cas.
    }
    // Réduction automatique ×4 : un point gardé sur quatre, quatre fois moins à dessiner et à garder en mémoire.
    const { position, attr, n: kept } = downscalePoints(decoded.position, decoded.attr);
    // Géométrie.
    const geo = new THREE.BufferGeometry();
    // Attribut des positions.
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    // Attribut de la classe et de la luminosité.
    geo.setAttribute('attr', new THREE.BufferAttribute(attr, 2));
    // Volume du nœud en pas de quantification : X, Y dans son cube, Z sur la hauteur de la dalle.
    // Côté et hauteur du volume du nœud, en pas de quantification.
    const s = node.size / step, h = (tile.height + 1) / step;
    // Sphère englobante du nœud.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(s / 2, s / 2, h / 2), Math.hypot(s, s, h) / 2);
    // Origine du nœud depuis le centre de la dalle.
    const origin = [node.min[0] - half, node.min[1] - half];
    // Calage du drapage pour ce nœud, ou nul sans plan.
    const uv = tile.plan ? nodeDrape(tile.plan, origin, step) : { a: [0, 0, 0, 0], b: [0, 0] };
    // Matériau (début).
    const material = new THREE.ShaderMaterial({
      // Shaders des points.
      vertexShader: pointVertex, fragmentShader: pointFragment,
      // Variables uniformes (début).
      uniforms: {
        // La taille, puis les valeurs partagées et la teinte de la dalle.
        uSize: { value: 0 }, uPx: this.shared.uPx, uRange: this.shared.uRange, uDepth: this.shared.uDepth, uPal: this.shared.uPal, uTint: tile.uTint,
        // La photo, l'interrupteur et le calage du drapage.
        uOrtho: tile.uOrtho, uDrape: tile.uDrape, uUvA: { value: new THREE.Vector4(...uv.a) }, uUvB: { value: new THREE.Vector2(...uv.b) },
      // Fin des variables uniformes.
      },
    // Fin du matériau.
    });
    // Objet de points.
    const points = new THREE.Points(geo, material);
    // Placé à l'origine du nœud.
    points.position.set(origin[0], origin[1], 0);
    // À l'échelle du pas de quantification.
    points.scale.setScalar(step);
    // Dessiné au rang 6, entre les deux passes.
    points.renderOrder = 6;
    // Masqué jusqu'à la prochaine sélection.
    points.visible = false;
    // L'ajoute au groupe de la dalle.
    tile.group.add(points);
    // Le garde sur le nœud.
    node.points = points;
    // Note le nombre de points gardés sur le nœud.
    node.kept = kept;
    // Compte les points en mémoire.
    this.loaded += kept;
  // Fin de addNode.
  }

  // load : télécharge le fichier d'un nœud (début).
  load(tile, node) {
    // Contrôleur d'annulation.
    const abort = new AbortController();
    // Nœud en chargement.
    node.loading = true;
    // Garde le contrôleur.
    node.abort = abort;
    // Note le nœud dans la dalle.
    tile.loading.add(node);
    // Un chargement de plus.
    this.active++;
    // Adresse du fichier : c'est aussi sa clé dans la base de données.
    const url = this.resolveUrl(nodeUrl(tile.manifest, node));
    // Déjà dans la base : relu sans réseau.
    const stored = this.store.get(url);
    // Sinon téléchargé sans cache du navigateur (rien n'est écrit sur l'appareil), puis écrit dans la base en même temps.
    (stored ? Promise.resolve(stored) : fetch(url, { signal: abort.signal, cache: 'no-store' })
      // Puis : erreur si la réponse est mauvaise, sinon les octets, écrits dans la base.
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
      // Écrit le fichier dans la base de données (les plus anciens sortent si elle est pleine).
      .then((buffer) => { this.store.put(url, buffer); return buffer; }))
      // Puis : crée les points, si rien n'a été abandonné et si la dalle existe toujours.
      .then((buffer) => { if (!abort.signal.aborted && this.tiles.get(tile.manifest.id) === tile) this.addNode(tile, node, buffer); })
      // Réseau ou fichier illisible : nouvel essai plus tard. Abandon voulu (nœud sorti du champ) : pas de délai.
      // Échec non voulu : note l'instant.
      .catch(() => { if (!abort.signal.aborted) node.failedAt = performance.now(); })
      // Dans tous les cas (début).
      .finally(() => {
        // Plus en chargement.
        node.loading = false;
        // Plus de contrôleur.
        node.abort = null;
        // Retire le nœud de la liste.
        tile.loading.delete(node);
        // Un chargement de moins.
        this.active--;
        // Sélection à refaire.
        this.dirty = true;
        // Lance les suivants.
        this.pump();
      // Fin de ce bloc.
      });
  // Fin de load.
  }

  /** Abandonne les téléchargements en cours des nœuds qui ne sont plus demandés (`tile.queue`) : sortis du champ de la caméra. */
  // cancelStale : abandonne les téléchargements devenus inutiles (début).
  cancelStale(tile) {
    // Aucun en cours : rien à faire.
    if (!tile.loading.size) return;
    // Nœuds demandés.
    const wanted = new Set(tile.queue);
    // Abandonne chaque téléchargement dont le nœud n'est plus demandé.
    for (const node of tile.loading) if (!wanted.has(node.key)) node.abort?.abort();
  // Fin de cancelStale.
  }

  /**
   * Lance les chargements en attente, toutes dalles confondues et en même temps : la densité monte partout à la fois.
   * D'abord la racine de chaque dalle (le nuage entier, peu dense), puis le niveau suivant de chacune, etc. (densityOrder).
   */
  // pump : lance les chargements en attente (début).
  pump() {
    // Plus de place pour un chargement : rien à faire.
    if (this.active >= this.profile.parallel) return;
    // Instant présent.
    const now = performance.now();
    // Nœud à charger : connu, sans points, hors chargement et sans échec récent.
    const waiting = (n) => n && !n.points && !n.loading && !(n.failedAt && now - n.failedAt < RETRY_AFTER_MS);
    // Chargements candidats de toutes les dalles.
    const jobs = [];
    // Pour chaque dalle (début).
    for (const tile of this.tiles.values()) {
      // Retire de sa file les nœuds qui n'attendent plus (chargés, en cours ou en échec récent).
      tile.queue = tile.queue.filter((key) => waiting(tile.tree.get(key)));
      // Ajoute chacun de ses nœuds en attente, avec son niveau, la distance de la dalle et son rang dans la file.
      tile.queue.forEach((key, rank) => { const node = tile.tree.get(key); jobs.push({ tile, node, level: node.level, dist: tile.dist ?? Infinity, rank }); });
    // Fin des dalles.
    }
    // Trie par densité : niveau d'abord (toutes les dalles au même niveau), puis dalle la plus proche, puis rang.
    jobs.sort(densityOrder);
    // Pour chaque chargement, dans cet ordre (début).
    for (const job of jobs) {
      // Plus de place : arrêt.
      if (this.active >= this.profile.parallel) break;
      // Le charge.
      this.load(job.tile, job.node);
    // Fin de la boucle.
    }
  // Fin de pump.
  }

  /** Teste la boîte d'un nœud contre le champ de la caméra (déjà réglé sur la dalle), élargie de `margin` mètres. */
  // nodeInView : le nœud, le demi-côté, le haut de la dalle et la marge (début).
  nodeInView(node, half, top, margin = 0) {
    // Coin bas de la boîte du nœud, limité au haut de la dalle, élargi de la marge.
    this.box.min.set(node.min[0] - half - margin, node.min[1] - half - margin, Math.min(node.min[2], top));
    // Coin haut de la boîte du nœud, élargi de la marge.
    this.box.max.set(node.min[0] - half + node.size + margin, node.min[1] - half + node.size + margin, Math.min(node.min[2] + node.size, top));
    // Vrai si le nœud commence sous le haut de la dalle et touche le champ.
    return node.min[2] <= top && this.frustum.intersectsBox(this.box);
  // Fin de nodeInView.
  }

  /**
   * Applique à une dalle ce que le dôme retient (`keys`, niveau croissant) : tout autre nœud chargé est supprimé
   * aussitôt ; les nœuds retenus et chargés sont dessinés s'ils sont dans le champ de la caméra, les autres sont mis en
   * file. Taille des points : celle du niveau le plus fin chargé dans la dalle, pour que les surfaces restent pleines à
   * la densité atteinte. Renvoie l'avancement de la dalle si elle est affichée, sinon null.
   */
  // applyDome : la dalle, les clés retenues, la caméra et la longueur d'un mètre (début).
  applyDome(tile, keys, cam, unit) {
    // Clés retenues, en ensemble.
    const keep = new Set(keys);
    // Retenus et chargés : à dessiner ; retenus et pas chargés : à charger, dans l'ordre.
    const shown = keys.filter((k) => tile.tree.get(k)?.points), load = keys.filter((k) => !tile.tree.get(k)?.points);
    // Niveau le plus fin chargé : la densité atteinte dans la dalle.
    const cut = shown.reduce((m, k) => Math.max(m, tile.tree.get(k).level), 0);
    // Champ de la caméra, dans le repère de la dalle (pour le test des nœuds).
    this.frustum.setFromProjectionMatrix(this.tmpM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(tile.world));
    // Pour chaque nœud (début).
    for (const node of tile.tree.values()) {
      // Sans points : suivant.
      if (!node.points) continue;
      // Sorti du dôme (ou hors du budget) : supprimé aussitôt.
      if (!keep.has(node.key)) { this.dropNode(tile, node); continue; }
      // À dessiner : dalle affichée et nœud dans le champ de la caméra.
      const draw = tile.show && (node.key === ROOT_KEY || this.nodeInView(node, tile.half, tile.top));
      // Règle sa visibilité.
      node.points.visible = draw;
      // S'il est dessiné (début).
      if (draw) {
        // Note la sélection.
        node.usedAt = this.stamp;
        // Taille des points : espacement du niveau atteint (sans dépasser le plus fin sous ce nœud), agrandie de √4 = 2
        // pour compenser la réduction ×4 : les surfaces restent pleines.
        node.points.material.uniforms.uSize.value = levelSpacing(tile.manifest.spacing, Math.min(node.fine, cut)) * POINT_FILL * DOWNSCALE_FILL * unit;
      // Fin de ce cas.
      }
    // Fin de la boucle.
    }
    // Nouvelle file d'attente.
    tile.queue = load;
    // Abandonne les téléchargements devenus inutiles.
    this.cancelStale(tile);
    // Avancement de la dalle pour la jauge : identifiant, nom et compte des points.
    tile.progress = { id: tile.manifest.id, name: tile.manifest.name, ...loadProgress(tile.tree, shown, load) };
    // Libère de la mémoire si besoin.
    this.evict(tile);
    // Avancement publié si la dalle est affichée.
    return tile.show ? tile.progress : null;
  // Fin de applyDome.
  }

  /** Mémoire : au-delà du plafond, les nœuds les plus anciennement affichés sortent, les plus fins d'abord. */
  // evict : libère de la mémoire au-delà du plafond (début).
  evict(tile) {
    // Sous le plafond : rien à faire.
    if (this.loaded <= this.profile.keep) return;
    // Nœuds chargés, non affichés à la dernière sélection, hors racine,
    const idle = [...tile.tree.values()].filter((n) => n.points && n.usedAt < this.stamp && n.key !== ROOT_KEY)
      // triés du plus ancien au plus récent, puis du plus fin au plus grossier.
      .sort((a, b) => a.usedAt - b.usedAt || b.level - a.level);
    // Pour chacun (début).
    for (const node of idle) {
      // Repassé sous le plafond : arrêt.
      if (this.loaded <= this.profile.keep) break;
      // Le libère.
      this.dropNode(tile, node);
    // Fin de la boucle.
    }
  // Fin de evict.
  }

  /**
   * À chaque image : visibilité, teinte jour / nuit, taille des points, et (quelques fois par seconde) choix des
   * nœuds à dessiner et à charger d'après la caméra.
   */
  // update : à chaque image, avec la caméra, la hauteur de l'écran, le Soleil et l'état de la carte (début).
  update({ cam, H, dpr = 1, sunDir = null, shade = 1, hidden = false, now = performance.now(), flat = this.flat, groundLiftM = 0 }) {
    // Applique l'état à plat ou en relief, et le soulèvement du sol dessiné.
    this.setGroundFlat(flat, groundLiftM);
    // Recherche des dalles de l'IGN sous la caméra (même sans dalle en place), si l'affichage est permis.
    if (this.enabled && !hidden) {
      // Rotation propre de la Terre recopiée sur le repère, puis ses matrices à jour.
      if (this.parent !== this.engine.earth.mesh) this.root.rotation.y = this.engine.earth.mesh.rotation.y;
      // Matrice du repère.
      this.root.updateMatrix();
      // Et sa matrice dans la scène.
      this.root.updateWorldMatrix(true, false);
      // Recherche.
      this.discover(cam, this.root, now);
    // Fin de ce cas.
    }
    // LiDAR coupé ou Terre masquée : pas de dôme, tous les nuages sont supprimés.
    if (!this.enabled || hidden) this.clearTiles();
    // Actif si l'affichage est permis, non masqué et s'il y a des dalles.
    const on = this.enabled && !hidden && this.tiles.size > 0;
    // Inactif : masque le repère, efface l'avancement et s'arrête.
    if (!on) { if (this.root.visible) this.root.visible = false; this.progress = null; return; }
    // Rotation propre de la Terre recopiée sur le repère des points (le maillage peut être masqué, pas ce repère).
    // Le maillage de la Terre et le repère des points.
    const mesh = this.engine.earth.mesh, frame = this.root;
    // Recopie la rotation propre de la Terre, si le parent n'est pas le maillage.
    if (this.parent !== mesh) frame.rotation.y = mesh.rotation.y;
    // Met à jour la matrice du repère.
    frame.updateMatrix();
    // Et sa matrice dans la scène.
    frame.updateWorldMatrix(true, false);
    // Longueur d'un mètre, en unités de scène.
    const unit = (this.radius * this.tmpV.setFromMatrixScale(frame.matrixWorld).x) / EARTH_RADIUS_M; // 1 m en unités de scène
    // Pixels par unité à une distance de 1.
    const pxPerUnit = (H * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    // Le transmet aux shaders.
    this.shared.uPx.value = pxPerUnit;
    // Bornes de la taille d'un point.
    // Taille minimale agrandie de √4 = 2, comme la taille des points, pour compenser la réduction ×4.
    this.shared.uRange.value.set(this.profile.maxSpacingPx * dpr * POINT_FILL * DOWNSCALE_FILL, 64 * dpr);
    // Logarithme de la profondeur proche.
    const dn = Math.log2(DEPTH_NEAR_M * unit);
    // Transmet la profondeur proche et l'inverse de l'étendue.
    this.shared.uDepth.value.set(dn, 1 / (Math.log2(DEPTH_FAR_M * unit) - dn));
    // Hauteur de la caméra au-dessus de la Terre (m) : elle fixe le budget de points du dôme.
    const camAlt = (this.tmpN.copy(cam.position).applyMatrix4(this.tmpM.copy(frame.matrixWorld).invert()).divideScalar(this.radius).length() - 1) * EARTH_RADIUS_M;
    // Budget du moment, borné par celui de l'appareil.
    this.budget = budgetForHeight(camAlt, this.profile.budget);
    // Sélection à refaire si demandé, ou si le délai est écoulé.
    const select = this.dirty || now - this.selectAt >= SELECT_EVERY_MS;
    // Aucune dalle affichée et aucun avancement pour l'instant.
    let any = false, progress = null;
    // Nœuds voulus par le dôme, toutes dalles confondues (le budget est appliqué après la boucle), et dalles concernées.
    const wanted = [], domed = [];
    // Nouvelle sélection : un seul numéro pour toutes les dalles.
    if (select) this.stamp++;
    // Dalles sorties du dôme à cette image : supprimées après la boucle.
    const gone = [];

    // Pour chaque dalle (début).
    for (const tile of this.tiles.values()) {
      // Matrice de la dalle dans la scène.
      tile.world.multiplyMatrices(frame.matrixWorld, tile.group.matrix);
      // Son inverse.
      tile.inverse.copy(tile.world).invert();
      // Position de la caméra dans le repère de la dalle.
      const e = this.tmpV.copy(cam.position).applyMatrix4(tile.inverse); // caméra, en mètres depuis le centre de la dalle
      // Demi-côté.
      const half = tile.side / 2;
      // Écarts de la caméra à la boîte de la dalle, sur les trois axes.
      const dx = Math.max(Math.abs(e.x) - half, 0), dy = Math.max(Math.abs(e.y) - half, 0), dz = Math.max(e.z - tile.height, 0, -e.z);
      // Distance à la dalle.
      const dist = Math.hypot(dx, dy, dz);
      // Gardée sur la dalle : sert à l'ordre des chargements (à niveau égal, la plus proche d'abord).
      tile.dist = dist;
      // Champ de la caméra, dans le repère de la dalle : sert à la dalle entière, puis à chacun de ses nœuds.
      // Champ de vision dans le repère de la dalle.
      this.frustum.setFromProjectionMatrix(this.tmpM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).multiply(tile.world));
      // Haut de la dalle, avec 1 m de marge.
      const top = tile.height + 1;
      // Coin bas de la boîte de la dalle.
      this.box.min.set(-half, -half, 0);
      // Coin haut de la boîte de la dalle.
      this.box.max.set(half, half, top);
      // Dans la caméra : du bon côté de l'horizon (caméra au-dessus du plan de la dalle) et boîte visible.
      const inCam = e.z > 0 && this.frustum.intersectsBox(this.box);
      // Rayon du dôme, d'après la hauteur de la caméra au-dessus de la dalle.
      const radius = domeRadius(e.z);
      // Sortie du dôme (caméra au-dessus de 3 km, ou dalle hors du cercle centré sous elle) : supprimée aussitôt (après la boucle).
      if (!(e.z > 0 && e.z < DISCOVER_ALT_M && inDome(Math.hypot(dx, dy), radius))) { gone.push(tile); continue; }
      // Dessinée à bout portant seulement : la hauteur de la caméra au-dessus du plan de la dalle est `e.z`, la
      // grandeur même que la distance du zoom affichée par le HUD. Au-dessus de 0,75 km, le nuage reste masqué.
      // Affichée : dans la caméra et sous la hauteur d'affichage.
      const show = showCloud(e.z, inCam);
      // Règle la visibilité du groupe.
      tile.group.visible = show;
      // Gardés pour la seconde passe : affichage, demi-côté et haut de la dalle.
      tile.show = show; tile.half = half; tile.top = top;
      // Si la dalle est affichée (début).
      if (show) {
        // Au moins une dalle affichée.
        any = true;
        // Avancement : le premier trouvé.
        progress = progress || tile.progress;
        // Dalle à l'écran en mode photo : l'orthophoto qui la couvre est chargée (une fois) et drapée sur les points.
        // Si la dalle a un plan, pas encore de photo, et que le mode est « photo » (début).
        if (tile.plan && !tile.drape && this.colorMode !== 'classes') {
          // Charge l'orthophoto.
          tile.drape = new LidarDrape(tile.plan, tile.manifest.imagery.template);
          // Branche sa texture.
          tile.uOrtho.value = tile.drape.texture;
        // Fin de ce cas.
        }
        // Teinte jour / nuit : la même que les tuiles, d'après la verticale de la dalle et le Soleil (repère caméra).
        // Si la direction du Soleil est connue (début).
        if (sunDir) {
          // Verticale de la dalle, dans le repère de la caméra.
          const n = this.tmpN.setFromMatrixColumn(tile.world, 2).normalize().transformDirection(cam.matrixWorldInverse);
          // Teinte selon l'élévation du Soleil et la force de l'éclairage.
          const t = dayTint(n.dot(sunDir), shade);
          // La transmet.
          tile.uTint.value.set(t[0], t[1], t[2]);
        // Fin de ce cas.
        }
      // Fin de ce cas.
      }
      // Pas de sélection à cette image : dalle suivante.
      if (!select) continue;

      // Position de la caméra depuis le coin de la dalle.
      tile.eye = [e.x + half, e.y + half, e.z];
      // Nœud déjà chargé ?
      const ready = (key) => Boolean(tile.tree.get(key)?.points);
      // Nœuds de la dalle dans le dôme, niveau par niveau, sans budget (il est appliqué à tout le dôme ensuite).
      const cand = selectNodes(tile.tree, {
        // La caméra, l'échelle à l'écran, l'écart des points et l'écart toléré (sans effet dans le dôme), sans budget.
        eye: tile.eye, pxPerUnit, spacing: tile.manifest.spacing, maxSpacingPx: this.profile.maxSpacingPx * dpr, budget: Infinity,
        // Dôme : cercle net centré sous la caméra, rayon selon sa hauteur (densité uniforme dedans, rien dehors).
        dome: { center: tile.eye, radius },
      // Dernier argument : dit si un nœud a déjà ses points.
      }, ready);
      // Ajoute chacun aux nœuds voulus : dalle, clé, niveau, nombre de points et distance au centre du dôme.
      for (const key of [...cand.show, ...cand.load]) { const node = tile.tree.get(key); wanted.push({ tile, key, level: node.level, n: node.n, dist: boxDistance2D(tile.eye, node.min, node.size) }); }
      // La dalle est concernée par la seconde passe.
      domed.push(tile);
    // Fin des dalles.
    }
    // Seconde passe, à une sélection : le budget est réparti sur tout le dôme, puis appliqué à chaque dalle.
    if (select) {
      // Nœuds retenus, toutes dalles confondues : niveau par niveau, du centre vers le bord, dans le budget.
      const picked = domeBudget(wanted, this.budget);
      // Clés retenues par dalle, dans l'ordre (niveau croissant).
      const byTile = new Map(domed.map((t) => [t, []]));
      // Range chaque nœud retenu avec sa dalle.
      for (const w of picked) byTile.get(w.tile).push(w.key);
      // Pour chaque dalle du dôme : applique la sélection.
      for (const [tile, keys] of byTile) progress = this.applyDome(tile, keys, cam, unit) ?? progress;
    // Fin de ce cas.
    }
    // Supprime aussitôt les dalles sorties du dôme : points, téléchargements, photo et dalle.
    for (const tile of gone) this.deleteTile(tile);
    // S'il y en a : prévient l'interface.
    if (gone.length) this.onTiles?.(this.places());
    // Si une sélection a eu lieu (début).
    if (select) {
      // Note l'instant.
      this.selectAt = now;
      // Plus rien à recalculer.
      this.dirty = false;
      // Lance les chargements.
      this.pump();
    // Fin de ce cas.
    }
    // Le repère est visible s'il y a une dalle affichée.
    this.root.visible = any;
    // Avancement publié, ou aucun.
    this.progress = any ? progress : null;
  // Fin de update.
  }

  /** État pour l'interface : { tiles, points chargés, chargements en cours, avancement de la dalle à l'écran ou null }. */
  // snapshot : l'état pour l'interface (début).
  snapshot() {
    // Nombre de dalles, points en mémoire, chargements en cours et avancement.
    return { tiles: this.tiles.size, loaded: this.loaded, loading: this.active, progress: this.progress, budget: this.budget, store: this.store.snapshot() };
  // Fin de snapshot.
  }

  // dispose : libère tout (début).
  dispose() {
    // Retire chaque dalle.
    for (const tile of this.tiles.values()) this.removeTile(tile);
    // Vide la liste.
    this.tiles.clear();
    // Retire le repère du parent.
    this.parent.remove(this.root);
  // Fin de dispose.
  }
// Fin de la classe LidarPoints.
}
