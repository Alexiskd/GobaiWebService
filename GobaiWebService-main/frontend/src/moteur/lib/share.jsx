// Partage de la vue en cours : feuille de partage du téléphone (iOS, Android) quand le navigateur la propose,
// sinon copie du lien dans le presse-papiers (ordinateur).

/** Texte partagé : le nom de l'app n'est jamais traduit. */
// Fonction shareData.
export function shareData({ bodyName = null, url }) {
  // Titre : le nom de l'astre et celui de l'application, ou le titre général.
  const title = bodyName ? `${bodyName} · Go白ناन्टех` : 'Go白ناन्टех · système solaire 3D';
  // Texte : avec le nom de l'astre, ou le texte général.
  const text = bodyName ? `${bodyName} en 3D et en direct` : 'Le système solaire en 3D et en direct';
  // Renvoie le titre, le texte et l'adresse.
  return { title, text, url };
// Fin de shareData.
}

/**
 * Partage `data` ({ title, text, url }). Renvoie 'shared' (feuille de partage), 'copied' (lien copié),
 * 'cancelled' (feuille fermée sans partager) ou 'failed' (ni partage ni presse-papiers).
 */
// Fonction shareView ; le navigateur par défaut.
export async function shareView(data, nav = globalThis.navigator) {
  // Si le navigateur a une feuille de partage :
  if (typeof nav?.share === 'function') {
    // essaie
    try {
      // de partager ;
      await nav.share(data);
      // réussi : « shared ».
      return 'shared';
    // En cas d'échec :
    } catch (e) {
      // feuille fermée : « cancelled ».
      if (e?.name === 'AbortError') return 'cancelled';
      // Partage refusé par le navigateur : on tente la copie du lien.
    // Fin du cas.
    }
  // Fin du cas.
  }
  // Essaie
  try {
    // de copier le lien ;
    await nav.clipboard.writeText(data.url);
    // réussi : « copied ».
    return 'copied';
  // En cas d'échec :
  } catch {
    // « failed ».
    return 'failed';
  // Fin du cas.
  }
// Fin de shareView.
}
