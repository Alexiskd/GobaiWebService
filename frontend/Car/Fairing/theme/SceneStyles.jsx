// Importe le crochet d'effet de React.
import { useEffect } from 'react';
// La feuille de style des éléments que le moteur 3D pose lui-même dans la page (repères, noms, fiche d'une ville,
// point de l'utilisateur) est `scene.css`, une feuille statique importée par les points d'entrée (main.jsx et
// Computing/embed/main.jsx) : plus aucun style n'est fabriqué au montage.

// Les éléments où la sélection de texte reste permise sur écran tactile.
const EDITABLE = 'input, textarea, [contenteditable="true"]';

/**
 * Habillage de la scène : avec la feuille `scene.css`, ce composant ajoute, sur écran tactile, le blocage de la
 * sélection de texte et du menu contextuel hors des champs de saisie (un appui long ne doit rien sélectionner).
 * Ne rend rien.
 */
// Déclare et exporte le composant SceneStyles.
export function SceneStyles() {
  // Effet exécuté une seule fois : pose les deux écouteurs sur écran tactile.
  useEffect(() => {
    // Souris ou pavé tactile : rien à bloquer.
    if (!window.matchMedia?.('(pointer: coarse)').matches) return undefined;
    // block : annule l'événement hors d'un champ de saisie.
    const block = (e) => { if (!e.target?.closest?.(EDITABLE)) e.preventDefault(); };
    // Début de sélection et menu contextuel.
    document.addEventListener('selectstart', block);
    document.addEventListener('contextmenu', block);
    // Nettoyage : retire les deux écouteurs.
    return () => {
      document.removeEventListener('selectstart', block);
      document.removeEventListener('contextmenu', block);
    };
  // Fin de l'effet ; aucune dépendance.
  }, []);
  // Rien à afficher.
  return null;
// Fin de SceneStyles.
}
