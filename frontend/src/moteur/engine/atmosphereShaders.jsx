// Shaders GLSL des atmosphères (nuages de Vénus, nuages de la Terre, coquille de diffusion), sans dépendance à
// three.js : atmosphere.jsx en fait des matériaux, et le banc d'essai peut les compiler seuls.
// Importe le code GLSL des nuages de la Terre et de Vénus, depuis atmosphereClouds.
import { EARTH_CLOUDS_GLSL, VENUS_CLOUDS_GLSL } from './atmosphereClouds';
// Importe le code GLSL de la diffusion et ses variables uniformes, depuis atmosphereScatter.
import { SCATTER_GLSL, SCATTER_UNIFORMS_GLSL } from './atmosphereScatter';
// Importe la plus grande vitesse de vent codée, depuis weatherFlow.
import { WIND_MAX_MS } from './weatherFlow';

// Déclare et exporte le shader de sommets des nuages (début).
export const cloudVertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : normale, direction de la caméra et position unitaire.
  'varying vec3 vN;varying vec3 vV;varying vec3 vP;',
  // Fonction principale : position unitaire, normale dans le repère de la caméra, position dans ce repère, direction vers la caméra et position à l'écran.
  'void main(){vP=normalize(position);vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Vénus : couche de nuages opaque, au motif simulé.
// Déclare et exporte le shader de fragments des nuages de Vénus (début).
export const venusCloudFragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : la direction du Soleil et le réglage de l'ombre.
  'uniform vec3 sunV;uniform float shade;',
  // Variables reçues du shader de sommets.
  'varying vec3 vN;varying vec3 vV;varying vec3 vP;',
  // Le code GLSL du motif des nuages de Vénus.
  VENUS_CLOUDS_GLSL,
  // Début de la fonction principale et inclusion de la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Vue de dessous (caméra descendue sous les nuages) : la normale est retournée, on voit le plafond nuageux.
  // Normale unitaire, retournée quand la face est vue de l'intérieur.
  'vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;',
  // Couleur des nuages en ce point.
  'vec3 c=venusClouds(normalize(vP));',
  // Atmosphère épaisse : la lumière diffuse loin au-delà du terminateur, d'où une transition jour/nuit très douce.
  // Cosinus de l'angle avec le Soleil, et part de jour, progressive entre −0,2 et 0,3.
  'float d=dot(N,sunV);float day=smoothstep(-.2,.3,d);',
  // Couleur de jour, de 42 % à 112 % selon l'éclairement, et couleur de nuit, très sombre.
  'vec3 lit=c*(.42+.7*max(d,0.));vec3 night=c*vec3(.04,.036,.03);',
  // Couleur finale : sans ombre la couleur brute, avec ombre le mélange nuit/jour ; opaque. Fin de la fonction principale.
  'gl_FragColor=vec4(mix(c,mix(night,lit,day),shade),1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Terre : nuages simulés semi-transparents ; `fade` les efface quand la caméra descend vers le sol.
