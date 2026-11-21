// Importe Hint, la note d'aide.
import { Hint } from '../../../ui/Hint.jsx';
// Importe la ligne d'état de la Terre.
import { EarthStatus } from './EarthStatus.jsx';

/**
 * Menu « Terre » : état du chargement de sa couche unique. Sa couche fusionne toutes les sources d'imagerie;
 * son entrée, les calques et les réglages sont regroupés dans le panneau Informations.
 */
// Déclare et exporte le composant Terre : HUD, statut et erreur de la liste des couches.
export function Terre({ hud, listStatus, listError }) {
  // Début du rendu.
  return (
    // Fragment : regroupe la note et la ligne d'état.
    <>
      {/* Rappel de la couche unique. */}
      <Hint>Une seule couche fusionne toutes les sources d’imagerie. Son téléchargement et ses réglages sont ci-dessous.</Hint>
      {/* La ligne d'état de la Terre. */}
      <EarthStatus hud={hud} listStatus={listStatus} listError={listError} />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Terre.
}
