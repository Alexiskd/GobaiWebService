// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le repère de l'orbite, la distance, l'état d'un satellite et le repère synchrone, depuis satelliteMath.
import { orbitBasis, relDistanceKm, satelliteState, synchronousBasis } from './satelliteMath';
// Importe le ruban des orbites.
import { OrbitRibbon } from './orbitRibbon';
// Importe les opacités de la traînée d'une orbite fermée.
import { loopTrailAlphas } from './orbitRibbonMath';

// Nombre de segments du cercle d'orbite : 256.
const ORBIT_SEGMENTS = 256;
// Une orbite n'est tracée que si la caméra est assez près de la planète pour qu'elle fasse plus que quelques pixels.
// Une orbite n'est tracée que si la caméra est à moins de 60 fois son rayon de la planète.
const ORBIT_VIEW_RATIO = 60;
// Satellites hors du système ciblé : position et orientation recalculées une image sur 30 (≈ 2 fois par seconde),
// décalées d'un satellite à l'autre ; entre-temps ils suivent simplement leur planète.
// Un satellite hors du système ciblé est recalculé une image sur 30.
const COLD_EVERY = 30;

/**
 * Points du cercle unité dans le plan xz (normale +y), partagés par toutes les orbites : 257 points, le dernier
 * répétant le premier pour fermer la boucle du ruban.
 */
// unitCirclePoints : les positions d'un cercle de rayon 1 (début).
function unitCirclePoints() {
  // Trois nombres par point, un point de plus pour fermer la boucle.
  const out = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
  // Pour chaque point, le dernier compris (début).
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    // Angle du point (le dernier revient à 0).
    const a = ((i % ORBIT_SEGMENTS) / ORBIT_SEGMENTS) * Math.PI * 2;
    // Point du cercle, dans le plan xz.
    out[3 * i] = Math.cos(a); out[3 * i + 1] = 0; out[3 * i + 2] = Math.sin(a);
  // Fin de la boucle.
  }
  // Renvoie les positions.
  return out;
// Fin de unitCirclePoints.
}

/**
 * Satellites naturels sphériques (Jupiter à Pluton), sur le modèle de la Lune :
 *  - un groupe par satellite = repère de sa surface (longitude 0 vers la planète, Nord sur la normale de l'orbite) ;
 *    il porte la sphère de fond et les tuiles (voir tiledBodies.jsx) ;
 *  - position exacte interpolée dans la table JPL Horizons (GET /ephemeris/satellites), sinon orbite de repli ;
 *  - orbite tracée autour de la planète quand la caméra en est proche.
 * Le moteur place les groupes à chaque image (origine flottante), comme les planètes.
 */
// Déclare et exporte la classe SatelliteSystem (début).
export class SatelliteSystem {
  // Constructeur : la scène, les définitions des satellites, les planètes, la fonction d'identifiant et les pôles des planètes (début).
  constructor({ scene, defs = [], planets, bodyId, poles = {} }) {
    // Garde les pôles.
    this.poles = poles; // pôle de chaque planète (repère de la scène), pour l'orbite de repli
    // Tables de positions, par identifiant de satellite.
    this.tables = new Map();
    // Points du cercle, partagés par toutes les orbites.
    this.circle = unitCirclePoints();
    // Satellite dont l'orbite est mise en avant : aucun.
    this.focused = null;
    // Matrice de travail.
    this.basisM = new THREE.Matrix4();
    // Trois vecteurs de travail pour les axes d'un repère.
    this.bx = new THREE.Vector3(); this.by = new THREE.Vector3(); this.bz = new THREE.Vector3();
    // Compteur d'images.
    this.tick = 0;
    // Liste des satellites.
    this.list = [];
    // Pour chaque définition (début).
    for (const def of defs) {
      // Sa planète, retrouvée par son identifiant.
      const parent = planets.find((p) => bodyId(p.def) === def.parent);
      // Planète absente : satellite ignoré.
      if (!parent) continue;
      // Groupe du satellite.
      const group = new THREE.Group();
      // Son nom : l'identifiant du satellite.
      group.name = def.id;
      // L'ajoute à la scène.
      scene.add(group);
      // Sphère de fond du satellite (début).
      const mesh = new THREE.Mesh(
        // Géométrie : une sphère du rayon du satellite.
        new THREE.SphereGeometry(def.radius, 64, 48),
        // Matériau de sa couleur, ou gris par défaut.
        new THREE.MeshLambertMaterial({ color: def.color || '#9a9a9a' })
      // Fin de la sphère.
      );
      // L'ajoute au groupe.
      group.add(mesh);
      // Tracé de l'orbite : un ruban sur le cercle partagé, de la couleur du satellite (voir orbitRibbon.jsx).
      const trail = new OrbitRibbon({ points: this.circle, color: def.color || '#8fa3d0', name: `orbit-${def.id}` });
      // Traînée : le cercle est tourné pour que le satellite soit au point 0 et qu'il aille vers les angles
      // décroissants (voir orbitBasis) ; les points qu'il vient de quitter sont donc aux angles croissants.
      loopTrailAlphas(trail.alphas, 0, -1);
      // Opacités envoyées à la carte graphique.
      trail.alphasChanged();
      // Le maillage du ruban.
      const orbit = trail.mesh;
      // Caché au départ.
      orbit.visible = false;
      // L'ajoute à la scène.
      scene.add(orbit);
      // Ajoute le satellite à la liste (début).
      this.list.push({
        // Sa définition, sa planète, son groupe, sa sphère, son orbite et son ruban.
        def, parent, group, mesh, orbit, trail,
        // Sa position dans le monde, sa position relative, sa vitesse, et ses deux indicateurs.
        w: new THREE.Vector3(), rel: new THREE.Vector3(), vel: new THREE.Vector3(), exact: false, ready: false,
      // Fin de l'ajout.
      });
    // Fin de la boucle.
    }
    // Table des satellites par identifiant.
    this.byId = new Map(this.list.map((s) => [s.def.id, s]));
  // Fin du constructeur.
  }

