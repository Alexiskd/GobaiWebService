// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';
// Importe de MUI Box, Paper et Typography.
import { Box, Paper, Typography } from '@mui/material';
// Importe la valeur « nuit », le lecteur et l'abonnement du réglage jour/nuit.
import { NIGHT, getDayNight, subscribeDayNight } from '@/moteur/lib/dayNight';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe le crochet de déplacement des panneaux.
import { useHudDraggable } from '@/composante/hooks/useHudDraggable';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la largeur du bouton ⋯ et edge, la distance à un bord de l'écran.
import { MORE_W, edge } from '@/composante/theme/layout';
// Importe le badge « En direct ».
import { LiveBadge } from '../ui/LiveBadge';
// Importe le menu déroulant générique.
import { MenuDeroulant } from '../ui/MenuDeroulant';

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
    <Paper
      // Rendu en balise header.
      component="header"
      // Ombre moyenne.
      elevation={4}
      // Marqueur de l'élément d'interface « title ».
      data-hud="title"
      // Référence pour le déplacement.
      ref={drag.ref}
      // Style de position, après déplacement.
      style={drag.style}
      // Propriétés de la poignée : tout le bandeau se saisit.
      {...drag.handleProps}
      // Début du style.
      sx={{
        // Fixé en haut à gauche, au niveau du HUD, plus près des bords en mode compact.
        position: 'fixed', zIndex: (t) => t.zIndex.hud, top: edge('top', compact ? 6 : 12), left: edge('left', compact ? 6 : 14),
        // Téléphone : le bandeau s'arrête avant le bouton ⋯ posé en haut à droite.
        // Pas d'ancrage à droite ; largeur maximale qui laisse la place du bouton ⋯ en mode compact.
        right: 'auto', maxWidth: compact ? `calc(100vw - 12px - ${MORE_W}px)` : 'calc(100vw - 28px)',
        // Même marge intérieure à gauche (avant le logo) et à droite (après le texte) : le bandeau épouse son contenu.
        // Contenu en ligne, centré verticalement.
        display: 'flex', alignItems: 'center',
        // Espacement et marges intérieures, réduits en mode compact.
        gap: compact ? 1 : 1.5, px: compact ? 1.25 : 1.75, py: compact ? 0.5 : 1,
        // Curseur en main et gestes réservés au déplacement, sauf en mode compact ; texte non sélectionnable.
        cursor: compact ? 'default' : 'grab', userSelect: 'none', touchAction: compact ? 'auto' : 'none',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Emblème seul : l'image a de larges marges transparentes (27 % à gauche, 20 % à droite), rognées ici pour que
          l'espace bord gauche → logo soit exactement celui du texte → bord droit (le `px` du bandeau). */}
      {/* Cadre de l'emblème : largeur selon l'écran, proportions de l'emblème, ce qui dépasse est masqué. */}
      <Box sx={{ width: compact ? 40 : 'clamp(52px, 5vw, 76px)', aspectRatio: `${LOGO.w} / ${LOGO.h}`, flex: 'none', overflow: 'hidden' }}>
        {/* L'image du logo (début de la balise). */}
        <Box
          // Rendue en balise img.
          component="img"
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
          sx={{
            // Affichée en bloc, sans largeur maximale, hauteur proportionnelle.
            display: 'block', maxWidth: 'none', height: 'auto',
            // Agrandie et décalée pour que seul l'emblème soit visible dans le cadre.
            width: `${(LOGO.fullW / LOGO.w) * 100}%`, ml: `${(-LOGO.x / LOGO.w) * 100}%`, mt: `${(-LOGO.y / LOGO.w) * 100}%`,
          // Fin du style.
          }}
        // Fin de l'image.
        />
      {/* Fin du cadre de l'emblème. */}
      </Box>
      {/* Zone des textes. */}
      <Box sx={{ minWidth: 0 }}>
        {/* Le titre de niveau 1, jamais traduit, plus petit en mode compact. */}
        <Typography component="h1" translate="no" variant={compact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600, lineHeight: 1.2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '0.3em' }}>
          {/* Le symbole ∞ en bleu, agrandi, décoratif. */}
          <Box component="span" aria-hidden="true" sx={{ color: '#0000FF', fontSize: compact ? '1.9em' : '2.2em', lineHeight: 0.8, fontWeight: 700 }}>∞</Box>
          {/* Le nom de l'application, suivi d'une espace. */}
          Go白ناन्टех{' '}
          {/* La suite du nom, hors mode compact, en couleur secondaire, décorative. */}
          {!compact && <Box component="span" aria-hidden="true" sx={{ color: 'text.secondary', fontWeight: 400 }}>α΄一하나א</Box>}
          {/* Le badge « En direct », masqué mais toujours à sa place hors mode nuit. */}
          <LiveBadge sx={{ ml: '0.2em', visibility: live ? 'visible' : 'hidden' }} />
          {/* Sujet du site à côté de son nom, écrit dans le bleu du fond du bandeau (il suit le thème jour / nuit). */}
          {/* Le sujet du site, à traduire, de la couleur du fond du bandeau. */}
          <Box component="span" translate="yes" sx={{ color: 'background.paper', fontWeight: 400 }}>: système solaire 3D</Box>
        {/* Fin du titre. */}
        </Typography>
        {/* La date, en petit, en chiffres de largeur fixe. */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>{date}</Typography>
        {/* Le texte de l'astre visé, s'il existe, hors mode compact. */}
        {focusText && !compact && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontVariantNumeric: 'tabular-nums' }}>{focusText}</Typography>}
      {/* Fin de la zone des textes. */}
      </Box>
    {/* Fin du bandeau. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de HudTop.
}
