/**
 * Caméra du globe CesiumJS pilotée par les mêmes commandes que la caméra three.js : navball (cap, tangage, vue du
 * globe), boutons +/−, verrou du nord, vue 3/4, pilotage au téléphone, lieux, villes et position de l'utilisateur.
 * Publie aussi dans le HUD ce que la scène three.js publie d'habitude (distance, échelle, boussole).
 */

// Importe les calculs de la caméra.
import { MIN_ALTITUDE_M, approachPitch, autoRotateAngle, clampPitch, dragMove, keyMove, moveAngles, pitchForTilt, surfaceRotation, wrapHeading, zoomStep } from './cesium-earth.camera-math.js';
// Importe la mise en forme d'une distance (comme le HUD de three.js).
import { formatDistanceKm } from '../../Engine/AstreSolideEngine/OrbitEngine/gravityMath.jsx';
// Importe le niveau d'échelle (« Rue », « Ville », « Planète »…).
import { scaleLevel } from '../../Engine/AstreSolideEngine/CameraEngine/scaleLevels.jsx';

// Déclare et exporte la classe CesiumCamera (début).
export class CesiumCamera {
  /**
   * @param {{ viewer: object, Cesium: object, engine: object }} o le globe, la bibliothèque et le moteur three.js
   */
  // Constructeur.
  constructor({ viewer, Cesium, engine }) {
    // Garde le globe, la bibliothèque et le moteur.
    this.viewer = viewer; this.Cesium = Cesium; this.engine = engine;
    // Raccourci vers la caméra.
    this.cam = viewer.camera;
    // Altitude minimale de la caméra au-dessus de l'ellipsoïde.
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = MIN_ALTITUDE_M;
    // Gestes propres à CesiumJS coupés : la souris, le doigt, la molette et le clavier passent par les mêmes
    // commandes que la scène three.js (InputEngine/input.jsx → dragBy, zoom, flèches), pour le même déplacement.
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    // Point de l'utilisateur : pas encore posé.
    this.userEntity = null;
    // Recalage du nord en cours (évite une boucle sur l'événement de changement).
    this.fixing = false;
    // Inclinaison pilotée à la navball : elle remplace la vue 3/4 automatique jusqu'au prochain réglage de la vue.
    this.pilotTilt = false;
    // Instant de la dernière image, pour le lissage de la vue 3/4.
    this.lastTiltAt = performance.now();
    // Instant de la dernière image, pour les flèches du clavier maintenues.
    this.lastKeysAt = performance.now();
    // Avant chaque image du globe : flèches du clavier maintenues, puis vue 3/4 automatique.
    viewer.scene.preUpdate.addEventListener(() => { this.keysTick(); this.autoTilt(); });
  // Fin du constructeur.
  }

  // ------------------------------------------------------------ lecture

  /** Altitude de la caméra au-dessus de l'ellipsoïde, en mètres. */
  get altitudeM() { return Math.max(0, this.cam.positionCartographic.height); }

  /** Point du sol au centre de l'écran (ECEF), ou le point sous la caméra s'il vise le ciel. */
  // center : le point visé (début).
  center() {
    // La scène et le canevas.
    const { scene } = this.viewer, c = scene.canvas;
    // Point de l'ellipsoïde au centre de l'écran.
    const hit = this.cam.pickEllipsoid(new this.Cesium.Cartesian2(c.clientWidth / 2, c.clientHeight / 2), scene.globe.ellipsoid);
    // Trouvé : lui.
    if (hit) return hit;
    // Sinon : le point sous la caméra.
    const p = this.cam.positionCartographic;
    // Converti en ECEF.
    return this.Cesium.Cartesian3.fromRadians(p.longitude, p.latitude, 0);
  // Fin de center.
  }

