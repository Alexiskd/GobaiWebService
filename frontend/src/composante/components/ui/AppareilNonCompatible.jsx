// Importe de MUI Box, Paper (carte) et Typography (texte).
import { Box, Paper, Typography } from '@mui/material';

/**
 * Mot d'excuse affiché à la place de l'app sur un téléphone en dessous de l'iPhone 15 ou de son équivalent
 * (voir moteur/lib/deviceGate.jsx). Le nom de l'app n'est jamais traduit.
 */
// Déclare et exporte le composant AppareilNonCompatible.
export function AppareilNonCompatible() {
  // Début du rendu.
  return (
    // Fond de l'écran (début de la balise).
    <Box
      // Rendu en balise main.
      component="main"
      // Début du style.
      sx={{
        // Couvre toute la fenêtre, contenu centré, marge intérieure, fond noir.
        position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', p: 3, bgcolor: '#000',
        // Deux halos en dégradé radial : un bleu en haut à gauche et (ligne suivante) un doré en bas à droite.
        backgroundImage: `radial-gradient(60% 50% at 18% 12%, rgba(0, 0, 255, 0.22), transparent 70%),
          radial-gradient(70% 60% at 85% 100%, rgba(240, 178, 74, 0.16), transparent 70%)`,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Carte à contour au rôle d'alerte : largeur maximale de 420 px, texte centré, fond sombre translucide, texte clair. */}
      <Paper variant="outlined" role="alert" sx={{ maxWidth: 420, p: 3, textAlign: 'center', bgcolor: 'rgba(9, 13, 22, 0.88)', color: '#e8edf8', borderColor: 'rgba(232, 237, 248, 0.2)' }}>
        {/* Titre de niveau 1, jamais traduit, en gras. */}
        <Typography component="h1" variant="h6" translate="no" sx={{ fontWeight: 700, mb: 2 }}>
          {/* Le nom de l'application. */}
          Go白ناन्टех
        {/* Fin du titre. */}
        </Typography>
        {/* Premier paragraphe. */}
        <Typography variant="body1" sx={{ mb: 1.5 }}>
          {/* Le mot d'excuse. */}
          Désolé pour la gêne occasionnée.
        {/* Fin du premier paragraphe. */}
        </Typography>
        {/* Deuxième paragraphe, en gris-bleu. */}
        <Typography variant="body2" sx={{ mb: 1.5, color: '#8b97b3' }}>
          {/* Les téléphones acceptés (texte sur deux lignes). */}
          Sur téléphone, le site est accessible avec un iPhone 15 ou plus récent, un Samsung Galaxy équivalent ou plus
          récent, et les modèles équivalents des autres marques.
        {/* Fin du deuxième paragraphe. */}
        </Typography>
        {/* Troisième paragraphe, en gris-bleu. */}
        <Typography variant="body2" sx={{ color: '#8b97b3' }}>
          {/* La raison du refus et la solution proposée (texte sur deux lignes). */}
          Votre appareil n’est pas assez récent pour afficher le système solaire en 3D sans surchauffer. Vous pouvez
          ouvrir le site depuis un ordinateur ou un téléphone plus récent.
        {/* Fin du troisième paragraphe. */}
        </Typography>
      {/* Fin de la carte. */}
      </Paper>
    {/* Fin du fond. */}
    </Box>
  // Fin du rendu.
  );
// Fin de AppareilNonCompatible.
}
