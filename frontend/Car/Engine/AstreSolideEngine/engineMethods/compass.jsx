/**
 * Méthodes du moteur SolarEngine (engine.jsx) : boussole, navigation et caméra.
 * Installées sur SolarEngine.prototype par installMethods : `this` est le moteur.
 */
import * as THREE from 'three';
import { D, lonLatToVec } from '../OrbitEngine/ephemeris.jsx';
import { TILT_MAX_ANGLE } from '../CameraEngine/cameraTilt.jsx';
import { bodyId } from '../LabelEngine/bodyPlaces.jsx';
import { TILED_BODY_BY_ID, minAltitudeRadii } from '../BodyEngine/tiledBodies.jsx';
import { flightPlan } from '../CameraEngine/zoomFlight.jsx';
import { EARTH_RADIUS_M, insetCorners, screenGeo } from '../InputEngine/gps.jsx';
import { tileRadius } from '../MapEngine/tiles/tileGeometry.jsx';
import { atmosphereThickness } from '../AtmosphereEngine/atmosphereData.jsx';
import { moveOnSphere } from '../InputEngine/deviceCompassMath.jsx';
import { dragRadPerPx, dragStep } from '../InputEngine/touchMath.jsx';
import { POLLUTION_LAYER } from '../../../engines/pollution-lumineuse/index.js';
import { ecefToTilesLocal } from '../../../engines/astre-solide/astre-solide.camera-math.js';
import { planetData } from '../BodyEngine/planetData.jsx';
import { solidBodyFacts } from '../../../engines/astre-solide/astre-solide.facts.js';
import { ATMO_LAYER, clamp } from './constants.jsx';

