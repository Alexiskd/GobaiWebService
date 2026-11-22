/**
 * cx : réunit des morceaux de classes CSS en une seule chaîne, en sautant les valeurs vides
 * (false, null, undefined, '') — `cx('a', actif && 'b')` donne « a » ou « a b ».
 */
// Déclare et exporte cx : reçoit les morceaux.
export function cx(...parts) {
  // Chaîne construite.
  let out = '';
  // Pour chaque morceau non vide : l'ajoute, séparé par une espace.
  for (const p of parts) if (p) out += (out ? ' ' : '') + p;
  // Renvoie la chaîne.
  return out;
// Fin de cx.
}
