// Fenêtre « Mème » : une image affichée en grand, ouverte par le bouton de la barre d'outils placé à côté du
// bouton Relativité (le profil d'Einstein). L'image n'est téléchargée qu'à l'ouverture de la fenêtre.
// Importe de MUI la boîte de dialogue, son contenu et Box.
import { Box, Dialog, DialogContent } from '@mui/material';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../ui/PanelHeader.jsx';

// Adresse de l'image, dans le dossier public.
const MEME_IMAGE = '/data/images/meme.jpg';
// Description de l'image pour les lecteurs d'écran.
const MEME_ALT = 'Mème : une enfant sourit au premier plan devant un bâtiment en flammes portant les logos Google Earth et NASA, pendant que des pompiers interviennent.';

/** Fenêtre du mème. `open` : affichée ou non ; `onClose` : rappel de fermeture. */
// Déclare et exporte le composant MemeDialog.
export function MemeDialog({ open, onClose }) {
  // Début du rendu.
  return (
    // Boîte de dialogue : largeur moyenne, fermée par Échap ou un clic à côté.
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-label="Mème">
      {/* En-tête commun, avec le bouton de fermeture. */}
      <PanelHeader kicker="Go白ناन्टех" title="Mème" onClose={onClose} sx={{ px: 2.5, pt: 2, pb: 1.5 }} />
      {/* Contenu sans marge : l'image occupe toute la largeur. */}
      <DialogContent sx={{ p: 0, bgcolor: 'common.black' }}>
        {/* L'image, à sa proportion (3 : 2), jamais plus haute que l'écran. */}
        <Box component="img" src={MEME_IMAGE} alt={MEME_ALT} width={1536} height={1024} loading="lazy"
          sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: '78vh', objectFit: 'contain' }} />
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de MemeDialog.
}
