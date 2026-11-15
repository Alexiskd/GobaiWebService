// Importe Box, le conteneur de MUI.
import { Box } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';

/** Couleur selon la fluidité : vert à partir de 50 images par seconde, orange à partir de 25, rouge en dessous. */
// fpsColor : vert à partir de 50, orange à partir de 25, rouge en dessous.
export const fpsColor = (fps) => (fps >= 50 ? 'success.main' : fps >= 25 ? 'warning.main' : 'error.main');

/**
 * Compteur d'images par seconde : nombre d'images réellement dessinées par le moteur 3D, mis à jour deux fois par
 * seconde (voir Engine.countFps). Sur ordinateur, « · 60 FPS » à la suite de la date, dans le bandeau du titre
 * (HudTop) : il n'a plus de position propre et ne recouvre plus le logo. Rien sur téléphone.
 */
// Déclare et exporte le composant FpsCounter : reçoit le magasin du HUD.
export function FpsCounter({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le nombre d'images par seconde, 0 à défaut.
  const fps = useHud(hud, (s) => s.fps ?? 0);
  // Téléphone ou sans mesure : rien.
  if (compact || !fps) return null;
  // Début du rendu.
  return (
    // Texte en ligne, d'un seul tenant, rôle d'état, nom complet pour les lecteurs d'écran, jamais traduit.
    <Box component="span" role="status" aria-label={`${fps} images par seconde`} translate="no" sx={{ whiteSpace: 'nowrap', '& b': { fontWeight: 700, color: fpsColor(fps) } }}>
      {/* Séparateur, nombre (gras, coloré selon la fluidité) et unité. */}
      {' · '}<b>{fps}</b> FPS
    {/* Fin du texte. */}
    </Box>
  // Fin du rendu.
  );
// Fin de FpsCounter.
}
