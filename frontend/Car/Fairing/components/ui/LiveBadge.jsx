// Importe cx, qui réunit les classes.
import { cx } from '@/Fairing/kit';

/**
 * Badge « En direct » : pastille rouge, posée après le nom de l'app. Son point pulse (classe `g-live` de
 * theme/app.css : l'animation est dans la feuille de style, rien n'est calculé au rendu).
 * `className` ajuste sa place selon l'endroit où il est posé.
 */
// Déclare et exporte le composant LiveBadge.
export function LiveBadge({ className }) {
  // Rend le badge ; `translate="yes"` : son texte peut être traduit par le navigateur.
  return <span translate="yes" className={cx('g-live', className)}>En direct</span>;
// Fin de LiveBadge.
}

// Export par défaut.
export default LiveBadge;
