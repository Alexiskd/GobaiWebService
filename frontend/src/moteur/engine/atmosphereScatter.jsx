// Cœur GLSL de la diffusion atmosphérique (diffusion simple, intégrée le long du rayon de vue), sans dépendance :
// partagé par le matériau three.js (atmosphere.jsx) et par le banc d'essai du shader.
//
// Toutes les longueurs sont en rayons de l'astre, centre de l'astre à l'origine.
//   o    position de la caméra            d    direction du rayon de vue (unitaire)
//   sun  direction du Soleil (unitaire)
// Résultat : lumière diffusée vers la caméra (à ajouter à l'image), déjà ramenée entre 0 et 1.

// Déclare et exporte les variables uniformes GLSL de la diffusion (début).
export const SCATTER_UNIFORMS_GLSL = [
  // Coefficients et hauteurs d'échelle de Rayleigh et de Mie, extinction de Mie et asymétrie de la phase.
  'uniform vec3 betaR;uniform float hR;uniform vec3 betaM;uniform vec3 betaE;uniform float hM;uniform float gM;',
  // Rayon du sol, rayon du sommet de l'atmosphère, intensité du Soleil et gain devant le disque.
  'uniform float rGround;uniform float rTop;uniform float sunI;uniform float discGain;',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Déclare et exporte le code GLSL de la diffusion (début).
export const SCATTER_GLSL = [
  // Nombre de pas le long du rayon de vue et vers le Soleil : réglables par `defines` (allégés sur téléphone).
  // Nombre de pas le long du rayon de vue : 16 par défaut.
  '#ifndef SCATTER_STEPS', '#define SCATTER_STEPS 16', '#endif',
  // Nombre de pas vers le Soleil : 6 par défaut.
  '#ifndef LIGHT_STEPS', '#define LIGHT_STEPS 6', '#endif',
  // Intersections du rayon avec une sphère centrée à l'origine : (entrée, sortie), entrée > sortie s'il la manque.
  // Calculé par la distance du rayon au centre : reste précis quand la caméra est à des centaines de rayons.
  // Fonction atmoSphere : distances d'entrée et de sortie d'un rayon dans une sphère de rayon r.
  'vec2 atmoSphere(vec3 o,vec3 d,float r){float b=dot(o,d);vec3 q=o-b*d;float h=r*r-dot(q,q);if(h<0.)return vec2(1.,-1.);h=sqrt(h);return vec2(-b-h,-b+h);}',
  // Fonction atmoScatter : début.
  'vec3 atmoScatter(vec3 o,vec3 d,vec3 sun){',
  // Le rayon manque l'atmosphère, ou elle est derrière : aucune lumière.
  '  vec2 ta=atmoSphere(o,d,rTop);if(ta.x>ta.y||ta.y<=0.)return vec3(0.);',
  // Début et fin du trajet dans l'atmosphère ; gain de 1 par défaut.
  '  float t0=max(ta.x,0.),t1=ta.y;float gain=1.;',
  // Intersection avec le sol.
  '  vec2 tg=atmoSphere(o,d,rGround);',
  // Si le rayon touche le sol : caméra sous le sol, aucune lumière.
  '  if(tg.x<tg.y){if(tg.x<=0.&&tg.y>0.)return vec3(0.);',            // caméra sous le niveau de référence
  // Sol devant : le trajet s'arrête au sol, avec le gain du disque.
  '    if(tg.x>0.){t1=min(t1,tg.x);gain=discGain;}}',                  // le rayon touche le sol (ou les nuages)
  // Trajet vide : aucune lumière.
  '  if(t1<=t0)return vec3(0.);',
  // Longueur d'un pas, profondeurs optiques et sommes de Rayleigh et de Mie.
  '  float ds=(t1-t0)/float(SCATTER_STEPS);float oR=0.,oM=0.;vec3 sR=vec3(0.),sM=vec3(0.);',
  // Boucle sur les pas du rayon de vue.
  '  for(int i=0;i<SCATTER_STEPS;i++){',
  // Point du pas et son altitude.
  '    vec3 p=o+d*(t0+(float(i)+.5)*ds);float h=max(length(p)-rGround,0.);',
  // Densités de Rayleigh et de Mie sur ce pas, ajoutées aux profondeurs optiques.
  '    float dR=exp(-h/hR)*ds,dM=exp(-h/hM)*ds;oR+=dR;oM+=dM;',
  // Vers le Soleil : rien si l'astre fait écran (nuit), sinon l'air traversé atténue la lumière.
  // Si l'astre cache le Soleil vu de ce point : pas suivant.
  '    vec2 tp=atmoSphere(p,sun,rGround);if(tp.x<tp.y&&tp.y>0.)continue;',
  // Trajet du point vers le Soleil jusqu'au sommet de l'atmosphère, et son pas.
  '    vec2 tl=atmoSphere(p,sun,rTop);float dl=tl.y/float(LIGHT_STEPS);float lR=0.,lM=0.;',
  // Boucle vers le Soleil : profondeurs optiques de Rayleigh et de Mie.
  '    for(int j=0;j<LIGHT_STEPS;j++){vec3 q=p+sun*((float(j)+.5)*dl);float hl=max(length(q)-rGround,0.);lR+=exp(-hl/hR)*dl;lM+=exp(-hl/hM)*dl;}',
  // Atténuation sur les deux trajets, puis ajout aux sommes.
  '    vec3 att=exp(-(betaR*(oR+lR)+betaE*(oM+lM)));sR+=att*dR;sM+=att*dM;',
  // Fin de la boucle.
  '  }',
  // Cosinus de l'angle avec le Soleil et fonction de phase de Rayleigh.
  '  float mu=dot(d,sun);float pR=.0596831*(1.+mu*mu);',
  // Fonction de phase de Mie.
  '  float g2=gM*gM;float pM=.1193662*((1.-g2)*(1.+mu*mu))/((2.+g2)*pow(max(1.+g2-2.*gM*mu,1e-4),1.5));',
  // Lumière diffusée : intensité, gain, et les deux contributions.
  '  vec3 c=sunI*gain*(sR*betaR*pR+sM*betaM*pM);',
  // Ramène le résultat entre 0 et 1.
  '  return vec3(1.)-exp(-c);',
  // Fin de atmoScatter.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
