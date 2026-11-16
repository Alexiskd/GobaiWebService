// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe les réglages du style et la couleur éclaircie d'un tracé.
import { ORBIT_STYLE, tintColor } from './orbitRibbonMath';

/**
 * Tracé d'orbite en ruban : une bande de largeur constante à l'écran, dessinée par la carte graphique.
 *
 * Une ligne WebGL ordinaire (THREE.Line) fait toujours un pixel de l'écran physique : sur un téléphone dont l'écran a
 * trois pixels par point CSS, elle devient un fil à peine visible, crénelé. Le ruban, lui, garde la même épaisseur en
 * points CSS sur tous les écrans (ORBIT_STYLE.width × densité), avec un bord adouci sur un pixel et un halo léger.
 *
 * Principe : chaque segment du tracé est un rectangle (deux triangles) instancié ; le shader de sommets projette ses
 * deux bouts à l'écran et les écarte de la demi-largeur, perpendiculairement au segment. Un bout derrière la caméra
 * est ramené sur le plan proche (comme LineMaterial de three.js). Profondeur logarithmique incluse : l'orbite passe
 * derrière les planètes. Mélange additif : sur le noir de l'espace, l'opacité règle la luminosité.
 *
 * L'opacité varie le long du tracé (une valeur par point, voir orbitRibbonMath.jsx) : style « traînée ».
 */

/** Réglages partagés par tous les rubans : taille du tampon de dessin (pixels) et densité de pixels. */
export const ORBIT_SHARED = {
  // Taille du tampon de dessin, en pixels de l'écran physique.
  resolution: { value: new THREE.Vector2(1, 1) },
  // Pixels de dessin par point CSS.
  pixelRatio: { value: 1 },
// Fin des réglages partagés.
};

/**
 * Met à jour les réglages partagés depuis le moteur de rendu (à chaque image : le coût est négligeable).
 * @param {THREE.WebGLRenderer} renderer
 */
// Déclare et exporte updateOrbitShared : le moteur de rendu (début).
export function updateOrbitShared(renderer) {
  // Taille du tampon de dessin (pixels physiques, résolution adaptative comprise).
  renderer.getDrawingBufferSize(ORBIT_SHARED.resolution.value);
  // Densité de pixels en cours.
  ORBIT_SHARED.pixelRatio.value = renderer.getPixelRatio();
// Fin de updateOrbitShared.
}

// Shader de sommets, une ligne GLSL par chaîne : projette les deux bouts du segment, ramène sur le plan proche un bout
// passé derrière la caméra, écarte le coin de la demi-largeur perpendiculairement au segment, à l'écran.
const vertexShader = [
  // Outils communs de three.js.
  '#include <common>',
  // Déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_vertex>',
  // Début du segment (point i du tracé).
  'attribute vec3 iStart;',
  // Fin du segment (point i + 1).
  'attribute vec3 iEnd;',
  // Opacité au début du segment.
  'attribute float aStart;',
  // Opacité à la fin du segment.
  'attribute float aEnd;',
  // Taille du tampon de dessin, en pixels.
  'uniform vec2 resolution;',
  // Pixels de dessin par point CSS.
  'uniform float pixelRatio;',
  // Épaisseur du trait, en points CSS.
  'uniform float width;',
  // Largeur du halo, en points CSS.
  'uniform float glow;',
  // Opacité transmise au shader de fragments.
  'varying float vAlpha;',
  // Distance signée au centre du trait, en pixels de dessin.
  'varying float vSide;',
  // Demi-largeur du trait, en pixels de dessin.
  'varying float vHalf;',
  // trimSegment : ramène `end` sur le plan proche, le long du segment (comme LineMaterial de three.js).
  'void trimSegment(const in vec4 start, inout vec4 end) {',
  // Coefficients de la projection.
  '  float a = projectionMatrix[2][2];',
  // Suite des coefficients.
  '  float b = projectionMatrix[3][2];',
  // Profondeur du plan proche, dans le repère de la caméra.
  '  float nearEstimate = -0.5 * b / a;',
  // Part du segment jusqu'au plan proche.
  '  float t = (nearEstimate - start.z) / (end.z - start.z);',
  // Le bout est déplacé sur le plan proche.
  '  end.xyz = mix(start.xyz, end.xyz, t);',
  // Fin de trimSegment.
  '}',
  // Programme principal (début).
  'void main() {',
  // Début du segment, dans le repère de la caméra.
  '  vec4 s = modelViewMatrix * vec4(iStart, 1.0);',
  // Fin du segment, dans le repère de la caméra.
  '  vec4 e = modelViewMatrix * vec4(iEnd, 1.0);',
  // Début devant la caméra et fin derrière : la fin est ramenée sur le plan proche.
  '  if (s.z < 0.0 && e.z >= 0.0) trimSegment(s, e);',
  // Fin devant et début derrière : le début est ramené.
  '  else if (e.z < 0.0 && s.z >= 0.0) trimSegment(e, s);',
  // Début projeté à l'écran.
  '  vec4 cs = projectionMatrix * s;',
  // Fin projetée à l'écran.
  '  vec4 ce = projectionMatrix * e;',
  // Direction du segment à l'écran, en pixels.
  '  vec2 dir = (ce.xy / ce.w - cs.xy / cs.w) * resolution;',
  // Sa longueur.
  '  float len = length(dir);',
  // Rendue unitaire (segment nul : direction quelconque).
  '  dir = len > 1e-6 ? dir / len : vec2(1.0, 0.0);',
  // Perpendiculaire à l'écran.
  '  vec2 normal = vec2(-dir.y, dir.x);',
  // Demi-largeur du trait, en pixels de dessin.
  '  vHalf = 0.5 * width * pixelRatio;',
  // Demi-largeur dessinée : trait, halo et un pixel d'anticrénelage.
  '  float reach = vHalf + glow * pixelRatio + 1.0;',
  // Ce coin, d'un côté ou de l'autre.
  '  vSide = position.y * reach;',
  // Le bout du segment auquel ce coin appartient.
  '  vec4 clip = position.x < 0.5 ? cs : ce;',
  // Écarté perpendiculairement de vSide pixels (converti en coordonnées d'écran, puis par w).
  '  clip.xy += normal * (vSide * 2.0 / resolution) * clip.w;',
  // Position finale.
  '  gl_Position = clip;',
  // Opacité du bout.
  '  vAlpha = position.x < 0.5 ? aStart : aEnd;',
  // Profondeur logarithmique.
  '  #include <logdepthbuf_vertex>',
  // Fin du programme principal.
  '}',
// Lignes réunies en un seul texte.
].join('\n');

