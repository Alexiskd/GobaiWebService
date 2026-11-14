// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe les constantes et les calculs des éruptions, depuis sunSurfaceMath.
import { ERUPTION_BURST_S, ERUPTION_GRAVITY, MAX_SITES, buildEruptionAttributes, eruptionSites } from './sunSurfaceMath';

// Soleil modélisé en 3D : une surface animée (cellules de convection, granulation, filaments sombres, régions actives) et des
// éruptions (gerbes de matière projetées depuis les régions actives, qui montent en arche puis retombent).
// Tout est calculé par la carte graphique : la surface par un bruit procédural (aucune image à télécharger), les
// éruptions par une formule balistique évaluée dans le shader à partir du temps (voir sunSurfaceMath.jsx). Le
// processeur ne fait rien à chaque image, à part donner l'heure. Tout est exprimé dans le repère du Soleil (axe y =
// pôle nord) : la surface et les éruptions tournent avec lui.

// Code GLSL du bruit procédural, commun aux deux profils (début).
const noiseChunk = [
  // Nombre pseudo-aléatoire entre 0 et 1 à partir d'un point de l'espace.
  'float sHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
  // Bruit lissé : mélange des huit valeurs aux coins du cube qui contient le point (début).
  'float sNoise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);',
  // Face du bas du cube.
  '  float a=mix(mix(sHash(i),sHash(i+vec3(1.,0.,0.)),f.x),mix(sHash(i+vec3(0.,1.,0.)),sHash(i+vec3(1.,1.,0.)),f.x),f.y);',
  // Face du haut du cube.
  '  float b=mix(mix(sHash(i+vec3(0.,0.,1.)),sHash(i+vec3(1.,0.,1.)),f.x),mix(sHash(i+vec3(0.,1.,1.)),sHash(i+vec3(1.,1.,1.)),f.x),f.y);',
  // Mélange des deux faces, puis fin de la fonction.
  '  return mix(a,b,f.z);}',
  // Bruit fractal : somme de OCTAVES bruits de plus en plus fins et de moins en moins forts, ramenée entre 0 et 1.
  'float sFbm(vec3 p){float a=.5;float s=0.;float n=0.;for(int i=0;i<OCTAVES;i++){s+=a*sNoise(p);n+=a;p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/n;}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de sommets de la surface (début).
const surfaceVertex = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : le point dans le repère du Soleil, la normale et la direction de la caméra.
  'varying vec3 vDir;varying vec3 vN;varying vec3 vV;',
  // Début de la fonction principale.
  'void main(){',
  // Point de la surface dans le repère du Soleil : le bruit y est accroché et tourne avec lui.
  '  vDir=position;',
  // Normale dans le repère de la caméra.
  '  vN=normalMatrix*normal;',
  // Position dans le repère de la caméra.
  '  vec4 mv=modelViewMatrix*vec4(position,1.);',
  // Direction du point vers la caméra.
  '  vV=-mv.xyz;',
  // Position à l'écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments de la surface (début).
const surfaceFragment = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : le temps, la durée d'une gerbe, le nombre de régions actives, leur direction et leur cycle.
  `uniform float time;uniform float burst;uniform int siteCount;uniform vec3 siteDir[${MAX_SITES}];uniform vec2 siteCycle[${MAX_SITES}];`,
  // Variables reçues du shader de sommets.
  'varying vec3 vDir;varying vec3 vN;varying vec3 vV;',
  // Le bruit procédural.
  noiseChunk,
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Point de la surface, unitaire.
  '  vec3 p=normalize(vDir);',
  // Temps ralenti : la surface bouillonne lentement.
  '  float t=time*.04;',
  // Grandes cellules de convection, qui dérivent lentement.
  '  float cells=sFbm(p*6.+vec3(0.,t,0.));',
  // Granulation fine, plus rapide.
  '  float grains=sFbm(p*28.+vec3(t*2.,0.,-t));',
  // Chaleur du point : mélange des deux.
  '  float heat=.6*cells+.4*grains;',
  // Filaments sombres : lignes fines où un bruit large passe par sa valeur moyenne, dans les zones les plus froides.
  '  float filament=(1.-smoothstep(0.,.03,abs(sFbm(p*3.2+vec3(11.,-t*.3,5.))-.5)))*(1.-smoothstep(.44,.5,cells));',
  // Cosinus de l’angle entre la surface et la direction de la caméra : 1 au centre du disque, 0 au bord.
  '  float mu=max(dot(normalize(vN),normalize(vV)),0.);',
  // Couleur, sur le modèle des vues de la sonde SDO : du rouge sombre à l’orange selon la chaleur.
  '  vec3 col=mix(vec3(.36,.05,.0),vec3(.92,.3,.03),smoothstep(.38,.52,heat));',
  // Points les plus chauds : orange clair.
  '  col=mix(col,vec3(1.,.6,.12),smoothstep(.54,.68,heat));',
  // Filaments : bien plus sombres.
  '  col*=mix(1.,.3,filament);',
  // Bord légèrement assombri.
  '  col*=.72+.28*pow(mu,.5);',
  // Éclat des régions actives et du cœur des éruptions, à zéro au départ.
  '  float glow=0.;float flare=0.;',
  // Pour chaque région active (début).
  `  for(int i=0;i<${MAX_SITES};i++){`,
  // Au-delà du nombre de régions : arrêt.
  '    if(i>=siteCount)break;',
  // Temps écoulé depuis le début de la gerbe de cette région.
  '    float a=mod(time-siteCycle[i].y,siteCycle[i].x);',
  // Force de l’éruption : monte en une demi-seconde, puis s’éteint en quatre secondes après la gerbe.
  '    float env=smoothstep(0.,.5,a)*(1.-smoothstep(burst,burst+4.,a));',
  // Proximité de la région : 1 en son centre, 0 ailleurs.
  '    float d=dot(p,siteDir[i]);',
  // Région active : plage jaune toujours visible, morcelée par la granulation, plus vive pendant l’éruption.
  '    glow+=smoothstep(.965,.998,d)*(.35+.9*grains)*(.55+env);',
  // Cœur de l’éruption : point presque blanc.
  '    flare+=(.25+env)*smoothstep(.994,.9997,d);',
  // Fin de la boucle.
  '  }',
  // Ajoute les régions actives, jaune orangé.
  '  col+=vec3(1.,.7,.18)*glow;',
  // Ajoute le cœur des éruptions, jaune très clair.
  '  col+=vec3(1.,.92,.7)*flare;',
  // Liseré rouge orangé lumineux au bord du disque (chromosphère).
  '  col+=vec3(1.,.3,.05)*pow(1.-mu,2.5)*.6;',
  // Couleur finale, opaque.
  '  gl_FragColor=vec4(col,1.);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de sommets des éruptions (début).
const eruptionVertex = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables uniformes : le temps, la gravité, le rayon du Soleil et l’échelle en pixels de l’écran.
  'uniform float time;uniform float gravity;uniform float radius;uniform float pixels;',
  // Attributs du grain : sa direction de départ le long de la surface, son lancement et le cycle de sa région.
  'attribute vec3 slide;attribute vec4 launch;attribute vec2 cycle;',
  // Variables transmises au shader de fragments : la chaleur du grain et son opacité.
  'varying float vHeat;varying float vAlpha;',
  // Début de la fonction principale.
  'void main(){',
  // Âge du grain : temps écoulé depuis son départ, ramené dans la période de sa région.
  '  float age=mod(time-cycle.y-launch.z,cycle.x);',
  // Durée de son vol : 2·vUp/g.
  '  float flight=2.*launch.x/gravity;',
  // En vol (1) ou retombé (0).
  '  float alive=step(age,flight);',
  // Hauteur balistique, en rayons : vUp·t − g·t²/2, jamais sous la surface.
  '  float h=max(launch.x*age-.5*gravity*age*age,0.);',
  // Pied du grain, unitaire.
  '  vec3 foot=normalize(position);',
  // Direction du grain : il glisse le long de la surface à la vitesse vTan.
  '  vec3 dir=normalize(foot+slide*launch.y*age);',
  // Position du grain, dans le repère de la caméra.
  '  vec4 mv=modelViewMatrix*vec4(dir*radius*(1.+h*alive),1.);',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Avancement du vol, entre 0 et 1.
  '  float k=clamp(age/flight,0.,1.);',
  // Chaleur : le grain part brûlant et refroidit.
  '  vHeat=1.-k;',
  // Taille à l’écran, en pixels : 0,017 rayon solaire, selon la taille relative du grain et la distance.
  '  float size=launch.w*.017*radius*pixels/max(-mv.z,1e-6);',
  // Opacité : nulle au départ et à la retombée, et quand le grain fait moins d’un pixel (Soleil vu de loin).
  '  vAlpha=alive*sin(k*PI)*smoothstep(.4,1.4,size);',
  // Taille du point, entre 1 et 48 pixels ; nulle si le grain est retombé.
  '  gl_PointSize=alive*clamp(size,1.,48.);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments des éruptions (début).
const eruptionFragment = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables reçues du shader de sommets.
  'varying float vHeat;varying float vAlpha;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Distance au centre du point, de 0 au centre à 1 au bord.
  '  float d=length(gl_PointCoord-.5)*2.;',
  // Disque flou : plein au centre, transparent au bord.
  '  float soft=1.-smoothstep(0.,1.,d);',
  // Grain invisible : pas dessiné.
  '  if(vAlpha*soft<.004)discard;',
  // Couleur : rouge sombre quand il est froid, orange puis jaune très clair quand il est brûlant.
  '  vec3 col=mix(vec3(.85,.12,.02),vec3(1.,.55,.12),smoothstep(0.,.5,vHeat));',
  // Les plus chauds : presque blancs.
  '  col=mix(col,vec3(1.,.95,.75),smoothstep(.6,1.,vHeat));',
  // Couleur finale, avec son opacité.
  '  gl_FragColor=vec4(col,vAlpha*soft);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Crée le Soleil de rayon `radius` (unités de la scène) : renvoie le maillage de la surface, auquel les éruptions
 * sont rattachées (`mesh.userData.eruptions`). `lite` (téléphone) : bruit moins détaillé, moins de régions actives
 * et moins de grains. Les éruptions ne sont dessinées que si le Soleil fait au moins 24 pixels de rayon à l'écran.
 *
 * Les régions sont simulées au départ (eruptionSites), et `mesh.userData.setEruptionSites(sites)` les remplace par
 * les régions actives réelles quand le moteur les reçoit du serveur ; `setEruptionSites(null)` ramène les simulées.
 */
// Déclare et exporte createSunSurface : le rayon du Soleil et le profil allégé.
export function createSunSurface(radius, { lite = false } = {}) {
  // Nombre de régions affichées : 5 sur téléphone, 8 sinon.
  const siteBudget = lite ? 5 : MAX_SITES;
  // Régions simulées, utilisées jusqu'à l'arrivée des régions réelles et en cas de panne du serveur.
  const fallbackSites = eruptionSites(siteBudget);
  // Régions affichées à cet instant : les simulées au départ, remplacées par setSites.
  let sites = fallbackSites;
  // Directions des régions pour le shader : toujours MAX_SITES cases, les cases en trop restent à zéro.
  const siteDir = Array.from({ length: MAX_SITES }, () => new THREE.Vector3());
  // Cycles des régions : période et décalage (période de 1 pour les cases vides, jamais lues).
  const siteCycle = Array.from({ length: MAX_SITES }, () => new THREE.Vector2(1, 0));
  // Le temps, partagé par la surface et les éruptions.
  const time = { value: 0 };

  // Maillage de la surface (début).
  const mesh = new THREE.Mesh(
    // Géométrie : une sphère au rayon du Soleil.
    new THREE.SphereGeometry(radius, 64, 48),
    // Matériau à shader (début).
    new THREE.ShaderMaterial({
      // Nombre d'octaves du bruit : 3 sur téléphone, 5 sinon.
      defines: { OCTAVES: lite ? 3 : 5 },
      // Variables uniformes : le temps, la durée d'une gerbe, les régions actives.
      uniforms: { time, burst: { value: ERUPTION_BURST_S }, siteCount: { value: siteBudget }, siteDir: { value: siteDir }, siteCycle: { value: siteCycle } },
      // Les deux shaders.
      vertexShader: surfaceVertex, fragmentShader: surfaceFragment,
    // Fin du matériau.
    })
  // Fin du maillage.
  );

  // Nombre de grains par région : 130 sur téléphone, 320 sinon.
  const perSite = lite ? 130 : 320;
  // Géométrie des éruptions.
  const geometry = new THREE.BufferGeometry();
  // Les tableaux sont dimensionnés pour MAX_SITES régions une fois pour toutes : le nombre de régions réelles
  // change à chaque mise à jour, mais la mémoire de la carte graphique, elle, n'est allouée qu'ici.
  // declareAttribute : déclare un attribut de la taille maximale, mis à jour en place.
  const declareAttribute = (name, size) => {
    // L'attribut, vide au départ.
    const attribute = new THREE.BufferAttribute(new Float32Array(MAX_SITES * perSite * size), size);
    // Il sera réécrit de temps en temps : la carte graphique en est avertie.
    attribute.setUsage(THREE.DynamicDrawUsage);
    // On le pose sur la géométrie.
    geometry.setAttribute(name, attribute);
    // Et on le rend, pour pouvoir le remplir.
    return attribute;
  // Fin de declareAttribute.
  };
  // Point de départ de chaque grain.
  const positionAttribute = declareAttribute('position', 3);
  // Direction de départ le long de la surface.
  const slideAttribute = declareAttribute('slide', 3);
  // Paramètres de lancement.
  const launchAttribute = declareAttribute('launch', 4);
  // Période et décalage de la région.
  const cycleAttribute = declareAttribute('cycle', 2);
  // Volume englobant : les grains bougent dans le shader, donc une sphère fixe de 1,6 rayon autour du Soleil.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.6);
  // Échelle en pixels de l'écran, mise à jour avant chaque rendu.
  const pixels = { value: 1000 };
  // Les éruptions : un nuage de points (début).
  const eruptions = new THREE.Points(geometry, new THREE.ShaderMaterial({
    // Variables uniformes : le temps, la gravité, le rayon et l'échelle en pixels.
    uniforms: { time, gravity: { value: ERUPTION_GRAVITY }, radius: { value: radius }, pixels },
    // Les deux shaders.
    vertexShader: eruptionVertex, fragmentShader: eruptionFragment,
    // Transparent, en mélange additif (la matière brille), sans écriture de la profondeur ; le Soleil cache les grains passés derrière lui.
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  // Fin des éruptions.
  }));
  // Les grains ne se cliquent pas : seul le Soleil répond au clic.
  eruptions.raycast = () => {};

  /**
   * Pose les régions actives : remplit les tableaux des grains et les variables du shader de la surface. Une liste
   * vide ou absente ramène les régions simulées, pour que le Soleil continue d'éclater quand le serveur ne répond
   * pas. Appelée au départ, puis à chaque arrivée des régions réelles (toutes les quinze minutes) : jamais à
   * chaque image, car elle réécrit les tableaux des grains.
   */
  // Déclare setSites : la liste des régions.
  const setSites = (next) => {
    // Les régions à poser : celles reçues, bornées au budget, ou les simulées à défaut.
    sites = next?.length ? next.slice(0, siteBudget) : fallbackSites;
    // Les tableaux des grains de ces régions.
    const grains = buildEruptionAttributes(sites, perSite, radius);
    // Recopie chacun des quatre tableaux au début de l'attribut correspondant.
    for (const [attribute, data] of [[positionAttribute, grains.position], [slideAttribute, grains.tangent], [launchAttribute, grains.launch], [cycleAttribute, grains.cycle]]) {
      // Les valeurs sont écrites au début du tableau de l'attribut.
      attribute.array.set(data);
      // La carte graphique renvoie le tableau au prochain rendu.
      attribute.needsUpdate = true;
    // Fin de la boucle des attributs.
    }
    // Seuls les grains des régions posées sont dessinés : les cases au-delà sont ignorées.
    geometry.setDrawRange(0, grains.count);
    // Nombre de régions lu par le shader de la surface, pour les taches sombres et les pieds d'éruption.
    mesh.material.uniforms.siteCount.value = sites.length;
    // Pour chaque case de région (début).
    for (let i = 0; i < MAX_SITES; i++) {
      // La direction de la région, ou zéro pour une case vide.
      siteDir[i].set(...(sites[i]?.dir || [0, 0, 0]));
      // Sa période et son décalage ; une période de 1 pour une case vide, jamais lue.
      siteCycle[i].set(sites[i]?.period || 1, sites[i]?.offset || 0);
    // Fin de la boucle.
    }
  // Fin de setSites.
  };
  // Pose les régions simulées : le Soleil éclate dès la première image, sans attendre le serveur.
  setSites(null);
  // Range setSites dans userData : le moteur l'appelle quand les régions réelles arrivent.
  mesh.userData.setEruptionSites = setSites;
  // Rattache les éruptions au Soleil : elles le suivent et tournent avec lui.
  mesh.add(eruptions);
  // Les range dans userData.
  mesh.userData.eruptions = eruptions;

  // Instant de création, en millisecondes.
  const start = performance.now();
  // Vecteur de travail : position du Soleil dans le repère de la caméra.
  const view = new THREE.Vector3();
  // Vecteur de travail : taille du rendu.
  const bufferSize = new THREE.Vector2();
  // Avant chaque rendu de la surface (début).
  mesh.onBeforeRender = (renderer, scene, camera) => {
    // Temps écoulé depuis la création, en secondes.
    time.value = (performance.now() - start) / 1000;
    // Échelle : nombre de pixels couverts par une unité de la scène placée à une unité de la caméra.
    pixels.value = renderer.getDrawingBufferSize(bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // Distance du Soleil à la caméra.
    const distance = view.setFromMatrixPosition(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse).length() || 1;
    // Éruptions dessinées seulement si le Soleil fait au moins 24 pixels de rayon : de loin, elles ne se verraient pas.
    eruptions.visible = (radius * pixels.value) / distance >= 24;
  // Fin du traitement avant rendu.
  };
  // Fonction de libération rangée dans userData : libère les deux géométries et les deux matériaux.
  mesh.userData.dispose = () => { mesh.geometry.dispose(); mesh.material.dispose(); geometry.dispose(); eruptions.material.dispose(); };
  // Renvoie le maillage.
  return mesh;
// Fin de createSunSurface.
}
