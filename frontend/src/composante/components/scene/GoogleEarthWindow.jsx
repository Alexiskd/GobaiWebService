// Importe de MUI la boîte et le bouton.
import { Box, Button } from '@mui/material';

/** Adresse du site Google Earth affiché dans l'iframe : la Terre entière, vue de face. */
// Lien Google Earth.
export const GOOGLE_EARTH_URL = 'https://earth.google.com/web/@0,-0.69865984,0a,22251752.77375655d,35y,0h,0t,0r/data=CgRCAggBOgMKATBCAggASg0I____________ARAA';

/**
 * Fenêtre du globe Google : un iframe du site Google Earth, en plein écran, qui remplace le globe Terre de l'app.
 *
 * @param {{ open: boolean, onClose: () => void }} props
 */
// Déclare et exporte le composant GoogleEarthWindow (début).
export function GoogleEarthWindow({ open, onClose }) {
  // Fermée : rien à afficher.
  if (!open) return null;
  // Rend la fenêtre (début).
  return (
    // Toute la fenêtre, par-dessus le globe de l'app.
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1250, bgcolor: '#05070c' }} role="dialog" aria-label="Globe Google">
      {/* L'iframe du site Google Earth. */}
      <Box component="iframe" src={GOOGLE_EARTH_URL} title="Google Earth" allow="fullscreen" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
      {/* Bouton de retour au globe de l'app, en haut à droite. */}
      <Button variant="contained" size="small" onClick={onClose} sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>Revenir au globe de l’app</Button>
    </Box>
  // Fin du rendu.
  );
// Fin de GoogleEarthWindow.
}