// Shader de fragments, une ligne GLSL par chaîne : trait net au bord adouci sur un pixel, halo en cloche autour, le
// tout multiplié par l'opacité du point et l'opacité générale.
const fragmentShader = [
  // Déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Couleur du tracé.
  'uniform vec3 color;',
  // Opacité générale.
  'uniform float opacity;',
  // Largeur du halo, en points CSS.
  'uniform float glow;',
  // Intensité du halo.
  'uniform float glowStrength;',
  // Pixels de dessin par point CSS.
  'uniform float pixelRatio;',
  // Opacité du point.
  'varying float vAlpha;',
  // Distance signée au centre du trait.
  'varying float vSide;',
  // Demi-largeur du trait.
  'varying float vHalf;',
  // Programme principal (début).
  'void main() {',
  // Profondeur logarithmique.
  '  #include <logdepthbuf_fragment>',
  // Distance au centre du trait, en pixels de dessin.
  '  float d = abs(vSide);',
  // Trait : plein jusqu'à la demi-largeur, bord adouci sur un pixel.
  '  float core = clamp(vHalf + 0.5 - d, 0.0, 1.0);',
  // Largeur du halo, en pixels de dessin (jamais nulle).
  '  float g = max(glow * pixelRatio, 1e-3);',
  // Distance au bord du trait, rapportée au halo.
  '  float x = max(d - vHalf, 0.0) / (0.5 * g);',
  // Halo en cloche.
  '  float halo = glowStrength * exp(-x * x);',
  // Opacité de ce pixel : trait ou halo, fois celle du point, fois l'opacité générale.
  '  float a = max(core, halo) * vAlpha * opacity;',
  // Presque transparent : abandonné.
  '  if (a < 0.003) discard;',
  // Couleur et opacité.
  '  gl_FragColor = vec4(color, a);',
  // Fin du programme principal.
  '}',
// Lignes réunies en un seul texte.
].join('\n');

// Coins du rectangle d'un segment : x = 0 au début, 1 à la fin ; y = −1 d'un côté, +1 de l'autre.
const CORNERS = new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]);
// Deux triangles qui couvrent le rectangle.
const CORNER_INDEX = [0, 2, 1, 2, 3, 1];

/**
 * Ruban d'une orbite.
 *
 * @param {object}       o
 * @param {Float32Array} o.points  positions des points du tracé, trois nombres par point (au moins deux points) ;
 *                                 pour une boucle fermée, le dernier point répète le premier
 * @param {string|number} [o.color]  couleur de l'astre (éclaircie par ORBIT_STYLE.tint)
 * @param {string}        [o.name]   nom de l'objet three.js
 */
