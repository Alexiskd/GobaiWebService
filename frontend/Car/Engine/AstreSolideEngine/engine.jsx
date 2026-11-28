
import * as THREE from 'three';
import { LidarGlobe } from './LidarEngine/lidarGlobe.jsx';
import { bindInput } from './InputEngine/input.jsx';
import { WorldLabels } from './LabelEngine/worldLabels.jsx';
import { CityCard } from './LabelEngine/cityCard.jsx';
import { CountryLabels } from './LabelEngine/countryLabels.jsx';
import { UserMarker } from './InputEngine/userMarker.jsx';
import { AstreSolideGlobe } from '../../engines/astre-solide/index.js';
import { renderLoop } from '../SystemeEngine/core/render/RenderLoop.js';
import { SharedResourcePool } from '../SystemeEngine/core/system/SharedResourcePool.js';
import { VIEW_DISTANCE, START_DISTANCE } from './engine/constants.jsx';
import { installMethods } from './engine/install.jsx';
import { setupMethods } from './engine/setup.jsx';
import { commandMethods } from './engine/commands.jsx';
import { compassMethods } from './engine/compass.jsx';
import { liveMoonMethods } from './engine/liveMoon.jsx';
import { tiledBodyMethods } from './engine/tiledBodies.jsx';
import { loopMethods } from './engine/loop.jsx';

