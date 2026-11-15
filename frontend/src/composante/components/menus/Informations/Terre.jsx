// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe la ligne d'état de la Terre.
import { EarthStatus } from './EarthStatus';

/**
 * Menu « Terre » : état du chargement de sa couche unique. La Terre n'a plus de fonds de carte à choisir : sa seule
 * couche fusionne toutes les sources d'imagerie, et son entrée (avec son bouton de téléchargement) est dans
 * Paramètres › Cartographie, avec les calques.
 */
// Déclare et exporte le composant Terre : HUD, statut et erreur de la liste des couches.
export function Terre({ hud, listStatus, listError }) {
  // Début du rendu.
  return (
    // Fragment : regroupe la note et la ligne d'état.
    <>
      {/* Où se trouvent la couche et son téléchargement. */}
      <Hint>Une seule couche fusionne toutes les sources d’imagerie. Son téléchargement et les calques sont dans Paramètres › Cartographie.</Hint>
      {/* La ligne d'état de la Terre. */}
      <EarthStatus hud={hud} listStatus={listStatus} listError={listError} />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Terre.
}
