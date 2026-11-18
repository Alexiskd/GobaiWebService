// Importe de MUI Box (conteneur) et Typography (texte).
import { Box, Typography } from '@mui/material';

/** Section d'un panneau : titre court en capitales (overline) puis contenu. */
// Déclare et exporte le composant Section : reçoit un titre et un contenu.
export function Section({ title, children }) {
  // Début du rendu.
  return (
    // Conteneur rendu en balise section, avec une marge en bas.
    <Box component="section" sx={{ mb: 2 }}>
      {/* Si un titre est donné : titre de niveau 3 au style overline, couleur secondaire, sur sa propre ligne. */}
      {title && <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>{title}</Typography>}
      {/* Le contenu de la section. */}
      {children}
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Section.
}
