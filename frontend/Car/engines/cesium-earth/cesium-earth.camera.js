/**
 * Caméra du globe CesiumJS pilotée par les mêmes commandes que la caméra three.js : navball (cap, tangage, vue du
 * globe), boutons +/−, verrou du nord, vue 3/4, pilotage au téléphone, lieux, villes et position de l'utilisateur.
 * Publie aussi dans le HUD ce que la scène three.js publie d'habitude (distance, échelle, boussole).
 */

// Importe les calculs de la caméra.
import { MIN_ALTITUDE_M, clampPitch, moveAngles, pitchForTilt, wrapHeading, zoomStep } from './cesium-earth.camera-math.js';
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
    // Point de l'utilisateur : pas encore posé.
    this.userEntity = null;
    // Recalage du nord en cours (évite une boucle sur l'événement de changement).
    this.fixing = false;
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
    // Vers la droite.
    if (a.right) this.cam.rotateRight(a.right);
    // Vers le haut de l'écran.
    if (a.forward) this.cam.rotateUp(a.forward);
    // Une image.
    this.viewer.scene.requestRender();
  // Fin de moveBy.
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
    // Cap actuel gardé, tangage de la vue demandée.
    this.orbit(this.engine.northLock ? 0 : this.Cesium.Math.toDegrees(this.cam.heading), pitchForTilt(on));
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
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchForTilt(this.engine.tiltOn)), roll: 0 },
      // en 2 secondes (aucune animation si le système en demande moins).
      duration: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 2,
    // Fin du vol.
    });
  // Fin de flyTo.
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
