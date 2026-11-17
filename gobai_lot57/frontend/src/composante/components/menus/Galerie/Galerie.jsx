// Importe de React lazy et Suspense (chargement différé) et les crochets useCallback, useEffect et useState.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
// Importe de MUI Box, CircularProgress et Dialog.
import { Box, CircularProgress, Dialog } from '@mui/material';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';

// Chargée à l'ouverture seulement : la galerie n'alourdit pas le démarrage de la scène 3D.
// Déclare GalerieApp en chargement différé : le module est demandé à la première ouverture.
const GalerieApp = lazy(() => import('./GalerieApp').then((m) => ({ default: m.GalerieApp })));

// Identifiant de la balise link des polices de la galerie.
const FONTS_ID = 'galerie-fonts';
// Adresse des polices (Syne, IBM Plex Sans et IBM Plex Mono) chez Google Fonts.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap';

/** Fenêtre plein écran « Galerie » : images NASA et collection personnelle, par catégorie d’astres. */
// Déclare et exporte le composant Galerie : ouverture et fermeture.
export function Galerie({ open, onClose }) {
  // État : visionneuse d'image ouverte ou non.
  const [lightbox, setLightbox] = useState(false);

  // Effet relancé à l'ouverture et à la fermeture.
  useEffect(() => {
    // Fenêtre fermée : la visionneuse est considérée comme fermée, et rien de plus.
    if (!open) { setLightbox(false); return; }
    // Si les polices ne sont pas encore demandées.
    if (!document.getElementById(FONTS_ID)) {
      // Crée une balise link.
      const link = document.createElement('link');
      // Lui donne son identifiant.
      link.id = FONTS_ID;
      // C'est une feuille de style.
      link.rel = 'stylesheet';
      // Son adresse.
      link.href = FONTS_URL;
      // L'ajoute à l'en-tête du document.
      document.head.appendChild(link);
    // Fin du cas.
    }
  // Fin de l'effet ; dépendance : l'ouverture.
  }, [open]);

  // onLightboxChange : note l'état de la visionneuse ; fonction stable.
  const onLightboxChange = useCallback((v) => setLightbox(v), []);

  // Début du rendu.
  return (
    // Boîte de dialogue (début de la balise).
    <Dialog
      // Ouverte ou non.
      open={open}
      // Fermeture.
      onClose={onClose}
      // Plein écran.
      fullScreen
      // Échap ferme d'abord la visionneuse d'image, pas toute la galerie.
      // Échap ne ferme pas la galerie tant que la visionneuse est ouverte.
      disableEscapeKeyDown={lightbox}
      // Nom pour les lecteurs d'écran.
      aria-label="Galerie"
      // Fond presque noir, sans flou d'arrière-plan.
      slotProps={{ paper: { sx: { bgcolor: '#07080d', backdropFilter: 'none' } } }}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title="Galerie" onClose={onClose} />
      {/* Zone de contenu, qui défile. */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Seulement quand la fenêtre est ouverte (début). */}
        {open && (
          // Zone d'attente : une roue centrée pendant le chargement du module.
          <Suspense fallback={<Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box>}>
            {/* L'application de la galerie. */}
            <GalerieApp onLightboxChange={onLightboxChange} />
          {/* Fin de la zone d'attente. */}
          </Suspense>
        // Fin du cas.
        )}
      {/* Fin de la zone de contenu. */}
      </Box>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Galerie.
}
