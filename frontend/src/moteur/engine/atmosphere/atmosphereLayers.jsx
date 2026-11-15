// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le calque des incendies.
import { FireLayer } from './fireLayer';
// Importe le calque des cyclones.
import { CycloneLayer } from './cycloneLayer';
// Importe la mise en forme des colonnes d'incendies et des incendies confirmés.
import { FIRE_KIND, confirmedToPoints, normalizeFireColumns } from './fireMath';

// Repère atmosphérique de la Terre : réunit les calques du moteur atmosphérique (lot 1 : incendies et cyclones),
// tourne avec la Terre et dit au reste de l'application où regarde la caméra (longitude, latitude, altitude), pour
// charger le détail par tuile au bon endroit. Chaque calque s'allume et se règle indépendamment des autres.

/** Calques du repère atmosphérique, par nom. */
// Déclare et exporte les noms des calques branchés.
export const ATMOSPHERE_LAYERS = ['fires', 'cyclones'];

// Déclare et exporte la classe AtmosphereLayers.
export class AtmosphereLayers {
  // Constructeur.
  constructor() {
    // Repère commun.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere';
    // Calque des incendies.
    this.fires = new FireLayer();
    // Calque des cyclones.
    this.cyclones = new CycloneLayer();
    // Les deux dans le repère commun.
    this.root.add(this.fires.root, this.cyclones.root);
    // Caméra vue depuis la Terre : longitude, latitude (degrés) et altitude (rayons terrestres) ; null au départ.
    this.view = null;
    // Vecteur de travail.
    this.tmp = new THREE.Vector3();
  // Fin du constructeur.
  }

  /**
   * Pose des données. `kind` : 'fires' (réponse /atmosphere/fires), 'fireDetail' (points des tuiles chargées,
   * déjà mis en forme) ou 'cyclones' (réponse /atmosphere/cyclones). `receivedAt` : instant de réception (ms).
   */
  // setData : la nature, les données et l'instant de réception (début).
  setData(kind, data, receivedAt = Date.now()) {
    // Incendies : cellules agrégées et incendies confirmés.
    if (kind === 'fires') { this.fires.setCells(normalizeFireColumns(data?.cells, FIRE_KIND.cell), receivedAt); this.fires.setConfirmed(confirmedToPoints(data?.confirmed, receivedAt), receivedAt); return; }
    // Détail par tuile : points déjà mis en forme.
    if (kind === 'fireDetail') { this.fires.setDetail(Array.isArray(data) ? data : [], receivedAt); return; }
    // Cyclones.
    if (kind === 'cyclones') this.cyclones.set(data?.cyclones);
  // Fin de setData.
  }

  /** Règle un calque : { visible, opacity, intensity, windowHours } (champs facultatifs). */
  // setLayer : le nom du calque et les réglages (début).
  setLayer(name, { visible, opacity, intensity, windowHours } = {}) {
    // Le calque visé.
    const layer = name === 'fires' ? this.fires : name === 'cyclones' ? this.cyclones : null;
    // Inconnu : rien.
    if (!layer) return;
    // Visibilité.
    if (visible !== undefined) layer.setVisible(visible);
    // Opacité.
    if (opacity !== undefined) layer.setOpacity(opacity);
    // Intensité visuelle.
    if (intensity !== undefined) layer.setIntensity(intensity);
    // Fenêtre de temps (incendies seulement).
    if (windowHours !== undefined && layer.setWindowHours) layer.setWindowHours(windowHours);
  // Fin de setLayer.
  }

  /** À chaque image : suit la rotation de la Terre et note où regarde la caméra. */
  // update : la rotation propre de la Terre et la caméra (début).
  update(rotationY, camera) {
    // Suit la rotation de la Terre.
    this.root.rotation.y = rotationY;
    // Aucun calque allumé : inutile de calculer la vue.
    if (!this.fires.root.visible && !this.cyclones.root.visible) return;
    // Matrices du repère à jour (le parent l'a été à l'image précédente).
    this.root.updateWorldMatrix(true, false);
    // Caméra ramenée dans le repère de la Terre.
    const c = this.root.worldToLocal(this.tmp.setFromMatrixPosition(camera.matrixWorld));
    // Distance au centre, en rayons terrestres.
    const d = c.length();
    // Trop près du centre (impossible) : rien.
    if (!(d > 1e-6)) return;
    // Latitude et longitude du point sous la caméra (inverse de lonLatToUnit).
    this.view = { lat: (Math.asin(Math.min(1, Math.max(-1, c.y / d))) * 180) / Math.PI, lon: (Math.atan2(-c.z, c.x) * 180) / Math.PI, alt: Math.max(0, d - 1) };
  // Fin de update.
  }

  // dispose : libère les calques.
  dispose() {
    // Incendies.
    this.fires.dispose();
    // Cyclones.
    this.cyclones.dispose();
  // Fin de dispose.
  }
// Fin de AtmosphereLayers.
}
