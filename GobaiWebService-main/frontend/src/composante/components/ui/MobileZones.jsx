/**
 * Les deux zones de commandes du téléphone (voir theme/layout) : tout ce qu'elles contiennent est posé dans le flux,
 * les uns après les autres. Rien ne s'y recouvre, quelle que soit la taille de l'écran, l'orientation ou le nombre
 * de barres ouvertes ; leur place mesurée est publiée pour la navball, le cadre GPS et les messages.
 *  - MobileTopBar : en haut, le bandeau titre et ses boutons, puis les indicateurs sous lui.
 *  - MobileDock : en bas, les surfaces (tiroir Informations, barre de ChatGPT) puis la base (bande des astres et
 *    navigation). En largeur suffisante (paysage, tablette étroite), les deux surfaces se partagent une rangée.
 * Les zones laissent passer les gestes vers la scène partout où elles n'ont rien à afficher (pointer-events).
 */
// Composant de mise en page de MUI.
import { Box } from '@mui/material';
// Marges de sécurité.
import { safe } from '@/composante/theme/mediaQueries';
// Limite de la zone du titre.
import { HUD_TOP } from '@/composante/theme/layout';
// Mesure des zones et hauteur du clavier.
import { useKeyboardInset, useZoneMeasure } from '@/composante/hooks/useZones';

// Largeur à partir de laquelle les surfaces du dock se partagent une rangée.
const WIDE = '@media (min-width: 700px)';

/** Zone du haut : `children` (bandeau titre), `actions` (boutons à sa droite), `status` (indicateurs, en dessous). */
// Déclare et exporte MobileTopBar : le titre, ses boutons et les indicateurs.
export function MobileTopBar({ children, actions, status }) {
  // Mesure de la limite basse de la zone.
  const ref = useZoneMeasure('top', 'top');
  // Début du rendu.
  return (
    // Zone du haut (début de la balise).
    <Box
      // Mesurée.
      ref={ref}
      // Repère du diagnostic et des tests.
      data-zone="top"
      // Début du style.
      sx={{
        // Fixée en haut, sur toute la largeur, au-dessus de la scène.
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.hud,
        // Marges : sécurité de l'écran plus 6 px.
        pt: `calc(${safe('top')} + 6px)`, pl: `calc(${safe('left')} + 6px)`, pr: `calc(${safe('right')} + 6px)`,
        // Colonne : la rangée du titre, puis celle des indicateurs.
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px',
        // Les gestes passent vers la scène, sauf sur les éléments eux-mêmes.
        pointerEvents: 'none', '& > * > *': { pointerEvents: 'auto' },
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Rangée du titre : le bandeau prend la place, ses boutons restent à droite. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        {/* Le bandeau titre, qui se réduit (son texte passe à la ligne) pour laisser la place aux boutons. */}
        <Box sx={{ flex: '0 1 auto', minWidth: 0, display: 'flex' }}>{children}</Box>
        {/* Les boutons, poussés à droite. */}
        {actions && <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flex: 'none' }}>{actions}</Box>}
      {/* Fin de la rangée du titre. */}
      </Box>
      {/* Rangée des indicateurs, s'il y en a : à la ligne, les uns à côté des autres, sans capter les gestes. */}
      {status && <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px', '&:empty': { display: 'none' }, '& > *': { pointerEvents: 'none' } }}>{status}</Box>}
    {/* Fin de la zone du haut. */}
    </Box>
  // Fin du rendu.
  );
// Fin de MobileTopBar.
}

/**
 * Zone du bas : `surfaces` (tiroir Informations, barre de ChatGPT), puis `base` (bande des astres, navigation). Elle
 * remonte au-dessus du clavier virtuel quand il s'ouvre, et ne dépasse jamais la zone du titre : le tiroir
 * Informations, seul élément de hauteur variable, se réduit et défile à l'intérieur.
 */
// Déclare et exporte MobileDock : les surfaces et la base.
export function MobileDock({ surfaces, base }) {
  // Mesure de la hauteur du dock.
  const ref = useZoneMeasure('bottom', 'bottom');
  // Mesure de la base (bande des astres et navigation).
  const baseRef = useZoneMeasure('base', 'bottom');
  // Hauteur du clavier.
  const keyboard = useKeyboardInset();
  // Début du rendu.
  return (
    // Le dock (début de la balise).
    <Box
      // Mesuré.
      ref={ref}
      // Repère du diagnostic et des tests.
      data-zone="bottom"
      // Début du style.
      sx={{
        // Fixé en bas, sur toute la largeur, au-dessus du clavier s'il est ouvert.
        position: 'fixed', left: 0, right: 0, bottom: keyboard > 0 ? `${keyboard}px` : 0, zIndex: (t) => t.zIndex.toolbar,
        // Colonne posée en bas, jamais plus haute que l'espace sous la zone du titre.
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', maxHeight: `calc(100dvh - ${HUD_TOP} - ${keyboard}px - 8px)`,
        // Les gestes passent vers la scène, sauf sur les éléments eux-mêmes.
        pointerEvents: 'none',
        // Transition douce quand le clavier s'ouvre.
        transition: 'bottom 160ms ease-out',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Les surfaces (début de la balise). */}
      <Box
        // Repère.
        data-dock="surfaces"
        // Début du style.
        sx={{
          // Peuvent se réduire (le tiroir défile alors à l'intérieur), les unes au-dessus des autres, écartées de 8 px.
          flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1, pb: 1,
          // Les gestes passent, sauf sur chaque surface.
          pointerEvents: 'none', '& > *': { pointerEvents: 'auto' },
          // Écran large : une seule rangée, posée en bas, chaque surface de largeur égale.
          [WIDE]: { flexDirection: 'row', alignItems: 'flex-end', px: `calc(${safe('left')} + 8px)`, '& > *': { pointerEvents: 'auto', flex: '1 1 0', minWidth: 0 } },
          // Vide : rien.
          '&:empty': { display: 'none' },
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Les surfaces. */}
        {surfaces}
      {/* Fin des surfaces. */}
      </Box>
      {/* La base : bande des astres et navigation, jamais réduites. */}
      <Box ref={baseRef} data-dock="base" sx={{ flex: 'none', pointerEvents: 'auto' }}>{base}</Box>
    {/* Fin du dock. */}
    </Box>
  // Fin du rendu.
  );
// Fin de MobileDock.
}

/** Hauteur maximale d'une surface du dock : l'espace entre la zone du titre et la base, moins les marges. */
// Déclare et exporte DOCK_SURFACE_MAX.
export const DOCK_SURFACE_MAX = `calc(100dvh - ${HUD_TOP} - var(--dock-base, 60px) - 24px)`;
