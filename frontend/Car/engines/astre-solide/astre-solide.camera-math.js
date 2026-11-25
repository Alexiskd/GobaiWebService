/**
 * Calculs de la caméra du globe CesiumJS, sur le modèle de la caméra three.js (mêmes commandes de la navball, du zoom
 * et du pilotage au téléphone). Fonctions pures, en degrés et en mètres.
 */

// Importe la conversion du glisser de la scène three.js (angle par pixel, raccourci de la vue 3/4).
import { dragRadPerPx, dragStep } from '../../Engine/AstreSolideEngine/InputEngine/touchMath.jsx';

// Rayon moyen de la Terre, en mètres.
export const EARTH_RADIUS_M = 6371000;
// Altitude minimale de la caméra du globe : 10 m.
export const MIN_ALTITUDE_M = 10;
// Tangage : regard vertical (−90°) jusqu'à 30° sous l'horizon (−30°), comme l'inclinaison maximale de three.js.
export const PITCH_MIN_DEG = -90;
// Tangage le plus proche de l'horizon.
export const PITCH_MAX_DEG = -30;
// Vue 3/4 automatique, comme three.js (CameraEngine/cameraTilt.jsx) : l'inclinaison commence à 1,32 rayon du centre,
// elle est complète à 1,045 rayon, et vaut alors 1,05 radian (≈ 60°) depuis la verticale.
export const TILT_START_RATIO = 1.32;
// Distance au centre (en rayons) de l'inclinaison complète.
export const TILT_FULL_RATIO = 1.045;
// Inclinaison maximale depuis la verticale, en degrés.
export const TILT_MAX_DEG = (1.05 * 180) / Math.PI;
// Constante de temps du mouvement (ms) : l'inclinaison s'installe en douceur, comme dans three.js.
export const TILT_RESPONSE_MS = 700;

/** Borne un tangage (degrés) entre le regard vertical et 30° sous l'horizon. */
// Déclare et exporte clampPitch : le tangage.
export const clampPitch = (p) => Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p));

/** 0 loin du sol, 1 près du sol (courbe en S), d'après l'altitude (m) : même rampe que three.js. */
// Déclare et exporte tiltEngagement : l'altitude et le rayon de l'astre (la Terre par défaut), en mètres.
export function tiltEngagement(altitudeM, radiusM = EARTH_RADIUS_M) {
  // Distance au centre, en rayons de l'astre.
  const ratio = 1 + altitudeM / radiusM;
  // Avancement entre le début (0) et l'inclinaison complète (1), borné.
  const x = Math.max(0, Math.min(1, (TILT_START_RATIO - ratio) / (TILT_START_RATIO - TILT_FULL_RATIO)));
  // Courbe en S.
  return x * x * (3 - 2 * x);
// Fin de tiltEngagement.
}

/** Tangage voulu (degrés) : vue 3/4 automatique selon l'altitude si elle est active, sinon regard vertical. */
// Déclare et exporte pitchForTilt : la vue 3/4 active ou non, l'altitude et le rayon de l'astre (m).
export const pitchForTilt = (tiltOn, altitudeM, radiusM = EARTH_RADIUS_M) => (tiltOn ? clampPitch(PITCH_MIN_DEG + TILT_MAX_DEG * tiltEngagement(altitudeM, radiusM)) : PITCH_MIN_DEG);

/** Lissage exponentiel indépendant de la cadence (dt et tau en ms), comme approachTilt de three.js. */
// Déclare et exporte approachPitch : tangage actuel, voulu, temps écoulé.
export const approachPitch = (current, target, dtMs, tauMs = TILT_RESPONSE_MS) => current + (target - current) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));

/**
 * Zoom three.js (facteur sur l'altitude : < 1 rapproche, > 1 éloigne) traduit en distance à parcourir (m) le long du
 * regard : positive = rapprocher. Jamais sous l'altitude minimale.
 */
// Déclare et exporte zoomStep : l'altitude (m) et le facteur.
export function zoomStep(altitudeM, f) {
  // Altitude visée, jamais sous le plancher.
  const next = Math.max(MIN_ALTITUDE_M, altitudeM * f);
  // Distance à parcourir : de l'altitude actuelle à l'altitude visée.
  return altitudeM - next;
// Fin de zoomStep.
}

