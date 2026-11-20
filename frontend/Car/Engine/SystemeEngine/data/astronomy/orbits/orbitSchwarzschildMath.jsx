// Affichage Schwarzschild du système solaire : orbites en rosette (géodésiques intégrées, l'avance du
// périhélie devient visible) et grille filaire en double puits (paraboloïde de Flamm, collé symétriquement
// sous la forme d'une toupie). Fonctions pures, sans three.js, pour être testées.
//
// La métrique de Schwarzschild dévie du modèle képlérien surtout par l'avance du périhélie :
//   Δϖ = 6 π G M / (c² a (1 − e²))   (radians par orbite)
// À l'échelle réelle, cette avance est minuscule (Mercure : 43″ par siècle, soit 0,5·10⁻⁶ rad par orbite) :
// dans la scène, un facteur d'exagération pédagogique la rend visible (rosette et creux de la grille).
// Importe les éléments à la date demandée et l'unité astronomique de la scène.
import { AU_UNITS, D, elementsAt } from '../../../../AstreSolideEngine/planetOrbits.jsx';

/** Constantes physiques (CODATA 2018, UAI) : produit GM du Soleil (m³/s²) et vitesse de la lumière (m/s). */
export const GM_SUN = 1.32712440018e20;
/** Vitesse de la lumière, en m/s. */
export const C_LIGHT = 299792458;
/** Unité astronomique, en mètres (définition UAI 2012). */
export const AU_M = 1.495978707e11;

/**
 * Exagération pédagogique du rayon de Schwarzschild dans l'intégration des géodésiques : l'équation intégrée
 * reste la vraie équation de la métrique, seule l'échelle de la courbure est multipliée, pour que la rosette
 * (Mercure ≈ 1° par orbite au lieu de 0,1″) se voie à l'œil nu.
 */
export const GEODESIC_EXAGGERATION = 60000;
/** Exagération visuelle du creux de la grille (le profil √r, signature de la courbure, est conservé). */
export const WELL_EXAGGERATION = 2000;
/** Durée de la transition entre orbites de Kepler et de Schwarzschild, en millisecondes. */
export const SCHWARZSCHILD_FADE_MS = 2500;

/** Rayon de Schwarzschild, en mètres : r_s = 2GM/c². */
export function schwarzschildRadiusM() {
  // Deux fois le produit GM sur le carré de la vitesse de la lumière.
  return (2 * GM_SUN) / (C_LIGHT * C_LIGHT);
// Fin de schwarzschildRadiusM.
}

/**
 * Avance du périhélie d'une orbite quasi circulaire, en radians par orbite.
 * Formule au premier ordre de la métrique de Schwarzschild ; a est en UA (demi-grand axe), e l'excentricité.
 */
export function precessionPerOrbitRad({ aAu, e = 0 }) {
  // Le demi-grand axe, en mètres.
  const aM = aAu * AU_M;
  // Six pi GM sur c², fois a(1 − e²).
  return (6 * Math.PI * GM_SUN) / (C_LIGHT * C_LIGHT * aM * (1 - e * e));
// Fin de precessionPerOrbitRad.
}

/**
 * Avance du périhélie, en secondes d'arc par siècle : la valeur comparable aux tables (Mercure ≈ 43″).
 * La période vient du moyen mouvement képlérien (n = 0,01720209895 rad/jour à 1 UA).
 */
export function precessionPerCenturyArcsec({ aAu, e = 0 }) {
  // Moyen mouvement en radians par jour, sur le modèle des éléments (troisième loi de Kepler, masse solaire).
  const n = 0.01720209895 / Math.pow(aAu, 1.5);
  // Orbites par siècle julien (36 525 jours).
  const orbits = 36525 / ((2 * Math.PI) / n);
  // Radians par orbite, convertis en secondes d'arc, fois le nombre d'orbites.
  return precessionPerOrbitRad({ aAu, e }) * orbits * (180 / Math.PI) * 3600;
// Fin de precessionPerCenturyArcsec.
}

/** Progression amortie de 0 à 1 (cubique, tangentes horizontales aux deux bouts) : transition sans à-coup. */
export function easeInOutCubic(u) {
  // Née hors de [0, 1] : ramenée.
  const t = Math.max(0, Math.min(1, u));
  // Avant la moitié : accélération ; ensuite : décélération.
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// Fin de easeInOutCubic.
}

