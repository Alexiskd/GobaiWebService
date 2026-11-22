// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { FormControlLabel, Switch as SwitchInput } from '@/Fairing/kit';

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
      className="m-0 pl-3 pr-1 py-1 w-full justify-between gap-2 hover:bg-hover"
      // La commande (début).
      control={(
        // Interrupteur du kit : une case à cocher native au rôle « switch » (début de la balise).
        <SwitchInput
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
        <div className="py-1.5">
          {/* Le texte du libellé. */}
          <p className="t-body2">{label}</p>
          {/* Si une aide est donnée : en petit, couleur secondaire, sur sa propre ligne. */}
          {hint && <span className="t-caption text-soft block">{hint}</span>}
        {/* Fin du conteneur du libellé. */}
        </div>
      // Fin du libellé.
      )}
    // Fin de la balise FormControlLabel.
    />
  // Fin du rendu.
  );
// Fin de Switch.
}
