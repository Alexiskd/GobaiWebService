/**
 * Module cesium-earth : la Terre de près est affichée par CesiumJS, le système solaire reste en three.js.
 *
 * Le moteur three.js appelle `update` à chaque image et `onFocus` à chaque changement de cible. Quand le globe
 * CesiumJS a la main, il est posé par-dessus le canevas three.js (l'interface de l'app reste au-dessus) et la scène
 * three.js est mise en attente (`engine.cesiumHold`). Le fond du globe est transparent : à chaque image du globe, la
 * scène three.js redessine seulement l'espace (sans la Terre), vu de la caméra du globe (`drawBackdrop`).
 */

// Importe les règles du passage.
import { RETURN_KM, altitudeKm, lonLatOf, rearm, shouldEnter, shouldExit } from './cesium-earth.handoff.js';
// Importe la création du globe.
import { createEarthViewer } from './cesium-earth.viewer.js';
// Importe la caméra du globe pilotée par les commandes de three.js (navball, zoom, verrous).
import { CesiumCamera } from './cesium-earth.camera.js';
// Importe le tangage de la vue 3/4.
import { pitchForTilt } from './cesium-earth.camera-math.js';

// Règle CSS : globe actif, les repères HTML de la scène three.js (noms, carte de ville, position) sont masqués.
const HIDE_LABELS_CSS = '[data-cesium-earth="on"] > .l, [data-cesium-earth="on"] > .user-marker, [data-cesium-earth="on"] > .city-card { display: none !important; }';

// hideLabelsRule : ajoute la règle une seule fois à la page (début).
function hideLabelsRule() {
  // Déjà présente : rien.
  if (document.querySelector('style[data-cesium-earth]')) return;
  // Nouvelle feuille de style.
  const style = document.createElement('style');
  // Sa marque et sa règle.
  style.dataset.cesiumEarth = ''; style.textContent = HIDE_LABELS_CSS;
  // Ajoutée à l'en-tête.
  document.head.appendChild(style);
// Fin de hideLabelsRule.
}

// Déclare et exporte la classe CesiumEarth (début).
export class CesiumEarth {
  /** @param {object} engine le moteur three.js (SolarEngine) */
  // Constructeur : le moteur.
  constructor(engine) {
    // Garde le moteur.
    this.engine = engine;
    // Globe actif ou non, passage armé, création en cours.
    this.active = false; this.armed = true; this.creating = null;
    // Globe et bibliothèque : pas encore chargés.
    this.viewer = null; this.Cesium = null;
    // Caméra pilotée par les commandes de three.js : pas encore créée.
    this.camera = null;
    // Conteneur du globe : pas encore créé.
    this.container = null;
  // Fin du constructeur.
  }

  /** À chaque image three.js : passe la main au globe quand la caméra s'approche de la Terre ciblée. */
  // update : la Terre ciblée et la distance de la caméra au centre (unités de la scène), son rayon.
  update({ earthFocused, dist, radius, camLocal }) {
    // Globe actif ou en création : rien.
    if (this.active || this.creating) return;
    // Altitude de la caméra.
    const altKm = altitudeKm(dist, radius);
    // Réarme le passage si la caméra est assez haute.
    this.armed = rearm(this.armed, altKm);
    // Pas de passage : rien.
    if (!shouldEnter({ earthFocused, altKm, armed: this.armed })) return;
    // Passe la main au globe au même endroit.
    this.enter({ ...lonLatOf(camLocal), altKm });
  // Fin de update.
  }

  /** La cible change : une autre cible que la Terre ramène à la scène three.js. */
  // onFocus : vrai si la nouvelle cible est la Terre.
  onFocus(isEarth) { if (this.active && !isEarth) this.leave(); }

