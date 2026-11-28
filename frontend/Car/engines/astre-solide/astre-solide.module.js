/**
 * Engine astre-solide : les astres solides (la Terre, la Lune, Mars, Mercure, les satellites à carte) sont dessinés
 * par un globe CesiumJS, le reste du système solaire reste en three.js. Un seul globe à la fois : celui de l'astre
 * solide ciblé (la Terre si la cible n'est pas un astre solide à carte), recréé quand cet astre change.
 *
 * Deux régimes, le même pour chaque astre :
 *  - superposition (`overlayFrame`, `drawOverlay`) : three.js a la main ; à chaque image, la caméra du globe suit
 *    celle de three.js, l'astre de three.js est caché, et le globe le dessine par-dessus la scène ;
 *  - de près (`enter` … `leave`) : sous 3,14 rayons de l'astre ciblé (20 000 km pour la Terre), le globe prend la
 *    main ; la scène three.js est mise en attente (`engine.cesiumHold`) et redessine seulement l'espace derrière le
 *    globe (`drawBackdrop`). Au-delà de 4,71 rayons, retour à three.js.
 *
 * Le moteur three.js fournit : `solidGlobeTarget()` (astre visé), `solidBodyView(id)` (vue de la caméra et direction
 * du Soleil dans le repère des tuiles de l'astre), `solidImagery(id)` (fond de carte de l'app pour l'astre),
 * `renderCesiumBackdrop(...)` (espace derrière le globe) et `goToSite(...)` (retour à three.js).
 */

// Importe les règles du passage.
import { RETURN_KM, altitudeKm, zoomFade, lonLatOf, rearm, scaledKm, shouldEnter, shouldExit, reliefRamp } from './astre-solide.handoff.js';
// Importe la création du globe.
import { cesiumResolutionScale, createSolidViewer } from './astre-solide.viewer.js';
// Importe le fournisseur d'images qui lit le fond de carte de l'app.
import { tileSourceImageryProvider } from './astre-solide.imagery.js';
// Importe la caméra du globe pilotée par les commandes de three.js (navball, zoom, verrous).
import { CesiumCamera } from './astre-solide.camera.js';
// Importe l'effacement de l'ancre du lien de vue.
import { setViewHash } from './astre-solide.view-link.js';
// Importe le relief en volume de la Terre (AWS Terrain Tiles) et celui des autres astres solides (tuiles Terrarium du serveur).
import { createBodyTerrainProvider, createTerrainProvider } from './astre-solide.terrain.js';
// Importe le tangage de la vue 3/4, les réglages de l'ombre, la vue three.js traduite et le passage des repères.
import { cesiumShade, fadeProgress, globeCacheOptions, globeScreenError, pitchForTilt, skyVisible, threeViewToCesium, tilesLocalToEcef } from './astre-solide.camera-math.js';

// Règle CSS : globe de près, les repères HTML de la scène three.js (noms, carte de ville, position) sont masqués.
const HIDE_LABELS_CSS = '[data-astre-solide="on"] > .l, [data-astre-solide="on"] > .user-marker, [data-astre-solide="on"] > .city-card { display: none !important; }';

// hideLabelsRule : ajoute la règle une seule fois à la page (début).
function hideLabelsRule() {
  // Déjà présente : rien.
  if (document.querySelector('style[data-astre-solide]')) return;
  // Nouvelle feuille de style.
  const style = document.createElement('style');
  // Sa marque et sa règle.
  style.dataset.astreSolide = ''; style.textContent = HIDE_LABELS_CSS;
  // Ajoutée à l'en-tête.
  document.head.appendChild(style);
// Fin de hideLabelsRule.
}

// Déclare et exporte la classe AstreSolideGlobe (début).
export class AstreSolideGlobe {
  /** @param {object} engine le moteur three.js (SolarEngine) */
  // Constructeur : le moteur.
  constructor(engine) {
    // Garde le moteur.
    this.engine = engine;
    // Astre du globe ({ id, name, radiusKm, airless }) : pas encore choisi.
    this.body = null;
    // De près ou non, passage armé, superposition en cours.
    this.active = false; this.armed = true; this.overlayOn = false;
    // Globe, bibliothèque, ellipsoïde et caméra : pas encore créés.
    this.viewer = null; this.Cesium = null; this.ellipsoid = null; this.camera = null;
    // Conteneur du globe : pas encore créé.
    this.container = null;
    // Création en cours, échec définitif (CesiumJS indisponible), clé du fond de carte posé.
    this.pending = null; this.failed = false; this.imageryKey = null;
  // Fin du constructeur.
  }

  /** Identifiant de l'astre du globe, ou null. */
  // bodyId : l'identifiant de l'astre.
  get bodyId() { return this.body?.id ?? null; }

  // ------------------------------------------------------------ astre visé

