/**
 * Clic sur un système : quel astre viser ? Calcul pur, sans three.js.
 *
 * Dans l'affichage Schwarzschild (bouton E = mc²), chaque astre est un système, dessiné par sa sphère d'influence
 * et sa toupie. Un clic qui ne tombe sur aucun astre mais traverse la sphère d'un système vise l'astre principal
 * de ce système, c'est-à-dire celui qui est au centre de la sphère.
 * Quand le rayon du clic traverse plusieurs sphères emboîtées (la Lune dans le système de la Terre), la plus petite
 * l'emporte : c'est le système le plus précis sous le pointeur.
 */

/**
 * Le rayon du clic traverse-t-il la sphère, devant la caméra ?
 *  origin, direction : le rayon (direction normalisée) ; center, radius : la sphère. Mêmes unités, même repère.
 * Vrai aussi quand l'origine est dans la sphère : le rayon en sort forcément devant.
 */
export function rayHitsSphere(origin, direction, center, radius) {
  if (!(radius > 0)) return false;
  const ox = center[0] - origin[0], oy = center[1] - origin[1], oz = center[2] - origin[2];
  // Distance, le long du rayon, du point le plus proche du centre.
  const along = ox * direction[0] + oy * direction[1] + oz * direction[2];
  // Carré de la distance du centre au rayon.
  const off2 = ox * ox + oy * oy + oz * oz - along * along;
  const r2 = radius * radius;
  if (off2 > r2) return false;
  // Sortie de la sphère : devant la caméra ?
  return along + Math.sqrt(r2 - off2) > 0;
}

/**
 * Le système visé par un clic : parmi les sphères traversées, la plus petite. Null si aucune.
 *  systems : [{ id, center: [x, y, z], radius, ... }] ; l'entrée choisie est rendue telle quelle.
 * Un système dans lequel la caméra se trouve déjà est ignoré : de l'intérieur, tout clic traverse sa sphère, et il
 * masquerait les systèmes plus grands que l'on vise au loin (Jupiter vu depuis le système de la Terre).
 */
export function pickSystem(origin, direction, systems = []) {
  let best = null;
  for (const system of systems) {
    if (!system || !Array.isArray(system.center)) continue;
    const dx = system.center[0] - origin[0], dy = system.center[1] - origin[1], dz = system.center[2] - origin[2];
    if (dx * dx + dy * dy + dz * dz <= system.radius * system.radius) continue;
    if (!rayHitsSphere(origin, direction, system.center, system.radius)) continue;
    if (!best || system.radius < best.radius) best = system;
  }
  return best;
}
