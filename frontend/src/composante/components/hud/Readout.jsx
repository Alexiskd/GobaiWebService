// Importe de MUI Stack (pile) et Typography (texte).
import { Stack, Typography } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';

/**
 * Lecture du zoom, du niveau d'échelle (« Rue », « Ville », « Planète »…) et du niveau de carte de la Terre,
 * intégrée à la barre d'outils.
 * Chiffres à chasse fixe : la valeur défile sans faire bouger le texte autour.
 */
// Déclare et exporte le composant Readout : reçoit le magasin du HUD.
export function Readout({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit le texte du zoom.
  const zoomText = useHud(hud, (s) => s.zoomText);
  // Lit le texte du niveau d'échelle.
  const scaleText = useHud(hud, (s) => s.scaleText);
  // Lit le niveau de zoom de la carte, seulement si une couche de tuiles est affichée.
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  // Début du rendu.
  return (
    // Ligne horizontale, non annoncée par les lecteurs d'écran, sur une seule ligne.
    <Stack direction="row" spacing={1.5} aria-live="off" sx={{ px: 1, alignItems: 'center', whiteSpace: 'nowrap', minWidth: 0 }}>
      {/* Le texte du zoom, coupé par des points de suspension s'il déborde, en chiffres de largeur fixe. */}
      <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{zoomText}</Typography>
      {/* Le niveau d'échelle, s'il existe, avec une infobulle. */}
      {scaleText && <Typography variant="caption" color="text.secondary" title="Niveau d’échelle de la vue" sx={{ flex: 'none' }}>{scaleText}</Typography>}
      {/* Le niveau de la carte, s'il est connu, hors mode compact. */}
      {tileZoom !== null && !compact && <Typography variant="caption" color="text.secondary">carte niveau {tileZoom}</Typography>}
    {/* Fin de la ligne. */}
    </Stack>
  // Fin du rendu.
  );
// Fin de Readout.
}