export class SolarEngine {
  // Constructeur : le conteneur, les données, les étiquettes, le HUD, l'API des tuiles et les deux fonctions de changement (début).
  constructor({ container, data, labels, hud, tilesApi, onFocusChange, onTilesChange, embed }) {
    // Garde le conteneur.
    this.container = container;
    // Garde les données.
    this.data = data;
    // Garde les étiquettes.
    this.labels = labels;
    // Garde le HUD.
    this.hud = hud;
    // Garde la fonction de changement de cible, ou une fonction vide.
    this.onFocusChange = onFocusChange || (() => {});
    // Garde l'API des tuiles.
    this.tilesApi = tilesApi;
    // Garde la fonction de changement des tuiles, ou une fonction vide.
    this.onTilesChange = onTilesChange || (() => {});
    // Mode embarqué : canevas alpha, espace transparent, ciel masqué (embed.html).
    this.embed = Boolean(embed);

    // Largeur de la fenêtre.
    this.W = innerWidth;
    // Hauteur de la fenêtre.
    this.H = innerHeight;
    // Moteur pas arrêté.
    this.stopped = false;

    // État de la caméra orbitale
    this.focus = 0;
    // Point visé.
    this.target = new THREE.Vector3();
    // Point visé au début d'une transition.
    this.targetStart = new THREE.Vector3();
    // Transition terminée.
    this.focusT = 1;                 // progression de la transition vers l'astre ciblé
    // Azimut de la caméra.
    this.az = 0.8;
    // Élévation de la caméra.
    this.el = 0.8;
    // Distance de la caméra.
    this.dist = VIEW_DISTANCE;
    // Distance voulue.
    this.distGoal = VIEW_DISTANCE;
    // Coordonnées GPS des coins affichées.
    this.gpsOn = true;               // coordonnées GPS des coins de l'écran (Terre)
    // Matrice inverse pour ces coordonnées.
    this.gpsInv = new THREE.Matrix4();
    // Marges de la zone utile.
    this.gpsInsets = { top: 0, right: 0, bottom: 0, left: 0 }; // zone utile (px CSS), voir setGpsInsets
    // Pas de glissement en cours.
    this.drag = false;
    // Aucune flèche enfoncée.
    this.keyRotate = { left: false, right: false, up: false, down: false };
    // Rotation automatique active.
    this.autoRotate = true;
    // Multiplicateur de la rotation automatique : 1.
    this.rotateSpeed = 1; // multiplicateur de la rotation automatique (Paramètres) : 1 = vitesse d'origine
    // Signes infini : amplitude et temps à zéro.
    this.infinityAmp = 0; this.infinityT = 0; // signes infini de la trajectoire (enveloppe 0..1, temps en s)
    // Quaternion et vecteur de travail pour la vue du globe.
    this.globeQ = new THREE.Quaternion(); this.globeV = new THREE.Vector3();
    // Inclinaison pilotée : aucune.
    this.pilotTilt = null; // inclinaison pilotée depuis la navball (radians) ; null = vue 3/4 automatique
    // Nord non verrouillé.
    this.northLock = false; // boussole verrouillée : nord en haut de l'écran en permanence (setNorthLock)
    // Rotation propre de l'astre à l'image précédente : inconnue.
    this.spinRef = null; // rotation propre de l'astre ciblé à l'image précédente (followSpin)
    // Vecteur de travail : axe de rotation.
    this.spinAxis = new THREE.Vector3();
    // Vecteur de travail : direction.
    this.spinDir = new THREE.Vector3();
    // Quaternion de travail.
    this.spinQ = new THREE.Quaternion();
    // Vecteurs de travail du rayon local.
    this.radN = new THREE.Vector3(); this.radAxis = new THREE.Vector3(); // rayon local (localRadius)
    // Orbites affichées.
    this.orbitsOn = true;            // lignes d'orbite des planètes et de la Lune
    // Familles d'astres masquées : aucune.
    this.hiddenKinds = new Set();    // familles d'astres masquées (Paramètres) : 'solid', 'gas', 'dwarf', 'satellite'
    // Lune non masquée (ni dans les Paramètres, ni hors du système affiché).
    this.moonHidden = false; this.moonSettingsHidden = false;
    // Astres masqués un par un : aucun.
    this.hiddenTargets = new Set();  // astres masqués un par un (Paramètres) : indices de focusTargets
    // Repères des astres affichés.
    this.bodyMarkersOn = true;       // points et noms du Soleil et des planètes
    // Repères des satellites masqués.
    this.satelliteMarkersOn = false; // points et noms des satellites naturels masqués au départ
    // Vue inclinée automatique active.
    this.tiltOn = true;              // vue 3/4 automatique à l'approche du sol
    // Vue verrouillée : aucune.
    this.viewLock = null;            // vue verrouillée sur l'astre le plus proche de l'astre focus : { index, focus, saved }
    // Vecteur de travail : visée verrouillée.
    this.lockAim = new THREE.Vector3();
    // Vecteur de travail : position à l'écran.
    this.lockNdc = new THREE.Vector3();
    // Inclinaison en cours.
    this.tiltV = 0;
    // Point visé par la vue inclinée.
    this.tiltAim = new THREE.Vector3();
    // Haut de l'image de la vue inclinée.
    this.tiltUp = new THREE.Vector3(0, 1, 0);
    // Cap de la boussole : rotation de la vue autour de la verticale locale (0 = nord de scène en haut).
    this.heading = 0;
    // Cap voulu.
    this.headingGoal = 0;
    // Vecteur de travail : verticale locale.
    this.compassN = new THREE.Vector3();
    // Vecteur de travail : axe de l'astre.
    this.compassAxis = new THREE.Vector3();
    // Vecteur de travail : nord.
    this.compassNorth = new THREE.Vector3();
    // Vecteurs de travail de la navball : haut, axe et nord.
    this.navUp = new THREE.Vector3(); this.navAxis = new THREE.Vector3(); this.navNorth = new THREE.Vector3();
    // Est et sud.
    this.navEast = new THREE.Vector3(); this.navSouth = new THREE.Vector3();
    // Trois vecteurs de la caméra.
    this.navCam = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    // Vecteur de travail : droite.
    this.compassRight = new THREE.Vector3();
    // Ville suivie : aucune.
    this.lockCity = null;            // ville suivie quand la Terre est ciblée (les autres astres : entrée.lock)
    // Zoom d'arrivée : aucun.
    this.zoomFlight = null;          // zoom d'arrivée en cours ({ plan, t }), voir zoomFlight.jsx
    // Matrice inverse de la Lune.
    this.moonInv = new THREE.Matrix4();
    // Vecteur de travail : lieu suivi.
    this.lockN = new THREE.Vector3();

    // Temps simulé (temps réel pour l'instant : speed = 1)
    this.simMs = Date.now();
    // Vitesse du temps : 1.
    this.speed = 1;
    // Instant de la dernière image.
    this.lastNow = performance.now();
    // Instant de la dernière mise à jour du HUD.
    this.hudAt = 0;

    // Pool de géométries unitaires : partage uniquement les topologies strictement identiques.
    this.sharedGeometryPool = new SharedResourcePool();
    // Crée le moteur de rendu.
    this.initRenderer();
    // Crée le Soleil.
    this.initSun();
    // Crée les planètes.
    this.initPlanets();
    // Crée la présentation Schwarzschild : grille filaire de la courbure et rosettes des orbites.
    this.initSchwarzschild();
    // Crée la Lune.
    this.initMoon();
    // Crée les satellites.
    this.initSatellites();
    // Crée les tuiles.
    this.initTiles();
    // Crée les frontières.
    this.initBorders();
    // Nuages LiDAR calés par GPS.
    this.lidar = new LidarGlobe(this); // nuages LiDAR calés par GPS, sur la Terre
    // L'astre solide ciblé (la Terre par défaut) est dessiné par CesiumJS (engine astre-solide) ; de près, la scène
    // three.js attend.
    this.cesiumHold = false;
    // Le globe CesiumJS des astres solides : superposition et passage de près.
    this.solidGlobe = new AstreSolideGlobe(this);
    // Noms des pays posés à plat sur le globe, au milieu de chaque pays, visibles avant les villes.
    this.countryLabels = new CountryLabels({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Le maillage de la Terre.
      earthMesh: this.earth.mesh,
      // Le moteur de rendu.
      renderer: this.renderer,
    // Fin des noms des pays.
    });
    // Point bleu de la position de l'utilisateur (posé par « Ma position », voir setUserPosition).
    this.userMarker = new UserMarker({ parent: this.container.parentNode || document.body });
    // Fiche monochrome au survol d'une ville (population, aire urbaine, heure locale, soleil…).
    this.cityCard = new CityCard({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Lecture de l'instant simulé.
      getSimMs: () => this.simMs,
      // Hauteur du Soleil en un lieu.
      sunAltitude: (lon, lat) => this.sunAltitudeAt(lon, lat),
    // Fin de la fiche de ville.
    });
    // Noms des villes du monde entier (GET /places/labels), à côté du canvas. Ils n'apparaissent qu'en zoomant.
    this.worldLabels = new WorldLabels({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Au clic : va à la ville.
      onPick: (c) => this.goTo(c),
      // Par paliers.
      tiered: true,
      // Altitude d'apparition.
      revealAltitude: 1.9,
      // Altitude du fondu.
      fadeAltitude: 0.45,
      // Infobulle : la fiche de ville.
      tooltip: this.cityCard,
    // Fin des noms de villes.
    });
    // Crée la Lune en direct.
    this.initMoonLive();
    // Crée la liste des cibles.
    this.initFocusTargets();
    // Branche le Core central sur les positions réelles des cibles, sans changer le rendu existant.
    this.initCoreOrchestration();
    // Crée les étiquettes.
    this.initLabels();

    // Branche les entrées et garde la fonction de débranchement.
    this.removeInput = bindInput(this);
    // Au chargement, on démarre directement sur la Terre (pas de transition depuis la vue globale).
    this.setFocus(this.earthFocus);
    // Sans transition.
    this.focusT = 1;
    // À la distance de départ.
    this.dist = START_DISTANCE;
    // Distance voulue : la même.
    this.distGoal = START_DISTANCE;
    // Lie frame à l'instance.
    this.frame = this.frame.bind(this);
    // Enregistre le moteur comme variable de la boucle de rendu de l'application complète.
    renderLoop.register('astre-solide', this.frame);
    // En pause quand l'onglet est caché : la boucle de l'application gère l'arrêt des images.
    this.paused = false;
    // Scène non suspendue.
    this.suspended = false; // scène mise à l'arrêt par setSuspended
    // onVisibility : au changement de visibilité de l'onglet, le moteur note juste son état (début).
    this.onVisibility = () => {
      // Moteur arrêté : rien.
      if (this.stopped) return;
      // Onglet caché : en pause (la boucle de l'application cesse d'appeler frame).
      this.paused = document.hidden;
      // Onglet de retour : l'horloge repart de maintenant, sans saut de temps.
      if (!this.paused) {
        // L'horloge repart de maintenant.
        this.lastNow = performance.now();
        // Note l'activité.
        this.markActive();
      // Fin du choix.
      }
    // Fin de onVisibility.
    };
    // Écoute le changement de visibilité.
    document.addEventListener('visibilitychange', this.onVisibility);
  // Fin du constructeur.
  }