/**
 * Déplacement three.js le long des axes de l'écran (radians, pas d'autant plus fin qu'on est près du sol : facteur
 * 0,9 × altitude / rayon) traduit en angles de rotation autour du centre de la Terre (radians).
 */
// Déclare et exporte moveAngles : les pas à droite et en avant, l'altitude et le rayon de l'astre (m).
export function moveAngles(right, forward, altitudeM, radiusM = EARTH_RADIUS_M) {
  // Finesse du pas : comme surfaceRatio × 0,9 dans three.js, bornée à 1.
  const k = Math.max(1e-9, Math.min(1, (0.9 * altitudeM) / radiusM));
  // Angles de rotation.
  return { right: right * k, forward: forward * k };
// Fin de moveAngles.
}

/** Cap normalisé entre 0 et 360°. */
// Déclare et exporte wrapHeading : le cap en degrés.
export const wrapHeading = (h) => ((h % 360) + 360) % 360;

/**
 * Point du repère de l'astre dans CesiumJS (ECEF, ou repère fixe de l'astre : mètres, +Z vers le pôle Nord, +X vers la longitude 0) traduit dans le
 * repère des tuiles de la Terre de three.js (sphère de rayon 1, axe des pôles = +Y, longitude = atan2(−z, x)).
 * Avec `scale = 1`, traduit une direction (sans changer d'unité).
 */
// Déclare et exporte ecefToTilesLocal : x, y, z en ECEF et l'échelle (1 / rayon de la Terre en mètres par défaut).
export const ecefToTilesLocal = ({ x, y, z }, scale = 1 / EARTH_RADIUS_M) => [x * scale, z * scale, -y * scale];


/** Vitesse de rotation des flèches du clavier maintenues (rad/s), la même que dans la scène three.js. */
// Déclare et exporte la vitesse des flèches : 1,1 rad/s.
export const KEY_ROTATE_SPEED = 1.1;

/**
 * Glisser de (dx, dy) pixels traduit en déplacement sur la Terre, exactement comme dans la scène three.js : le sol
 * reste sous le doigt (angle par pixel d'après l'altitude, l'ouverture verticale et la hauteur de l'écran), et la vue
 * inclinée (3/4) agrandit le déplacement vertical. Renvoie { right, forward } en radians le long des axes de l'écran.
 */
// Déclare et exporte dragMove : le glisser et l'état de la caméra du globe (début).
export function dragMove(dx, dy, { altitudeM, fovyRad, viewportH, pitchDeg = -90, radiusM = EARTH_RADIUS_M }) {
  // Angle par pixel : altitude en rayons de l'astre, ouverture verticale en degrés, hauteur de l'écran.
  const radPerPx = dragRadPerPx(Math.max(0, altitudeM) / radiusM, (fovyRad * 180) / Math.PI, viewportH);
  // Inclinaison de la vue : 0 en regardant droit vers le sol (tangage −90°).
  const tilt = ((pitchDeg + 90) * Math.PI) / 180;
  // Même conversion que la scène three.js.
  return dragStep(dx, dy, radPerPx, tilt);
// Fin de dragMove.
}

/**
 * Flèches maintenues : déplacement de cette image le long des axes de l'écran (radians), d'autant plus fin qu'on est
 * près du sol (même facteur que la scène three.js : 0,9 × altitude / rayon, borné à 1), dt borné à 100 ms.
 */
// Déclare et exporte keyMove : les flèches enfoncées, le temps écoulé (ms), l'altitude et le rayon de l'astre (m) (début).
export function keyMove(keys, dtMs, altitudeM, radiusM = EARTH_RADIUS_M) {
  // Finesse du pas selon la proximité du sol (altitude en rayons de l'astre).
  const k = Math.max(1e-9, Math.min(1, (0.9 * Math.max(0, altitudeM)) / radiusM));
  // Pas de cette image.
  const step = Math.min(Math.max(0, dtMs), 100) * 0.001 * KEY_ROTATE_SPEED * k;
  // Droite moins gauche, haut moins bas.
  return { right: ((keys?.right ? 1 : 0) - (keys?.left ? 1 : 0)) * step, forward: ((keys?.up ? 1 : 0) - (keys?.down ? 1 : 0)) * step };
// Fin de keyMove.
}

