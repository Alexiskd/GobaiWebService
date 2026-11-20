// Importe Box de MUI.
import { Box } from '@mui/material';

/** Silhouette du bouton de l'affichage relativiste (image fournie, fond retiré, dans le dossier public). */
const EMC_IMAGE = '/einstein.png';

/**
 * Icône du bouton de l'affichage relativiste (anciennement « E = mc² ») : le profil d'Einstein, sans texte.
 *
 * Le PNG sert de masque : la silhouette prend la couleur du bouton (`currentColor`), comme les icônes MUI — claire
 * en mode nuit, sombre en mode jour, inversée quand le bouton est enfoncé. C'est un composant, comme les icônes
 * MUI : iconNode l'instancie avec `sx.fontSize`, la taille demandée, et l'image est un carré de cette taille.
 */
export function EmcIcon({ sx }) {
  const size = Number(sx?.fontSize) || 18;
  const mask = `url(${EMC_IMAGE}) center / contain no-repeat`;
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: 'block', flex: 'none', width: size, height: size,
        bgcolor: 'currentColor', WebkitMask: mask, mask,
      }}
    />
  );
}
