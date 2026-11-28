/**
 * Méthodes du moteur SolarEngine (engine.jsx) : construction de la scène : lumières, astres, orbites, étoiles, systèmes, chargements.
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import * as THREE from 'three';
import { MAX_TILED_BODIES } from '../BodyEngine/bodyLoading.jsx';
import { AU_UNITS, centuriesTT, earthPosition, orbitPositions, lonLatToVec } from '../OrbitEngine/ephemeris.jsx';
import { RELIEF_KEY, TileManager } from '../MapEngine/tiles/tileManager.jsx';
import { WorldLabels } from '../LabelEngine/worldLabels.jsx';
import { FEATURE_TYPES } from '../MoonEngine/moonFeatures.jsx';
import { bodyId } from '../LabelEngine/bodyPlaces.jsx';
import { MoonOrbiters } from '../MoonEngine/moonOrbiters.jsx';
import { MoonOrbit } from '../MoonEngine/moonOrbit.jsx';
import { OrbitRibbon } from '../OrbitEngine/orbitRibbon.jsx';
import { AU_M, GEODESIC_EXAGGERATION, WELL_EXAGGERATION, easeInOutCubic, gridWellY, mixPoints } from '../../SystemeEngine/astronomy/orbits/orbitSchwarzschildMath.jsx';
import { rgbaOf } from '../OrbitEngine/orbitRibbonMath.jsx';
import { createMoonSurfaceMaterial } from '../MoonEngine/moonModel.jsx';
import { ShadowCamLayer } from '../CameraEngine/shadowcam.jsx';
import { TILED_BODIES, TILED_BODY_BY_ID } from '../BodyEngine/tiledBodies.jsx';
import { PLANETS } from '../../SystemeEngine/astronomy/data/bodies.data.ts';
import { SkyLayer } from '../../StarEngine/SkyEngine/skyLayer.jsx';
import { SatelliteSystem } from '../SatelliteEngine/satellites.jsx';
import { equatorialDegToScene } from '../../StarEngine/SkyEngine/skyMath.jsx';
import { planetKind } from '../BodyEngine/bodyKinds.jsx';
import { createSaturnRings } from '../../AstreGazeuxEngine/saturnRings.jsx';
import { createSunSurface } from '../../EruptionEngine/sunSurface.jsx';
import { createShadedSphereMaterial } from '../../TextureEngine/sphereShade.jsx';
import { createAtmosphere } from '../AtmosphereEngine/atmosphere.jsx';
import { bodyMassKg, dominantBody } from '../OrbitEngine/gravityMath.jsx';
import { createGasInterior } from '../../AstreGazeuxEngine/AtmosphereEngine/gasInterior.jsx';
import { renderProfile, systemProfile } from '../PerfEngine/powerSaver.jsx';
import { FpsMeter } from '../PerfEngine/perfProbe.jsx';
import { createRenderQualityModule } from '../../../engines/render-quality/index.js';
import { LightPollutionLayer } from '../../../engines/pollution-lumineuse/index.js';
import { SystemRegistry } from '../../SystemeEngine/core/system/SystemRegistry.js';
import { PerivolumeManager } from '../../SystemeEngine/PerivolumeEngine/PerivolumeManager.js';
import { CoreActivityPolicy } from '../../SystemeEngine/core/system/CoreActivityPolicy.js';
import { TileMemoryPolicy } from '../../SystemeEngine/core/budget/TileMemoryPolicy.js';
import { EngineActivityPolicy } from '../../SystemeEngine/core/system/EngineActivityPolicy.js';
import { SystemManager } from '../../SystemeEngine/core/system/SystemManager.js';
import { createGobaiPerivolumeAxioms } from '../../SystemeEngine/PerivolumeEngine/PerivolumeAxiomPolicy.js';
import { PerivolumeSphereEngine } from '../../SystemeEngine/PerivolumeEngine/PerivolumeSphereEngine.js';
import { gravitySphereRadius, schwarzschildRadiusOfMass, systemWellProfile, systemWellSegments } from '../../SystemeEngine/PerivolumeEngine/GravityField.js';
import { ResourceManager } from '../../SystemeEngine/core/system/ResourceManager.js';
import { InterstellarResourceLifecycleManager } from '../../SystemeEngine/core/galactic/InterstellarResourceLifecycleManager.js';
import { InterstellarLODManager } from '../../SystemeEngine/core/galactic/InterstellarLODManager.js';
import { GalacticSpatialIndex } from '../../SystemeEngine/core/galactic/GalacticSpatialIndex.js';
import { GalacticSectorStreamingManager } from '../../SystemeEngine/core/galactic/GalacticSectorStreamingManager.js';
import { GalacticSectorScheduler } from '../../SystemeEngine/core/galactic/GalacticSectorScheduler.js';
import { GalacticCatalogResidencyManager } from '../../SystemeEngine/core/galactic/GalacticCatalogResidencyManager.js';
import { createAstronomicalCatalogService } from '../../SystemeEngine/astronomy/providers/AstronomicalCatalogService.js';
import { GaiaDR3SectorStreamer } from '../../SystemeEngine/astronomy/providers/GaiaDR3SectorStreamer.js';
import { GaiaStarfieldLayer } from '../../StarEngine/GaiaStarfieldLayer.js';
import { createAstronomicalSystemExplorer } from '../../SystemeEngine/astronomy/AstronomicalSystemExplorer.js';
import { InterstellarSceneRenderer } from '../../StarEngine/InterstellarSceneRenderer.js';
import { createInterstellarEngineConfig, globalCameraPosition, resolveInterstellarSystemId, resolveInterstellarPerivolumeRadius, resolveInterstellarFocusDistance } from '../../StarEngine/InterstellarEngineIntegration.js';
import { RenderScheduler } from '../../SystemeEngine/core/render/RenderScheduler.js';
import { RenderBudgetPolicy } from '../../SystemeEngine/core/budget/RenderBudgetPolicy.js';
import { RenderDiagnosticsPolicy } from '../../SystemeEngine/core/budget/RenderDiagnosticsPolicy.js';
import { acquireUnitSphereGeometry } from '../../SystemeEngine/core/render/SharedGeometry.js';
import { SatelliteGpuBudgetOrchestrator } from '../../SystemeEngine/core/budget/SatelliteGpuBudgetOrchestrator.js';
import { SatelliteMultiLayerTextureAtlasManager } from '../../SystemeEngine/core/atlas/SatelliteMultiLayerTextureAtlas.js';
import { SatelliteTileAtlasPipeline } from '../../SystemeEngine/core/atlas/SatelliteTileAtlasPipeline.js';
import { SatelliteAtlasGpuBudgetBridge } from '../../SystemeEngine/core/atlas/SatelliteAtlasGpuBudgetBridge.js';
import { createSatelliteCanvasAtlasChannel } from '../../SystemeEngine/core/atlas/SatelliteCanvasAtlasChannel.js';
import { SatelliteSurfaceAtlasDiagnostics } from '../../SystemeEngine/core/atlas/SatelliteSurfaceAtlasDiagnostics.js';
import { SatelliteAtlasBrowserValidationAdapter } from '../../SystemeEngine/core/atlas/SatelliteAtlasBrowserValidation.js';
import { EARTH_RADIUS_KM, MOON_DISTANCE_KM, SUN_RADIUS_AU, WELL_MIN_APPARENT, CORE_DECISION_EVERY, WELL_MIN_DEPTH_SHARE, MAX_DISTANCE, MOON_COLOR, MOON_ORBIT_COLOR, AMBIENT_SHADED, SUN_LIGHT, ORBIT_POINTS } from './constants.jsx';

// Méthodes : construction de la scène : lumières, astres, orbites, étoiles, systèmes, chargements.
export const setupMethods = {
  // ---------------------------------------------------------------- construction

  // initRenderer : crée le moteur de rendu, la scène et la caméra (début).
  initRenderer() {
    // Profil de rendu : celui de l'appareil ; sur téléphone, celui de sa gamme (voir powerSaver.jsx et deviceTier.jsx).
    this.power = renderProfile();
    // Profil de l'appareil, gardé : this.power devient celui du rythme maximal dans le système d'une planète (applySystemView).
    this.basePower = this.power;
    // Profil du système d'une planète, dérivé de celui de l'appareil (même gamme, pas de ralenti au repos).
    this.systemPower = systemProfile(this.power);
    // Planète du système affiché (la caméra est dans sa sphère de Hill) : aucune.
    this.systemHost = null;
    // Moteur de rendu WebGL, avec profondeur logarithmique.
    const r = new THREE.WebGLRenderer({ antialias: this.power.antialias, logarithmicDepthBuffer: true, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false, alpha: this.embed });
    // Plafond : la densité de l'écran (≤ 2 sur ordinateur et téléphone) ; la résolution adaptative
    // (adaptResolution) descend si besoin jusqu'au plancher du profil (0,75 sur ordinateur, 1,25 sur téléphone).
    this.dprMax = Math.min(devicePixelRatio || 1, this.power.dprMax);
    // Départ à la densité du profil (son plafond).
    this.dpr = Math.min(this.dprMax, this.power.dprStart);
    // Garde le plafond d'origine.
    this.dprMaxFull = this.dprMax;
    // Durée visée d'une image.
    this.frameMs = this.power.frameMs; // durée visée d'une image (0 = sans limite), voir refreshFrameMs
    // Compteur d'images par seconde, à zéro.
    this.fps = 0; this.fpsTarget = 0; this.fpsMeter = new FpsMeter(); // compteur d'images par seconde, voir countFps
    // Qualité du rendu : reçoit chaque image et chaque sonde, publie un relevé par seconde (engines/render-quality).
    this.renderQualityModule = createRenderQualityModule();
    // Son service, point d'entrée unique des mesures et (aux lots suivants) des budgets.
    this.renderQuality = this.renderQualityModule.service;
    // Pas d'écran de chargement par-dessus.
    this.covered = false;              // écran de chargement par-dessus la scène (setCovered)
    // Pas d'économie d'énergie.
    this.saving = false;               // mode économie d'énergie des Paramètres (setPowerSaving)
    // Instant du dernier geste.
    this.activeAt = performance.now(); // dernier geste de l'utilisateur (markActive)
    // Durée moyenne d'une image : 16,7 ms au départ.
    this.dprFrameMs = 16.7;
    // Instant du prochain contrôle.
    this.dprCheckAt = 0;
    // Début de la période rapide.
    this.dprFastSince = 0;
    // Aucun cran de résolution bloqué.
    this.dprBlockedAbove = Infinity; // cran qui a déjà fait ralentir : on n'y remonte pas tout de suite
    // Fin du blocage.
    this.dprBlockUntil = 0;
    // Règle la densité de pixels.
    r.setPixelRatio(this.dpr);
    // Règle la taille.
    r.setSize(this.W, this.H);
    // Fond noir.
    r.setClearColor(0x000000, this.embed ? 0 : 1); // fond de l'espace : noir pur, sous le ciel lointain ; en embarquement, alpha 0 : l'espace est transparent
    // Effacement manuel.
    r.autoClear = false;       // effacement manuel : ciel lointain d'abord, puis la scène par-dessus
    // Ajoute le canevas au conteneur.
    this.container.appendChild(r.domElement);
    // Garde le moteur de rendu.
    this.renderer = r;
    // Scène.
    this.scene = new THREE.Scene();
    // Caméra : champ de 45°, du plan proche 0,00001 au plan lointain 1e10.
    this.cam = new THREE.PerspectiveCamera(45, this.W / this.H, 0.00001, 1e10);
    // Ciel au-delà du Système solaire, dans sa propre scène (indépendant de l'origine flottante et du plan proche).
    this.sky = new SkyLayer();
    // En embarquement : le ciel lointain est masqué d'office (aucun fond étoilé derrière le globe).
    if (this.embed) this.sky.setVisible(false);
    // Vecteur de travail du ciel : visée.
    this.skyFwd = new THREE.Vector3();
    // Vecteur de travail du ciel : direction du Soleil.
    this.skyToSun = new THREE.Vector3();
    // Vecteur de travail du ciel : haut.
    this.skyUp = new THREE.Vector3();
  // Fin de initRenderer.
  },
  // initSun : crée le Soleil, son halo et les lumières (début).
  initSun() {
    // Le Soleil des données.
    const { sun } = this.data.bodies;
    // Sphère du Soleil (début) :
    // surface animée (convection, granulation, régions actives) et éruptions de matière, voir sunSurface.jsx.
    this.sunMesh = createSunSurface(sun.radius);
    // Fin de la sphère.
    // L'ajoute à la scène.
    this.scene.add(this.sunMesh);
    // Régions actives réelles reçues du serveur : aucune au départ, le Soleil éclate avec ses régions simulées.
    this.solarRegionsData = null;
    // Instant de la dernière pose des régions réelles, en millisecondes du chronomètre de la page.
    this.solarRegionsAt = 0;
    // Vecteur de travail : direction du Soleil vers la Terre, pour placer les régions.
    this.sunToEarth = new THREE.Vector3();
    // Quaternion de travail : rotation propre du Soleil, pour passer du repère du monde au sien.
    this.sunSpin = new THREE.Quaternion();

    // Canevas du halo.
    const gc = document.createElement('canvas');
    // Carré de 256 px.
    gc.width = gc.height = 256;
    // Son contexte de dessin.
    const gx = gc.getContext('2d');
    // Dégradé radial.
    const gg = gx.createRadialGradient(128, 128, 10, 128, 128, 128);
    // Jaune clair au centre.
    gg.addColorStop(0, 'rgba(255,220,140,.95)');
    // Orange au quart.
    gg.addColorStop(0.25, 'rgba(255,160,50,.35)');
    // Transparent au bord.
    gg.addColorStop(1, 'rgba(255,120,20,0)');
    // Remplissage avec le dégradé.
    gx.fillStyle = gg;
    // Remplit le carré.
    gx.fillRect(0, 0, 256, 256);
    // Halo, toujours face à la caméra (début) :
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      // la texture du canevas, en mélange additif, sans écriture de profondeur.
      map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    // Fin du halo.
    }));
    // Sa taille : 16 unités.
    this.glow.scale.set(16, 16, 1);
    // L'ajoute à la scène.
    this.scene.add(this.glow);

    // Lumière ponctuelle du Soleil, sans atténuation.
    this.sunLight = new THREE.PointLight(0xffffff, SUN_LIGHT, 0, 0);
    // L'ajoute à la scène.
    this.scene.add(this.sunLight);
    // Réglages d'ombre des anneaux.
    this.ringShades = this.ringShades || []; // réglage « Ombre » des anneaux (uniform `shade` de chaque disque)
    // Lumière d'ambiance très faible : la face d'un astre opposée au Soleil est presque noire (ombre bien marquée),
    // au lieu d'un gris bleuté qui laissait voir toute la face nuit (avant : 0x303848).
    this.ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_SHADED);
    // L'ajoute à la scène.
    this.scene.add(this.ambientLight);
  // Fin de initSun.
  },
  // initPlanets : crée les planètes et leurs orbites (début).
  initPlanets() {
    // Direction du Soleil dans le repère caméra, partagée par les tuiles de la Terre et son atmosphère.
    this.sunDir = new THREE.Vector3(1, 0, 0);

    // Intérieurs traversables (Jupiter) : ponts nuageux, hydrogène moléculaire puis métallique, noyau dilué.
    this.gasInteriors = [];
    // Siècles de Temps terrestre écoulés depuis J2000 : l'échelle de temps des éléments d'orbite.
    const orbitT = centuriesTT(Date.now());
    // Pour chaque planète des données (début).
    this.planets = this.data.bodies.planets.map((def) => {
      // Sphère de couleur unie (couleur fournie par l'API). Pour la Terre : fond visible tant que les tuiles chargent.
      // Géantes gazeuses : sphère visible aussi de l'intérieur, la caméra pouvant traverser l'astre.
      const gas = Boolean(TILED_BODY_BY_ID[bodyId(def)]?.gas);
      // Sphère de la planète (début) :
      const sphereSegments = { width: def.earth ? 128 : 48, height: def.earth ? 96 : 32 };
      const sharedSphere = acquireUnitSphereGeometry(
        this.sharedGeometryPool, THREE, sphereSegments.width, sphereSegments.height
      );
      const mesh = new THREE.Mesh(
        // Géométrie unitaire partagée entre les astres de même topologie ; le rayon est porté par l'échelle.
        sharedSphere.geometry,
        // Son matériau, de sa couleur, visible des deux côtés pour une géante gazeuse.
        new THREE.MeshLambertMaterial({ color: def.color || '#888888', side: gas ? THREE.DoubleSide : THREE.FrontSide })
      // Fin de la sphère.
      );
      mesh.scale.setScalar(def.radius);
      // Groupe de la planète.
      const group = new THREE.Group();
      // Y ajoute la sphère.
      group.add(mesh);
      // Ajoute le groupe à la scène.
      this.scene.add(group);
      // Intérieur d'une géante gazeuse, ou aucun.
      const interior = gas ? createGasInterior(bodyId(def), def.radius) : null;
      // S'il y en a un (début).
      if (interior) {
        // Géante aplatie : l'intérieur prend la même forme que le globe, sinon il dépasserait aux pôles.
        const flattening = TILED_BODY_BY_ID[bodyId(def)]?.flattening;
        // Aplatissement appliqué à l'intérieur.
        if (flattening) interior.group.scale.y = 1 - flattening;
        // L'ajoute au groupe.
        group.add(interior.group);
        // Le note dans la liste des intérieurs.
        this.gasInteriors.push({ interior, group, mesh, radius: def.radius });
      // Fin de ce cas.
      }

      // Si la planète a des anneaux (début).
      if (def.ring) {
        // Saturne : anneaux modélisés (D, C, B, division de Cassini, A, F), éclairés par le Soleil et ombrés par la planète.
        // Tout autre astre à anneaux garde un disque uni.
        const ring = bodyId(def) === 'saturn'
          // Saturne : anneaux modélisés, éclairés depuis la position du Soleil ;
          ? createSaturnRings(def.radius, () => this.sunLight.position)
          // sinon un disque uni (début) :
          : new THREE.Mesh(
            // de 1,25 à 2,3 rayons,
            new THREE.RingGeometry(def.radius * 1.25, def.radius * 2.3, 96),
            // beige, visible des deux côtés, à moitié transparent.
            new THREE.MeshBasicMaterial({ color: 0xd8c79a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
          // Fin du disque.
          );
        // Anneaux dans le plan équatorial : le pôle réel de la planète (tiledBodies.jsx) oriente déjà son groupe.
        ring.rotation.x = Math.PI / 2 + (TILED_BODY_BY_ID[bodyId(def)]?.pole ? 0 : 0.46);
        // Ajoute les anneaux au groupe.
        group.add(ring);
        // Note leur réglage d'ombre, s'ils en ont un.
        if (ring.material.uniforms?.shade) (this.ringShades = this.ringShades || []).push(ring.material.uniforms.shade);
      // Fin de ce cas.
      }

      // Orbite : ellipse fermée de 2048 points (éléments à la date du jour), assez fine pour passer par la planète.
      const ellipse = orbitPositions(def.elements, orbitT, ORBIT_POINTS);
      // Points du ruban : les 2 048 points, puis le premier répété pour fermer la boucle.
      const orbitPoints = new Float32Array(ellipse.length + 3);
      // Les 2 048 points.
      orbitPoints.set(ellipse);
      // Le premier, répété à la fin.
      orbitPoints.set(ellipse.subarray(0, 3), ellipse.length);
      // Ruban de l'orbite, de la couleur de la planète, en style traînée (voir orbitRibbon.jsx).
      const orbitTrail = new OrbitRibbon({ points: orbitPoints, color: def.color || '#8b97b3', name: `orbit-${bodyId(def)}` });
      // Son maillage.
      const orbit = orbitTrail.mesh;
      // L'ajoute à la scène.
      this.scene.add(orbit);

      // Renvoie la planète : ses données, ses objets, sa famille, son état, ses positions, et l'état de sa traînée
      // (point de l'orbite où elle se trouve, sens du parcours, dernière position et instant du dernier calcul).
      return {
        // Données, objets, famille et état.
        def, mesh, group, orbit, orbitTrail, sphereGeometryKey: sharedSphere.key, kind: planetKind(def), hidden: false, settingsHidden: false, w: new THREE.Vector3(), ecl: [0, 0, 0],
        // Traînée : aucun point calculé, sens croissant, aucune position notée.
        trailHead: -1, trailDir: 1, trailPrev: null, trailAt: 0,
      // Fin de la planète.
      };
    // Fin de la boucle.
    });

    // Indice de la Terre.
    const earthIndex = this.planets.findIndex((p) => p.def.earth);
    // La Terre.
    this.earth = this.planets[earthIndex];
    // Sa cible : son indice plus 1.
    this.earthFocus = earthIndex + 1; // le Soleil est à l'indice 0
    // Les astres tuilés (Terre, Lune, Mars, Mercure, Vénus…) sont décrits dans tiledBodies.jsx : voir initTiles.

    // Atmosphères modélisées, par astre (Vénus, Terre, Mars) : créées dans initTiles, voir setAtmospheresVisible.
    this.atmospheres = {};
  // Fin de initPlanets.
  },
  /**
   * Un TileManager par astre décrit dans tiledBodies.jsx (modèle commun issu du moteur lunaire). Chaque entrée garde
   * tout ce dont le moteur a besoin : repère (groupe + maillage), direction du Soleil, lieu survolé, modèle 3D.
   */
  // initTiles : crée le gestionnaire de tuiles de chaque astre tuilé (début).
  initTiles() {
    // onChange : prévient l'interface.
    const onChange = () => this.onTilesChange();
    // Astres tuilés, en liste.
    this.tiledBodies = [];
    // Les mêmes, par identifiant.
    this.tiledById = {};
    // Pour chaque astre décrit (début).
    for (const cfg of TILED_BODIES) {
      // Son repère.
      const host = this.tiledHost(cfg.id);
      // Sans repère : astre suivant.
      if (!host) continue; // astre absent des données de l'API
      // La Terre et la Lune partagent leur direction du Soleil avec l'atmosphère et la lumière cendrée.
      const sunDir = cfg.id === 'earth' ? this.sunDir : cfg.id === 'moon' ? this.moonSunDir : new THREE.Vector3(1, 0, 0);
      // Gestionnaire de tuiles (début) :
      const tiles = new TileManager({
        // le moteur, l'API et la fonction de changement ;
        engine: this, api: this.tilesApi, onChange,
        // la description de l'astre (début) :
        body: {
          // son nom, son repère, son maillage, son rayon et la direction du Soleil ;
          name: cfg.id, parent: host.group, mesh: host.mesh, radius: host.radius, sunDir,
          // sans air ou non, et le mode de son calque ;
          airless: cfg.airless, overlayMode: cfg.overlayMode,
          // les chargements simultanés, le détail simulé, le sur-zoom et l'aplatissement ;
          concurrency: cfg.concurrency, detail: cfg.detail, overzoom: cfg.overzoom, polarScale: cfg.flattening ? 1 - cfg.flattening : 1,
          // les niveaux gardés, le préchargement et la mémoire vive ;
          pinnedMaxZoom: cfg.pinnedMaxZoom, prefetch: cfg.prefetch, ramCapacity: cfg.ramCapacity,
          // le relief, le rayon en kilomètres et les lumières de la nuit (la Terre) ;
          relief: cfg.relief, radiusKm: cfg.radiusKm, nightLights: cfg.nightLights,
          // le modèle d'éclairage et le masque de l'eau (la Terre) ;
          lighting: cfg.lighting, waterMask: cfg.waterMask,
          // Planètes : le repère des tuiles suit la rotation propre (le maillage), pas l'inclinaison portée par le groupe.
          // Lune : le groupe est déjà orienté (rotation synchrone, libration).
          syncRotation: host.syncMesh ? (root) => { root.rotation.y = host.mesh.rotation.y; } : undefined,
        // fin de la description.
        },
      // Fin du gestionnaire.
      });
      // Atmosphère des planètes solides (Vénus, Terre, Mars) : diffusion de la lumière du Soleil, voir atmosphere.jsx.
      const atmosphere = createAtmosphere(cfg.id, host.radius, tiles.uniforms, host.syncMesh ? () => host.mesh.rotation.y : null);
      // S'il y a une atmosphère (début).
      if (atmosphere) {
        // L'ajoute au groupe.
        host.group.add(atmosphere);
        // La garde par identifiant.
        this.atmospheres[cfg.id] = atmosphere;
      // Fin de ce cas.
      }
      // Géante gazeuse aplatie : la sphère de fond prend la même forme que les tuiles.
      if (cfg.flattening) host.mesh.scale.y *= 1 - cfg.flattening;
      // Sphère de fond (visible tant que les tuiles ne couvrent pas tout) : même éclairage et mêmes couleurs que les
      // tuiles et le modèle 3D, au lieu d'une teinte unie.
      if (cfg.surfaceMaterial) {
        // Libère l'ancien matériau.
        host.mesh.material.dispose();
        // Pose le matériau de surface de la Lune.
        host.mesh.material = createMoonSurfaceMaterial(tiles.uniforms);
      // Sinon, si la sphère a une couleur unie (début).
      } else if (host.mesh.material?.color) {
        // Sphère unie (géantes gazeuses, satellites sans carte, fond des planètes) : même ombre jour/nuit que les
        // cartes et même réglage « Ombre », au lieu de l'éclairage de la scène.
        const old = host.mesh.material;
        // Couleur du fond : celle du champ `backdrop` de l'astre quand il en a une (astre entièrement
        // cartographié : son fond ne sert qu'au chargement et reste discret), sinon sa couleur d'interface
        // (géantes gazeuses, satellites sans carte : la sphère unie est leur aspect réel).
        // Pose le matériau de sphère ombrée, de la couleur de fond.
        host.mesh.material = createShadedSphereMaterial(cfg.backdrop || old.color, tiles.uniforms, old.side);
        // Libère l'ancien.
        old.dispose();
      // Fin du choix.
      }
      // Fiche de l'astre tuilé (début) :
      const entry = {
        // son identifiant, sa description, son repère, la direction du Soleil et ses tuiles ;
        id: cfg.id, cfg, ...host, sunDir, tiles,
        // sa cible, pas encore connue ;
        focus: -1,          // indice dans focusTargets (fixé par initFocusTargets)
        // son lieu survolé : aucun ;
        lock: null,         // lieu survolé { lon, lat, lv }
        // son modèle 3D : aucun, voulu, pas en chargement.
        model: null, modelWanted: true, modelLoading: null,
      // Fin de la fiche.
      };
      // L'ajoute à la liste.
      this.tiledBodies.push(entry);
      // La range par identifiant.
      this.tiledById[cfg.id] = entry;
    // Fin de la boucle.
    }
    // Raccourcis gardés pour les couches propres à la Terre (frontières, villes) et à la Lune (ShadowCam, lumière cendrée).
    this.tiles = this.tiledById.earth.tiles;
    // Raccourci vers les tuiles de la Lune.
    this.moonTiles = this.tiledById.moon.tiles;
    // Pollution lumineuse de la Terre : couche three.js rattachée au repère de ses tuiles, dessinée seulement au-dessus
    // du globe CesiumJS (renderAtmosphereOverlay), sous les nuages ; mêmes réglages que les lumières des tuiles.
    this.lightPollution = new LightPollutionLayer({ root: this.tiledById.earth.tiles.root, uniforms: this.tiledById.earth.tiles.uniforms });
  // Fin de initTiles.
  },
  /**
   * Astre dont la gravité domine à l'endroit de la caméra : { name, r, distance } (rayon et distance au centre en
   * unités de la scène, soit en rayons terrestres), ou null avant le premier rendu.
   */
  // dominantBodyNow : l'astre dont la gravité domine à l'endroit de la caméra (début).
  dominantBodyNow() {
    // Si la liste des astres n'existe pas (début).
    if (!this.gravityBodies) {
      // Le Soleil et la Lune des données.
      const { sun, moon } = this.data.bodies;
      // Rayons de la scène → kilomètres : l'unité de la scène est le rayon terrestre.
      const entry = (id, name, r, pos) => ({ name, r, pos, massKg: bodyMassKg(id, r * EARTH_RADIUS_KM), distance: 0 });
      // Liste des astres (début) :
      this.gravityBodies = [
        // le Soleil,
        entry('sun', sun.name, sun.radius, this.sunMesh.position),
        // les planètes,
        ...this.planets.map((p) => entry(bodyId(p.def), p.def.name, p.def.radius, p.group.position)),
        // la Lune,
        entry('moon', moon.name, moon.radius, this.moonGroup.position),
        // les satellites.
        ...this.satellites.list.map((s) => entry(s.def.id, s.def.name, s.def.radius, s.group.position)),
      // Fin de la liste.
      ];
    // Fin de ce cas.
    }
    // Position de la caméra.
    const cam = this.cam.position;
    // Distance de chaque astre à la caméra.
    for (const b of this.gravityBodies) b.distance = cam.distanceTo(b.pos);
    // Renvoie l'astre dominant.
    return dominantBody(this.gravityBodies);
  // Fin de dominantBodyNow.
  },
  /** Repère qui porte les tuiles d'un astre : groupe (position, inclinaison), maillage de fond, rayon (scène). */
  // tiledHost : le repère qui porte les tuiles d'un astre (début).
  tiledHost(id) {
    // La Lune : son groupe, sa sphère et son rayon.
    if (id === 'moon') return { group: this.moonGroup, mesh: this.moon, radius: this.data.bodies.moon.radius, syncMesh: false };
    // Satellite de cet identifiant.
    const sat = this.satellites.byId.get(id);
    // Satellites : comme la Lune, le groupe est déjà orienté (rotation synchrone).
    if (sat) return { satellite: sat, group: sat.group, mesh: sat.mesh, radius: sat.def.radius, syncMesh: false };
    // Planète de cet identifiant.
    const planet = this.planets.find((p) => bodyId(p.def) === id);
    // Son groupe, sa sphère et son rayon ; null si elle est inconnue.
    return planet ? { planet, group: planet.group, mesh: planet.mesh, radius: planet.def.radius, syncMesh: true } : null;
  // Fin de tiledHost.
  },
  /**
   * Relief en volume de la Terre (vraies altitudes) : allumé ou coupé, et exagération des hauteurs (1 = réelles).
   * Coupé par défaut : la carte est à plat et s'affiche plus vite. Le choix est gardé dans le navigateur
   * (« gobai:relief-3d ») et s'applique tout de suite. L'ombrage des autres astres, estimé d'après l'image, ne
   * demande aucun téléchargement : il reste toujours actif.
   */
  // setRelief : allume ou coupe le relief en volume, avec son exagération (début).
  setRelief(on, exaggeration = 1) {
    // Garde le choix dans le navigateur ; un refus est ignoré.
    try { globalThis.localStorage?.setItem(RELIEF_KEY, on ? String(exaggeration) : '0'); } catch { /* stockage refusé : valable pour la session */ }
    // L'applique à chaque astre au relief Terrarium.
    for (const tb of this.tiledBodies) if (tb.tiles.relief?.kind === 'terrarium') tb.tiles.setRelief({ on, exaggeration });
  // Fin de setRelief.
  },
  /**
   * Réglage « Relief » de l'app pour un astre, lu par le globe CesiumJS (relief en volume) :
   * { on, exaggeration, terrain? }, ou null si l'astre n'a pas de relief Terrarium. `terrain` (absent pour la Terre,
   * dont le globe a son propre fournisseur AWS) décrit la source de tuiles d'altitude des autres astres solides
   * (Lune, Mars, Mercure, Vénus) : { template, minZoom, maxZoom, signed } — le relais du serveur.
   */
  // solidRelief : l'identifiant de l'astre (début).
  solidRelief(id) {
    // Gestionnaire des tuiles de l'astre.
    const t = this.tiledById?.[id]?.tiles;
    // Sans relief Terrarium : null.
    if (t?.relief?.kind !== 'terrarium') return null;
    // Réglage demandé (activé par défaut, comme les tuiles).
    const ask = t.reliefAsk ?? { on: true, exaggeration: 1 };
    // Le réglage.
    const r = { on: Boolean(ask.on), exaggeration: Number.isFinite(ask.exaggeration) && ask.exaggeration > 0 ? ask.exaggeration : 1 };
    // La Terre : son globe a son propre fournisseur (AWS Terrain Tiles), rien de plus à passer.
    if (id === 'earth') return r;
    // Autre astre : la première source à modèle d'adresse (le relais du serveur, ex. /api/v1/tiles/relief/mars/...).
    const src = (t.relief.sources || []).find((s) => s?.template);
    // Sans source à modèle : pas de relief en volume possible pour cet astre.
    if (!src) return { ...r, terrain: null };
    // Renvoie le réglage, avec la description de la source de tuiles d'altitude.
    return { ...r, terrain: { template: src.template, minZoom: t.relief.minZoom ?? 0, maxZoom: t.relief.maxZoom ?? 12, signed: Boolean(t.relief.signed) } };
  // Fin de solidRelief.
  },
  /**
   * Pollution lumineuse de la Terre la nuit (atlas 2025 de David Lorenz, en couleurs naturelles) : allumée ou
   * coupée. Elle suit le Soleil d'elle-même (côté nuit du terminateur). Le choix est gardé dans le navigateur.
   */
  // setNightLights : allume ou coupe les lumières de la nuit de chaque astre qui en a (début).
  setNightLights(on) {
    // L'applique à chaque astre tuilé qui a des lumières.
    for (const tb of this.tiledBodies) if (tb.tiles.lightsSource) tb.tiles.setNightLights(on);
  // Fin de setNightLights.
  },
  /**
   * Vue de la pollution lumineuse depuis l'espace : toute la Terre de nuit, sa pollution lumineuse (atlas 2025) allumée
   * partout et chargée pour le monde entier. Coupée : la nuit suit à nouveau le Soleil.
   */
  // setLightView : allume ou coupe la vue de nuit pour chaque astre qui a des lumières (début).
  setLightView(on) {
    // L'applique à chaque astre tuilé qui a des lumières.
    for (const tb of this.tiledBodies) if (tb.tiles.lightsSource) tb.tiles.setLightView(on);
  // Fin de setLightView.
  },
  /** Astre tuilé actuellement ciblé, ou null (Soleil, géantes gazeuses). */
  // focusedTiled : l'astre tuilé ciblé, ou null.
  focusedTiled() { return this.focusTarget().tiled || null; },
  // Frontières des pays et littoraux : repère dans le groupe de la Terre, qui suit sa rotation propre (comme les tuiles).
  // La géométrie arrive plus tard (setBorders) depuis GET /borders.
  initBorders() {
    // Repère des frontières.
    this.bordersRoot = new THREE.Object3D();
    // Son nom.
    this.bordersRoot.name = 'borders';
    // Masqué au départ.
    this.bordersRoot.visible = false;
    // L'ajoute au groupe de la Terre.
    this.earth.group.add(this.bordersRoot);
    // Frontières masquées par défaut.
    this.bordersOn = false;
    // Frontières pas encore demandées.
    this.bordersWanted = false;
    // Littoraux masqués par défaut.
    this.coastsOn = false;
    // Littoraux du globe remplacés par ceux des tuiles (calque des rues affiché).
    this.coastsFromTiles = false;
    // Lignes des frontières : aucune.
    this.borders = null;   // THREE.LineSegments des frontières terrestres
    // Lignes des littoraux : aucune.
    this.coasts = null;    // THREE.LineSegments des littoraux
  // Fin de initBorders.
  },
  // initMoon : crée la Lune et son orbite (début).
  initMoon() {
    // La Lune des données.
    const { moon } = this.data.bodies;
    // Groupe = repère sélénographique (longitude 0 vers la Terre, Nord en +Y) ; il porte la sphère de fond et les tuiles.
    this.moonGroup = new THREE.Group();
    // Son nom.
    this.moonGroup.name = 'moon';
    // L'ajoute à la scène.
    this.scene.add(this.moonGroup);
    // Direction du Soleil vue de la Lune.
    this.moonSunDir = new THREE.Vector3(1, 0, 0);
    // Sphère de la Lune (début) :
    this.moon = new THREE.Mesh(
      // sa géométrie, à son rayon ;
      new THREE.SphereGeometry(moon.radius, 96, 64),
      // son matériau, de couleur unie.
      new THREE.MeshLambertMaterial({ color: MOON_COLOR })
    // Fin de la sphère.
    );
    // L'ajoute au groupe.
    this.moonGroup.add(this.moon);

    // Orbite géocentrique de la Lune : ellipse képlérienne propagée par le même solveur que les autres satellites.
    this.moonOrbitTrail = new MoonOrbit({ color: MOON_ORBIT_COLOR, positionAt: (ms, out) => this.moonRelAt(ms, out) });
    // La ligne de l'orbite.
    this.moonOrbit = this.moonOrbitTrail.line;
    // L'ajoute à la scène.
    this.scene.add(this.moonOrbit);
    // Position de la Lune dans la scène.
    this.moonW = new THREE.Vector3();
    // Vecteur de la Terre à la Lune.
    this.moonRel = new THREE.Vector3();   // Terre → Lune
    // État géocentrique dérivé du vecteur képlérien courant.
    this.moonGeo = null;
    this.moonSource = 'Kepler à deux corps';
    this.moonBasisMatrix = new THREE.Matrix4();
    this.moonBasisX = new THREE.Vector3();
    this.moonBasisY = new THREE.Vector3();
    this.moonBasisZ = new THREE.Vector3();
    // Vecteur de travail : Soleil.
    this.tmpSun = new THREE.Vector3();
    // Vecteur de travail : Terre.
    this.tmpEarth = new THREE.Vector3();
  // Fin de initMoon.
  },
  // Satellites sphériques (Jupiter à Pluton) (Io, Europe… Titan, Japet), sur le modèle de la Lune : voir satellites.jsx.
  initSatellites() {
    // Pôles des planètes, dans le repère de la scène.
    const poles = {};
    // Pour les quatre géantes (début).
    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
      // Son pôle, s'il est décrit.
      const pole = TILED_BODY_BY_ID[id]?.pole;
      // Le convertit vers la scène.
      if (pole) poles[id] = equatorialDegToScene(pole[0], pole[1]);
    // Fin de la boucle.
    }
    // Système des satellites (début) :
    this.satellites = new SatelliteSystem({
      // la scène, leurs données, les planètes, la fonction d'identifiant et les pôles.
      scene: this.scene, defs: this.data.bodies.satellites || [], planets: this.planets, bodyId, poles,
    // Fin du système.
    });
  // Fin de initSatellites.
  },
  // Lune : lieux (alunissages, mers, cratères), sondes en orbite et modèle 3D.
  initMoonLive() {
    // Parent des étiquettes : celui du conteneur, ou la page.
    const parent = this.container.parentNode || document.body;
    // Noms des lieux de la Lune (début).
    this.moonLabels = new WorldLabels({
      // Leur parent.
      parent,
      // Leur classe CSS.
      className: 'l map-label moon-label',
      // Altitude maximale d'affichage : 9 rayons lunaires.
      maxAltitude: 9,                                           // en rayons lunaires
      // Nombre de noms selon l'altitude : de 14 de loin à 90 de près.
      budget: (alt) => (alt > 3 ? 14 : alt > 1 ? 30 : alt > 0.2 ? 60 : 90),
      // Par paliers.
      tiered: true,
      // decorate : prépare une étiquette (début).
      decorate: (el, f) => {
        // Son texte : le nom d'origine, sinon le nom.
        el.textContent = f.native || f.name;
        // Son écriture, latine par défaut.
        el.dataset.script = f.script || 'latin';
        // Sa couleur, selon le type du lieu.
        el.style.setProperty('--c', FEATURE_TYPES[f.type]?.color || '#fff');
        // Son infobulle : le nom, le nom d'origine, l'information et l'invitation à cliquer.
        el.title = `${f.name}${f.native ? ` · ${f.native}` : ''}${f.info ? ` · ${f.info}` : ''} · cliquer pour survoler`;
      // Fin de decorate.
      },
      // Au clic : va au lieu.
      onPick: (f) => this.goToSite('moon', f),
    // Fin des noms.
    });
    // Types de lieux affichés : tous.
    this.moonFeatureTypes = new Set(Object.keys(FEATURE_TYPES));
    // Applique les lieux.
    this.applyMoonFeatures();
    // Sondes en orbite lunaire ; au clic, la sonde est sélectionnée.
    this.orbiters = new MoonOrbiters({ scene: this.scene, parentEl: parent, onPick: (id) => this.selectOrbiter(id) });
    // Données des sondes : aucune.
    this.orbiterData = null;
    // Sonde sélectionnée : aucune.
    this.selectedOrbiter = null;
    // Quaternion de travail : inverse de la rotation de la Lune.
    this.moonQInv = new THREE.Quaternion();
    // Vecteur de travail.
    this.tmpV = new THREE.Vector3();
    // Pôles vus par Danuri : mosaïques ShadowCam des cratères en ombre permanente (au-dessus des tuiles).
    this.shadowcam = new ShadowCamLayer({ root: this.moonTiles.root, api: null, getGap: () => this.moonTiles.base?.layer.gap ?? 1e-6 });
  // Fin de initMoonLive.
  },
  // Astres sélectionnables, dans l'ordre des boutons : Soleil, planètes, Lune.
  initFocusTargets() {
    // Le Soleil et la Lune des données.
    const { sun, moon } = this.data.bodies;
    // Origine de la scène.
    // Position du Soleil dans le repère des astres : l'origine, sauf dans l'affichage Schwarzschild où il descend.
    this.sunW = new THREE.Vector3();
    // Cibles (début) :
    this.focusTargets = [
      // le Soleil, à l'origine ;
      { name: sun.name, r: sun.radius, get: () => this.sunW },
      // chaque planète (début) :
      ...this.planets.map((p) => ({
        // son nom, son rayon, sa fiche et sa position ;
        name: p.def.name, r: p.def.radius, body: p, get: () => p.w,
        // traversable pour une géante gazeuse ;
        passable: Boolean(TILED_BODY_BY_ID[bodyId(p.def)]?.gas), // géante gazeuse : pas de sol
      // fin de la planète ;
      })),
      // la Lune.
      { name: moon.name, r: moon.radius, moon: true, get: () => this.moonW },
    // Fin des cibles.
    ];
    // Indice de la Lune : le dernier.
    this.moonFocus = this.focusTargets.length - 1;
    // Satellites sphériques (Jupiter à Pluton), après la Lune (indices suivants).
    for (const sat of this.satellites.list) {
      // Son indice.
      sat.focus = this.focusTargets.length;
      // Ajoute sa cible.
      this.focusTargets.push({ name: sat.def.name, r: sat.def.radius, satellite: sat, get: () => sat.w });
    // Fin de la boucle.
    }
    // Lien cible ↔ astre tuilé, dans les deux sens.
    for (const tb of this.tiledBodies) {
      // Indice de la cible : la Lune, le satellite, ou la planète plus 1.
      tb.focus = tb.id === 'moon' ? this.moonFocus : tb.satellite ? tb.satellite.focus : this.planets.indexOf(tb.planet) + 1;
      // Lie la cible à l'astre tuilé.
      this.focusTargets[tb.focus].tiled = tb;
    // Fin de la boucle.
    }
  // Fin de initFocusTargets.
  },
  // Initialise l’orchestration centrale : le Core observe les périvolumes, sans encore décharger les moteurs.
  initCoreOrchestration() {
    this.coreRegistry = new SystemRegistry();
    this.corePerivolumes = new PerivolumeManager({ hysteresis: 0.08 });
    // Crée le moteur de rendu des périverolumes : une bulle de verre translucide par système.
    this.perivolumeSpheres = new PerivolumeSphereEngine({ THREE });
    // Rattache la scène : les bulles suivent les volumes de systèmes.
    // Les sphères sont rangées sous un groupe qui suit l'origine flottante de la scène : leurs centres restent
    // exprimés dans le repère du Soleil (celui des astres, `w`), et le groupe est décalé de −cible à chaque image,
    // comme le Soleil lui-même. Sans lui, les sphères restaient au repère du Soleil pendant que la scène, elle,
    // se recentrait sur l'astre visé : elles apparaissaient autour du mauvais astre.
    this.perivolumeRoot = new THREE.Group();
    this.perivolumeRoot.name = 'perivolumes';
    this.scene.add(this.perivolumeRoot);
    this.perivolumeSpheres.attachScene(this.perivolumeRoot);
    // Les périvolumes appartiennent à l'affichage Schwarzschild (bouton E = mc²) : masqués au départ, ils suivent
    // ensuite son fondu (voir updateSchwarzschildFade). Allumés, ils se montrent tous, même hors de portée.
    this.perivolumeSpheres.setDisplay(this.schwarzschild ? easeInOutCubic(this.schwarzschild.progress) : 0, { revealUnloaded: true });
    this.coreGpuMemoryBudget = new SatelliteGpuBudgetOrchestrator({
      globalBudgetBytes: 512 * 1024 * 1024,
      defaultBodyBudgetBytes: 256 * 1024 * 1024,
      // Erreur du budget GPU : ignorée en silence (aucun log en console).
      onError: () => {},
    });
    // Atlas couleur expérimental activé sur Terre et Lune ; les autres couches
    // (altitude, normales, nuit) conservent leurs chargeurs spécialisés.
    this.surfaceAtlasRuntimes = new Map();
    this.surfaceAtlasMode = 'atlas';
    this.surfaceAtlasDiagnostics = new SatelliteSurfaceAtlasDiagnostics({ maxFrames: 120, maxTiles: 1000 });
    this.initSurfaceAtlasPipelines();
    this.coreResources = new ResourceManager();
    this.coreActivityPolicy = new CoreActivityPolicy({ backgroundEvery: 4 });
    this.coreTileMemoryPolicy = new TileMemoryPolicy();
    this.coreEngineActivityPolicy = new EngineActivityPolicy();
    this.coreRenderBudgetPolicy = new RenderBudgetPolicy({ maxTiledBodies: MAX_TILED_BODIES });
    this.coreRenderBudget = this.coreRenderBudgetPolicy.snapshot();
    this.coreRenderDiagnosticsPolicy = new RenderDiagnosticsPolicy();
    this.coreRenderDiagnostics = this.coreRenderDiagnosticsPolicy.snapshot();
    // Ordonnanceur : trois tâches par image ; une tâche en échec est ignorée en silence (aucun log en console).
    this.coreScheduler = new RenderScheduler({ maxTasksPerFrame: 3, onError: () => {} });
    this.coreTransitions = [];
    this.coreTargets = this.focusTargets.map((target, index) => {
      const id = target.tiled?.id || (index === 0 ? 'sun' : index === this.moonFocus ? 'moon' : `body-${index}`);
      const center = target.get().toArray();
      const radius = Math.max(Number(target.r) || 1, 1e-6);
      const descriptor = {
        id,
        name: target.name,
        radius,
        focusIndex: index,
        kind: target.satellite ? 'satellite' : target.moon ? 'moon' : index === 0 ? 'star' : 'planet',
      };
      this.coreRegistry.register(descriptor);
      this.corePerivolumes.register({
        id,
        center,
        radius: radius * 12,
        backgroundRadius: radius * 40,
        metadata: { focusIndex: index, kind: descriptor.kind, level: 'body' },
      });
      // La sphère dessinée de l'astre suit son champ gravitationnel : son rayon est celui de sa sphère de Hill
      // (son poids face à l'astre autour duquel il tourne), et non plus douze fois son rayon. Le Soleil n'a pas de
      // parent : sa sphère est la bulle du système solaire, enregistrée plus bas.
      const gravityRadius = this.gravitySphereRadiusOf(target, index);
      if (gravityRadius > 0) {
        this.perivolumeSpheres.register({
          id, center, radius: gravityRadius, backgroundRadius: gravityRadius * 3, variant: 'body',
          metadata: { focusIndex: index, kind: descriptor.kind, level: 'body', gravity: 'hill' },
        });
      }
      return { id, target, focusIndex: index };
    });
    // Volumes de systèmes internes : Terre-Lune et ensemble du Système solaire.
    // Ils sont exprimés dans le même repère de scène que la caméra.
    const coreTargetById = new Map(this.coreTargets.map((item) => [item.id, item]));
    const earthTarget = coreTargetById.get('earth');
    const moonTarget = coreTargetById.get('moon');
    const sunTarget = coreTargetById.get('sun') || this.coreTargets[0];
    this.coreSystemVolumes = [];
    const registerSystemVolume = (id, target, radius, metadata) => {
      if (!target || !Number.isFinite(radius) || radius <= 0) return;
      this.coreRegistry.upsert({ id, name: id, kind: 'system', level: 'system' });
      this.corePerivolumes.register({ id, center: target.get().toArray(), radius, backgroundRadius: radius * 3, metadata: { ...metadata, level: 'system' } });
      // Ajoute la bulle de verre du système dans la scène.
      this.perivolumeSpheres?.register({ id, center: target.get().toArray(), radius, backgroundRadius: radius * 3 });
      this.coreSystemVolumes.push({ id, target });
    };
    if (earthTarget) {
      const earthPosition = earthTarget.target.get();
      const moonDistance = moonTarget ? earthPosition.distanceTo(moonTarget.target.get()) : 0;
      const earthSystemRadius = Math.max(earthTarget.target.r * 40, moonDistance + (moonTarget?.target.r || 0) * 12, 1e-6);
      registerSystemVolume('system:earth', earthTarget.target, earthSystemRadius, { members: ['earth', 'moon'] });
    }
    if (sunTarget) {
      const sunPosition = sunTarget.target.get();
      const solarExtent = Math.max(...this.coreTargets.map(({ target }) => sunPosition.distanceTo(target.get()) + (Number(target.r) || 0) * 12), sunTarget.target.r * 40, 1e-6);
      registerSystemVolume('system:solar', sunTarget.target, solarExtent, { members: this.coreTargets.map(({ id }) => id) });
    }
    this.coreSystemManager = new SystemManager({
      registry: this.coreRegistry,
      perivolumeManager: this.corePerivolumes,
      axioms: createGobaiPerivolumeAxioms({
        earthSystem: 'system:earth', solarSystem: 'system:solar',
        earth: 'earth', moon: 'moon', mercury: 'mercury',
      }),
      onTransition: (event) => {
        this.coreTransitions.push({ id: event.id, state: event.state, previous: event.previous });
        if (this.coreTransitions.length > 100) this.coreTransitions.shift();
      },
    });
    this.coreLastDecisions = [];
    // Les toupies : chaque astre est un système, avec son puits de gravité qui l'englobe.
    this.initSystemWells();
    // Raccordement réel des systèmes distants à la scène principale et au catalogue public.
    this.initInterstellarIntegration();
  },
  /**
   * Rayon, en unités de scène, de la sphère translucide d'un astre : sa sphère de Hill, au moins une fois et demie
   * son propre rayon. 0 pour le Soleil (pas de parent) et pour un astre dont l'orbite n'est pas connue.
   *  - planète : autour du Soleil, à son demi-grand axe ;
   *  - Lune : autour de la Terre ;
   *  - satellite : autour de sa planète, à son demi-grand axe.
   */
  gravitySphereRadiusOf(target, index) {
    if (!target || index === 0) return 0;
    const radius = Math.max(Number(target.r) || 0, 1e-6);
    const massOf = (id, r) => bodyMassKg(id, r * EARTH_RADIUS_KM);
    let distance = 0, massKg = 0, parentMassKg = 0;
    if (target.body) {
      distance = (target.body.def.elements?.[0] || 0) * AU_UNITS;
      massKg = massOf(bodyId(target.body.def), radius);
      parentMassKg = bodyMassKg('sun');
    } else if (target.moon) {
      distance = MOON_DISTANCE_KM / EARTH_RADIUS_KM;
      massKg = bodyMassKg('moon');
      parentMassKg = bodyMassKg('earth');
    } else if (target.satellite) {
      const sat = target.satellite;
      distance = (sat.def.aKm || 0) / EARTH_RADIUS_KM;
      massKg = massOf(sat.def.id, radius);
      parentMassKg = sat.parent ? massOf(bodyId(sat.parent.def), sat.parent.def.radius) : 0;
    }
    if (!(distance > 0)) return 0;
    return gravitySphereRadius({ distance, massKg, parentMassKg, minimum: radius * 1.5 });
  },
  /**
   * Met l'orbite d'une planète au mélange Kepler → rosette du moment, si elle ne l'est pas déjà : le mélange point à
   * point est écrit dans les points du ruban, que la carte graphique relit.
   */
  mixPlanetOrbit(p) {
    const eased = this.schwarzschild?.eased || 0;
    if (p.orbitMix === eased || !p.rosetteOrbit) return;
    mixPoints(p.keplerOrbit, p.rosetteOrbit, eased, p.orbitTrail.points);
    p.orbitTrail.positionsChanged();
    p.orbitMix = eased;
  },
  /** Vrai dès que la représentation de Schwarzschild est à l'écran (fondu commencé) : les orbites de Kepler sont alors masquées. */
  keplerOrbitsMasked() {
    return (this.schwarzschild?.eased || 0) > 0.002;
  },
  /**
   * Descentes de l'affichage Schwarzschild, en unités de scène. Chaque astre est un système, et sa toupie est un
   * cône sous le plan du système : le bord à la hauteur 0, la pointe au centre. Deux mouvements se composent :
   *  - l'astre principal d'un système descend au fond de sa propre toupie (wellApexDrop) ;
   *  - un astre qui tourne autour d'un autre se pose sur la pente de la toupie de celui-ci, à sa distance, donc
   *    plus haut que lui (wellSlopeRise).
   * Les deux suivent le fondu : nuls hors du mode, ils font glisser les astres quand on appuie sur E = mc².
   */

  /** Descente d'un astre au fond de sa propre toupie : négative (vers le bas), nulle hors du mode. */
  wellApexDrop(id) {
    const alpha = this.schwarzschild?.eased || 0;
    const profile = alpha && id ? this.systemWellProfiles?.get(id) : null;
    return profile ? alpha * profile(0) : 0;
  },
  /** Hauteur d'un astre au-dessus de son astre central `parentId`, à la distance `distance` de lui : positive ou nulle. */
  wellSlopeRise(parentId, distance) {
    const alpha = this.schwarzschild?.eased || 0;
    const profile = alpha && parentId ? this.systemWellProfiles?.get(parentId) : null;
    return profile ? alpha * (profile(distance) - profile(0)) : 0;
  },
  /**
   * Rayon de Schwarzschild de la planète d'un satellite, exagéré et divisé par le demi-grand axe du satellite :
   * le terme relativiste de sa rosette (voir schwarzschildSatelliteRosette).
   * L'exagération est réglée système par système pour que le satellite le plus proche de chaque planète précesse
   * autant que Mercure autour du Soleil : à l'exagération du système solaire, le rayon de Schwarzschild d'une planète
   * (2,8 m pour Jupiter, 9 mm pour la Terre) ne déplacerait aucune orbite de façon visible. Les satellites plus
   * lointains précessent moins, en proportion inverse de leur distance, comme les planètes lointaines.
   */
  satelliteRsOverA(sat) {
    const parentId = sat?.parent ? bodyId(sat.parent.def) : null;
    const aKm = sat?.def.aKm;
    if (!parentId || !(aKm > 0)) return 0;
    this.satelliteRosetteScale ||= new Map();
    let scale = this.satelliteRosetteScale.get(parentId);
    if (scale === undefined) {
      // Terme relativiste de Mercure à l'écran (rayon de Schwarzschild exagéré du Soleil sur son demi-grand axe) :
      // la référence du système solaire.
      const mercury = PLANETS.find((b) => bodyId(b) === 'mercury') || PLANETS[0];
      const reference = ((schwarzschildRadiusOfMass(bodyMassKg('sun')) / AU_M) * GEODESIC_EXAGGERATION) / mercury.elements[0];
      // Demi-grand axe du satellite le plus proche de cette planète : c'est lui qui reçoit ce terme de référence.
      const innerKm = Math.min(...this.satellites.list.filter((s) => s.parent === sat.parent && s.def.aKm > 0).map((s) => s.def.aKm));
      scale = Number.isFinite(innerKm) ? reference * innerKm : 0;
      this.satelliteRosetteScale.set(parentId, scale);
    }
    return scale / aKm;
  },
  /**
   * Hauteur de la grille du Soleil à `rAu` unités astronomiques de lui, en unités de scène, au rythme du fondu :
   * négative (sous le plan de l'écliptique), nulle au bord de la grille et au-delà. C'est là que se pose le bord de
   * la toupie d'une planète ; à la distance du rayon du Soleil, c'est le fond où descend le Soleil lui-même.
   */
  sunWellDrop(rAu) {
    const s = this.schwarzschild;
    if (!s?.eased || !(s.outerAu > 0) || !(rAu < s.outerAu)) return 0;
    return s.eased * gridWellY(Math.max(rAu, SUN_RADIUS_AU), s.outerAu) * AU_UNITS;
  },
  /**
   * Place la toupie d'un astre : son bord reste là où était l'astre avant de descendre, et l'astre repose au fond.
   * La pointe du cône est donc exactement sur l'astre.
   */
  placeSystemWell({ id, target, well }) {
    well.position.copy(target.get());
    well.position.y -= this.wellApexDrop(id);
  },
  /**
   * Pose la toupie de chaque astre : chaque astre est un système, avec sa toupie qui l'englobe. C'est son puits de
   * gravité (grille filaire double, comme celle du Soleil), inscrit dans sa sphère d'influence : le bord de la toupie
   * suit l'équateur de la sphère translucide, ses deux pointes se referment au-dessus et au-dessous de l'astre.
   * Planètes, planètes naines, Lune et satellites en portent une ; le Soleil garde la sienne, la grille du système
   * solaire. La profondeur vient de la masse de l'astre (même exagération que la grille du Soleil) ; quand ce creux
   * réel ne suffit pas à englober l'astre, la toupie est étirée jusqu'à la valeur de son rayon (WELL_MIN_DEPTH_SHARE), et au moins 1,6 fois le
   * rayon de l'astre.
   * Masquées hors de l'affichage Schwarzschild (bouton E = mc²), elles en suivent le fondu.
   */
  initSystemWells() {
    this.systemWells = [];
    // Un seul matériau pour toutes les toupies (même trait que la grille du Soleil : fin, additif, sans écriture de
    // profondeur) : leur opacité est la même, et le fondu ne règle plus qu'une valeur au lieu d'une par astre.
    this.systemWellMaterial = new THREE.LineBasicMaterial({
      color: 0x6f86b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    // Profil de la toupie de chaque astre, par identifiant : hauteur du cône du bas à une distance donnée.
    this.systemWellProfiles = new Map();
    // Les satellites descendent dans la toupie de leur planète, au rythme du fondu Schwarzschild.
    if (this.satellites) {
      // Hauteur de l'anneau d'un satellite au-dessus de sa planète (la pente de la toupie de la planète)…
      this.satellites.ringDrop = (sat) => this.wellSlopeRise(sat.parent ? bodyId(sat.parent.def) : null, sat.rel.length());
      // … et du satellite lui-même, qui descend en plus au fond de sa propre toupie.
      this.satellites.wellDrop = (sat) => this.satellites.ringDrop(sat) + this.wellApexDrop(sat.def.id);
      // Le système d'une planète naine est couché sur le plan de Schwarzschild avec elle : ses satellites quittent
      // leur plan d'orbite incliné (celui de Pluton est presque perpendiculaire à l'écliptique), au rythme du fondu.
      this.satellites.flatten = (sat) => (sat.parent?.def.dwarf ? this.schwarzschild?.eased || 0 : 0);
    }
    if (!this.perivolumeRoot) return;
    this.focusTargets.forEach((target, index) => {
      // Le rayon de la toupie : celui de la sphère d'influence de l'astre (0 pour le Soleil, qui a déjà la sienne).
      const outer = this.gravitySphereRadiusOf(target, index);
      if (!(outer > 0)) return;
      const radius = Math.max(Number(target.r) || 0, 1e-6);
      const id = target.body ? bodyId(target.body.def) : target.moon ? 'moon' : target.satellite?.def.id;
      if (!id) return;
      // Moins de traits pour un satellite : ils sont des dizaines.
      const small = Boolean(target.satellite);
      const shape = {
        outer, inner: radius, unitM: EARTH_RADIUS_KM * 1000,
        massKg: bodyMassKg(id, radius * EARTH_RADIUS_KM), exaggeration: WELL_EXAGGERATION,
        minDepth: Math.max(outer * WELL_MIN_DEPTH_SHARE, radius * 1.6),
      };
      const positions = systemWellSegments({ ...shape, rings: small ? 8 : 14, spokes: small ? 24 : 32 });
      if (!positions.length) return;
      // Le profil du cône du bas : la surface sur laquelle descendent les astres de ce système (ses satellites).
      this.systemWellProfiles.set(id, systemWellProfile(shape));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      // Sphère englobante calculée une fois : le moteur de rendu écarte ainsi les toupies hors du champ de la caméra.
      geometry.computeBoundingSphere();
      const well = new THREE.LineSegments(geometry, this.systemWellMaterial);
      well.renderOrder = 3;
      well.visible = false;
      well.name = `schwarzschild-well:${id}`;
      this.perivolumeRoot.add(well);
      this.systemWells.push({ id, target, well, radius: outer, focusIndex: index });
    });
  },
  // Initialise les connecteurs astronomiques navigateur et le renderer distant partagé avec la scène principale.
  initInterstellarIntegration() {
    const config = createInterstellarEngineConfig({ auUnits: AU_UNITS });
    this.interstellarConfig = config;
    this.interstellarCatalog = createAstronomicalCatalogService({ maxRows: 500 });
    this.gaiaSectorStreamer = new GaiaDR3SectorStreamer({ catalogService: this.interstellarCatalog, maxConcurrent: 2, maxStarsPerCone: 500 });
    this.gaiaStarfieldLayer = new GaiaStarfieldLayer({ THREE, scene: this.scene, parsecToSceneUnits: config.parsecToSceneUnits });
    this.gaiaLoadedStars = new Map();
    this.gaiaStarOwners = new Map();
    this.gaiaManualStarIds = new Set();
    this.interstellarExplorer = createAstronomicalSystemExplorer({ catalogService: this.interstellarCatalog });
    this.interstellarRenderer = new InterstellarSceneRenderer({
      THREE,
      scene: this.scene,
      camera: this.cam,
      parsecToSceneUnits: config.parsecToSceneUnits,
      focusDistance: config.focusDistance,
    });
    this.interstellarSystems = new Map();
    this.interstellarResourceLifecycle = new InterstellarResourceLifecycleManager({
      // Erreur du cycle de vie interstellaire : ignorée en silence (aucun log en console).
      onError: () => {},
    });
    this.interstellarLoadControllers = new Map();
    this.interstellarLOD = new InterstellarLODManager({ maxPlanetSystems: 8, maxDetailedSystems: 2 });
    this.galacticSpatialIndex = new GalacticSpatialIndex({ sectorSizePc: 10 });
    this.galacticSectorStreaming = new GalacticSectorStreamingManager({ index: this.galacticSpatialIndex, enterRadiusPc: 50, exitRadiusPc: 65 });
    this.galacticCatalogResidency = new GalacticCatalogResidencyManager({
      maxSectors: 24, maxStars: 250_000, maxEstimatedBytes: 96 * 1024 * 1024, bytesPerStar: 384,
      onEvict: ({ key }) => this.galacticSectorScheduler?.evictSector(key, 'lru-memory-budget'),
    });
    this.galacticSectorScheduler = new GalacticSectorScheduler({
      streamer: this.gaiaSectorStreamer,
      maxConcurrent: 1, maxQueued: 8, maxPrefetchSectors: 5, maxPages: 1, pageSize: 500,
      predictionHorizonMs: 1200, maxPredictionDeg: 2, minMotionDegPerSec: 0.15, maxPredictiveSectors: 1,
      onViewChanged: ({ sectorKeys }) => this.galacticCatalogResidency?.setPinned(sectorKeys),
      onSectorLoaded: ({ key, result }) => {
        this.ingestGaiaStars(result?.stars || [], key);
        this.galacticCatalogResidency?.registerSector(key, (result?.stars || []).map((star) => star?.id).filter(Boolean), {
          cursor: result?.nextSourceIdAfter || null, pageCount: result?.pagesLoaded || 1,
        });
      },
      onSectorEvicted: ({ key, starIds }) => {
        this.galacticCatalogResidency?.removeSector(key);
        this.evictGaiaSectorStars(key, starIds);
      },
      // Erreur d'un secteur Gaia : ignorée en silence (aucun log en console).
      onSectorError: () => {},
    });
    this.galacticStreamingFrame = 0;
    this.galacticStreamingLastResult = null;
    this.interstellarLODFrame = 0;

  },
  /** Recherche un système par nom dans Gaia/SIMBAD/NASA puis l'enregistre dans la scène globale. */
  async loadInterstellarSystemByName(name, options = {}) {
    if (!this.interstellarExplorer) throw new Error('Le moteur interstellaire n’est pas initialisé.');
    const { signal, ...queryOptions } = options;
    const requestKey = String(name || '').trim().toLowerCase();
    this.interstellarLoadControllers?.get(requestKey)?.abort?.();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) this.interstellarLoadControllers?.set(requestKey, controller);
    if (signal?.aborted) controller?.abort?.();
    const forwardAbort = () => controller?.abort?.();
    signal?.addEventListener?.('abort', forwardAbort, { once: true });
    const combinedSignal = controller?.signal || signal;
    const now = new Date();
    const year = queryOptions.targetEpochJulianYear ?? now.getUTCFullYear() + (now.getUTCMonth() + 1) / 12;
    const jd = queryOptions.targetJulianDate ?? this.simMs / 864e5 + 2440587.5;
    let result;
    try {
      result = await this.interstellarExplorer.resolveByName(name, {
        ...queryOptions, targetEpochJulianYear: year, targetJulianDate: jd,
      }, { signal: combinedSignal });
    } finally {
      signal?.removeEventListener?.('abort', forwardAbort);
      if (this.interstellarLoadControllers?.get(requestKey) === controller) this.interstellarLoadControllers.delete(requestKey);
    }
    const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const requested = fold(name);
    const system = result.systems.find((item) => fold(item.star?.name) === requested)
      || result.systems.find((item) => (item.planets || []).some((planet) => fold(planet.host?.name) === requested))
      || result.systems.find((item) => (item.star?.sourceRecords || []).some((record) => fold(record?.name) === requested))
      || (result.systems.length === 1 ? result.systems[0] : null);
    if (!system) return { ok: false, reason: 'system-not-resolved', candidates: result.systems.map((item) => ({ id: item.id, name: item.star?.name || item.id })) };
    const canonicalId = queryOptions.id;
    return this.registerInterstellarSystem(system, { ...queryOptions, targetEpoch: queryOptions.targetEpoch ?? year, id: canonicalId, requestedName: name });
  },
  /** Ajoute un système au repère global de Gobai et l'expose comme cible caméra. */
  registerInterstellarSystem(starSystem, options = {}) {
    if (!this.interstellarRenderer || !this.interstellarSystems) throw new Error('Le renderer interstellaire n’est pas initialisé.');
    const coreId = resolveInterstellarSystemId(starSystem, options.id);
    if (this.interstellarSystems.has(coreId)) this.removeInterstellarSystem(coreId);
    const nowMs = Date.now();
    const targetEpoch = Number.isFinite(Number(options.targetEpoch ?? options.targetEpochJulianYear))
      ? Number(options.targetEpoch ?? options.targetEpochJulianYear)
      : 2000 + (nowMs - Date.UTC(2000, 0, 1, 12)) / (365.25 * 864e5);
    const systemForScene = starSystem;
    const entry = this.interstellarRenderer.addSystem(systemForScene, {
      ...this.interstellarConfig,
      ...options,
      targetEpoch,
      parsecToSceneUnits: options.parsecToSceneUnits ?? this.interstellarConfig.parsecToSceneUnits,
    });
    if (entry.model.positionStatus !== 'available') {
      this.interstellarRenderer.removeSystem(systemForScene.id);
      return { ok: false, reason: 'position-unavailable', id: coreId, warnings: entry.model.warnings };
    }
    const position = entry.model.position;
    const center = [position.x, position.y, position.z];
    const radius = resolveInterstellarPerivolumeRadius(options, this.interstellarConfig.auToSceneUnits, systemForScene);
    this.registerExternalSystemPerivolume({
      id: coreId,
      center,
      radius,
      backgroundRadius: options.backgroundRadius ?? radius * 3,
      name: entry.model.name,
    });
    const focusTarget = {
      name: entry.model.name,
      r: Number.isFinite(options.focusRadius) && options.focusRadius > 0 ? options.focusRadius : this.interstellarConfig.focusRadius,
      // La cible caméra reste dans le repère global ; le groupe 3D est recentré à chaque frame.
      get: () => new THREE.Vector3(entry.model.position.x, entry.model.position.y, entry.model.position.z),
      interstellarSystemId: coreId,
    };
    const focusIndex = this.focusTargets.push(focusTarget) - 1;
    entry.coreId = coreId;
    entry.focusIndex = focusIndex;
    entry.focusDistance = resolveInterstellarFocusDistance(systemForScene, this.interstellarConfig.auToSceneUnits, this.interstellarConfig.focusDistance);
    entry.starSystem = systemForScene;
    entry.targetEpoch = targetEpoch;
    this.interstellarSystems.set(coreId, entry);
    if (entry.model.heliocentricParsecs) {
      this.galacticSpatialIndex?.upsert(coreId, entry.model.heliocentricParsecs, {
        name: entry.model.name, distancePc: entry.model.distancePc, sourceSystemId: systemForScene.id,
      });
    }
    this.interstellarLOD?.forget(coreId);
    this.interstellarRenderer.setSystemLOD(systemForScene.id, options.initialLod || 'DETAILED');
    this.interstellarResourceLifecycle?.register(coreId, {
      release: () => this.interstellarRenderer?.setSystemLoaded(coreId, false),
      restore: () => this.interstellarRenderer?.setSystemLoaded(coreId, true),
    });
    return {
      ok: true,
      id: coreId,
      sourceSystemId: systemForScene.id,
      name: entry.model.name,
      distancePc: entry.model.distancePc,
      distanceLightYears: entry.model.distanceLightYears,
      position: { ...position },
      planetCount: systemForScene.planets?.length || 0,
      targetEpoch,
      astrometricState: entry.model.astrometricState || null,
      focusIndex,
      perivolumeRadius: radius,
    };
  },
  /** Associe une tâche réseau au cycle de vie d'un système : elle sera annulée en UNLOADED ou à la suppression. */
  attachInterstellarRequestController(id, controller) {
    return this.interstellarResourceLifecycle?.attachAbortController(id, controller) ?? false;
  },
  /** Place la caméra sur un système interstellaire déjà découvert. */
  focusInterstellarSystem(id) {
    const entry = this.interstellarSystems?.get(id);
    if (!entry) return false;
    this.setFocus(entry.focusIndex);
    this.distGoal = Math.min(MAX_DISTANCE, entry.focusDistance);
    this.markActive();
    return true;
  },
  /** Met à jour la position globale d'un système à une époque julienne cible. */
  setInterstellarSystemEpoch(id, targetEpoch) {
    const entry = this.interstellarSystems?.get(id);
    if (!entry || !Number.isFinite(Number(targetEpoch))) return { ok: false, reason: 'system-or-epoch-invalid', id };
    const result = this.interstellarRenderer?.updateSystemEpoch(entry.starSystem.id, Number(targetEpoch), {
      ...this.interstellarConfig,
      targetEpoch: Number(targetEpoch),
    });
    if (!result?.ok) return result || { ok: false, reason: 'renderer-unavailable', id };
    entry.targetEpoch = Number(targetEpoch);
    entry.model = this.interstellarRenderer.getSystem(entry.starSystem.id).model;
    const position = entry.model.position;
    const center = [position.x, position.y, position.z];
    this.updateExternalSystemPerivolume(id, center);
    this.galacticSpatialIndex?.upsert(id, entry.model.heliocentricParsecs, {
      name: entry.model.name, distancePc: entry.model.distancePc, sourceSystemId: entry.starSystem.id,
    });
    return { ...result, id, position: { x: position.x, y: position.y, z: position.z }, distanceLightYears: entry.model.distanceLightYears };
  },
  /** Retire proprement un système distant, son périvolume et sa cible caméra. */
  removeInterstellarSystem(id) {
    const entry = this.interstellarSystems?.get(id);
    if (!entry) return false;
    if (this.focus === entry.focusIndex) this.setFocus(this.earthFocus);
    this.interstellarResourceLifecycle?.unregister(id);
    this.interstellarLOD?.forget(id);
    this.galacticSpatialIndex?.remove(id);
    this.galacticSectorStreaming?.update(this.galacticSectorStreaming.lastCenter || { x: 0, y: 0, z: 0 }, { force: true });
    this.interstellarRenderer?.removeSystem(entry.starSystem.id);
    this.unregisterExternalSystemPerivolume(id);
    this.focusTargets.splice(entry.focusIndex, 1);
    this.interstellarSystems.delete(id);
    for (const current of this.interstellarSystems.values()) {
      if (current.focusIndex > entry.focusIndex) current.focusIndex -= 1;
    }
    if (this.focus > entry.focusIndex) {
      this.focus -= 1;
      this.onFocusChange(this.focus);
    }
    return true;
  },
  /** Recherche les systèmes connus dans un rayon exprimé en parsecs (repère héliocentrique ICRS). */
  queryInterstellarSystemsNear(positionPc, radiusPc, options = {}) {
    return this.galacticSpatialIndex?.queryRadius(positionPc, radiusPc, options) || [];
  },
  getGalacticSpatialStats() {
    return { ...(this.galacticSpatialIndex?.getStats() || { objects: 0, sectors: 0, sectorSizePc: 10, indexed: true }),
      streaming: this.galacticSectorStreaming?.getStats() || null };
  },
  /** Indexe un lot Gaia et l'injecte dans le starfield sans dupliquer les source_id. */
  ingestGaiaStars(stars = [], sectorKey = null) {
    if (this.stopped || !Array.isArray(stars)) return { newlyIndexed: 0, totalLoadedStars: this.gaiaLoadedStars?.size || 0 };
    const fresh = [];
    for (const star of stars) {
      if (!star?.id) continue;
      if (sectorKey) {
        if (!this.gaiaStarOwners.has(star.id)) this.gaiaStarOwners.set(star.id, new Set());
        this.gaiaStarOwners.get(star.id).add(sectorKey);
      } else this.gaiaManualStarIds.add(star.id);
      if (this.gaiaLoadedStars.has(star.id)) continue;
      this.gaiaLoadedStars.set(star.id, star);
      this.galacticSpatialIndex?.upsert(star.id, star.positionPc, { source: 'Gaia DR3', magnitude: star.magnitude });
      fresh.push(star);
    }
    this.gaiaStarfieldLayer?.setStars(fresh);
    const center = this.galacticSectorStreaming?.lastCenter || { x: 0, y: 0, z: 0 };
    const residency = this.galacticSectorStreaming?.update(center, { force: true });
    this.gaiaStarfieldLayer?.setResidentIds(residency?.visibleIds || []);
    return { newlyIndexed: fresh.length, totalLoadedStars: this.gaiaLoadedStars.size, residentStars: residency?.visibleIds?.length || 0 };
  },
  /** Retire les étoiles qui ne sont plus référencées par aucune tuile résidente. */
  evictGaiaSectorStars(sectorKey, starIds = []) {
    const removed = [];
    for (const id of starIds) {
      const owners = this.gaiaStarOwners.get(id);
      owners?.delete(sectorKey);
      if (owners?.size === 0) this.gaiaStarOwners.delete(id);
      if ((!owners || owners.size === 0) && !this.gaiaManualStarIds.has(id) && this.gaiaLoadedStars.delete(id)) {
        this.galacticSpatialIndex?.remove(id);
        removed.push(id);
      }
    }
    if (removed.length) {
      this.gaiaStarfieldLayer?.removeStars(removed);
      const center = this.galacticSectorStreaming?.lastCenter || { x: 0, y: 0, z: 0 };
      const residency = this.galacticSectorStreaming?.update(center, { force: true });
      this.gaiaStarfieldLayer?.setResidentIds(residency?.visibleIds || []);
    }
    return removed.length;
  },
  /** Active ou désactive le streaming Gaia piloté par la caméra (désactivé par défaut). */
  setGaiaAutoStreaming(enabled, { radiusDeg = 1, maxPages, maxPagesPerSector, maxConcurrent, maxPrefetchSectors } = {}) {
    if (!this.galacticSectorScheduler || this.stopped) throw new Error('Planificateur Gaia indisponible.');
    if (maxPages !== undefined) this.galacticSectorScheduler.maxPages = Math.max(1, Math.min(100, Math.floor(Number(maxPages) || 1)));
    if (maxPagesPerSector !== undefined) this.galacticSectorScheduler.maxPagesPerSector = Math.max(this.galacticSectorScheduler.maxPages, Math.min(500, Math.floor(Number(maxPagesPerSector) || 1)));
    if (maxConcurrent !== undefined) this.galacticSectorScheduler.maxConcurrent = Math.max(1, Math.floor(Number(maxConcurrent) || 1));
    if (maxPrefetchSectors !== undefined) this.galacticSectorScheduler.maxPrefetchSectors = Math.max(1, Math.floor(Number(maxPrefetchSectors) || 1));
    this.gaiaAutoStreamingRadiusDeg = Math.max(0.1, Math.min(5, Number(radiusDeg) || 1));
    const active = this.galacticSectorScheduler.setEnabled(enabled);
    if (active) {
      const camera = globalCameraPosition(this.cam.position, this.target);
      const scale = this.interstellarConfig?.parsecToSceneUnits || 1;
      const x = camera.x / scale; const y = -camera.z / scale; const z = camera.y / scale;
      const distance = Math.hypot(x, y, z);
      if (distance > 1e-6) {
        this.galacticSectorScheduler.updateView({
          raDeg: (Math.atan2(y, x) / (Math.PI / 180) + 360) % 360,
          decDeg: Math.asin(Math.max(-1, Math.min(1, z / distance))) / (Math.PI / 180),
          radiusDeg: this.gaiaAutoStreamingRadiusDeg,
        });
      }
    }
    return this.galacticSectorScheduler.getStats();
  },
  /** Charge à la demande un cône Gaia DR3. Aucun téléchargement n'est lancé au démarrage. */
  async loadGaiaDR3Cone({ raDeg, decDeg, radiusDeg = 1, limit = 500 } = {}, options = {}) {
    if (!this.gaiaSectorStreamer || this.stopped) throw new Error('Streaming Gaia indisponible.');
    const result = await this.gaiaSectorStreamer.loadCone({ raDeg, decDeg, radiusDeg, limit }, options);
    if (this.stopped) return { ...result, ignored: true };
    const ingestion = this.ingestGaiaStars(result.stars);
    return { ...result, ...ingestion };
  },
  /** Charge un cône Gaia par pages keyset source_id, avec un plafond de pages explicite. */
  async loadGaiaDR3ConePages({ raDeg, decDeg, radiusDeg = 1, limit = 500, maxPages = 10, sourceIdAfter = null } = {}, options = {}) {
    if (!this.gaiaSectorStreamer || this.stopped) throw new Error('Streaming Gaia indisponible.');
    const result = await this.gaiaSectorStreamer.loadConePages({ raDeg, decDeg, radiusDeg, limit, sourceIdAfter }, { ...options, maxPages });
    if (this.stopped) return { ...result, ignored: true };
    const ingestion = this.ingestGaiaStars(result.stars);
    return { ...result, ...ingestion };
  },
  /** Oriente un cône Gaia autour de la direction caméra ; nécessite une caméra à plus de 0 parsec du Soleil. */
  loadGaiaDR3AroundCamera({ radiusDeg = 1, limit = 500 } = {}, options = {}) {
    const globalCamera = globalCameraPosition(this.cam.position, this.target);
    const scale = this.interstellarConfig?.parsecToSceneUnits || 0;
    // Les axes de scène Gobai sont (ICRS x, ICRS z, -ICRS y).
    const x = globalCamera.x / scale; const y = -globalCamera.z / scale; const z = globalCamera.y / scale;
    const distance = Math.hypot(x, y, z);
    if (!Number.isFinite(distance) || distance < 1e-6) throw new Error('La caméra est trop proche du Soleil pour déterminer une direction Gaia.');
    const raDeg = (Math.atan2(y, x) / (Math.PI / 180) + 360) % 360;
    const decDeg = Math.asin(Math.max(-1, Math.min(1, z / distance))) / (Math.PI / 180);
    return this.loadGaiaDR3Cone({ raDeg, decDeg, radiusDeg, limit }, options);
  },
  getGaiaStreamingStats() {
    return { ...(this.gaiaSectorStreamer?.getStats() || {}), loadedStars: this.gaiaLoadedStars?.size || 0, scheduler: this.galacticSectorScheduler?.getStats() || null, residency: this.galacticCatalogResidency?.getStats() || null, render: this.gaiaStarfieldLayer?.getStats() || null };
  },
  /** Ajuste le budget RAM du catalogue Gaia ; les secteurs LRU non visibles sont évincés. */
  setGaiaCatalogMemoryBudget(options = {}) {
    if (!this.galacticCatalogResidency || this.stopped) throw new Error('Gestionnaire mémoire Gaia indisponible.');
    return this.galacticCatalogResidency.setBudget(options);
  },
  /** Ajuste le LOD GPU Gaia sans recharger le catalogue. */
  setGaiaRenderBudget(options = {}) {
    if (!this.gaiaStarfieldLayer || this.stopped) throw new Error('Rendu Gaia indisponible.');
    return this.gaiaStarfieldLayer.setRenderBudget(options);
  },
  cancelGaiaDR3Streaming() { this.gaiaSectorStreamer?.cancelAll('Chargement Gaia annulé par le moteur.'); },
  /** Résidence des secteurs galactiques autour de la caméra, en coordonnées ICRS parsecs. */
  updateGalacticSectorStreaming(globalCamera) {
    if (!this.galacticSectorStreaming || !this.interstellarConfig?.parsecToSceneUnits) return null;
    this.galacticStreamingFrame += 1;
    if (this.galacticStreamingFrame % 12 !== 0) return this.galacticStreamingLastResult;
    const scale = this.interstellarConfig.parsecToSceneUnits;
    // Convertit les axes de scène Gobai (x,z,-y) vers le repère ICRS (x,y,z).
    const centerPc = { x: globalCamera.x / scale, y: -globalCamera.z / scale, z: globalCamera.y / scale };
    const result = this.galacticSectorStreaming.update(centerPc);
    this.gaiaStarfieldLayer?.setResidentIds(result.visibleIds);
    if (this.galacticSectorScheduler?.enabled) {
      const distance = Math.hypot(centerPc.x, centerPc.y, centerPc.z);
      if (distance > 1e-6) {
        const raDeg = (Math.atan2(centerPc.y, centerPc.x) / (Math.PI / 180) + 360) % 360;
        const decDeg = Math.asin(Math.max(-1, Math.min(1, centerPc.z / distance))) / (Math.PI / 180);
        this.galacticSectorScheduler.updateView({ raDeg, decDeg, radiusDeg: this.gaiaAutoStreamingRadiusDeg || 1 });
      }
    }
    for (const [id, entry] of this.interstellarSystems || []) {
      const profile = this.coreSystemManager?.getLoadProfile(id);
      entry.group.visible = Boolean(profile?.render && this.galacticSectorStreaming.isResident(id));
      entry.group.userData.galacticSectorResident = this.galacticSectorStreaming.isResident(id);
    }
    this.galacticStreamingLastResult = result;
    return result;
  },
  getInterstellarSystems() {
    return [...(this.interstellarSystems?.entries?.() || [])].map(([id, entry]) => ({
      id, name: entry.model.name, distancePc: entry.model.distancePc,
      distanceLightYears: entry.model.distanceLightYears,
      state: this.getCoreEffectiveState(id), focusIndex: entry.focusIndex,
    }));
  },
  // Recentre les groupes stellaires globaux sur la même origine flottante que le Système solaire.
  updateInterstellarSceneOrigins() {
    const scale = this.interstellarConfig?.parsecToSceneUnits || 1;
    this.gaiaStarfieldLayer?.updateOrigin({ x: this.target.x / scale, y: -this.target.z / scale, z: this.target.y / scale });
    for (const entry of this.interstellarSystems?.values?.() || []) {
      const p = entry.model.position;
      entry.group.position.set(p.x - this.target.x, p.y - this.target.y, p.z - this.target.z);
    }
  },
  // Calcule le LOD écran-space des systèmes distants et applique un budget de détails progressif.
  updateInterstellarLOD() {
    if (!this.interstellarLOD || !this.interstellarSystems?.size || !this.cam) return null;
    this.interstellarLODFrame += 1;
    if (this.interstellarLODFrame % 6 !== 0) return this.interstellarLODLastResult || null;
    const viewportHeight = this.renderer?.domElement?.clientHeight || this.renderer?.domElement?.height || 0;
    if (!viewportHeight) return null;
    const focused = [...this.interstellarSystems.entries()].find(([, entry]) => entry.focusIndex === this.focus)?.[0] || null;
    const result = this.interstellarLOD.evaluate([...this.interstellarSystems.values()], {
      cameraPosition: this.cam.position, viewportHeight, fovDeg: this.cam.fov || 50, focusedId: focused,
    });
    for (const decision of result.decisions) {
      const entry = this.interstellarSystems.get(decision.id);
      if (!entry) continue;
      this.interstellarRenderer?.setSystemLOD(entry.starSystem.id, decision.tier);
      entry.group.userData.lodTier = decision.tier;
      entry.group.userData.projectedDiameterPx = decision.projectedDiameterPx;
    }
    this.interstellarLODLastResult = result;
    return result;
  },
  // Met à jour les positions orbitales uniquement pour le système ACTIF, au maximum une fois par seconde.
  updateInterstellarEphemerides(now = performance.now()) {
    if (now - (this.interstellarLastEphemerisAt || 0) < 1000) return;
    this.interstellarLastEphemerisAt = now;
    const julianDate = this.simMs / 864e5 + 2440587.5;
    for (const [id, entry] of this.interstellarSystems || []) {
      if (this.getCoreEffectiveState(id) !== 'ACTIVE') continue;
      entry.group.userData.updateLocalScene?.(entry.starSystem, { targetJulianDate: julianDate });
      this.interstellarRenderer?.setSystemLOD(entry.starSystem.id, entry.group.userData.lodTier || 'STAR');
    }
  },
  // Crée un atlas couleur par astre pilote et le relie au budget GPU central.
  initSurfaceAtlasPipelines() {
    if (!this.coreGpuMemoryBudget || typeof document === 'undefined') return;
    for (const bodyId of ['earth', 'moon']) {
      const tiled = this.tiledById?.[bodyId];
      if (!tiled?.tiles) continue;
      let atlas = null; let bridge = null; let pipeline = null; let unregisterBridge = null;
      try {
        const channel = createSatelliteCanvasAtlasChannel(THREE, {
          documentRef: document,
          anisotropy: Math.min(4, this.renderer?.capabilities?.getMaxAnisotropy?.() || 1),
        });
        atlas = new SatelliteMultiLayerTextureAtlasManager({
          pageSize: 2048, gutter: 4, maxPages: 4, channels: { color: channel },
          // Erreur de l'atlas : ignorée en silence (aucun log en console).
          onError: () => {},
        });
        bridge = new SatelliteAtlasGpuBudgetBridge({
          atlas, budgetManager: this.getSurfaceGpuBudgetManager(),
          bytesPerPage: (info) => Math.ceil(info.pageSize * info.pageSize * 4 * info.channelCount * (4 / 3)),
          resourceIdPrefix: `surface-atlas-${bodyId}`, priority: 0,
          // Erreur du budget de l'atlas : ignorée en silence (aucun log en console).
          onError: () => {},
        });
        unregisterBridge = this.registerSurfaceAtlasBudgetBridge(bridge);
        pipeline = new SatelliteTileAtlasPipeline({
          atlas, memoryBudgetBridge: bridge, bodyId, diagnostics: this.surfaceAtlasDiagnostics, maxItemsPerInstall: 1, mode: this.surfaceAtlasMode,
          // Erreur du pipeline de l'atlas : ignorée en silence (aucun log en console).
          onError: () => {},
        });
        tiled.tiles.setSurfaceAtlasPipeline(pipeline);
        this.surfaceAtlasRuntimes.set(bodyId, { atlas, bridge, pipeline });
      } catch (error) {
        try { tiled.tiles.setSurfaceAtlasPipeline(null); } catch {}
        try { pipeline?.dispose(); } catch {}
        try { unregisterBridge?.(); } catch { bridge?.dispose(); }
        try { atlas?.dispose(); } catch {}
        // Une indisponibilité Canvas/WebGL ne bloque jamais le chargement historique : repli classique, sans message.
      }
    }
  },
  // Libère les pipelines et les atlas après les TileManager qui relâchent leurs tuiles.
  disposeSurfaceAtlasPipelines() {
    for (const runtime of this.surfaceAtlasRuntimes?.values?.() || []) {
      runtime.pipeline.dispose();
      runtime.atlas.dispose();
    }
    this.surfaceAtlasRuntimes?.clear();
  },
  // Actualise les centres mobiles après le calcul des éphémérides et le placement de la caméra.
  updateCoreOrchestration() {
    if (!this.coreSystemManager || !this.cam) return;
    this.coreActivityPolicy?.beginFrame();
    this.coreEngineActivityPolicy?.beginFrame();
    // Les décisions de chargement (actif, arrière-plan, déchargé) changent lentement : elles sont réévaluées une
    // image sur CORE_DECISION_EVERY, au lieu de chaque image. Les bulles et les toupies affichées, elles, suivent
    // leur astre à chaque image.
    this.coreDecisionFrame = (this.coreDecisionFrame || 0) + 1;
    const decide = !this.coreLastDecisions || this.coreDecisionFrame % CORE_DECISION_EVERY === 0;
    const spheresShown = this.perivolumeSpheres?.displayAlpha > 0;
    // Tableau de travail réutilisé : plus de tableau neuf par astre et par image.
    const c = this.coreCenterScratch || (this.coreCenterScratch = [0, 0, 0]);
    if (decide || spheresShown) {
      for (const { id, target } of this.coreTargets) {
        const position = target.get();
        if (!position) continue;
        c[0] = position.x; c[1] = position.y; c[2] = position.z;
        if (decide) this.corePerivolumes.updateCenter(id, c);
        // Le périvolume dessiné de l'astre suit sa position, seulement quand l'affichage Schwarzschild le montre.
        if (spheresShown) this.perivolumeSpheres.updateCenter(id, c);
      }
    }
    // Chaque toupie suit son astre, quand elle est affichée.
    if (this.systemWellsOn) {
      const cam = this.cam.position;
      for (const system of this.systemWells) {
        // Toupie trop petite à l'écran (moins de 1/400 de sa distance à la caméra) : ni placée ni dessinée.
        const p = system.target.get();
        const distance = Math.hypot(p.x - this.target.x - cam.x, p.y - this.target.y - cam.y, p.z - this.target.z - cam.z);
        system.well.visible = !this.isTargetHidden(system.target) && system.radius * WELL_MIN_APPARENT > distance;
        if (system.well.visible) this.placeSystemWell(system);
      }
    }
    for (const { id, target } of this.coreSystemVolumes || []) {
      const position = target.get();
      if (!position) continue;
      c[0] = position.x; c[1] = position.y; c[2] = position.z;
      if (decide) this.corePerivolumes.updateCenter(id, c);
      // La bulle de verre suit le système.
      this.perivolumeSpheres?.updateCenter(id, c);
    }
    const globalCamera = globalCameraPosition(this.cam.position, this.target);
    if (decide) {
      this.coreLastDecisions = this.coreSystemManager.update([globalCamera.x, globalCamera.y, globalCamera.z]);
      // Applique les états effectifs aux bulles de verre des périvolumes.
      this.perivolumeSpheres?.sync(this.coreLastDecisions);
      for (const [id, entry] of this.interstellarSystems || []) {
        const profile = this.coreSystemManager.getLoadProfile(id);
        this.interstellarResourceLifecycle?.update(id, profile.state);
        // Visible s'il doit être rendu ET s'il est dans un secteur galactique chargé (voir
        // updateGalacticSectorStreaming) : sans ce second test, la visibilité décidée par le streaming était
        // écrasée à chaque image.
        entry.group.visible = Boolean(profile.render) && entry.group.userData.galacticSectorResident !== false;
        entry.group.userData.perivolumeState = profile.state;
        entry.group.userData.simulationPaused = !profile.update;
        entry.group.userData.perivolumePriority = profile.priority;
      }
    }
    this.updateGalacticSectorStreaming(globalCamera);
    this.updateInterstellarEphemerides();
    this.updateInterstellarLOD();
    if (decide) this.coreGpuMemoryBudget?.updatePerivolumeDecisions(this.coreLastDecisions);
    // L’ordonnanceur est raccordé, mais aucune tâche physique ou visuelle critique n’est déplacée dans ce lot.
    this.coreScheduler.flush();
  },
  // État effectif après application des axiomes, et non le seul état géométrique brut.
  getCoreEffectiveState(id) {
    return this.coreSystemManager?.getLoadProfile(id)?.state ?? this.corePerivolumes?.getState(id) ?? 'ACTIVE';
  },
  // Enregistre un système externe déjà placé dans le repère global de la scène.
  // Le moteur orbital local ne doit pas être utilisé comme position globale sans transformation ICRS dédiée.
  registerExternalSystemPerivolume({ id, center, radius, backgroundRadius = radius * 3, name = id } = {}) {
    if (!id || id === 'system:earth' || id === 'system:solar') throw new TypeError('Un identifiant de système externe distinct est requis.');
    this.coreRegistry?.upsert({ id, name, kind: 'system', level: 'system', external: true });
    const entry = this.corePerivolumes?.register({ id, center, radius, backgroundRadius, metadata: { level: 'system', external: true } });
    // Ajoute la bulle de verre du système externe.
    this.perivolumeSpheres?.register({ id, center, radius, backgroundRadius });
    this.coreExternalSystemIds ||= new Set();
    this.coreExternalSystemIds.add(id);
    return entry;
  },
  updateExternalSystemPerivolume(id, center) {
    if (!this.coreExternalSystemIds?.has(id)) return false;
    // Déplace la bulle de verre avec le système.
    this.perivolumeSpheres?.updateCenter(id, center);
    return this.corePerivolumes?.updateCenter(id, center) ?? false;
  },
  unregisterExternalSystemPerivolume(id) {
    if (!this.coreExternalSystemIds?.delete(id)) return false;
    this.coreRegistry?.remove(id);
    this.coreSystemManager?.unregister(id);
    // Retire la bulle de verre du système.
    this.perivolumeSpheres?.unregister(id);
    return this.corePerivolumes?.unregister(id) ?? false;
  },
  // Vérifie si un moteur spécialisé doit travailler selon le périvolume effectif de son astre.
  shouldUpdateCoreEngine(engine, bodyId) {
    const state = this.getCoreEffectiveState(bodyId);
    // Indice de focus de chaque astre, construit une fois (au lieu d'un parcours de tous les astres à chaque appel,
    // plusieurs fois par image).
    if (this.coreFocusIndexFor !== this.coreTargets) {
      this.coreFocusIndexById = new Map((this.coreTargets || []).map(({ id, focusIndex }) => [id, focusIndex]));
      this.coreFocusIndexFor = this.coreTargets;
    }
    const focused = this.coreFocusIndexById.get(bodyId) === this.focus;
    return this.coreEngineActivityPolicy?.shouldUpdate(engine, { state, focused }) ?? true;
  },
  // Expose le gestionnaire central aux pipelines de surface explicitement activés.
  getSurfaceGpuBudgetManager() {
    return this.coreGpuMemoryBudget?.budgetManager ?? null;
  },
  // Enregistre un bridge d’atlas : le moteur en prend en charge le cycle de vie.
  registerSurfaceAtlasBudgetBridge(bridge) {
    if (!this.coreGpuMemoryBudget) throw new Error('Le budget GPU central n’est pas initialisé.');
    return this.coreGpuMemoryBudget.registerBridge(bridge);
  },
  setSurfaceGpuGlobalBudget(bytes) {
    if (!this.coreGpuMemoryBudget) throw new Error('Le budget GPU central n’est pas initialisé.');
    return this.coreGpuMemoryBudget.setGlobalBudget(bytes);
  },
  setSurfaceGpuBodyBudget(bodyId, bytes) {
    if (!this.coreGpuMemoryBudget) throw new Error('Le budget GPU central n’est pas initialisé.');
    return this.coreGpuMemoryBudget.setBodyBudget(bodyId, bytes);
  },
  /** Bascule le rendu des surfaces raccordées sans reconstruire les TileLayer ni recharger les images. */
  setSurfaceAtlasMode(mode, bodyId = null) {
    if (!['atlas', 'classic'].includes(mode)) throw new TypeError('mode doit être atlas ou classic.');
    const runtimes = this.surfaceAtlasRuntimes || new Map();
    if (bodyId !== null && !runtimes.has(bodyId)) return { ok: false, reason: 'unknown-body', bodyId };
    const selected = bodyId === null ? [...runtimes.entries()] : [[bodyId, runtimes.get(bodyId)]];
    const results = {};
    for (const [id, runtime] of selected) results[id] = runtime.pipeline.setMode(mode);
    const modes = [...runtimes.values()].map((runtime) => runtime.pipeline.getMode());
    this.surfaceAtlasMode = modes.length && modes.every((value) => value === modes[0]) ? modes[0] : 'mixed';
    return { ok: true, mode: this.surfaceAtlasMode, bodies: results };
  },
  /** Crée un banc A/B navigateur avec capture du canvas WebGL et cadrage orbital gelé. */
  createSurfaceAtlasVisualValidation({ scenarios, limits, boundaryProvider, waitUntilReady, frameCount = 3 } = {}) {
    if (!this.surfaceAtlasRuntimes?.size) throw new Error('Aucun pipeline Atlas n’est disponible pour la validation.');
    const adapter = new SatelliteAtlasBrowserValidationAdapter(this, { waitUntilReady, frameCount });
    const runner = adapter.createRunner({ scenarios, limits, boundaryProvider });
    this.surfaceAtlasBrowserValidation = { adapter, runner };
    return {
      runner,
      run: () => runner.run(),
      buildHtmlReport: (report) => adapter.buildHtmlReport(report),
      getCaptures: () => new Map(adapter.captures),
    };
  },
  /** Remet à zéro la fenêtre de mesures A/B sans effacer les diagnostics des tuiles. */
  resetSurfaceAtlasBenchmark() {
    return this.surfaceAtlasDiagnostics?.clearFrameSamples() ?? 0;
  },
  /** Compare les fenêtres échantillonnées en mode classique et en mode atlas. */
  getSurfaceAtlasComparison() {
    return this.surfaceAtlasDiagnostics?.compareModes('classic-reference', 'atlas-active') ?? null;
  },
  // Snapshot de diagnostic en lecture seule pour les futurs outils de supervision.
  getCoreDiagnostics() {
    return {
      registeredBodies: this.coreRegistry?.size ?? 0,
      states: this.coreLastDecisions.map(({ id, state, distance, changed }) => ({ id, state, distance, changed })),
      transitions: [...(this.coreTransitions ?? [])],
      queuedTasks: this.coreScheduler?.size ?? 0,
      managedResources: this.coreResources?.size ?? 0,
      specializedEngineCadence: { atmosphere: this.coreEngineActivityPolicy?.getCadence('atmosphere') ?? null, lidar: this.coreEngineActivityPolicy?.getCadence('lidar') ?? null },
      renderBudget: this.coreRenderBudgetPolicy?.snapshot() ?? null,
      renderPipeline: this.coreRenderDiagnosticsPolicy?.snapshot() ?? null,
      gpuMemoryBudget: this.coreGpuMemoryBudget?.getDiagnostics() ?? null,
      surfaceAtlasMode: this.surfaceAtlasMode ?? 'unavailable',
      surfaceAtlas: Object.fromEntries([...(this.surfaceAtlasRuntimes || new Map())].map(([id, runtime]) => [id, { mode: runtime.pipeline.getMode(), ...runtime.atlas.getMemoryStats(), bridge: runtime.bridge.getStats() }])),
      surfaceAtlasComparison: this.getSurfaceAtlasComparison?.() ?? null,
      surfaceAtlasValidation: this.surfaceAtlasDiagnostics?.snapshot() ?? null,
      tileMemory: (this.tiledBodies ?? []).map((tb) => ({ id: tb.id, gpu: tb.tiles.base?.layer?.cache?.size ?? 0, gpuCapacity: tb.tiles.base?.layer?.cache?.capacity ?? 0, ram: tb.tiles.base?.layer?.ram?.size ?? 0, ramCapacity: tb.tiles.base?.layer?.ram?.capacity ?? 0 })),
    };
  },
  // initLabels : prépare les étiquettes et les repères (début).
  initLabels() {
    // Les étiquettes reçues.
    const L = this.labels;
    // surfaceItem : la fiche d'une étiquette posée sur un astre (début) :
    const surfaceItem = (el, name, lon, lat) => ({
      // son élément, son nom, ses coordonnées, sa direction et son état à l'écran.
      el, name, lon, lat, lv: lonLatToVec([lon, lat]), ok: false, x: 0, y: 0, w: 0,
    // Fin de surfaceItem.
    });
    // Fiches des villes.
    this.cityItems = this.data.cities.map((c, i) => surfaceItem(L.cities[i], c.name, c.lon, c.lat));
    // Repères des astres : un anneau de la couleur de l'astre posé à son emplacement, et son nom dans une étiquette.
    // Ils servent seulement à situer les astres trop petits pour être vus ; dès qu'un astre fait quelques pixels,
    // son repère s'efface en fondu. Placement et chevauchements : voir labelLayout.jsx ; style : SceneStyles.jsx.
    const { sun, moon } = this.data.bodies;
    // Parent des repères : celui du conteneur, ou la page.
    const parent = this.container.parentNode || document.body;
    // marker : l'élément d'un repère, sa famille (« planet » ou « satellite ») (début).
    const marker = (existing, name, color, kind = 'planet') => {
      // Déjà fourni : c'est lui.
      if (existing) return existing;
      // Sinon : crée un div.
      const el = document.createElement('div');
      // Sa classe, et celle de sa famille pour un satellite (repère plus discret).
      el.className = kind === 'satellite' ? 'l body-marker is-satellite' : 'l body-marker';
      // L'anneau de couleur.
      const dot = document.createElement('span');
      // Sa classe.
      dot.className = 'bm-dot';
      // Le nom.
      const label = document.createElement('span');
      // Sa classe.
      label.className = 'bm-name';
      // Son texte.
      label.textContent = name;
      // Les deux, dans l'ordre : anneau puis nom.
      el.append(dot, label);
      // Garde le nom, pour mesurer sa largeur (voir labelLayout.jsx).
      el._name = label;
      // Couleur de l'astre.
      el.style.setProperty('--c', color);
      // Sa lueur : la même couleur, translucide.
      el.style.setProperty('--cg', rgbaOf(color, 0.55));
      // Le repère est toujours dans la page ; caché par opacité, pour apparaître et disparaître en fondu.
      el._shown = false;
      // L'ajoute au parent.
      parent.appendChild(el);
      // Le note parmi les repères créés.
      this.markerEls.push(el);
      // Le renvoie.
      return el;
    // Fin de marker.
    };
    // Repères créés ici.
    this.markerEls = [];
    // Repères des astres (début) :
    this.bodyLabels = [
      // le Soleil ;
      { el: marker(L.sun, sun.name, sun.color || '#ffb300'), name: sun.name, pos: this.sunMesh.position, radius: sun.radius, kind: 'planet' },
      // chaque planète (début) :
      ...this.planets.map((p, i) => ({
        // son repère, son nom, sa position, son rayon et sa famille ;
        el: marker(L.planets[i], p.def.name, p.def.color || '#8b97b3'), name: p.def.name, pos: p.group.position, radius: p.def.radius, kind: 'planet',
        // masquée ou non ;
        isHidden: () => p.hidden,
      // fin de la planète ;
      })),
      // la Lune ;
      { el: marker(null, moon.name, '#d8d2c4', 'satellite'), name: moon.name, pos: this.moonGroup.position, radius: moon.radius, kind: 'satellite', isHidden: () => this.moonHidden },
      // chaque satellite (début) :
      ...this.satellites.list.map((sat) => ({
        // son repère, son nom, sa position, son rayon et sa famille ;
        el: marker(null, sat.def.name, sat.def.color || '#d8d2c4', 'satellite'), name: sat.def.name, pos: sat.group.position, radius: sat.def.radius, kind: 'satellite',
        // masqué ou non ;
        isHidden: () => Boolean(sat.hidden || sat.lodHidden),
      // fin du satellite.
      })),
    // Fin des repères.
    ];
    // Lanceur de rayons, pour les clics.
    this.raycaster = new THREE.Raycaster();
    // Position du pointeur.
    this.pointer = new THREE.Vector2();
  // Fin de initLabels.
  },
// Fin des méthodes.
};