/**
 * Rotation de la caméra autour du centre de la Terre qui la déplace de `right` et `forward` radians le long des axes de
 * l'écran posés sur le sol (comme moveOnSphere dans la scène three.js) : `up` = direction du cap sur le sol, `right`
 * = sa droite. `p` : position de la caméra (ECEF), `heading` : cap en radians (0 = nord, sens horaire).
 * Renvoie { axis, angle } pour `camera.rotate(axis, angle)` de CesiumJS (qui tourne de −angle autour de l'axe, sens
 * direct), ou null s'il n'y a rien à faire.
 */
// Déclare et exporte surfaceRotation : la position, le cap et le déplacement (début).
export function surfaceRotation(p, heading, right, forward) {
  // Angle total parcouru sur la sphère.
  const angle = Math.hypot(right, forward);
  // Rien : null.
  if (!(angle > 0)) return null;
  // Normale au sol sous la caméra (direction du centre vers la caméra).
  const r = Math.hypot(p.x, p.y, p.z) || 1, n = [p.x / r, p.y / r, p.z / r];
  // Tangente est : pôle (+Z) × normale, normalisée (au pôle exact : l'axe X).
  let e = [-n[1], n[0], 0]; const el = Math.hypot(e[0], e[1]); e = el > 1e-12 ? [e[0] / el, e[1] / el, 0] : [0, 1, 0];
  // Tangente nord : normale × est.
  const t = [n[1] * e[2] - n[2] * e[1], n[2] * e[0] - n[0] * e[2], n[0] * e[1] - n[1] * e[0]];
  // Haut de l'écran posé sur le sol (cap) et sa droite.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  // Haut : nord tourné du cap vers l'est.
  const up = [0, 1, 2].map((i) => t[i] * ch + e[i] * sh);
  // Droite : est tourné du cap vers le sud.
  const rt = [0, 1, 2].map((i) => e[i] * ch - t[i] * sh);
  // Direction du déplacement sur le sol.
  const d = [0, 1, 2].map((i) => (rt[i] * right + up[i] * forward) / angle);
  // Axe de la rotation directe qui amène la normale vers d : normale × d.
  const axis = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
  // camera.rotate tourne de −angle : on lui passe −angle.
  return { axis, angle: -angle };
// Fin de surfaceRotation.
}

/** Vitesse de la rotation automatique autour de l'astre (rad/s), la même que dans la scène three.js. */
// Déclare et exporte la vitesse de la rotation automatique : 0,072 rad/s.
export const AUTO_ROTATE_SPEED = 0.072;

/**
 * Rotation automatique (bouton « Rotation ») : angle de cette image autour de l'axe des pôles, comme dans la scène
 * three.js : vitesse × multiplicateur de Paramètres × temps écoulé, ralentie près du sol (altitude en rayons, bornée
 * à 1). dt borné à 100 ms (retour d'onglet : pas de saut).
 */
// Déclare et exporte autoRotateAngle : le temps écoulé (ms), le multiplicateur, l'altitude et le rayon de l'astre (m).
export function autoRotateAngle(dtMs, rotateSpeed = 1, altitudeM = EARTH_RADIUS_M, radiusM = EARTH_RADIUS_M) {
  // Ralenti près du sol : altitude en rayons de l'astre, entre 0 et 1.
  const near = Math.max(0, Math.min(1, altitudeM / radiusM));
  // Angle de cette image.
  return AUTO_ROTATE_SPEED * (Number.isFinite(rotateSpeed) ? rotateSpeed : 1) * Math.min(Math.max(0, dtMs), 100) * 0.001 * near;
// Fin de autoRotateAngle.
}

// Étendue (m) du fondu d'éclairage de CesiumJS détourné pour régler l'intensité de l'ombre : très grande devant la
// distance de la caméra, pour qu'un léger décalage de cette distance entre deux réglages ne change pas l'ombre.
export const SHADE_FADE_SPAN_M = 1e10;

/**
 * Bouton « Ombre » sur le globe : intensité de l'ombre (0 = Terre entièrement éclairée, 1 = face nuit dans l'ombre,
 * fondu entre les deux) traduite en réglages du globe CesiumJS. À 0, l'éclairage est coupé.
 *  - Globe plat (ombrage jour/nuit de CesiumJS) : l'obscurité de la face nuit est fixe dans le shader (0,3), seul son
 *    fondu selon la distance de la caméra (`lightingFadeOutDistance` → `lightingFadeInDistance`) la règle. Les deux
 *    distances sont posées autour de la distance de la caméra `camDistM` pour que ce fondu vaille l'intensité.
 *  - Globe en relief (éclairage par sommet) : obscurité de la face nuit (`vertexShadowDarkness`) de 1 (aucune ombre)
 *    à 0,3.
 */
