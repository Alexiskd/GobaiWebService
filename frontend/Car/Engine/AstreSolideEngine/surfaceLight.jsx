// Éclairage des surfaces planétaires, en GLSL partagé par les shaders des tuiles (tiles/tileShaders.jsx), de la sphère
// de fond (sphereShade.jsx) et des nuages de la Terre (atmosphereShaders.jsx). Deux modèles :
//
//  - Modèle général (géantes gazeuses, Titan, Vénus, astres sans air) : `dayWeight` et `litColor`, inchangés depuis
//    leur écriture dans les shaders des tuiles et de la sphère de fond ; ils sont seulement mis en commun ici.
//
//  - Modèle de la Terre (`earthIrradiance`), calculé en lumière linéaire puis ramené à l'écran (puissance 1/2,2) :
//      • lumière directe du Soleil : loi de Lambert sur la pente du terrain, atténuée par l'air traversé
//        (exp(−τ·(m − 1)), τ = épaisseur optique verticale de atmosphereData.jsx, m = masse d'air de Kasten et Young),
//        d'où le sol et les nuages qui rougissent et s'assombrissent près du terminateur ;
//      • lumière du ciel : bleutée, ≈ 10 % de la lumière directe en plein jour, elle s'éteint au crépuscule ;
//      • reflet du Soleil sur la mer (`oceanGlint`) : microfacettes GGX, rugosité de la surface agitée par un vent de
//        7 m/s (Cox et Munk 1954), réflexion de Fresnel de l'eau (2 % de face).
//    Le voile bleu du limbe n'est pas simulé sur le sol : c'est la coquille de diffusion de l'atmosphère
//    (atmosphereScatter.jsx) qui le calcule.
//
// Ces formules sont des approximations physiques (diffusion simple, ciel uniforme, vent fixe) : elles rendent la
// lumière vraisemblable, elles ne sont pas une mesure. Les fonctions JavaScript du même nom suivent les mêmes
// formules et servent aux tests.

// Importe l'épaisseur optique verticale de l'atmosphère, depuis atmosphereData.
import { verticalOpticalDepth } from './AtmosphereEngine/atmosphereData.jsx';

/** Épaisseur optique verticale de l'atmosphère terrestre (rouge, vert, bleu), ≈ (0,074 ; 0,136 ; 0,293). */
// Déclare et exporte l'épaisseur optique de la Terre.
export const EARTH_TAU = verticalOpticalDepth('earth');
/** Lumière du ciel en plein jour, en part de la lumière directe (rouge, vert, bleu) : bleutée, ≈ 10 %. */
// Déclare et exporte la lumière du ciel en plein jour.
export const SKY_LIGHT = [0.075, 0.095, 0.13];
/** Vitesse du vent qui ride la mer pour le reflet du Soleil, en m/s (vent moyen au-dessus des océans). */
// Déclare et exporte le vent du reflet : 7 m/s.
export const GLINT_WIND_MS = 7;

/** Masse d'air traversée par la lumière du Soleil, selon d = cosinus de sa distance au zénith (Kasten et Young 1989). */
// Déclare et exporte airMass : le cosinus de la distance zénithale.
export function airMass(d) {
  // Cosinus borné entre 0 et 1.
  const c = Math.min(1, Math.max(0, d));
  // Distance zénithale en degrés.
  const z = (Math.acos(c) * 180) / Math.PI;
  // 1 au zénith, ≈ 38 à l'horizon.
  return 1 / (c + 0.50572 * (96.07995 - z) ** -1.6364);
// Fin de airMass.
}

/** Part de la lumière du Soleil qui traverse l'air jusqu'au sol (rouge, vert, bleu), ramenée à 1 au zénith. */
// Déclare et exporte sunTransmit : le cosinus de la distance zénithale.
export function sunTransmit(d) {
  // Masse d'air en plus de celle du zénith.
  const m = airMass(d) - 1;
  // Atténuation de chaque couleur.
  return EARTH_TAU.map((t) => Math.exp(-t * m));
// Fin de sunTransmit.
}

