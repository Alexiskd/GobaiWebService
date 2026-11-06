import { useState } from 'react';
import { MenuItem, TextField } from '@mui/material';

/**
 * Menu déroulant générique (MUI). `options` : liste de textes ou de { value, label }.
 * Contrôlé si `value` est fourni, sinon garde son propre choix. Ne déclenche pas le déplacement d'un panneau parent.
 */
export function MenuDeroulant({ label = 'Menu', options = ['vide'], value, defaultValue, onChange, size = 'small', sx }) {
  const items = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const [own, setOwn] = useState(defaultValue ?? items[0]?.value ?? '');
  const current = value ?? own;
  return (
    <TextField
      select
      label={label}
      size={size}
      value={current}
      onChange={(e) => { setOwn(e.target.value); onChange?.(e.target.value); }}
      onPointerDown={(e) => e.stopPropagation()}
      sx={{ minWidth: 120, ...sx }}
    >
      {items.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  );
}
