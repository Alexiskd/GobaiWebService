// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe lonLatToVec, la conversion d'une longitude et d'une latitude en vecteur, depuis ephemeris.
import { lonLatToVec } from './ephemeris';
// Importe le rayon de la Terre en mètres, depuis gps.
import { EARTH_RADIUS_M } from './gps';
// Importe la taille minimale de la Terre à l'écran et les fonctions de calcul du point bleu, depuis userMarkerMath.
import { EARTH_MIN_PX, aboveHorizon, accuracyRadiusPx, apparentRadiusPx, coneRotationDeg, metersPerPixel, screenNorthDeg, validHeading } from './userMarkerMath';

// Vecteur de travail.
const v3 = new THREE.Vector3();
// Vecteur de travail pour le voisin au nord.
const north = new THREE.Vector3();
// Matrice de travail pour l'inverse de la matrice de la Terre.
const inv = new THREE.Matrix4();

/**
 * Point bleu de la position de l'utilisateur sur la Terre, avec halo de précision et cône d'orientation.
 * Un seul élément HTML déplacé par transformation (pas de mise en page) : rien n'est calculé tant qu'aucune
 * position n'est posée, et les styles ne sont réécrits que lorsqu'ils changent.
 */
// Déclare et exporte la classe UserMarker (début).
export class UserMarker {
  // Constructeur : l'élément HTML parent (début).
  constructor({ parent }) {
    // Crée l'élément du point.
    const el = document.createElement('div');
    // Sa classe CSS.
    el.className = 'user-marker';
    // Caché des lecteurs d'écran.
    el.setAttribute('aria-hidden', 'true');
    // Ses quatre parties : le halo, le cône, le point et l'onde.
    el.innerHTML = '<i class="user-marker-halo"></i><i class="user-marker-cone"></i><i class="user-marker-dot"></i><i class="user-marker-pulse"></i>';
    // Caché au départ.
    el.style.display = 'none';
    // L'ajoute au parent.
    parent.appendChild(el);
    // Garde l'élément.
    this.el = el;
    // Garde le halo.
    this.halo = el.children[0];
    // Garde le cône.
    this.cone = el.children[1];
    // Aucune position au départ.
    this.position = null;
    // Pas affiché.
    this.shown = false;
    // Dernières valeurs écrites dans les styles : aucune au départ.
    this.last = { x: NaN, y: NaN, halo: -1, cone: null };
  // Fin du constructeur.
  }

  /** Pose le point ({ lat, lon, accuracyM?, headingDeg?, live? }) ou l'enlève (null). `live` : position suivie en direct (onde autour du point). */
  // set : pose ou enlève le point (début).
  set(position) {
    // Latitude et longitude converties en nombres.
    const lat = Number(position?.lat), lon = Number(position?.lon);
    // Ajoute ou retire la classe is-live selon que la position est suivie en direct.
    this.el.classList.toggle('is-live', Boolean(position?.live));
    // Sans position, ou avec des coordonnées invalides (début).
    if (!position || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      // Oublie la position.
      this.position = null;
      // Masque le point.
      this.hide();
      // Terminé.
      return;
    // Fin du cas sans position.
    }
    // Latitude d'un voisin situé 0,01° plus au nord, plafonnée à 89,999°.
    const northLat = Math.min(89.999, lat + 0.01);
    // Nouvelle position (début).
    this.position = {
      // Vecteur du point sur la sphère.
      lv: lonLatToVec([lon, lat]),
      // Voisin au nord (au sud tout près du pôle) : donne la direction du nord à l'écran.
      // Vecteur du voisin : au nord, ou 0,01° au sud quand le plafond empêche d'aller plus au nord.
      nv: lonLatToVec([lon, northLat > lat ? northLat : lat - 0.01]),
      // flip : vrai quand le voisin est au sud.
      flip: !(northLat > lat),
      // Précision en mètres, ou 0 si elle n'est pas un nombre positif.
      accuracyM: Number(position.accuracyM) > 0 ? Number(position.accuracyM) : 0,
      // Cap validé, ou null.
      heading: validHeading(position.headingDeg),
    // Fin de la position.
    };
  // Fin de set.
  }

  // hide : masque le point (début).
  hide() {
    // Déjà masqué : rien à faire.
    if (!this.shown) return;
    // Note qu'il est masqué.
    this.shown = false;
    // Le cache dans la page.
    this.el.style.display = 'none';
  // Fin de hide.
  }

