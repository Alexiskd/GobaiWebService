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
import { RETURN_KM, altitudeKm, lonLatOf, rearm, scaledKm, shouldEnter, shouldExit } from './astre-solide.handoff.js';
// Importe la création du globe.
import { createSolidViewer } from './astre-solide.viewer.js';
// Importe le fournisseur d'images qui lit le fond de carte de l'app.
import { tileSourceImageryProvider } from './astre-solide.imagery.js';
// Importe la caméra du globe pilotée par les commandes de three.js (navball, zoom, verrous).
import { CesiumCamera } from './astre-solide.camera.js';
// Importe le tangage de la vue 3/4, les réglages de l'ombre, la vue three.js traduite et le passage des repères.
import { cesiumShade, pitchForTilt, threeViewToCesium, tilesLocalToEcef } from './astre-solide.camera-math.js';

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
      // Échec (CesiumJS indisponible) : three.js garde les astres, plus d'essai.
      } catch { this.failed = true; this.armed = false; div.remove(); return false; }
      // Caméra pilotée par les commandes de three.js, réglée sur le rayon de l'astre.
      this.camera = new CesiumCamera({ viewer: this.viewer, Cesium: this.Cesium, engine: this.engine, body });
      // À chaque mouvement : verrou du nord, HUD, et retour à la scène three.js si la caméra s'éloigne.
      this.viewer.camera.changed.addEventListener(() => this.onCameraChange());
      // Sensibilité du changement de caméra : 1 % (assez pour suivre le zoom).
      this.viewer.camera.percentageChanged = 0.01;
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
    this.viewer = null; this.container = null; this.camera = null; this.ellipsoid = null; this.imageryKey = null;
  // Fin de destroyViewer.
  }

  // ------------------------------------------------------------ passage de près

  /** À chaque image three.js : passe la main au globe quand la caméra s'approche de l'astre ciblé. */
  // update : l'astre ciblé ou non, la distance de la caméra au centre, la distance visée par le zoom et le rayon
  // (unités de la scène), sa direction.
  update({ focused, dist, distGoal = dist, radius, camLocal }) {
    // De près, en création ou sans astre : rien.
    if (this.active || this.pending || !this.body) return;
    // Altitude de la caméra, en km de l'astre.
    const altKm = altitudeKm(dist, radius, this.body.radiusKm);
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
    this.container.style.display = 'block'; hideLabelsRule(); this.setLabelsHidden(true);
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
    if (!this.overlayOn) { this.container.style.display = 'block'; this.overlayOn = true; this.engine.cesiumOverlayOn = true; }
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
    // Ombre du globe (bouton « Ombre ») et fond de carte de l'app.
    this.applyShade(); this.syncImagery();
    // Image demandée (rendu à la demande), puis dessinée tout de suite.
    this.viewer.scene.requestRender(); this.viewer.resize(); this.viewer.render();
  // Fin de drawOverlay.
  }

  // hideOverlay : coupe la superposition et renvoie faux (début).
  hideOverlay() {
    // Si elle était active : globe masqué, astre de three.js rendu.
    if (this.overlayOn) { if (this.container) this.container.style.display = 'none'; this.overlayOn = false; this.engine.cesiumOverlayOn = false; }
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
   * Fond de carte d'un astre autre que la Terre : celui choisi dans l'app (moteur : solidImagery), lu par CesiumJS
   * avec le même découpage. Reposé seulement quand il change (un autre fond choisi dans le menu).
   */
  // syncImagery : pose le fond de carte de l'app sur le globe (début).
  syncImagery() {
    // La Terre garde ses couches ouvertes ; sans globe : rien.
    if (!this.viewer || this.body.id === 'earth') return;
    // Fond de carte de l'app pour cet astre (ou null).
    const img = this.engine.solidImagery?.(this.body.id) ?? null;
    // Même fond qu'avant : rien.
    if ((img?.key ?? null) === this.imageryKey) return;
    // Noté.
    this.imageryKey = img?.key ?? null;
    // Anciennes couches retirées.
    this.viewer.imageryLayers.removeAll();
    // Sans fond : le globe reste à sa couleur de base.
    if (!img) return;
    // Fournisseur qui lit la source de tuiles de l'app.
    const provider = tileSourceImageryProvider(this.Cesium, { source: img.source, projectionId: img.projectionId, ellipsoid: this.ellipsoid, credit: img.credit });
    // Ajouté au globe.
    this.viewer.imageryLayers.add(new this.Cesium.ImageryLayer(provider));
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
    // Ombre, Soleil et fond de carte à jour.
    this.applyShade(); this.syncSun(); this.syncImagery();
    // Rotation automatique, hors glisser.
    if (e.autoRotate && !e.drag) this.camera.autoRotate(dt);
  // Fin de tick.
  }

  /** Bouton « Ombre » : l'intensité d'ombre de l'app (engine.shadeNow, avec son fondu) appliquée au globe. */
  // applyShade : règle l'éclairage du globe (début).
  applyShade() {
    // Intensité actuelle (ombre pleine si elle n'a jamais été réglée).
    const v = this.engine.shadeNow ?? 1;
    // Déjà appliquée : rien.
    if (v === this.shadeApplied) return;
    // Notée.
    this.shadeApplied = v;
    // Réglages du globe.
    const g = this.viewer.scene.globe, s = cesiumShade(v);
    // Éclairage du Soleil et obscurité de la face nuit.
    g.enableLighting = s.enableLighting; g.vertexShadowDarkness = s.vertexShadowDarkness;
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
    // Le moteur three.js dessine l'espace vu de cette caméra (repère de l'astre en mètres ; ouverture en radians).
    this.engine.renderCesiumBackdrop({ bodyId: this.body.id, radiusM: this.body.radiusKm * 1000, position: cam.positionWC, direction: cam.directionWC, up: cam.upWC, fovy: cam.frustum.fovy });
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
