// Cumulonimbus de la Terre : tours de convection coiffées d'une enclume, selon la « théorie de Gazo ».
// La théorie illustrée par la vidéo (gouttelettes d'eau = boules bleues, cristal de glace = flocon) est le processus de
// Wegener-Bergeron-Findeisen : un courant ascendant monte les gouttelettes au-dessus de l'isotherme 0 °C ; elles restent
// liquides (surfondues) jusqu'à environ −38 °C, et le cristal de glace grossit à leurs dépens (l'air est saturé pour la
// glace avant de l'être pour l'eau). Au-delà, tout gèle : le sommet est un nuage de glace que le jet-stream étire en
// enclume. Ce fichier contient la physique (en JavaScript, testée) et le code GLSL qui la dessine, sans dépendance à three.js.

// Paramètres physiques de la tour, en kilomètres et degrés Celsius (atmosphère tropicale).
export const CUMULONIMBUS = {
  // Température de l'air au sol : 27 °C.
  groundC: 27,
  // Gradient vertical de température de l'air saturé : 6 °C par kilomètre.
  lapseCPerKm: 6,
  // Altitude de la base des nuages : 1,5 km (gouttelettes liquides).
  baseKm: 1.5,
  // Altitude du sommet de la tour, au niveau de la tropopause : 12 km (là où l'enclume s'étale).
  topKm: 12,
  // Température en dessous de laquelle les gouttelettes surfondues gèlent toutes d'un coup : −38 °C.
  homogeneousC: -38,
  // Rayon du cœur de la tour, en kilomètres : de 60 à 200 km selon la cellule (60 + 140 × un nombre au hasard).
  coreMinKm: 60, coreSpanKm: 140,
  // Étalement de l'enclume, en rayons du cœur : 3,2 fois le rayon dans le sens du vent, 1,6 fois de travers, décalée de 1,2.
  anvilAlong: 3.2, anvilAcross: 1.6, anvilShift: 1.2,
  // Échelle de la grille des cellules sur la sphère unitaire : 22 cases, soit environ 570 km par case.
  gridScale: 22,
// Fin des paramètres.
};

// Rayon de la Terre en kilomètres, pour passer des distances unitaires aux kilomètres.
export const EARTH_RADIUS_KM = 6371;

// Température de l'air à l'altitude `altKm`, en °C : décroît linéairement depuis le sol.
export function temperatureC(altKm) {
  // Température au sol moins le gradient fois l'altitude.
  return CUMULONIMBUS.groundC - CUMULONIMBUS.lapseCPerKm * altKm;
// Fin de temperatureC.
}

// Altitude (km) où l'air atteint la température `tC` : l'inverse de temperatureC.
export function altitudeAtC(tC) {
  // Écart de température depuis le sol, divisé par le gradient.
  return (CUMULONIMBUS.groundC - tC) / CUMULONIMBUS.lapseCPerKm;
// Fin de altitudeAtC.
}

// Courbe de lissage de 0 à 1 entre a et b (même définition que le smoothstep du GLSL).
function smoothstep(a, b, x) {
  // Avancement borné entre 0 et 1.
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  // Courbe en S.
  return t * t * (3 - 2 * t);
// Fin de smoothstep.
}

/**
 * Phase de l'eau à l'altitude `altKm` dans le courant ascendant : { temperatureC, liquid, ice }.
 *  - sous la base : pas de nuage (liquid = 0, ice = 0) ;
 *  - de la base à l'isotherme 0 °C : gouttelettes liquides (les boules bleues de la vidéo), liquid = 1 ;
 *  - de 0 °C à −38 °C : phase mixte, la glace grossit aux dépens des gouttelettes (Bergeron), `ice` monte de 0 à 1 ;
 *  - au-delà de −38 °C : glace seule, liquid = 0, ice = 1 (le flocon).
 */
export function cumulonimbusPhase(altKm) {
  // Température à cette altitude.
  const t = temperatureC(altKm);
  // Hors du nuage (sous la base ou au-dessus du sommet) : rien.
  if (altKm < CUMULONIMBUS.baseKm || altKm > CUMULONIMBUS.topKm) return { temperatureC: t, liquid: 0, ice: 0 };
  // Part de glace : nulle à 0 °C, entière à −38 °C, progressive entre les deux (la température décroît avec l'altitude).
  const ice = smoothstep(0, CUMULONIMBUS.homogeneousC, t);
  // Le reste est liquide.
  return { temperatureC: t, liquid: 1 - ice, ice };
// Fin de cumulonimbusPhase.
}

/**
 * Probabilité qu'une cellule de la grille porte un cumulonimbus, selon la latitude (radians) : forte dans la zone de
 * convergence intertropicale (autour de l'équateur), moyenne dans les rails de dépressions vers 50°, très faible sous
 * les tropiques secs (autour de 25°) et près des pôles. Même formule que dans le shader.
 */
export function convectiveWeight(latRad) {
  // Valeur absolue de la latitude.
  const al = Math.abs(latRad);
  // Zone de convergence intertropicale : gaussienne de largeur 0,16 rad autour de l'équateur, poids 0,55.
  const itcz = 0.55 * Math.exp(-((latRad / 0.16) ** 2));
  // Rails de dépressions : gaussienne de largeur 0,18 rad autour de 0,8 rad (≈ 46°), poids 0,22.
  const storm = 0.22 * Math.exp(-(((al - 0.8) / 0.18) ** 2));
  // Somme des deux.
  return itcz + storm;
// Fin de convectiveWeight.
}

