// Repères des astres (point + nom) : masqués quand l'astre est caché derrière un autre astre, vu de la caméra.
// Fonctions pures, sans three.js (testées dans labelOcclusion.test.jsx). Positions : { x, y, z } en unités de scène.

/**
 * Vrai si l'astre `target` est caché par la sphère `occluder` : la ligne de visée caméra → centre de la cible
 * traverse l'occulteur avant d'atteindre la cible. Un occulteur qui paraît plus petit que la cible ne la cache pas
 * (une lune qui passe devant sa planète), et la caméra à l'intérieur de l'occulteur ne compte pas (géante gazeuse
 * traversée).
 * @param {{x,y,z}} cam
 * @param {{ pos: {x,y,z}, radius: number }} target
 * @param {{ pos: {x,y,z}, radius: number }} occluder
 */
// Déclare et exporte hiddenBehind : la caméra, la cible et l'occulteur.
export function hiddenBehind(cam, target, occluder) {
  // Vecteur de la caméra à la cible.
  const dx = target.pos.x - cam.x, dy = target.pos.y - cam.y, dz = target.pos.z - cam.z;
  // Distance de la caméra à la cible.
  const dist = Math.hypot(dx, dy, dz);
  // Distance nulle ou illisible : non cachée.
  if (!(dist > 0)) return false;
  // Vecteur de la caméra à l'occulteur.
  const ox = occluder.pos.x - cam.x, oy = occluder.pos.y - cam.y, oz = occluder.pos.z - cam.z;
  // Carré de la distance de la caméra à l'occulteur.
  const oDist2 = ox * ox + oy * oy + oz * oz;
  // Rayon de l'occulteur.
  const r = occluder.radius;
  // Caméra dans l'occulteur : non cachée.
  if (oDist2 <= r * r) return false;                       // caméra dans l'occulteur
  // Projection du centre de l'occulteur sur la ligne de visée.
  const along = (ox * dx + oy * dy + oz * dz) / dist;      // distance, le long de la visée, du point le plus proche du centre de l'occulteur
  // Occulteur derrière la caméra ou au-delà de la cible : non cachée.
  if (along <= 0 || along >= dist) return false;           // occulteur derrière la caméra, ou plus loin que la cible
  // La ligne de visée ne traverse pas l'occulteur : non cachée.
  if (oDist2 - along * along >= r * r) return false;       // la visée passe à côté
  // Cachée seulement si l'occulteur paraît plus grand que la cible.
  return r * dist > target.radius * Math.sqrt(oDist2);     // l'occulteur paraît plus grand que la cible
// Fin de hiddenBehind.
}

/** Vrai si `target` est caché derrière l'un des `bodies` (lui-même et les astres non dessinés sont ignorés). */
// Déclare et exporte hiddenByAny : la caméra, la cible et les astres.
export function hiddenByAny(cam, target, bodies) {
  // Pour chaque astre.
  for (const body of bodies) {
    // S'il n'est ni la cible ni masqué, et qu'il cache la cible : vrai.
    if (body !== target && !body.isHidden?.() && hiddenBehind(cam, target, body)) return true;
  // Fin du parcours.
  }
  // Aucun astre ne la cache : faux.
  return false;
// Fin de hiddenByAny.
}