/**
 * Mélange point à point de deux tracés de même longueur : out = from + u·(to − from).
 * Sert à la transition : u = 0 redonne Kepler, u = 1 la rosette de Schwarzschild.
 * @returns {Float32Array} out (le même tableau, modifié sur place)
 */
export function mixPoints(from, to, u, out) {
  // Longueur commune (les deux tracés font obligatoirement la même taille).
  const n = Math.min(from.length, to.length, out.length);
  // Chaque composante est interpolée indépendamment.
  for (let i = 0; i < n; i++) out[i] = from[i] + (to[i] - from[i]) * u;
  // Le tableau de sortie.
  return out;
// Fin de mixPoints.
}

/**
 * Géodésique de Schwarzschild autour du Soleil, intégrée par Runge-Kutta d'ordre 4.
 *
 * La planète est une masse d'épreuve sur une géodésique du temps dans la métrique de Schwarzschild, dans le
 * plan de son orbite (u = 1/r, équation de Binet relativiste) :
 *   u″ = GM/h² − u + (3/2) rs_eff u²
 * où h est le moment cinétique spécifique (conservé) et rs_eff le rayon de Schwarzschild, exagéré pour la
 * scène (GEODESIC_EXAGGERATION) : l'équation est la vraie, seule l'échelle de la courbure change. À
 * exagération nulle, la géodésique est l'ellipse de Kepler. L'intégration sort la vraie rosette : l'avance
 * du périhélie y est calculée, pas posée par la formule (qui reste dans le module pour la vérifier).
 *
 * Conditions initiales au périhélie (φ = 0) : u₀ = 1 / (a(1 − e)), u′₀ = 0 — le départ de la rosette est
 * exactement le périhélie de l'ellipse képlérienne au même endroit, pour que le fondu entre les deux
 * affichages ne fasse pas sauter le tracé.
 *
 * @param {number[]} el          les douze éléments képlériens (J2000 + dérive séculaire)
 * @param {number}   T           siècles de Temps terrestre depuis J2000
 * @param {number}   n           nombre de points du tracé (comme ORBIT_POINTS)
 * @param {number}   revolutions nombre d'orbites tracées (la rosette)
 * @param {number}   exaggeration facteur appliqué au rayon de Schwarzschild (0 : ellipse de Kepler exacte)
 * @returns {Float32Array} n × 3 coordonnées de la scène
 */
export function schwarzschildGeodesic(el, T, n, revolutions = 3, exaggeration = GEODESIC_EXAGGERATION) {
  // Les éléments à la date du jour.
  const k = elementsAt(el, T);
  // Le demi-grand axe et l'excentricité à cette date.
  const a = k.a, e = k.e;
  // Paramètre de l'ellipse : le demi-latus rectum p = a(1 − e²), en UA.
  const p = a * (1 - e * e);
  // Le rayon de Schwarzschild, en UA, exagéré pour la scène (≈ 2·10⁻⁸ UA à l'échelle réelle).
  const rsAu = (schwarzschildRadiusM() / AU_M) * exaggeration;
  // Le pas d'anomalie vraie entre deux points : `revolutions` tours sur n points.
  const dPhi = (2 * Math.PI * revolutions) / n;
  // Le second membre et sa dérivée : y = [u, u′] → y″ = GM/h² − u + (3/2) rs u², et GM/h² = 1/p.
  const accel = (u) => 1 / p - u + (1.5 * rsAu) * u * u;
  // Un pas de Runge-Kutta d'ordre 4 sur le couple [u, u′], de longueur h : renvoie l'état suivant.
  const rk4 = (u, du, h) => {
    // Les quatre pentes (u, u′).
    const a1u = du, a1d = accel(u);
    const a2u = du + h / 2 * a1d, a2d = accel(u + h / 2 * a1u);
    const a3u = du + h / 2 * a2d, a3d = accel(u + h / 2 * a2u);
    const a4u = du + h * a3d, a4d = accel(u + h * a3u);
    // La combinaison pondérée des quatre pentes.
    return [u + h / 6 * (a1u + 2 * a2u + 2 * a3u + a4u), du + h / 6 * (a1d + 2 * a2d + 2 * a3d + a4d)];
  // Fin du pas.
  };
  // L'état courant : au périhélie (φ = 0), la pente de u est nulle.
  let u = 1 / (a * (1 - e)), du = 0, phi = 0;
  // Le tracé de sortie.
  const out = new Float32Array(n * 3);
  // Un point par pas d'anomalie vraie, puis un pas d'intégration (début).
  for (let i = 0; i < n; i++) {
    // Le rayon géodésique à cette anomalie (garde-fou : u doit rester positif, la géodésique hors de l'horizon).
    const r = u > 0 ? 1 / u : p;
    // Le point du plan orbital, le périhélie en x.
    const px = r * Math.cos(phi), py = r * Math.sin(phi);
    // Puis vers l'écliptique J2000, et rangé dans le repère de la scène (x, z, −y), en unités de scène.
    const [x, y, z] = rotateOrbital(k, px, py);
    // Rangé dans le tracé.
    out[3 * i] = x * AU_UNITS; out[3 * i + 1] = z * AU_UNITS; out[3 * i + 2] = -y * AU_UNITS;
    // Le pas d'intégration vers le point suivant (le dernier point ne requiert plus rien).
    if (i < n - 1) {
      [u, du] = rk4(u, du, dPhi);
      // L'anomalie vraie du point suivant.
      phi = (i + 1) * dPhi;
    }
  // Fin des points.
  }
  // La géodésique.
  return out;
// Fin de schwarzschildGeodesic.
}

