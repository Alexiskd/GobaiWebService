/**
 * Couche three.js de pollution lumineuse de la Terre, posée au-dessus du globe CesiumJS et sous les nuages.
 *
 * Le sol de la Terre est dessiné par CesiumJS (engine astre-solide) : les lumières de la nuit des tuiles three.js n'y
 * sont plus. Cette couche les remet : une coque à peine au-dessus du sol (sous la couche des nuages), rattachée au
 * repère des tuiles de la Terre (elle tourne avec elle), qui montre la mosaïque mondiale des lumières (atlas 2025 en
 * couleurs naturelles, chargée une fois par les tuiles) seulement sur la face de nuit, en lumière ajoutée.
 *
 * Elle vit sur son propre calque three.js (POLLUTION_LAYER) : la scène three.js ne la dessine jamais elle-même ;
 * seule la couche posée au-dessus du globe (engine.renderAtmosphereOverlay) la dessine, avant l'atmosphère et les
 * nuages, et seulement quand le globe dessine la Terre.
 */

// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe les shaders de la couche.
import { pollutionFragmentShader, pollutionVertexShader, shadowFragmentShader } from './pollution-lumineuse.shader.js';

// Calque three.js de la couche (distinct du calque 0 de la scène et de celui de l'atmosphère, 5).
export const POLLUTION_LAYER = 6;
// Rayon de la coque, en rayons terrestres : 3 km au-dessus du sol, sous les nuages simulés.
export const POLLUTION_SHELL_RADIUS = 1 + 3 / 6371;
// Ordre de dessin : avant l'atmosphère et les nuages (ordre 0), donc dessous.
export const POLLUTION_RENDER_ORDER = -10;
// Ordre de dessin de l'ombre : avant les lumières (elles s'allument par-dessus la nuit).
export const SHADOW_RENDER_ORDER = -11;

// Déclare et exporte la classe LightPollutionLayer (début).
export class LightPollutionLayer {
  /**
   * @param {{ root: THREE.Object3D, uniforms: object }} o le repère des tuiles de la Terre (sphère de rayon 1, axe des
   *   pôles = +Y) et les variables partagées de ses tuiles (mosaïque des lumières, interrupteur, vue de nuit…).
   */
  // Constructeur : le repère et les variables des tuiles (début).
  constructor({ root, uniforms }) {
    // Variables partagées des tuiles de la Terre.
    this.tileUniforms = uniforms;
    // Variables propres de la couche (début) :
    this.uniforms = {
      // la mosaïque, sa présence, l'interrupteur, la vue de nuit et le stockage linéaire : ceux des tuiles (mêmes
      // objets, donc toujours à jour) ;
      lgMap: uniforms.lgMap, lgOn: uniforms.lgOn, lightsOn: uniforms.lightsOn, lightView: uniforms.lightView, ltLinear: uniforms.ltLinear,
      // la direction du Soleil (repère des tuiles), l'ombre et l'intensité.
      sunDir: { value: new THREE.Vector3(1, 0, 0) }, shade: { value: 1 }, intensity: { value: 1 },
    // Fin des variables.
    };
    // Matériau (début) :
    const material = new THREE.ShaderMaterial({
      // les shaders et les variables ;
      vertexShader: pollutionVertexShader, fragmentShader: pollutionFragmentShader, uniforms: this.uniforms,
      // lumière ajoutée sans toucher à l'opacité de la couche (sinon la face de nuit masquerait le globe), sans écrire
      // la profondeur ; seule la face tournée vers la caméra (pas la face cachée).
      transparent: true, depthWrite: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    // Fin du matériau.
    });
    // La coque.
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(POLLUTION_SHELL_RADIUS, 128, 64), material);
    // Son nom.
    this.mesh.name = 'pollution-lumineuse';
    // Seulement sur son calque : la scène three.js ne la dessine pas elle-même.
    this.mesh.layers.set(POLLUTION_LAYER);
    // Dessinée avant l'atmosphère et les nuages.
    this.mesh.renderOrder = POLLUTION_RENDER_ORDER;
    // Toujours dessinée quand sa couche l'est (sa sphère couvre toute la Terre).
    this.mesh.frustumCulled = false;
    // Rattachée au repère des tuiles : elle tourne avec la Terre.
    root.add(this.mesh);
    // Ombre de la face de nuit (début) : le globe CesiumJS de la Terre n'a plus son propre éclairage (terminateur trop
    // net) ; cette coque l'assombrit avec un terminateur en dégradé large (pollution-lumineuse.math.js, dayLight).
    const shadowMaterial = new THREE.ShaderMaterial({
      // les shaders et les variables (les mêmes objets que la couche des lumières) ;
      vertexShader: pollutionVertexShader, fragmentShader: shadowFragmentShader, uniforms: this.uniforms,
      // alpha prémultiplié : fond × (1 − alpha) + lueur ; sans écrire la profondeur ; face tournée vers la caméra.
      transparent: true, depthWrite: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    // Fin du matériau de l'ombre.
    });
    // La coque de l'ombre : même géométrie, même calque, dessinée avant les lumières.
    this.shadowMesh = new THREE.Mesh(this.mesh.geometry, shadowMaterial);
    // Son nom.
    this.shadowMesh.name = 'ombre-terre';
    // Seulement sur le calque de la couche.
    this.shadowMesh.layers.set(POLLUTION_LAYER);
    // Avant les lumières.
    this.shadowMesh.renderOrder = SHADOW_RENDER_ORDER;
    // Toujours dessinée quand sa couche l'est.
    this.shadowMesh.frustumCulled = false;
    // Rattachée au repère des tuiles.
    root.add(this.shadowMesh);
    // Fin de l'ombre.
    // Repère gardé (pour la libération).
    this.root = root;
  // Fin du constructeur.
  }

  /**
   * Avant d'être dessinée : direction du Soleil dans le repère des tuiles et intensité de l'ombre (bouton « Ombre »).
   * @param {number[]} sunDir direction de la Terre vers le Soleil, repère des tuiles
   * @param {number} shade 0 (astres entièrement éclairés : pas de lumières) à 1 (face nuit dans l'ombre)
   * @param {number} intensity 0 (lumières éteintes) à 1 (pleines) : fondu du zoom sur la Terre
   */
  // update : le Soleil, l'ombre et l'intensité (début).
  update(sunDir, shade = 1, intensity = 1) {
    // Direction du Soleil, si elle est connue.
    if (sunDir) this.uniforms.sunDir.value.fromArray(sunDir);
    // Ombre.
    this.uniforms.shade.value = Number.isFinite(shade) ? shade : 1;
    // Intensité (fondu du zoom), entre 0 et 1.
    this.uniforms.intensity.value = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 1;
  // Fin de update.
  }

  /** Lumières et ombre visibles ou non (seulement quand le globe CesiumJS dessine la Terre). */
  // setVisible : les lumières, et l'ombre (par défaut comme les lumières).
  setVisible(lights, shadow = lights) { this.mesh.visible = Boolean(lights); this.shadowMesh.visible = Boolean(shadow); }

  // dispose : libère la coque (début).
  dispose() {
    // Retirée du repère.
    this.root.remove(this.mesh); this.root.remove(this.shadowMesh);
    // Géométrie (partagée) et matériaux libérés.
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.shadowMesh.material.dispose();
  // Fin de dispose.
  }
// Fin de la classe LightPollutionLayer.
}
