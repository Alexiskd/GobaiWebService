// Importe de MUI Box, Stack (pile) et Typography (texte).
import { Box, Stack, Typography } from '@mui/material';

// Table des couleurs de la pastille selon le ton : vert (ok), bleu (en cours), rouge (erreur).
const TONE_COLOR = { ok: 'success.main', busy: 'info.main', bad: 'error.main' };

/** Ligne d'état : pastille de couleur (ok, en cours, erreur) et texte. */
// Déclare et exporte le composant StatusLine : reçoit le texte, le ton et une infobulle.
export function StatusLine({ text, tone, title }) {
  // Début du rendu.
  return (
    // Ligne horizontale au rôle d'état, éléments centrés verticalement, avec infobulle et marges.
    <Stack direction="row" spacing={1} alignItems="center" role="status" title={title} sx={{ px: 0.5, py: 1 }}>
      {/* La pastille (début de la balise). */}
      <Box
        // Cachée aux lecteurs d'écran : purement décorative.
        aria-hidden="true"
        // Début du style de la pastille.
        sx={{
          // Rond de 8 px qui ne se déforme pas ; couleur du ton, grisée si le ton est inconnu.
          width: 8, height: 8, borderRadius: '50%', flex: 'none', bgcolor: TONE_COLOR[tone] || 'text.disabled',
          // Pulsation continue seulement quand le ton est « en cours ».
          animation: tone === 'busy' ? 'status-pulse 1.2s ease-in-out infinite' : 'none',
          // Définition de la pulsation : opacité de 0,35 à mi-parcours.
          '@keyframes status-pulse': { '50%': { opacity: 0.35 } },
          // Pas d'animation si l'utilisateur a demandé moins de mouvement.
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        // Fin du style.
        }}
      // Fin de la pastille.
      />
      {/* Le texte, en petit ; rouge en cas d'erreur, couleur secondaire sinon. */}
      <Typography variant="caption" color={tone === 'bad' ? 'error' : 'text.secondary'}>{text}</Typography>
    {/* Fin de la ligne. */}
    </Stack>
  // Fin du rendu.
  );
// Fin de StatusLine.
}
