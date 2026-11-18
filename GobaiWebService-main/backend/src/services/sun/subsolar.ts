/**
 * Point sous-solaire d'un astre, calculé sur place : le point de sa surface où le Soleil est au zénith.
 *
 * Plus aucun service d'éphémérides n'est interrogé. Le calcul suit la méthode du dossier « API & méthodes de
 * calcul des orbites planétaires » (§ 4.A et § 4.B) : position héliocentrique VSOP87A, puis
 * passage dans le repère lié à l'astre.
 *
 *   1. direction astre → Soleil, dans l'écliptique J2000 ;
 *   2. passage de cette direction dans le repère de l'astre, qui tourne avec lui ;
 *   3. latitude et longitude de la direction obtenue : c'est le point sous-solaire.
 *
 * Deux repères liés à l'astre, selon ce que l'astre fait :
 *  - **Mars** : modèle de rotation de l'UAI, pôle (α₀, δ₀) et méridien origine W qui avance de 350,891 982 26°
 *    par jour — un tour en 24 h 37 min 22 s, le jour sidéral martien. Longitudes comptées vers l'est.
 *  - **Lune** : lois de Cassini, les mêmes que celles qui orientent la Lune dans la scène 3D : le méridien
 *    origine regarde la Terre moyenne, et l'équateur est incliné de 1,5427° sur l'écliptique, son nœud suivant
 *    celui de l'orbite. L'API et le globe donnent ainsi le même point.
 *
 * Précision : celle du modèle d'orbite (quelques dizaines de secondes d'arc sur la position des astres), plus
 * celle du modèle de rotation. Les librations physiques de la Lune, de quelques centièmes de degré, ne sont pas
 * modélisées ; la libration optique, elle, sort naturellement du calcul.
 */
import { PLANETS } from '../data/bodies.data';
import { AU_KM, Vec3, centuriesTT, earthPosition, heliocentric, moonGeocentric, moonVector } from '../ephemeris/planet-orbits';

/** Degrés par radian. */
const DEG = 180 / Math.PI;
/** Radians par degré. */
const RAD = Math.PI / 180;
/** Obliquité de l'écliptique à J2000, en degrés : passage écliptique ↔ équateur céleste. */
const OBLIQUITY = 23.4392911;
/** Inclinaison de l'équateur lunaire sur l'écliptique (lois de Cassini), en degrés. */
const MOON_EQUATOR_TILT = 1.5427;

/** Un point de la surface : longitude vers l'est et latitude, en degrés. */
export interface SubSolarPoint { lon: number; lat: number }