// Déclare et exporte le shader de fragments des nuages de la Terre (début).
export const earthCloudFragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Constante WIND_MAX du shader : la vitesse maximale importée, écrite avec une décimale.
  `#define WIND_MAX ${WIND_MAX_MS.toFixed(1)}`,
  // Variables uniformes : la direction du Soleil, l'ombre, le fondu près du sol et l'opacité.
  'uniform vec3 sunV;uniform float shade;uniform float fade;uniform float opacity;',
  // Variables uniformes : la carte de couverture nuageuse et son mode.
  'uniform sampler2D coverMap;uniform float coverOn;',
  // Mouvement de la météo (weatherFlow.jsx) : carte du vent et état de l'animation (secondes de vent des deux
  // copies, poids de la seconde).
  // Variables uniformes : la carte du vent, l'état de l'animation et son interrupteur.
  'uniform sampler2D windMap;uniform vec3 flow;uniform float flowOn;',
  // Variables reçues du shader de sommets.
  'varying vec3 vN;varying vec3 vV;varying vec3 vP;',
  // Le code GLSL des nuages simulés de la Terre.
  EARTH_CLOUDS_GLSL,
  // Point d'où vient l'air arrivé en `p` après `s` secondes de vent : on remonte le vent local (vers l'est, vers le nord).
  // Fonction advect : le point p et le nombre de secondes de vent (début).
  'vec3 advect(vec3 p,float s){',
  // Vent lu dans la carte à la longitude et à la latitude du point, ramené de 0..1 à ±WIND_MAX.
  'vec2 w=(texture2D(windMap,vec2(atan(-p.z,p.x)/6.2831853+.5,asin(clamp(p.y,-1.,1.))/3.14159265+.5)).rg*2.-1.)*WIND_MAX;',
  // Direction de l'est au point ; au pôle, où elle est nulle, le point est rendu tel quel ; sinon elle est rendue unitaire et la direction du nord est calculée.
  'vec3 e=vec3(p.z,0.,-p.x);float l=length(e);if(l<1e-5)return p;e/=l;vec3 n=cross(p,e);',
  // Renvoie le point reculé le long du vent, de s secondes, la distance étant divisée par le rayon de la Terre en mètres. Fin de advect.
  'return normalize(p-(e*w.x+n*w.y)*(s/6371000.));}',
  // Fonction coverAt : la couverture nuageuse au point p (début).
  'float coverAt(vec3 p){float cover;',
  // Nuages réels : carte mondiale (longitude Est positive, comme les tuiles), affinée par un grain pour ne pas voir
  // les cases de la grille. Sinon, nuages simulés.
  // coverOn : 0 = simulés, 1 = grille de couverture (plate carrée), 2 = mosaïque satellite (Mercator, RGBA).
  // Coordonnée horizontale de la carte (longitude) et latitude du point.
  'float u=atan(-p.z,p.x)/6.2831853+.5;float lat=asin(clamp(p.y,-1.,1.));',
  // Mode 2, mosaïque satellite : coordonnée verticale en projection de Mercator.
  'if(coverOn>1.5){float v=.5+log(tan(.78539816+lat*.5))/6.2831853;',
  // Image satellite : les nuages sont clairs, et transparents là où il n'y en a pas (selon la couche).
  // Lecture de l'image satellite.
  'vec4 t=texture2D(coverMap,vec2(u,clamp(v,0.,1.)));',
  // Couverture réelle : l'opacité de l'image multipliée par sa luminosité, progressive entre 0,18 et 0,85.
  'float real=t.a*smoothstep(.18,.85,dot(t.rgb,vec3(.299,.587,.114)));',
  // Mercator s'arrête à 85° : au-delà (et en fondu dès ~82°), les calottes polaires sont comblées par les nuages
  // simulés, pour ne pas laisser de trou aux pôles.
  // Poids de l'image : nul aux deux bords verticaux de la carte, entier entre 0,08 et 0,92.
  'float k=smoothstep(0.,.08,v)*(1.-smoothstep(.92,1.,v));',
  // Hors des calottes (k = 1), l'image satellite suffit : les nuages simulés, coûteux, ne sont pas calculés.
  // Couverture : l'image seule quand son poids est entier, sinon un mélange avec les nuages simulés. Fin du mode 2.
  'cover=k>.999?real:mix(earthClouds(p),real,k);}',
  // Mode 1, grille de couverture : lecture de la valeur à la longitude et à la latitude du point.
  'else if(coverOn>.5){float c=texture2D(coverMap,vec2(u,lat/3.14159265+.5)).r;',
  // Couverture : la valeur, progressive entre 0,2 et 0,95, modulée par un grain ; dans le dernier cas, mode 0, les nuages simulés.
  'cover=smoothstep(.2,.95,c)*(.55+.45*cFbm(p*21.+5.));}else{cover=earthClouds(p);}',
  // Renvoie la couverture. Fin de coverAt.
  'return cover;}',
  // Début de la fonction principale et inclusion de la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Position unitaire du point.
  'vec3 p=normalize(vP);',
  // Couverture : avec l'animation, mélange des deux copies déplacées par le vent ; sinon couverture du point lui-même.
  'float cover=flowOn>.5?mix(coverAt(advect(p,flow.x)),coverAt(advect(p,flow.y)),flow.z):coverAt(p);',
  // Applique l'opacité et le fondu ; un fragment presque transparent n'est pas dessiné.
  'cover*=opacity*fade;if(cover<.004)discard;',
  // Éclairement : de 3 % la nuit à 100 % le jour, progressif autour du terminateur.
  'float lit=mix(.03,1.,smoothstep(-.1,.25,dot(normalize(vN),sunV)));',
  // Couleur finale : blanc, assombri par l'éclairement selon le réglage de l'ombre ; opacité égale à la couverture. Fin de la fonction principale.
  'gl_FragColor=vec4(vec3(mix(1.,lit,shade)),cover);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Coquille : `vC` = centre de l'astre et `vP` = point de la coquille, dans le repère caméra.
// Déclare et exporte le shader de sommets de la coquille de diffusion (début).
export const shellVertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : le point de la coquille et le centre de l'astre.
  'varying vec3 vP;varying vec3 vC;',
  // Fonction principale : point dans le repère de la caméra, centre de l'astre dans ce repère et position à l'écran.
  'void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vP=mv.xyz;vC=(modelViewMatrix*vec4(0.,0.,0.,1.)).xyz;gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Déclare et exporte le shader de fragments de la coquille de diffusion (début).
export const shellFragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Les variables uniformes de la diffusion.
  SCATTER_UNIFORMS_GLSL,
  // Variables uniformes : la direction du Soleil et le rayon de l'astre.
  'uniform vec3 sunV;uniform float planetR;',
  // Variables reçues du shader de sommets.
  'varying vec3 vP;varying vec3 vC;',
  // Le code GLSL de la diffusion.
  SCATTER_GLSL,
  // Début de la fonction principale et inclusion de la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Tout est ramené en rayons de l'astre, centre à l'origine ; la caméra est à l'origine du repère caméra.
  // Couleur : la diffusion calculée depuis la position de la caméra en rayons de l'astre, dans la direction du point, avec la direction du Soleil ; opaque. Fin de la fonction principale.
  'gl_FragColor=vec4(atmoScatter(-vC/planetR,normalize(vP),normalize(sunV)),1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