// Méthodes : boussole, navigation et caméra.
export const compassMethods = {
  // ------------------------------------------------------------------ boussole

  /** Pôle nord géographique de l'astre ciblé, en coordonnées de scène (Terre, Lune et Mars sont inclinées). */
  /** Nord de l'astre ciblé (axe de rotation propre) ; Soleil, vue d'ensemble et astres sans axe : nord du système (pôle de l'écliptique). */
  // northAxis : l'axe nord de l'astre ciblé (début).
  northAxis(out = new THREE.Vector3()) {
    // Nord de la scène.
    out.set(0, 1, 0);
    // Astre tuilé ciblé.
    const tb = this.focusedTiled();
    // S'il y en a un : tourné selon son orientation.
    if (tb) out.applyQuaternion(tb.group.quaternion);
    // Le renvoie.
    return out;
  // Fin de northAxis.
  },
  /**
   * État de la boussole : angle du nord vrai à l'écran (0 = en haut, positif vers la droite) et cap à appliquer
   * pour le remettre en haut. Sur le Soleil, le nord est celui du système (pôle de l'écliptique). `null` aux pôles,
   * où le nord n'a pas de direction.
   */
  // compassState : l'angle du nord à l'écran et le cap qui le remet en haut (début).
  compassState() {
    // Sinus et cosinus de l'azimut.
    const sa = Math.sin(this.az), ca = Math.cos(this.az);
    // Sinus et cosinus de l'élévation.
    const se = Math.sin(this.el), ce = Math.cos(this.el);
    // Verticale locale du point visé.
    const n = this.compassN.set(ce * sa, se, ce * ca);
    // Projection du pôle sur le plan tangent au point visé : direction du nord géographique local.
    const axis = this.northAxis(this.compassAxis);
    // Nord local : l'axe projeté sur le plan tangent.
    const north = this.compassNorth.copy(axis).addScaledVector(n, -axis.dot(n));
    // Sa longueur.
    const len = north.length();
    // Nulle, au pôle : null.
    if (len < 1e-6) return null;
    // Rendu unitaire.
    north.divideScalar(len);

    // Droite de l'image = haut × normale (colinéaire à la tangente est) ; le haut inclut la verticale locale.
    const right = this.compassRight.copy(this.tiltUp).cross(n);
    // Sa longueur.
    const rl = right.length();
    // Nulle : null.
    if (rl < 1e-9) return null;
    // Rendue unitaire.
    right.divideScalar(rl);
    // Angle du nord à l'écran.
    const angle = Math.atan2(north.dot(right), north.dot(this.tiltUp));

    // Cap (dans la base nord/est de la scène) qui amène ce nord en haut de l'image.
    const tX = -se * sa, tZ = -se * ca;
    // Cap qui amène le nord en haut.
    const bearing = Math.atan2(north.x * ca - north.z * sa, north.x * tX + north.y * ce + north.z * tZ);
    // Renvoie l'angle, le cap et si c'est le nord du système.
    return { angle, bearing, system: !this.focusedTiled() };
  // Fin de compassState.
  },
  /** Recale la caméra sur le nord géographique de l'astre ciblé. Renvoie false si le nord est indéfini. */
  // recalibrateNorth : remet le nord en haut de l'écran (début).
  recalibrateNorth() {
    // État de la boussole.
    const state = this.compassState();
    // Nord indéfini : faux.
    if (!state) return false;
    // Cap voulu : celui qui remet le nord en haut.
    this.headingGoal = state.bearing;
    // Vrai.
    return true;
  // Fin de recalibrateNorth.
  },
  /**
   * Attitude de la caméra pour la navball : matrice 3 × 3 (lignes = droite, haut, avant de la caméra ; colonnes =
   * est, haut local, sud) dans le repère local du point survolé de l'astre ciblé. Nord = axe propre de l'astre,
   * ou nord du système (écliptique) pour le Soleil. Renvoie `out` (9 nombres, ligne par ligne) ou null.
   */
  // navballAttitude : l'attitude de la caméra dans le repère local du point survolé (début).
  navballAttitude(out = new Array(9)) {
    // Sinus et cosinus de l'azimut.
    const sa = Math.sin(this.az), ca = Math.cos(this.az);
    // Sinus et cosinus de l'élévation.
    const se = Math.sin(this.el), ce = Math.cos(this.el);
    // Verticale locale.
    const up = this.navUp.set(ce * sa, se, ce * ca);
    // Axe nord de l'astre.
    const axis = this.northAxis(this.navAxis);
    // Nord local : l'axe projeté sur le plan tangent.
    const north = this.navNorth.copy(axis).addScaledVector(up, -axis.dot(up));
    // Au pôle : un nord arbitraire.
    if (north.lengthSq() < 1e-12) north.set(0, 0, -1).addScaledVector(up, up.z); // pôle : nord arbitraire
    // Rendu unitaire.
    north.normalize();
    // Est local.
    const east = this.navEast.copy(north).cross(up).normalize();
    // Sud local.
    const south = this.navSouth.copy(north).negate();
    // Matrice de la caméra.
    const m = this.cam.matrixWorld.elements;
    // Sa droite.
    const right = this.navCam[0].set(m[0], m[1], m[2]);
    // Son haut.
    const camUp = this.navCam[1].set(m[4], m[5], m[6]);
    // Son avant.
    const forward = this.navCam[2].set(-m[8], -m[9], -m[10]);
    // Pour chacun des trois (début) :
    [right, camUp, forward].forEach((c, i) => {
      // ses composantes sur l'est, le haut et le sud.
      out[i * 3] = c.dot(east); out[i * 3 + 1] = c.dot(up); out[i * 3 + 2] = c.dot(south);
    // Fin de la boucle.
    });
    // Renvoie le tableau.
    return out;
  // Fin de navballAttitude.
  },
  /**
   * Vue du globe de l'astre ciblé, pour la navball « globe » : droite, haut de la caméra et direction extérieure
   * (du centre de l'astre vers la caméra) exprimés dans le repère fixe de l'astre — N = (lat 0, lon 0),
   * E = (lat 0, lon 90° E), U = pôle Nord. La boule tourne donc avec l'astre et avec les déplacements de la caméra.
   * Renvoie { f, r, u } (tableaux [N, E, U]) ou null.
   */
  // globeView : la vue du globe dans le repère fixe de l'astre (début).
  globeView() {
    // Globe CesiumJS actif : la navball lit sa caméra.
    if (this.cesiumHold) return this.solidGlobe.camera.globeView();
    // La cible.
    const f = this.focusTarget();
    // Son maillage : tuilé, planète, Lune, satellite ou Soleil.
    const mesh = f.tiled?.mesh || f.body?.mesh || (f.moon ? this.moon : null) || f.satellite?.mesh || (this.focus === 0 ? this.sunMesh : null);
    // Aucun : null.
    if (!mesh) return null;
    // Met à jour sa matrice.
    mesh.updateWorldMatrix(true, false);
    // Inverse de son orientation.
    const q = mesh.getWorldQuaternion(this.globeQ).invert();
    // Matrice de la caméra.
    const m = this.cam.matrixWorld.elements;
    // toBody : passe un vecteur dans le repère de l'astre, en [N, E, U].
    const toBody = (v) => { v.applyQuaternion(q); return [v.x, -v.z, v.y]; };
    // Renvoie (début)
    return {
      // la droite de la caméra,
      r: toBody(this.globeV.set(m[0], m[1], m[2]).normalize()),
      // son haut
      u: toBody(this.globeV.set(m[4], m[5], m[6]).normalize()),
      // et la direction vers l'œil.
      f: toBody(this.globeV.set(m[8], m[9], m[10]).normalize()), // arrière de la caméra = vers l'œil
    // Fin du résultat.
    };
  // Fin de globeView.
  },
  /**
   * Pilotage de la caméra depuis la navball (degrés) : `dh` tourne la vue autour de la verticale locale (cap),
   * `dp` incline la caméra (tangage : −90° = regard vertical, −30° = inclinaison maximale vers l'horizon).
   * L'inclinaison pilotée remplace la vue 3/4 automatique jusqu'au prochain changement d'astre ou recentrage.
   */
  // pilot : pilote la caméra depuis la navball, en degrés (début).
  pilot({ dh = 0, dp = 0 } = {}) {
    // Globe CesiumJS actif : la navball pilote sa caméra.
    if (this.cesiumHold) return this.solidGlobe.camera.pilot({ dh, dp });
    // Un mouvement : note l'activité.
    if (dh || dp) this.markActive();
    // Changement de cap (début).
    if (dh) {
      // Tourne le cap voulu.
      this.headingGoal += dh * D;
      // Et le cap, sans transition.
      this.heading += dh * D;
    // Fin de ce cas.
    }
    // Changement d'inclinaison (début).
    if (dp) {
      // Inclinaison de départ : la pilotée, sinon l'actuelle.
      const base = this.pilotTilt ?? this.tiltV;
      // Nouvelle inclinaison, bornée.
      this.pilotTilt = Math.max(0, Math.min(TILT_MAX_ANGLE, base + dp * D));
    // Fin de ce cas.
    }
  // Fin de pilot.
  },
  /**
   * Déplace la vue autour de l'astre le long des axes de l'écran (radians) : `right` vers la droite, `forward` vers
   * le haut (le nord quand il est verrouillé en haut). Comme un glisser : d'autant plus fin qu'on est proche du sol,
   * et il reprend la main sur un lieu suivi.
   */
  // moveBy : déplace la vue le long des axes de l'écran, en radians (début).
  moveBy(right = 0, forward = 0) {
    // Aucun mouvement : rien.
    if (!right && !forward) return;
    // Globe CesiumJS actif : le pilotage au téléphone déplace sa caméra.
    if (this.cesiumHold) return this.solidGlobe.camera.moveBy(right, forward);
    // Lâche les lieux suivis.
    this.releaseLocks();
    // Finesse du pas selon la proximité du sol.
    const k = Math.max(1e-9, Math.min(1, this.surfaceRatio() * 0.9));
    // Nouvelle position sur la sphère.
    const next = moveOnSphere({ az: this.az, el: this.el, heading: this.heading }, right * k, forward * k);
    // Nouvel azimut.
    this.az = next.az;
    // Nouvelle élévation.
    this.el = next.el;
  // Fin de moveBy.
  },
  /**
   * Glisser au doigt ou à la souris de (dx, dy) pixels : le sol reste sous le doigt à tout niveau de zoom, le long
   * des axes de l'écran (cap et vue 3/4 compris). Ne touche pas aux lieux suivis : l'appelant décide de les lâcher.
   */
  // dragBy : glisse la vue de quelques pixels (début).
  dragBy(dx, dy) {
    // Aucun mouvement : rien.
    if (!dx && !dy) return;
    // Globe CesiumJS actif : sa caméra se déplace de la même façon (le sol suit le doigt).
    if (this.cesiumHold) return this.solidGlobe.camera.dragBy(dx, dy);
    // Pas de rotation correspondant aux pixels, vue inclinée comprise.
    const step = dragStep(dx, dy, dragRadPerPx(this.surfaceRatio(), this.cam.fov, this.H), this.tiltV || 0);
    // Nouvelle position sur la sphère.
    const next = moveOnSphere({ az: this.az, el: this.el, heading: this.heading }, step.right, step.forward);
    // Nouvel azimut.
    this.az = next.az;
    // Nouvelle élévation.
    this.el = next.el;
  // Fin de dragBy.
  },
  /** Verrou du nord : tant qu'il est actif, le nord reste en haut de l'écran (le sud en bas), même en tournant. */
  // setNorthLock : verrouille ou libère le nord en haut de l'écran (début).
  setNorthLock(on) {
    // Garde l'état.
    this.northLock = Boolean(on);
    // Globe CesiumJS actif : le verrou s'applique à sa caméra.
    if (this.cesiumHold) return this.solidGlobe.camera.setNorthLock(this.northLock);
    // Recalage instantané : le cap saute directement sur le nord, sans transition.
    if (this.northLock && this.recalibrateNorth()) this.heading = this.headingGoal;
    // Renvoie l'état.
    return this.northLock;
  // Fin de setNorthLock.
  },
  // goCity : va à une ville de la liste (début).
  goCity(index) {
    // Globe CesiumJS actif : sa caméra vole jusqu'à la ville (≈ 2,5 km d'altitude).
    if (this.cesiumHold && this.solidGlobe.bodyId === 'earth') { const c = this.cityItems?.[index]; return c ? this.solidGlobe.camera.flyTo({ lon: c.lon, lat: c.lat, altitudeM: 2500 }) : undefined; }
    // Cible : la Terre.
    this.setFocus(this.earthFocus);
    // Distance voulue : plus près avec une carte.
    this.distGoal = this.tiles.active ? 1.0004 : 1.004; // ≈ 2,5 km d'altitude avec une carte
    // Suit la ville.
    this.lockCity = this.cityItems[index];
  // Fin de goCity.
  },
  /**
   * Va vers n'importe quel lieu de la Terre (ex. résultat de la recherche mondiale).
   * `follow` : le lieu est la position de l'utilisateur, la caméra le suit quand il se déplace (setUserPosition).
   * `fly` : zoom d'arrivée — la caméra se place à la verticale du lieu, part de haut et descend d'un seul mouvement.
   */
  // goTo : va à un lieu de la Terre (début).
  goTo({ name, lon, lat, altitudeM, follow = false, fly = false }) {
    // Globe CesiumJS actif : sa caméra vole jusqu'au lieu.
    if (this.cesiumHold && this.solidGlobe.bodyId === 'earth') return this.solidGlobe.camera.flyTo({ lon, lat, altitudeM: Number.isFinite(altitudeM) && altitudeM > 0 ? altitudeM : 2500 });
    // Cible : la Terre.
    this.setFocus(this.earthFocus);
    // Si une altitude est demandée (début).
    if (Number.isFinite(altitudeM) && altitudeM > 0) {
      // Altitude demandée (ex. point GPS à l'échelle de 10 m), jamais sous le plancher autorisé avec une carte.
      const floor = this.tiles.active ? minAltitudeRadii(TILED_BODY_BY_ID.earth) : 0.004;
      // Distance voulue : l'altitude demandée, jamais sous le plancher.
      this.distGoal = 1 + Math.max(floor, altitudeM / EARTH_RADIUS_M);
    // Sinon (début).
    } else {
      // Distance par défaut : plus près avec une carte.
      this.distGoal = this.tiles.active ? 1.0004 : 1.004;
    // Fin du choix.
    }
    // Suit le lieu ; « user » s'il s'agit de la position de l'utilisateur.
    this.lockCity = { name, lon, lat, lv: lonLatToVec([lon, lat]), user: Boolean(follow) };
    // Pas de zoom d'arrivée, a priori.
    this.zoomFlight = null;
    // Animations réduites demandées dans le système : pas de zoom d'arrivée, la vue se pose directement.
    if (fly && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // Plan du zoom d'arrivée.
      const plan = flightPlan(this.dist, this.distGoal);
      // S'il y en a un : la caméra part de haut.
      if (plan) { this.dist = plan.from; this.zoomFlight = { plan, t: 0 }; }
    // Fin de ce cas.
    }
  // Fin de goTo.
  },
  /** Point bleu de la position de l'utilisateur sur la Terre : { lat, lon, accuracyM?, headingDeg? }, ou null pour l'enlever. */
  // setUserPosition : pose ou enlève le point de la position de l'utilisateur (début).
  setUserPosition(position) {
    // Met à jour le point.
    this.userMarker.set(position);
    // Le même point sur le globe CesiumJS, s'il existe.
    if (this.solidGlobe?.bodyId === 'earth') this.solidGlobe.camera?.setUserPosition(position);
    // Caméra posée sur « Ma position » : elle suit l'utilisateur quand il se déplace.
    const lock = this.lockCity;
    // Latitude et longitude reçues.
    const lat = Number(position?.lat), lon = Number(position?.lon);
    // Si la caméra suit l'utilisateur et que la position est valable (début).
    if (lock?.user && position && Number.isFinite(lat) && Number.isFinite(lon)) {
      // Nouvelle latitude du lieu suivi.
      lock.lat = lat;
      // Nouvelle longitude.
      lock.lon = lon;
      // Nouvelle direction.
      lock.lv = lonLatToVec([lon, lat]);
    // Fin de ce cas.
    }
  // Fin de setUserPosition.
  },
  /** Marges (px CSS) de la zone dont on donne les coins : le bas de l'écran mobile est couvert par la barre d'outils. */
  // setGpsInsets : règle les marges de la zone utile (début).
  setGpsInsets(insets) {
    // Les garde, à zéro par défaut.
    this.gpsInsets = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de setGpsInsets.
  },
  /** Affiche ou masque les coordonnées GPS des coins de l'écran. */
  // setGpsVisible : affiche ou masque les coordonnées des coins (début).
  setGpsVisible(on) {
    // Garde l'état.
    this.gpsOn = Boolean(on);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de setGpsVisible.
  },
  /**
   * Coordonnées GPS des quatre coins et du centre de l'écran, et échelle au centre (Terre suivie seulement).
   * Le rayon de chaque coin est intersecté avec la surface réellement dessinée (rayon des tuiles du niveau affiché,
   * légèrement au-dessus de la sphère) : le point affiché est celui qu'on voit à l'écran, au centimètre près.
   */
  // gpsState : les coordonnées des coins et du centre de l'écran (début).
  gpsState() {
    // Coordonnées masquées, ou cible autre que la Terre : null.
    if (!this.gpsOn || this.focus !== this.earthFocus) return null;
    // La Terre.
    const E = this.earth;
    // La caméra.
    const cam = this.cam;
    // Met à jour la matrice de la Terre.
    E.mesh.updateWorldMatrix(true, false);
    // Matrice de la caméra.
    const c = cam.matrixWorld.elements;
    // Matrice de la Terre.
    const m = E.mesh.matrixWorld.elements;
    // Couche de tuiles affichée, s'il y a une carte.
    const layer = this.tiles.active ? this.tiles.base?.layer : null;
    // Rayon du sol dessiné : celui du niveau affiché, ou 1.
    const ground = layer ? tileRadius(layer.visibleZoom, layer.gap) : 1;
    // Échelle de la Terre dans la scène.
    const scale = Math.hypot(m[0], m[1], m[2]);
    // Calcule les coordonnées (début) :
    const geo = screenGeo({
      // position de la caméra,
      origin: [c[12], c[13], c[14]],
      // sa droite,
      right: [c[0], c[1], c[2]],
      // son haut,
      up: [c[4], c[5], c[6]],
      // son avant,
      forward: [-c[8], -c[9], -c[10]],
      // tangente du demi-champ vertical,
      tanY: Math.tan((cam.fov * D) / 2),
      // format de l'image,
      aspect: cam.aspect,
      // centre de la Terre,
      center: [m[12], m[13], m[14]],
      // rayon du sol dans la scène,
      radius: (E.def.radius || 1) * scale * ground,
      // matrice vers le repère de la Terre,
      toLocal: this.gpsInv.copy(E.mesh.matrixWorld).invert().elements,
      // largeur de l'écran,
      widthPx: this.W,
      // rayon du sol en mètres,
      radiusM: EARTH_RADIUS_M * ground,
      // points de la zone utile.
      points: insetCorners(this.gpsInsets, this.W, this.H),
    // Fin du calcul.
    });
    // Rien à afficher tant que l'écran ne touche pas la Terre.
    if (!geo.center && geo.corners.every((k) => k.lat === null)) return null;
    // Renvoie les coordonnées.
    return geo;
  // Fin de gpsState.
  },
  /**
   * Données d'un astre pour le globe CesiumJS, lues comme dans la composante « Caractéristiques et informations » :
   * rayon de la fiche, type (géante ou non), épaisseur d'atmosphère, couleur de l'interface (voir astre-solide.facts).
   */
  // solidFacts : l'identifiant de l'astre (début).
  solidFacts(id) {
    // Mêmes sources que la fiche : data.bodies, planetData (type) et atmosphereThickness (épaisseur).
    return solidBodyFacts(id, {
      // Les astres de l'app, l'identifiant d'une planète, le type et l'épaisseur d'atmosphère affichés.
      bodies: this.data.bodies, bodyIdOf: bodyId, typeOf: (b) => planetData(b)?.type ?? null, atmosphereKmOf: (b) => atmosphereThickness(b)?.km ?? null,
      // Les réglages des tuiles, en repli.
      cfg: TILED_BODY_BY_ID[id] ?? null,
    // Fin des données.
    });
  // Fin de solidFacts.
  },
  /**
   * Astre solide visé par le globe CesiumJS (engine astre-solide) : chaque astre solide ciblé est découpé en tuiles par
   * CesiumJS (la Terre, la Lune, Mars, Mercure, Vénus et tous les satellites sphériques, avec ou sans fond de carte),
   * avec le rayon affiché dans sa fiche d'information ; sinon la Terre. Les géantes et les satellites irréguliers
   * (Phobos, Deimos : modèle 3D) restent en three.js. Renvoie { id, name, radiusKm, airless, color, minAltitudeKm }.
   */
  // solidGlobeTarget : l'astre visé (début).
  solidGlobeTarget() {
    // Astre tuilé ciblé.
    const tb = this.tiledBodies?.find((t) => t.focus === this.focus);
    // Ses données de fiche.
    const facts = tb ? this.solidFacts(tb.id) : null;
    // Solide d'après sa fiche : cet astre ; sinon la Terre.
    const f = facts?.solid ? facts : this.solidFacts('earth');
    // Réglages des tuiles de l'astre retenu.
    const cfg = TILED_BODY_BY_ID[f.id];
    // Nom affiché (celui des données), rayon de la fiche, air, couleur et altitude minimale (en rayons, ramenée au rayon de la fiche).
    return { id: f.id, name: f.name ?? this.focusTargets?.[this.tiledById?.[f.id]?.focus]?.name ?? f.id, radiusKm: f.radiusKm, airless: f.airless, color: f.color, minAltitudeKm: cfg ? minAltitudeRadii(cfg) * f.radiusKm : 0 };
  // Fin de solidGlobeTarget.
  },
  /** Fond de carte de l'app pour un astre (lu par le globe CesiumJS) : { key, source, projectionId, credit } ou null. */
  // solidImagery : l'identifiant de l'astre (début).
  solidImagery(id) {
    // Fond posé dans le gestionnaire de tuiles de l'astre.
    const base = this.tiledById?.[id]?.tiles.base;
    // Sans fond : null.
    if (!base?.source) return null;
    // Description de la source.
    const info = base.source.info || {};
    // Mention : le texte de l'attribution ({ text } de l'API, ou chaîne), sinon credit ou nom, toujours une chaîne
    // (CesiumJS refuse tout autre type pour son crédit).
    const a = info.attribution;
    const credit = (typeof a === 'string' ? a : a?.text) || info.credit || info.name || '';
    // Le fond : sa clé (couche choisie), sa source, son découpage et sa mention.
    return { key: base.id, source: base.source, projectionId: info.projection === 'equirectangular' ? 'equirectangular' : 'mercator', credit: typeof credit === 'string' ? credit : '' };
  // Fin de solidImagery.
  },
  /** Choisit l'astre du globe CesiumJS et lui passe la main quand il est ciblé et la caméra proche. */
  // updateSolidGlobe : à chaque image (début).
  updateSolidGlobe() {
    // Sans globe : rien.
    if (!this.solidGlobe) return;
    // Astre visé, transmis au globe (recréé s'il change).
    const target = this.solidGlobeTarget();
    // Transmis.
    this.solidGlobe.setTarget(target);
    // Son astre tuilé.
    const tb = this.tiledById?.[target.id];
    // Sans astre : rien.
    if (!tb) return;
    // Repère des tuiles à la rotation propre de l'astre (voir syncSolidRoot).
    this.syncSolidRoot(tb);
    // Position de la caméra dans le repère des tuiles de l'astre (sphère de rayon 1, axe des pôles = +Y).
    const local = tb.tiles.root.worldToLocal(this.cam.position.clone());
    // Astre ciblé : la distance visée par le zoom three.js (pour que le zoom en cours continue dans le globe).
    const focused = this.focus === tb.focus, dist = local.length() * tb.radius;
    // Le module décide : astre ciblé, distance au centre et distance visée, rayon, direction de la caméra.
    this.solidGlobe.update({ focused, dist, distGoal: focused ? this.distGoal : dist, radius: tb.radius, camLocal: [local.x, local.y, local.z] });
  // Fin de updateSolidGlobe.
  },
  /**
   * Repère des tuiles d'un astre remis à sa rotation propre. Ce repère ne suit la rotation de l'astre que dans la mise à
   * jour des tuiles three.js, qui est sautée quand le globe CesiumJS dessine l'astre : figé, il faisait tourner le globe
   * CesiumJS avec la caméra et l'ombre jour/nuit restait collée au sol (elle suivait la rotation de la planète).
   */
  // syncSolidRoot : l'astre tuilé (début).
  syncSolidRoot(tb) {
    // Recopie de la rotation propre, si l'astre en a une (planètes ; la Lune est orientée par son groupe).
    tb.tiles.body?.syncRotation?.(tb.tiles.root);
  // Fin de syncSolidRoot.
  },
  /**
   * Vue de la caméra three.js dans le repère des tuiles d'un astre (sphère de rayon 1, axe des pôles = +Y) : position
   * (en rayons de l'astre), regard et haut unitaires, ouverture verticale (degrés), proportions, hauteur de l'écran,
   * et direction du Soleil vue de l'astre. Sert au globe CesiumJS. null sans cet astre tuilé.
   */
  // solidBodyView : l'identifiant de l'astre (début).
  solidBodyView(id) {
    // L'astre tuilé.
    const tb = this.tiledById?.[id];
    // Sans astre : null.
    if (!tb) return null;
    // Repère des tuiles, matrices à jour.
    const root = tb.tiles.root;
    // Rotation propre de l'astre recopiée sur le repère (voir syncSolidRoot).
    this.syncSolidRoot(tb);
    // Matrices du repère à jour.
    root.updateWorldMatrix(true, false);
    // Vecteurs et matrice de travail (créés une fois).
    const w = this.solidViewVecs || (this.solidViewVecs = { inv: new THREE.Matrix4(), pos: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(), sun: new THREE.Vector3(), center: new THREE.Vector3() });
    // Passage de la scène au repère des tuiles.
    w.inv.copy(root.matrixWorld).invert();
    // Caméra et ses matrices à jour.
    const cam = this.cam;
    // Matrice de la caméra à jour.
    cam.updateMatrixWorld();
    // Position de la caméra dans le repère des tuiles.
    w.pos.copy(cam.position).applyMatrix4(w.inv);
    // Regard de la caméra dans le repère des tuiles.
    cam.getWorldDirection(w.dir).transformDirection(w.inv);
    // Haut de l'image dans le repère des tuiles.
    w.up.set(0, 1, 0).applyQuaternion(cam.quaternion).transformDirection(w.inv);
    // Centre de l'astre dans la scène.
    w.center.setFromMatrixPosition(root.matrixWorld);
    // Direction de l'astre vers le Soleil, dans le repère des tuiles.
    w.sun.copy(this.sunMesh.position).sub(w.center).transformDirection(w.inv);
    // La vue.
    return { pos: w.pos.toArray(), dir: w.dir.toArray(), up: w.up.toArray(), sunDir: w.sun.toArray(), fovyDeg: cam.fov, aspect: cam.aspect, viewportH: this.H };
  // Fin de solidBodyView.
  },
  /**
   * Cache un astre solide de three.js (le globe CesiumJS le dessine) et renvoie la fonction qui le rend. La Terre :
   * tout son groupe (globe, carte, frontières, nuages) ; un autre astre : sa sphère, son modèle, ses tuiles
   * et son atmosphère (ses satellites restent affichés).
   */
  // hideSolidBody : l'identifiant de l'astre (début).
  hideSolidBody(id) {
    // L'astre tuilé.
    const tb = this.tiledById?.[id];
    // Sans astre : rien à rendre.
    if (!tb) return () => {};
    // Objets à cacher.
    const objs = id === 'earth' ? [this.earth.group, tb.tiles.root] : [tb.mesh, tb.tiles.root, this.atmospheres?.[id], tb.model?.isObject3D ? tb.model : tb.model?.root];
    // Leur état d'avant.
    const was = objs.map((o) => (o ? o.visible : null));
    // Cachés.
    for (const o of objs) if (o) o.visible = false;
    // Fonction qui rend leur état.
    return () => objs.forEach((o, i) => { if (o) o.visible = was[i]; });
  // Fin de hideSolidBody.
  },
  /**
   * Atmosphère et pollution lumineuse au-dessus du globe CesiumJS : le globe (le sol, ses tuiles) est dessiné par
   * CesiumJS par-dessus la scène three.js ; l'atmosphère de l'astre (moteur d'atmosphère de three.js : diffusion, nuages simulés) est
   * redessinée sur une couche transparente posée au-dessus du globe, avec la même caméra, après la pollution lumineuse
   * de la Terre (engine pollution-lumineuse, sous les nuages). Seuls les objets de ces deux calques (ATMO_LAYER,
   * POLLUTION_LAYER) y sont dessinés. `bodyId` null, ou atmosphère absente ou coupée dans
   * Paramètres : la couche est masquée.
   */
  // renderAtmosphereOverlay : l'astre et la caméra (début).
  renderAtmosphereOverlay(bodyId, cam, opacity = 1) {
    // Atmosphère de l'astre (affichée seulement si elle n'est pas coupée dans Paramètres).
    const atmo = bodyId && this.atmospheres?.[bodyId]?.visible ? this.atmospheres[bodyId] : null;
    // Fondu du zoom adouci du globe de la Terre (0 de près : ni ombre ni lumières de la nuit ; transition dans le temps).
    const earthFade = this.solidGlobe?.body?.id === 'earth' ? (this.solidGlobe.visualFade ?? this.solidGlobe.zoomFade ?? 1) : 1;
    // Ombre de la Terre et lumières de la nuit (engine pollution-lumineuse) : seulement sur la Terre, tant que l'ombre
    // ou son fondu ne sont pas nuls (la Terre de CesiumJS n'a pas d'autre ombre).
    const pollution = bodyId === 'earth' && this.lightPollution && earthFade * (this.shadeNow ?? 1) > 0.002 ? this.lightPollution : null;
    // Lumières de la nuit allumées dans Paramètres.
    const lightsOn = this.tiledById?.earth?.tiles.uniforms.lightsOn.value > 0.5;
    // Couche existante.
    const layer = this.atmoOverlay;
    // Ni atmosphère ni pollution lumineuse : couche masquée.
    if (!atmo && !pollution) { if (layer) layer.canvas.style.display = 'none'; return; }
    // Couche créée à la première atmosphère (début).
    if (!layer) {
      // Canevas transparent, plein cadre, qui laisse passer les gestes.
      const canvas = document.createElement('canvas');
      // Style : posé comme le canevas three.js, au-dessus du globe.
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      // Son nom.
      canvas.dataset.engine = 'atmosphere-overlay';
      // Moteur de rendu transparent sur ce canevas.
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, logarithmicDepthBuffer: this.renderer.capabilities.logarithmicDepthBuffer });
      // Fond transparent.
      renderer.setClearColor(0x000000, 0);
      // Gardée.
      this.atmoOverlay = { canvas, renderer, w: 0, h: 0, dpr: 0 };
    // Fin de la création.
    }
    // La couche.
    const o = this.atmoOverlay;
    // Posée juste au-dessus du globe CesiumJS (après son conteneur), sinon après le canevas three.js.
    const anchor = this.solidGlobe?.container || this.canvas;
    // Déplacée si besoin.
    if (anchor.nextSibling !== o.canvas) anchor.after(o.canvas);
    // Même résolution que le canevas three.js.
    const dpr = this.renderer.getPixelRatio();
    // Taille ou résolution changée : réglée.
    if (o.w !== this.W || o.h !== this.H || o.dpr !== dpr) { o.renderer.setPixelRatio(dpr); o.renderer.setSize(this.W, this.H, false); o.w = this.W; o.h = this.H; o.dpr = dpr; }
    // Atmosphère (début).
    if (atmo) {
      // Objets de l'atmosphère sur leur calque (une fois par atmosphère ; ils restent aussi sur le calque 0).
      if (!atmo.userData.atmoLayer) { atmo.traverse((obj) => obj.layers.enable(ATMO_LAYER)); atmo.userData.atmoLayer = true; }
      // L'atmosphère suit la caméra (dedans ou dehors, comme dans la boucle).
      atmo.userData.track?.(cam.position);
    // Fin de l'atmosphère.
    }
    // Pollution lumineuse (début).
    if (pollution) {
      // Mosaïque mondiale des lumières chargée (une fois) par les tuiles de la Terre.
      if (lightsOn) this.tiledById.earth.tiles.loadLightsMosaic?.();
      // Soleil vu de la Terre (repère de ses tuiles), ombre de l'app et fondu du zoom adouci.
      pollution.update(this.solidBodyView('earth')?.sunDir, this.shadeNow ?? 1, earthFade);
    // Fin de la pollution lumineuse.
    }
    // Coque des lumières dessinée seulement ici, sur la Terre.
    this.lightPollution?.setVisible(Boolean(pollution) && lightsOn, Boolean(pollution));
    // Calques de la caméra gardés.
    const mask = cam.layers.mask;
    // Seuls les calques de l'atmosphère et de la pollution lumineuse (dessinée en premier, donc sous les nuages).
    cam.layers.set(ATMO_LAYER); cam.layers.enable(POLLUTION_LAYER);
    // Coquille de l'atmosphère en mode couche : le sol du globe n'est plus assombri sous la caméra.
    atmo?.userData.overlayMode?.(true);
    // Une image de la pollution lumineuse, de l'atmosphère et des nuages.
    o.renderer.render(this.scene, cam);
    // Mode d'origine rendu pour la scène three.js.
    atmo?.userData.overlayMode?.(false);
    // Calques de la caméra rendus.
    cam.layers.mask = mask;
    // Couche affichée.
    o.canvas.style.display = 'block';
    // Opacité de la couche : celle du globe CesiumJS pendant son fondu d'apparition (fondu enchaîné avec three.js).
    o.canvas.style.opacity = String(opacity);
  // Fin de renderAtmosphereOverlay.
  },
  /**
   * Fond spatial du globe CesiumJS de près (fond transparent) : dessine la scène three.js sans l'astre du globe, vue de
   * la caméra du globe. `position`, `direction` et `up` sont dans le repère de l'astre de CesiumJS (mètres), `fovy`
   * est l'ouverture verticale en radians. La caméra three.js est remise en place ensuite (rien ne bouge dans la scène).
   */
  // renderCesiumBackdrop : l'astre, son rayon et la caméra du globe (début).
  // space faux : le sol remplit l'image du globe, l'espace n'est pas redessiné (seulement l'atmosphère).
  renderCesiumBackdrop({ bodyId = 'earth', radiusM = 6371000, position, direction, up, fovy, space = true }) {
    // L'astre tuilé et son repère.
    const tb = this.tiledById?.[bodyId];
    // Sans astre, moteur arrêté ou en pause : rien.
    if (!tb || this.stopped || this.paused || this.suspended) return;
    // Repère des tuiles de l'astre (sphère de rayon 1, axe des pôles = +Y), matrices à jour.
    const root = tb.tiles.root;
    // Matrices du repère à jour.
    root.updateWorldMatrix(true, false);
    // Vecteurs de travail (créés une fois).
    const v = this.backdropVecs || (this.backdropVecs = { pos: new THREE.Vector3(), dir: new THREE.Vector3(), up: new THREE.Vector3(), look: new THREE.Vector3(), savedPos: new THREE.Vector3(), savedQuat: new THREE.Quaternion(), savedUp: new THREE.Vector3() });
    // Position de la caméra du globe dans la scène (en rayons de l'astre, puis dans la scène).
    v.pos.fromArray(ecefToTilesLocal(position, 1 / radiusM)); root.localToWorld(v.pos);
    // Direction du regard dans la scène.
    v.dir.fromArray(ecefToTilesLocal(direction, 1)).transformDirection(root.matrixWorld);
    // Haut de l'image dans la scène.
    v.up.fromArray(ecefToTilesLocal(up, 1)).transformDirection(root.matrixWorld);
    // La caméra three.js.
    const cam = this.cam;
    // Garde son état : position, orientation, haut, ouverture.
    v.savedPos.copy(cam.position); v.savedQuat.copy(cam.quaternion); v.savedUp.copy(cam.up); const savedFov = cam.fov;
    // Même position, même haut, même regard que le globe.
    cam.position.copy(v.pos); cam.up.copy(v.up); cam.lookAt(v.look.copy(v.pos).add(v.dir));
    // Même ouverture verticale (degrés dans three.js).
    if (Number.isFinite(fovy)) cam.fov = THREE.MathUtils.radToDeg(fovy);
    // Projection recalculée.
    cam.updateProjectionMatrix();
    // Espace visible (début).
    if (space) {
      // L'astre de three.js est caché : le globe CesiumJS le dessine ; seul l'espace autour est dessiné.
      const restore = this.hideSolidBody(bodyId);
      // Une image de l'espace, comme dans la boucle (effacement manuel) : l'image est effacée, le ciel lointain
      // (étoiles, Voie lactée, galaxies) est dessiné d'abord, puis la scène par-dessus.
      this.renderer.clear();
      // Ciel lointain, vu de la caméra du globe.
      this.sky.render(this.renderer, cam, 0);
      // Scène (Soleil, planètes, satellites) par-dessus.
      this.renderer.render(this.scene, cam);
      // L'astre reprend son état.
      restore();
    // Fin de l'espace.
    }
    // Atmosphère de l'astre par-dessus le globe, vue de la même caméra.
    this.renderAtmosphereOverlay(bodyId, cam);
    // La caméra three.js reprend son état.
    cam.position.copy(v.savedPos); cam.quaternion.copy(v.savedQuat); cam.up.copy(v.savedUp); cam.fov = savedFov;
    // Projection d'origine.
    cam.updateProjectionMatrix();
  // Fin de renderCesiumBackdrop.
  },
  // setAutoRotate : active ou coupe la rotation automatique.
  setAutoRotate(on) { this.autoRotate = on; },
  /**
   * Coupe la rotation automatique depuis le moteur (zoom avant sur un astre) et prévient l'interface
   * (`onAutoRotateChange`), pour que le bouton « Rotation » se relâche.
   */
  stopAutoRotate() {
    if (!this.autoRotate) return;
    this.autoRotate = false;
    this.onAutoRotateChange?.(false);
  },
  /** Vitesse de la rotation automatique autour de l'astre : multiplicateur de la vitesse d'origine (0,25 à 8). */
  // setRotateSpeed : règle le multiplicateur, entre 0,25 et 8 ; 1 s'il est illisible.
  setRotateSpeed(k) { const n = Number(k); this.rotateSpeed = Number.isFinite(n) ? clamp(n, 0.25, 8) : 1; },
// Fin des méthodes.
};
