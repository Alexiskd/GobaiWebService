/**
 * Champ gravitationnel des astres, pour l'affichage Schwarzschild (bouton E = mc²) : calcul pur, sans three.js.
 *
 * Deux usages :
 *  - la sphère translucide d'un astre prend le rayon de sa sphère de Hill, la région où sa gravité l'emporte sur
 *    celle de l'astre autour duquel il tourne. Un astre lourd et loin de son parent a une grande sphère ; un astre
 *    léger ou proche en a une petite : c'est son « poids dans l'espace » ;
 *  - la « toupie » d'un système (le Soleil, une planète qui a des satellites) est son puits de gravité : la surface
 *    de Flamm de la métrique de Schwarzschild, dont la profondeur dépend de la masse de l'astre central.
 */

// Importe les masses des astres (mesurées, ou estimées d'après le rayon) : la table que le moteur emploie déjà.
import { BODY_MASS_KG, bodyMassKg } from '../../AstreSolideEngine/gravityMath.jsx';
// Importe le rayon de la sphère de Hill, déjà employé pour la vue « système » du téléphone.
import { hillRadius } from '../../AstreSolideEngine/systemView.jsx';

// Réexporte ces trois outils : tout le champ gravitationnel de l'affichage se lit depuis ce module.
export { BODY_MASS_KG, bodyMassKg, hillRadius };

/** Constante de gravitation (m³·kg⁻¹·s⁻²). */
export const G = 6.6743e-11;
/** Vitesse de la lumière (m/s). */
export const C_LIGHT = 299792458;

/**
 * Rayon de la sphère translucide d'un astre, dans l'unité de `distance` : sa sphère de Hill, jamais plus petite
 * que `minimum` (une fois et demie le rayon de l'astre, pour que la sphère reste visible autour de lui).
 *  distance : demi-grand axe de l'orbite autour du parent ; massKg : l'astre ; parentMassKg : son parent.
 */
export function gravitySphereRadius({ distance, massKg, parentMassKg, minimum = 0 }) {
  return Math.max(hillRadius(distance, massKg, parentMassKg), minimum);
}

/** Rayon de Schwarzschild d'une masse (m) : 2GM / c². Environ 2,95 km pour le Soleil, 8,9 mm pour la Terre. */
export function schwarzschildRadiusOfMass(massKg) {
  return massKg > 0 ? (2 * G * massKg) / (C_LIGHT * C_LIGHT) : 0;
}

/**
 * Profondeur du puits de gravité à la distance r du centre (surface de Flamm), mesurée depuis le bord extérieur :
 * −exagération × 2 × (√(rs × R) − √(rs × r)). Tout en mètres ; négative vers le centre, nulle au bord.
 */
export function wellDepthM(rM, outerM, rsM, exaggeration) {
  const inner = 2 * Math.sqrt(rsM * Math.max(rM, rsM));
  const outer = 2 * Math.sqrt(rsM * Math.max(outerM, rsM));
  return exaggeration * (inner - outer);
}

/**
 * Géométrie filaire de la toupie d'un système : anneaux et rayons du puits de gravité de l'astre central, doublés
 * par symétrie de part et d'autre du plan (deux toupies recollées bord à bord), comme la grille du Soleil.
 *  outer, inner : rayon extérieur (le système) et intérieur (la surface de l'astre), en unités de scène ;
 *  unitM : longueur d'une unité de scène en mètres ; massKg : masse de l'astre central ;
 *  exaggeration : la même que celle de la grille du Soleil, pour que les profondeurs se comparent d'un système à l'autre.
 * @returns {Float32Array} 6 nombres par segment (deux points x, y, z), en unités de scène, centrés sur l'astre.
 */
export function systemWellSegments({ outer, inner, unitM, massKg, exaggeration, rings = 14, spokes = 32 }) {
  if (!(outer > 0) || !(unitM > 0) || !(massKg > 0)) return new Float32Array(0);
  const rsM = schwarzschildRadiusOfMass(massKg);
  const floor = Math.min(Math.max(inner || 0, outer * 1e-4), outer);
  // Anneaux resserrés vers le centre (répartition quadratique), là où la pente est la plus forte.
  const radii = [];
  for (let i = 1; i <= rings; i++) radii.push(Math.max(floor, outer * (i / rings) ** 2));
  const y = (r) => wellDepthM(r * unitM, outer * unitM, rsM, exaggeration) / unitM;
  const segs = [];
  // Les anneaux : des cercles à la profondeur du puits.
  for (const r of radii) {
    const h = y(r);
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * 2 * Math.PI, a1 = ((i + 1) / spokes) * 2 * Math.PI;
      segs.push(Math.cos(a0) * r, h, Math.sin(a0) * r, Math.cos(a1) * r, h, Math.sin(a1) * r);
    }
  }
  // Les rayons : ils suivent la pente du puits d'un anneau au suivant.
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 1; j < radii.length; j++) {
      segs.push(ca * radii[j - 1], y(radii[j - 1]), sa * radii[j - 1], ca * radii[j], y(radii[j]), sa * radii[j]);
    }
  }
  // Le double : la même toupie retournée (y inversé).
  const single = new Float32Array(segs);
  const doubled = new Float32Array(single.length * 2);
  doubled.set(single, 0);
  for (let i = 0; i < single.length; i += 3) {
    doubled[single.length + i] = single[i];
    doubled[single.length + i + 1] = -single[i + 1];
    doubled[single.length + i + 2] = single[i + 2];
  }
  return doubled;
}

/**
 * Les systèmes qui portent une toupie : chaque planète autour de laquelle tourne au moins un satellite.
 *  satellites : [{ parent, distance }] — identifiant de la planète mère et distance à elle, en unités de scène.
 * Renvoie une table { identifiant de la planète → distance du satellite le plus lointain }.
 * Mercure et Vénus n'ont pas de satellite : pas de toupie. Un satellite (la Lune) n'en porte pas non plus.
 */
export function systemExtents(satellites = []) {
  const out = new Map();
  for (const s of satellites) {
    if (!s || typeof s.parent !== 'string' || !(s.distance > 0)) continue;
    out.set(s.parent, Math.max(out.get(s.parent) || 0, s.distance));
  }
  return out;
}
