// Importe useState de React.
import { useState } from 'react';
// Importe de MUI MenuItem (entrée de menu) et TextField (champ).
import { MenuItem, TextField } from '@mui/material';

/**
 * Menu déroulant générique (MUI). `options` : liste de textes ou de { value, label }.
 * Contrôlé si `value` est fourni, sinon garde son propre choix. Ne déclenche pas le déplacement d'un panneau parent.
 */
// Déclare et exporte le composant MenuDeroulant, avec ses valeurs par défaut (libellé « Menu », une option « vide », petite taille).
export function MenuDeroulant({ label = 'Menu', options = ['vide'], value, defaultValue, onChange, size = 'small', sx }) {
  // Normalise les options : un simple texte devient un objet { value, label }.
  const items = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  // État interne : le choix propre, initialisé à la valeur par défaut, sinon à la première option, sinon vide.
  const [own, setOwn] = useState(defaultValue ?? items[0]?.value ?? '');
  // Valeur affichée : celle fournie par le parent, sinon le choix propre.
  const current = value ?? own;
  // Début du rendu.
  return (
    // Champ MUI (début de la balise).
    <TextField
      // Mode liste déroulante.
      select
      // Libellé du champ.
      label={label}
      // Taille du champ.
      size={size}
      // Valeur sélectionnée.
      value={current}
      // Au changement : mémorise le choix et prévient le parent, s'il écoute.
      onChange={(e) => { setOwn(e.target.value); onChange?.(e.target.value); }}
      // Arrête la propagation de l'appui, pour ne pas déplacer le panneau parent.
      onPointerDown={(e) => e.stopPropagation()}
      // Largeur minimale de 120 px, puis les styles passés par le parent.
      sx={{ minWidth: 120, ...sx }}
    // Fin de la balise ouvrante.
    >
      {/* Une entrée de menu par option. */}
      {items.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    {/* Fin du champ. */}
    </TextField>
  // Fin du rendu.
  );
// Fin de MenuDeroulant.
}
