// Importe de MUI Divider (filet), Paper (carte) et Stack (pile).
import { Divider, Paper, Stack } from '@mui/material';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe Readout, l'indicateur de zoom.
import { Readout } from '../hud/Readout';
// Importe ToolbarButton, le bouton d'action.
import { ToolbarButton } from './ToolbarButton';

// Ordinateur / laptop : une seule ligne alignée, groupes séparés, indicateur de zoom intégré à gauche.
// Déclare et exporte le composant DesktopToolbar : reçoit le HUD et les actions.
export function DesktopToolbar({ hud, actions }) {
  // Les groupes de la barre, dans l'ordre d'affichage ; le groupe « layers » a disparu avec le bouton Informations,
  // dont le menu des cartes est passé dans le panneau des caractéristiques…
  const groups = ['explore', 'data', 'camera', 'help']
    // … chacun avec ses actions…
    .map((g) => actions.filter((a) => a.group === g))
    // … sans les groupes vides.
    .filter((list) => list.length);

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
        // Ligne du groupe, au rôle de groupe, nommée par le groupe de sa première action.
        <Stack key={list[0].group} direction="row" alignItems="center" spacing={0.25} role="group" aria-label={list[0].group}>
          {/* Filet vertical qui sépare du bloc précédent. */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />
          {/* Un bouton par action, en version ordinateur. */}
          {list.map((a) => <ToolbarButton key={a.id} action={a} compact={false} />)}
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
