// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Typography } from '@/Fairing/kit';
// Importe la valeur « nuit », le lecteur et l'abonnement du réglage jour/nuit.
import { NIGHT, getDayNight, subscribeDayNight } from '@/Engine/shared/lib/device/dayNight';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/Fairing/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe edge (distance à un bord de l'écran) et PANEL_W (largeur du panneau d'informations).
import { PANEL_W, edge } from '@/Fairing/theme/layout';
// Importe safe, la marge de sécurité d'un bord de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe le compteur d'images par seconde (forme en ligne, à la suite de la date).
import { FpsCounter } from './perf/FpsCounter.jsx';
// Importe le badge « En direct ».
import { LiveBadge } from '../ui/LiveBadge.jsx';

// Emblème dans /logo.webp (copie légère de /logo.png, 1379 × 752 px ramenés à 640 px de large) : rectangle réellement
// dessiné, hors marges transparentes. Les mesures ci-dessous sont celles de l'image d'origine ; seuls leurs rapports servent.
// Mesures du logo dans l'image d'origine : largeur totale, puis position et taille de l'emblème.
const LOGO = { fullW: 1379, x: 372, y: 90, w: 736, h: 594 };

// Déclare et exporte le composant HudTop : reçoit le magasin du HUD.
export function HudTop({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit la date affichée.
  const date = useHud(hud, (s) => s.date);
  // Lit le texte de l'astre visé.
  const focusText = useHud(hud, (s) => s.focusText);
  // Déplacement du bandeau, désactivé en mode compact.
  const drag = useHudDraggable('titre', !compact);
  // « En direct » n'est visible que si l'ombre est activée : sans elle, les astres sont éclairés sur toute leur
  // surface, ce qui n'est pas leur éclairage réel du moment. Sa place reste réservée quand il est masqué : le bandeau
  // garde exactement la même taille, ombre activée ou non.
  // Badge visible seulement en mode nuit (ombre activée).
  const live = useSyncExternalStore(subscribeDayNight, getDayNight, getDayNight) === NIGHT;
  // Début du rendu.
  return (
    // Le bandeau (début de la balise).
    <header
      // Marqueur de l'élément d'interface « title ».
      data-hud="title"
      // Référence pour le déplacement.
      ref={drag.ref}
      // Propriétés de la poignée : tout le bandeau se saisit.
      {...drag.handleProps}
      // Début du style. Grille à deux colonnes : l'emblème (colonne 1) est centré sur la seule ligne du titre (rangée 1),
      // la date et l'astre visé passent dessous, alignés sur le début du titre (colonne 2).
      className={compact ? 'm-title grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0' : 'g-paper fixed z-[20] right-auto grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0 px-3.5 py-1 cursor-grab select-none touch-none'}
      // Téléphone : aucun style calculé (classe `m-title`). Ordinateur : la position, déplaçable.
      style={compact ? undefined : { ...drag.style, top: edge('top', 12), left: edge('left', 14), maxWidth: `calc(100vw - ${safe('left')} - ${safe('right')} - 98px - ${PANEL_W})` }}
    // Fin de la balise ouvrante.
    >
      {/* Emblème seul : l'image a de larges marges transparentes (27 % à gauche, 20 % à droite), rognées ici pour que
          l'espace bord gauche → logo soit exactement celui du texte → bord droit (le `px` du bandeau). */}
      {/* Cadre de l'emblème : largeur selon l'écran, proportions de l'emblème, ce qui dépasse est masqué.
          Placé en colonne 1, rangée 1 : centré verticalement sur la ligne du titre, pas sur tout le bloc de textes. */}
      <div className={`${compact ? 'w-6.5' : 'w-[clamp(38px,3.6vw,56px)]'} col-start-1 row-start-1 self-center flex-none overflow-hidden`} style={{ aspectRatio: `${LOGO.w} / ${LOGO.h}` }}>
        {/* L'image du logo (début de la balise). */}
        <img
          // Adresse du logo (le paramètre v force le rechargement).
          src="/logo.webp?v=4"
          // Texte alternatif.
          alt="Logo Go白ناन्टех"
          // Jamais traduit.
          translate="no"
          // Largeur déclarée de l'image.
          width={252}
          // Hauteur déclarée de l'image.
          height={138}
          // Non déplaçable.
          draggable={false}
          // Décodage asynchrone.
          decoding="async"
          // Début du style.
          className="block max-w-none h-auto" style={{ width: `${(LOGO.fullW / LOGO.w) * 100}%`, marginLeft: `${(-LOGO.x / LOGO.w) * 100}%`, marginTop: `${(-LOGO.y / LOGO.w) * 100}%` }}
        // Fin de l'image.
        />
      {/* Fin du cadre de l'emblème. */}
      </div>
      {/* Le titre de niveau 1, jamais traduit, plus petit en mode compact (colonne 2, rangée 1, à côté de l'emblème). */}
      <Typography component="h1" translate="no" variant={compact ? 'subtitle1' : 'h6'} className="col-start-2 row-start-1 self-center m-0 min-w-0 font-semibold leading-[1.1] flex items-center flex-wrap gap-x-[0.3em]">
        {/* Le symbole ∞ en bleu, agrandi, décoratif. */}
        <span aria-hidden="true" className={`text-[#0000FF] ${compact ? 'text-[1.9em]' : 'text-[2.2em]'} leading-[0.8] font-bold`}>∞</span>
        {/* Le nom de l'application, suivi d'une espace. */}
        Go白ناन्टех{' '}
        {/* La suite du nom, hors mode compact, en couleur secondaire, décorative. */}
        {!compact && <span aria-hidden="true" className="text-soft font-normal">α΄一하나א</span>}
        {/* Le badge « En direct », masqué mais toujours à sa place hors mode nuit. */}
        <LiveBadge className={`ml-[0.2em] ${live ? 'visible' : 'invisible'}`} />
        {/* Sujet du site à côté de son nom, écrit dans le bleu du fond du bandeau (il suit le thème jour / nuit). */}
        {/* Le sujet du site, à traduire, de la couleur du fond du bandeau. */}
        <span translate="yes" className="text-surface font-normal">: système solaire 3D</span>
      {/* Fin du titre. */}
      </Typography>
      {/* La date, en petit, en chiffres de largeur fixe (colonne 2, sous le titre). */}
      <span className="col-start-2 t-caption text-soft block mt-0 leading-[1.2] tabular-nums">
        {/* La date. */}
        {date}
        {/* Le compteur d'images par seconde, à la suite. Pas monté sur téléphone : aucun abonnement inutile aux FPS. */}
        {!compact && <FpsCounter hud={hud} />}
      {/* Fin de la ligne de la date. */}
      </span>
      {/* Le texte de l'astre visé, s'il existe, hors mode compact. */}
      {focusText && !compact && <span className="col-start-2 t-caption text-soft block leading-[1.2] tabular-nums">{focusText}</span>}
    {/* Fin du bandeau. */}
    </header>
  // Fin du rendu.
  );
// Fin de HudTop.
}
