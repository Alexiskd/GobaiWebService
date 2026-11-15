// Importe de React les crochets useLayoutEffect (mesure avant affichage), useRef (référence) et useState (état).
import { useLayoutEffect, useRef, useState } from 'react';
// Importe de MUI Divider (filet), IconButton (bouton icône), Menu (menu déroulant), Paper (carte), Stack (pile),
// Tooltip (infobulle) et useMediaQuery (largeur de l'écran).
import { Divider, IconButton, Menu, Paper, Stack, Tooltip, useMediaQuery } from '@mui/material';
// Importe l'icône du menu (trois traits), la même que l'onglet « Menu » du téléphone.
import { MenuIcon } from '../ui/icons';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe Readout, l'indicateur de zoom.
import { Readout } from '../hud/Readout';
// Importe ToolbarButton, le bouton d'action.
import { ToolbarButton } from './ToolbarButton';

// Ordinateur / laptop : une seule ligne alignée, groupes séparés, indicateur de zoom intégré à gauche. Si la ligne ne
// tient pas dans l'écran (tablette en portrait, cibles tactiles de 44 px), le groupe « help » (son, langue, aide,
// partage, galerie, performances, dons, sources, paramètres) passe dans un menu « Menu » : aucun bouton n'est caché
// au bout d'un défilement horizontal.
// Déclare et exporte le composant DesktopToolbar : reçoit le HUD et les actions.
export function DesktopToolbar({ hud, actions }) {
  // Les groupes de la barre, dans l'ordre d'affichage ; le groupe « layers » a disparu avec le bouton Informations,
  // dont le menu des cartes est passé dans le panneau des caractéristiques…
  const groups = ['explore', 'data', 'camera', 'help']
    // … chacun avec ses actions…
    .map((g) => actions.filter((a) => a.group === g))
    // … sans les groupes vides.
    .filter((list) => list.length);
  // Écran de moins de 1 200 px (petit portable, tablette en paysage) : toutes les actions en icônes, avec leur
  // infobulle, pour que la barre tienne entière, sans bouton caché au bout d'un défilement horizontal.
  const narrow = useMediaQuery('(max-width: 1200px)', { noSsr: true });
  // Référence de la barre, mesurée.
  const barRef = useRef(null);
  // Vrai si le groupe « help » est replié dans le menu (la barre entière ne tient pas).
  const [fold, setFold] = useState(false);
  // Largeur qu'il faut à la barre entière (mesurée au moment du repli), pour savoir quand la déplier.
  const needed = useRef(0);
  // Bouton d'ancrage du menu ouvert, ou null.
  const [menuEl, setMenuEl] = useState(null);
  // Contrôle de la place, à chaque rendu (actions changées) et à chaque changement de taille (début).
  useLayoutEffect(() => {
    // La barre.
    const el = barRef.current;
    // Pas encore rendue : rien.
    if (!el) return undefined;
    // Compare le contenu à la place disponible (début).
    const check = () => {
      // Place au plus : l'écran moins 28 px (la même limite que maxWidth).
      const room = window.innerWidth - 28;
      // Barre entière qui déborde : mémorise sa largeur et replie le groupe « help ».
      if (!fold && el.scrollWidth > el.clientWidth + 1) { needed.current = el.scrollWidth; setFold(true); }
      // Barre repliée et assez de place pour la barre entière : la déplie.
      else if (fold && room >= needed.current) setFold(false);
    // Fin de check.
    };
    // Contrôle immédiat.
    check();
    // Nouveau contrôle quand la barre change de taille…
    const ro = new ResizeObserver(check);
    // … la barre observée…
    ro.observe(el);
    // … et quand la fenêtre change de taille (rotation de l'écran).
    window.addEventListener('resize', check);
    // Nettoyage : fin de l'observation et de l'écoute.
    return () => { ro.disconnect(); window.removeEventListener('resize', check); };
  // Fin du contrôle de la place.
  });
  // Les groupes affichés dans la barre : tous, ou tous sauf « help » une fois replié.
  const shown = fold ? groups.filter((list) => list[0].group !== 'help') : groups;
  // Les actions du menu : le groupe « help » une fois replié, aucune sinon.
  const folded = fold ? groups.find((list) => list[0].group === 'help') || [] : [];

  // Début du rendu.
  return (
    // Carte de la barre (début de la balise).
    <Paper
      // Référence mesurée.
      ref={barRef}
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
      {shown.map((list) => (
        // Ligne du groupe, au rôle de groupe, nommée par le groupe de sa première action.
        <Stack key={list[0].group} direction="row" alignItems="center" spacing={0.25} role="group" aria-label={list[0].group}>
          {/* Filet vertical qui sépare du bloc précédent. */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />
          {/* Un bouton par action, en version ordinateur (en icône seule sur un écran de moins de 1 200 px). */}
          {list.map((a) => <ToolbarButton key={a.id} action={narrow ? { ...a, iconOnly: true } : a} compact={false} />)}
        {/* Fin de la ligne du groupe. */}
        </Stack>
      // Fin des blocs.
      ))}
      {/* Le groupe replié : un bouton « Menu » et son menu déroulant (début). */}
      {folded.length > 0 && (
        // Ligne du menu, au rôle de groupe.
        <Stack direction="row" alignItems="center" role="group" aria-label="menu">
          {/* Filet vertical qui sépare du bloc précédent. */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25, my: 0.5 }} />
          {/* Infobulle : ce que contient le menu. */}
          <Tooltip title={folded.map((a) => a.label).join(' · ')}>
            {/* Le bouton (début de la balise). */}
            <IconButton
              // Nom pour les lecteurs d'écran.
              aria-label="Menu"
              // Il ouvre un menu, ouvert ou non.
              aria-haspopup="menu" aria-expanded={Boolean(menuEl)}
              // Au clic : ouvre le menu sous le bouton.
              onClick={(e) => setMenuEl(e.currentTarget)}
              // Carré de 32 px (44 px sur écran tactile, par le thème), comme les autres boutons icône.
              sx={{ width: 32, height: 32 }}
            // Fin de la balise ouvrante.
            >
              {/* L'icône du menu. */}
              <MenuIcon sx={{ fontSize: 18 }} />
            {/* Fin du bouton. */}
            </IconButton>
          {/* Fin de l'infobulle. */}
          </Tooltip>
          {/* Le menu déroulant, au-dessus du bouton, aligné à droite (début de la balise). */}
          <Menu
            // Ancré au bouton.
            anchorEl={menuEl}
            // Ouvert quand il a une ancre.
            open={Boolean(menuEl)}
            // Fermeture (Échap, clic à côté).
            onClose={() => setMenuEl(null)}
            // Point d'ancrage : le coin haut droit du bouton…
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            // … contre le coin bas droit du menu : il s'ouvre vers le haut, la barre étant en bas de l'écran.
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            // Nom du menu pour les lecteurs d'écran.
            aria-label="Menu"
          // Fin de la balise ouvrante.
          >
            {/* Une entrée par action repliée (44 px de haut sur écran tactile) ; un choix referme le menu. */}
            {folded.map((a) => <ToolbarButton key={a.id} action={a} compact={false} inMenu onPick={() => setMenuEl(null)} />)}
          {/* Fin du menu. */}
          </Menu>
        {/* Fin de la ligne du menu. */}
        </Stack>
      // Fin du groupe replié.
      )}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de DesktopToolbar.
}