/** Longueur d'un vecteur. */
const len = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
/** Vecteur unitaire. */
const unit = (v: Vec3): Vec3 => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** Produit scalaire. */
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Produit vectoriel. */
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Longitude ramenée dans [-180, 180[. */
export const wrap180 = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** Écliptique J2000 → équateur céleste J2000 (ICRF), repère des pôles de l'UAI. */
export function eclipticToEquatorial([x, y, z]: Vec3): Vec3 {
  // Cosinus et sinus de l'obliquité.
  const c = Math.cos(OBLIQUITY * RAD), s = Math.sin(OBLIQUITY * RAD);
  // La rotation autour de l'axe des x.
  return [x, y * c - z * s, y * s + z * c];
// Fin de eclipticToEquatorial.
}

/**
 * Modèle de rotation de l'UAI : pôle et méridien origine d'un astre.
 * `T` en siècles juliens de Temps terrestre depuis J2000, `d` en jours.
 */
export interface IauRotation { ra: number; dec: number; w: number }

/** Modèle de rotation de Mars (UAI/AIU 2015 ; α₀ et δ₀ dérivent, W avance d'un tour par jour sidéral). */
export const marsRotation = (T: number, d: number): IauRotation => ({
  ra: 317.68143 - 0.1061 * T,
  dec: 52.8865 - 0.0609 * T,
  w: 176.63 + 350.89198226 * d,
});

/**
 * Point sous-solaire d'un astre dont la rotation suit le modèle de l'UAI.
 * @param toSunEcliptic direction astre → Soleil, dans l'écliptique J2000
 * @param rotation pôle et méridien origine de l'astre à cet instant
 */
export function subSolarFromIau(toSunEcliptic: Vec3, { ra, dec, w }: IauRotation): SubSolarPoint {
  // La direction, dans le repère des pôles de l'UAI.
  const d = unit(eclipticToEquatorial(toSunEcliptic));
  // Axe de rotation de l'astre.
  const pole: Vec3 = [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
  // Nœud ascendant de l'équateur de l'astre sur l'équateur céleste : l'origine d'où W est compté.
  const node: Vec3 = [-Math.sin(ra * RAD), Math.cos(ra * RAD), 0];
  // Axe du méridien origine : le nœud, tourné de W autour du pôle.
  const cw = Math.cos(w * RAD), sw = Math.sin(w * RAD);
  const nxp = cross(pole, node);
  const x: Vec3 = [node[0] * cw + nxp[0] * sw, node[1] * cw + nxp[1] * sw, node[2] * cw + nxp[2] * sw];
  // Troisième axe, pour compter les longitudes vers l'est.
  const y = cross(pole, x);
  // Latitude et longitude de la direction du Soleil dans ce repère.
  return { lat: Math.asin(Math.max(-1, Math.min(1, dot(d, pole)))) * DEG, lon: wrap180(Math.atan2(dot(d, y), dot(d, x)) * DEG) };
// Fin de subSolarFromIau.
}

/**
 * Point sous-solaire de la Lune, par les lois de Cassini.
 * Mêmes rotations que la scène 3D (voir engine.updateMoon) : rotation de la longitude moyenne autour de l'axe
 * des pôles, puis inclinaison de 1,5427° autour du nœud de l'orbite.
 */
export function subSolarMoon(toSunEcliptic: Vec3, meanLonDeg: number, nodeDeg: number): SubSolarPoint {
  // La direction, dans le repère de la scène (x, z, −y de l'écliptique), celui où les rotations sont écrites.
  const [ex, ey, ez] = unit(toSunEcliptic);
  const v: Vec3 = [ex, ez, -ey];
  // Axe du nœud de l'orbite, dans ce repère.
  const nodeEq = (nodeDeg + 180) * RAD;
  const axis: Vec3 = [Math.cos(nodeEq), 0, -Math.sin(nodeEq)];
  // Rotation inverse de l'inclinaison de l'équateur lunaire, autour de cet axe.
  const a = rotateAround(v, axis, -MOON_EQUATOR_TILT * RAD);
  // Rotation inverse de la rotation propre, autour de l'axe des pôles de la scène.
  const b = rotateAround(a, [0, 1, 0], -(meanLonDeg + 180) * RAD);
  // Latitude et longitude dans le repère sélénographique, même convention que la scène.
  return { lat: Math.asin(Math.max(-1, Math.min(1, b[1] / (len(b) || 1)))) * DEG, lon: wrap180(Math.atan2(-b[2], b[0]) * DEG) };
// Fin de subSolarMoon.
}

/** Rotation d'un vecteur autour d'un axe unitaire, d'un angle en radians (formule de Rodrigues). */
export function rotateAround(v: Vec3, axis: Vec3, angle: number): Vec3 {
  // Axe ramené à la longueur 1.
  const k = unit(axis);
  // Cosinus et sinus de l'angle.
  const c = Math.cos(angle), s = Math.sin(angle);
  // Produit vectoriel et produit scalaire.
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  // Le vecteur tourné.
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
// Fin de rotateAround.
}

/** Direction Mars → Soleil dans l'écliptique J2000, à l'instant donné. */
export function marsToSun(ms: number): Vec3 {
  // Les éléments de Mars.
  const mars = PLANETS.find((p) => p.name === 'Mars')!;
  // Position héliocentrique, dont la direction opposée pointe vers le Soleil.
  const p = heliocentric(mars.elements, centuriesTT(ms));
  // La direction.
  return unit([-p[0], -p[1], -p[2]]);
// Fin de marsToSun.
}

/** Direction Lune → Soleil dans l'écliptique J2000, à l'instant donné. */
export function moonToSun(ms: number): Vec3 {
  // Siècles de Temps terrestre.
  const T = centuriesTT(ms);
  // Les éléments de la Terre.
  const earth = PLANETS.find((p) => p.earth)!;
  // Position du centre de la Terre, en UA.
  const e = earthPosition(earth.elements, T);
  // Vecteur Terre → Lune, converti en UA.
  const m = moonVector(T).map((v) => v / AU_KM) as Vec3;
  // Position héliocentrique de la Lune, dont la direction opposée pointe vers le Soleil.
  return unit([-(e[0] + m[0]), -(e[1] + m[1]), -(e[2] + m[2])]);
// Fin de moonToSun.
}

/** Point sous-solaire de Mars à l'instant donné. */
export function marsSubSolar(ms: number): SubSolarPoint {
  // Siècles et jours de Temps terrestre depuis J2000.
  const T = centuriesTT(ms);
  const d = T * 36_525;
  // Le point.
  return subSolarFromIau(marsToSun(ms), marsRotation(T, d));
// Fin de marsSubSolar.
}

/** Point sous-solaire de la Lune à l'instant donné. */
export function moonSubSolar(ms: number): SubSolarPoint {
  // Siècles de Temps terrestre.
  const T = centuriesTT(ms);
  // Longitude moyenne et nœud de l'orbite, qui orientent la Lune.
  const { meanLon, node } = moonGeocentric(T);
  // Le point.
  return subSolarMoon(moonToSun(ms), meanLon, node);
// Fin de moonSubSolar.
}

/** Point sous-solaire d'un astre géré, à l'instant donné. */
export const subSolarOf = (body: 'moon' | 'mars', ms: number): SubSolarPoint => (body === 'mars' ? marsSubSolar(ms) : moonSubSolar(ms));
