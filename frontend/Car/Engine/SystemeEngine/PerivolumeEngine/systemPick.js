/**
 * Clic sur un système : quel astre viser ? Calcul pur, sans three.js.
 *
 * Dans l'affichage Schwarzschild (bouton E = mc²), chaque astre est un système, dessiné par sa sphère d'influence
 * et sa toupie. Un clic qui ne tombe sur aucun astre mais traverse la sphère d'un système vise l'astre principal
 * de ce système, c'est-à-dire celui qui est au centre de la sphère.
 * Quand le rayon du clic traverse plusieurs sphères emboîtées (Ganymède dans le système de Jupiter, la Lune dans
 * celui de la Terre), la plus grande l'emporte : un clic sur le système de Jupiter vise Jupiter, l'astre le plus gros
 * du système, et non le satellite dont la petite sphère se trouvait sous le pointeur. Les satellites se visent en
 * cliquant sur eux, ou dans le rail des astres.
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
 * Distance, le long du rayon, à laquelle il entre dans la sphère (0 si l'origine est dedans), ou Infinity s'il la
 * manque. Mêmes conventions que rayHitsSphere.
 */
export function rayEntry(origin, direction, center, radius) {
  if (!(radius > 0)) return Infinity;
  const ox = center[0] - origin[0], oy = center[1] - origin[1], oz = center[2] - origin[2];
  const along = ox * direction[0] + oy * direction[1] + oz * direction[2];
  const off2 = ox * ox + oy * oy + oz * oz - along * along;
  const r2 = radius * radius;
  if (off2 > r2) return Infinity;
  const half = Math.sqrt(r2 - off2);
  if (along + half <= 0) return Infinity;
  return Math.max(0, along - half);
}

/**
 * Le système visé par un clic, null si aucun.
 *  systems : [{ id, center: [x, y, z], radius, ... }] ; l'entrée choisie est rendue telle quelle.
 *
 * 1. Parmi les sphères traversées, la première rencontrée par le rayon : le système le plus proche sous le pointeur
 *    (Mars devant Jupiter vise Mars).
 * 2. Si cette sphère est emboîtée dans une sphère plus grande, elle aussi traversée (Ganymède dans Jupiter), on
 *    remonte à la plus grande : son astre principal est le plus gros du système.
 *
 * Un système dans lequel la caméra se trouve déjà est ignoré : de l'intérieur, tout clic traverse sa sphère, et il
 * masquerait les systèmes que l'on vise au loin (Jupiter vu depuis le système de la Terre).
 */
export function pickSystem(origin, direction, systems = []) {
  const hits = [];
  for (const system of systems) {
    if (!system || !Array.isArray(system.center) || !(system.radius > 0)) continue;
    const dx = system.center[0] - origin[0], dy = system.center[1] - origin[1], dz = system.center[2] - origin[2];
    if (dx * dx + dy * dy + dz * dz <= system.radius * system.radius) continue;
    const t = rayEntry(origin, direction, system.center, system.radius);
    if (t < Infinity) hits.push({ system, t });
  }
  if (!hits.length) return null;
  let best = hits.reduce((a, b) => (b.t < a.t ? b : a)).system;
  // Remonte aux systèmes englobants : une sphère plus grande, traversée, qui contient le centre de la sphère retenue.
  for (let changed = true; changed;) {
    changed = false;
    for (const { system } of hits) {
      if (system.radius <= best.radius) continue;
      const dx = system.center[0] - best.center[0], dy = system.center[1] - best.center[1], dz = system.center[2] - best.center[2];
      if (dx * dx + dy * dy + dz * dz < system.radius * system.radius) { best = system; changed = true; }
    }
  }
  return best;
}
