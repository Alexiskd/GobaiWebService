import * as THREE from 'three';
import { AU_UNITS, D, heliocentric, toScene, lonLatToVec, moonGeocentric, moonToScene, MOON_EQUATOR_TILT_DEG } from './ephemeris';
import { atmosphereVertexShader, atmosphereFragmentShader } from './shaders';
import { layoutLabels } from './labelLayout';
import { bindInput } from './input';
import { TILT_MAX_ANGLE, approachAngle, approachTilt, tiltEngagement, tiltPose } from './cameraTilt';
import { TileManager, MIN_DISTANCE_WITH_TILES } from './tiles/tileManager';
import { xyzToLonLat } from './tiles/mercator';
import { buildBorderSegments, borderLift } from './bordersGeometry';
import { WorldLabels } from './worldLabels';
import { CityCard } from './cityCard';
import { CountryLabels } from './countryLabels';
import { eclipticOf, interpolateState } from './moonEphemeris';
import { moonState, orbiterMetrics } from './moonLive';
import { MOON_FEATURES, FEATURE_TYPES } from './moonFeatures';
import { bodyId } from './bodyPlaces';
import { MoonOrbiters } from './moonOrbiters';
import { createMoonSurfaceMaterial, loadMoonModel } from './moonModel';
import { ShadowCamLayer } from './shadowcam';

const TAU = 6.2832;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const MOON_MIN_ALTITUDE_KM = 0.5;  // altitude minimale au-dessus de la Lune quand ses tuiles sont affichées (détail ≈ 20 m)
const MARS_RADIUS_KM = 3389.5;
const MARS_MIN_ALTITUDE_KM = 3;    // altitude minimale au-dessus de Mars quand ses tuiles sont affichées (détail ≈ 232 m)
const MARS_TILT = 0.439;           // obliquité de l'axe de Mars (25,19°)
const VENUS_RADIUS_KM = 6051.8;
const VENUS_MIN_ALTITUDE_KM = 3;   // altitude minimale au-dessus de Vénus quand ses tuiles sont affichées
const MERCURY_RADIUS_KM = 2439.7;
const MERCURY_MIN_ALTITUDE_KM = 3; // altitude minimale au-dessus de Mercure quand ses tuiles sont affichées
const VIEW_DISTANCE = 1.3e6;     // distance de la vue globale
const MAX_DISTANCE = 6e7;
const KEY_ROTATE_SPEED = 1.1;    // rad/s : rotation caméra avec les flèches maintenues
const EARTH_TILT = 0.409;        // obliquité de l'axe terrestre (rad)
const LIGHT_MINUTES_PER_AU = 8.317;
const MOON_COLOR = 0x8f8d88;
const SIDEREAL_MONTH_DAYS = 27.321661;
const MOON_ORBIT_COLOR = 0x8fa3d0;
const MOON_ORBIT_MAX_DIST = 3e3;  // seuil inverse des orbites héliocentriques : au-delà, l'anneau n'est que quelques pixels
// Modèle 3D NASA affiché tant que la caméra est à plus de 2,2 rayons du centre de la Lune ; plus près, les tuiles.
const MOON_MODEL_SWITCH = 2.2;
const BORDERS_MIN_ALTITUDE = 2.5e-4; // ≈ 1,6 km : plus bas, les frontières 1:50m s'écartent trop de l'imagerie
// Mouvements lissés indépendants de la cadence (mêmes réglages qu'avant à 60 images/s, mais identiques à 30 ou 144).
const ZOOM_TAU_MS = 96;          // lissage du zoom : ≈ 16 % du chemin restant par image à 60 i/s
const FOCUS_RATE = 1.2;          // transition vers un astre : 0 → 1 en ≈ 0,83 s
const AUTO_ROTATE_SPEED = 0.072; // rad/s
// Résolution adaptative : si les images ralentissent, on rend moins de pixels (et on demande moins de tuiles).
const DPR_STEP = 0.25;
const DPR_MIN = 1;
const DPR_SLOW_MS = 24;          // moyenne au-dessus : on baisse la résolution
const DPR_FAST_MS = 18.5;        // moyenne en dessous pendant DPR_RAISE_AFTER_MS : on la remonte d'un cran
const DPR_RAISE_AFTER_MS = 4000;
const DPR_CHECK_MS = 1000;
const fmtAltitude = (radii, radiusKm) => {
  const m = Math.max(0, radii * radiusKm * 1000);
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
};     // teinte unie de la Lune tant que ses tuiles ne couvrent pas la vue

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const MOON_PHASES = [
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
];

/**
 * Moteur 3D du système solaire (three.js). Aucune dépendance à React :
 * le composant lui fournit un conteneur, les éléments d'étiquettes et un store HUD.
 * Aucun rendu procédural : la Terre et la Lune affichent les tuiles NASA ; les autres
 * astres, et la Terre et la Lune tant que leurs tuiles chargent, sont des sphères de couleur unie.
 *
 * @param {object} opts
 *  container       élément DOM qui reçoit le <canvas>
 *  data            { bodies, cities } tels que renvoyés par l'API NestJS
 *  labels          { sun, planets[], cities[] } éléments HTML positionnés par le moteur
 *  hud             store { set({ date, focusText, zoomText, tiles }) }
 *  tilesApi        client de l'API de tuiles ({ layer(id) }) ; sans lui, la Terre et la Lune restent des sphères unies
 *  onFocusChange   (index) => void
 *  onTilesChange   () => void, appelé quand l'état des tuiles change (fournisseur, erreur…)
 */
export class SolarEngine {
  constructor({ container, data, labels, hud, tilesApi, onFocusChange, onTilesChange }) {
    this.container = container;
    this.data = data;
    this.labels = labels;
    this.hud = hud;
    this.onFocusChange = onFocusChange || (() => {});
    this.tilesApi = tilesApi;
    this.onTilesChange = onTilesChange || (() => {});

    this.W = innerWidth;
    this.H = innerHeight;
    this.stopped = false;
    this.rafId = 0;

    // État de la caméra orbitale
    this.focus = 0;
    this.target = new THREE.Vector3();
    this.targetStart = new THREE.Vector3();
    this.focusT = 1;                 // progression de la transition vers l'astre ciblé
    this.az = 0.8;
    this.el = 0.8;
    this.dist = VIEW_DISTANCE;
    this.distGoal = VIEW_DISTANCE;
    this.drag = false;
    this.keyRotate = { left: false, right: false, up: false, down: false };
    this.autoRotate = true;
    this.tiltOn = true;              // vue 3/4 automatique à l'approche du sol
    this.tiltV = 0;
    this.tiltAim = new THREE.Vector3();
    this.tiltUp = new THREE.Vector3(0, 1, 0);
    // Cap de la boussole : rotation de la vue autour de la verticale locale (0 = nord de scène en haut).
    this.heading = 0;
    this.headingGoal = 0;
    this.compassN = new THREE.Vector3();
    this.compassAxis = new THREE.Vector3();
    this.compassNorth = new THREE.Vector3();
    this.compassRight = new THREE.Vector3();
    this.lockCity = null;            // ville suivie quand la Terre est ciblée
    this.lockMoon = null;            // lieu de la Lune survolé ({ lon, lat })
    this.lockMars = null;            // lieu de Mars survolé ({ lon, lat })
    this.lockMercury = null;         // lieu de Mercure survolé ({ lon, lat })
    this.lockVenus = null;           // lieu de Vénus survolé ({ lon, lat })
    this.moonInv = new THREE.Matrix4();
    this.lockN = new THREE.Vector3();

    // Temps simulé (temps réel pour l'instant : speed = 1)
    this.simMs = Date.now();
    this.speed = 1;
    this.lastNow = performance.now();
    this.hudAt = 0;

    this.initRenderer();
    this.initSky();
    this.initSun();
    this.initPlanets();
    this.initMoon();
    this.initTiles();
    this.initBorders();
    // Noms des pays posés à plat sur le globe (texture), visibles avant les villes.
    this.countryLabels = new CountryLabels({
      parent: this.container.parentNode || document.body,
      earthMesh: this.earth.mesh,
    });
    // Fiche monochrome au survol d'une ville (population, aire urbaine, heure locale, soleil…).
    this.cityCard = new CityCard({
      parent: this.container.parentNode || document.body,
      getSimMs: () => this.simMs,
      sunAltitude: (lon, lat) => this.sunAltitudeAt(lon, lat),
    });
    // Noms des villes du monde entier (GET /places/labels), à côté du canvas. Ils n'apparaissent qu'en zoomant.
    this.worldLabels = new WorldLabels({
      parent: this.container.parentNode || document.body,
      onPick: (c) => this.goTo(c),
      tiered: true,
      revealAltitude: 1.9,
      fadeAltitude: 0.45,
      tooltip: this.cityCard,
    });
    this.initMoonLive();
    this.initFocusTargets();
    this.initLabels();

    this.removeInput = bindInput(this);
    this.setFocus(0);
    this.frame = this.frame.bind(this);
    this.rafId = requestAnimationFrame(this.frame);
  }

