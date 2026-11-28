// Remise à zéro, une seule fois, des anciens choix de calques gardés dans le navigateur.
// Depuis l'étape 2 du plan de refonte, tous les calques sont actifs en permanence et leurs interrupteurs ont disparu :
// un ancien « coupé » (relief, rues, lumières…) ne doit plus masquer un calque sans moyen de le rallumer.

/** Anciennes clés de choix de calques. */
// Déclare et exporte les anciennes clés.
export const OLD_LAYER_KEYS = ['gobai:relief-3d', 'gobai:relief-ocean', 'gobai:lumieres-nuit', 'gobai:rues', 'gobai:volcans'];
/** Clé qui note que la remise à zéro est faite. */
// Déclare et exporte la clé de la remise à zéro.
export const RESET_KEY = 'gobai:refonte-calques';

/**
 * Efface les anciennes clés une seule fois (sans effet ensuite, ni sans stockage). Renvoie vrai si elle a effacé.
 * @param {Storage|null} storage le stockage du navigateur (remplaçable dans les tests)
 */
// Déclare et exporte resetLayerChoices : le stockage (début).
export function resetLayerChoices(storage = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })()) {
  // Essai (stockage refusé : rien).
  try {
    // Pas de stockage, ou déjà fait : rien.
    if (!storage || storage.getItem(RESET_KEY) === '1') return false;
    // Anciennes clés effacées.
    for (const k of OLD_LAYER_KEYS) storage.removeItem(k);
    // Noté.
    storage.setItem(RESET_KEY, '1');
    // Fait.
    return true;
  // Stockage refusé.
  } catch { return false; }
// Fin de resetLayerChoices.
}

// Faite dès le chargement du module (avant la création du moteur et le premier rendu).
resetLayerChoices();
