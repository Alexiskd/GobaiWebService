// Importe de MUI Box, ToggleButton, ToggleButtonGroup et Typography.
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';

/** Vitesses proposées : multiplicateur de la rotation automatique d'origine. */
// Déclare et exporte la liste des vitesses proposées (début du tableau).
export const ROTATION_SPEEDS = [
  // Lente : moitié de la vitesse d'origine.
  { value: 0.5, label: 'Lente', mark: '×0,5' },
  // Normale : la vitesse d'origine.
  { value: 1, label: 'Normale', mark: '×1' },
  // Rapide : le double.
  { value: 2, label: 'Rapide', mark: '×2' },
  // Très rapide : le quadruple.
  { value: 4, label: 'Très rapide', mark: '×4' },
// Fin du tableau.
];

/**
 * Vitesse de la rotation automatique de la caméra autour de l'astre ciblé : un bouton par vitesse. La rotation
 * elle-même se met en marche ou s'arrête avec son bouton « Rotation ».
 */
// Déclare et exporte le composant VitesseRotation : vitesse (1 par défaut), rappel et rotation en cours (vrai par défaut).
export function VitesseRotation({ speed = 1, onSpeed, rotating = true }) {
  // Début du rendu.
  return (
    // Conteneur au rôle de groupe.
    <Box role="group" aria-label="Vitesse de rotation" sx={{ mb: 2 }}>
      {/* Le titre. */}
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>Vitesse de rotation</Typography>
      {/* Le groupe de boutons (début de la balise). */}
      <ToggleButtonGroup
        // Un seul choix à la fois.
        exclusive
        // Toute la largeur.
        fullWidth
        // Petite taille.
        size="small"
        // La vitesse choisie.
        value={speed}
        // Au changement : transmet la nouvelle vitesse, sauf si le choix est annulé.
        onChange={(e, v) => { if (v != null) onSpeed?.(v); }}
        // Nom pour les lecteurs d'écran.
        aria-label="Vitesse de rotation"
      // Fin de la balise ouvrante.
      >
        {/* Un bouton par vitesse (début). */}
        {ROTATION_SPEEDS.map(({ value, label, mark }) => (
          // Le bouton, nommé par son libellé et son multiplicateur.
          <ToggleButton key={value} value={value} aria-label={`${label} (${mark})`} sx={{ flexDirection: 'column', gap: 0.25, py: 0.75, lineHeight: 1.2 }}>
            {/* Le libellé. */}
            <Box component="span">{label}</Box>
            {/* Le multiplicateur, en petit. */}
            <Box component="span" sx={{ fontSize: '0.72rem', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{mark}</Box>
          {/* Fin du bouton. */}
          </ToggleButton>
        // Fin des boutons.
        ))}
      {/* Fin du groupe de boutons. */}
      </ToggleButtonGroup>
      {/* Note d'aide (début de la balise). */}
      <Hint>
        {/* Si la rotation est en cours… */}
        {rotating
          // … ce que règle la vitesse…
          ? 'Vitesse à laquelle la vue tourne toute seule autour de l’astre.'
          // … sinon le rappel que la rotation est arrêtée.
          : 'La rotation automatique est arrêtée : la vitesse s’appliquera quand vous la relancerez.'}
      {/* Fin de la note. */}
      </Hint>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de VitesseRotation.
}