  /** Orbite autour du point visé : nouveau cap et tangage (degrés), même distance. */
  // orbit : le cap et le tangage voulus (début).
  orbit(headingDeg, pitchDeg) {
    // Raccourcis.
    const { Cesium, cam } = this;
    // Point visé.
    const target = this.center();
    // Distance de la caméra au point visé.
    const range = Cesium.Cartesian3.distance(cam.positionWC, target);
    // Place la caméra autour du point, puis rend la main au repère du globe.
    cam.lookAt(target, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(headingDeg), Cesium.Math.toRadians(pitchDeg), range));
    // Repère du globe (les commandes de la souris reprennent normalement).
    cam.lookAtTransform(Cesium.Matrix4.IDENTITY);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de orbit.
  }

  // ------------------------------------------------------------ commandes three.js

  /** Vue du globe pour la navball : droite, haut et direction vers l'œil, dans le repère du globe [X, Y, Z = pôle]. */
  // globeView : la base de la caméra (début).
  globeView() {
    // Les trois axes de la caméra.
    const { rightWC: r, upWC: u, directionWC: d } = this.cam;
    // Comme three.js : f est l'arrière de la caméra (vers l'œil).
    return { r: [r.x, r.y, r.z], u: [u.x, u.y, u.z], f: [-d.x, -d.y, -d.z] };
  // Fin de globeView.
  }

  /** Boutons +/− et molette du HUD : facteur sur l'altitude (< 1 rapproche). */
  // zoom : le facteur (début).
  zoom(f) {
    // Distance à parcourir le long du regard.
    const step = zoomStep(this.altitudeM, f);
    // Rapprocher ou éloigner.
    if (step > 0) this.cam.zoomIn(step); else if (step < 0) this.cam.zoomOut(-step);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de zoom.
  }

  /** Navball : changement de cap (dh) et de tangage (dp), en degrés, autour du point visé. */
  // pilot : les deux changements (début).
  pilot({ dh = 0, dp = 0 } = {}) {
    // Rien : rien.
    if (!dh && !dp) return;
    // Cap et tangage actuels, en degrés.
    const h = this.Cesium.Math.toDegrees(this.cam.heading), p = this.Cesium.Math.toDegrees(this.cam.pitch);
    // Une inclinaison pilotée remplace la vue 3/4 automatique.
    if (dp) this.pilotTilt = true;
    // Nouveau cap (nord gardé si verrouillé) et nouveau tangage borné.
    this.orbit(this.engine.northLock ? 0 : wrapHeading(h + dh), clampPitch(p + dp));
  // Fin de pilot.
  }

  /** Pilotage au téléphone : déplacement le long des axes de l'écran (radians, comme three.js). */
  // moveBy : à droite et en avant (début).
  moveBy(right = 0, forward = 0) {
    // Rien : rien.
    if (!right && !forward) return;
    // Angles de rotation autour du centre de la Terre.
    const a = moveAngles(right, forward, this.altitudeM);
    // Déplacement le long du sol, comme le glisser.
    this.travel(a.right, a.forward);
  // Fin de moveBy.
  }

  /**
   * Glisser de la souris ou du doigt (pixels), comme dans la scène three.js : le sol suit le doigt, la vue 3/4
   * agrandit le déplacement vertical.
   */
  // dragBy : le glisser en pixels (début).
  dragBy(dx, dy) {
    // Aucun mouvement : rien.
    if (!dx && !dy) return;
    // Canevas du globe (hauteur de l'écran).
    const c = this.viewer.scene.canvas;
    // Déplacement en radians, même conversion que three.js.
    const m = dragMove(dx, dy, { altitudeM: this.altitudeM, fovyRad: this.cam.frustum.fovy, viewportH: c.clientHeight, pitchDeg: this.Cesium.Math.toDegrees(this.cam.pitch) });
    // Déplacement le long du sol.
    this.travel(m.right, m.forward);
  // Fin de dragBy.
  }

  /** Flèches du clavier maintenues (engine.keyRotate) : déplacement continu, comme dans la scène three.js. */
  // keysTick : avant chaque image du globe (début).
  keysTick() {
    // Globe sans la main (superposition) : la caméra suit three.js, rien ici.
    if (!this.engine.cesiumHold) { this.lastKeysAt = performance.now(); return; }
    // Instant présent et temps écoulé.
    const now = performance.now(), dt = now - this.lastKeysAt;
    // Note l'instant.
    this.lastKeysAt = now;
    // Pas de flèche enfoncée : rien.
    const keys = this.engine.keyRotate;
    // Aucune flèche : rien.
    if (!keys || !(keys.left || keys.right || keys.up || keys.down)) return;
    // Déplacement de cette image.
    const m = keyMove(keys, dt, this.altitudeM);
    // Le long du sol.
    this.travel(m.right, m.forward);
  // Fin de keysTick.
  }

  /**
   * Rotation automatique (bouton « Rotation »), comme dans la scène three.js : la caméra tourne autour de l'axe des
   * pôles vers l'est, à la même vitesse (0,072 rad/s × multiplicateur de Paramètres), ralentie près du sol.
   */
  // autoRotate : le temps écoulé en ms (début).
  autoRotate(dtMs) {
    // Angle de cette image.
    const a = autoRotateAngle(dtMs, this.engine.rotateSpeed ?? 1, this.altitudeM);
    // Rien : rien.
    if (!(a > 0)) return;
    // Rotation directe autour de l'axe des pôles (+Z) : CesiumJS tourne de −angle, on lui passe −a.
    this.cam.rotate(this.Cesium.Cartesian3.UNIT_Z, -a);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de autoRotate.
  }

  /**
   * Déplace la caméra le long du sol de `right` et `forward` radians (axes de l'écran posés sur le sol, cap compris),
   * en la tournant autour du centre de la Terre : même altitude, même cap et même inclinaison, comme moveOnSphere dans
   * la scène three.js.
   */
  // travel : le déplacement en radians (début).
  travel(right, forward) {
    // Rotation qui fait ce déplacement.
    const r = surfaceRotation(this.cam.positionWC, this.cam.heading, right, forward);
    // Rien : rien.
    if (!r) return;
    // Rotation de la caméra autour du centre de la Terre.
    this.cam.rotate(new this.Cesium.Cartesian3(r.axis[0], r.axis[1], r.axis[2]), r.angle);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de travel.
  }

  /** Verrou du nord : le nord en haut de l'écran tant qu'il est actif. Renvoie l'état. */
  // setNorthLock : l'état (début).
  setNorthLock(on) {
    // Actif : cap remis au nord tout de suite.
    if (on) this.keepNorth();
    // Renvoie l'état.
    return Boolean(on);
  // Fin de setNorthLock.
  }

  /** Remet le nord en haut si le verrou est actif et que la caméra a tourné. */
  // keepNorth : appelé à chaque changement de caméra (début).
  keepNorth() {
    // Déjà en cours : rien.
    if (this.fixing) return;
    // Cap actuel, en degrés.
    const h = this.Cesium.Math.toDegrees(this.cam.heading);
    // Déjà au nord (à 0,1° près) : rien.
    if (Math.min(wrapHeading(h), 360 - wrapHeading(h)) < 0.1) return;
    // Recalage.
    this.fixing = true;
    // Même tangage, cap au nord.
    this.orbit(0, clampPitch(this.Cesium.Math.toDegrees(this.cam.pitch)));
    // Fin du recalage.
    this.fixing = false;
  // Fin de keepNorth.
  }

  /** Vue 3/4 : regard incliné, sinon vertical. */
  // setTilt : l'état (début).
  setTilt(on) {
    // La vue 3/4 automatique reprend la main sur l'inclinaison pilotée.
    this.pilotTilt = false;
    // Coupée : retour au regard vertical (active : autoTilt s'en charge en douceur).
    if (!on) this.orbit(this.engine.northLock ? 0 : this.Cesium.Math.toDegrees(this.cam.heading), pitchForTilt(false, this.altitudeM));
    // Une image, pour lancer le mouvement.
    this.viewer.scene.requestRender();
  // Fin de setTilt.
  }

  /** Lieu de la Terre (recherche, ville, site) : vol de la caméra jusqu'au-dessus, à l'altitude demandée. */
  // flyTo : longitude, latitude (degrés), altitude (m) (début).
  flyTo({ lon, lat, altitudeM = 2500 }) {
    // Coordonnées illisibles : rien.
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    // Raccourci.
    const { Cesium } = this;
    // Vol (début) :
    this.cam.flyTo({
      // au-dessus du lieu, jamais sous l'altitude minimale ;
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(MIN_ALTITUDE_M, altitudeM)),
      // cap au nord, tangage de la vue en cours ;
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchForTilt(this.engine.tiltOn && !this.pilotTilt, altitudeM)), roll: 0 },
      // en 2 secondes (aucune animation si le système en demande moins).
      duration: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 2,
    // Fin du vol.
    });
  // Fin de flyTo.
  }

  /**
   * Vue 3/4 automatique, comme three.js : à l'approche du sol, la caméra s'incline vers l'horizon (≈ 60° près du sol)
   * autour du point visé, en douceur. Rien quand la vue 3/4 est coupée ou que la navball pilote l'inclinaison.
   */
  // autoTilt : avant chaque image du globe (début).
  autoTilt() {
    // Instant présent et temps écoulé.
    const now = performance.now(), dt = Math.min(100, now - this.lastTiltAt);
    // Gardé.
    this.lastTiltAt = now;
    // Globe sans la main (superposition) : la caméra suit three.js, rien ici.
    if (!this.engine.cesiumHold) return;
    // Vue 3/4 coupée, inclinaison pilotée ou vol en cours : rien.
    if (!this.engine.tiltOn || this.pilotTilt || this.cam._currentFlight) return;
    // Tangage actuel et tangage voulu, en degrés.
    const current = this.Cesium.Math.toDegrees(this.cam.pitch), target = pitchForTilt(true, this.altitudeM);
    // Déjà en place (à 0,05° près) : rien.
    if (Math.abs(target - current) < 0.05) return;
    // Un pas vers le tangage voulu, cap gardé (nord si verrouillé), autour du point visé.
    this.orbit(this.engine.northLock ? 0 : this.Cesium.Math.toDegrees(this.cam.heading), approachPitch(current, target, dt));
  // Fin de autoTilt.
  }

  /** Point bleu de la position de l'utilisateur ({ lat, lon }), ou null pour l'enlever. */
  // setUserPosition : la position (début).
  setUserPosition(position) {
    // Raccourci.
    const { Cesium, viewer } = this;
    // Latitude et longitude.
    const lat = Number(position?.lat), lon = Number(position?.lon);
    // Sans position valable : point enlevé.
    if (!position || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      // Retire le point.
      if (this.userEntity) viewer.entities.remove(this.userEntity);
      // Plus de point.
      this.userEntity = null;
    // Sinon (début).
    } else {
      // Position du point.
      const where = Cesium.Cartesian3.fromDegrees(lon, lat);
      // Point existant : déplacé ; sinon créé (bleu, cerclé de blanc, toujours visible).
      if (this.userEntity) this.userEntity.position = where;
      else this.userEntity = viewer.entities.add({ position: where, point: { pixelSize: 12, color: Cesium.Color.fromCssColorString('#3d8bff'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    // Fin du choix.
    }
    // Une image.
    viewer.scene.requestRender();
  // Fin de setUserPosition.
  }

  /** Publie dans le HUD la distance, l'échelle et la boussole, comme la scène three.js. */
  // publishHud : appelé à chaque changement de caméra (début).
  publishHud() {
    // Le HUD du moteur.
    const hud = this.engine.hud;
    // Sans HUD : rien.
    if (!hud) return;
    // Altitude en km.
    const km = this.altitudeM / 1000;
    // Distance mise en forme.
    const distance = formatDistanceKm(km);
    // Nom de la Terre.
    const name = this.engine.earth?.def?.name ?? 'Terre';
    // Cap en radians.
    const heading = this.cam.heading;
    // Publication : distance, échelle, boussole (nord de l'astre, à l'écran à −cap).
    hud.set({ zoomText: `${name} · ${distance}`, zoomShort: distance, scaleText: scaleLevel(km, { earth: true }), compass: { angle: -heading, bearing: -heading, system: false } });
  // Fin de publishHud.
  }
// Fin de la classe CesiumCamera.
}
