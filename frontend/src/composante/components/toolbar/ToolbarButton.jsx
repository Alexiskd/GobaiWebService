// Importe iconNode, qui dessine l'icône d'une action.
import { iconNode } from './iconNode';
// Importe de MUI Box, Button, IconButton, les éléments d'entrée de menu et Tooltip (infobulle).
import { Box, Button, IconButton, ListItemIcon, ListItemText, MenuItem, Tooltip } from '@mui/material';

// Déclare le composant Icon : reçoit le contenu et la taille (15 par défaut).
const Icon = ({ children, size = 15 }) => (
  // Balise span décorative, de largeur fixe, au contenu centré.
  <Box component="span" aria-hidden="true" sx={{ fontSize: size, lineHeight: 1, width: '1.2em', textAlign: 'center' }}>{children}</Box>
// Fin de Icon.
);

/**
 * Bouton de la barre d’outils : icône + libellé (complet sur ordinateur, court sur mobile), état « enfoncé » en
 * couleur primaire. Dans le menu « Plus » du mobile, il devient une entrée de menu.
 * Les bascules de caméra (Ombre, Rotation, Vue 3/4) sont passées en icône seule pour raccourcir la barre : leur
 * libellé reste dans l'infobulle et sur la feuille du mobile, et l'état enfoncé se lit au fond plein.
 */
// Déclare et exporte le composant ToolbarButton : l'action, le mode compact, le mode menu et le rappel de choix.
export function ToolbarButton({ action, compact, inMenu = false, onPick }) {
  // État enfoncé : indéfini si l'action n'est pas une bascule, booléen sinon.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Propriétés communes aux trois formes du bouton (début de l'objet).
  const common = {
    // État enfoncé pour les lecteurs d'écran, sauf dans un menu.
    'aria-pressed': inMenu ? undefined : pressed,
    // Nom du bouton pour les lecteurs d'écran.
    'aria-label': action.label,
    // Marqueur data-no-sound si l'action ne doit pas faire de son.
    'data-no-sound': action.noSound ? '' : undefined,
    // Désactivation éventuelle.
    disabled: action.disabled,
    // L'événement est transmis : un bouton qui ouvre un menu déroulant s'en sert comme point d'ancrage.
    // Au clic : appelle l'action avec l'événement, puis, dans un menu, signale le choix.
    onClick: (e) => { action.onClick?.(e); if (inMenu) onPick?.(); },
  // Fin de l'objet.
  };

  // Première forme : dans un menu.
  if (inMenu) {
    // Début du rendu.
    return (
      // Entrée de menu, sélectionnée si l'action est enfoncée, avec infobulle.
      <MenuItem {...common} selected={Boolean(pressed)} title={action.title}>
        {/* L'icône de l'entrée. */}
        <ListItemIcon><Icon>{iconNode(action.icon)}</Icon></ListItemIcon>
        {/* Le libellé de l'entrée. */}
        <ListItemText primary={action.label} />
      {/* Fin de l'entrée de menu. */}
      </MenuItem>
    // Fin du rendu.
    );
  // Fin de la première forme.
  }

  // Deuxième forme : icône seule, sur ordinateur.
  if (!compact && action.iconOnly) {
    // Début du rendu.
    return (
      // Infobulle : le titre de l'action, son libellé à défaut.
      <Tooltip title={action.title || action.label}>
        {/* Balise span : l'infobulle fonctionne même quand le bouton est désactivé. */}
        <span>
          {/* Bouton icône de 32 px ; enfoncé, il se remplit de la couleur primaire comme le faisait le bouton à
              libellé, pour que l'état d'une bascule reste lisible sans son libellé. */}
          <IconButton
            // Les propriétés communes.
            {...common}
            // Couleur primaire s'il est enfoncé.
            color={pressed ? 'primary' : 'default'}
            // Carré de 32 px ; fond plein et icône contrastée s'il est enfoncé, fond conservé au survol.
            sx={{ width: 32, height: 32, ...(pressed ? { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } } : null) }}
          // Fin de la balise ouvrante.
          >
            {/* L'icône. */}
            <Icon>{iconNode(action.icon)}</Icon>
          {/* Fin du bouton icône. */}
          </IconButton>
        {/* Fin de la balise span. */}
        </span>
      {/* Fin de l'infobulle. */}
      </Tooltip>
    // Fin du rendu.
    );
  // Fin de la deuxième forme.
  }

  // Troisième forme : bouton avec libellé (début du rendu).
  return (
    // Infobulle, qui ne s'ouvre pas au survol en mode compact.
    <Tooltip title={action.title || ''} disableHoverListener={compact}>
      {/* Balise span en ligne ; toute la largeur en mode compact. */}
      <span style={{ display: 'inline-flex', minWidth: 0, width: compact ? '100%' : undefined }}>
        {/* Le bouton (début de la balise). */}
        <Button
          // Les propriétés communes.
          {...common}
          // Plein s'il est enfoncé, texte seul sinon.
          variant={pressed ? 'contained' : 'text'}
          // Couleur primaire s'il est enfoncé, couleur héritée sinon.
          color={pressed ? 'primary' : 'inherit'}
          // Sur ordinateur, l'icône est placée avant le libellé.
          startIcon={compact ? undefined : <Icon>{iconNode(action.icon)}</Icon>}
          // Style du mode compact (début).
          sx={compact ? {
            // Icône au-dessus du libellé, toute la largeur, très petit texte.
            flexDirection: 'column', gap: 0, minWidth: 0, width: '100%', py: 0.25, px: 0.5, fontSize: 10, lineHeight: 1.15,
          // Style de l'ordinateur : une seule ligne, 32 px de haut au moins, icône rapprochée du libellé.
          } : { whiteSpace: 'nowrap', px: 1, py: 0.25, minHeight: 32, fontSize: 12.5, '& .MuiButton-startIcon': { mr: 0.5 } }}
        // Fin de la balise ouvrante.
        >
          {/* En mode compact, l'icône un peu plus grande. */}
          {compact && <Icon size={17}>{iconNode(action.icon)}</Icon>}
          {/* Le libellé : court en mode compact s'il existe, complet sinon. */}
          {compact ? (action.short || action.label) : action.label}
        {/* Fin du bouton. */}
        </Button>
      {/* Fin de la balise span. */}
      </span>
    {/* Fin de l'infobulle. */}
    </Tooltip>
  // Fin du rendu.
  );
// Fin de ToolbarButton.
}