  /**
   * Astre visé par le globe (moteur : solidGlobeTarget). S'il change, le globe de l'ancien astre est détruit (un
   * globe CesiumJS a un seul ellipsoïde) ; celui du nouvel astre est créé à la prochaine image.
   */
  // setTarget : l'astre { id, name, radiusKm, airless } (début).
  setTarget(body) {
    // Même astre, ou aucun : rien.
    if (!body || body.id === this.bodyId) return;
    // De près sur l'ancien astre : retour à three.js d'abord.
    if (this.active) this.leave();
    // Superposition coupée, globe détruit.
    this.hideOverlay(); this.destroyViewer();
    // Nouvel astre, passage réarmé.
    this.body = body; this.armed = true;
  // Fin de setTarget.
  }

  /**
   * Crée le globe de l'astre visé une seule fois (CesiumJS n'est téléchargé qu'à la première). Renvoie vrai quand il
   * est prêt, faux en cas d'échec (three.js garde alors l'astre) ou si l'astre visé a changé entre-temps.
   */
  // ensureViewer, asynchrone : le globe (début).
  async ensureViewer() {
    // Déjà prêt : vrai.
    if (this.viewer) return true;
    // Échec précédent ou pas d'astre : faux, sans réessayer.
    if (this.failed || !this.body) return false;
    // Création déjà en cours : on l'attend.
    if (this.pending) return this.pending;
    // Astre de cette création.
    const body = this.body;
    // Création (début).
    this.pending = (async () => {
      // Nouveau conteneur.
      const div = document.createElement('div');
      // Plein cadre, au-dessus du canevas, masqué pour l'instant. Il laisse passer les gestes : la souris, le doigt et
      // la molette arrivent au canevas three.js, dont les commandes pilotent la caméra du globe (même déplacement).
      div.style.cssText = 'position:absolute;inset:0;display:none;pointer-events:none;';
      // Son nom et son astre.
      div.dataset.engine = 'astre-solide'; div.dataset.body = body.id;
      // Posé juste après le canevas three.js, à la même place.
      this.engine.canvas.after(div);
      // Essai (début).
      try {
        // Globe, bibliothèque et ellipsoïde de l'astre.
        const made = await createSolidViewer(div, body);
        // L'astre visé a changé pendant la création : ce globe ne sert plus.
        if (this.body !== body || this.engine.stopped) { made.viewer.destroy(); div.remove(); return false; }
        // Gardés.
        ({ viewer: this.viewer, Cesium: this.Cesium, ellipsoid: this.ellipsoid } = made); this.container = div;
        // Le globe doit porter l'ellipsoïde de l'astre (sinon ses tuiles ne se poseraient pas au bon endroit) :
        // sinon, il est détruit et la création est considérée comme un échec (three.js garde l'astre).
        if (this.viewer.scene.globe.ellipsoid !== this.ellipsoid) {
          this.viewer.destroy(); div.remove();
          this.viewer = null; this.container = null; this.Cesium = null; this.ellipsoid = null;
          this.failed = true; this.armed = false;
          return false;
        }
      // Échec (CesiumJS indisponible) : three.js garde les astres, plus d'essai.
      } catch { this.failed = true; this.armed = false; div.remove(); return false; }
      // Caméra pilotée par les commandes de three.js, réglée sur le rayon de l'astre.
      this.camera = new CesiumCamera({ viewer: this.viewer, Cesium: this.Cesium, engine: this.engine, body });
      // Relief posé dès la création (avant la première image) : pas de changement de fournisseur pendant le zoom.
      this.syncTerrain();
      // À chaque mouvement : verrou du nord, HUD, et retour à la scène three.js si la caméra s'éloigne.
      this.viewer.camera.changed.addEventListener(() => this.onCameraChange());
      // Sensibilité du changement de caméra : 1 % (assez pour suivre le zoom).
      this.viewer.camera.percentageChanged = 0.01;
      // Écran tactile (téléphone, tablette) : tuiles un peu moins fines au repos.
      this.touch = Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);
      // Gamme de l'appareil (profil de rendu du moteur three.js) : moins de tuiles sur un téléphone modeste.
      this.tier = this.engine?.basePower?.tier || 'high';
      // Mémoire des tuiles déjà vues et préchargement des voisines, selon l'appareil (voir globeCacheOptions).
      Object.assign(this.viewer.scene.globe, globeCacheOptions({ touch: this.touch, tier: this.tier }));
      // Finesse des tuiles au repos.
      this.setMoving(false);
      // En mouvement : tuiles plus grossières (moins de tuiles chargées et dessinées) ; à l'arrêt : finesse normale.
      this.viewer.camera.moveStart.addEventListener(() => this.setMoving(true));
      // À l'arrêt : finesse normale.
      this.viewer.camera.moveEnd.addEventListener(() => this.setMoving(false));
      // Après chaque image du globe de près : la scène three.js redessine l'espace derrière, vue de la même caméra.
      this.viewer.scene.postRender.addEventListener(() => this.drawBackdrop());
      // Avant chaque image du globe de près : heure de l'app, fondu de l'ombre, Soleil et rotation automatique.
      this.viewer.scene.preUpdate.addEventListener(() => this.tick());
      // Fond de carte à poser au prochain réglage, ombre à régler.
      this.imageryKey = null; this.shadeApplied = undefined;
      // Prêt.
      return true;
    // Fin de la création.
    })();
    // Attend la fin de la création, puis l'oublie.
    try { return await this.pending; } finally { this.pending = null; }
  // Fin de ensureViewer.
  }

  // destroyViewer : détruit le globe de l'astre en cours (début).
  destroyViewer() {
    // Globe détruit, s'il existe.
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.destroy();
    // Conteneur retiré.
    this.container?.remove();
    // Plus de globe.
    this.viewer = null; this.container = null; this.camera = null; this.ellipsoid = null; this.imageryKey = null; this.terrain = null; this.bodyTerrain = null; this.terrainKey = undefined;
  // Fin de destroyViewer.
  }

  // ------------------------------------------------------------ passage de près

  /** À chaque image three.js : passe la main au globe quand la caméra s'approche de l'astre ciblé. */
  // update : l'astre ciblé ou non, la distance de la caméra au centre, la distance visée par le zoom et le rayon
  // (unités de la scène), sa direction.
  update({ focused, dist, distGoal = dist, radius, camLocal }) {
    // Sans astre : rien.
    if (!this.body) return;
    // De près : ni ombre ni pollution lumineuse (fondu terminé).
    if (this.active) { this.zoomFade = 0; return; }
    // Altitude de la caméra, en km de l'astre (gardée pour le relief au zoom, voir syncTerrain).
    const altKm = this.altKm = altitudeKm(dist, radius, this.body.radiusKm);
    // Fondu du zoom : l'ombre et la pollution lumineuse baissent en approchant de l'astre ciblé.
    this.zoomFade = focused ? zoomFade(altKm, this.body.radiusKm) : 1;
    // En création : rien de plus.
    if (this.pending) return;
    // Réarme le passage si la caméra est assez haute.
    this.armed = rearm(this.armed, altKm, this.body.radiusKm);
    // Pas de passage : rien.
    if (!shouldEnter({ focused, altKm, armed: this.armed, radiusKm: this.body.radiusKm })) return;
    // Passe la main au globe au même endroit ; le zoom three.js en cours continue dans le globe (même altitude visée).
    this.enter({ ...lonLatOf(camLocal), altKm, goalKm: altitudeKm(distGoal, radius, this.body.radiusKm) });
  // Fin de update.
  }

  /** La cible change : une autre cible que l'astre du globe ramène à la scène three.js. */
  // onFocus : vrai si la nouvelle cible est l'astre du globe.
  onFocus(isBody) { if (this.active && !isBody) this.leave(); }

  // enter, asynchrone : le globe prend la main au-dessus de l'astre (début).
  async enter({ lon, lat, altKm, goalKm }) {
    // Globe pas encore prêt : création (ou attente de celle en cours).
    if (!this.viewer && !(await this.ensureViewer())) return;
    // Moteur détruit entre-temps : rien.
    if (this.engine.stopped) return;
    // Rayon de l'astre (m).
    const radiusM = this.body.radiusKm * 1000;
    // L'astre était déjà dessiné par le globe : sa caméra est au même endroit, on la garde (passage sans saut) ;
    // sinon, caméra du globe au même endroit, vue vers le sol.
    if (!this.overlayOn) this.viewer.camera.setView({ destination: this.Cesium.Cartesian3.fromDegrees(lon, lat, altKm * 1000, this.ellipsoid), orientation: { heading: 0, pitch: this.Cesium.Math.toRadians(pitchForTilt(this.engine.tiltOn, altKm * 1000, radiusM)), roll: 0 } });
    // Plans proche et lointain d'origine de CesiumJS (la superposition les règle autour de l'astre).
    this.viewer.camera.frustum.near = 1; this.viewer.camera.frustum.far = 5e8;
    // La superposition est finie : le globe a la main.
    this.overlayOn = false; this.engine.cesiumOverlayOn = false;
    // Globe affiché, repères HTML de la scène three.js masqués.
    this.container.style.display = 'block'; this.container.style.opacity = '1'; this.fadeStart = -Infinity; hideLabelsRule(); this.setLabelsHidden(true);
    // Rendu du globe relancé.
    this.viewer.useDefaultRenderLoop = true;
    // Une image tout de suite.
    this.viewer.scene.requestRender();
    // De près.
    this.active = true;
    // Scène three.js en attente.
    this.engine.cesiumHold = true;
    // Horloge de la boucle du globe repartie de maintenant, ombre, Soleil et fond de carte réglés tout de suite.
    this.lastTick = performance.now(); this.shadeApplied = undefined; this.applyShade(); this.syncSun(); this.syncImagery();
    // Espace de la scène three.js dessiné tout de suite derrière le globe (sans attendre la première image du globe).
    this.drawBackdrop();
    // Zoom three.js en cours (altitude visée plus basse) : il continue dans le globe, au même rythme.
    if (goalKm > 0 && goalKm < altKm) this.camera.setAltitudeGoal(goalKm * 1000);
    // HUD : distance, échelle et boussole du globe.
    this.camera.publishHud();
  // Fin de enter.
  }

  // onCameraChange : la caméra du globe a bougé (début).
  onCameraChange() {
    // Pas de près : rien.
    if (!this.active) return;
    // Verrou du nord actif : le nord reste en haut.
    if (this.engine.northLock) this.camera.keepNorth();
    // HUD à jour.
    this.camera.publishHud();
    // Retour à la scène three.js si la caméra s'est éloignée.
    this.watchExit();
  // Fin de onCameraChange.
  }

  // watchExit : la caméra du globe a bougé (début).
  watchExit() {
    // Pas de près : rien.
    if (!this.active) return;
    // Position de la caméra du globe.
    const c = this.viewer.camera.positionCartographic;
    // Pas assez haute : rien.
    if (!shouldExit(c.height / 1000, this.body.radiusKm)) return;
    // Retour à la scène three.js au même endroit.
    this.leave({ lon: this.Cesium.Math.toDegrees(c.longitude), lat: this.Cesium.Math.toDegrees(c.latitude) });
  // Fin de watchExit.
  }

  /** Rend la main à la scène three.js (au-dessus du lieu donné, s'il y en a un). */
  // leave : le lieu du retour (début).
  leave(place = null) {
    // Pas de près : rien.
    if (!this.active) return;
    // Plus de près, passage désarmé jusqu'à ce que la caméra three.js remonte.
    this.active = false; this.armed = false;
    // L'ombre du bouton « Ombre » reviendra à la prochaine image de la superposition.
    this.shadeApplied = undefined;
    // Retour à three.js : plus de lien de vue (ancre effacée, bouton du HUD masqué).
    if (globalThis.location?.hash?.startsWith('#vue=')) setViewHash('');
    // Bouton du HUD masqué.
    this.engine.hud?.set({ viewLink: '' });
    // Globe masqué (la superposition le réaffiche à la prochaine image three.js), sa boucle arrêtée, repères HTML de
    // la scène three.js rendus.
    this.container.style.display = 'none'; this.viewer.useDefaultRenderLoop = false; this.setLabelsHidden(false);
    // Scène three.js relancée.
    this.engine.cesiumHold = false;
    // L'horloge three.js repart de maintenant, sans saut de temps.
    this.engine.lastNow = performance.now();
    // Avec un lieu : la caméra three.js se place au-dessus, à l'altitude de retour de l'astre, sans animation de zoom.
    if (place) { this.engine.goToSite(this.body.id, place, scaledKm(RETURN_KM, this.body.radiusKm)); this.engine.dist = this.engine.distGoal; }
    // Note l'activité.
    this.engine.markActive?.();
  // Fin de leave.
  }

  // ------------------------------------------------------------ superposition

  /**
   * Superposition, à chaque image de three.js tant que le globe n'a pas la main : l'astre est dessiné par CesiumJS
   * par-dessus la scène three.js, vu de la même caméra. `view` : vue de la caméra three.js dans le repère des tuiles
   * de l'astre (engine.solidBodyView). Renvoie vrai si le globe dessine l'astre à cette image (celui de three.js est
   * alors caché), faux sinon (globe pas encore prêt, astre hors de l'écran ou sous un pixel).
   */
  // overlayFrame : la vue de la caméra three.js (début).
  overlayFrame(view) {
    // Le globe a la main (vue de près) ou pas d'astre : rien ici.
    if (this.active || !this.body) return false;
    // Globe pas encore créé : création lancée (une fois), l'astre de three.js reste affiché en attendant.
    if (!this.viewer) { if (!this.pending && !this.failed) this.ensureViewer(); return false; }
    // Sans vue : superposition coupée.
    if (!view) return this.hideOverlay();
    // Vue traduite pour la caméra du globe, au rayon de l'astre.
    const v = threeViewToCesium(view, { ...view, radiusM: this.body.radiusKm * 1000 });
    // Astre hors de l'écran : superposition coupée (rien à dessiner).
    if (!v.inView) return this.hideOverlay();
    // Bibliothèque et caméra du globe.
    const { Cesium } = this, cam = this.viewer.camera;
    // Même position, même regard, même haut que la caméra three.js.
    cam.setView({ destination: new Cesium.Cartesian3(v.position.x, v.position.y, v.position.z), orientation: { direction: new Cesium.Cartesian3(v.direction.x, v.direction.y, v.direction.z), up: new Cesium.Cartesian3(v.up.x, v.up.y, v.up.z) } });
    // Même ouverture et mêmes proportions ; plans qui encadrent l'astre.
    cam.frustum.fov = v.fov; cam.frustum.aspectRatio = v.aspect; cam.frustum.near = v.near; cam.frustum.far = v.far;
    // Soleil de la scène three.js.
    this.syncSun(view.sunDir);
    // Globe affiché, s'il ne l'était pas.
    if (!this.overlayOn) { this.container.style.opacity = '0'; this.container.style.display = 'block'; this.overlayOn = true; this.engine.cesiumOverlayOn = true; this.shownAt = performance.now(); this.fadeStart = null; }
    // Vrai : le globe dessine l'astre.
    return true;
  // Fin de overlayFrame.
  }

  /** Dessine le globe par-dessus l'image three.js qui vient d'être faite (heure, ombre et fond de carte à jour). */
  // drawOverlay : une image du globe (début).
  drawOverlay() {
    // Superposition coupée ou globe de près : rien.
    if (!this.overlayOn || this.active) return;
    // Horloge du globe à l'heure de l'app.
    this.viewer.clock.currentTime = this.Cesium.JulianDate.fromDate(new Date(this.engine.simMs ?? Date.now()), this.viewer.clock.currentTime);
    // Ombre du globe (bouton « Ombre »), fond de carte de l'app et définition de la scène three.js.
    this.applyShade(); this.syncImagery(); this.syncResolution();
    // Image demandée (rendu à la demande), puis dessinée tout de suite.
    this.viewer.scene.requestRender(); this.viewer.resize(); this.viewer.render();
    // Fondu d'apparition : il démarre quand les tuiles visibles sont arrivées (ou au plus tard après FADE_WAIT_MS),
    // pour ne jamais montrer le sol uni d'attente ; opacité du globe à jour.
    const now = performance.now();
    if (this.fadeStart == null && (this.viewer.scene.globe.tilesLoaded || now - (this.shownAt ?? now) > AstreSolideGlobe.FADE_WAIT_MS)) this.fadeStart = now;
    this.container.style.opacity = String(this.fadeIn);
  // Fin de drawOverlay.
  }

  // hideOverlay : coupe la superposition et renvoie faux (début).
  hideOverlay() {
    // Si elle était active : globe masqué, astre de three.js rendu.
    if (this.overlayOn) { if (this.container) this.container.style.display = 'none'; this.overlayOn = false; this.engine.cesiumOverlayOn = false; this.fadeStart = null; }
    // Faux : three.js dessine l'astre.
    return false;
  // Fin de hideOverlay.
  }

  // ------------------------------------------------------------ lumière, ombre, imagerie

  /**
   * Soleil du globe : même direction que dans la scène three.js. `sunDir` : direction de l'astre vers le Soleil dans
   * le repère des tuiles de l'astre (sinon demandée au moteur). La lumière voyage du Soleil vers l'astre.
   */
  // syncSun : la direction du Soleil (début).
  syncSun(sunDir = this.engine.solidBodyView?.(this.body.id)?.sunDir) {
    // Sans direction ou sans lumière : rien.
    if (!sunDir || !this.viewer?.scene.light) return;
    // Direction vers le Soleil, dans le repère de l'astre de CesiumJS.
    const d = tilesLocalToEcef(sunDir, 1);
    // La lumière voyage dans l'autre sens.
    this.viewer.scene.light.direction = new this.Cesium.Cartesian3(-d.x, -d.y, -d.z);
  // Fin de syncSun.
  }

  /**
   * Relief en volume de l'astre du globe (la Terre : AWS Terrain Tiles ; la Lune, Mars, Mercure, Vénus : tuiles
   * Terrarium servies par le serveur, même découpage géographique que le globe) : suit le réglage « Relief » de
   * l'app (allumé, éteint, exagération). Le fournisseur d'altitudes n'est posé ou retiré que quand le réglage
   * change (créé une fois par astre : ses tuiles restent en mémoire).
   */
  // syncTerrain : pose ou retire le relief du globe (début).
  syncTerrain() {
    // Sans globe : rien.
    if (!this.viewer) return;
    // Réglage « Relief » de l'app pour l'astre courant (null si l'astre n'a pas de relief Terrarium).
    const r = this.engine.solidRelief?.(this.body.id) ?? null;
    // Relief possible pour cet astre : la Terre a son fournisseur AWS ; les autres ont besoin d'une source à modèle.
    const possible = r && (this.body.id === 'earth' || r.terrain?.template);
    // Clé du réglage : astre, « off » ou l'exagération.
    const key = `${this.body.id}:${possible && r.on ? `on:${r.exaggeration}` : 'off'}`;
    // Inchangé : seule l'exagération au zoom est mise à jour.
    if (key === this.terrainKey) { this.applyReliefZoom(possible && r.on, r); return; }
    // Relief allumé ou éteint avant et maintenant.
    const wasOn = Boolean(this.terrainKey?.includes(':on:')), on = key.includes(':on:');
    // Noté.
    this.terrainKey = key;
    // Fournisseur changé seulement si le relief s'allume ou s'éteint (créé une fois : ses tuiles restent en mémoire).
    if (on !== wasOn) {
      // Fournisseur : aucun relief, le fournisseur de la Terre, ou celui de l'astre (tuiles Terrarium du serveur).
      const provider = !on
        ? new this.Cesium.EllipsoidTerrainProvider({ ellipsoid: this.ellipsoid })
        : this.body.id === 'earth'
          ? (this.terrain || (this.terrain = createTerrainProvider(this.Cesium, this.ellipsoid)))
          : (this.bodyTerrain || (this.bodyTerrain = createBodyTerrainProvider(this.Cesium, this.ellipsoid, r.terrain)));
      // Posé.
      this.viewer.terrainProvider = provider;
    // Fin du changement.
    }
    // Exagération au zoom.
    this.applyReliefZoom(on, r);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de syncTerrain.
  }

  /**
   * Relief au zoom : aucun de loin, fondu en approchant, complet de près (voir reliefRamp). Le fournisseur de relief
   * reste posé (le changer viderait toutes les tuiles du globe, qui disparaîtrait le temps de les recharger) : seule
   * l'exagération des altitudes varie (CesiumJS 1.116 et plus), sans rechargement des tuiles.
   */
  // applyReliefZoom : relief allumé ou non, et le réglage (début).
  applyReliefZoom(on, r) {
    // Sans réglage d'exagération dans cette version de CesiumJS : rien.
    if (!('verticalExaggeration' in this.viewer.scene)) return;
    // Altitude de la caméra (km) : celle du globe de près, celle de three.js sinon.
    const altKm = this.active ? (this.camera?.altitudeM ?? 0) / 1000 : this.altKm;
    // Exagération voulue : celle du réglage × la part du relief à cette altitude (presque 0 de loin, jamais 0 pile).
    const exag = on ? Math.max(1e-3, r.exaggeration * reliefRamp(altKm, this.body.radiusKm)) : 1;
    // Posée seulement si elle change (une image de plus pour la montrer).
    if (this.viewer.scene.verticalExaggeration !== exag) { this.viewer.scene.verticalExaggeration = exag; this.viewer.scene.requestRender(); }
  // Fin de applyReliefZoom.
  }

  /**
   * Fond de carte d'un astre autre que la Terre : celui choisi dans l'app (moteur : solidImagery), lu par CesiumJS
   * avec le même découpage. Reposé seulement quand il change (un autre fond choisi dans le menu). Relief : voir
   * syncTerrain.
   */
  // syncImagery : pose le fond de carte de l'app sur le globe, et le relief (début).
  syncImagery() {
    // Relief en volume (Terre) d'après le réglage de l'app.
    this.syncTerrain();
    // La Terre garde ses couches ouvertes ; sans globe : rien.
    if (!this.viewer || this.body.id === 'earth') return;
    // Astre courant (garde contre un changement d'astre pendant un chargement).
    const bodyId = this.body.id;
    // Fond de carte de l'app pour cet astre (ou null).
    const img = this.engine.solidImagery?.(bodyId) ?? null;
    // Même fond qu'avant : rien.
    if ((img?.key ?? null) === this.imageryKey) return;
    // Noté (jeton : une couche plus récente annule celle-ci).
    this.imageryKey = img?.key ?? null;
    // Anciennes couches retirées et libérées (jamais de retour en arrière vers un ancien astre).
    this.viewer.imageryLayers.removeAll(true);
    // Sans fond : le globe reste à sa couleur de base.
    if (!img) return;
    // Fournisseur qui lit la source de tuiles de l'app, sur l'ellipsoïde de l'astre (même grille 2^(z+1) × 2^z).
    const provider = tileSourceImageryProvider(this.Cesium, { source: img.source, projectionId: img.projectionId, ellipsoid: this.ellipsoid, credit: img.credit });
    // Échec d'une tuile : signalé dans la console (sinon le globe reste uni sans erreur visible).
    provider.errorEvent?.addEventListener((err) => {
      console.error('[Cesium Imagery Error]', {
        bodyId,
        url: provider.url || img.source?.info?.urlTemplate || '',
        level: err?.level, x: err?.x, y: err?.y,
        timesRetried: err?.timesRetried,
        message: err?.message,
      });
    });
    // Ajouté au globe, bien visible.
    const layer = new this.Cesium.ImageryLayer(provider);
    layer.show = true; layer.alpha = 1.0;
    this.viewer.imageryLayers.add(layer);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de syncImagery.
  }

  /**
   * Avant chaque image du globe de près (la scène three.js est en attente, sa boucle ne tourne pas) : l'heure de l'app
   * avance comme dans three.js (heure réelle à vitesse 1, sinon temps accéléré) ; le fondu du bouton « Ombre » avance ;
   * le Soleil et le fond de carte suivent ; la rotation automatique tourne la caméra à la même vitesse que three.js.
   */
  // tick : une image de la boucle du globe (début).
  tick() {
    // Pas de près : rien.
    if (!this.active) return;
    // Le moteur, l'instant présent et le temps écoulé (borné à 100 ms).
    const e = this.engine, now = performance.now(), dt = Math.min(100, Math.max(0, now - (this.lastTick ?? now)));
    // Note l'instant.
    this.lastTick = now;
    // Heure de l'app : réelle à vitesse 1, sinon accélérée, comme dans la boucle de three.js.
    e.simMs = e.speed === 1 || !Number.isFinite(e.simMs) ? Date.now() : e.simMs + dt * e.speed;
    // Horloge du globe à cette heure.
    this.viewer.clock.currentTime = this.Cesium.JulianDate.fromDate(new Date(e.simMs), this.viewer.clock.currentTime);
    // Fondu du bouton « Ombre » (avancé ici tant que la boucle de three.js est en attente).
    e.updateShadeFade?.(dt);
    // Ombre, Soleil, fond de carte et définition à jour.
    this.applyShade(); this.syncSun(); this.syncImagery(); this.syncResolution();
    // Rotation automatique, hors glisser.
    if (e.autoRotate && !e.drag) this.camera.autoRotate(dt);
  // Fin de tick.
  }

  /**
   * Définition du globe : même densité de pixels que la scène three.js (engine.dpr, réglée par l'énergie et la
   * surchauffe), voir cesiumResolutionScale. Net sur écran Retina, sans dépasser la charge choisie par l'app.
   */
  // syncResolution : règle l'échelle de rendu du globe (début).
  syncResolution() {
    // Sans globe : rien.
    if (!this.viewer) return;
    // Échelle voulue.
    const scale = cesiumResolutionScale(this.engine.dpr, globalThis.devicePixelRatio);
    // Inchangée : rien.
    if (this.viewer.resolutionScale === scale) return;
    // Appliquée (le canevas du globe est redimensionné), puis une image.
    this.viewer.resolutionScale = scale; this.viewer.scene.requestRender();
  // Fin de syncResolution.
  }

  /** Finesse des tuiles du globe selon le mouvement de la caméra (voir globeScreenError). */
  // setMoving : vrai pendant que la caméra bouge (début).
  setMoving(moving) {
    // Sans globe : rien.
    if (!this.viewer) return;
    // Erreur d'écran tolérée.
    const sse = globeScreenError({ moving, touch: this.touch, tier: this.tier });
    // Inchangée : rien.
    if (this.viewer.scene.globe.maximumScreenSpaceError === sse) return;
    // Appliquée.
    this.viewer.scene.globe.maximumScreenSpaceError = sse;
    // À l'arrêt : une image pour charger les tuiles fines.
    if (!moving) this.viewer.scene.requestRender();
  // Fin de setMoving.
  }

  /**
   * Bouton « Ombre » : l'intensité d'ombre de l'app (engine.shadeNow, avec son fondu) appliquée au globe. En zoomant
   * sur l'astre, elle baisse en fondu (zoomFade) ; de près (globe de près), elle est coupée : sol entièrement éclairé.
   */
  // Durée caractéristique (ms) de la transition du fondu du zoom.
  static FADE_MS = 450;
  // Fondu d'apparition du globe par-dessus three.js : durée (ms), et attente maximale des tuiles avant de le lancer.
  static FADE_IN_MS = 400;
  static FADE_WAIT_MS = 1500;

  /** Opacité du globe dans son fondu d'apparition (0 à 1 ; 1 de près), voir fadeProgress. */
  // fadeIn : l'opacité.
  get fadeIn() { return fadeProgress(this.fadeStart, performance.now(), AstreSolideGlobe.FADE_IN_MS); }

  /**
   * Fondu du zoom adouci : il rejoint sa cible (fondu du zoom, 0 de près) en exponentielle, à chaque image, au lieu de
   * sauter. Tant qu'il n'a pas rejoint sa cible, une image du globe est redemandée (rendu à la demande). Renvoie le
   * fondu de cette image (aussi gardé dans `visualFade`, lu par la couche d'ombre et de lumières de la Terre).
   */
  // easeFade : avance le fondu (début).
  easeFade() {
    // Instant présent et temps écoulé depuis la dernière avance (borné à 100 ms).
    const now = performance.now(), dt = Math.min(100, Math.max(0, now - (this.fadeT ?? now)));
    // Noté.
    this.fadeT = now;
    // Cible : 0 de près, sinon le fondu du zoom.
    const goal = this.active ? 0 : (this.zoomFade ?? 1);
    // Valeur actuelle (la cible à la première image).
    const cur = this.visualFade ?? goal;
    // Avance exponentielle ; collée à la cible quand l'écart est imperceptible.
    const next = cur + (goal - cur) * (1 - Math.exp(-dt / AstreSolideGlobe.FADE_MS));
    // Gardé.
    this.visualFade = Math.abs(goal - next) < 0.002 ? goal : next;
    // Transition en cours : une autre image du globe.
    if (this.visualFade !== goal) this.viewer?.scene.requestRender();
    // Le fondu de cette image.
    return this.visualFade;
  // Fin de easeFade.
  }

  // applyShade : règle l'éclairage du globe (début).
  applyShade() {
    // Intensité : 0 quand on a zoomé sur l'astre (globe de près : sol entièrement éclairé, sans ombre jour/nuit) ;
    // sinon celle du bouton « Ombre » (ombre pleine si elle n'a jamais été réglée), baissée par le fondu du zoom.
    // Fondu du zoom adouci dans le temps (voir easeFade) : l'ombre et la pollution lumineuse disparaissent et
    // reviennent en transition, même quand le zoom saute un palier ou que le globe de près prend ou rend la main.
    const fade = this.easeFade();
    // Intensité : celle du bouton « Ombre » (ombre pleine si elle n'a jamais été réglée), baissée par ce fondu. La Terre
    // a son ombre en couche three.js (engine pollution-lumineuse, terminateur en dégradé) : son globe reste éclairé.
    const v = this.body?.id === 'earth' ? 0 : (this.engine.shadeNow ?? 1) * fade;
    // Distance de la caméra au centre de l'astre (m).
    const p = this.viewer.camera.positionWC, d = Math.hypot(p.x, p.y, p.z);
    // Déjà appliquée, caméra à moins de 1 000 km de la distance du réglage (écart d'ombre < 0,0001) : rien.
    if (v === this.shadeApplied && Math.abs(d - (this.shadeDist ?? -Infinity)) < 1e6) return;
    // Notées.
    this.shadeApplied = v; this.shadeDist = d;
    // Réglages du globe.
    const g = this.viewer.scene.globe, s = cesiumShade(v, d);
    // Éclairage du Soleil et obscurité de la face nuit (relief).
    g.enableLighting = s.enableLighting; g.vertexShadowDarkness = s.vertexShadowDarkness;
    // Globe plat : fondu de l'ombrage jour/nuit réglé pour valoir l'intensité vue de la caméra.
    g.lightingFadeOutDistance = s.lightingFadeOutDistance; g.lightingFadeInDistance = s.lightingFadeInDistance;
    // Une image (le fond three.js, dont les autres astres, est redessiné avec la même ombre).
    this.viewer.scene.requestRender();
  // Fin de applyShade.
  }

  /**
   * Fond spatial : le globe a un fond transparent ; la scène three.js (étoiles, Soleil, planètes, satellites), sans
   * l'astre du globe, est redessinée dessous avec la position, le regard et l'ouverture de la caméra du globe.
   */
  // drawBackdrop : redessine l'espace de la scène three.js derrière le globe (début).
  drawBackdrop() {
    // Pas de près, ou moteur sans fond : rien.
    if (!this.active || !this.engine.renderCesiumBackdrop) return;
    // Caméra du globe.
    const cam = this.viewer.camera;
    // Rayon de l'astre (m).
    const radiusM = this.body.radiusKm * 1000;
    // Sol dans toute l'image (regard vers le sol, de près) : l'espace est caché par le globe, il n'est pas redessiné
    // (une image complète de la scène three.js de moins) ; seule l'atmosphère l'est.
    const space = skyVisible({ position: cam.positionWC, direction: cam.directionWC, up: cam.upWC, fovy: cam.frustum.fovy, aspect: cam.frustum.aspectRatio, radiusM });
    // Le moteur three.js dessine l'espace vu de cette caméra (repère de l'astre en mètres ; ouverture en radians).
    this.engine.renderCesiumBackdrop({ bodyId: this.body.id, radiusM, position: cam.positionWC, direction: cam.directionWC, up: cam.upWC, fovy: cam.frustum.fovy, space });
  // Fin de drawBackdrop.
  }

  // setLabelsHidden : marque le parent du conteneur de la scène (où vivent les repères HTML).
  setLabelsHidden(on) {
    // Le parent des repères.
    const parent = this.engine.container?.parentNode;
    // Marqué ou démarqué.
    if (parent) { if (on) parent.dataset.astreSolide = 'on'; else delete parent.dataset.astreSolide; }
  // Fin de setLabelsHidden.
  }

  // dispose : libère le globe (début).
  dispose() {
    // Scène three.js libérée de l'attente, repères rendus.
    this.engine.cesiumHold = false; this.setLabelsHidden(false);
    // Superposition coupée, globe détruit.
    this.hideOverlay(); this.destroyViewer(); this.active = false;
  // Fin de dispose.
  }
// Fin de la classe AstreSolideGlobe.
}
