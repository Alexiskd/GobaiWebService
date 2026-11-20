// Zoom d'arrivée : la caméra, déjà à la verticale du lieu, part de haut et descend d'un seul mouvement jusqu'à
// l'altitude visée. L'altitude (distance au centre − rayon) est interpolée en échelle logarithmique : la vitesse
// perçue du zoom reste la même du globe entier jusqu'au sol. Fonctions pures, distances en rayons de l'astre.

/** Distance de départ minimale : ≈ 10 000 km d'altitude au-dessus de la Terre, le globe entier est à l'écran. */
// Distance de départ minimale du zoom d'arrivée, en rayons de l'astre.
export const FLIGHT_START_DISTANCE = 2.6;
// Durée minimale du zoom, en millisecondes.
export const FLIGHT_MIN_MS = 1800;
// Durée maximale du zoom, en millisecondes.
export const FLIGHT_MAX_MS = 4500;

// clamp : borne une valeur entre un minimum et un maximum.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// easeInOut : progression douce au départ et à l'arrivée (courbe cubique).
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2);

/**
 * Plan du zoom : de `dist` (distance actuelle de la caméra, relevée à FLIGHT_START_DISTANCE si elle est plus basse)
 * jusqu'à `goal`. Durée : 600 ms par facteur 10 d'altitude, entre 1,8 et 4,5 s. null si le zoom n'a pas de sens.
 */
// Déclare et exporte flightPlan : la distance actuelle, la distance visée et le rayon de l'astre (1 par défaut).
export function flightPlan(dist, goal, radius = 1) {
  // But sous la surface, distance ou rayon non positifs : pas de plan.
  if (!(goal > radius) || !(dist > 0) || !(radius > 0)) return null;
  // Départ : la distance actuelle, relevée au minimum de départ.
  const from = Math.max(dist, FLIGHT_START_DISTANCE * radius);
  // Départ plus bas que le but : pas de plan.
  if (!(from > goal)) return null;
  // Nombre de facteurs 10 entre l'altitude de départ et l'altitude visée.
  const decades = Math.log10((from - radius) / (goal - radius));
  // Renvoie le plan : départ, arrivée, rayon et durée (600 ms par facteur 10, bornée).
  return { from, to: goal, radius, ms: clamp(600 * decades, FLIGHT_MIN_MS, FLIGHT_MAX_MS) };
// Fin de flightPlan.
}

/** Distance de la caméra à l'instant `t` (ms depuis le départ) : départ et arrivée en douceur. */
// Déclare et exporte flightDistance : le plan et le temps écoulé.
export function flightDistance(plan, t) {
  // Avancement, de 0 à 1.
  const k = clamp(t / plan.ms, 0, 1);
  // Terminé : la distance visée.
  if (k >= 1) return plan.to;
  // Altitudes de départ et d'arrivée.
  const a0 = plan.from - plan.radius, a1 = plan.to - plan.radius;
  // Altitude interpolée en échelle logarithmique, avec la progression douce, plus le rayon.
  return plan.radius + a0 * (a1 / a0) ** easeInOut(k);
// Fin de flightDistance.
}