// Déclare et exporte cesiumShade : l'intensité de l'ombre et la distance de la caméra au centre de l'astre (début).
export function cesiumShade(value, camDistM = 0) {
  // Intensité bornée entre 0 et 1 (1 si illisible).
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  // Distance de la caméra (0 si illisible).
  const d = Number.isFinite(camDistM) ? camDistM : 0;
  // Début du fondu : fondu = (d − début) / étendue = v.
  const out = d - v * SHADE_FADE_SPAN_M;
  // Éclairage du Soleil seulement s'il y a de l'ombre ; obscurité de la face nuit et fondu selon l'intensité.
  return { enableLighting: v > 0, vertexShadowDarkness: 0.3 + 0.7 * (1 - v), lightingFadeOutDistance: out, lightingFadeInDistance: out + SHADE_FADE_SPAN_M };
// Fin de cesiumShade.
}

/**
 * Point (ou direction avec `scale = 1`) du repère des tuiles de la Terre de three.js (sphère de rayon 1, axe des pôles
 * = +Y) traduit dans le repère terrestre de CesiumJS (ECEF : mètres, +Z = pôle Nord). Inverse de ecefToTilesLocal.
 */
// Déclare et exporte tilesLocalToEcef : [x, y, z] du repère des tuiles et l'échelle (rayon de la Terre en mètres).
export const tilesLocalToEcef = ([x, y, z], scale = EARTH_RADIUS_M) => ({ x: x * scale, y: -z * scale, z: y * scale });

/**
 * Vue de la caméra three.js (repère des tuiles de la Terre : position en rayons terrestres, regard et haut unitaires)
 * traduite pour la caméra du globe CesiumJS, qui dessine la Terre par-dessus la scène three.js :
 * position, regard et haut en ECEF ; ouverture CesiumJS (horizontale si l'écran est plus large que haut, verticale
 * sinon) ; plans proche et lointain qui encadrent la Terre ; `inView` faux si la Terre est hors de l'écran ou fait
 * moins d'un pixel (`viewportH` : hauteur de l'écran en pixels).
 */
// Déclare et exporte threeViewToCesium : la vue three.js et l'ouverture verticale (degrés) et les proportions (début).
export function threeViewToCesium({ pos, dir, up }, { fovyDeg, aspect, viewportH = 0, radiusM = EARTH_RADIUS_M }) {
  // Distance de la caméra au centre de la Terre, en rayons.
  const d = Math.hypot(pos[0], pos[1], pos[2]) || 1e-9;
  // Ouverture verticale en radians.
  const fovy = (fovyDeg * Math.PI) / 180;
  // Demi-diagonale de l'écran, en radians.
  const halfDiag = Math.atan(Math.tan(fovy / 2) * Math.hypot(1, aspect));
  // Angle entre le regard et le centre de la Terre.
  const cosToCenter = -(dir[0] * pos[0] + dir[1] * pos[1] + dir[2] * pos[2]) / d;
  // Rayon apparent de la Terre (dans la Terre : tout l'écran).
  const angularRadius = d > 1 ? Math.asin(1 / d) : Math.PI;
  // Rayon de la Terre à l'écran, en pixels (hauteur de l'écran connue) : sous 1 pixel, three.js la dessine (même
  // image, sans faire tourner CesiumJS pour un point).
  const radiusPx = viewportH > 0 ? (angularRadius / fovy) * viewportH : Infinity;
  // La Terre touche l'écran (bord du disque dans la demi-diagonale) et fait au moins un pixel.
  const inView = Math.acos(Math.max(-1, Math.min(1, cosToCenter))) - angularRadius < halfDiag && radiusPx >= 1;
  // Ouverture CesiumJS : horizontale sur un écran plus large que haut.
  const fov = aspect > 1 ? 2 * Math.atan(Math.tan(fovy / 2) * aspect) : fovy;
  // Altitude de la caméra (m).
  const altitudeM = (d - 1) * radiusM;
  // Plan proche : la moitié de la distance au sommet de l'atmosphère (200 km, ou 3 % du rayon pour un petit astre),
  // jamais sous 1 m.
  const near = Math.max(1, 0.5 * (altitudeM - Math.min(2e5, 0.03 * radiusM)));
  // Plan lointain : au-delà de la face cachée de l'astre.
  const far = (d + 2) * radiusM;
  // Renvoie la vue CesiumJS.
  return { position: tilesLocalToEcef(pos, radiusM), direction: tilesLocalToEcef(dir, 1), up: tilesLocalToEcef(up, 1), fov, aspect, near, far, inView };
// Fin de threeViewToCesium.
}

