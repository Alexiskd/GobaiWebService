// Importe de MUI Box, Divider (filet), Paper (carte), Stack (pile) et Typography (texte).
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';

/** Groupe de réglages : titre puis lignes de même hauteur séparées par un filet, dans une carte à contour. */
// Déclare et exporte le composant Group : reçoit un titre et des lignes de réglages.
export function Group({ title, children }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe, nommé par le titre pour les lecteurs d'écran, avec une marge en bas.
    <Box role="group" aria-label={title} sx={{ mb: 2 }}>
      {/* Le titre, au style overline, couleur secondaire, sur sa propre ligne. */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>{title}</Typography>
      {/* Carte à contour, fond transparent, sans flou d'arrière-plan ; ce qui dépasse est masqué. */}
      <Paper variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', overflow: 'hidden' }}>
        {/* Pile verticale des lignes, séparées par un filet. */}
        <Stack divider={<Divider flexItem />}>{children}</Stack>
      {/* Fin de la carte. */}
      </Paper>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Group.
}
