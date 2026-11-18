// Importe la nature d'une icône, calculée dans un module sans JSX pour être testable.
import { iconKind } from './iconKind';

/**
 * Icône d'une action de la barre d'outils, dessinée selon sa nature (voir iconKind) :
 *  - un composant d'icône MUI (ui/icons) : instancié à la taille demandée, il hérite de la couleur du bouton ;
 *  - un élément React déjà construit : rendu tel quel ;
 *  - un objet { img } : une image du dossier public, à la même taille (le logo de Claude) ;
 *  - un caractère : rendu tel quel, pour les libellés qui ne sont pas des icônes (la lettre « N »).
 */
// Déclare et exporte iconNode : reçoit l'icône et sa taille en pixels (18 par défaut).
export function iconNode(icon, size = 18) {
  // Selon la nature de l'icône.
  switch (iconKind(icon)) {
    // Un composant : instancié à la taille demandée, la couleur venant du bouton.
    case 'composant': {
      // Le composant, nommé pour être employé comme balise.
      const Icon = icon;
      // Rendu en bloc.
      return <Icon sx={{ fontSize: size, display: 'block' }} />;
    // Fin du cas « composant ».
    }
    // Une image du dossier public : une balise img de cette taille, sans texte alternatif (décorative).
    case 'image':
      // La balise.
      return <img src={icon.img} alt="" width={size} height={size} style={{ display: 'block' }} />;
    // Un élément déjà construit, ou du texte : rendu tel quel.
    default:
      // L'icône telle quelle.
      return icon;
  // Fin du choix.
  }
// Fin de iconNode.
}
