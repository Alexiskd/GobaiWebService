/**
 * Les deux zones de commandes du téléphone (voir theme/layout) : tout ce qu'elles contiennent est posé dans le flux,
 * les uns après les autres. Rien ne s'y recouvre, quelle que soit la taille de l'écran, l'orientation ou le nombre
 * de barres ouvertes ; leur place mesurée est publiée pour la navball, le cadre GPS et les messages.
 *  - MobileTopBar : en haut, le bandeau titre et ses boutons, puis les indicateurs sous lui.
 *  - MobileDock : en bas, les surfaces (tiroir Informations, barre de l'assistant) puis la base (bande des astres et
 *    navigation). En largeur suffisante (paysage, tablette étroite), les deux surfaces se partagent une rangée.
 * Les zones laissent passer les gestes vers la scène partout où elles n'ont rien à afficher (pointer-events).
 */
// Limite de la zone du titre.
import { HUD_TOP } from '@/Fairing/theme/layout';
// Mesure des zones et hauteur du clavier.
import { useKeyboardInset, useZoneMeasure } from '@/Fairing/hooks/useZones';

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
    <div
      // Mesurée.
      ref={ref}
      // Repère du diagnostic et des tests.
      data-zone="top"
      // Début du style.
      className="m-top"
    // Fin de la balise ouvrante.
    >
      {/* Rangée du titre : le bandeau prend la place, ses boutons restent à droite. */}
      <div className="m-top-row">
        {/* Le bandeau titre, qui se réduit (son texte passe à la ligne) pour laisser la place aux boutons. */}
        <div className="flex-[0_1_auto] min-w-0 flex">{children}</div>
        {/* Les boutons, poussés à droite. */}
        {actions && <div className="ml-auto flex gap-2 flex-none">{actions}</div>}
      {/* Fin de la rangée du titre. */}
      </div>
      {/* Rangée des indicateurs, s'il y en a : à la ligne, les uns à côté des autres, sans capter les gestes. */}
      {status && <div className="flex flex-wrap items-start gap-[6px] empty:hidden *:pointer-events-none">{status}</div>}
    {/* Fin de la zone du haut. */}
    </div>
  // Fin du rendu.
  );
// Fin de MobileTopBar.
}

/**
 * Zone du bas : `surfaces` (tiroir Informations, barre de l'assistant), puis `base` (bande des astres, navigation). Elle
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
    <div
      // Mesuré.
      ref={ref}
      // Repère du diagnostic et des tests.
      data-zone="bottom"
      // Début du style.
      className="m-dock" style={keyboard > 0 ? { bottom: `${keyboard}px`, maxHeight: `calc(100dvh - ${HUD_TOP} - ${keyboard}px - 8px)` } : undefined}
    // Fin de la balise ouvrante.
    >
      {/* Les surfaces (début de la balise). */}
      <div
        // Repère.
        data-dock="surfaces"
        // Début du style.
        className="flex-[0_1_auto] min-h-0 flex flex-col gap-2 pb-2 pointer-events-none *:pointer-events-auto min-[700px]:flex-row min-[700px]:items-end min-[700px]:px-[calc(var(--safe-left,env(safe-area-inset-left,0px))_+_8px)] min-[700px]:*:pointer-events-auto min-[700px]:*:flex-[1_1_0] min-[700px]:*:min-w-0 empty:hidden"
      // Fin de la balise ouvrante.
      >
        {/* Les surfaces. */}
        {surfaces}
      {/* Fin des surfaces. */}
      </div>
      {/* La base : bande des astres et navigation, jamais réduites. */}
      <div ref={baseRef} data-dock="base" className="flex-none pointer-events-auto">{base}</div>
    {/* Fin du dock. */}
    </div>
  // Fin du rendu.
  );
// Fin de MobileDock.
}

/** Hauteur maximale d'une surface du dock : l'espace entre la zone du titre et la base, moins les marges. */
// Déclare et exporte DOCK_SURFACE_MAX.
export const DOCK_SURFACE_MAX = `calc(100dvh - ${HUD_TOP} - var(--dock-base, 60px) - 24px)`;