/** Lissage du zoom de la scène three.js (ms) : ≈ 16 % du chemin restant par image à 60 images par seconde. */
// Déclare et exporte la constante de temps du zoom : 96 ms.
export const ZOOM_TAU_MS = 96;

/**
 * Zoom calé sur three.js : le zoom multiplie l'altitude VISÉE (pas l'altitude actuelle) par le facteur, comme
 * `engine.zoom` (plusieurs crans de molette s'additionnent), bornée entre l'altitude minimale de l'astre et `maxM`.
 */
// Déclare et exporte zoomGoal : l'altitude visée (m), le facteur, les bornes (m).
export const zoomGoal = (goalM, f, minM = MIN_ALTITUDE_M, maxM = 1e9) => Math.max(minM, Math.min(maxM, Math.max(goalM, minM) * f));

/**
 * Avance l'altitude vers l'altitude visée comme la distance de la caméra three.js : rapprochement géométrique
 * (altitude × (visée / altitude)^(1 − e^(−dt/τ))), indépendant de la cadence ; dt borné à 100 ms.
 */
// Déclare et exporte easeAltitude : l'altitude actuelle, visée (m), le temps écoulé et la constante de temps (ms).
export function easeAltitude(altM, goalM, dtMs, tauMs = ZOOM_TAU_MS) {
  // Altitudes illisibles ou nulles : directement la visée.
  if (!(altM > 0) || !(goalM > 0)) return goalM;
  // Rapprochement géométrique, comme this.dist *= (distGoal / dist)^k dans three.js.
  return altM * Math.pow(goalM / altM, 1 - Math.exp(-Math.min(Math.max(0, dtMs), 100) / tauMs));
// Fin de easeAltitude.
}

/** Double-clic : facteur sur l'altitude (moitié pour s'approcher, double avec Maj pour s'éloigner). */
// Déclare et exporte les facteurs du double-clic.
export const DBLCLICK_IN = 0.5;
// Avec Maj : on s'éloigne.
export const DBLCLICK_OUT = 2;

/**
 * Double-clic : déplacement de la caméra (radians) qui amène le point visé au centre de l'écran, d'après le point
 * au centre et le point cliqué (longitude, latitude en radians). La longitude prend le plus court chemin.
 */
// Déclare et exporte panGoal : la caméra, le point au centre et le point cliqué (début).
export function panGoal(cam, center, target) {
  // Écart de longitude ramené entre −π et π (plus court chemin, y compris à travers l'antiméridien).
  const dLon = Math.atan2(Math.sin(target.lon - center.lon), Math.cos(target.lon - center.lon));
  // Latitude visée, bornée aux pôles.
  const lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cam.lat + (target.lat - center.lat)));
  // Longitude visée, ramenée entre −π et π.
  const lon = Math.atan2(Math.sin(cam.lon + dLon), Math.cos(cam.lon + dLon));
  // Renvoie la position visée de la caméra.
  return { lon, lat };
// Fin de panGoal.
}

/**
 * Avance la caméra vers la position visée au même rythme que le zoom (part 1 − e^(−dt/τ) du chemin restant) ;
 * la longitude prend le plus court chemin. dt borné à 100 ms.
 */
// Déclare et exporte panStep : la position, la visée (radians), le temps écoulé et la constante de temps (ms) (début).
export function panStep(pos, goal, dtMs, tauMs = ZOOM_TAU_MS) {
  // Part du chemin parcourue pendant dt.
  const k = 1 - Math.exp(-Math.min(Math.max(0, dtMs), 100) / tauMs);
  // Écart de longitude par le plus court chemin.
  const dLon = Math.atan2(Math.sin(goal.lon - pos.lon), Math.cos(goal.lon - pos.lon));
  // Nouvelle longitude, ramenée entre −π et π.
  const lon = Math.atan2(Math.sin(pos.lon + dLon * k), Math.cos(pos.lon + dLon * k));
  // Renvoie la nouvelle position.
  return { lon, lat: pos.lat + (goal.lat - pos.lat) * k };
// Fin de panStep.
}

