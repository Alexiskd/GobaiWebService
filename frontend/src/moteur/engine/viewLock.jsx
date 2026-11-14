// Verrouillage de la vue sur l'astre le plus proche de l'astre focus : calculs purs (testés dans viewLock.test.jsx).
//
// Deux astres à ne pas confondre :
//   - l'astre focus : celui autour duquel la caméra tourne et vers lequel le zoom avance ;
//   - l'astre verrouillé : le plus proche de l'astre focus (la Lune pour la Terre, la Terre pour la Lune, Io pour
//     Jupiter…), que la caméra regarde tant que le verrouillage est actif.
// Le verrouillage ne change que la direction du regard : la caméra reste sur son orbite autour de l'astre focus.

/**
 * Indice de l'astre le plus proche de l'astre `focus`, ou −1.
 * @param {Array<{x:number,y:number,z:number}|null>} positions position de chaque astre (null = astre masqué, ignoré)
 * @param {number} focus indice de l'astre focus
 */
// Déclare et exporte nearestIndex : les positions des astres et l'indice de l'astre focus.
export function nearestIndex(positions, focus) {
  // La position de l'astre focus.
  const f = positions[focus];
  // Sans position : -1.
  if (!f) return -1;
  // Meilleur indice et meilleure distance au carré trouvés.
  let best = -1, bestD = Infinity;
  // Parcourt les astres.
  positions.forEach((p, i) => {
    // Astre masqué, ou l'astre focus lui-même : ignoré.
    if (!p || i === focus) return;
    // Carré de la distance à l'astre focus.
    const d = (p.x - f.x) ** 2 + (p.y - f.y) ** 2 + (p.z - f.z) ** 2;
    // Plus proche que le meilleur : il le remplace.
    if (d < bestD) { bestD = d; best = i; }
  // Fin du parcours.
  });
  // Renvoie le meilleur indice.
  return best;
// Fin de nearestIndex.
}

/** État de la caméra à retrouver quand le verrouillage est retiré. */
// Déclare et exporte la liste des réglages de caméra à garder.
export const LOCK_SAVED_KEYS = ['az', 'el', 'dist', 'distGoal', 'heading', 'headingGoal', 'pilotTilt', 'tiltV'];

/** Copie des réglages de caméra de `engine` listés dans LOCK_SAVED_KEYS. */
// Déclare et exporte saveCamera : reçoit le moteur.
export function saveCamera(engine) {
  // Renvoie un objet avec la valeur de chaque réglage listé.
  return Object.fromEntries(LOCK_SAVED_KEYS.map((k) => [k, engine[k]]));
// Fin de saveCamera.
}
