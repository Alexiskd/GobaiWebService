// Nuages simulés (GLSL sans dépendance), partagés par le matériau three.js (atmosphere.jsx) et le banc d'essai.
// Les motifs sont calculés sur la sphère (point `p` unitaire, pôles sur l'axe Y) : aucune image, aucune couture.
// Ce sont des nuages vraisemblables, pas la météo du jour.

// Code GLSL du bruit (début).
const NOISE_GLSL = [
  // Octaves du bruit et leur somme (pour garder la même couverture) : réglables par `defines` (allégés sur téléphone).
  // Nombre d'octaves du bruit (5 par défaut) et somme de leurs poids.
  '#ifndef CLOUD_OCTAVES', '#define CLOUD_OCTAVES 5', '#define CLOUD_NORM .96875', '#endif',
  // Fonction cHash : nombre pseudo-aléatoire entre 0 et 1 à partir d'un point.
  'float cHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
  // Fonction cNoise : bruit lissé ; partie entière, partie fractionnaire et courbe de lissage.
  'float cNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
  // Interpolation des quatre coins de la face avant du cube…
  'return mix(mix(mix(cHash(i),cHash(i+vec3(1.,0.,0.)),f.x),mix(cHash(i+vec3(0.,1.,0.)),cHash(i+vec3(1.,1.,0.)),f.x),f.y),',
  // … et des quatre coins de la face arrière, puis entre les deux faces.
  'mix(mix(cHash(i+vec3(0.,0.,1.)),cHash(i+vec3(1.,0.,1.)),f.x),mix(cHash(i+vec3(0.,1.,1.)),cHash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}',
  // Fonction cFbm : somme d'octaves de bruit, de plus en plus fines et faibles, ramenée entre 0 et 1.
  'float cFbm(vec3 p){float a=.5,s=0.;for(int i=0;i<CLOUD_OCTAVES;i++){s+=a*cNoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/CLOUD_NORM;}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Vénus : sommet des nuages d'acide sulfurique. Traînées étirées le long des parallèles et inclinées vers les pôles
 * (la haute atmosphère fait le tour de la planète en quatre jours). Couleurs proches de ce que voit l'œil nu : voile
 * blanc crème, creux beige doré, plages ocre orangé près de l'équateur, calottes polaires plus claires — sans le bleu
 * des vues en ultraviolet ou en couleurs rehaussées.
 * `venusClouds(p)` renvoie la couleur des nuages.
 */
// Déclare et exporte le code GLSL des nuages de Vénus (début).
export const VENUS_CLOUDS_GLSL = [
  // Le code du bruit.
  NOISE_GLSL,
  // Fonction venusClouds : début.
  'vec3 venusClouds(vec3 p){',
  // Latitude du point et sa valeur absolue.
  '  float lat=asin(clamp(p.y,-1.,1.));float al=abs(lat);',
  // Cisaillement : plus on monte en latitude, plus le motif est décalé en longitude, d'où les chevrons couchés.
  // Rotation autour de l'axe des pôles, d'un angle qui croît avec la latitude.
  '  float a=2.1*al+.3*sin(lat*3.);float c=cos(a),s=sin(a);vec3 q=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);',
  // Première couche de bruit, qui déforme le motif.
  '  float warp=cFbm(q*2.1+3.1);',
  // Coordonnées étirées le long des parallèles et déformées.
  '  vec3 w=q*vec3(1.5,6.5,1.5)+vec3(warp*1.7,warp*.7,-warp*1.1);',
  // Deux couches de bruit : les traînées et le détail fin.
  '  float streak=cFbm(w);float fine=cFbm(w*3.3+7.);',
  // Mélange des trois, borné entre 0 et 1.
  '  float t=clamp(.62*streak+.28*fine+.22*warp-.06,0.,1.);',
  // Zones chaudes : près de l'équateur, là où une autre couche de bruit est forte.
  '  float warm=smoothstep(.42,.7,cFbm(q*1.5+11.))*(1.-smoothstep(.3,.95,al));',
  // Couleur de base : du beige doré au blanc crème.
  '  vec3 col=mix(vec3(.80,.71,.58),vec3(.99,.97,.92),smoothstep(.28,.72,t));',
  // Ajoute l'ocre orangé dans les zones chaudes.
  '  col=mix(col,vec3(.90,.68,.44)*(.78+.34*t),warm*.75);',
  // Éclaircit les calottes polaires.
  '  col=mix(col,vec3(.98,.96,.91),.45*smoothstep(.85,1.2,al)*(.6+.4*fine));',
  // Renvoie la couleur ; fin de la fonction.
  '  return col;}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Terre : couverture nuageuse (0 = ciel dégagé, 1 = couvert). Plus de nuages près de l'équateur et vers 50° de
 * latitude (dépressions), moins sous les tropiques (déserts), comme la répartition moyenne réelle.
 */
// Déclare et exporte le code GLSL des nuages de la Terre (début).
export const EARTH_CLOUDS_GLSL = [
  // Le code du bruit.
  NOISE_GLSL,
  // Fonction earthClouds : début.
  'float earthClouds(vec3 p){',
  // Latitude du point et sa valeur absolue.
  '  float lat=asin(clamp(p.y,-1.,1.));float al=abs(lat);',
  // Première couche de bruit, qui déforme le motif.
  '  float warp=cFbm(p*2.6+1.7);',
  // Systèmes enroulés : le motif est tordu par une seconde couche de bruit.
  // Coordonnées agrandies et déformées.
  '  vec3 q=p*4.6+vec3(warp*2.2,-warp*1.4,warp*1.8);',
  // Bruit principal.
  '  float n=cFbm(q);',
  // Correction selon la latitude : plus près de l'équateur et vers 50°, moins sous les tropiques.
  '  float bias=.09*exp(-pow(lat/.14,2.))+.11*exp(-pow((al-.92)/.26,2.))-.1*exp(-pow((al-.45)/.2,2.));',
  // Couverture : transition douce autour d'un seuil.
  '  float cover=smoothstep(.5,.74,n+bias);',
  // Module la couverture par un bruit fin ; fin de la fonction.
  '  return cover*(.55+.45*cFbm(p*21.+5.));}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
