/**
 * Méthodes du moteur SolarEngine (engine.jsx) : boucle de rendu.
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import * as THREE from 'three';
import { calculateOrbitPosition } from '../OrbitEngine/orbitCalculation.jsx';
import { hiddenByAny } from '../LabelEngine/labelOcclusion.jsx';
import { pixelScale } from '../BodyEngine/bodyLoading.jsx';
import { AU_UNITS, D, centuriesTT, lonLatToVec } from '../OrbitEngine/ephemeris.jsx';
import { MOON_KEPLER_ELEMENTS } from '../OrbitEngine/planetOrbits.jsx';
import { satelliteState, synchronousBasis } from '../SatelliteEngine/satelliteMath.jsx';
import { layoutLabels } from '../LabelEngine/labelLayout.jsx';
import { easeFactor } from '../InputEngine/zoomMath.jsx';
import { TILT_MAX_ANGLE, approachAngle, approachTilt, tiltEngagement, tiltPose } from '../CameraEngine/cameraTilt.jsx';
import { xyzToLonLat } from '../MapEngine/mercator.jsx';
import { borderLift } from '../LabelEngine/bordersGeometry.jsx';
import { moonState, orbiterMetrics } from '../MoonEngine/moonLive.jsx';
import { bodyId } from '../LabelEngine/bodyPlaces.jsx';
import { hillRadius, insideSystem, systemHostOf } from '../CameraEngine/systemView.jsx';
import { updateOrbitShared } from '../OrbitEngine/orbitRibbon.jsx';
import { loopTrailAlphas, nearestPointIndex } from '../OrbitEngine/orbitRibbonMath.jsx';
import { minAltitudeRadii } from '../BodyEngine/tiledBodies.jsx';
import { flightDistance } from '../CameraEngine/zoomFlight.jsx';
import { scaleLevel } from '../CameraEngine/scaleLevels.jsx';
import { EARTH_RADIUS_M } from '../InputEngine/gps.jsx';
import { tileRadius } from '../MapEngine/tiles/tileGeometry.jsx';
import { daySkyVeil, equatorialDegToScene, skyVisibility, sunGlare } from '../../StarEngine/SkyEngine/skyMath.jsx';
import { bodyMassKg, formatDistanceKm } from '../OrbitEngine/gravityMath.jsx';
import { interiorReadout } from '../../AstreGazeuxEngine/AtmosphereEngine/gasInteriorMath.jsx';
import { arrowSign, crossPole } from '../InputEngine/deviceCompassMath.jsx';
import { IDLE_AFTER_MS, normalizedFrameMs, paceFrame, targetFrameMs } from '../PerfEngine/powerSaver.jsx';
import { PerfProbe } from '../PerfEngine/perfProbe.jsx';
import { TAU, REGIONS_REPLACE_MS, UP_Y, EARTH_RADIUS_KM, HUD_DATE_FORMAT, HUD_INT_FORMAT, KEY_ROTATE_SPEED, EARTH_TILT, LIGHT_MINUTES_PER_AU, MOON_ORBIT_MAX_DIST, BORDERS_MIN_ALTITUDE, ZOOM_TAU_MS, FOCUS_RATE, AUTO_ROTATE_SPEED, POLE_LIMIT, INFINITY_AMPLITUDE, INFINITY_PERIOD_S, SPIN_LOCK_RADII, GAS_SPIN_LOCK_RADII, DPR_STEP, DPR_MIN, DPR_SLOW_MS, DPR_FAST_MS, DPR_RAISE_AFTER_MS, DPR_CHECK_MS, fmtAltitude, clamp, MOON_PHASES } from './constants.jsx';

// Méthodes : boucle de rendu.
export const loopMethods = {
  // ----------------------------------------------------------------- boucle

  // frame : une image (début).
  frame(now) {
    // Moteur arrêté, en pause (onglet caché) ou suspendu : rien.
    if (this.stopped || this.paused || this.suspended || this.cesiumHold) return;
    // Temps écoulé depuis la dernière image.
    const rawDt = now - this.lastNow;
    // 50 images par seconde au plus (20 au repos sur téléphone) : les rappels en trop sont sautés, rien n'est calculé
    // ni dessiné (voir paceFrame).
    if (!paceFrame(this.pacer || (this.pacer = { due: 0 }), now, this.frameMs)) {
      // Image sautée : la boucle de l'application demandera la suivante.
      return;
    // Fin de ce cas.
    }
    // Temps écoulé, borné à 100 ms.
    const dt = clamp(rawDt, 0, 100); // retour d'onglet : pas de saut
    // Compte les images par seconde.
    this.countFps(now);
    // Qualité du rendu : une image de plus dans la fenêtre d'une seconde (aucune allocation).
    this.renderQuality.recordFrame(now, rawDt);
    // Moniteur CPU / GPU (voir perfProbe.jsx) : créé à la première image, quand le moteur de rendu existe.
    const probe = this.perfProbe || (this.perfProbe = new PerfProbe(this.renderer.getContext()));
    // Début de la mesure de l'image.
    probe.frameStart(rawDt);
    // Recalcule la durée visée d'une image.
    this.refreshFrameMs(now);
    // Avance le fondu de l'ombre.
    this.updateShadeFade(dt);
    // Avance le fondu Schwarzschild (orbites en rosette et grille de courbure).
    this.updateSchwarzschildFade(dt);
    // La grille de courbure reste collée au Soleil, même une fois le fondu terminé (le `rebase` de l'origine
    // flottante la déplacerait sinon) : le Soleil reste exactement le centre de la représentation.
    const schwarzschildGrid = this.schwarzschild?.grid;
    if (schwarzschildGrid?.visible) schwarzschildGrid.position.copy(this.target).negate();
    // Note l'instant.
    this.lastNow = now;
    // Adapte la résolution.
    this.adaptResolution(rawDt, now);
    // Instant simulé : l'heure réelle à vitesse 1, sinon le temps accéléré.
    this.simMs = this.speed === 1 ? Date.now() : this.simMs + dt * this.speed;

    // Jour julien de l'instant simulé (UTC).
    const jd = this.simMs / 864e5 + 2440587.5;
    // Siècles depuis J2000, en Temps terrestre : c'est l'échelle des orbites, et elle avance de 69,184 s sur UTC.
    const T = centuriesTT(this.simMs);
    // Jours depuis J2000 : sert aux rotations propres, calées sur l'heure civile.
    const d = jd - 2451545;

    // Place les astres.
    this.updateBodies(T, d);
    // Place la caméra.
    this.updateCamera(dt);
    // Met à jour les périvolumes du Core après les positions orbitales et la caméra.
    this.updateCoreOrchestration();
    // Téléphone : entrée ou sortie du système d'une planète (qualité, rythme, astres affichés).
    this.updateSystemView();
    // Met à jour les directions du Soleil.
    this.updateSunDirections();
    // Met à jour les frontières.
    this.updateBorders();
    // Met à jour les nuages LiDAR.
    if (this.shouldUpdateCoreEngine('lidar', 'earth')) this.lidar.update(this.cam);
    // Astre solide visé par le globe CesiumJS ; ciblé et caméra proche : le globe prend la main au même endroit.
    this.updateSolidGlobe();
    // Couche de tuiles de la Terre affichée, s'il y a une carte.
    const groundLayer = this.tiles.active ? this.tiles.base?.layer : null;
    // Niveau du sol dessiné sous la caméra : celui de la cellule hexagonale la plus proche (les cellules sont posées au
    // rayon de leur niveau), sinon le niveau d'images le plus fin affiché.
    const groundLevel = groundLayer?.hex?.cells?.[0]?.level ?? groundLayer?.visibleZoom ?? 0;
    // Soulèvement du sol dessiné (m), sur une carte à plat.
    const groundLiftM = groundLayer ? (tileRadius(groundLevel, groundLayer.gap) - 1) * EARTH_RADIUS_M : 0;
    // Met à jour les noms des pays.
    if (this.shouldUpdateCoreEngine('earthLabels', 'earth')) this.countryLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    // Moteur de chargement planétaire : pixels par unité de scène à une unité de distance.
    const pxScale = pixelScale(this.H, this.cam.fov * D);
    // Satellites : dessinés seulement quand leur orbite se détache de leur planète à l'écran.
    this.updateSatelliteLod(pxScale);
    // Tuiles : l'astre ciblé, les plus grands à l'écran dans le champ, puis les autres chacun leur tour.
    const tiled = this.planTiles(pxScale);
    // Pour chaque astre tuilé (début).
    for (const tb of this.tiledBodies) {
      // Le Core cadence les tuiles éloignées. Un astre ciblé reste toujours prioritaire.
      const coreState = this.getCoreEffectiveState(tb.id);
      const focused = tb.focus === this.focus;
      const layer = tb.tiles.base?.layer;
      // Astre hors du périvolume de l'astre zoomé (voir applySystemView) : ses tuiles sont déchargées, GPU et RAM.
      const outsidePerivolume = !focused && Boolean(this.systemHost) && this.isTargetHidden(this.focusTargets[tb.focus]);
      if (layer && this.coreTileMemoryPolicy) {
        const state = focused ? 'ACTIVE' : coreState;
        const profile = outsidePerivolume
          ? { gpuCapacity: 1, ramCapacity: 0, preserveWanted: false }
          : this.coreTileMemoryPolicy.profile(state, {
            gpuBase: layer.baseCapacity,
            ramBase: layer.baseRamCapacity,
            wantedCount: layer.wantedKeys?.size ?? 0,
          });
        tb.tiles.setCoreMemoryProfile(profile);
      }
      // Astre solide dessiné par CesiumJS par-dessus three.js : ses tuiles three.js ne sont plus demandées (réseau et
      // carte graphique épargnés) ; celles déjà chargées restent pour le retour à l'astre de three.js.
      if (tiled.has(tb.id) && !(tb.id === this.solidGlobe?.bodyId && this.cesiumOverlayOn) && this.coreActivityPolicy.shouldUpdateTiles({ state: coreState, focused })) {
        tb.tiles.update();
      }
      // Le basculement modèle/tuiles reste évalué chaque image pour préserver la continuité visuelle.
      this.updateBodyModel(tb);
    // Fin de la boucle.
    }
    // Met à jour les mosaïques ShadowCam, si elles ont un accès aux images.
    if (this.shadowcam.api) this.shadowcam.update(this.cam);
    // Met à jour les étiquettes.
    this.updateLabels();
    // Met à jour le style des orbites : épaisseur à l'écran, orbite mise en avant, traînées.
    this.updateOrbitStyle(now);
    // Met à jour les noms des villes.
    if (this.shouldUpdateCoreEngine('earthLabels', 'earth')) this.worldLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    // Met à jour le point de l'utilisateur.
    if (this.shouldUpdateCoreEngine('earthLabels', 'earth')) this.userMarker.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh, hidden: Boolean(this.earth.hidden) });
    // Met à jour les noms des lieux de la Lune.
    if (this.shouldUpdateCoreEngine('moonLabels', 'moon')) this.moonLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.moonTiles.root });
    // Met à jour les sondes.
    this.orbiters.update({ t: this.simMs, moonPos: this.moonGroup.position, moonRadius: this.data.bodies.moon.radius, cam: this.cam, W: this.W, H: this.H });
    // Met à jour le HUD.
    this.updateHud(now);
    // Met à jour le ciel.
    this.updateSky();

    // Début de la mesure du rendu.
    probe.renderStart();
    // Astre solide visé en CesiumJS : la caméra du globe suit celle de three.js ; vrai si le globe dessine l'astre.
    const solidId = this.solidGlobe?.bodyId;
    // Vrai si le globe dessine l'astre à cette image.
    const bodyByCesium = solidId ? this.solidGlobe.overlayFrame(this.solidBodyView(solidId)) : false;
    // Efface l'image.
    this.renderer.clear();
    // Dessine le ciel lointain.
    this.sky.render(this.renderer, this.cam, dt);
    // Fondu d'apparition du globe (0 → 1) : tant qu'il n'est pas fini, l'astre de three.js reste dessiné dessous.
    const fadeIn = bodyByCesium ? (this.solidGlobe.fadeIn ?? 1) : 0;
    // L'astre de three.js caché le temps du rendu, si le globe le dessine entièrement.
    // (seulement si ses tuiles sont déjà arrivées : sinon l'astre de three.js reste visible, jamais d'écran vide).
    const restoreBody = bodyByCesium && fadeIn >= 1 && this.solidGlobe.bodyReady ? this.hideSolidBody(solidId) : null;
    // Dessine la scène par-dessus.
    this.renderer.render(this.scene, this.cam);
    // L'astre reprend son état.
    restoreBody?.();
    // Le globe dessine l'astre par-dessus l'image three.js, vu de la même caméra.
    if (bodyByCesium) this.solidGlobe.drawOverlay();
    // Atmosphère de l'astre (moteur d'atmosphère three.js) posée par-dessus le globe, ou couche masquée.
    this.renderAtmosphereOverlay(bodyByCesium ? solidId : null, this.cam, fadeIn);
    // Fin de la mesure du rendu.
    probe.renderEnd();
    // Fin de la mesure de l'image.
    const perf = probe.frameEnd(this.renderer.info);
    // Le budget cartographique suit les mesures CPU/GPU précédentes, sans modifier le contrôleur DPR existant.
    if (perf) {
      const frameMode = this.surfaceAtlasMode === 'classic' ? 'classic-reference' : this.surfaceAtlasMode === 'atlas' ? 'atlas-active' : 'mixed-scene-atlas-experimental';
      this.surfaceAtlasDiagnostics?.recordFrame({ perf, timestamp: now, mode: frameMode });
      this.coreRenderBudget = this.coreRenderBudgetPolicy?.update(perf) ?? this.coreRenderBudget;
      this.coreRenderDiagnostics = this.coreRenderDiagnosticsPolicy?.analyze({ ...perf, timestamp: now }) ?? this.coreRenderDiagnostics;
    }
    // Transmet les mesures au HUD, s'il y en a.
    if (perf) this.hud.set({ perf });
    // Qualité du rendu : garde la dernière sonde (appels de dessin, triangles, textures, géométries).
    if (perf) this.renderQuality.recordPerf(perf);
    // Et la mesure des tuiles de la Terre (mises en place, file, téléchargements), si sa couche existe.
    if (perf && this.tiles?.base?.layer) this.renderQuality.recordTiles(this.tiles.base.layer.qualityMetrics(now));
    // L'image suivante est demandée par la boucle de rendu de l'application.
  // Fin de frame.
  },
  /**
   * Compteur d'images par seconde (mesures de perf, voir perfProbe.jsx) : images réellement dessinées par le moteur, moyennées sur
   * une fenêtre glissante d'une seconde (voir FpsMeter, perfProbe.jsx). Les rappels sautés (rythme réduit sur
   * téléphone) ne comptent pas. Le HUD reçoit la moyenne, le rythme de l'image la plus lente et le rythme visé, et
   * n'est prévenu que lorsqu'une valeur change.
   */
  // countFps : compte les images par seconde (début).
  countFps(now) {
    // Enregistre l'image ; une mesure n'est renvoyée que si elle a changé.
    const measure = this.fpsMeter.tick(now);
    // Rythme visé : celui du plafond en cours (60 quand il n'y a pas de plafond).
    const fpsTarget = this.frameMs > 0 ? Math.round(1000 / this.frameMs) : 60;
    // Ni nouvelle mesure ni nouveau rythme visé : rien.
    if (!measure && fpsTarget === this.fpsTarget) return;
    // Garde les valeurs.
    if (measure) this.fps = measure.fps;
    // Garde le rythme visé.
    this.fpsTarget = fpsTarget;
    // Prévient le HUD.
    this.hud.set({ fps: this.fps, fpsLow: this.fpsMeter.low, fpsTarget });
  // Fin de countFps.
  },
  /**
   * Résolution adaptative : moyenne glissante de la durée des images. Trop lente → un cran de moins (le GPU traite
   * jusqu'à 2,25× moins de pixels avec le tampon de profondeur logarithmique, et les tuiles demandées suivent la
   * hauteur réelle en pixels) ; rapide pendant 4 s → un cran de plus, sauf si ce cran a déjà fait ralentir.
   */
  // adaptResolution : adapte la densité de pixels à la fluidité (début).
  adaptResolution(rawDt, now) {
    // Durée nulle ou supérieure à 250 ms : mesure ignorée.
    if (!(rawDt > 0) || rawDt > 250) return; // onglet caché, pause : mesure non significative
    // Durée ramenée à l'échelle « 60 images par seconde » : 20 ms entre deux images (50 par seconde) est le rythme visé.
    this.dprFrameMs += (normalizedFrameMs(rawDt, this.frameMs) - this.dprFrameMs) * 0.05;
    // Pas encore l'heure du contrôle : rien.
    if (now < this.dprCheckAt) return;
    // Prochain contrôle dans 1 seconde.
    this.dprCheckAt = now + DPR_CHECK_MS;
    // Durée moyenne d'une image.
    const avg = this.dprFrameMs;
    // Plancher : celui du profil, sans dépasser le plafond (1 en économie d'énergie).
    const floor = Math.min(this.dprMax, this.power.dprMin ?? DPR_MIN);
    // Trop lente, au-dessus du plancher (début).
    if (avg > DPR_SLOW_MS && this.dpr > floor) {
      // Ce cran est noté trop lourd.
      this.dprBlockedAbove = this.dpr;            // ce cran est trop lourd pour l'instant
      // Pendant 30 secondes.
      this.dprBlockUntil = now + 30000;
      // Descend d'un cran, sans passer sous le plancher.
      this.setResolution(Math.max(floor, this.dpr - DPR_STEP));
      // Plus de période rapide.
      this.dprFastSince = 0;
    // Rapide, sous le plafond (début).
    } else if (avg < DPR_FAST_MS && this.dpr < this.dprMax) {
      // Début de la période rapide.
      if (!this.dprFastSince) this.dprFastSince = now;
      // Cran suivant.
      const next = Math.min(this.dprMax, this.dpr + DPR_STEP);
      // Bloqué s'il a déjà fait ralentir récemment.
      const blocked = next >= this.dprBlockedAbove && now < this.dprBlockUntil;
      // Libre, et rapide depuis plus de 4 secondes (début).
      if (!blocked && now - this.dprFastSince > DPR_RAISE_AFTER_MS) {
        // Monte d'un cran.
        this.setResolution(next);
        // Nouvelle période.
        this.dprFastSince = 0;
      // Fin de ce cas.
      }
    // Sinon : plus de période rapide.
    } else this.dprFastSince = 0;
  // Fin de adaptResolution.
  },
  /**
   * Scène recouverte par l'écran de chargement : quelques images par seconde suffisent (compilation des shaders,
   * arrivée des tuiles). Dès qu'elle est visible, le moteur reprend le rythme de l'appareil.
   */
  // setCovered : note si l'écran de chargement recouvre la scène (début).
  setCovered(covered) {
    // Garde l'état.
    this.covered = Boolean(covered);
    // Note l'activité.
    this.markActive();
  // Fin de setCovered.
  },
  /**
   * Met la scène à l'arrêt : frame() ne fait plus rien (aucun calcul, aucun dessin).
   * Relancée avec setSuspended(false), sans saut de temps.
   */
  // setSuspended : met la scène à l'arrêt, ou la relance (début).
  setSuspended(on) {
    // État demandé.
    const next = Boolean(on);
    // Moteur arrêté, ou même état : rien.
    if (this.stopped || next === this.suspended) return;
    // Le garde.
    this.suspended = next;
    // À l'arrêt, ou onglet en pause : rien de plus.
    if (next || this.paused) return;
    // L'horloge repart de maintenant.
    this.lastNow = performance.now();
    // Note l'activité.
    this.markActive();
  // Fin de setSuspended.
  },
  /**
   * Mode économie d'énergie (Paramètres) : 20 images par seconde et densité de pixels 1, sur tous les appareils.
   */
  // setPowerSaving : active ou coupe l'économie d'énergie (début).
  setPowerSaving(on) {
    // Garde l'état.
    this.saving = Boolean(on);
    // Plafond de densité : 1 en économie, sinon celui d'origine.
    this.dprMax = this.saving ? Math.min(1, this.dprMaxFull) : this.dprMaxFull;
    // Au-dessus du plafond : la résolution descend.
    if (this.dpr > this.dprMax) this.setResolution(this.dprMax);
    // Note l'activité.
    this.markActive();
  // Fin de setPowerSaving.
  },
  /**
   * Tous les appareils : la caméra est-elle dans le système de la planète ciblée (sa sphère de Hill, voir systemView.jsx) ?
   * Dedans, les astres hors de ce périvolume ne sont plus chargés ni dessinés. Le Soleil n'a pas de système.
   * À l'entrée ou à la sortie : applySystemView.
   */
  // updateSystemView : suit l'entrée et la sortie du système d'une planète (début).
  updateSystemView() {
    // Planète du système de la cible (aucune pour le Soleil).
    const host = systemHostOf(this.focusTarget(), this.earth);
    // Rayon de son système : sa sphère de Hill, d'après sa distance au Soleil et sa masse.
    const radius = host ? hillRadius(host.group.position.distanceTo(this.sunMesh.position), bodyMassKg(bodyId(host.def), host.def.radius * EARTH_RADIUS_KM)) : 0;
    // Caméra dedans (marge de sortie si elle y était déjà) : ce système ; sinon aucun.
    const next = host && insideSystem(this.cam.position.distanceTo(host.group.position), radius, host === this.systemHost) ? host : null;
    // Changement : l'applique.
    if (next !== this.systemHost) this.applySystemView(next);
    // Profil de rendu : suit le système affiché, et l'économie d'énergie qui peut changer à tout moment.
    this.syncSystemProfile();
  // Fin de updateSystemView.
  },
  /** Profil de rendu : rythme maximal dans un système sur téléphone (hors économie d'énergie), sinon celui de l'appareil. */
  // syncSystemProfile : accorde le profil de rendu au système affiché (début).
  syncSystemProfile() {
    // Rythme maximal seulement sur téléphone, dans un système, hors économie d'énergie.
    const want = this.systemHost && this.basePower.handheld && !this.saving ? this.systemPower : this.basePower;
    // Déjà le bon : rien à faire.
    if (this.power === want) return;
    // Change de profil.
    this.power = want;
    // Rythme d'images du nouveau profil.
    this.refreshFrameMs(performance.now());
  // Fin de syncSystemProfile.
  },
  /**
   * Entre dans le système de `host` (ou en sort avec null) : seuls cette planète, ses satellites et le Soleil restent
   * chargés et dessinés (le rythme d'images maximal sur téléphone : voir syncSystemProfile).
   */
  // applySystemView : applique ou retire la vue d'un système planétaire (début).
  applySystemView(host) {
    // Garde la planète du système.
    this.systemHost = host;
    // Astres hors du système : plus chargés ni dessinés (ou de nouveau tous à la sortie).
    this.applyBodyVisibility();
    // Profil de rendu du nouveau système.
    this.syncSystemProfile();
  // Fin de applySystemView.
  },
  /** Un geste vient d'avoir lieu (toucher, molette, clavier, pilotage) : le moteur reprend son plein rythme. */
  // markActive : note un geste de l'utilisateur (début).
  markActive() {
    // Instant du geste.
    this.activeAt = performance.now();
    // Recalcule la durée visée d'une image.
    this.refreshFrameMs(this.activeAt);
  // Fin de markActive.
  },
  /** Recalcule la durée visée d'une image (voir targetFrameMs). Au repos = aucun geste récent et caméra arrivée. */
  // refreshFrameMs : recalcule la durée visée d'une image (début).
  refreshFrameMs(now) {
    // En mouvement : glissement, transition ou zoom en cours,
    const moving = this.drag || this.focusT < 1 || Math.abs(this.dist - this.distGoal) > this.dist * 1e-3
      // ou flèche enfoncée.
      || Object.values(this.keyRotate).some(Boolean);
    // En mouvement : c'est une activité.
    if (moving) this.activeAt = now;
    // Durée visée : selon l'écran de chargement, l'économie d'énergie et le repos.
    const next = targetFrameMs(this.power, { covered: this.covered, saving: this.saving, idle: now - this.activeAt > IDLE_AFTER_MS });
    // Inchangée : rien.
    if (next === this.frameMs) return;
    // La garde.
    this.frameMs = next;
    // La mesure de fluidité repart.
    this.dprFrameMs = 16.7; // la mesure de fluidité repart du nouveau rythme
    // Plus de période rapide.
    this.dprFastSince = 0;
  // Fin de refreshFrameMs.
  },
  // setResolution : change la densité de pixels (début).
  setResolution(dpr) {
    // Inchangée : rien.
    if (dpr === this.dpr) return;
    // La garde.
    this.dpr = dpr;
    // Règle le moteur de rendu.
    this.renderer.setPixelRatio(dpr); // redimensionne aussi le tampon de rendu
    // La mesure de fluidité repart.
    this.dprFrameMs = 16.7; // nouvelle mesure pour le nouveau cran
  // Fin de setResolution.
  },
  // updateBodies : place les astres à l'instant simulé (début).
  updateBodies(T, d) {
    // Pour chaque planète (début).
    this.planets.forEach((p) => {
      // Position héliocentrique calculée par le solveur Kepler offline, Soleil fixe.
      p.ecl = calculateOrbitPosition(p.def, this.simMs);
      // Sa position dans la scène.
      p.w.set(p.ecl[0] * AU_UNITS, p.ecl[1] * AU_UNITS, p.ecl[2] * AU_UNITS);
      // Hauteur réelle (Kepler), gardée pour mesurer la descente Schwarzschild ajoutée ci-dessous.
      const keplerY = p.w.y;
      // Affichage Schwarzschild : la planète descend dans le cône du bas de la toupie du Soleil, à sa distance.
      if (p.def.dwarf) {
        // Planète naine : dans l'affichage Schwarzschild, elle quitte son orbite inclinée de Kepler pour se poser
        // sur la grille du Soleil. Sa hauteur de Kepler s'efface au rythme du fondu, et la hauteur de la grille est
        // prise à sa distance dans le plan de l'écliptique. Ses satellites, placés par rapport à elle, la suivent.
        p.w.y = p.w.y * (1 - (this.schwarzschild?.eased || 0)) + this.sunWellDrop(Math.hypot(p.ecl[0], p.ecl[2])) + this.wellApexDrop(bodyId(p.def));
      } else {
        p.w.y += this.sunWellDrop(Math.hypot(p.ecl[0], p.ecl[1], p.ecl[2])) + this.wellApexDrop(bodyId(p.def));
      }
      // Descente verticale due à l'affichage Schwarzschild (0 hors du mode) : l'éclairage la retire pour garder la
      // direction réelle du Soleil (voir updateSunDirections).
      p.wellDropY = p.w.y - keplerY;
      // Sa rotation propre.
      p.mesh.rotation.y = (d / p.def.rotation) * TAU;
    // Fin de la boucle.
    });

    // La Terre.
    const E = this.earth;
    // Place la Lune.
    this.updateMoon(T);
    // Satellites : calcul complet à chaque image pour le système de l'astre ciblé, espacé pour les autres.
    const ft = this.focusTarget();
    // Met à jour les satellites, en entier pour le système de la cible.
    this.satellites.update(this.simMs, ft.body || ft.satellite?.parent || null);
    // Rotation propre du Soleil : un tour en 25 jours.
    this.sunMesh.rotation.y = (d / 25) * TAU;
    // Régions actives réelles : reposées de temps en temps pour suivre la rotation du Soleil (voir setSolarRegions).
    if (this.solarRegionsData && performance.now() - this.solarRegionsAt > REGIONS_REPLACE_MS) this.applySolarRegions();

    // Orientation de la Terre : face au Soleil selon l'heure UTC (jour/nuit réels).
    const ew = E.w;
    // Composante de la position de la Terre le long de son équateur.
    const lz = -ew.y * Math.sin(EARTH_TILT) - ew.z * Math.cos(EARTH_TILT);
    // Angle du Soleil vu de la Terre.
    const sunAngle = Math.atan2(-lz, -ew.x);
    // Angle horaire d'après l'heure UTC.
    const hourAngle = -(((this.simMs / 3600000) % 24) - 12) * 15 * D;
    // Rotation de la Terre : la face au Soleil suit l'heure.
    E.mesh.rotation.y = sunAngle - hourAngle;
    // Inclinaison de l'axe terrestre.
    E.group.rotation.x = -EARTH_TILT;

    // Planètes tuilées : obliquité réelle de leur axe (la rotation propre est déjà appliquée au maillage ci-dessus).
    for (const tb of this.tiledBodies) {
      // Si l'astre a un pôle décrit (début).
      if (tb.cfg.pole) {
        // Pôle réel (UAI) : le Nord local (+Y) du groupe pointe vers lui, dans le repère écliptique de la scène.
        tb.poleV ||= new THREE.Vector3(...equatorialDegToScene(tb.cfg.pole[0], tb.cfg.pole[1]));
        // Oriente son groupe vers ce pôle.
        tb.group.quaternion.setFromUnitVectors(UP_Y, tb.poleV);
      // Sinon, s'il a une obliquité : incline son groupe.
      } else if (tb.cfg.obliquity) tb.group.rotation.x = -tb.cfg.obliquity;
    // Fin de la boucle.
    }
  // Fin de updateBodies.
  },
  // Lune : même propagation képlérienne à deux corps que les autres satellites.
  moonRelAt(ms, out = new THREE.Vector3()) {
    const state = satelliteState(MOON_KEPLER_ELEMENTS, null, ms, 60_000, null);
    return out.set(state.rel[0], state.rel[1], state.rel[2]);
  },
  // Place la Lune en ajoutant son vecteur géocentrique à la position héliocentrique de la Terre.
  updateMoon(_T) {
    const state = satelliteState(MOON_KEPLER_ELEMENTS, null, this.simMs, 60_000, null);
    this.moonSource = 'Kepler à deux corps';
    this.moonRel.set(state.rel[0], state.rel[1], state.rel[2]);
    this.moonW.copy(this.earth.w).add(this.moonRel);
    // Affichage Schwarzschild : la Lune descend dans la toupie de la Terre, à sa distance.
    const moonDrop = this.wellSlopeRise('earth', this.moonRel.length()) + this.wellApexDrop('moon');
    this.moonW.y += moonDrop;
    // Descente totale de la Lune (celle de la Terre comprise), retirée par l'éclairage.
    this.moonWellDropY = (this.earth.wellDropY || 0) + moonDrop;

    const distanceScene = this.moonRel.length();
    const distanceKm = distanceScene * 6371;
    const latitude = Math.asin(Math.max(-1, Math.min(1, this.moonRel.y / Math.max(distanceScene, 1e-12))));
    const longitude = Math.atan2(-this.moonRel.z, this.moonRel.x);
    this.moonGeo = {
      lon: ((longitude / D) % 360 + 360) % 360,
      lat: latitude / D,
      distKm: distanceKm,
    };

    this.moonOrbitTrail.update(this.simMs);

    // Orientation synchrone dérivée du plan orbital et de la vitesse képlérienne.
    const basis = synchronousBasis(state.rel, state.vel);
    this.moonBasisMatrix.makeBasis(
      this.moonBasisX.fromArray(basis.x),
      this.moonBasisY.fromArray(basis.y),
      this.moonBasisZ.fromArray(basis.z),
    );
    this.moonGroup.quaternion.setFromRotationMatrix(this.moonBasisMatrix);

    if (this.moonTiles) {
      const toSun = this.tmpSun.copy(this.moonW).negate().normalize();
      const toEarth = this.tmpEarth.copy(this.moonRel).negate().normalize();
      this.moonTiles.uniforms.earthshine.value = 1 - (1 + toSun.dot(toEarth)) / 2;
    }
  // Fin de updateMoon.
  },
  /**
   * Suit la rotation propre de l'astre ciblé quand la rotation automatique est coupée, ou quand la caméra est à moins
   * de SPIN_LOCK_RADII rayons de son sol :
   * la direction de la caméra tourne autour de l'axe de l'astre du même angle que lui depuis l'image précédente.
   * Renvoie true si la caméra est solidaire de l'astre (la rotation automatique doit alors s'arrêter).
   */
  // followSpin : fait suivre à la caméra la rotation propre de l'astre ciblé (début).
  followSpin() {
    // La cible.
    const f = this.focusTarget();
    // Son maillage, pour une planète.
    const mesh = f.body?.mesh || null;
    // Rotation automatique coupée : la caméra suit la rotation live de l'astre à toute distance (géantes comprises) ;
    // sinon, seulement près du sol d'une planète.
    const ratio = this.surfaceRatio();
    // Près de l'astre : au ras des nuages pour une géante gazeuse, sous 2 rayons sinon.
    const near = f.passable ? this.dist > this.localRadius() && ratio < GAS_SPIN_LOCK_RADII : ratio < SPIN_LOCK_RADII;
    // Solidaire : planète ciblée, transition finie, rotation automatique coupée ou caméra proche.
    const locked = Boolean(mesh) && this.focusT >= 1 && (!this.autoRotate || near);
    // Rotation à l'image précédente.
    const prev = this.spinRef;
    // Garde la rotation de cette image.
    this.spinRef = mesh ? { mesh, y: mesh.rotation.y } : null;
    // Doigt posé ou non, la caméra reste solidaire de l'astre : sans cela, pendant un glisser ou un pincement près
    // du sol, la Terre tournait sous la caméra (≈ 460 m par seconde à l'équateur) et la vue avançait toute seule.
    if (!locked || !prev || prev.mesh !== mesh || this.lockCity || this.focusedTiled()?.lock) return locked;
    // Angle tourné depuis l'image précédente, ramené entre −π et π.
    const d = Math.atan2(Math.sin(mesh.rotation.y - prev.y), Math.cos(mesh.rotation.y - prev.y));
    // Nul : vrai, sans rien changer.
    if (!d) return true;
    // Axe de rotation de l'astre dans la scène.
    const axis = this.spinAxis.set(0, 1, 0).applyQuaternion(mesh.parent.getWorldQuaternion(this.spinQ));
    // Direction de la caméra.
    const v = this.spinDir.set(Math.sin(this.az) * Math.cos(this.el), Math.sin(this.el), Math.cos(this.az) * Math.cos(this.el));
    // La tourne du même angle.
    v.applyAxisAngle(axis, d);
    // Nouvel azimut.
    this.az = Math.atan2(v.x, v.z);
    // Même borne que la vue (au ras du pôle) : avec ±1,5 rad, les flèches restaient bloquées avant le pôle quand la
    // caméra suit la rotation de l'astre.
    this.el = clamp(Math.asin(clamp(v.y, -1, 1)), -POLE_LIMIT, POLE_LIMIT);
    // Vrai.
    return true;
  // Fin de followSpin.
  },
  // updateCamera : place la caméra pour cette image (début).
  updateCamera(dt = 0) {
    // La caméra, les planètes et le Soleil.
    const { cam, planets, sunMesh } = this;
    // La Terre.
    const E = this.earth;

    // Transition douce vers l'astre ciblé, zoom lissé vers la distance visée
    this.focusT = Math.min(1, this.focusT + dt * 0.001 * FOCUS_RATE);
    // Courbe douce de la transition : rapide au départ, lente à l'arrivée.
    const ease = 1 - Math.pow(1 - this.focusT, 3);
    // Point visé : entre le départ et la cible.
    this.target.copy(this.targetStart).lerp(this.focusTarget().get(), ease);
    // Les systèmes distants suivent l'origine flottante sans perdre leur position astronomique globale.
    this.updateInterstellarSceneOrigins();
    // Zoom lissé en échelle logarithmique, même vitesse à toute cadence (avant : 16 % par image, donc plus lent à 30 i/s).
    // Relief : la caméra reste au-dessus du sol réel (montagnes soulevées) de l'astre survolé.
    const lifted = this.focusedTiled();
    // Si le relief en volume est actif, avec une carte (début).
    if (lifted?.tiles.reliefOn && lifted.tiles.active) {
      // Hauteur du sol sous la caméra.
      const floor = lifted.tiles.groundFloor(this.cam.position, performance.now());
      // La distance voulue reste au-dessus de ce sol.
      if (floor > 0) this.distGoal = Math.max(this.distGoal, lifted.radius * (1 + floor + minAltitudeRadii(lifted.cfg)));
    // Fin de ce cas.
    }
    // Zoom d'arrivée (goTo avec `fly`) : il mène la distance jusqu'au bout. Le relief peut relever le plancher en
    // route : l'arrivée est relevée d'autant. Toute autre destination (zoom à la main, autre lieu, vue globale) rend
    // la main au zoom lissé habituel.
    const flight = this.zoomFlight;
    // Si la distance voulue ne correspond plus au zoom d'arrivée (début).
    if (flight && this.distGoal !== flight.plan.to) {
      // Relevée en route : l'arrivée du zoom est relevée d'autant.
      if (this.distGoal > flight.plan.to && this.distGoal < flight.plan.from) flight.plan = { ...flight.plan, to: this.distGoal };
      // Sinon : le zoom d'arrivée s'arrête.
      else this.zoomFlight = null;
    // Fin de ce cas.
    }
    // Pendant un zoom d'arrivée (début).
    if (this.zoomFlight) {
      // Avance son temps, de 100 ms au plus.
      flight.t += Math.min(dt, 100);
      // Distance donnée par le plan.
      this.dist = flightDistance(flight.plan, flight.t);
      // Arrivé : terminé.
      if (flight.t >= flight.plan.ms) this.zoomFlight = null;
    // Sinon (début).
    } else {
      // Zoom lissé vers la distance voulue ; temps borné à une image à 30 par seconde (pas de saut après une pause).
      this.dist *= Math.pow(this.distGoal / this.dist, easeFactor(dt, ZOOM_TAU_MS));
    // Fin du choix.
    }

    // Le monde est recentré sur la cible : la caméra reste proche de l'origine (précision flottante).
    planets.forEach((p) => {
      // Position de la planète autour du point visé.
      p.group.position.copy(p.w).sub(this.target);
      // Son orbite est recentrée de même.
      p.orbit.position.copy(this.target).negate();
      // Orbite visible : si les orbites sont affichées, la planète non masquée et la caméra assez loin.
      p.orbit.visible = this.orbitsOn && !p.hidden && this.dist > 3000;
      // Orbite à l'écran : son tracé est mis au mélange Kepler → rosette du moment (sans effet s'il y est déjà).
      if (p.orbit.visible) this.mixPlanetOrbit(p);
    // Fin de la boucle.
    });
    // Position de la Lune.
    this.moonGroup.position.copy(this.moonW).sub(this.target);
    // Son orbite suit la Terre.
    this.moonOrbit.position.copy(this.earth.group.position);
    // Le tracé de son orbite descend avec elle.
    this.moonOrbit.position.y += this.wellSlopeRise('earth', this.moonRel.length());
    // Orbite visible : si les orbites sont affichées, la Lune non masquée et la caméra assez près.
    // Dans la représentation de Schwarzschild, les orbites de Kepler sont masquées : celles des planètes et des
    // satellites deviennent leur rosette (le même ruban, déformé), mais celle de la Lune est tracée sur sa vraie
    // trajectoire de Kepler et n'a pas de rosette — elle disparaît donc dès que les astres descendent.
    this.moonOrbit.visible = this.orbitsOn && !this.moonHidden && this.dist < MOON_ORBIT_MAX_DIST && !this.keplerOrbitsMasked();
    // Place les satellites.
    this.satellites.place(this.target, cam.position, this.orbitsOn);
    // Position du Soleil.
    // Le Soleil : à l'origine du repère, descendu au fond de sa toupie dans l'affichage Schwarzschild.
    this.sunW.set(0, this.sunWellDrop(0), 0);
    sunMesh.position.copy(this.sunW).sub(this.target);
    // Les périvolumes et les toupies des systèmes suivent la même origine flottante que le Soleil.
    this.perivolumeRoot?.position.copy(this.target).negate();
    // Son halo le suit.
    this.glow.position.copy(sunMesh.position);
    // Sa lumière aussi, mais à la hauteur réelle du Soleil vue de l'astre visé : les descentes de l'affichage
    // Schwarzschild (Soleil et astre au fond de leurs toupies) ne changent pas l'inclinaison de la lumière.
    this.sunLight.position.copy(sunMesh.position);
    this.sunLight.position.y += this.wellDropOfTarget(this.focusTargets?.[this.focus]) - this.sunW.y;

    // Près de la surface d'une planète, la caméra est solidaire de sa rotation propre : le sol reste fixe à l'écran
    // et la rotation automatique est suspendue. Plus loin, retour à la rotation automatique autour de l'astre.
    const spinLocked = this.followSpin();
    // Rotation automatique ralentie près du sol (sinon la caméra défilerait de plusieurs km par image).
    const nearFactor = clamp(this.surfaceRatio(), 0, 1);
    // Petits signes infini (lemniscate de Gerono) ajoutés à la trajectoire pendant la rotation automatique :
    // l'enveloppe monte et descend en douceur quand la rotation démarre ou s'arrête.
    const infinityOn = this.autoRotate && !this.drag && !spinLocked;
    // Enveloppe des signes infini : monte ou descend en douceur.
    this.infinityAmp += ((infinityOn ? 1 : 0) - this.infinityAmp) * (1 - Math.exp(-dt / 900));
    // Avance leur temps.
    this.infinityT += dt * 0.001;
    // Rotation automatique, hors glissement et hors suivi de l'astre (début).
    if (this.autoRotate && !this.drag && !spinLocked) {
      // Tourne l'azimut, moins vite près du sol.
      this.az += AUTO_ROTATE_SPEED * this.rotateSpeed * dt * 0.001 * nearFactor;
    // Fin de ce cas.
    }

    // Ville suivie : la caméra se place à la verticale de la ville
    if (this.lockCity && this.focus === this.earthFocus) {
      // Met à jour la matrice de la Terre.
      E.mesh.updateWorldMatrix(true, false);
      // Verticale de la ville, dans la scène.
      const n = this.lockN.copy(this.lockCity.lv).applyMatrix4(E.mesh.matrixWorld).sub(E.group.position).normalize();
      // Élévation correspondante.
      this.el = Math.asin(clamp(n.y, -1, 1));
      // Azimut correspondant.
      this.az = Math.atan2(n.x, n.z);
    // Fin de ce cas.
    }

    // Lieu survolé d'un astre tuilé : la caméra se place à sa verticale, dans le repère de ses tuiles
    // (orientation du groupe + rotation propre du maillage pour les planètes ; groupe seul pour la Lune).
    const tb = this.focusedTiled();
    // S'il y a un lieu survolé (début).
    if (tb?.lock) {
      // Met à jour la matrice de l'astre.
      tb.mesh.updateWorldMatrix(true, false);
      // Verticale du lieu, dans la scène.
      const n = this.lockN.copy(tb.lock.lv).applyMatrix4(tb.mesh.matrixWorld).sub(tb.group.position).normalize();
      // Élévation correspondante.
      this.el = Math.asin(clamp(n.y, -1, 1));
      // Azimut correspondant.
      this.az = Math.atan2(n.x, n.z);
    // Fin de ce cas.
    }

    // Flèches maintenues : rotation continue, d'autant plus fine qu'on est proche de la surface
    // (même facteur que le glisser), dt borné pour éviter un saut au retour d'onglet.
    const rot = this.keyRotate;
    // Si une flèche est enfoncée (début).
    if (rot.left || rot.right || rot.up || rot.down) {
      // Finesse du pas selon la proximité du sol.
      const kz = Math.max(1e-9, Math.min(1, this.surfaceRatio() * 0.9));
      // Pas de rotation de cette image.
      const step = Math.min(dt, 100) * 0.001 * KEY_ROTATE_SPEED * kz;
      // Pas de butée aux pôles : en maintenant « haut » ou « bas », la vue passe par-dessus le pôle et continue de
      // l'autre côté (crossPole réécrit la même vue, sans saut). Le sens des flèches suit le haut de l'écran.
      const sign = arrowSign(this.heading);
      // Flèche gauche.
      if (rot.left) this.az -= sign * step;
      // Flèche droite.
      if (rot.right) this.az += sign * step;
      // Flèche haut.
      if (rot.up) this.el += sign * step;
      // Flèche bas.
      if (rot.down) this.el -= sign * step;
      // Passage éventuel par-dessus le pôle.
      const view = crossPole({ az: this.az, el: this.el, heading: this.heading });
      // Si le pôle est franchi (début).
      if (view.crossed) {
        // Nouvel azimut.
        this.az = view.az;
        // Nouvelle élévation.
        this.el = view.el;
        // Le cap voulu suit.
        this.headingGoal += view.heading - this.heading; // le cap visé suit, sinon la vue pivoterait pour revenir
        // Nouveau cap.
        this.heading = view.heading;
      // Fin de ce cas.
      }
    // Fin des flèches.
    }

    // Distance de la caméra.
    const { dist } = this;
    // Pulsation des signes infini.
    const wInf = (2 * Math.PI) / INFINITY_PERIOD_S;
    // Leur amplitude, réduite près du sol.
    const aInf = INFINITY_AMPLITUDE * this.infinityAmp * clamp(this.surfaceRatio(), 0.05, 1);
    // Azimut, avec le signe infini.
    const az = this.az + aInf * Math.sin(wInf * this.infinityT);
    // Borné juste avant le pôle (et non plus à ±1,5 rad) : aucune zone morte en approchant du pôle au clavier.
    const el = clamp(this.el + aInf * 0.5 * Math.sin(2 * wInf * this.infinityT), -POLE_LIMIT, POLE_LIMIT);
    // Rayon de la cible.
    const fr = this.focusTarget().r || 1;
    // Vue 3/4 automatique : l'angle suit la distance (rampe continue), puis est lissé dans le temps. Le Soleil,
    // sans sol à survoler, garde un regard centré. La pose conserve exactement la distance de zoom et vise le
    // point de surface survolé : ni l'altitude ni le lieu au centre de l'écran ne bougent.
    const engage = this.focus === 0 || this.focusTarget().passable ? 0 : tiltEngagement(dist / fr);
    // Inclinaison visée : la pilotée, sinon l'automatique.
    const tiltTarget = this.pilotTilt ?? (this.tiltOn ? TILT_MAX_ANGLE * engage : 0);
    // Inclinaison lissée dans le temps.
    this.tiltV = approachTilt(this.tiltV, tiltTarget, dt);
    // Cap de la boussole : rotation douce autour de la verticale locale, sans tour complet au passage de ±π.
    if (this.northLock) {
      // Verrouillé : le nord reste collé en haut, sans lissage.
      const north = this.compassState();
      // Cap voulu : celui du nord.
      if (north) this.headingGoal = north.bearing;
      // Cap : sans lissage.
      this.heading = this.headingGoal;
    // Sinon (début).
    } else {
      // Cap lissé vers le cap voulu.
      this.heading = approachAngle(this.heading, this.headingGoal, dt);
    // Fin du choix.
    }
    // Calcule la pose de la caméra (début) :
    tiltPose({
      // rayon, distance, élévation, azimut, inclinaison et cap ;
      radius: fr, dist, el, az, angle: this.tiltV, heading: this.heading,
      // en sortie : la position, le point visé et le haut de l'image.
      pos: cam.position, aim: this.tiltAim, up: this.tiltUp,
    // Fin du calcul.
    });
    // Haut de l'image.
    cam.up.copy(this.tiltUp);
    // Regarde le point visé.
    cam.lookAt(this.tiltAim);
    // Vue verrouillée : la caméra garde sa place autour de l'astre focus (le zoom avance toujours vers lui) et ne
    // change que de regard, tourné vers l'astre verrouillé.
    const lock = this.viewLock;
    // Si la vue est verrouillée (début).
    if (lock) {
      // L'astre verrouillé.
      const locked = this.focusTargets[lock.index];
      // Cible changée, astre disparu ou masqué : le verrou tombe.
      if (lock.focus !== this.focus || !locked || this.isTargetHidden(locked)) this.viewLock = null;
      // Sinon (début).
      else {
        // Position de l'astre verrouillé.
        const aim = this.lockAim.copy(locked.get()).sub(this.target);
        // Direction du regard.
        const dir = this.lockNdc.copy(aim).sub(cam.position);
        // Si elle n'est pas nulle (début).
        if (dir.lengthSq() > 0) {
          // Regard presque parallèle au « haut » de l'image : on prend l'axe de la scène pour éviter le retournement.
          if (Math.abs(dir.normalize().dot(cam.up)) > 0.999) cam.up.set(0, 1, 0);
          // Regarde l'astre verrouillé.
          cam.lookAt(aim);
        // Fin de ce cas.
        }
      // Fin du « sinon ».
      }
    // Fin du verrou.
    }
    // Met à jour la matrice de la caméra.
    cam.updateMatrixWorld();
    this.interstellarRenderer?.updateGlobalMarkers(cam, this.renderer?.domElement?.clientHeight || this.H || innerHeight);
    // Intérieur des géantes : dessiné seulement quand la caméra est dans l'astre, solidaire de sa rotation propre.
    for (const g of this.gasInteriors) {
      // Affiche l'intérieur si la caméra est dans l'astre, avec sa rotation propre.
      g.interior.update(cam.position.distanceTo(g.group.position) < g.radius * 1.001, g.mesh.rotation.y);
    // Fin de la boucle.
    }
    // Atmosphères : face dessinée selon que la caméra est dehors ou dedans.
    for (const a of Object.values(this.atmospheres)) a.userData.track(cam.position);

    // Plan proche suivant l'altitude : indispensable pour descendre à quelques mètres du sol (zoom 22).
    const near = clamp((this.focusTarget().passable ? Math.max(dist - fr, dist * 0.1) : dist - fr) * 0.02, 1e-10, 1e-5);
    // S'il a changé de plus de 5 % (début).
    if (Math.abs(near - cam.near) > cam.near * 0.05) {
      // Nouveau plan proche.
      cam.near = near;
      // Recalcule la projection.
      cam.updateProjectionMatrix();
    // Fin de ce cas.
    }

    // Taille du halo du Soleil : selon sa distance, 655 au moins.
    this.glow.scale.setScalar(Math.max(655, cam.position.distanceTo(sunMesh.position) * 0.035));
  // Fin de updateCamera.
  },
  // Ciel lointain atténué quand le Soleil est dans le champ, et masqué par le ciel de jour près du sol terrestre.
  updateSky() {
    // La caméra et le ciel.
    const { cam, sky } = this;
    // Ciel masqué : rien.
    if (!sky.visible) return;
    // Direction de visée.
    const fwd = cam.getWorldDirection(this.skyFwd);
    // Vecteur vers le Soleil.
    const toSun = this.skyToSun.copy(this.sunMesh.position).sub(cam.position);
    // Sa distance.
    const sunDist = toSun.length() || 1;
    // Rendu unitaire.
    toSun.divideScalar(sunDist);
    // Tangente du demi-champ vertical.
    const tanV = Math.tan((cam.fov * D) / 2);
    // Demi-diagonale du champ.
    const halfDiag = Math.atan(Math.hypot(tanV, tanV * cam.aspect));
    // Rayon apparent du Soleil.
    const sunRadius = Math.asin(Math.min(1, this.data.bodies.sun.radius / sunDist));
    // Éblouissement par le Soleil.
    const glare = sunGlare(fwd.dot(toSun), halfDiag, sunRadius);

    // La Terre.
    const E = this.earth;
    // Son rayon.
    const R = E.def.radius || 1;
    // Verticale de la caméra au-dessus de la Terre.
    const up = this.skyUp.copy(cam.position).sub(E.group.position);
    // Altitude en kilomètres.
    const altitudeKm = (up.length() / R - 1) * EARTH_RADIUS_KM;
    // Rendue unitaire.
    up.normalize();
    // Sinus de la hauteur du Soleil au-dessus de l'horizon.
    const sinSunAlt = this.earthToSun(this.skyToSun).dot(up);
    // Intensité visée du ciel, d'après l'éblouissement et le voile du jour.
    sky.setTargetIntensity(skyVisibility({ glare, veil: daySkyVeil(altitudeKm, sinSunAlt) }));
  // Fin de updateSky.
  },
  // Les frontières suivent la rotation de la Terre et flottent juste au-dessus du sol, d'autant plus bas qu'on est près.
  updateBorders() {
    // Lignes non voulues : rien.
    if (!this.bordersWanted) return;
    // Altitude de la caméra au-dessus de la Terre.
    const altitude = Math.max(0, this.cam.position.distanceTo(this.earth.group.position) - 1);
    // Visibles au-dessus de l'altitude minimale.
    this.bordersRoot.visible = altitude > BORDERS_MIN_ALTITUDE;
    // Suivent la rotation de la Terre.
    this.bordersRoot.rotation.y = this.earth.mesh.rotation.y;
    // Flottent juste au-dessus du sol.
    this.bordersRoot.scale.setScalar(1 + borderLift(altitude));
  // Fin de updateBorders.
  },
  // Élévation du Soleil (en degrés) au-dessus de l'horizon d'un point du globe, pour la fiche ville.
  sunAltitudeAt(lon, lat) {
    // Maillage de la Terre.
    const mesh = this.earth?.mesh;
    // Absent : NaN.
    if (!mesh) return NaN;
    // Met à jour sa matrice.
    mesh.updateMatrixWorld(true);
    // Verticale du lieu, dans la scène.
    const normal = lonLatToVec([lon, lat]).transformDirection(mesh.matrixWorld);
    // Direction du Soleil depuis la Terre.
    const toSun = this.earthToSun(this.tmpSun);
    // Hauteur du Soleil, en degrés.
    return Math.asin(clamp(normal.dot(toSun), -1, 1)) / D;
  // Fin de sunAltitudeAt.
  },
  /** Direction réelle du Soleil vue de la Terre (unitaire), sans les descentes de l'affichage Schwarzschild. */
  earthToSun(out) {
    out.copy(this.sunMesh.position).sub(this.earth.group.position);
    out.y += (this.earth.wellDropY || 0) - this.sunW.y;
    return out.normalize();
  },
  /**
   * Descente verticale d'une cible de focus dans l'affichage Schwarzschild (0 hors du mode) : celle de sa planète,
   * de la Lune, ou d'un satellite (sa planète plus sa propre toupie).
   */
  wellDropOfTarget(target) {
    if (!target) return 0;
    if (target.body) return target.body.wellDropY || 0;
    if (target.moon) return this.moonWellDropY || 0;
    const sat = target.satellite;
    if (sat) return (sat.parent?.wellDropY || 0) + (this.satellites?.wellDrop?.(sat) || 0);
    return 0;
  },
  /**
   * Direction du Soleil vue de chaque astre tuilé, dans le repère caméra (éclairage des tuiles et de l'atmosphère).
   * C'est toujours la direction réelle : dans l'affichage Schwarzschild, le Soleil et l'astre descendent au fond de
   * leurs toupies, mais ces descentes sont retirées ici, pour que l'inclinaison de la lumière sur l'astre ne change
   * pas quand on passe sur le plan de Schwarzschild.
   */
  updateSunDirections(cam = this.cam) {
    for (const tb of this.tiledBodies) {
      // L'astre correspondant (planète, ou la Lune), retrouvé une fois.
      if (tb.wellSource === undefined) tb.wellSource = tb.id === 'moon' ? 'moon' : (this.planets.find((p) => bodyId(p.def) === tb.id) ?? null);
      const drop = tb.wellSource === 'moon' ? (this.moonWellDropY || 0) : (tb.wellSource?.wellDropY || 0);
      // Ligne droite vers le Soleil, descentes retirées (nulles hors du mode).
      tb.sunDir.copy(this.sunMesh.position).sub(tb.group.position);
      tb.sunDir.y += drop - this.sunW.y;
      tb.sunDir.normalize();
      // Puis passée dans le repère de la caméra.
      tb.sunDir.transformDirection(cam.matrixWorldInverse);
    }
  // Fin de updateSunDirections.
  },
  /**
   * Style des orbites, à chaque image : réglages partagés des rubans (taille du tampon de dessin, densité de pixels),
   * mise en avant de l'orbite de l'astre visé (ou de sa planète), et traînée de chaque planète recalée sur sa position
   * deux fois par seconde au plus (le point le plus proche sur 2 048 ; le sens du parcours d'après son déplacement).
   */
  // updateOrbitStyle : l'instant présent (début).
  updateOrbitStyle(now) {
    // Taille du tampon de dessin et densité de pixels, pour l'épaisseur des rubans à l'écran.
    updateOrbitShared(this.renderer);
    // La cible.
    const f = this.focusTarget();
    // Planète dont l'orbite est mise en avant : la planète visée, celle du satellite visé, la Terre pour la Lune.
    const focusPlanet = f.body || f.satellite?.parent || (f.moon ? this.earth : null);
    // Pour chaque planète (début).
    for (const p of this.planets) {
      // Son orbite mise en avant si c'est la planète de la cible.
      p.orbitTrail.setFocused(p === focusPlanet);
      // Orbite cachée, ou traînée recalée il y a moins d'une demi-seconde : rien de plus.
      if (!p.orbit.visible || now - p.trailAt < 500) continue;
      // Instant de ce recalage.
      p.trailAt = now;
      // Points de l'orbite (repère du Soleil, comme p.w).
      const pts = p.orbitTrail.points;
      // Point le plus proche de la planète, parmi les 2 048 (le dernier répète le premier).
      const head = nearestPointIndex(pts, p.orbitTrail.count - 1, p.w.x, p.w.y, p.w.z);
      // Position précédente notée (début) : le sens du parcours vient de son déplacement depuis.
      if (p.trailPrev) {
        // Déplacement depuis la dernière fois.
        const mx = p.w.x - p.trailPrev.x, my = p.w.y - p.trailPrev.y, mz = p.w.z - p.trailPrev.z;
        // Point suivant sur l'orbite (le dernier répète le premier : jamais hors du tableau).
        const n1 = head + 1;
        // Tangente de l'orbite au point de la planète, dans le sens des indices croissants.
        const tx = pts[3 * n1] - pts[3 * head], ty = pts[3 * n1 + 1] - pts[3 * head + 1], tz = pts[3 * n1 + 2] - pts[3 * head + 2];
        // Produit scalaire du déplacement et de la tangente.
        const dot = mx * tx + my * ty + mz * tz;
        // Déplacement net : son signe donne le sens (le temps peut aussi être remonté).
        if (Math.abs(dot) > 1e-12) p.trailDir = dot > 0 ? 1 : -1;
      // Fin de ce cas.
      }
      // Position notée pour le prochain recalage.
      p.trailPrev = (p.trailPrev || new THREE.Vector3()).copy(p.w);
      // Point et sens inchangés : opacités inchangées.
      if (head === p.trailHead && p.trailDir === p.trailDirDrawn) continue;
      // Garde le point et le sens dessinés.
      p.trailHead = head; p.trailDirDrawn = p.trailDir;
      // Opacités de la traînée : la plus claire juste derrière la planète.
      loopTrailAlphas(p.orbitTrail.alphas, head, p.trailDir);
      // Les renvoie à la carte graphique.
      p.orbitTrail.alphasChanged();
    // Fin de la boucle.
    }
    // Orbite de la Lune mise en avant quand la Lune est visée.
    this.moonOrbitTrail.setFocused(Boolean(f.moon));
    // Orbites des satellites : celle du satellite visé mise en avant.
    this.satellites.setFocused(f.satellite || null);
  // Fin de updateOrbitStyle.
  },
  // updateLabels : met à jour les repères des astres (début).
  updateLabels() {
    // Repère visible seulement si sa case est cochée et si l'astre est trop petit pour être vu (rayon < 4 px).
    const pxScale = this.H / (2 * Math.tan((this.cam.fov * D) / 2));
    // Nom de la cible.
    const focusName = this.focusTarget().name;
    // Pour chaque repère (début).
    for (const b of this.bodyLabels) {
      // Est-ce l'astre ciblé ?
      b.focused = b.name === focusName; // l'astre ciblé garde son repère même s'il chevauche celui de sa planète
      // Repères de sa famille affichés ?
      const on = b.kind === 'satellite' ? this.satelliteMarkersOn : this.bodyMarkersOn;
      // Actif : affiché, non masqué et plus petit que 4 px ;
      b.enabled = on && !b.isHidden?.() && (b.radius * pxScale) / Math.max(1e-9, b.pos.distanceTo(this.cam.position)) < 4
        // Astre caché derrière un autre (planète, satellite, Soleil) : ni point ni nom.
        && !hiddenByAny(this.cam.position, b, this.bodyLabels);
    // Fin de la boucle.
    }
    // Place les étiquettes (début) :
    layoutLabels({
      // la caméra et la taille de l'écran,
      cam: this.cam, W: this.W, H: this.H,
      // les repères des astres,
      bodies: this.bodyLabels,
      // les villes,
      cities: this.cityItems,
      // Aucun nom de ville sur la Terre : ni la courte liste de l'API, ni les libellés Natural Earth.
      citiesEnabled: false,
      // le groupe de la Terre
      earthGroup: this.earth.group,
      // et son maillage.
      earthMesh: this.earth.mesh,
    // Fin du placement.
    });
  // Fin de updateLabels.
  },
  // Textes du HUD, publiés ≈10 fois par seconde.
  updateHud(now) {
    // Moins de 100 ms depuis la dernière publication : rien.
    if (now - this.hudAt < 100) return;
    // Note l'instant.
    this.hudAt = now;

    // La cible.
    const f = this.focusTarget();
    // Date simulée, en français,
    const date = HUD_DATE_FORMAT.format(this.simMs)
      // avec « temps réel » à vitesse 1.
      + (this.speed === 1 ? ' · temps réel' : '');

    // Distance au Soleil en unités astronomiques : celle de la planète, ou de la Terre pour la Lune.
    const au = f.body ? Math.hypot(...f.body.ecl) : f.moon ? Math.hypot(...this.earth.ecl) : 0;
    // Texte de la cible (début) :
    let focusText = (this.focus
      // le nom, la distance au Soleil et le temps de la lumière ;
      ? `${f.name} · ${au.toFixed(3)} UA du Soleil · lumière ${(au * LIGHT_MINUTES_PER_AU).toFixed(1)} min`
      // ou « Vue d'ensemble » ; puis l'échelle.
      : 'Vue d’ensemble') + ' · échelle réelle 1:1';

    // Ville suivie.
    const city = this.lockCity;
    // S'il y en a une, sur la Terre (début).
    if (city && this.focus === this.earthFocus) {
      // Texte : son nom et sa latitude,
      focusText = `${city.name} · ${Math.abs(city.lat).toFixed(2)}°${city.lat >= 0 ? 'N' : 'S'} `
        // sa longitude
        + `${Math.abs(city.lon).toFixed(2)}°${city.lon >= 0 ? 'E' : 'O'}`
        // et l'altitude de la caméra.
        + ` · altitude ${fmtAltitude(this.dist - 1, EARTH_RADIUS_KM)}`;
    // Fin de ce cas.
    }

    // Dans une géante gazeuse modélisée : couche traversée et profondeur réelle sous le sommet des nuages.
    const inside = f.passable && f.body ? interiorReadout(bodyId(f.body.def), this.dist / this.localRadius()) : null;
    // Dans une géante : le nom et la couche traversée.
    if (inside) focusText = `${f.name} · ${inside}`;

    // Lune ciblée : son propre texte.
    if (f.moon && this.moonGeo) focusText = this.moonText(f);
    // Satellite ciblé (début).
    if (f.satellite) {
      // Le satellite.
      const sat = f.satellite;
      // Distance de sa planète au Soleil.
      const sau = Math.hypot(...sat.parent.ecl);
      // Texte : son nom, sa planète et sa distance à elle,
      focusText = `${f.name} · satellite de ${sat.parent.def.name} · ${HUD_INT_FORMAT.format(Math.round(this.satellites.distanceKm(sat)))} km de son centre`
        // la distance au Soleil, la précision de la position et l'échelle.
        + ` · ${sau.toFixed(3)} UA du Soleil${sat.exact ? '' : ' · position approchée'} · échelle réelle 1:1`;
    // Fin de ce cas.
    }

    // Satellite naturel ciblé : grandeurs en direct pour sa fiche (distance à sa planète, distance au Soleil).
    let satelliteLive = null;
    // Si un satellite est ciblé (début).
    if (f.satellite) {
      // Le satellite.
      const sat = f.satellite;
      // Distance de sa planète au Soleil.
      const sau = Math.hypot(...sat.parent.ecl);
      // Ses grandeurs en direct (début) :
      satelliteLive = {
        // identifiant, nom et planète ;
        id: sat.def.id, name: f.name, satellite: true, parentName: sat.parent.def.name,
        // distance à sa planète et précision ;
        distKm: Math.round(this.satellites.distanceKm(sat)), exact: sat.exact,
        // distance au Soleil et temps de la lumière.
        au: sau, lightMinutes: sau * LIGHT_MINUTES_PER_AU,
      // Fin des grandeurs.
      };
    // Fin de ce cas.
    }

    // À la place du facteur de zoom : distance à la surface de l'astre dont la gravité domine là où est la caméra
    // (« le plus lourd le plus proche », voir gravityMath.jsx). `zoomShort` : la distance seule quand cet astre est
    // celui qui est ciblé (son nom est déjà affiché à côté).
    const dominant = this.dominantBodyNow();
    // Distance à sa surface, mise en forme.
    const distanceText = dominant ? formatDistanceKm((dominant.distance - dominant.r) * EARTH_RADIUS_KM) : '';
    // Texte du zoom : l'astre dominant et la distance.
    const zoomText = dominant ? `${dominant.name} · ${distanceText}` : f.name;
    // Version courte : la distance seule si c'est l'astre ciblé.
    const zoomShort = dominant && dominant.name === f.name ? distanceText : zoomText;
    // Niveau d'échelle (« Rue », « Ville », « Planète »…) : le zoom est continu, ce mot dit où l'on en est.
    const scaleText = dominant
      // d'après la distance à la surface et la nature de l'astre ;
      ? scaleLevel((dominant.distance - dominant.r) * EARTH_RADIUS_KM, { earth: dominant.name === this.earth.def.name, star: dominant.name === this.data.bodies.sun.name })
      // vide sans astre dominant.
      : '';
    // Publie dans le HUD (début) :
    this.hud.set({
      // la date et les textes ;
      date, focusText, zoomText, zoomShort, scaleText,
      // la ville suivie, sur la Terre :
      cityFocus: city && this.focus === this.earthFocus
        // son nom et ses coordonnées,
        ? { name: city.name, lon: city.lon, lat: city.lat }
        // sinon null ;
        : null,
      // l'état des tuiles de chaque astre ;
      ...this.tilesSnapshot(),
      // la Lune en direct, si elle est ciblée ;
      moonLive: f.moon ? this.moonLiveState() : null,
      // les grandeurs de la planète ciblée, sinon celles du satellite ;
      bodyLive: f.body ? { id: bodyId(f.body.def), name: f.name, au, lightMinutes: au * LIGHT_MINUTES_PER_AU } : satelliteLive,
      // la boussole ;
      compass: this.compassState(),
      // les coordonnées des coins.
      gps: this.gpsState(),
      // Verrouillage de la vue : astre le plus proche de l'astre focus.
      viewLock: this.viewLockState(),
    // Fin de la publication.
    });
  // Fin de updateHud.
  },
  /** État des tuiles de chaque astre, sous sa clé du HUD (tiles, moonTiles, marsTiles…). */
  // tilesSnapshot : l'état des tuiles de chaque astre (début).
  tilesSnapshot() {
    // Résultat.
    const out = {};
    // Pour chaque astre : son état, sous sa clé du HUD.
    for (const tb of this.tiledBodies) out[tb.cfg.hudKey] = tb.tiles.snapshot();
    // Le renvoie.
    return out;
  // Fin de tilesSnapshot.
  },
  /** Lune en direct pour le panneau : phase, distance, libration, Soleil au zénith, sondes. */
  // moonLiveState : la Lune en direct, pour le panneau (début).
  moonLiveState() {
    // Position géocentrique.
    const g = this.moonGeo;
    // Inconnue : null.
    if (!g) return null;
    // Inverse de l'orientation de la Lune.
    this.moonQInv.copy(this.moonGroup.quaternion).invert();
    // toLocal : passe un vecteur dans le repère de la Lune.
    const toLocal = ([x, y, z]) => { const v = this.tmpV.set(x, y, z).applyQuaternion(this.moonQInv); return [v.x, v.y, v.z]; };
    // Position de la Terre.
    const ew = this.earth.w;
    // Longitude du Soleil vue de la Terre.
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    // Vecteur de la Terre à la Lune et position de la Lune.
    const rel = this.moonRel, w = this.moonW;
    // État de la Lune : phase, distance, libration et point subsolaire.
    const st = moonState({ moonRel: [rel.x, rel.y, rel.z], moonHelio: [w.x, w.y, w.z], elongDeg: g.lon - sunLon, toLocal });
    // Direction de la Terre vue de la Lune.
    const toEarth = [-rel.x, -rel.y, -rel.z];
    // Sa longueur.
    const l = Math.hypot(...toEarth);
    // round : arrondit à une précision donnée.
    const round = (x, k = 1) => Math.round(x * k) / k;
    // Pour chaque sonde (début).
    const orbiters = this.orbiters.items.map((it) => {
      // Ses informations de base.
      const base = { id: it.id, name: it.name, agency: it.agency, description: it.description, error: it.error || null, selected: it.id === this.selectedOrbiter };
      // Sans état : marquée indisponible.
      if (!it.state) return { ...base, ok: false };
      // Ses mesures.
      const m = orbiterMetrics(it.state, toLocal, toEarth.map((c) => c / l));
      // Renvoie (début)
      return {
        // l'altitude et la vitesse,
        ...base, ok: true, altitudeKm: round(m.altitudeKm), speedKmS: round(m.speedKmS, 1000),
        // la période, la position survolée et la visibilité de la Terre.
        periodMin: m.periodMin && round(m.periodMin, 10), lon: round(m.lon, 100), lat: round(m.lat, 100), earthVisible: m.earthVisible,
      // Fin du résultat.
      };
    // Fin de la boucle.
    });
    // Renvoie (début)
    return {
      // la phase, la part éclairée, l'âge et le sens,
      phase: st.phase, lit: round(st.lit * 100), ageDays: round(st.ageDays, 10), waxing: st.waxing,
      // la distance et le temps de la lumière,
      distKm: round(st.distKm), lightSeconds: round(st.lightSeconds, 1000),
      // la libration,
      libration: { lon: round(st.libration.lon, 100), lat: round(st.libration.lat, 100) },
      // le point subsolaire,
      subSolar: { lon: round(st.subSolar.lon, 100), lat: round(st.subSolar.lat, 100) },
      // la source de la position,
      source: this.moonSource,
      // les sondes,
      orbiters,
      // leur source,
      orbitersSource: this.orbiterData?.source || null,
      // l'état de ShadowCam
      shadowcam: this.shadowcam.snapshot(),
      // et la présence du modèle 3D.
      model: Boolean(this.tiledById.moon.model),
    // Fin du résultat.
    };
  // Fin de moonLiveState.
  },
  // Lune ciblée : distance réelle, phase et, de près, point survolé (coordonnées sélénographiques) et altitude.
  moonText(f) {
    // Position géocentrique.
    const g = this.moonGeo;
    // Direction du Soleil vue de la Lune.
    const toSun = this.moonW.clone().negate().normalize();
    // Direction de la Terre vue de la Lune.
    const toEarth = this.moonRel.clone().negate().normalize();
    // Part éclairée.
    const lit = (1 + toSun.dot(toEarth)) / 2;
    // Position de la Terre.
    const ew = this.earth.w;
    // Longitude du Soleil vue de la Terre.
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    // Élongation, entre 0° et 360°.
    const elong = ((((g.lon - sunLon) % 360) + 360) % 360);
    // Nom de la phase.
    const phase = MOON_PHASES[Math.round(elong / 45) % 8];
    // Texte : distance à la Terre, phase, part éclairée et source.
    let text = `Lune · ${HUD_INT_FORMAT.format(Math.round(g.distKm))} km de la Terre · ${phase} · ${Math.round(lit * 100)} % éclairée · position ${this.moonSource}`;

    // De près, sous 3 rayons (début).
    if (this.dist < f.r * 3) {
      // Met à jour la matrice de la Lune.
      this.moonGroup.updateMatrixWorld(true);
      // Son inverse.
      this.moonInv.copy(this.moonGroup.matrixWorld).invert();
      // Position de la caméra dans le repère de la Lune.
      const local = this.cam.position.clone().applyMatrix4(this.moonInv);
      // Coordonnées du point au centre de l'écran (en vue 3/4 la caméra est décalée de ce point).
      const aim = this.tiltAim.clone().applyMatrix4(this.moonInv);
      // Sa longitude et sa latitude.
      const [lon, lat] = xyzToLonLat([aim.x, aim.y, aim.z]);
      // Texte : les coordonnées du point visé,
      text = `Lune · ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'O'}`
        // l'altitude et la phase.
        + ` · altitude ${fmtAltitude(local.length() / f.r - 1, this.tiledById.moon.cfg.radiusKm)} · ${phase}`;
    // Fin de ce cas.
    }
    // Renvoie le texte.
    return text;
  // Fin de moonText.
  },
// Fin des méthodes.
};