// Déclare et exporte la classe OrbitRibbon (début).
export class OrbitRibbon {
  // Constructeur : les points, la couleur et le nom (début).
  constructor({ points, color = 0x8fa3d0, name = 'orbit' }) {
    // Garde le tableau des positions (partagé avec l'appelant : il peut le modifier puis appeler positionsChanged).
    this.points = points;
    // Nombre de points.
    this.count = points.length / 3;
    // Opacité de chaque point : pleine au départ.
    this.alphas = new Float32Array(this.count).fill(1);
    // Géométrie instanciée : un rectangle par segment.
    const geometry = new THREE.InstancedBufferGeometry();
    // Coins du rectangle.
    geometry.setAttribute('position', new THREE.BufferAttribute(CORNERS, 3));
    // Ses deux triangles.
    geometry.setIndex(CORNER_INDEX);
    // Tampon des points, lu une fois par segment : le début à l'indice du segment, la fin au point suivant.
    this.pointBuffer = new THREE.InstancedInterleavedBuffer(points, 3, 1);
    // Début du segment.
    geometry.setAttribute('iStart', new THREE.InterleavedBufferAttribute(this.pointBuffer, 3, 0));
    // Fin du segment : trois nombres plus loin.
    geometry.setAttribute('iEnd', new THREE.InterleavedBufferAttribute(this.pointBuffer, 3, 3));
    // Tampon des opacités, lu de la même façon.
    this.alphaBuffer = new THREE.InstancedInterleavedBuffer(this.alphas, 1, 1);
    // Opacité au début du segment.
    geometry.setAttribute('aStart', new THREE.InterleavedBufferAttribute(this.alphaBuffer, 1, 0));
    // Opacité à la fin du segment.
    geometry.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(this.alphaBuffer, 1, 1));
    // Un rectangle par segment : un de moins que de points.
    geometry.instanceCount = this.count - 1;
    // Matériau à shader (début).
    this.material = new THREE.ShaderMaterial({
      // Variables uniformes (début) :
      uniforms: {
        // la couleur de l'astre, éclaircie ;
        color: { value: new THREE.Color(tintColor(color)) },
        // l'opacité générale ;
        opacity: { value: ORBIT_STYLE.opacity },
        // l'épaisseur du trait, en points CSS ;
        width: { value: ORBIT_STYLE.width },
        // la largeur du halo, en points CSS ;
        glow: { value: ORBIT_STYLE.glow },
        // l'intensité du halo ;
        glowStrength: { value: ORBIT_STYLE.glowStrength },
        // la taille du tampon de dessin et la densité de pixels, partagées par tous les rubans.
        resolution: ORBIT_SHARED.resolution, pixelRatio: ORBIT_SHARED.pixelRatio,
      // Fin des variables.
      },
      // Le shader de sommets.
      vertexShader,
      // Le shader de fragments.
      fragmentShader,
      // Transparent.
      transparent: true,
      // Sans écriture de la profondeur : les tracés ne se masquent pas entre eux.
      depthWrite: false,
      // Mélange additif : la lumière du tracé s'ajoute au fond.
      blending: THREE.AdditiveBlending,
    // Fin du matériau.
    });
    // Le maillage du ruban.
    this.mesh = new THREE.Mesh(geometry, this.material);
    // Son nom.
    this.mesh.name = name;
    // Jamais écarté du rendu par le test de visibilité : les coins sont déplacés par le shader.
    this.mesh.frustumCulled = false;
    // Dessiné après les astres opaques.
    this.mesh.renderOrder = 2;
    // Pas encore mis en avant.
    this.focused = false;
  // Fin du constructeur.
  }

  /** Les positions ont été modifiées sur place : à renvoyer à la carte graphique. */
  // positionsChanged : signale le changement (début).
  positionsChanged() {
    // Nouvelle version du tampon des points.
    this.pointBuffer.needsUpdate = true;
  // Fin de positionsChanged.
  }

  /** Les opacités ont été modifiées sur place (this.alphas) : à renvoyer à la carte graphique. */
  // alphasChanged : signale le changement (début).
  alphasChanged() {
    // Nouvelle version du tampon des opacités.
    this.alphaBuffer.needsUpdate = true;
  // Fin de alphasChanged.
  }

  /**
   * Met en avant le tracé de l'astre visé : trait plus épais, pleine opacité.
   * @param {boolean} on
   */
  // setFocused : vrai pour l'astre visé (début).
  setFocused(on) {
    // Inchangé : rien.
    if (this.focused === on) return;
    // Le garde.
    this.focused = on;
    // Épaisseur du trait.
    this.material.uniforms.width.value = on ? ORBIT_STYLE.focusWidth : ORBIT_STYLE.width;
    // Opacité générale.
    this.material.uniforms.opacity.value = on ? ORBIT_STYLE.focusOpacity : ORBIT_STYLE.opacity;
  // Fin de setFocused.
  }

  // dispose : libère la géométrie et le matériau (début).
  dispose() {
    // La géométrie.
    this.mesh.geometry.dispose();
    // Le matériau.
    this.material.dispose();
  // Fin de dispose.
  }
// Fin de la classe OrbitRibbon.
}
