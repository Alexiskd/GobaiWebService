/**
 * Méthodes du moteur SolarEngine (engine.jsx) : commandes appelées par l'interface.
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import { AU_UNITS } from '../OrbitEngine/ephemeris.jsx';
import { leadBound } from '../InputEngine/zoomMath.jsx';
import { bodyId } from '../LabelEngine/bodyPlaces.jsx';
import { GAS_MIN_ALTITUDE_RADII, minAltitudeRadii } from '../BodyEngine/tiledBodies.jsx';
import { defaultDistance } from '../CameraEngine/focusMath.jsx';
import { underCloudFloorRadii } from '../AtmosphereEngine/atmosphereData.jsx';
import { cloudZoomFactor } from '../../AstreGazeuxEngine/AtmosphereEngine/gasInteriorMath.jsx';
import { VIEW_DISTANCE, MAX_DISTANCE, GAS_ENTRY_RADII, clamp } from './constants.jsx';

// Méthodes : commandes appelées par l'interface.
export const commandMethods = {
  // ------------------------------------------------------------------- commandes

  // `planetOnly` (navigation, menu des satellites replié) : cadre la planète seule au lieu de tout son système.
  setFocus(i, { planetOnly = false } = {}) {
    // Note l'activité.
    this.markActive?.();
    // Arrête le zoom d'arrivée.
    this.zoomFlight = null;
    // Borne l'indice.
    i = clamp(i, 0, this.focusTargets.length - 1);
    // Astre d'une famille masquée (Paramètres) : on n'y va pas (un astre hors du système affiché, lui, reste joignable).
    if (this.isTargetHidden(this.focusTargets[i], { settingsOnly: true })) return;
    // Se téléporter sur un astre (même celui où l'on est déjà) ramène toujours au zoom par défaut de cet astre.
    // Les trajets vers un lieu (ville, site) fixent ensuite leur propre altitude.
    this.releaseLocks();
    // Si la cible change (début).
    if (i !== this.focus) {
      // Le verrouillage de la vue est lié à l'astre focus : il tombe quand on en change.
      this.viewLock = null;
      // Le cap de la boussole est propre à l'astre : on repart du nord de scène.
      this.heading = 0;
      // Cap voulu : le nord.
      this.headingGoal = 0;
      // Plus d'inclinaison pilotée.
      this.pilotTilt = null;
    // Fin de ce cas.
    }
    // Une autre cible que la Terre : le globe CesiumJS rend la main à la scène three.js.
    this.solidGlobe?.onFocus(i === this.tiledById?.[this.solidGlobe.bodyId]?.focus);
    // Garde la cible.
    this.focus = i;
    // Point de départ de la transition.
    this.targetStart.copy(this.target);
    // Transition au début.
    this.focusT = 0;
    // La cible.
    const t = this.focusTargets[i];
    // Distance voulue : celle par défaut de l'astre.
    this.distGoal = defaultDistance(t.body ? bodyId(t.body.def) : undefined, t.r, MAX_DISTANCE, Boolean(planetOnly) && Boolean(t.body));
    // HUD à mettre à jour.
    this.hudAt = 0;
    // Prévient l'interface.
    this.onFocusChange(i);
  // Fin de setFocus.
  },
  // Page d'un astre (/mars, /titan…) : l'adresse est le nom français sans accent ni majuscule. Faux si aucun astre.
  focusBySlug(slug) {
    // fold : met un nom sans accent ni majuscule.
    const fold = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // Cible de ce nom.
    const i = this.focusTargets.findIndex((t) => fold(t.name) === fold(slug));
    // Aucune : faux.
    if (i < 0) return false;
    // Cible différente : y va.
    if (i !== this.focus) this.setFocus(i);
    // Vrai.
    return true;
  // Fin de focusBySlug.
  },
  /** Double-clic sur la scène (x, y en pixels de la fenêtre) : globe de près, zoom vers le point cliqué. */
  // zoomAt : le point et le facteur ; rien hors du globe de près.
  zoomAt(x, y, f) { if (this.cesiumHold) this.solidGlobe.camera.zoomAt(x, y, f); },
  // f < 1 rapproche la caméra, f > 1 l'éloigne ; appliqué à l'altitude visée au-dessus de l'astre (cumulable).
  // De loin c'est la même chose que la distance ; de près, le zoom reste progressif jusqu'au sol (Terre comme Lune).
  zoom(f) {
    // Globe CesiumJS actif : le zoom porte sur sa caméra.
    if (this.cesiumHold) return this.solidGlobe.camera.zoom(f);
    // Note l'activité.
    this.markActive();
    // Zoom avant sur l'astre : la rotation automatique de la caméra autour de lui s'arrête d'elle-même.
    if (f < 1) this.stopAutoRotate();
    // Arrête le zoom d'arrivée.
    this.zoomFlight = null; // zoom repris à la main : le zoom d'arrivée s'arrête là
    // Rayon de la cible.
    const radius = this.focusTarget().r || 1;
    // Géante gazeuse : pas de sol. Dehors, le zoom porte sur l'altitude au-dessus des nuages, comme pour un sol :
    // l'approche reste progressive jusqu'à GAS_MIN_ALTITUDE_RADII. Zoomer encore à ce plancher fait traverser la
    // couche de nuages ; dedans, le zoom porte sur la distance au centre, et dézoomer fait ressortir.
    if (this.focusTarget().passable) {
      // Rayon local.
      const local = this.localRadius();
      // Plancher au-dessus des nuages.
      const floor = local * (1 + GAS_MIN_ALTITUDE_RADII);
      // Hors des nuages (début).
      if (this.distGoal > local) {
        // « Au plancher » : visé ET atteint par la caméra, pour qu'un zoom continu s'arrête d'abord au ras des nuages.
        const atFloor = this.distGoal <= floor * (1 + 1e-9) && this.dist <= floor * 1.02;
        // Altitude au-dessus des nuages.
        const altitude = Math.max(this.distGoal, floor) - local;
        // Altitude où se trouve la caméra : la visée reste à moins de 6 fois d'elle (pas d'emballement à la molette).
        const current = Math.max(this.dist, floor) - local;
        // Au plancher en zoomant : entre dans les nuages ; sinon l'altitude est multipliée, bornée.
        this.distGoal = f < 1 && atFloor ? local * GAS_ENTRY_RADII : clamp(local + leadBound(altitude * f, current), floor, MAX_DISTANCE);
      // Dans les nuages (début).
      } else {
        // Dans les nuages (Jupiter), le pas est adouci : un cran traverse à peu près un pont nuageux.
        const next = this.distGoal * cloudZoomFactor(bodyId(this.focusTarget().body.def), this.distGoal / local, f);
        // Ressortie au-dessus des nuages, ou distance au centre, 2 % du rayon au moins.
        this.distGoal = next > local * GAS_ENTRY_RADII ? local * (1 + 4 * GAS_MIN_ALTITUDE_RADII) : Math.max(next, radius * 0.02);
      // Fin du choix.
      }
      // Terminé.
      return;
    // Fin du cas « géante gazeuse ».
    }
    // Distance minimale : 1,03 rayon pour le Soleil, 1,08 sinon.
    let minDistance = radius * (this.focus === 0 ? 1.03 : 1.08);
    // Astre tuilé ciblé.
    const tb = this.focusedTiled();
    // Avec une carte : l'altitude minimale de l'astre.
    if (tb?.tiles.active) minDistance = radius * (1 + minAltitudeRadii(tb.cfg));
    // Couche de nuages opaque sans carte du sol (Vénus sans fond Trek) : on peut quand même traverser l'atmosphère.
    else if (tb && underCloudFloorRadii(tb.cfg.id)) minDistance = radius * (1 + underCloudFloorRadii(tb.cfg.id));
    // Modèle irrégulier affiché : la caméra reste au-dessus de son plus grand axe (plus long que le rayon moyen).
    if (tb?.model && tb.modelWanted && tb.cfg.modelMinDistanceRadii) minDistance = Math.max(minDistance, radius * tb.cfg.modelMinDistanceRadii);
    // Altitude visée au-dessus de l'astre.
    const altitude = Math.max(this.distGoal, minDistance) - radius;
    // Altitude où se trouve la caméra : la visée reste à moins de 6 fois d'elle (pas d'emballement à la molette).
    const current = Math.max(this.dist, minDistance) - radius;
    // Nouvelle distance voulue, bornée.
    this.distGoal = clamp(radius + leadBound(altitude * f, current), minDistance, MAX_DISTANCE);
  // Fin de zoom.
  },
  /**
   * Distance à la caméra rapportée au rayon de l'astre ciblé, mesurée depuis le sol (0 au sol) ; depuis le centre
   * pour une géante gazeuse, qui n'a pas de sol (la rotation reste possible à l'intérieur).
   */
  // surfaceRatio : la distance à la caméra rapportée au rayon de l'astre (début).
  surfaceRatio() {
    // La cible.
    const f = this.focusTarget();
    // Astre à sol : distance au sol, en rayons.
    if (!f.passable) return this.dist / (f.r || 1) - 1;
    // Géante gazeuse : au-dessus des nuages, altitude en rayons locaux (rotation et glisser d'autant plus fins qu'on
    // est près) ; à l'intérieur, distance au centre.
    const local = this.localRadius();
    // Au-dessus des nuages : altitude en rayons locaux ; dedans : distance au centre en rayons.
    return this.dist > local ? Math.max(this.dist / local - 1, 1e-6) : this.dist / (f.r || 1);
  // Fin de surfaceRatio.
  },
  /**
   * Rayon de l'astre ciblé à la verticale de la caméra (scène). Sphère : son rayon. Géante gazeuse aplatie : rayon de
   * l'ellipsoïde à la latitude survolée (plus court vers les pôles : 10 % de moins pour Saturne).
   */
  // localRadius : le rayon de l'astre à la verticale de la caméra (début).
  localRadius() {
    // La cible.
    const f = this.focusTarget();
    // Son rayon.
    const r = f.r || 1;
    // Son aplatissement.
    const flattening = f.tiled?.cfg.flattening;
    // Sans aplatissement : le rayon.
    if (!flattening) return r;
    // Cosinus de l'élévation.
    const ce = Math.cos(this.el);
    // Direction de la caméra.
    const n = this.radN.set(Math.sin(this.az) * ce, Math.sin(this.el), Math.cos(this.az) * ce);
    // Sinus de la latitude survolée.
    const s = n.dot(this.northAxis(this.radAxis)); // sinus de la latitude survolée
    // Rapport des deux axes.
    const b = 1 - flattening;
    // Rayon de l'ellipsoïde à cette latitude.
    return (r * b) / Math.sqrt(b * b * (1 - s * s) + s * s);
  // Fin de localRadius.
  },
  /**
   * Vue de l'ensemble du système solaire (activation de la relativité générale) : la vue d'ensemble habituelle
   * (Soleil visé, même azimut et même élévation), mais assez loin pour que toute la grille de Schwarzschild — jusqu'à
   * l'aphélie de la planète la plus lointaine — tienne dans le champ de la caméra.
   */
  systemOverview() {
    this.resetView();
    const outerAu = this.schwarzschild?.outerAu || 0;
    const halfFov = ((this.cam?.fov || 50) * Math.PI) / 360;
    const fit = outerAu > 0 ? (outerAu * AU_UNITS * 1.1) / Math.tan(halfFov) : 0;
    this.distGoal = clamp(Math.max(VIEW_DISTANCE, fit), VIEW_DISTANCE, MAX_DISTANCE);
  },
  // resetView : revient à la vue globale (début).
  resetView() {
    // Globe CesiumJS actif : il rend d'abord la main à la scène three.js.
    this.solidGlobe?.leave();
    // Cible : le Soleil.
    this.setFocus(0);
    // Azimut d'origine.
    this.az = 0.8;
    // Élévation d'origine.
    this.el = 0.8;
    // Distance de la vue globale.
    this.distGoal = VIEW_DISTANCE;
  // Fin de resetView.
  },
// Fin des méthodes.
};
