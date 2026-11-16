// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe gasShells, la liste des coquilles d'un astre, depuis gasInteriorMath.
import { gasShells } from './gasInteriorMath';

// Intérieur d'une géante gazeuse (Jupiter) : sphères concentriques que la caméra traverse en zoomant, des trois ponts
// nuageux jusqu'au noyau dilué. Chaque sphère porte la couleur de la couche qu'elle délimite, vue des deux côtés :
// de dehors on voit la couche où l'on va entrer, de dedans celle où l'on se trouve. Voir gasInteriorMath.jsx.

// Code GLSL du shader de sommets (début).
const vertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : position unitaire, normale et direction de la caméra.
  'varying vec3 vP;varying vec3 vN;varying vec3 vV;',
  // Fonction principale : position rendue unitaire, position dans le repère de la caméra, normale, direction vers la caméra et position à l'écran.
  'void main(){vP=normalize(position);vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments (début).
const fragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : couleur de la couche, intensité des bandes et opacité.
  'uniform vec3 color;uniform float bands;uniform float opacity;',
  // Variables reçues du shader de sommets.
  'varying vec3 vP;varying vec3 vN;varying vec3 vV;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Latitude et longitude du point sur la sphère.
  '  float lat=asin(clamp(vP.y,-1.,1.));float lon=atan(vP.z,vP.x);',
  // Nuages : bandes parallèles à l'équateur, ondulées, comme les zones et ceintures de la planète.
  // Bandes : sinus de la latitude, ondulé par la longitude, ramené entre 0 et 1.
  '  float w=sin(lat*46.+1.6*sin(lon*5.+lat*13.))*.5+.5;',
  // Moutonnement : produit de deux sinus croisés, ramené entre 0 et 1.
  '  float puff=sin(lon*23.+lat*31.)*sin(lat*57.-lon*7.)*.5+.5;',
  // Couleur assombrie par les bandes et le moutonnement, selon l'intensité bands.
  '  vec3 c=color*(1.-bands*(.55*w+.45*puff));',
  // Relief : la sphère s'assombrit vers son limbe, vue de dehors comme de dedans.
  // Cosinus, en valeur absolue, de l'angle entre la normale et la direction de la caméra.
  '  float f=abs(dot(normalize(vN),normalize(vV)));',
  // Couleur finale : de 45 % au limbe à 100 % de face, avec l'opacité.
  '  gl_FragColor=vec4(c*mix(.45,1.,f),opacity);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// shell : crée une sphère de rayon et de couleur donnés ; bandes à 0 et opacité à 1 par défaut.
function shell(radius, color, { bands = 0, opacity = 1 } = {}) {
  // Transparente quand l'opacité est inférieure à 1.
  const transparent = opacity < 1;
  // Renvoie un maillage (début).
  return new THREE.Mesh(
    // Géométrie : une sphère de 96 segments sur 64.
    new THREE.SphereGeometry(radius, 96, 64),
    // Matériau à shader (début).
    new THREE.ShaderMaterial({
      // Ses variables uniformes : la couleur, les bandes et l'opacité.
      uniforms: { color: { value: new THREE.Color(color) }, bands: { value: bands }, opacity: { value: opacity } },
      // Les deux shaders, les deux faces dessinées, la transparence, et l'écriture de la profondeur seulement pour une sphère opaque.
      vertexShader, fragmentShader, side: THREE.DoubleSide, transparent, depthWrite: !transparent,
    // Fin du matériau.
    })
  // Fin du maillage.
  );
// Fin de shell.
}

/**
 * Crée l'intérieur de l'astre `id` de rayon `radius` (unités de la scène). Renvoie null si l'astre n'est pas modélisé.
 * `update(inside, spinY)` : affiche l'intérieur seulement quand la caméra est dans l'astre et suit sa rotation propre.
 */
// Déclare et exporte createGasInterior : l'identifiant de l'astre et son rayon.
export function createGasInterior(id, radius) {
  // Les coquilles de l'astre.
  const shells = gasShells(id);
  // Aucune : l'astre n'est pas modélisé, renvoie null.
  if (!shells.length) return null;
  // Groupe qui contient toutes les sphères.
  const group = new THREE.Group();
  // Caché au départ.
  group.visible = false;
  // Pour chaque coquille (début).
  shells.forEach((s, i) => {
    // Sa sphère : rayon extérieur de la coquille, sa couleur, bandes à 0,2 pour un pont nuageux.
    const mesh = shell(s.outer * radius, s.color, { bands: s.cloud ? 0.2 : 0 });
    // Ordre de dessin : de l'extérieur vers le centre.
    mesh.renderOrder = i;
    // L'ajoute au groupe.
    group.add(mesh);
  // Fin de la boucle.
  });
  // Noyau dilué : pas de limite nette avec l'hydrogène métallique (mesures de Juno) — halo dégradé autour du noyau.
  // Le noyau : la dernière coquille.
  const core = shells[shells.length - 1];
  // Trois halos, à 1,12, 1,25 et 1,4 fois le rayon du noyau (début).
  [1.12, 1.25, 1.4].forEach((k, i) => {
    // Le halo : couleur du noyau, opacité de 0,34, 0,24 puis 0,14.
    const halo = shell(core.outer * k * radius, core.color, { opacity: 0.34 - i * 0.1 });
    // Ordre de dessin négatif : −1, −2 puis −3.
    halo.renderOrder = -1 - i; // de dehors : le plus grand d'abord
    // L'ajoute au groupe.
    group.add(halo);
  // Fin de la boucle.
  });
  // Renvoie l'objet de l'intérieur (début).
  return {
    // Le groupe.
    group,
    // update : reçoit si la caméra est dans l'astre, et l'angle de rotation propre (début).
    update(inside, spinY) {
      // Le groupe n'est visible que de l'intérieur.
      group.visible = inside;
      // De l'intérieur, il prend la rotation de l'astre.
      if (inside) group.rotation.y = spinY;
    // Fin de update.
    },
  // Fin de l'objet.
  };
// Fin de createGasInterior.
}
