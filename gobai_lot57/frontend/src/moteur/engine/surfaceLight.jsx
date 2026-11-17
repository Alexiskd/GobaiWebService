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
import { verticalOpticalDepth } from './atmosphereData';

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
  // earthIrradiance : éclairement en lumière linéaire ; d = hauteur du Soleil (sphère), dt = son angle avec la pente du
  // terrain. La lumière directe s'éteint quand le Soleil passe sous l'horizon du lieu.
  'vec3 earthIrradiance(float d,float dt){return sunTransmit(d)*max(dt,0.)*smoothstep(-.03,.01,d)+skyLight(d);}',
  // oceanGlint : reflet du Soleil sur l'eau, en lumière linéaire ; N normale, V vers la caméra, L vers le Soleil,
  // d = N·L, mu = N·V. Microfacettes GGX, ombrage de Smith (Schlick), Fresnel de Schlick (2 % de face).
  'vec3 oceanGlint(vec3 N,vec3 V,vec3 L,float d,float mu){if(d<=0.||mu<=0.)return vec3(0.);vec3 H=normalize(L+V);',
  // Distribution des pentes des vagues.
  'float nh=max(dot(N,H),0.);float q=nh*nh*(GLINT_A2-1.)+1.;float D=GLINT_A2/(3.14159265*q*q);',
  // Fresnel et ombrage des vagues entre elles.
  'float F=.02+.98*pow(1.-max(dot(V,H),0.),5.);float k=.5*sqrt(GLINT_A2);float G=(mu/(mu*(1.-k)+k))*(d/(d*(1.-k)+k));',
  // Reflet, atténué par l'air traversé comme la lumière directe.
  'return sunTransmit(d)*(3.14159265*D*F*G/(4.*max(mu,.05)));}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