// Rotation du plan de l'orbite vers l'écliptique : applique ω, I puis Ω à un couple (x, y) du plan orbital.
function rotateOrbital(k, x, y) {
  // Argument du périhélie : longitude du périhélie moins longitude du nœud.
  const w = k.varpi * D - k.Om;
  // Cosinus et sinus des trois angles.
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(k.Om), sO = Math.sin(k.Om);
  const cI = Math.cos(k.I), sI = Math.sin(k.I);
  // Le vecteur dans l'écliptique J2000.
  return [
    (cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
    (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y,
    sw * sI * x + cw * sI * y,
  ];
// Fin de rotateOrbital.
}

/**
 * Profondeur du puits de gravité à la distance r du Soleil, en unités astronomiques (négatif vers le bas) :
 * paraboloïde de Flamm, la vraie géométrie spatiale de la métrique de Schwarzschild, dont le profil en √r est la
 * signature. La surface est posée à zéro au bord extérieur du disque et plonge au centre.
 * @param {number} rAu          distance au Soleil, en UA (au moins le rayon de Schwarzschild)
 * @param {number} outerAu      rayon du disque de la grille, en UA (profondeur nulle)
 * @param {number} exaggeration exagération visuelle du creux
 */
export function gridWellY(rAu, outerAu, exaggeration = WELL_EXAGGERATION) {
  // Rayon de Schwarzschild, en UA (≈ 2·10⁻⁸ : tout le disque est bien au-delà de l'horizon).
  const rsAu = schwarzschildRadiusM() / AU_M;
  // Profils de Flamm : la hauteur au-dessus de la gorge vaut 2√(rs·r).
  const inner = 2 * Math.sqrt(rsAu * Math.max(rAu, rsAu));
  const outer = 2 * Math.sqrt(rsAu * Math.max(outerAu, rsAu));
  // La différence, exagérée, descend sous le plan : zéro au bord, le creux au centre.
  return -exaggeration * (outer - inner);
// Fin de gridWellY.
}

/**
 * Rayons des anneaux de la grille : espacement quadratique (les cercles se resserrent vers le Soleil, où la
 * courbure plonge), du rayon du Soleil au bord du disque.
 * @returns {number[]} `rings` rayons, en UA, du premier anneau au bord extérieur.
 */
export function gridRadii(outerAu, rings, sunRadiusAu) {
  // Les anneaux rayons, du plus intérieur au bord (le dernier tombe sur outerAu).
  const out = [];
  for (let i = 1; i <= rings; i++) {
    // Progression quadratique : les anneaux resserrent la courbure au centre (densité au centre).
    const u = (i / rings) * (i / rings);
    out.push(Math.max(sunRadiusAu, outerAu * u));
  // Fin des anneaux.
  }
  // La liste.
  return out;
// Fin de gridRadii.
}

/**
 * Excentricité moyenne de l'orbite des satellites naturels, par identifiant (éléments orbitaux moyens du JPL,
 * Solar System Dynamics). Le catalogue des satellites ne la porte pas : leurs positions sont calculées sur une
 * orbite circulaire, et cette table ne sert qu'au tracé de leur rosette de Schwarzschild — sans excentricité, une
 * rosette n'est qu'un cercle qui tourne sur lui-même, indiscernable du cercle.
 */
export const SATELLITE_ECCENTRICITY = Object.freeze({
  phobos: 0.0151, deimos: 0.0002,
  io: 0.0041, europa: 0.0094, ganymede: 0.0013, callisto: 0.0074, amalthea: 0.0032, thebe: 0.0175, himalia: 0.16,
  mimas: 0.0196, enceladus: 0.0047, tethys: 0.0001, dione: 0.0022, rhea: 0.001, titan: 0.0288, hyperion: 0.1042,
  iapetus: 0.0283, phoebe: 0.164, janus: 0.0068, epimetheus: 0.0098,
  miranda: 0.0013, ariel: 0.0012, umbriel: 0.0039, titania: 0.0011, oberon: 0.0014, puck: 0.0001,
  triton: 0.000016, nereid: 0.751, proteus: 0.0005,
  charon: 0.0002, nix: 0.002, hydra: 0.0059, kerberos: 0.0033, styx: 0.0058,
});

/**
 * Rosette de Schwarzschild d'un satellite autour de sa planète, dans le plan de son orbite et en unités de son
 * demi-grand axe : même équation que pour les planètes (u'' = 1/p − u + 3/2 × rs × u²), intégrée en RK4.
 *  e          excentricité de l'orbite (0 : cercle — la rosette se confond alors avec lui) ;
 *  rsOverA    rayon de Schwarzschild de la planète, déjà exagéré, divisé par le demi-grand axe ;
 *  n          nombre de segments ; revolutions : nombre de tours tracés.
 * Le tracé part du périastre, sur l'axe x, et tourne dans le plan x-z, comme le cercle unité des anneaux d'orbite.
 * Il est ramené à un périastre de rayon 1 : l'anneau d'un satellite est agrandi à sa distance du moment et son
 * premier point est le satellite lui-même, qui reste ainsi posé sur sa rosette.
 * @returns {Float32Array} (n + 1) points x, y, z (y = 0) ; le rayon va de 1 (périastre) à (1 + e) / (1 − e).
 */
export function schwarzschildSatelliteRosette({ e = 0, rsOverA = 0, n = 256, revolutions = 3 }) {
  const ecc = Math.min(0.95, Math.max(0, Number(e) || 0));
  const rs = Math.max(0, Number(rsOverA) || 0);
  // Paramètre de l'ellipse (demi-grand axe 1) et pas angulaire.
  const p = 1 - ecc * ecc;
  const dPhi = (2 * Math.PI * revolutions) / n;
  const accel = (u) => 1 / p - u + 1.5 * rs * u * u;
  const out = new Float32Array((n + 1) * 3);
  // Départ au périastre : r = 1 − e, vitesse radiale nulle.
  let u = 1 / (1 - ecc), du = 0;
  for (let i = 0; i <= n; i++) {
    // Rayon en unités du demi-grand axe, puis ramené au périastre (divisé par 1 − e).
    const r = (u > 0 ? 1 / u : p) / (1 - ecc);
    const phi = i * dPhi;
    out[3 * i] = r * Math.cos(phi); out[3 * i + 1] = 0; out[3 * i + 2] = r * Math.sin(phi);
    // Un pas de Runge-Kutta d'ordre 4 sur (u, du).
    const k1u = du, k1d = accel(u);
    const k2u = du + dPhi / 2 * k1d, k2d = accel(u + dPhi / 2 * k1u);
    const k3u = du + dPhi / 2 * k2d, k3d = accel(u + dPhi / 2 * k2u);
    const k4u = du + dPhi * k3d, k4d = accel(u + dPhi * k3u);
    u += dPhi / 6 * (k1u + 2 * k2u + 2 * k3u + k4u);
    du += dPhi / 6 * (k1d + 2 * k2d + 2 * k3d + k4d);
  }
  return out;
}

/**
 * Position relative d'un satellite couchée sur le plan horizontal de son système : même distance à la planète, même
 * direction dans le plan (x, z), hauteur ramenée vers 0 selon `alpha` (0 = position de Kepler, 1 = à plat).
 * La hauteur est réduite d'abord, puis x et z sont allongés pour retrouver la distance : le satellite reste sur son
 * cercle au lieu de se rapprocher de la planète. Un satellite exactement à la verticale de la planète part vers +x.
 * @returns {number[]} [x, y, z]
 */
export function flatRelative(x, y, z, alpha) {
  const a = Math.min(1, Math.max(0, Number(alpha) || 0));
  if (a === 0) return [x, y, z];
  const distance = Math.hypot(x, y, z);
  const height = y * (1 - a);
  const reach = Math.sqrt(Math.max(0, distance * distance - height * height));
  const planar = Math.hypot(x, z);
  if (planar < 1e-12) return [reach, height, 0];
  return [(x / planar) * reach, height, (z / planar) * reach];
}

/**
 * Pose le tracé d'une orbite sur le puits de gravité du Soleil (le « plan de Schwarzschild ») : chaque point prend
 * la hauteur de la grille à sa distance du Soleil. Modifie `points` sur place (trois nombres par point, unités de
 * scène, y vers le haut) et le rend.
 *  flatten = faux : la hauteur de la grille s'ajoute à la hauteur du point — l'orbite garde son inclinaison ;
 *  flatten = vrai : la hauteur du point est remplacée par celle de la grille — l'inclinaison de Kepler est effacée,
 *                   l'orbite est couchée sur le puits. C'est le cas des planètes naines, dont l'orbite très inclinée
 *                   (Éris : 44°) sortirait sinon loin au-dessus et au-dessous de la grille.
 * Au-delà du bord de la grille (outerAu), la hauteur de la grille est nulle.
 */
export function layOrbitOnWell(points, outerAu, { flatten = false } = {}) {
  for (let i = 0; i < points.length; i += 3) {
    // Distance au Soleil : dans le plan de l'écliptique si l'orbite est couchée, dans l'espace sinon.
    const rAu = (flatten ? Math.hypot(points[i], points[i + 2]) : Math.hypot(points[i], points[i + 1], points[i + 2])) / AU_UNITS;
    const well = rAu < outerAu ? gridWellY(rAu, outerAu) * AU_UNITS : 0;
    points[i + 1] = flatten ? well : points[i + 1] + well;
  }
  return points;
}

/**
 * Géométrie filaire de la grille : segments (paires de points) pour anneaux et rayons, au repère de la scène.
 * La grille est le puits de gravité du Soleil : un seul cône, sous le plan de l'écliptique, dont le bord est dans ce
 * plan et la pointe au Soleil.
 * @returns {Float32Array} 6 nombres par segment (deux points x, y, z), en unités de scène.
 */
export function schwarzschildGridSegments({ outerAu, rings = 28, spokes = 48, exaggeration = WELL_EXAGGERATION, sunRadiusAu = 0.00465 }) {
  // Les rayons des anneaux.
  const radii = gridRadii(outerAu, rings, sunRadiusAu);
  // Segments des anneaux (rings × spokes) et des rayons (spokes × (rings − 1) tronçons) :
  const segs = [];
  // Pour chaque anneau (du début).
  for (const r of radii) {
    // La profondeur de cet anneau, en unités de scène.
    const y = gridWellY(r, outerAu, exaggeration) * AU_UNITS;
    // Pour chaque pas du cercle (du début).
    for (let i = 0; i < spokes; i++) {
      // Les angles des deux bouts du segment d'anneau.
      const a0 = (i / spokes) * 2 * Math.PI, a1 = ((i + 1) / spokes) * 2 * Math.PI;
      // Le segment, dans le plan x-z de la scène.
      segs.push(Math.cos(a0) * r * AU_UNITS, y, Math.sin(a0) * r * AU_UNITS, Math.cos(a1) * r * AU_UNITS, y, Math.sin(a1) * r * AU_UNITS);
    // Fin des pas.
    }
  // Fin des anneaux.
  }
  // Les rayons : chaque rayon suit la pente du puits par palier d'anneaux.
  for (let i = 0; i < spokes; i++) {
    // L'angle de ce rayon.
    const a = (i / spokes) * 2 * Math.PI;
    // Le cosinus et le sinus.
    const ca = Math.cos(a), sa = Math.sin(a);
    // Du premier anneau au bord (du début).
    for (let j = 1; j < radii.length; j++) {
      // La profondeur des deux bouts.
      const y0 = gridWellY(radii[j - 1], outerAu, exaggeration) * AU_UNITS;
      const y1 = gridWellY(radii[j], outerAu, exaggeration) * AU_UNITS;
      // Le segment du rayon.
      segs.push(ca * radii[j - 1] * AU_UNITS, y0, sa * radii[j - 1] * AU_UNITS, ca * radii[j] * AU_UNITS, y1, sa * radii[j] * AU_UNITS);
    // Fin des tronçons.
    }
  // Fin des rayons.
  }
  // Le tampon des segments : le puits seul, sous le plan de l'écliptique (le cône du bas).
  return new Float32Array(segs);
// Fin de schwarzschildGridSegments.
}
