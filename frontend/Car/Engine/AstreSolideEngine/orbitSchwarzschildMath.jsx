// Affichage Schwarzschild du système solaire : orbites en rosette (géodésiques intégrées, l'avance du
// périhélie devient visible) et grille filaire formée de la famille des rayons issus du centre du Soleil
// (chaque rayon est un méridien du paraboloïde de Flamm : un entonnoir simple, sous le plan de l'écliptique).
// Fonctions pures, sans three.js, pour être testées.
//
// La métrique de Schwarzschild dévie du modèle képlérien surtout par l'avance du périhélie :
//   Δϖ = 6 π G M / (c² a (1 − e²))   (radians par orbite)
// À l'échelle réelle, cette avance est minuscule (Mercure : 43″ par siècle, soit 0,5·10⁻⁶ rad par orbite) :
// dans la scène, un facteur d'exagération pédagogique la rend visible (rosette et creux de la grille).
// Importe les éléments à la date demandée et l'unité astronomique de la scène.
import { AU_UNITS, D, elementsAt } from './planetOrbits.jsx';

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
 * Géométrie filaire de la famille des rayons issus du centre du Soleil, au repère de la scène : chaque rayon
 * est un méridien du paraboloïde de Flamm, la vraie géométrie spatiale de la métrique de Schwarzschild. Du bord
 * du disque (profondeur nulle, sur le plan de l'écliptique) chaque rayon plonge vers la gorge du puits, sous
 * le Soleil — un entonnoir simple, tout entier sous le plan (y ≤ 0), sans miroir au-dessus.
 * @returns {Float32Array} 6 nombres par segment (deux points x, y, z), en unités de scène.
 */
export function schwarzschildRays({ outerAu, rays = 96, steps = 192, exaggeration = WELL_EXAGGERATION, sunRadiusAu = 0.00465 }) {
  // Les pas d'un méridien : du rayon du Soleil au bord du disque, resserrés vers le centre, où la courbure plonge.
  const radii = gridRadii(outerAu, steps, sunRadiusAu);
  // Chaque rayon porte steps − 1 tronçons de deux points : le tampon des segments, préalloué.
  const segs = new Float32Array(rays * (steps - 1) * 6);
  // Le curseur d'écriture dans le tampon.
  let k = 0;
  // Pour chaque rayon (du début).
  for (let i = 0; i < rays; i++) {
    // L'angle de ce rayon, autour du Soleil.
    const a = (i / rays) * 2 * Math.PI;
    // Le cosinus et le sinus : la direction horizontale du rayon, fixe le long du méridien.
    const ca = Math.cos(a), sa = Math.sin(a);
    // Du premier pas au dernier : le méridien suit le profil du puits (le √r de Flamm).
    for (let j = 1; j < radii.length; j++) {
      // La profondeur des deux bouts du tronçon, en unités de scène.
      const y0 = gridWellY(radii[j - 1], outerAu, exaggeration) * AU_UNITS;
      const y1 = gridWellY(radii[j], outerAu, exaggeration) * AU_UNITS;
      // Le tronçon : du rayon intérieur au rayon extérieur, à azimuth constant.
      segs[k++] = ca * radii[j - 1] * AU_UNITS;
      segs[k++] = y0;
      segs[k++] = sa * radii[j - 1] * AU_UNITS;
      segs[k++] = ca * radii[j] * AU_UNITS;
      segs[k++] = y1;
      segs[k++] = sa * radii[j] * AU_UNITS;
    // Fin des tronçons.
    }
  // Fin des rayons.
  }
  // La famille des rayons.
  return segs;
// Fin de schwarzschildRays.
}
