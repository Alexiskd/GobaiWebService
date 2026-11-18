// Importe keyframes d'Emotion, pour définir une animation CSS.
import { keyframes } from '@emotion/react';
// Importe Box, le conteneur de MUI.
import { Box } from '@mui/material';

// Rouge du badge.
const LIVE_RED = '#ff3b30';
// Définit l'animation de pulsation de la pastille (début).
const pulse = keyframes({
  // Au départ : halo rouge collé à la pastille, à 65 % d'opacité.
  '0%': { boxShadow: '0 0 0 0 rgba(255, 59, 48, 0.65)' },
  // À 70 % : halo étendu à 5 px, devenu transparent.
  '70%': { boxShadow: '0 0 0 5px rgba(255, 59, 48, 0)' },
  // À la fin : halo revenu à zéro, transparent.
  '100%': { boxShadow: '0 0 0 0 rgba(255, 59, 48, 0)' },
// Fin de l'animation.
});

/**
 * Petit badge rouge « En direct » posé après le nom de l'app (barre du haut et écran de chargement).
 * Taille fixe et centrage vertical : il reste aligné sur le nom quelle que soit la taille du titre.
 */
// Déclare et exporte le composant LiveBadge : accepte des styles supplémentaires.
export function LiveBadge({ sx }) {
  // Début du rendu.
  return (
    // Conteneur du badge (début de la balise).
    <Box
      // Rendu en balise span.
      component="span"
      // Texte à traduire par le traducteur de l'interface.
      translate="yes"
      // Début du style.
      sx={{
        // Contenu en ligne, centré verticalement, espacé de 5 px, sans déformation.
        display: 'inline-flex', alignItems: 'center', alignSelf: 'center', gap: '5px', flex: 'none',
        // Hauteur de 18 px, coins entièrement arrondis, bordure et fond rouges translucides.
        height: 18, px: '7px', borderRadius: 99, border: '1px solid rgba(255, 59, 48, 0.5)', bgcolor: 'rgba(255, 59, 48, 0.12)',
        // Texte rouge, petit, gras, espacé, en capitales, sur une seule ligne.
        color: LIVE_RED, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
        // Pastille rouge de 6 px avant le texte, animée par la pulsation toutes les 1,8 s.
        '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: LIVE_RED, animation: `${pulse} 1.8s ease-out infinite` },
        // Pas d'animation si l'utilisateur a demandé moins de mouvement.
        '@media (prefers-reduced-motion: reduce)': { '&::before': { animation: 'none' } },
        // Styles supplémentaires passés par le parent.
        ...sx,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Le texte du badge. */}
      En direct
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LiveBadge.
}

// Exporte aussi le composant par défaut.
export default LiveBadge;
