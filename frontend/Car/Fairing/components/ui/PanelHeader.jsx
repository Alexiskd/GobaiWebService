// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { IconButton, Tooltip, cx } from '@/Fairing/kit';
// Importe les icônes de fermeture et de poignée.
import { CloseIcon, DragIndicatorIcon } from './icons.jsx';

/**
 * En-tête commun des fenêtres : poignée de déplacement (ou de tiroir sur mobile), surtitre, titre et actions.
 * `dragProps` (useDraggable) fait de tout l'en-tête la poignée ; `onClose` ajoute le bouton de fermeture.
 */
// Déclare et exporte le composant PanelHeader : surtitre, titre, ornement du titre, fermeture, actions, propriétés de déplacement, mode feuille, clic et styles.
export function PanelHeader({ kicker, title, titleAdornment, onClose, closeLabel = 'Fermer', actions, dragProps, sheet = false, onClick, className }) {
  // Déplaçable si les propriétés de déplacement contiennent un gestionnaire d'appui.
  const draggable = Boolean(dragProps?.onPointerDown);
  // Début du rendu.
  return (
    // Ligne de l'en-tête (début de la balise).
    <header
      // Pose les propriétés de déplacement sur tout l'en-tête.
      {...dragProps}
      // Gestionnaire de clic éventuel.
      onClick={onClick}
      // Début du style.
      className={cx('flex flex-row gap-2 items-center relative px-4 pb-2 flex-none border-b border-line select-none', sheet ? 'pt-4' : 'pt-3', draggable ? 'cursor-grab touch-none' : onClick ? 'cursor-pointer' : 'cursor-default', className)}
    // Fin de la balise ouvrante.
    >
      {/* En mode feuille (début). */}
      {sheet && (
        // Petit trait centré en haut, décoratif : la poignée du tiroir.
        <div aria-hidden="true" className="absolute top-1.5 left-1/2 ml-[-18px] w-9 h-1 rounded-full bg-faint" />
      // Fin du mode feuille.
      )}
      {/* Si déplaçable : icône de poignée grisée, cachée aux lecteurs d'écran. */}
      {draggable && <DragIndicatorIcon fontSize="small" className="text-faint -ml-2" aria-hidden="true" />}
      {/* Zone des titres, qui prend la largeur restante. */}
      <div className="flex-1 min-w-0">
        {/* Si un surtitre est donné : au style overline, couleur primaire. */}
        {kicker && <span className="t-overline text-primary block leading-[1.6]">{kicker}</span>}
        {/* Ligne du titre, qui passe à la ligne si elle manque de place. */}
        <div className="flex flex-row gap-2 items-center flex-wrap">
          {/* Le titre, de niveau 2, en demi-gras, coupé n'importe où s'il est trop long. */}
          <h2 className="t-subtitle1 font-semibold [overflow-wrap:anywhere]">{title}</h2>
          {/* L'ornement du titre. */}
          {titleAdornment}
        {/* Fin de la ligne du titre. */}
        </div>
      {/* Fin de la zone des titres. */}
      </div>
      {/* Les actions fournies par le parent. */}
      {actions}
      {/* Si une fermeture est prévue (début). */}
      {onClose && (
        // Infobulle du bouton.
        <Tooltip title={closeLabel}>
          {/* Petit bouton : ferme sans propager le clic à l'en-tête ; libellé pour les lecteurs d'écran. */}
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label={closeLabel}>
            {/* Icône de croix. */}
            <CloseIcon fontSize="small" />
          {/* Fin du bouton. */}
          </IconButton>
        {/* Fin de l'infobulle. */}
        </Tooltip>
      // Fin du bouton de fermeture.
      )}
    {/* Fin de l'en-tête. */}
    </header>
  // Fin du rendu.
  );
// Fin de PanelHeader.
}