  // canvas : le canevas du moteur de rendu.
  get canvas() { return this.renderer.domElement; }
  // focusTarget : la cible en cours.
  focusTarget() { return this.focusTargets[this.focus]; }

  // ----------------------------------------------------------------- nettoyage

  // dispose : arrête le moteur et libère tout (début).
  dispose() {
    // Moteur arrêté.
    this.stopped = true;
    // Libère le globe CesiumJS des astres solides.
    this.solidGlobe?.dispose();
    // Couche d'atmosphère au-dessus du globe : moteur de rendu libéré, canevas retiré.
    if (this.atmoOverlay) { this.atmoOverlay.renderer.dispose(); this.atmoOverlay.canvas.remove(); this.atmoOverlay = null; }
    // Pollution lumineuse libérée.
    this.lightPollution?.dispose(); this.lightPollution = null;
    // Détruit les gestionnaires du Core (les ressources graphiques historiques restent libérées par leur propriétaire).
    this.coreScheduler?.clear();
    this.coreResources?.disposeAll();
    for (const controller of this.interstellarLoadControllers?.values?.() || []) controller.abort?.();
    this.interstellarLoadControllers?.clear();
    this.interstellarResourceLifecycle?.dispose();
    this.galacticSectorScheduler?.dispose();
    this.galacticSectorScheduler = null;
    this.galacticCatalogResidency?.dispose();
    this.galacticCatalogResidency = null;
    this.gaiaSectorStreamer?.dispose();
    this.gaiaStarfieldLayer?.dispose();
    this.gaiaLoadedStars?.clear();
    this.gaiaStarOwners?.clear();
    this.gaiaManualStarIds?.clear();
    this.interstellarRenderer?.dispose();
    this.interstellarSystems?.clear();
    this.interstellarLOD?.clear();
    this.galacticSectorStreaming?.dispose();
    this.galacticSectorStreaming = null;
    this.galacticSpatialIndex?.clear();
    this.galacticSpatialIndex = null;
    this.interstellarExplorer = null;
    this.interstellarCatalog = null;
    this.gaiaSectorStreamer = null;
    this.gaiaStarfieldLayer = null;
    this.corePerivolumes?.clear();
    // Retire toutes les bulles de verre des périverolumes.
    this.perivolumeSpheres?.clear();
    this.coreActivityPolicy?.reset();
    this.coreTileMemoryPolicy = null;
    this.coreEngineActivityPolicy?.reset();
    this.coreEngineActivityPolicy = null;
    this.coreRenderBudgetPolicy?.reset();
    this.coreRenderBudgetPolicy = null;
    this.coreRenderDiagnosticsPolicy?.reset();
    this.coreRenderDiagnosticsPolicy = null;
    this.coreRegistry?.clear();
    this.coreTargets = [];
    // Libère les toupies des astres.
    for (const { well } of this.systemWells || []) {
      well.geometry.dispose();
      well.parent?.remove(well);
    }
    this.systemWellMaterial?.dispose();
    this.systemWells = [];
    // Libère la grille filaire de la courbure, si elle a été posée.
    if (this.schwarzschild?.grid) {
      // Sa géométrie, puis son matériau, avant de la retirer de la scène.
      this.schwarzschild.grid.geometry.dispose();
      this.schwarzschild.grid.material.dispose();
      this.scene.remove(this.schwarzschild.grid);
      // Plus de grille.
      this.schwarzschild.grid = null;
    // Fin de ce cas.
    }
    // Libère les nuages LiDAR.
    this.lidar?.dispose();
    // Retire les repères créés.
    this.markerEls?.forEach((el) => el.remove());
    // Retire le moteur de la boucle de rendu de l'application.
    renderLoop.unregister('astre-solide');
    // Libère la sonde de performance.
    this.perfProbe?.dispose();
    // Libère le module de qualité du rendu.
    this.renderQualityModule?.dispose();
    // N'écoute plus la visibilité de l'onglet.
    document.removeEventListener('visibilitychange', this.onVisibility);
    // Débranche les entrées.
    this.removeInput();
    // Libère les tuiles avant le budget GPU : leurs pipelines peuvent encore relâcher des références atlas.
    for (const tb of this.tiledBodies) tb.tiles.dispose();
    this.disposeSurfaceAtlasPipelines();
    // Le budget détruit ensuite ses bridges et oublie leurs inscriptions sans détruire les atlas propriétaires.
    this.coreGpuMemoryBudget?.dispose();
    this.coreGpuMemoryBudget = null;
    this.surfaceAtlasDiagnostics?.dispose();
    this.surfaceAtlasDiagnostics = null;
    // Libère les noms des villes.
    this.worldLabels.dispose();
    // Libère le point de l'utilisateur.
    this.userMarker.dispose();
    // Libère les noms des pays.
    this.countryLabels.dispose();
    // Libère la fiche de ville.
    this.cityCard.dispose();
    // Libère les noms des lieux de la Lune.
    this.moonLabels.dispose();
    // Libère le tracé de l'orbite de la Lune.
    this.moonOrbitTrail.dispose();
    // Libère les sondes.
    this.orbiters.dispose();
    // Libère ShadowCam.
    this.shadowcam.dispose();
    // Libère le ciel.
    this.sky.dispose();
    // Libère les satellites.
    this.satellites.dispose();
    // Pour chaque objet de la scène (début).
    this.scene.traverse((o) => {
      // Libère sa géométrie.
      if (o.geometry && !o.geometry.userData?.__sharedResourcePool) o.geometry.dispose();
      // Ses matériaux, en liste.
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      // Pour chacun (début).
      mats.forEach((m) => {
        // Libère sa texture.
        if (m.map) m.map.dispose();
        // Libère le matériau.
        m.dispose();
      // Fin de la boucle.
      });
    // Fin du parcours.
    });
    // Libère chaque géométrie partagée une seule fois, après le parcours des meshes.
    this.sharedGeometryPool?.dispose();
    // Libère le moteur de rendu.
    this.renderer.dispose();
    // Son canevas.
    const cv = this.renderer.domElement;
    // Le retire de la page.
    if (cv.parentNode) cv.parentNode.removeChild(cv);
  // Fin de dispose.
  }
// Fin de la classe SolarEngine.
}

// Méthodes rangées par thème dans le dossier engine/ (construction, commandes, boussole, Lune en direct, astres
// tuilés, boucle) : installées sur la classe comme des méthodes ordinaires.
installMethods(SolarEngine, setupMethods, commandMethods, compassMethods, liveMoonMethods, tiledBodyMethods, loopMethods);