/**
 * Le ciel (l'espace derrière le globe) est-il visible ? Vrai si l'un des quatre coins de l'image vise au-dessus de
 * l'horizon de l'astre (sphère un peu réduite et marge de 1° : on préfère dessiner le ciel pour rien que le rater).
 * Faux quand le sol remplit toute l'image : le fond spatial n'a pas besoin d'être redessiné.
 * Vecteurs { x, y, z } dans le repère de l'astre (position en m, direction et haut unitaires), ouverture verticale en
 * radians, rapport largeur / hauteur de l'image, rayon de l'astre en m.
 */
// Déclare et exporte skyVisible : la caméra et l'astre (début).
export function skyVisible({ position: p, direction: d, up: u, fovy, aspect = 1, radiusM }) {
  // Distance au centre.
  const dist = Math.hypot(p.x, p.y, p.z);
  // Valeurs illisibles : on dessine le ciel.
  if (!(dist > 0) || !(radiusM > 0) || !Number.isFinite(fovy)) return true;
  // Rayon un peu réduit (aplatissement, marge) ; caméra sous ce rayon : on dessine le ciel.
  const r = radiusM * 0.995;
  // Sous ce rayon : ciel dessiné.
  if (dist <= r) return true;
  // Verticale locale (vers le haut).
  const n = { x: p.x / dist, y: p.y / dist, z: p.z / dist };
  // Abaissement de l'horizon sous l'horizontale (radians), plus 1° de marge.
  const dip = Math.acos(r / dist) + Math.PI / 180;
  // Droite de l'image : direction × haut.
  const rt = { x: d.y * u.z - d.z * u.y, y: d.z * u.x - d.x * u.z, z: d.x * u.y - d.y * u.x };
  // Demi-ouvertures (tangentes) verticale et horizontale.
  const ty = Math.tan(fovy / 2), tx = ty * aspect;
  // Pour chaque coin de l'image (début).
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    // Rayon du coin.
    const ray = { x: d.x + sy * ty * u.x + sx * tx * rt.x, y: d.y + sy * ty * u.y + sx * tx * rt.y, z: d.z + sy * ty * u.z + sx * tx * rt.z };
    // Élévation du rayon au-dessus de l'horizontale locale.
    const elev = Math.asin(Math.max(-1, Math.min(1, (ray.x * n.x + ray.y * n.y + ray.z * n.z) / Math.hypot(ray.x, ray.y, ray.z))));
    // Au-dessus de l'horizon : ciel visible.
    if (elev > -dip) return true;
  // Fin des coins.
  }
  // Sol partout : pas de ciel.
  return false;
// Fin de skyVisible.
}

/**
 * Finesse des tuiles du globe (erreur d'écran tolérée, en pixels ; CesiumJS : 2 par défaut). Au repos : 2 sur
 * ordinateur, 3 sur écran tactile (téléphone, tablette : moins de tuiles, moins de chauffe). En mouvement : 2 de plus
 * (des tuiles plus grossières suffisent pendant que la vue bouge ; les fines arrivent dès l'arrêt).
 */
// Déclare et exporte globeScreenError : en mouvement ? écran tactile ? (début).
export function globeScreenError({ moving = false, touch = false } = {}) {
  // Repos, plus le surcoût du mouvement.
  return (touch ? 3 : 2) + (moving ? 2 : 0);
// Fin de globeScreenError.
}

/**
 * Avancement d'un fondu (0 à 1, courbe en S) commencé à `start` (null : pas commencé → 0 ; −Infinity : fini → 1),
 * à l'instant `now`, sur `durationMs`. Fonction pure.
 */
// Déclare et exporte fadeProgress : le début, l'instant et la durée.
export function fadeProgress(start, now, durationMs) {
  // Pas commencé : 0.
  if (start == null) return 0;
  // Avancement borné.
  const t = durationMs > 0 ? Math.max(0, Math.min(1, (now - start) / durationMs)) : 1;
  // Courbe en S (départ et arrivée doux).
  return t * t * (3 - 2 * t);
// Fin de fadeProgress.
}