  // enter, asynchrone : pose le globe au-dessus de la Terre (début).
  async enter({ lon, lat, altKm }) {
    // Premier passage : création du globe.
    if (!this.viewer) {
      // Conteneur posé juste après le canevas three.js, à la même place.
      const canvas = this.engine.canvas;
      // Nouveau conteneur.
      const div = document.createElement('div');
      // Plein cadre, au-dessus du canevas, masqué pour l'instant.
      div.style.cssText = 'position:absolute;inset:0;display:none;';
      // Son nom.
      div.dataset.engine = 'cesium-earth';
      // Posé après le canevas.
      canvas.after(div);
      // Gardé.
      this.container = div;
      // Création (une seule à la fois).
      this.creating = createEarthViewer(div);
      // Essai (début).
      try {
        // Globe et bibliothèque.
        ({ viewer: this.viewer, Cesium: this.Cesium } = await this.creating);
      // Échec (CesiumJS indisponible) : on reste sur la scène three.js, passage désarmé.
      } catch { this.creating = null; this.armed = false; div.remove(); this.container = null; return; }
      // Création terminée.
      this.creating = null;
      // Caméra pilotée par les commandes de three.js.
      this.camera = new CesiumCamera({ viewer: this.viewer, Cesium: this.Cesium, engine: this.engine });
      // À chaque mouvement : verrou du nord, HUD, et retour à la scène three.js si la caméra s'éloigne.
      this.viewer.camera.changed.addEventListener(() => this.onCameraChange());
      // Sensibilité du changement de caméra : 1 % (assez pour suivre le zoom).
      this.viewer.camera.percentageChanged = 0.01;
      // Après chaque image du globe : la scène three.js redessine l'espace derrière, vu de la même caméra.
      this.viewer.scene.postRender.addEventListener(() => this.drawBackdrop());
    // Fin de la création.
    }
    // Moteur détruit entre-temps : rien.
    if (this.engine.stopped) return;
    // Caméra du globe au même endroit, vue vers le sol.
    this.viewer.camera.setView({ destination: this.Cesium.Cartesian3.fromDegrees(lon, lat, altKm * 1000), orientation: { heading: 0, pitch: this.Cesium.Math.toRadians(pitchForTilt(this.engine.tiltOn, altKm * 1000)), roll: 0 } });
    // Globe affiché, repères HTML de la scène three.js masqués.
    this.container.style.display = 'block'; hideLabelsRule(); this.setLabelsHidden(true);
    // Rendu du globe relancé.
    this.viewer.useDefaultRenderLoop = true;
    // Une image tout de suite.
    this.viewer.scene.requestRender();
    // Actif.
    this.active = true;
    // Scène three.js en attente.
    this.engine.cesiumHold = true;
    // Espace de la scène three.js dessiné tout de suite derrière le globe (sans attendre la première image du globe).
    this.drawBackdrop();
    // HUD : distance, échelle et boussole du globe.
    this.camera.publishHud();
  // Fin de enter.
  }

  // onCameraChange : la caméra du globe a bougé (début).
  onCameraChange() {
    // Inactif : rien.
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
    // Inactif : rien.
    if (!this.active) return;
    // Position de la caméra du globe.
    const c = this.viewer.camera.positionCartographic;
    // Pas assez haute : rien.
    if (!shouldExit(c.height / 1000)) return;
    // Retour à la scène three.js au même endroit.
    this.leave({ lon: this.Cesium.Math.toDegrees(c.longitude), lat: this.Cesium.Math.toDegrees(c.latitude) });
  // Fin de watchExit.
  }

  /**
   * Fond spatial : le globe a un fond transparent ; la scène three.js (étoiles, Soleil, Lune, planètes), sans la Terre,
   * est redessinée dessous avec la position, le regard et l'ouverture de la caméra du globe.
   */
  // drawBackdrop : redessine l'espace de la scène three.js derrière le globe (début).
  drawBackdrop() {
    // Inactif, ou moteur sans fond : rien.
    if (!this.active || !this.engine.renderCesiumBackdrop) return;
    // Caméra du globe.
    const cam = this.viewer.camera;
    // Le moteur three.js dessine l'espace vu de cette caméra (repère ECEF, mètres ; ouverture verticale en radians).
    this.engine.renderCesiumBackdrop({ position: cam.positionWC, direction: cam.directionWC, up: cam.upWC, fovy: cam.frustum.fovy });
  // Fin de drawBackdrop.
  }

  /** Rend la main à la scène three.js (au-dessus du lieu donné, s'il y en a un). */
  // leave : le lieu du retour (début).
  leave(place = null) {
    // Inactif : rien.
    if (!this.active) return;
    // Inactif, passage désarmé jusqu'à ce que la caméra three.js remonte.
    this.active = false; this.armed = false;
    // Globe masqué, son rendu arrêté, repères HTML de la scène three.js rendus.
    this.container.style.display = 'none'; this.viewer.useDefaultRenderLoop = false; this.setLabelsHidden(false);
    // Scène three.js relancée.
    this.engine.cesiumHold = false;
    // L'horloge three.js repart de maintenant, sans saut de temps.
    this.engine.lastNow = performance.now();
    // Avec un lieu : la caméra three.js se place au-dessus, à l'altitude de retour, sans animation de zoom.
    if (place) { this.engine.goToSite('earth', place, RETURN_KM); this.engine.dist = this.engine.distGoal; }
    // Note l'activité.
    this.engine.markActive?.();
  // Fin de leave.
  }

  // setLabelsHidden : marque le parent du conteneur de la scène (où vivent les repères HTML).
  setLabelsHidden(on) {
    // Le parent des repères.
    const parent = this.engine.container?.parentNode;
    // Marqué ou démarqué.
    if (parent) { if (on) parent.dataset.cesiumEarth = 'on'; else delete parent.dataset.cesiumEarth; }
  // Fin de setLabelsHidden.
  }

  // dispose : libère le globe (début).
  dispose() {
    // Scène three.js libérée de l'attente, repères rendus.
    this.engine.cesiumHold = false; this.setLabelsHidden(false);
    // Globe détruit, s'il existe.
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.destroy();
    // Conteneur retiré.
    this.container?.remove();
    // Plus rien.
    this.viewer = null; this.container = null; this.active = false;
  // Fin de dispose.
  }
// Fin de la classe CesiumEarth.
}
