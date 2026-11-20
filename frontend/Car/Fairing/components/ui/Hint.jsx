// Importe Typography, le composant de texte de MUI.
import { Typography } from '@mui/material';

// Déclare et exporte le composant Hint : une note d'aide, dont le contenu est passé en enfants.
export function Hint({ children }) {
  // Rend le contenu en petit texte de couleur secondaire, avec une marge verticale et un léger retrait horizontal.
  return <Typography variant="body2" color="text.secondary" sx={{ my: 1, px: 0.5 }}>{children}</Typography>;
// Fin de Hint.
}