  // update : replace le point à l'écran ; reçoit la caméra, la taille de l'écran, la Terre et un masquage forcé (début).
  update({ cam, W, H, earthMesh, hidden = false }) {
    // La position posée.
    const p = this.position;
    // Aucune : rien à faire.
    if (!p) return;
    // Masquage forcé : masque et termine.
    if (hidden) { this.hide(); return; }
    // Met à jour la matrice de la Terre.
    earthMesh.updateWorldMatrix(true, false);
    // Cette matrice.
    const world = earthMesh.matrixWorld;
    // Caméra dans le repère de la Terre (sphère unité) : horizon et taille apparente.
    // Position de la caméra dans le repère de la Terre.
    v3.copy(cam.position).applyMatrix4(inv.copy(world).invert());
    // Sa distance au centre.
    const camDistance = v3.length();
    // Face cachée de la Terre, ou Terre trop petite à l'écran : pas de point. (Avant, le seuil masquait aussi le point
    // dès que la caméra descendait sous ≈ 640 m d'altitude — exactement là où « Ma position » amène la vue.)
    // Point sous l'horizon, ou Terre trop petite à l'écran : masque et termine.
    if (!aboveHorizon(p.lv.dot(v3)) || apparentRadiusPx(camDistance, cam.fov, H) < EARTH_MIN_PX) { this.hide(); return; }
    // Distance de la caméra au point, en mètres.
    const toPointM = v3.sub(p.lv).length() * EARTH_RADIUS_M;
    // Projection du point à l'écran.
    v3.copy(p.lv).applyMatrix4(world).project(cam);
    // Derrière le plan lointain ou hors de l'écran : masque et termine.
    if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { this.hide(); return; }
    // Coordonnées en pixels, arrondies au demi-pixel.
    const x = Math.round(((v3.x + 1) / 2) * W * 2) / 2, y = Math.round(((1 - v3.y) / 2) * H * 2) / 2;

    // Dernières valeurs écrites.
    const last = this.last;
    // S'il était masqué : le note affiché et le montre.
    if (!this.shown) { this.shown = true; this.el.style.display = ''; }
    // Si la position a changé (début).
    if (x !== last.x || y !== last.y) {
      // Mémorise la nouvelle position.
      last.x = x; last.y = y;
      // Déplace l'élément par une translation CSS.
      this.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    // Fin du changement de position.
    }
    // Rayon du halo en pixels, d'après la précision et l'échelle de la vue.
    const halo = accuracyRadiusPx(p.accuracyM, metersPerPixel(toPointM, cam.fov, H));
    // S'il a changé (début).
    if (halo !== last.halo) {
      // Mémorise le nouveau rayon.
      last.halo = halo;
      // Montre le halo s'il a un rayon, sinon le cache.
      this.halo.style.display = halo ? '' : 'none';
      // Avec un rayon : largeur et hauteur du halo, le double du rayon.
      if (halo) this.halo.style.width = this.halo.style.height = `${halo * 2}px`;
    // Fin du changement de halo.
    }
    // Rotation du cône : aucune par défaut.
    let cone = null;
    // Si un cap est connu (début).
    if (p.heading !== null) {
      // Projection du voisin à l'écran.
      north.copy(p.nv).applyMatrix4(world).project(cam);
      // Ses coordonnées en pixels.
      const nx = ((north.x + 1) / 2) * W, ny = ((1 - north.y) / 2) * H;
      // Angle du nord à l'écran ; retourné de 180° quand le voisin est au sud.
      const northDeg = screenNorthDeg(x, y, nx, ny) + (p.flip ? 180 : 0);
      // Rotation du cône : le nord plus le cap.
      cone = coneRotationDeg(northDeg, p.heading);
    // Fin du cas avec cap.
    }
    // Si la rotation a changé (début).
    if (cone !== last.cone) {
      // Mémorise la nouvelle rotation.
      last.cone = cone;
      // Cache le cône sans cap, sinon le montre.
      this.cone.style.display = cone === null ? 'none' : '';
      // Avec un cap : tourne le cône.
      if (cone !== null) this.cone.style.transform = `rotate(${cone}deg)`;
    // Fin du changement de cône.
    }
  // Fin de update.
  }

  // dispose : retire l'élément de la page.
  dispose() { this.el.remove(); }
// Fin de la classe UserMarker.
}