/** Coefficient de rugosité GGX de la mer pour un vent donné (pente quadratique moyenne de Cox et Munk). */
// Déclare et exporte glintRoughness : la vitesse du vent en m/s.
export const glintRoughness = (windMs = GLINT_WIND_MS) => Math.sqrt(0.003 + 0.00512 * windMs);

// Écrit un nombre en GLSL, avec un point décimal.
const f = (v) => (Number.isInteger(v) ? `${v}.` : String(Number(v.toPrecision(6))));
// Écrit un vecteur de trois nombres en GLSL.
const v3 = ([a, b, c]) => `vec3(${f(a)},${f(b)},${f(c)})`;

/** Modèle général, inchangé : part de jour et couleur éclairée (avec atmosphère, ou Lommel-Seeliger sans). */
// Déclare et exporte le GLSL du modèle général (début).
export const GENERIC_LIGHT_GLSL = [
  // dayWeight : part de jour ; transition large avec atmosphère, nette sans.
  'float dayWeight(float d,float airless){return mix(smoothstep(-.12,.22,d),smoothstep(-.02,.04,d),airless);}',
  // litColor : couleur éclairée ; simple avec atmosphère, loi de Lommel-Seeliger sans.
  'vec3 litColor(vec3 col,float m0,float mu,float airless){return mix(col*(.38+.72*m0),col*min(1.4,.04+2.*m0/(m0+mu+.001)),airless);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/** Modèle de la Terre : masse d'air, transmission, lumière du ciel, éclairement total et reflet sur la mer. */
// Déclare et exporte le GLSL du modèle de la Terre (début).
export const EARTH_LIGHT_GLSL = [
  // Constantes : épaisseur optique verticale, lumière du ciel, rugosité de la mer (au carré).
  `const vec3 EARTH_TAU=${v3(EARTH_TAU)};const vec3 SKY_LIGHT=${v3(SKY_LIGHT)};const float GLINT_A2=${f(glintRoughness() ** 2)};`,
  // airMass : masse d'air de Kasten et Young ; 1 au zénith, ≈ 38 à l'horizon.
  'float airMass(float d){float c=clamp(d,0.,1.);return 1./(c+.50572*pow(96.07995-degrees(acos(c)),-1.6364));}',
  // sunTransmit : lumière du Soleil qui traverse l'air, ramenée à 1 au zénith.
  'vec3 sunTransmit(float d){return exp(-EARTH_TAU*(airMass(d)-1.));}',
  // skyLight : lumière du ciel, nulle 6° sous l'horizon, entière à 24° de hauteur.
  'vec3 skyLight(float d){float t=clamp((d+.1)/.5,0.,1.);return SKY_LIGHT*t*t;}',
  // twilight : bande bleue du crépuscule autour du terminateur (référence : fond d'écran iOS), qui adoucit le passage jour / nuit.
  'vec3 twilight(float d){return vec3(.004,.018,.05)*exp(-d*d/.012);}',
  // earthIrradiance : éclairement en lumière linéaire ; d = hauteur du Soleil (sphère), dt = son angle avec la pente du
  // terrain. La lumière directe s'éteint quand le Soleil passe sous l'horizon du lieu.
  'vec3 earthIrradiance(float d,float dt){return sunTransmit(d)*max(dt,0.)*smoothstep(-.06,.16,d)+skyLight(d)+twilight(d);}',
  // oceanGlint : reflet du Soleil sur l'eau, en lumière linéaire ; N normale, V vers la caméra, L vers le Soleil,
  // d = N·L, mu = N·V. Microfacettes GGX, ombrage de Smith (Schlick), Fresnel de Schlick (2 % de face).
  'vec3 oceanGlint(vec3 N,vec3 V,vec3 L,float d,float mu){if(d<=0.||mu<=0.)return vec3(0.);vec3 H=normalize(L+V);',
  // Distribution des pentes des vagues.
  'float nh=max(dot(N,H),0.);float q=nh*nh*(GLINT_A2-1.)+1.;float D=GLINT_A2/(3.14159265*q*q);',
  // Fresnel et ombrage des vagues entre elles.
  'float F=.02+.98*pow(1.-max(dot(V,H),0.),5.);float k=.5*sqrt(GLINT_A2);float G=(mu/(mu*(1.-k)+k))*(d/(d*(1.-k)+k));',
  // Reflet, atténué par l'air traversé comme la lumière directe.
  'return sunTransmit(d)*(3.14159265*D*F*G/(4.*max(mu,.05)));}',
  // earthGrade : colorimétrie de la Terre (référence : fond d'écran iOS) ; c = couleur de l'image (0 … 1), wm = part de mer.
  // Mer : bleu profond, plus clair sur les hauts-fonds (luminosité de l'image). Terre : désaturée, sombre ; déserts
  // virés au brun chaud ; glace et neige blanches, neutres, légèrement froides.
  'vec3 earthGrade(vec3 c,float wm){float l=dot(c,vec3(.299,.587,.114));vec3 land=mix(vec3(l),c,.62);',
  // Chaleur des déserts : rouge nettement au-dessus du bleu, luminosité moyenne.
  'float warm=smoothstep(.03,.18,c.r-c.b)*smoothstep(.12,.35,l);land=mix(land,land*vec3(1.16,1.,.78)+vec3(.02,.008,0.),warm*.6);',
  // Glace : clair et peu saturé, ramené sur un blanc neutre un peu froid ; puis assombrissement général des terres.
  'float ice=smoothstep(.55,.8,l)*(1.-smoothstep(.08,.2,max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b))));land=mix(land,vec3(l*1.08+.04)*vec3(.97,.99,1.),ice);land*=.88;',
  // Mer : dégradé du bleu profond au bleu des hauts-fonds, avec un peu de la teinte d'origine.
  'vec3 ocean=mix(vec3(.015,.065,.17),vec3(.04,.22,.38),smoothstep(.12,.45,l));ocean=mix(ocean,ocean*(.7+.9*c),.35);',
  'return mix(land,ocean,wm);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Modèle de Jupiter : couleur et lumière d'un sommet de nuages vu comme sur les images de Juno et de Cassini.
 *  - jupiterGrade : colorimétrie de la carte (bandes brunes et ocre, zones crème, Grande Tache rouge brique) :
 *    saturation +18 %, teinte un peu plus chaude, contraste +12 % autour du gris moyen ;
 *  - jupiterLight : lumière diffuse (diffusion multiple, pas d'ombre franche) : terminateur large et doux, et
 *    assombrissement du bord, I(µ) = 1 − 0,62·(1 − µ) (coefficient de l'ordre de celui mesuré dans le visible), puis
 *    un léger voile gris-bleu de brume haute au limbe, côté jour.
 * Approximations pour le rendu : ce ne sont pas des mesures.
 */
// Déclare et exporte le GLSL du modèle de Jupiter.
export const JUPITER_LIGHT_GLSL = [
  // jupiterGrade : couleur sRGB de la carte → couleur sRGB retouchée.
  'vec3 jupiterGrade(vec3 c){float l=dot(c,vec3(.299,.587,.114));vec3 s=mix(vec3(l),c,1.18)*vec3(1.04,1.,.93);return clamp((s-.5)*1.12+.48,0.,1.);}',
  // jupiterLight : couleur sRGB retouchée, cosinus du Soleil d et cosinus de la vue mu → couleur sRGB éclairée.
  'vec3 jupiterLight(vec3 g,float d,float mu){vec3 cl=pow(g,vec3(2.2));',
  // Éclairement diffus : montée douce de −0,1 à 1 (terminateur large) ; assombrissement du bord.
  'float ill=pow(clamp((d+.1)/1.1,0.,1.),.8);float ld=1.-.62*(1.-mu);',
  // Voile de brume haute au limbe (gris-bleu), proportionnel à la lumière reçue ; faible lueur de nuit.
  'vec3 o=cl*ill*ld*1.15+vec3(.62,.68,.78)*pow(1.-mu,2.5)*.1*ill+vec3(.002,.0015,.001);',
  // Retour à l'écran.
  'return pow(o,vec3(.4545));}',
// Fin du tableau : les lignes sont jointes par des retours à la ligne (comme les deux autres modèles).
].join('\n');
