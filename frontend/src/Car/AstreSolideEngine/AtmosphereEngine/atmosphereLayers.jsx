// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le calque des incendies.
import { FireLayer } from './fireLayer.jsx';
// Importe le calque des cyclones.
import { CycloneLayer } from './cycloneLayer.jsx';
// Importe le calque de la foudre.
import { LightningLayer } from './lightningLayer.jsx';
// Importe la mise en forme des impacts de foudre.
import { normalizeStrikes } from './lightningMath.jsx';
// Importe le calque des précipitations (radar).
import { PrecipitationLayer } from './precipitationLayer.jsx';
// Importe le calque des orages.
import { StormLayer } from './stormLayer.jsx';
// Importe le calque des aérosols.
import { AerosolLayer } from './aerosolLayer.jsx';
// Importe le calque des vents.
import { FlowLayer } from './flowLayer.jsx';
// Importe la mise en forme des colonnes d'incendies et des incendies confirmés.
import { FIRE_KIND, confirmedToPoints, normalizeFireColumns } from './fireMath.jsx';

// Repère atmosphérique de la Terre : réunit les calques du moteur atmosphérique (incendies, cyclones, foudre, radar des
// précipitations, orages, aérosols, vents),
// tourne avec la Terre et dit au reste de l'application où regarde la caméra (longitude, latitude, altitude), pour
// charger le détail par tuile au bon endroit. Chaque calque s'allume et se règle indépendamment des autres.

/** Calques du repère atmosphérique, par nom. */
// Déclare et exporte les noms des calques branchés.
export const ATMOSPHERE_LAYERS = ['fires', 'cyclones', 'lightning', 'precipitation', 'storms', 'aerosols', 'winds'];

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
    // Calque de la foudre.
    this.lightning = new LightningLayer();
    // Calque des précipitations.
    this.precipitation = new PrecipitationLayer();
    // Calque des orages.
    this.storms = new StormLayer();
    // Calque des aérosols.
    this.aerosols = new AerosolLayer();
    // Calque des vents.
    this.winds = new FlowLayer();
    // Les sept dans le repère commun.
    this.root.add(this.fires.root, this.cyclones.root, this.lightning.root, this.precipitation.root, this.storms.root, this.aerosols.root, this.winds.root);
    // Caméra vue depuis la Terre : longitude, latitude (degrés) et altitude (rayons terrestres) ; null au départ.
    this.view = null;
    // Vecteur de travail.
    this.tmp = new THREE.Vector3();
  // Fin du constructeur.
  }

  /**
   * Pose des données. `kind` : 'fires' (réponse /atmosphere/fires), 'fireDetail' (points des tuiles chargées,
   * déjà mis en forme), 'cyclones' (réponse /atmosphere/cyclones), 'lightning' (réponse /atmosphere/lightning) ou
   * 'lightningMap' (canevas de la couche mondiale de la foudre), 'radarGlobal' (images mondiales du radar :
   * [{ time, canvas }]), 'radarDetail' (bloc de détail : { box, frames } ou null) ou 'storms' (réponse
   * /atmosphere/storms), 'aerosolObserved' (image observée : { product, canvas } ou null) ou 'aerosolForecast'
   * (images de la prévision : [{ time, canvas }]) ou 'winds' (réponse /atmosphere/winds). `receivedAt` : instant de
   * réception (ms).
   */
  // setData : la nature, les données et l'instant de réception (début).
  setData(kind, data, receivedAt = Date.now()) {
    // Incendies : cellules agrégées et incendies confirmés.
    if (kind === 'fires') { this.fires.setCells(normalizeFireColumns(data?.cells, FIRE_KIND.cell), receivedAt); this.fires.setConfirmed(confirmedToPoints(data?.confirmed, receivedAt), receivedAt); return; }
    // Détail par tuile : points déjà mis en forme.
    if (kind === 'fireDetail') { this.fires.setDetail(Array.isArray(data) ? data : [], receivedAt); return; }
    // Foudre : impacts un par un autour du point visé.
    if (kind === 'lightning') { this.lightning.setStrikes(normalizeStrikes(data?.strikes)); return; }
    // Foudre : couche mondiale (canevas de la mosaïque, ou null).
    if (kind === 'lightningMap') { this.lightning.setMap(data ?? null); return; }
    // Radar : images mondiales.
    if (kind === 'radarGlobal') { this.precipitation.setGlobal(Array.isArray(data) ? data : []); return; }
    // Radar : bloc de détail.
    if (kind === 'radarDetail') { this.precipitation.setDetail(data ?? null); return; }
    // Orages.
    if (kind === 'storms') { this.storms.set(data ?? null); return; }
    // Aérosols : image observée.
    if (kind === 'aerosolObserved') { this.aerosols.setObserved(data ?? null); return; }
    // Aérosols : images de la prévision.
    if (kind === 'aerosolForecast') { this.aerosols.setForecast(Array.isArray(data) ? data : []); return; }
    // Vents.
    if (kind === 'winds') { this.winds.set(data ?? null); return; }
    // Cyclones.
    if (kind === 'cyclones') this.cyclones.set(data?.cyclones);
  // Fin de setData.
  }

  /** Règle un calque : { visible, opacity, intensity, windowHours, animate, coverage, product, level, jets } (facultatifs). */
  // setLayer : le nom du calque et les réglages (début).
  setLayer(name, { visible, opacity, intensity, windowHours, animate, coverage, product, level, jets } = {}) {
    // Le calque visé.
    const layer = { fires: this.fires, cyclones: this.cyclones, lightning: this.lightning, precipitation: this.precipitation, storms: this.storms, aerosols: this.aerosols, winds: this.winds }[name] ?? null;
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
    // Animation (radar : dernières images ; aérosols : prévision).
    if (animate !== undefined && layer.setAnimate) layer.setAnimate(animate);
    // Produit montré (aérosols seulement).
    if (product !== undefined && layer.setMode) layer.setMode(product);
    // Niveau d'altitude (vents seulement).
    if (level !== undefined && layer.setLevel) layer.setLevel(level);
    // Axes des courants-jets (vents seulement).
    if (jets !== undefined && layer.setJets) layer.setJets(jets);
    // Limite de portée des radars (radar seulement).
    if (coverage !== undefined && layer.setCoverage) layer.setCoverage(coverage);
  // Fin de setLayer.
  }

  /** À chaque image : suit la rotation de la Terre et note où regarde la caméra. */
  // update : la rotation propre de la Terre et la caméra (début).
  update(rotationY, camera) {
    // Suit la rotation de la Terre.
    this.root.rotation.y = rotationY;
    // Aucun calque allumé : inutile de calculer la vue.
    if (![this.fires, this.cyclones, this.lightning, this.precipitation, this.storms, this.aerosols, this.winds].some((l) => l.root.visible)) return;
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
    // Foudre.
    this.lightning.dispose();
    // Précipitations.
    this.precipitation.dispose();
    // Orages.
    this.storms.dispose();
    // Aérosols.
    this.aerosols.dispose();
    // Vents.
    this.winds.dispose();
  // Fin de dispose.
  }
// Fin de AtmosphereLayers.
}