  /** Tables JPL Horizons : [{ id, points }] (planète → satellite, km, écliptique J2000). */
  // setEphemeris : reçoit les tables de positions (début).
  setEphemeris(satellites) {
    // Pour chaque satellite reçu (début).
    for (const s of satellites || []) {
      // Garde sa table si elle a au moins quatre points.
      if (Array.isArray(s.points) && s.points.length >= 4) this.tables.set(s.id, s.points);
    // Fin de la boucle.
    }
  // Fin de setEphemeris.
  }

  /**
   * Positions et orientations à l'instant simulé (après le calcul des planètes).
   * `hotParent` : planète du système ciblé (ou null). Ses satellites sont recalculés à chaque image ; les autres,
   * invisibles ou minuscules à l'écran, une image sur COLD_EVERY (ils suivent leur planète entre-temps).
   */
  // update : l'instant simulé et la planète du système ciblé (début).
  update(ms, hotParent = null) {
    // Numéro de l'image, puis compteur avancé.
    const tick = this.tick++;
    // Pour chaque satellite (début).
    for (let i = 0; i < this.list.length; i++) {
      // Le satellite.
      const s = this.list[i];
      // S'il a déjà été calculé, s'il n'est pas du système ciblé et si ce n'est pas son tour (début).
      if (s.ready && s.parent !== hotParent && (tick + i) % COLD_EVERY) {
        // Il suit simplement sa planète.
        s.w.copy(s.parent.w).add(s.rel);
        // Passe au suivant.
        continue;
      // Fin de ce cas.
      }
      // Note qu'il a été calculé.
      s.ready = true;
      // Son état à cet instant, avec sa table et le pôle de sa planète.
      const st = satelliteState(s.def, this.tables.get(s.def.id), ms, 60_000, this.poles[s.def.parent] || null);
      // Sa position relative.
      s.rel.fromArray(st.rel);
      // Sa vitesse.
      s.vel.fromArray(st.vel);
      // Position exacte ou de repli.
      s.exact = st.exact;
      // Sa position dans le monde : celle de sa planète plus sa position relative.
      s.w.copy(s.parent.w).add(s.rel);
      // Son repère de rotation synchrone.
      const b = synchronousBasis(st.rel, st.vel);
      // Matrice faite de ces trois axes.
      this.basisM.makeBasis(this.bx.fromArray(b.x), this.by.fromArray(b.y), this.bz.fromArray(b.z));
      // Orientation du groupe.
      s.group.quaternion.setFromRotationMatrix(this.basisM);
      // Repère de son orbite.
      const o = orbitBasis(st.rel, st.vel);
      // Matrice faite de ces trois axes.
      this.basisM.makeBasis(this.bx.fromArray(o.x), this.by.fromArray(o.y), this.bz.fromArray(o.z));
      // Orientation du tracé de l'orbite.
      s.orbit.quaternion.setFromRotationMatrix(this.basisM);
      // Taille du tracé : la distance à la planète.
      s.orbit.scale.setScalar(s.rel.length());
    // Fin de la boucle.
    }
  // Fin de update.
  }

  /** Placement autour de la cible (origine flottante) et visibilité des orbites. */
  // place : la cible, la position de la caméra et l'affichage des orbites (début).
  place(target, camPos, orbitsOn) {
    // Pour chaque satellite (début).
    for (const s of this.list) {
      // Position du groupe, relative à la cible.
      s.group.position.copy(s.w).sub(target);
      // Le tracé de l'orbite est centré sur la planète.
      s.orbit.position.copy(s.parent.group.position);
      // Rayon de l'orbite.
      const a = s.rel.length();
      // Orbite visible si les orbites sont affichées, si le satellite n'est pas masqué et si la caméra est assez proche de la planète.
      s.orbit.visible = orbitsOn && !s.hidden && camPos.distanceTo(s.parent.group.position) < a * ORBIT_VIEW_RATIO;
    // Fin de la boucle.
    }
  // Fin de place.
  }

  /**
   * Met en avant l'orbite du satellite visé (trait plus épais, pleine opacité) ; null : aucune.
   * @param {object|null} sat  le satellite visé, tel qu'il est dans this.list
   */
  // setFocused : le satellite visé (début).
  setFocused(sat) {
    // Inchangé : rien.
    if (sat === this.focused) return;
    // L'ancien perd sa mise en avant.
    this.focused?.trail.setFocused(false);
    // Le nouveau la reçoit.
    sat?.trail.setFocused(true);
    // Le garde.
    this.focused = sat;
  // Fin de setFocused.
  }

  /** Distance planète → satellite (km). */
  // distanceKm : la distance d'un satellite à sa planète, en kilomètres.
  distanceKm(s) { return relDistanceKm(s.rel.toArray()); }

  // dispose : libère les ressources (début).
  dispose() {
    // Pour chaque satellite (début).
    for (const s of this.list) {
      // Retire son groupe de la scène.
      s.group.parent?.remove(s.group);
      // Retire son orbite de la scène.
      s.orbit.parent?.remove(s.orbit);
      // Libère la géométrie de sa sphère.
      s.mesh.geometry.dispose();
      // Libère le matériau de sa sphère.
      s.mesh.material.dispose();
      // Libère le ruban de son orbite (géométrie et matériau).
      s.trail.dispose();
    // Fin de la boucle.
    }
  // Fin de dispose.
  }
// Fin de la classe SatelliteSystem.
}