  get canvas() { return this.renderer.domElement; }
  focusTarget() { return this.focusTargets[this.focus]; }

  // ---------------------------------------------------------------- construction

  initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    // Plafond : la densité de l'écran (≤ 2) ; la résolution adaptative (adaptResolution) descend jusqu'à 1 si besoin.
    this.dprMax = Math.min(devicePixelRatio || 1, 2);
    this.dpr = this.dprMax;
    this.dprFrameMs = 16.7;
    this.dprCheckAt = 0;
    this.dprFastSince = 0;
    this.dprBlockedAbove = Infinity; // cran qui a déjà fait ralentir : on n'y remonte pas tout de suite
    this.dprBlockUntil = 0;
    r.setPixelRatio(this.dpr);
    r.setSize(this.W, this.H);
    r.setClearColor(0x010206);
    this.container.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(45, this.W / this.H, 0.00001, 1e10);
  }

  initSky() {
    const n = 4000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * TAU, r = Math.sqrt(1 - u * u);
      pos[i * 3] = 5e8 * r * Math.cos(t);
      pos[i * 3 + 1] = 5e8 * u;
      pos[i * 3 + 2] = 5e8 * r * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.85,
    })));
  }

  initSun() {
    const { sun } = this.data.bodies;
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(sun.radius, 64, 48),
      new THREE.MeshBasicMaterial({ color: sun.color || '#ffb300' })
    );
    this.scene.add(this.sunMesh);

    const gc = document.createElement('canvas');
    gc.width = gc.height = 256;
    const gx = gc.getContext('2d');
    const gg = gx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gg.addColorStop(0, 'rgba(255,220,140,.95)');
    gg.addColorStop(0.25, 'rgba(255,160,50,.35)');
    gg.addColorStop(1, 'rgba(255,120,20,0)');
    gx.fillStyle = gg;
    gx.fillRect(0, 0, 256, 256);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.glow.scale.set(16, 16, 1);
    this.scene.add(this.glow);

    this.sunLight = new THREE.PointLight(0xffffff, 1.7, 0, 0);
    this.scene.add(this.sunLight);
    this.scene.add(new THREE.AmbientLight(0x303848, 1));
  }

  initPlanets() {
    // Direction du Soleil dans le repère caméra, partagée par les tuiles de la Terre et son atmosphère.
    this.sunDir = new THREE.Vector3(1, 0, 0);

    this.planets = this.data.bodies.planets.map((def) => {
      // Sphère de couleur unie (couleur fournie par l'API). Pour la Terre : fond visible tant que les tuiles chargent.
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius, def.earth ? 128 : 48, def.earth ? 96 : 32),
        new THREE.MeshLambertMaterial({ color: def.color || '#888888' })
      );
      const group = new THREE.Group();
      group.add(mesh);
      this.scene.add(group);

      if (def.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(def.radius * 1.25, def.radius * 2.3, 96),
          new THREE.MeshBasicMaterial({ color: 0xd8c79a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = Math.PI / 2 + 0.46;
        group.add(ring);
      }

      // Orbite : 181 points sur un tour complet d'anomalie moyenne.
      const pts = [];
      for (let k = 0; k <= 180; k++) pts.push(toScene(heliocentric(def.elements, 0.26, k * 2)));
      const orbit = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x5a6fa8, transparent: true, opacity: 0.45 })
      );
      this.scene.add(orbit);

      return { def, mesh, group, orbit, w: new THREE.Vector3(), ecl: [0, 0, 0] };
    });

    const earthIndex = this.planets.findIndex((p) => p.def.earth);
    this.earth = this.planets[earthIndex];
    this.earthFocus = earthIndex + 1; // le Soleil est à l'indice 0

    // Mars : globe tuilé (NASA Mars Trek), incliné de son obliquité réelle.
    const marsIndex = this.planets.findIndex((p) => p.def.mars);
    this.mars = marsIndex >= 0 ? this.planets[marsIndex] : null;
    this.marsFocus = marsIndex >= 0 ? marsIndex + 1 : -1;

    // Mercure : globe tuilé (NASA Mercury Trek, Lunaserv, USGS, QuickMap).
    const mercuryIndex = this.planets.findIndex((p) => p.def.mercury);
    this.mercury = mercuryIndex >= 0 ? this.planets[mercuryIndex] : null;
    this.mercuryFocus = mercuryIndex >= 0 ? mercuryIndex + 1 : -1;

    // Vénus : globe tuilé (NASA Venus Trek, mosaïques radar Magellan).
    const venusIndex = this.planets.findIndex((p) => bodyId(p.def) === 'venus');
    this.venus = venusIndex >= 0 ? this.planets[venusIndex] : null;
    this.venusFocus = venusIndex >= 0 ? venusIndex + 1 : -1;

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.13, 96, 72),
      new THREE.ShaderMaterial({
        uniforms: { sunV: { value: this.sunDir } },
        transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
      })
    );
    atmosphere.material.extensions = { fragDepth: true };
    this.earth.group.add(atmosphere);
  }

  initTiles() {
    const onChange = () => this.onTilesChange();
    this.tiles = new TileManager({
      engine: this, api: this.tilesApi, onChange,
      body: {
        name: 'earth', parent: this.earth.group, mesh: this.earth.mesh, radius: 1, sunDir: this.sunDir,
        // Le repère des tuiles suit la rotation propre de la Terre (le maillage), pas l'inclinaison portée par le groupe.
        syncRotation: (root) => { root.rotation.y = this.earth.mesh.rotation.y; },
      },
    });
    // Lune : le repère des tuiles est porté par le groupe de la Lune, déjà orienté (rotation synchrone, libration).
    this.moonTiles = new TileManager({
      engine: this, api: this.tilesApi, onChange,
      body: {
        name: 'moon', parent: this.moonGroup, mesh: this.moon, radius: this.data.bodies.moon.radius, sunDir: this.moonSunDir,
        airless: true, overlayMode: 'relief', // Lune « réelle » : voir setMoonComposite
        // Toute la Lune aux niveaux 0 à 3 (170 tuiles Kaguya, ≈ 60 Mo de GPU) chargée dès le départ et jamais évincée :
        // aucune zone vide où que l'on regarde. Les niveaux plus fins viennent du cache disque du serveur.
        pinnedMaxZoom: 3,
        // Méthode de globe numérique : préchargement prédictif (où sera la caméra dans 1,5 s, cône de 120°), cache RAM des
        // images décodées et cache persistant du navigateur (les tuiles ne sont plus redemandées d'une visite à l'autre).
        prefetch: true,
        persistentCache: 'moon-tiles-v1',
      },
    });
    // Sphère de fond (visible tant que les tuiles ne couvrent pas tout) : même éclairage et mêmes couleurs que les
    // tuiles et le modèle, au lieu d'un matériau Lambert bleuté par la lumière ambiante.
    this.moon.material.dispose();
    this.moon.material = createMoonSurfaceMaterial(this.moonTiles.uniforms);

    // Mars : même moteur de tuiles, directement depuis NASA Mars Trek (imagerie Viking MDIM21, CORS ouvert).
    // Le repère suit la rotation propre de la planète ; l'inclinaison axiale est portée par son groupe.
    if (this.mars) {
      this.marsSunDir = new THREE.Vector3(1, 0, 0);
      this.marsTiles = new TileManager({
        engine: this, api: this.tilesApi, onChange,
        body: {
          name: 'mars', parent: this.mars.group, mesh: this.mars.mesh, radius: this.mars.def.radius,
          sunDir: this.marsSunDir, airless: true,
          syncRotation: (root) => { root.rotation.y = this.mars.mesh.rotation.y; },
          pinnedMaxZoom: 2,
          persistentCache: 'mars-tiles-v1',
        },
      });
    }

    // Mercure : même moteur de tuiles, alimenté par le catalogue Space (Mercury Trek, Lunaserv, USGS, QuickMap).
    if (this.mercury) {
      this.mercurySunDir = new THREE.Vector3(1, 0, 0);
      this.mercuryTiles = new TileManager({
        engine: this, api: this.tilesApi, onChange,
        body: {
          name: 'mercury', parent: this.mercury.group, mesh: this.mercury.mesh, radius: this.mercury.def.radius,
          sunDir: this.mercurySunDir, airless: true,
          syncRotation: (root) => { root.rotation.y = this.mercury.mesh.rotation.y; },
          pinnedMaxZoom: 2,
          persistentCache: 'mercury-tiles-v1',
        },
      });
    }

    // Vénus : même moteur de tuiles, directement depuis NASA Venus Trek (mosaïques radar Magellan, CORS ouvert).
    if (this.venus) {
      this.venusSunDir = new THREE.Vector3(1, 0, 0);
      this.venusTiles = new TileManager({
        engine: this, api: this.tilesApi, onChange,
        body: {
          name: 'venus', parent: this.venus.group, mesh: this.venus.mesh, radius: this.venus.def.radius,
          sunDir: this.venusSunDir, airless: true,
          syncRotation: (root) => { root.rotation.y = this.venus.mesh.rotation.y; },
          pinnedMaxZoom: 2,
          persistentCache: 'venus-tiles-v1',
        },
      });
    }
  }

  // Frontières des pays et littoraux : repère dans le groupe de la Terre, qui suit sa rotation propre (comme les tuiles).
  // La géométrie arrive plus tard (setBorders) depuis GET /borders.
  initBorders() {
    this.bordersRoot = new THREE.Object3D();
    this.bordersRoot.name = 'borders';
    this.bordersRoot.visible = false;
    this.earth.group.add(this.bordersRoot);
    this.bordersOn = true;
    this.bordersWanted = false;
    this.coastsOn = true;
    this.borders = null;   // THREE.LineSegments des frontières terrestres
    this.coasts = null;    // THREE.LineSegments des littoraux
  }

  initMoon() {
    const { moon } = this.data.bodies;
    // Groupe = repère sélénographique (longitude 0 vers la Terre, Nord en +Y) ; il porte la sphère de fond et les tuiles.
    this.moonGroup = new THREE.Group();
    this.moonGroup.name = 'moon';
    this.scene.add(this.moonGroup);
    this.moonSunDir = new THREE.Vector3(1, 0, 0);
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(moon.radius, 96, 64),
      new THREE.MeshLambertMaterial({ color: MOON_COLOR })
    );
    this.moonGroup.add(this.moon);

    // Orbite géocentrique de la Lune : un mois sidéral de la théorie ELP, refermé sur lui-même.
    // Géométrie dans le repère écliptique de la scène ; la ligne suit ensuite la Terre à chaque image.
    const t0 = (this.simMs / 864e5 + 2440587.5 - 2451545) / 36525;
    const month = SIDEREAL_MONTH_DAYS / 36525;
    const orbitPts = [];
    for (let k = 0; k < 360; k++) orbitPts.push(moonToScene(moonGeocentric(t0 + (k / 360) * month)));
    orbitPts.push(orbitPts[0].clone());
    this.moonOrbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: MOON_ORBIT_COLOR, transparent: true, opacity: 0.5 })
    );
    this.scene.add(this.moonOrbit);
    this.moonW = new THREE.Vector3();
    this.moonRel = new THREE.Vector3();   // Terre → Lune
    this.moonGeo = null;                  // dernière position géocentrique calculée
    this.moonTable = null;                // table JPL Horizons (GET /ephemeris/moon), sinon théorie ELP
    this.moonSource = 'ELP';
    this.qTilt = new THREE.Quaternion();
    this.tmpSun = new THREE.Vector3();
    this.tmpEarth = new THREE.Vector3();
    this.qSpin = new THREE.Quaternion();
    this.nodeAxis = new THREE.Vector3();
  }

  // Lune en direct : lieux (alunissages, mers, cratères), sondes en orbite (JPL Horizons), modèle 3D NASA.
  initMoonLive() {
    const parent = this.container.parentNode || document.body;
    this.moonLabels = new WorldLabels({
      parent,
      className: 'l map-label moon-label',
      maxAltitude: 9,                                           // en rayons lunaires
      budget: (alt) => (alt > 3 ? 14 : alt > 1 ? 30 : alt > 0.2 ? 60 : 90),
      tiered: true,
      decorate: (el, f) => {
        el.textContent = f.native || f.name;
        el.dataset.script = f.script || 'latin';
        el.style.setProperty('--c', FEATURE_TYPES[f.type]?.color || '#fff');
        el.title = `${f.name}${f.native ? ` · ${f.native}` : ''}${f.info ? ` · ${f.info}` : ''} · cliquer pour survoler`;
      },
      onPick: (f) => this.goMoon(f),
    });
    this.moonFeatureTypes = new Set(Object.keys(FEATURE_TYPES));
    this.applyMoonFeatures();
    this.orbiters = new MoonOrbiters({ scene: this.scene, parentEl: parent, onPick: (id) => this.selectOrbiter(id) });
    this.orbiterData = null;
    this.selectedOrbiter = null;
    this.moonModel = null;
    this.moonModelWanted = true;
    this.moonQInv = new THREE.Quaternion();
    this.tmpV = new THREE.Vector3();
    // Pôles vus par Danuri : mosaïques ShadowCam des cratères en ombre permanente (au-dessus des tuiles).
    this.shadowcam = new ShadowCamLayer({ root: this.moonTiles.root, api: null, getGap: () => this.moonTiles.base?.layer.gap ?? 1e-6 });
  }

  // Astres sélectionnables, dans l'ordre des boutons : Soleil, planètes, Lune.
  initFocusTargets() {
    const { sun, moon } = this.data.bodies;
    const zero = new THREE.Vector3();
    this.focusTargets = [
      { name: sun.name, r: sun.radius, get: () => zero },
      ...this.planets.map((p) => ({ name: p.def.name, r: p.def.radius, body: p, get: () => p.w })),
      { name: moon.name, r: moon.radius, moon: true, get: () => this.moonW },
    ];
    this.moonFocus = this.focusTargets.length - 1;
  }

  initLabels() {
    const L = this.labels;
    const surfaceItem = (el, name, lon, lat) => ({
      el, name, lon, lat, lv: lonLatToVec([lon, lat]), ok: false, x: 0, y: 0, w: 0,
    });
    this.cityItems = this.data.cities.map((c, i) => surfaceItem(L.cities[i], c.name, c.lon, c.lat));
    this.bodyLabels = [
      { el: L.sun, name: this.data.bodies.sun.name, pos: this.sunMesh.position },
      ...this.planets.map((p, i) => ({ el: L.planets[i], name: p.def.name, pos: p.group.position })),
    ];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  // ------------------------------------------------------------------- commandes

  setFocus(i) {
    i = clamp(i, 0, this.focusTargets.length - 1);
    // Sélectionner un astre ne zoome pas : on garde la distance, on déplace seulement le centre de vue.
    this.lockCity = null;
    this.lockMoon = null;
    this.lockMars = null;
    this.lockMercury = null;
    if (i !== this.focus) {
      // Le cap de la boussole est propre à l'astre : on repart du nord de scène.
      this.heading = 0;
      this.headingGoal = 0;
    }
    this.focus = i;
    this.targetStart.copy(this.target);
    this.focusT = 0;
    this.distGoal = this.dist;
    this.hudAt = 0;
    this.onFocusChange(i);
  }

  // f < 1 rapproche la caméra, f > 1 l'éloigne ; appliqué à l'altitude visée au-dessus de l'astre (cumulable).
  // De loin c'est la même chose que la distance ; de près, le zoom reste progressif jusqu'au sol (Terre comme Lune).
  zoom(f) {
    const radius = this.focusTarget().r || 1;
    let minDistance = radius * (this.focus === 0 ? 1.03 : 1.08);
    if (this.focus === this.earthFocus && this.tiles.active) minDistance = MIN_DISTANCE_WITH_TILES;
    if (this.focus === this.moonFocus && this.moonTiles.active) minDistance = radius * (1 + MOON_MIN_ALTITUDE_KM / MOON_RADIUS_KM);
    if (this.focus === this.marsFocus && this.marsTiles?.active) minDistance = radius * (1 + MARS_MIN_ALTITUDE_KM / MARS_RADIUS_KM);
    if (this.focus === this.mercuryFocus && this.mercuryTiles?.active) minDistance = radius * (1 + MERCURY_MIN_ALTITUDE_KM / MERCURY_RADIUS_KM);
    if (this.focus === this.venusFocus && this.venusTiles?.active) minDistance = radius * (1 + VENUS_MIN_ALTITUDE_KM / VENUS_RADIUS_KM);
    const altitude = Math.max(this.distGoal, minDistance) - radius;
    this.distGoal = clamp(radius + altitude * f, minDistance, MAX_DISTANCE);
  }

  resetView() {
    this.setFocus(0);
    this.az = 0.8;
    this.el = 0.8;
    this.distGoal = VIEW_DISTANCE;
  }

  // ------------------------------------------------------------------ boussole

  /** Pôle nord géographique de l'astre ciblé, en coordonnées de scène (Terre, Lune et Mars sont inclinées). */
  northAxis(out = new THREE.Vector3()) {
    out.set(0, 1, 0);
    if (this.focus === this.earthFocus) out.applyQuaternion(this.earth.group.quaternion);
    else if (this.focus === this.moonFocus) out.applyQuaternion(this.moonGroup.quaternion);
    else if (this.mars && this.focus === this.marsFocus) out.applyQuaternion(this.mars.group.quaternion);
    else if (this.mercury && this.focus === this.mercuryFocus) out.applyQuaternion(this.mercury.group.quaternion);
    else if (this.venus && this.focus === this.venusFocus) out.applyQuaternion(this.venus.group.quaternion);
    return out;
  }

  /**
   * État de la boussole : angle du nord vrai à l'écran (0 = en haut, positif vers la droite) et cap à appliquer
   * pour le remettre en haut. `null` pour le Soleil et aux pôles géographiques, où le nord n'a pas de direction.
   */
  compassState() {
    if (this.focus === 0) return null;
    const sa = Math.sin(this.az), ca = Math.cos(this.az);
    const se = Math.sin(this.el), ce = Math.cos(this.el);
    const n = this.compassN.set(ce * sa, se, ce * ca);
    // Projection du pôle sur le plan tangent au point visé : direction du nord géographique local.
    const axis = this.northAxis(this.compassAxis);
    const north = this.compassNorth.copy(axis).addScaledVector(n, -axis.dot(n));
    const len = north.length();
    if (len < 1e-6) return null;
    north.divideScalar(len);

    // Droite de l'image = haut × normale (colinéaire à la tangente est) ; le haut inclut la verticale locale.
    const right = this.compassRight.copy(this.tiltUp).cross(n);
    const rl = right.length();
    if (rl < 1e-9) return null;
    right.divideScalar(rl);
    const angle = Math.atan2(north.dot(right), north.dot(this.tiltUp));

    // Cap (dans la base nord/est de la scène) qui amène ce nord en haut de l'image.
    const tX = -se * sa, tZ = -se * ca;
    const bearing = Math.atan2(north.x * ca - north.z * sa, north.x * tX + north.y * ce + north.z * tZ);
    return { angle, bearing };
  }

  /** Recale la caméra sur le nord géographique de l'astre ciblé. Renvoie false si le nord est indéfini. */
  recalibrateNorth() {
    const state = this.compassState();
    if (!state) return false;
    this.headingGoal = state.bearing;
    return true;
  }

  goCity(index) {
    this.setFocus(this.earthFocus);
    this.distGoal = this.tiles.active ? 1.0004 : 1.004; // ≈ 2,5 km d'altitude avec une carte
    this.lockCity = this.cityItems[index];
  }

  /** Va vers n'importe quel lieu de la Terre (ex. résultat de la recherche mondiale). */
  goTo({ name, lon, lat }) {
    this.setFocus(this.earthFocus);
    this.distGoal = this.tiles.active ? 1.0004 : 1.004;
    this.lockCity = { name, lon, lat, lv: lonLatToVec([lon, lat]) };
  }

  setAutoRotate(on) { this.autoRotate = on; }

  // ------------------------------------------------------------ Lune en direct

  /** Survole un lieu de la Lune (clic sur un nom) ; altitude par défaut ≈ 50 km. */
  goMoon({ lon, lat }, altitudeKm = 52) {
    this.setFocus(this.moonFocus);
    const r = this.data.bodies.moon.radius;
    this.distGoal = r * (this.moonTiles.active ? 1 + altitudeKm / MOON_RADIUS_KM : 1.15);
    this.lockMoon = { lon, lat, lv: lonLatToVec([lon, lat]) };
  }

  /** Survole un lieu de Mars (repères du catalogue) ; altitude par défaut ≈ 300 km. */
  goToMars({ lon, lat }, altitudeKm = 300) {
    if (!this.mars) return;
    this.setFocus(this.marsFocus);
    const r = this.mars.def.radius;
    this.distGoal = r * (this.marsTiles?.active ? 1 + altitudeKm / MARS_RADIUS_KM : 1.15);
    this.lockMars = { lon, lat, lv: lonLatToVec([lon, lat]) };
  }

  /** Survole un lieu de Mercure (repères du catalogue) ; altitude par défaut ≈ 200 km. */
  goToMercury({ lon, lat }, altitudeKm = 200) {
    if (!this.mercury) return;
    this.setFocus(this.mercuryFocus);
    const r = this.mercury.def.radius;
    this.distGoal = r * (this.mercuryTiles?.active ? 1 + altitudeKm / MERCURY_RADIUS_KM : 1.15);
    this.lockMercury = { lon, lat, lv: lonLatToVec([lon, lat]) };
  }

  /** Survole un lieu de Vénus (repères du catalogue) ; altitude par défaut ≈ 300 km. */
  goToVenus({ lon, lat }, altitudeKm = 300) {
    if (!this.venus) return;
    this.setFocus(this.venusFocus);
    const r = this.venus.def.radius;
    this.distGoal = r * (this.venusTiles?.active ? 1 + altitudeKm / VENUS_RADIUS_KM : 1.15);
    this.lockVenus = { lon, lat, lv: lonLatToVec([lon, lat]) };
  }

  /** Face visible (tournée vers la Terre) ou face cachée. */
  viewMoonSide(side = 'near') {
    if (this.focus !== this.moonFocus) this.setFocus(this.moonFocus);
    this.lockMoon = null;
    this.moonGroup.updateMatrixWorld(true);
    const n = lonLatToVec([side === 'far' ? 180 : 0, 0]).applyQuaternion(this.moonGroup.quaternion).normalize();
    this.el = Math.asin(clamp(n.y, -1, 1));
    this.az = Math.atan2(n.x, n.z);
    const r = this.data.bodies.moon.radius;
    if (this.distGoal < r * 2.5) this.distGoal = r * 3.2;
  }

  setMoonFeatureTypes(types) { this.moonFeatureTypes = new Set(types); this.applyMoonFeatures(); }
  applyMoonFeatures() {
    const items = MOON_FEATURES.filter((f) => this.moonFeatureTypes.has(f.type));
    this.moonLabels.setCities(items);
    if (!items.length) this.moonLabels.hideFrom(0);
  }

  /** Danuri / ShadowCam : catalogue (GET /danuri/shadowcam) et accès aux images. */
  setShadowCam(items, api) { this.shadowcam.api = api; this.shadowcam.setCatalog(items || []); this.hudAt = 0; }
  setShadowCamVisible(on) { this.shadowcam.setVisible(on); }

  /** Sondes en orbite : réponse de GET /ephemeris/moon/orbiters. */
  setMoonOrbiters(data) { this.orbiterData = data; this.orbiters.setData(data?.items || []); }
  setMoonOrbitersVisible(on) { this.orbiters.setVisible(on); }
  selectOrbiter(id) {
    this.selectedOrbiter = this.selectedOrbiter === id ? null : id;
    this.orbiters.select(this.selectedOrbiter);
    this.hudAt = 0;
  }

  /** Modèle 3D officiel de la Lune (NASA, GLB) pour la vue d'ensemble ; les tuiles prennent le relais en zoomant. */
  async loadMoonModel(url) {
    if (this.moonModel || this.moonModelLoading) return this.moonModelLoading;
    this.moonModelLoading = loadMoonModel(url, this.data.bodies.moon.radius, this.moonTiles.uniforms).then(({ object, info }) => {
      if (this.stopped) return info;
      this.moonModel = object;
      object.visible = false;
      this.moonGroup.add(object);
      return info;
    }).finally(() => { this.moonModelLoading = null; });
    return this.moonModelLoading;
  }
  setMoonModelVisible(on) { this.moonModelWanted = on; }

  /** Après la mise à jour des tuiles : modèle de loin, tuiles de près. */
  updateMoonModel() {
    const m = this.moonModel;
    if (!m) return;
    const r = this.data.bodies.moon.radius;
    // Les pôles du modèle sont pincés (défaut connu des modèles NASA SVS) : vue polaire → tuiles, toujours nettes.
    const rel = this.tmpV.copy(this.cam.position).sub(this.moonGroup.position);
    const dist = rel.length();
    const localUp = rel.applyQuaternion(this.moonQInv.copy(this.moonGroup.quaternion).invert()).y / (dist || 1);
    const far = this.moonModelWanted && dist > r * MOON_MODEL_SWITCH && Math.abs(localUp) < Math.sin(55 * D);
    m.visible = far;
    this.moonTiles.root.visible = !far;
    if (far) this.moon.visible = false;
  }

  /** Fond cartographique de la Terre (id de couche de l'API). */
  async setTileBase(layerId) {
    try {
      return await this.tiles.setBase(layerId);
    } finally {
      if (this.tiles.active === false && this.focus === this.earthFocus) this.zoom(1);
    }
  }
  setTileOverlay(layerId) { return this.tiles.setOverlay(layerId); }

  /** Fond de la Lune (id de couche `body: moon` de l'API). */
  async setMoonTileBase(layerId) {
    try {
      return await this.moonTiles.setBase(layerId);
    } finally {
      if (this.moonTiles.active === false && this.focus === this.moonFocus) this.zoom(1);
    }
  }
  /** Calque optionnel de la Lune (teinte d’un autre relief en mode composite), ou null. */
  setMoonTileOverlay(layerId) { return this.moonTiles.setOverlay(layerId); }
  /** Lune « réelle » : une seule texture (détail Kaguya, si `pan`) colorée par les couleurs naturelles. */
  setMoonComposite(on, opts) { this.moonTiles.setComposite(on, opts); }

  /** Fond de Mars (id de couche `body: mars` de l'API). */
  async setMarsTileBase(layerId) {
    if (!this.marsTiles) return null;
    try {
      return await this.marsTiles.setBase(layerId);
    } finally {
      if (this.marsTiles.active === false && this.focus === this.marsFocus) this.zoom(1);
    }
  }

  /** Fond de Mercure (id de couche `body: mercury` de l'API). */
  async setMercuryTileBase(layerId) {
    if (!this.mercuryTiles) return null;
    try {
      return await this.mercuryTiles.setBase(layerId);
    } finally {
      if (this.mercuryTiles.active === false && this.focus === this.mercuryFocus) this.zoom(1);
    }
  }

  /** Fond de Vénus (id de couche `body: venus` de l'API). */
  async setVenusTileBase(layerId) {
    if (!this.venusTiles) return null;
    try {
      return await this.venusTiles.setBase(layerId);
    } finally {
      if (this.venusTiles.active === false && this.focus === this.venusFocus) this.zoom(1);
    }
  }

  /** Couleurs naturelles de la Lune (NASA SVS CGI Moon Kit) : texture des tuiles et de la sphère de fond. */
  loadMoonColor(url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(url, (tex) => {
        if (this.stopped) { tex.dispose(); return; }
        tex.wrapS = THREE.RepeatWrapping; // continuité au méridien ±180°
        tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.moonTiles.setColorTexture(tex); // partagée par les tuiles, la sphère de fond et le modèle 3D
        resolve(tex);
      }, undefined, () => reject(new Error('texture des couleurs de la Lune introuvable')));
    });
  }
  setTileShade(on) { this.tiles.setShade(on); this.moonTiles.setShade(on); this.marsTiles?.setShade(on); this.mercuryTiles?.setShade(on); this.venusTiles?.setShade(on); }
  /** Vue 3/4 automatique : inclinaison progressive près du sol (true par défaut), ou regard vertical (false). */
  setTilt(on) { this.tiltOn = on; }

  /** Frontières et littoraux : polylignes [lon, lat, …] de GET /borders (remplacent les précédentes). */
  setBorders({ lines = [], coastlines = [] }) {
    const build = (old, polylines) => {
      if (old) {
        this.bordersRoot.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(buildBorderSegments(polylines), 3));
      const obj = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: 0xffe7a3, transparent: true, opacity: 0.85, depthWrite: false,
      }));
      obj.frustumCulled = false;
      this.bordersRoot.add(obj);
      return obj;
    };
    this.borders = build(this.borders, lines);
    this.coasts = build(this.coasts, coastlines);
    this.applyBorders();
  }
  setBordersVisible(on) { this.bordersOn = on; this.applyBorders(); }

  /** Noms des villes du monde : [{ name, lon, lat, pop, capital }] triés par population. */
  setCityLabels(cities) { this.worldLabels.setCities(cities); }
  setCityLabelsVisible(on) { this.worldLabels.setVisible(on); }
  setCountryLabelsVisible(on) { this.countryLabels.setVisible(on); }

  /** Table JPL Horizons de la Lune : [{ t (ms UTC), x, y, z (km, écliptique J2000) }]. */
  setMoonEphemeris(points) { this.moonTable = Array.isArray(points) && points.length >= 4 ? points : null; }

  setCoastsVisible(on) { this.coastsOn = on; this.applyBorders(); }
  applyBorders() {
    if (this.borders) this.borders.visible = this.bordersOn;
    if (this.coasts) this.coasts.visible = this.coastsOn;
    this.bordersWanted = Boolean(this.borders) && (this.bordersOn || this.coastsOn);
    this.bordersRoot.visible = this.bordersWanted;
  }

  resize() {
    this.W = innerWidth;
    this.H = innerHeight;
    this.renderer.setSize(this.W, this.H);
    this.cam.aspect = this.W / this.H;
    this.cam.updateProjectionMatrix();
  }

  // Sélection d'un astre au clic : d'abord par rayon, puis par proximité de l'écran
  // (à l'échelle réelle, les planètes font souvent moins d'un pixel).
  selectAt(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    this.cam.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.cam);

    const pickables = [this.sunMesh, ...this.planets.map((p) => p.mesh), this.moon];
    const hits = this.raycaster.intersectObjects(pickables, true);
    if (hits.length) {
      const hit = hits[0].object;
      if (hit === this.sunMesh) { this.setFocus(0); return true; }
      if (hit === this.moon) { this.setFocus(this.moonFocus); return true; }
      for (let j = 0; j < this.planets.length; j++) {
        let node = hit;
        while (node && node !== this.planets[j].group && node !== this.planets[j].mesh) node = node.parent;
        if (node) { this.setFocus(j + 1); return true; }
      }
    }

    const candidates = [
      { index: 0, pos: this.sunMesh.position },
      ...this.planets.map((p, j) => ({ index: j + 1, pos: p.group.position })),
      { index: this.moonFocus, pos: this.moonGroup.position },
    ];
    let best = null, bestD = 34;
    candidates.forEach((c) => {
      const v = c.pos.clone().project(this.cam);
      if (v.z < -1 || v.z > 1) return;
      const sx = rect.left + (v.x + 1) * 0.5 * rect.width;
      const sy = rect.top + (1 - v.y) * 0.5 * rect.height;
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) { bestD = d; best = c; }
    });
    if (best) { this.setFocus(best.index); return true; }
    return false;
  }

  // ----------------------------------------------------------------- boucle

  frame(now) {
    if (this.stopped) return;
    const rawDt = now - this.lastNow;
    const dt = clamp(rawDt, 0, 100); // retour d'onglet : pas de saut
    this.lastNow = now;
    this.adaptResolution(rawDt, now);
    this.simMs = this.speed === 1 ? Date.now() : this.simMs + dt * this.speed;

    const jd = this.simMs / 864e5 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const d = jd - 2451545;

    this.updateBodies(T, d);
    this.updateCamera(dt);
    this.updateSunDirections();
    this.updateBorders();
    this.countryLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    this.tiles.update();
    this.moonTiles.update();
    this.marsTiles?.update();
    this.mercuryTiles?.update();
    this.venusTiles?.update();
    this.updateMoonModel();
    if (this.shadowcam.api) this.shadowcam.update(this.cam);
    this.updateLabels();
    this.worldLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    this.moonLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.moonTiles.root });
    this.orbiters.update({ t: this.simMs, moonPos: this.moonGroup.position, moonRadius: this.data.bodies.moon.radius, cam: this.cam, W: this.W, H: this.H });
    this.updateHud(now);

    this.renderer.render(this.scene, this.cam);
    this.rafId = requestAnimationFrame(this.frame);
  }

  /**
   * Résolution adaptative : moyenne glissante de la durée des images. Trop lente → un cran de moins (le GPU traite
   * jusqu'à 2,25× moins de pixels avec le tampon de profondeur logarithmique, et les tuiles demandées suivent la
   * hauteur réelle en pixels) ; rapide pendant 4 s → un cran de plus, sauf si ce cran a déjà fait ralentir.
   */
  adaptResolution(rawDt, now) {
    if (!(rawDt > 0) || rawDt > 250) return; // onglet caché, pause : mesure non significative
    this.dprFrameMs += (rawDt - this.dprFrameMs) * 0.05;
    if (now < this.dprCheckAt) return;
    this.dprCheckAt = now + DPR_CHECK_MS;
    const avg = this.dprFrameMs;
    if (avg > DPR_SLOW_MS && this.dpr > DPR_MIN) {
      this.dprBlockedAbove = this.dpr;            // ce cran est trop lourd pour l'instant
      this.dprBlockUntil = now + 30000;
      this.setResolution(Math.max(DPR_MIN, this.dpr - DPR_STEP));
      this.dprFastSince = 0;
    } else if (avg < DPR_FAST_MS && this.dpr < this.dprMax) {
      if (!this.dprFastSince) this.dprFastSince = now;
      const next = Math.min(this.dprMax, this.dpr + DPR_STEP);
      const blocked = next >= this.dprBlockedAbove && now < this.dprBlockUntil;
      if (!blocked && now - this.dprFastSince > DPR_RAISE_AFTER_MS) {
        this.setResolution(next);
        this.dprFastSince = 0;
      }
    } else this.dprFastSince = 0;
  }

  setResolution(dpr) {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr); // redimensionne aussi le tampon de rendu
    this.dprFrameMs = 16.7; // nouvelle mesure pour le nouveau cran
  }

  updateBodies(T, d) {
    this.planets.forEach((p) => {
      p.ecl = heliocentric(p.def.elements, T);
      p.w.set(p.ecl[0] * AU_UNITS, p.ecl[1] * AU_UNITS, p.ecl[2] * AU_UNITS);
      p.mesh.rotation.y = (d / p.def.rotation) * TAU;
    });

    const E = this.earth;
    this.updateMoon(T);
    this.sunMesh.rotation.y = (d / 25) * TAU;

    // Orientation de la Terre : face au Soleil selon l'heure UTC (jour/nuit réels).
    const ew = E.w;
    const lz = -ew.y * Math.sin(EARTH_TILT) - ew.z * Math.cos(EARTH_TILT);
    const sunAngle = Math.atan2(-lz, -ew.x);
    const hourAngle = -(((this.simMs / 3600000) % 24) - 12) * 15 * D;
    E.mesh.rotation.y = sunAngle - hourAngle;
    E.group.rotation.x = -EARTH_TILT;

    // Mars : obliquité réelle de son axe (la rotation propre est déjà appliquée au maillage ci-dessus).
    if (this.mars) this.mars.group.rotation.x = -MARS_TILT;
  }

  // Lune en temps réel : position (théorie ELP abrégée) et orientation synchrone. La rotation est uniforme
  // (méridien 0 vers la position moyenne de la Terre) alors que l'orbite ne l'est pas : la face visible oscille
  // donc comme dans le ciel (libration en longitude), et l'équateur incliné de 1,54° donne la libration en latitude.
  updateMoon(T) {
    const g = moonGeocentric(T);
    // Position exacte JPL Horizons quand la table couvre l'instant simulé ; l'orientation garde L' et Ω de la théorie.
    const exact = this.moonTable ? interpolateState(this.moonTable, this.simMs) : null;
    if (exact) Object.assign(g, eclipticOf(exact));
    this.moonSource = exact ? 'JPL Horizons' : 'théorie ELP';
    this.moonGeo = g;
    moonToScene(g, this.moonRel);
    this.moonW.copy(this.earth.w).add(this.moonRel);

    // Lois de Cassini : le nœud ascendant de l'équateur lunaire est le nœud descendant de l'orbite (Ω + 180°).
    const nodeEq = (g.node + 180) * D;
    this.nodeAxis.set(Math.cos(nodeEq), 0, -Math.sin(nodeEq));
    this.qTilt.setFromAxisAngle(this.nodeAxis, MOON_EQUATOR_TILT_DEG * D);
    this.qSpin.setFromAxisAngle(Y_AXIS, (g.meanLon + 180) * D);
    this.moonGroup.quaternion.multiplyQuaternions(this.qTilt, this.qSpin);

    // Lumière cendrée : phase de la Terre vue de la Lune ≈ complément de la phase de la Lune vue de la Terre.
    if (this.moonTiles) {
      const toSun = this.tmpSun.copy(this.moonW).negate().normalize();
      const toEarth = this.tmpEarth.copy(this.moonRel).negate().normalize();
      this.moonTiles.uniforms.earthshine.value = 1 - (1 + toSun.dot(toEarth)) / 2;
    }
  }

  updateCamera(dt = 0) {
    const { cam, planets, sunMesh } = this;
    const E = this.earth;

    // Transition douce vers l'astre ciblé, zoom lissé vers la distance visée
    this.focusT = Math.min(1, this.focusT + dt * 0.001 * FOCUS_RATE);
    const ease = 1 - Math.pow(1 - this.focusT, 3);
    this.target.copy(this.targetStart).lerp(this.focusTarget().get(), ease);
    // Zoom lissé en échelle logarithmique, même vitesse à toute cadence (avant : 16 % par image, donc plus lent à 30 i/s).
    this.dist *= Math.pow(this.distGoal / this.dist, 1 - Math.exp(-dt / ZOOM_TAU_MS));

    // Le monde est recentré sur la cible : la caméra reste proche de l'origine (précision flottante).
    planets.forEach((p) => {
      p.group.position.copy(p.w).sub(this.target);
      p.orbit.position.copy(this.target).negate();
      p.orbit.visible = this.dist > 3000;
    });
    this.moonGroup.position.copy(this.moonW).sub(this.target);
    this.moonOrbit.position.copy(this.earth.group.position);
    this.moonOrbit.visible = this.dist < MOON_ORBIT_MAX_DIST;
    sunMesh.position.copy(this.target).negate();
    this.glow.position.copy(sunMesh.position);
    this.sunLight.position.copy(sunMesh.position);

    // Rotation automatique ralentie près du sol (sinon la caméra défilerait de plusieurs km par image).
    const nearFactor = clamp(this.dist / (this.focusTarget().r || 1) - 1, 0, 1);
    if (this.autoRotate && !this.drag) {
      this.az += AUTO_ROTATE_SPEED * dt * 0.001 * nearFactor;
    }

    // Ville suivie : la caméra se place à la verticale de la ville
    if (this.lockCity && this.focus === this.earthFocus) {
      E.mesh.updateWorldMatrix(true, false);
      const n = this.lockN.copy(this.lockCity.lv).applyMatrix4(E.mesh.matrixWorld).sub(E.group.position).normalize();
      this.el = Math.asin(clamp(n.y, -1, 1));
      this.az = Math.atan2(n.x, n.z);
    }

    // Lieu de la Lune survolé : la caméra se place à sa verticale.
    if (this.lockMoon && this.focus === this.moonFocus) {
      const n = this.lockN.copy(this.lockMoon.lv).applyQuaternion(this.moonGroup.quaternion).normalize();
      this.el = Math.asin(clamp(n.y, -1, 1));
      this.az = Math.atan2(n.x, n.z);
    }

    // Lieu de Mars survolé : même repère que les tuiles (rotation du maillage + obliquité du groupe).
    if (this.lockMars && this.mars && this.focus === this.marsFocus) {
      this.mars.mesh.updateWorldMatrix(true, false);
      const n = this.lockN.copy(this.lockMars.lv).applyMatrix4(this.mars.mesh.matrixWorld)
        .sub(this.mars.group.position).normalize();
      this.el = Math.asin(clamp(n.y, -1, 1));
      this.az = Math.atan2(n.x, n.z);
    }

    // Lieu de Mercure survolé : même repère que les tuiles (rotation du maillage).
    if (this.lockMercury && this.mercury && this.focus === this.mercuryFocus) {
      this.mercury.mesh.updateWorldMatrix(true, false);
      const n = this.lockN.copy(this.lockMercury.lv).applyMatrix4(this.mercury.mesh.matrixWorld)
        .sub(this.mercury.group.position).normalize();
      this.el = Math.asin(clamp(n.y, -1, 1));
      this.az = Math.atan2(n.x, n.z);
    }

    // Lieu de Vénus survolé : même repère que les tuiles (rotation du maillage).
    if (this.lockVenus && this.venus && this.focus === this.venusFocus) {
      this.venus.mesh.updateWorldMatrix(true, false);
      const n = this.lockN.copy(this.lockVenus.lv).applyMatrix4(this.venus.mesh.matrixWorld)
        .sub(this.venus.group.position).normalize();
      this.el = Math.asin(clamp(n.y, -1, 1));
      this.az = Math.atan2(n.x, n.z);
    }

    // Flèches maintenues : rotation continue, d'autant plus fine qu'on est proche de la surface
    // (même facteur que le glisser), dt borné pour éviter un saut au retour d'onglet.
    const rot = this.keyRotate;
    if (rot.left || rot.right || rot.up || rot.down) {
      const kz = Math.max(1e-9, Math.min(1, (this.dist / (this.focusTarget().r || 1) - 1) * 0.9));
      const step = Math.min(dt, 100) * 0.001 * KEY_ROTATE_SPEED * kz;
      if (rot.left) this.az -= step;
      if (rot.right) this.az += step;
      if (rot.up) this.el = Math.min(1.5, this.el + step);
      if (rot.down) this.el = Math.max(-1.5, this.el - step);
    }

    const { dist, az, el } = this;
    const fr = this.focusTarget().r || 1;
    // Vue 3/4 automatique : l'angle suit la distance (rampe continue), puis est lissé dans le temps. Le Soleil,
    // sans sol à survoler, garde un regard centré. La pose conserve exactement la distance de zoom et vise le
    // point de surface survolé : ni l'altitude ni le lieu au centre de l'écran ne bougent.
    const engage = this.focus === 0 ? 0 : tiltEngagement(dist / fr);
    const tiltTarget = this.tiltOn ? TILT_MAX_ANGLE * engage : 0;
    this.tiltV = approachTilt(this.tiltV, tiltTarget, dt);
    // Cap de la boussole : rotation douce autour de la verticale locale, sans tour complet au passage de ±π.
    this.heading = approachAngle(this.heading, this.headingGoal, dt);
    tiltPose({
      radius: fr, dist, el, az, angle: this.tiltV, heading: this.heading,
      pos: cam.position, aim: this.tiltAim, up: this.tiltUp,
    });
    cam.up.copy(this.tiltUp);
    cam.lookAt(this.tiltAim);
    cam.updateMatrixWorld();

    // Plan proche suivant l'altitude : indispensable pour descendre à quelques mètres du sol (zoom 22).
    const near = clamp((dist - fr) * 0.02, 1e-10, 1e-5);
    if (Math.abs(near - cam.near) > cam.near * 0.05) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }

    this.glow.scale.setScalar(Math.max(655, cam.position.distanceTo(sunMesh.position) * 0.035));
  }

  // Les frontières suivent la rotation de la Terre et flottent juste au-dessus du sol, d'autant plus bas qu'on est près.
  updateBorders() {
    if (!this.bordersWanted) return;
    const altitude = Math.max(0, this.cam.position.distanceTo(this.earth.group.position) - 1);
    this.bordersRoot.visible = altitude > BORDERS_MIN_ALTITUDE;
    this.bordersRoot.rotation.y = this.earth.mesh.rotation.y;
    this.bordersRoot.scale.setScalar(1 + borderLift(altitude));
  }

  // Élévation du Soleil (en degrés) au-dessus de l'horizon d'un point du globe, pour la fiche ville.
  sunAltitudeAt(lon, lat) {
    const mesh = this.earth?.mesh;
    if (!mesh) return NaN;
    mesh.updateMatrixWorld(true);
    const normal = lonLatToVec([lon, lat]).transformDirection(mesh.matrixWorld);
    const toSun = this.tmpSun.copy(this.sunMesh.position).sub(this.earth.group.position).normalize();
    return Math.asin(clamp(normal.dot(toSun), -1, 1)) / D;
  }

  // Direction du Soleil vue de la Terre, de la Lune et de Mars, dans le repère caméra (éclairage des tuiles et de l'atmosphère).
  updateSunDirections(cam = this.cam) {
    this.sunDir
      .copy(this.sunMesh.position)
      .sub(this.earth.group.position)
      .normalize()
      .transformDirection(cam.matrixWorldInverse);
    this.moonSunDir
      .copy(this.sunMesh.position)
      .sub(this.moonGroup.position)
      .normalize()
      .transformDirection(cam.matrixWorldInverse);
    if (this.marsTiles) {
      this.marsSunDir
        .copy(this.sunMesh.position)
        .sub(this.mars.group.position)
        .normalize()
        .transformDirection(cam.matrixWorldInverse);
    }
    if (this.mercuryTiles) {
      this.mercurySunDir
        .copy(this.sunMesh.position)
        .sub(this.mercury.group.position)
        .normalize()
        .transformDirection(cam.matrixWorldInverse);
    }
    if (this.venusTiles) {
      this.venusSunDir
        .copy(this.sunMesh.position)
        .sub(this.venus.group.position)
        .normalize()
        .transformDirection(cam.matrixWorldInverse);
    }
  }

  updateLabels() {
    layoutLabels({
      cam: this.cam, W: this.W, H: this.H,
      bodies: this.bodyLabels,
      cities: this.cityItems,
      // Aucun nom de ville sur la Terre : ni la courte liste de l'API, ni les libellés Natural Earth.
      citiesEnabled: false,
      earthGroup: this.earth.group,
      earthMesh: this.earth.mesh,
    });
  }

  // Textes du HUD, publiés ≈10 fois par seconde.
  updateHud(now) {
    if (now - this.hudAt < 100) return;
    this.hudAt = now;

    const f = this.focusTarget();
    const date = new Date(this.simMs).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' })
      + (this.speed === 1 ? ' · temps réel' : '');

    const au = f.body ? Math.hypot(...f.body.ecl) : f.moon ? Math.hypot(...this.earth.ecl) : 0;
    let focusText = (this.focus
      ? `${f.name} · ${au.toFixed(3)} UA du Soleil · lumière ${(au * LIGHT_MINUTES_PER_AU).toFixed(1)} min`
      : 'Vue d’ensemble') + ' · échelle réelle 1:1';

    const city = this.lockCity;
    if (city && this.focus === this.earthFocus) {
      focusText = `${city.name} · ${Math.abs(city.lat).toFixed(2)}°${city.lat >= 0 ? 'N' : 'S'} `
        + `${Math.abs(city.lon).toFixed(2)}°${city.lon >= 0 ? 'E' : 'O'}`
        + ` · altitude ${fmtAltitude(this.dist - 1, EARTH_RADIUS_KM)}`;
    }

    if (f.moon && this.moonGeo) focusText = this.moonText(f);

    const zoomText = `${f.name} · ${Math.max(1, Math.round((this.dist / f.r) * 10) / 10)}×`;
    this.hud.set({
      date, focusText, zoomText,
      cityFocus: city && this.focus === this.earthFocus
        ? { name: city.name, lon: city.lon, lat: city.lat }
        : null,
      tiles: this.tiles.snapshot(), moonTiles: this.moonTiles.snapshot(),
      marsTiles: this.marsTiles?.snapshot() ?? null,
      mercuryTiles: this.mercuryTiles?.snapshot() ?? null,
      venusTiles: this.venusTiles?.snapshot() ?? null,
      moonLive: f.moon ? this.moonLiveState() : null,
      bodyLive: f.body ? { id: bodyId(f.body.def), name: f.name, au, lightMinutes: au * LIGHT_MINUTES_PER_AU } : null,
      compass: this.compassState(),
    });
  }

  /** Lune en direct pour le panneau : phase, distance, libration, Soleil au zénith, sondes. */
  moonLiveState() {
    const g = this.moonGeo;
    if (!g) return null;
    this.moonQInv.copy(this.moonGroup.quaternion).invert();
    const toLocal = ([x, y, z]) => { const v = this.tmpV.set(x, y, z).applyQuaternion(this.moonQInv); return [v.x, v.y, v.z]; };
    const ew = this.earth.w;
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    const rel = this.moonRel, w = this.moonW;
    const st = moonState({ moonRel: [rel.x, rel.y, rel.z], moonHelio: [w.x, w.y, w.z], elongDeg: g.lon - sunLon, toLocal });
    const toEarth = [-rel.x, -rel.y, -rel.z];
    const l = Math.hypot(...toEarth);
    const round = (x, k = 1) => Math.round(x * k) / k;
    const orbiters = this.orbiters.items.map((it) => {
      const base = { id: it.id, name: it.name, agency: it.agency, description: it.description, error: it.error || null, selected: it.id === this.selectedOrbiter };
      if (!it.state) return { ...base, ok: false };
      const m = orbiterMetrics(it.state, toLocal, toEarth.map((c) => c / l));
      return {
        ...base, ok: true, altitudeKm: round(m.altitudeKm), speedKmS: round(m.speedKmS, 1000),
        periodMin: m.periodMin && round(m.periodMin, 10), lon: round(m.lon, 100), lat: round(m.lat, 100), earthVisible: m.earthVisible,
      };
    });
    return {
      phase: st.phase, lit: round(st.lit * 100), ageDays: round(st.ageDays, 10), waxing: st.waxing,
      distKm: round(st.distKm), lightSeconds: round(st.lightSeconds, 1000),
      libration: { lon: round(st.libration.lon, 100), lat: round(st.libration.lat, 100) },
      subSolar: { lon: round(st.subSolar.lon, 100), lat: round(st.subSolar.lat, 100) },
      source: this.moonSource,
      orbiters,
      orbitersSource: this.orbiterData?.source || null,
      shadowcam: this.shadowcam.snapshot(),
      model: Boolean(this.moonModel),
    };
  }

  // Lune ciblée : distance réelle, phase et, de près, point survolé (coordonnées sélénographiques) et altitude.
  moonText(f) {
    const g = this.moonGeo;
    const toSun = this.moonW.clone().negate().normalize();
    const toEarth = this.moonRel.clone().negate().normalize();
    const lit = (1 + toSun.dot(toEarth)) / 2;
    const ew = this.earth.w;
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    const elong = ((((g.lon - sunLon) % 360) + 360) % 360);
    const phase = MOON_PHASES[Math.round(elong / 45) % 8];
    let text = `Lune · ${Math.round(g.distKm).toLocaleString('fr-FR')} km de la Terre · ${phase} · ${Math.round(lit * 100)} % éclairée · position ${this.moonSource}`;

    if (this.dist < f.r * 3) {
      this.moonGroup.updateMatrixWorld(true);
      this.moonInv.copy(this.moonGroup.matrixWorld).invert();
      const local = this.cam.position.clone().applyMatrix4(this.moonInv);
      // Coordonnées du point au centre de l'écran (en vue 3/4 la caméra est décalée de ce point).
      const aim = this.tiltAim.clone().applyMatrix4(this.moonInv);
      const [lon, lat] = xyzToLonLat([aim.x, aim.y, aim.z]);
      text = `Lune · ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'O'}`
        + ` · altitude ${fmtAltitude(local.length() / f.r - 1, MOON_RADIUS_KM)} · ${phase}`;
    }
    return text;
  }

  // ----------------------------------------------------------------- nettoyage

  dispose() {
    this.stopped = true;
    cancelAnimationFrame(this.rafId);
    this.removeInput();
    this.tiles.dispose();
    this.moonTiles.dispose();
    this.marsTiles?.dispose();
    this.mercuryTiles?.dispose();
    this.venusTiles?.dispose();
    this.worldLabels.dispose();
    this.countryLabels.dispose();
    this.cityCard.dispose();
    this.moonLabels.dispose();
    this.orbiters.dispose();
    this.shadowcam.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    });
    this.renderer.dispose();
    const cv = this.renderer.domElement;
    if (cv.parentNode) cv.parentNode.removeChild(cv);
  }
}
