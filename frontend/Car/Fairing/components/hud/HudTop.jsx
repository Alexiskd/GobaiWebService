// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
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
// Le rognage vertical est symétrique autour de la moitié de la hauteur de l'image (752 / 2 = 376 px) : de 68 à 684 px,
// soit 308 px de part et d'autre. Le centre du cadre est donc exactement le centre de l'image.
const LOGO = { fullW: 1379, x: 372, y: 68, w: 736, h: 616 };

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
    // Le bandeau (début de la balise) : habillage commun dans la classe `hud-title` (theme/app.css).
    <header
      // Marqueur de l'élément d'interface « title ».
      data-hud="title"
      // Téléphone : variante pleine largeur (sélecteur `[data-compact]`).
      data-compact={compact ? '' : undefined}
      // Ligne de l'astre visé affichée : une rangée de plus, tuile du logo agrandie (sélecteur `[data-focus]`).
      data-focus={focusText && !compact ? '' : undefined}
      // Référence pour le déplacement.
      ref={drag.ref}
      // Propriétés de la poignée : tout le bandeau se saisit.
      {...drag.handleProps}
      // Téléphone : rien de plus. Ordinateur : position fixe, curseur de saisie, déplaçable.
      className={compact ? 'hud-title' : 'hud-title fixed z-[20] right-auto cursor-grab touch-none'}
      // Ordinateur : la position (déplaçable) et la largeur maximale.
      style={compact ? undefined : { ...drag.style, top: edge('top', 12), left: edge('left', 14), maxWidth: `calc(100vw - ${safe('left')} - ${safe('right')} - 98px - ${PANEL_W})` }}
    // Fin de la balise ouvrante.
    >
      {/* Tuile du logo (colonne 1, toutes les rangées) : à la taille maximale permise par le bandeau. */}
      <div className="hud-title-logo">
        {/* Cadre de l'emblème : marges transparentes de l'image rognées, rognage vertical centré sur la moitié de sa hauteur. */}
        <div className="w-[80%] overflow-hidden" style={{ aspectRatio: `${LOGO.w} / ${LOGO.h}` }}>
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
            // Image agrandie et décalée pour ne montrer que l'emblème.
            className="block max-w-none h-auto" style={{ width: `${(LOGO.fullW / LOGO.w) * 100}%`, marginLeft: `${(-LOGO.x / LOGO.w) * 100}%`, marginTop: `${(-LOGO.y / LOGO.w) * 100}%` }}
          // Fin de l'image.
          />
        {/* Fin du cadre de l'emblème. */}
        </div>
      {/* Fin de la tuile du logo. */}
      </div>
      {/* Le titre de niveau 1 (colonne 2, rangée 1), jamais traduit. */}
      <h1 translate="no" className="hud-title-name">
        {/* Le symbole ∞ en bleu, décoratif. */}
        <span aria-hidden="true" className="hud-title-inf">∞</span>
        {/* Le nom de l'application. */}
        <span>Go白ناन्टех</span>
        {/* La suite du nom, hors téléphone, en couleur secondaire, décorative. */}
        {!compact && <span aria-hidden="true" className="hud-title-alt">α΄一하나א</span>}
        {/* Sujet du site : lu par les moteurs de recherche et les lecteurs d'écran, sans place à l'écran. */}
        <span translate="yes" className="sr-only">: système solaire 3D</span>
        {/* Le badge « En direct », collé au nom ; masqué mais toujours à sa place hors mode nuit. */}
        <LiveBadge className={live ? 'visible' : 'invisible'} />
      {/* Fin du titre. */}
      </h1>
      {/* La date, suivie du compteur d'images par seconde sur ordinateur. */}
      <span className="hud-title-meta">
        {/* La date. */}
        {date}
        {/* Le compteur d'images par seconde. Pas monté sur téléphone : aucun abonnement inutile aux FPS. */}
        {!compact && <FpsCounter hud={hud} />}
      {/* Fin de la ligne de la date. */}
      </span>
      {/* Le texte de l'astre visé, s'il existe, hors téléphone, plus discret. */}
      {focusText && !compact && <span className="hud-title-meta" data-faint="">{focusText}</span>}
    {/* Fin du bandeau. */}
    </header>
  // Fin du rendu.
  );
// Fin de HudTop.
}