// Code GLSL des cumulonimbus. À placer après EARTH_CLOUDS_GLSL, dont il réutilise cHash et cFbm (pas de redéfinition).
// Déclare et exporte le code GLSL (début).
export const CUMULONIMBUS_GLSL = [
  // Constantes du shader, écrites depuis les paramètres ci-dessus.
  `#define CB_SCALE ${CUMULONIMBUS.gridScale.toFixed(1)}`,
  // Rayon de la Terre en kilomètres.
  `#define CB_R ${EARTH_RADIUS_KM.toFixed(1)}`,
  // Rayon minimal et variable du cœur, en kilomètres.
  `#define CB_CORE_MIN ${CUMULONIMBUS.coreMinKm.toFixed(1)}`, `#define CB_CORE_SPAN ${CUMULONIMBUS.coreSpanKm.toFixed(1)}`,
  // Étalement de l'enclume : dans le sens du vent, de travers et décalage vers l'aval.
  `#define CB_A_ALONG ${CUMULONIMBUS.anvilAlong.toFixed(2)}`, `#define CB_A_ACROSS ${CUMULONIMBUS.anvilAcross.toFixed(2)}`, `#define CB_A_SHIFT ${CUMULONIMBUS.anvilShift.toFixed(2)}`,
  // Fonction cbWeight : probabilité d'un cumulonimbus à la latitude `lat` (même formule que convectiveWeight).
  'float cbWeight(float lat){float al=abs(lat);return .55*exp(-pow(lat/.16,2.))+.22*exp(-pow((al-.8)/.18,2.));}',
  // Fonction cumulonimbus : le point unitaire p ; renvoie (densité du nuage, part de glace visible du dessus).
  'vec2 cumulonimbus(vec3 p){',
  // Direction de l'est au point (le jet-stream souffle vers l'est) ; aux pôles, où elle est nulle, pas de cumulonimbus.
  '  vec3 e=vec3(p.z,0.,-p.x);float el=length(e);if(el<1e-4)return vec2(0.);e/=el;',
  // Meilleure densité et glace associée, trouvées parmi les huit cellules voisines.
  '  float dens=0.,ice=0.;',
  // Position dans la grille, décalée d'une demi-case pour que les huit cellules entourent le point.
  '  vec3 g=p*CB_SCALE-.5;vec3 b=floor(g);',
  // Boucle sur les huit coins du cube de cellules voisines.
  '  for(int i=0;i<8;i++){',
  // Décalage de ce coin : 0 ou 1 sur chaque axe (pas d\'opérateur binaire en GLSL ES 1.0).
  '    vec3 o=vec3(mod(float(i),2.),mod(floor(float(i)/2.),2.),floor(float(i)/4.));vec3 c=b+o;',
  // Centre de la cellule : au milieu de la case, déplacé au hasard d\'au plus un quart de case, puis ramené sur la sphère.
  '    vec3 ctr=normalize((c+.5+(vec3(cHash(c),cHash(c+7.1),cHash(c+13.3))-.5)*.5)/CB_SCALE);',
  // La cellule est active si un nombre au hasard est sous la probabilité de sa latitude.
  '    float w=cbWeight(asin(clamp(ctr.y,-1.,1.)));if(cHash(c+31.7)>w)continue;',
  // Rayon du cœur de cette cellule, en kilomètres, au hasard entre le minimum et le minimum plus l\'écart.
  '    float rc=CB_CORE_MIN+CB_CORE_SPAN*cHash(c+3.3);',
  // Vecteur de la cellule au point, sur la sphère : distance le long du vent (est) et de travers, en kilomètres.
  '    vec3 r=p-ctr;vec3 ec=normalize(vec3(ctr.z,1e-6,-ctr.x));float al=dot(r,ec)*CB_R;float ac=length(r-ec*dot(r,ec))*CB_R;',
  // Distance au centre du cœur, en kilomètres.
  '    float d=length(r)*CB_R;',
  // Tour : disque net qui s\'effrange en choux-fleurs (bruit fin), sa densité vaut 1 au centre.
  '    float cauli=cFbm(p*55.+c);float core=smoothstep(rc*(.85+.3*cauli),rc*.3,d);',
  // Enclume : ellipse étirée vers l\'est et décalée sous le vent, au bord fibreux (bruit étiré le long du vent).
  '    float fib=cFbm(vec3(al*.02,ac*.09,cHash(c))+c);vec2 q=vec2((al-rc*CB_A_SHIFT)/(rc*CB_A_ALONG),ac/(rc*CB_A_ACROSS));',
  // Densité de l\'enclume : douce, plus mince que la tour (55 %), modulée par les fibres.
  '    float anv=.55*smoothstep(1.,.15,length(q)+.35*(fib-.5));',
  // Densité totale de la cellule : le plus épais des deux.
  '    float cd=max(core,anv);',
  // Part de glace vue du dessus : l\'enclume est de la glace pure ; le cœur est mixte sur son flanc (gris-bleu, gouttelettes
  // encore liquides), de plus en plus glacé vers son sommet (blanc), d\'après la phase de Bergeron.
  '    float ci=max(anv/.55*.95,core*smoothstep(.15,.9,core));',
  // Garde la cellule la plus dense.
  '    if(cd>dens){dens=cd;ice=ci;}',
  // Fin de la boucle.
  '  }',
  // Renvoie densité et glace ; fin de la fonction.
  '  return vec2(dens,ice);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
