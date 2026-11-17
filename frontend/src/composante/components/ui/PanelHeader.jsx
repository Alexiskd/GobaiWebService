// Importe de MUI Box, IconButton (bouton icône), Stack (pile), Tooltip (infobulle) et Typography (texte).
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
// Importe les icônes de fermeture et de poignée.
import { CloseIcon, DragIndicatorIcon } from './icons';

/**
 * En-tête commun des fenêtres : poignée de déplacement (ou de tiroir sur mobile), surtitre, titre et actions.
 * `dragProps` (useDraggable) fait de tout l'en-tête la poignée ; `onClose` ajoute le bouton de fermeture.
 */
// Déclare et exporte le composant PanelHeader : surtitre, titre, ornement du titre, fermeture, actions, propriétés de déplacement, mode feuille, clic et styles.
export function PanelHeader({ kicker, title, titleAdornment, onClose, closeLabel = 'Fermer', actions, dragProps, sheet = false, onClick, sx }) {
  // Déplaçable si les propriétés de déplacement contiennent un gestionnaire d'appui.
  const draggable = Boolean(dragProps?.onPointerDown);
  // Début du rendu.
  return (
    // Ligne de l'en-tête (début de la balise).
    <Stack
      // Rendue en balise header.
      component="header"
      // Disposition horizontale.
      direction="row"
      // Éléments centrés verticalement.
      alignItems="center"
      // Espacement entre les éléments.
      spacing={1}
      // Pose les propriétés de déplacement sur tout l'en-tête.
      {...dragProps}
      // Gestionnaire de clic éventuel.
      onClick={onClick}
      // Début du style.
      sx={{
        // Position relative, marges intérieures (plus de place en haut en mode feuille), taille fixe.
        position: 'relative', px: 2, pt: sheet ? 2 : 1.5, pb: 1, flex: 'none',
        // Filet de séparation en bas.
        borderBottom: 1, borderColor: 'divider',
        // Curseur : main si déplaçable, pointeur si cliquable, normal sinon ; texte non sélectionnable ; gestes tactiles réservés au déplacement.
        cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default', userSelect: 'none', touchAction: draggable ? 'none' : 'auto',
        // Styles supplémentaires passés par le parent.
        ...sx,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* En mode feuille (début). */}
      {sheet && (
        // Petit trait centré en haut, décoratif : la poignée du tiroir.
        <Box aria-hidden="true" sx={{ position: 'absolute', top: 6, left: '50%', ml: '-18px', width: 36, height: 4, borderRadius: 2, bgcolor: 'text.disabled' }} />
      // Fin du mode feuille.
      )}
      {/* Si déplaçable : icône de poignée grisée, cachée aux lecteurs d'écran. */}
      {draggable && <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', ml: -1 }} aria-hidden="true" />}
      {/* Zone des titres, qui prend la largeur restante. */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Si un surtitre est donné : au style overline, couleur primaire. */}
        {kicker && <Typography variant="overline" color="primary" sx={{ display: 'block', lineHeight: 1.6 }}>{kicker}</Typography>}
        {/* Ligne du titre, qui passe à la ligne si elle manque de place. */}
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {/* Le titre, de niveau 2, en demi-gras, coupé n'importe où s'il est trop long. */}
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</Typography>
          {/* L'ornement du titre. */}
          {titleAdornment}
        {/* Fin de la ligne du titre. */}
        </Stack>
      {/* Fin de la zone des titres. */}
      </Box>
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
    </Stack>
  // Fin du rendu.
  );
// Fin de PanelHeader.
}
