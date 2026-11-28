// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { useState } from 'react';
import { useMediaQuery } from '@/Fairing/kit';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe Readout, l'indicateur de zoom.
import { Readout } from '../hud/Readout.jsx';
// Importe ToolbarButton, le bouton d'action.
import { ToolbarButton } from './ToolbarButton.jsx';
// Ordre des blocs et leurs noms.
import { CORE_ACTIONS, GROUP_LABELS, TOOLBAR_GROUPS } from './toolbarActions.jsx';

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
  const narrow = useMediaQuery('(max-width: 1200px)');

  // Début du rendu.
  return (
    // Carte de la barre (début de la balise).
    <div
      // Rôle de barre d'outils.
      role="toolbar"
      // Nom pour les lecteurs d'écran.
      aria-label="Actions"
      // Marqueur de l'élément d'interface « toolbar ».
      data-hud="toolbar"
      // Début du style.
      className="g-paper g-elev fixed z-[40] left-1/2 -translate-x-1/2 max-w-[calc(100vw_-_28px)] overflow-x-auto flex items-center gap-0.5 p-1 rounded-[14px] [scrollbar-width:none]" style={{ bottom: `calc(${safe('bottom')} + 8px)` }}
    // Fin de la balise ouvrante.
    >
      {/* L'indicateur de zoom, à gauche. */}
      <Readout hud={hud} />
      {/* Un bloc par groupe (début). */}
      {groups.map((list) => (
        // Ligne du bloc, au rôle de groupe, nommée en clair pour les lecteurs d'écran.
        <div key={list[0].group} role="group" aria-label={GROUP_LABELS[list[0].group] || list[0].group} className="flex flex-row gap-0.5 items-center">
          {/* Filet vertical qui sépare du bloc précédent. */}
          <div role="separator" aria-orientation="vertical" className="g-divider-v mx-1 my-1.5" />
          {/* Un bouton par action, en version ordinateur (en icône seule sur un écran de moins de 1 200 px). */}
          {list.map((a) => <ToolbarButton key={a.id} action={narrow ? { ...a, iconOnly: true } : a} compact={false} />)}
        {/* Fin de la ligne du groupe. */}
        </div>
      // Fin des blocs.
      ))}
      {/* Le bouton « Plus », s'il y a des actions cachées. */}
      {hidden > 0 || more ? (
        <>
          <div role="separator" aria-orientation="vertical" className="g-divider-v mx-1 my-1.5" />
          <ToolbarButton action={moreAction} compact={false} />
        </>
      ) : null}
    {/* Fin de la carte. */}
    </div>
  // Fin du rendu.
  );
// Fin de DesktopToolbar.
}
