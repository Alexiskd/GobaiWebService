/**
 * Shader de la couche de pollution lumineuse : une coque à peine au-dessus du sol de la Terre, sous les nuages,
 * qui montre la mosaïque mondiale des lumières (atlas 2025 en couleurs naturelles, déjà chargée par les tuiles de la
 * Terre) seulement sur la face de nuit, en lumière ajoutée. Mêmes formules que pollution-lumineuse.math.js.
 */

// Déclare et exporte le shader de sommets (début).
export const pollutionVertexShader = [
  // Direction du point dans le repère des tuiles (sphère de rayon 1, axe des pôles = +Y).
  'varying vec3 vDir;',
  // Profondeur logarithmique de three.js, si le moteur de rendu l'utilise.
  '#include <common>',
  // Déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_vertex>',
  // Fonction principale : la direction, puis la position à l'écran.
  'void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
  // Profondeur logarithmique. Fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin du shader de sommets.
].join('\n');

// Déclare et exporte le shader de fragments (début).
export const pollutionFragmentShader = [
  // Mosaïque des lumières, sa présence, la direction du Soleil (repère des tuiles), l'ombre, l'interrupteur et la vue
  // de nuit, le stockage en lumière linéaire, l'intensité.
  'uniform sampler2D lgMap;uniform float lgOn;uniform vec3 sunDir;uniform float shade;uniform float lightsOn;uniform float lightView;uniform float ltLinear;uniform float intensity;',
  // Direction du point.
  'varying vec3 vDir;',
  // Déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Fonction principale (début) : profondeur logarithmique.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Lumières coupées ou mosaïque absente : rien.
  'if(lightsOn<.5||lgOn<.5){discard;}',
  // Direction normalisée, longitude et latitude (bornée au Web Mercator).
  'vec3 d=normalize(vDir);float lon=atan(-d.z,d.x);float lat=clamp(asin(clamp(d.y,-1.,1.)),-1.48442,1.48442);',
  // Position dans la mosaïque : u = longitude, v = ordonnée Mercator (texture retournée : nord en haut).
  'vec2 uv=vec2(lon/6.2831853+.5,.5+log(tan(.78539816+lat*.5))/6.2831853);',
  // Part de nuit : crépuscule de +0,05 à −0,12 ; vue de nuit : partout.
  'float c=dot(d,normalize(sunDir));float night=lightView>.5?1.:smoothstep(.05,-.12,c);',
  // Rien de jour, ni sans ombre (bouton « Ombre » coupé : astres entièrement éclairés).
  'float k=night*(lightView>.5?1.:shade)*intensity;if(k<.002){discard;}',
  // Couleur de la mosaïque ; stockée en lumière linéaire : ramenée en sRGB pour l'écran.
  'vec3 col=texture2D(lgMap,uv).rgb;if(ltLinear>.5){col=pow(col,vec3(1./2.2));}',
  // Lumière ajoutée (fond transparent, mélange additif). Fin de la fonction principale.
  'gl_FragColor=vec4(col*k,1.);}',
// Fin du shader de fragments.
].join('\n');

// Déclare et exporte le shader de fragments de l'ombre (début) : face de nuit de la Terre posée sur le globe CesiumJS,
// en alpha prémultiplié (fond × (1 − alpha) + lueur du crépuscule). Mêmes formules que dayLight et shadowAlpha
// (pollution-lumineuse.math.js).
export const shadowFragmentShader = [
  // Direction du Soleil (repère des tuiles), ombre, vue de nuit et intensité (fondu du zoom).
  'uniform vec3 sunDir;uniform float shade;uniform float lightView;uniform float intensity;',
  // Direction du point.
  'varying vec3 vDir;',
  // Déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Fonction principale (début) et profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Force de l'ombre : bouton « Ombre » × fondu du zoom (vue de nuit : entière).
  'float k=(lightView>.5?1.:shade)*intensity;if(k<.002){discard;}',
  // Cosinus de la hauteur du Soleil au point.
  'float c=dot(normalize(vDir),normalize(sunDir));',
  // Lumière du sol : dégradé en S de −0,28 (fin du crépuscule) à +0,30 (plein jour), jour atténué quand le Soleil est bas.
  'float t=clamp((c+.28)/.58,0.,1.);float l=t*t*(3.-2.*t)*(.75+.25*clamp(c,0.,1.));if(lightView>.5){l=0.;}',
  // Opacité de l'ombre (plancher de nuit 4 %).
  'float a=(1.-l)*.96*k;if(a<.002){discard;}',
  // Lueur chaude du crépuscule, juste après le coucher (bande étroite, discrète).
  'float g=exp(-pow((c+.04)/.06,2.))*.05*k*(1.-lightView);',
  // Alpha prémultiplié. Fin de la fonction principale.
  'gl_FragColor=vec4(vec3(1.,.48,.22)*g,a);}',
// Fin du shader de l'ombre.
].join('\n');
