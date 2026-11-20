// Importe de MUI Box, FormControlLabel (libellé lié à une commande), Switch (renommé MuiSwitch) et Typography.
import { Box, FormControlLabel, Switch as MuiSwitch, Typography } from '@mui/material';

/** Interrupteur : toute la ligne est cliquable, le bouton est toujours aligné à droite. */
// Déclare et exporte le composant Switch : état, désactivation, rappel de changement, libellé et aide.
export function Switch({ checked, disabled, onChange, label, hint }) {
  // Début du rendu.
  return (
    // Libellé cliquable qui englobe l'interrupteur (début de la balise).
    <FormControlLabel
      // Le libellé gère lui-même sa typographie.
      disableTypography
      // Libellé placé avant la commande : l'interrupteur est à droite.
      labelPlacement="start"
      // Désactivation éventuelle de toute la ligne.
      disabled={disabled}
      // Style : aucune marge, toute la largeur, libellé et bouton aux deux extrémités, fond de survol.
      sx={{ m: 0, pl: 1.5, pr: 0.5, py: 0.5, width: '100%', justifyContent: 'space-between', gap: 1, '&:hover': { bgcolor: 'action.hover' } }}
      // La commande (début).
      control={(
        // Interrupteur MUI (début de la balise).
        <MuiSwitch
          // Petite taille.
          size="small"
          // État coché, converti en booléen.
          checked={Boolean(checked)}
          // Désactivation éventuelle.
          disabled={disabled}
          // Au changement : transmet le nouvel état au parent, s'il écoute.
          onChange={(e) => onChange?.(e.target.checked)}
          // Rôle « switch » sur le champ, pour les lecteurs d'écran.
          slotProps={{ input: { role: 'switch' } }}
        // Fin de l'interrupteur.
        />
      // Fin de la commande.
      )}
      // Le libellé (début).
      label={(
        // Conteneur du libellé, avec une marge verticale.
        <Box sx={{ py: 0.75 }}>
          {/* Le texte du libellé. */}
          <Typography variant="body2">{label}</Typography>
          {/* Si une aide est donnée : en petit, couleur secondaire, sur sa propre ligne. */}
          {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hint}</Typography>}
        {/* Fin du conteneur du libellé. */}
        </Box>
      // Fin du libellé.
      )}
    // Fin de la balise FormControlLabel.
    />
  // Fin du rendu.
  );
// Fin de Switch.
}
