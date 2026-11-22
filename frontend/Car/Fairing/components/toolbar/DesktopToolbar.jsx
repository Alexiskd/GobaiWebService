// Importe de MUI Divider (filet), Paper (carte), Stack (pile) et useMediaQuery (largeur de l'écran).
import { Divider, Paper, Stack, useMediaQuery } from '@mui/material';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe Readout, l'indicateur de zoom.
import { Readout } from '../hud/Readout.jsx';
// Importe ToolbarButton, le bouton d'action.
import { ToolbarButton } from './ToolbarButton.jsx';
// Ordre des blocs et leurs noms.
import { GROUP_LABELS, TOOLBAR_GROUPS } from './toolbarActions.jsx';

// Ordinateur / laptop : une seule ligne alignée, cinq blocs séparés (explorer, affichage, données, assistant, Node),
// indicateur de zoom intégré à gauche. Aucun bouton parent « Menu » : Données et Node sont des boutons directs, et les
// paramètres sont un onglet de la fenêtre Node.
// Déclare et exporte le composant DesktopToolbar : reçoit le HUD et les actions.
export function DesktopToolbar({ hud, actions }) {
  // Les blocs de la barre, dans l'ordre d'affichage (voir toolbarActions)…
  const groups = TOOLBAR_GROUPS
    // … chacun avec ses actions…
    .map((g) => actions.filter((a) => a.group === g))
    // … sans les groupes vides.
    .filter((list) => list.length);
  // Écran de moins de 1 200 px (petit portable, tablette en paysage) : toutes les actions en icônes, avec leur
  // infobulle, pour que la barre tienne entière.
  const narrow = useMediaQuery('(max-width: 1200px)', { noSsr: true });

  // Début du rendu.
  return (
    // Carte de la barre (début de la balise).
    <Paper
      // Ombre marquée.
      elevation={6}
      // Rôle de barre d'outils.
      role="toolbar"
      // Nom pour les lecteurs d'écran.
      aria-label="Actions"
      // Marqueur de l'élément d'interface « toolbar ».
      data-hud="toolbar"
      // Début du style.
      sx={{
        // Fixée, au niveau des barres d'outils, centrée horizontalement.
        position: 'fixed', zIndex: (t) => t.zIndex.toolbar, left: '50%', transform: 'translateX(-50%)',
        // À 8 px au-dessus de la marge de sécurité du bas ; jamais plus large que l'écran, défile horizontalement au besoin.
        bottom: `calc(${safe('bottom')} + 8px)`, maxWidth: 'calc(100vw - 28px)', overflowX: 'auto',
        // Éléments en ligne, centrés verticalement, peu espacés ; barre de défilement cachée.
        display: 'flex', alignItems: 'center', gap: 0.25, p: 0.5, scrollbarWidth: 'none',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* L'indicateur de zoom, à gauche. */}
      <Readout hud={hud} />
      {/* Un bloc par groupe (début). */}
      {groups.map((list) => (
        // Ligne du bloc, au rôle de groupe, nommée en clair pour les lecteurs d'écran.
        <Stack key={list[0].group} direction="row" spacing={0.25} role="group" aria-label={GROUP_LABELS[list[0].group] || list[0].group} sx={{ alignItems: 'center' }}>
          {/* Filet vertical qui sépare du bloc précédent. */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />
          {/* Un bouton par action, en version ordinateur (en icône seule sur un écran de moins de 1 200 px). */}
          {list.map((a) => <ToolbarButton key={a.id} action={narrow ? { ...a, iconOnly: true } : a} compact={false} />)}
        {/* Fin de la ligne du groupe. */}
        </Stack>
      // Fin des blocs.
      ))}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de DesktopToolbar.
}
