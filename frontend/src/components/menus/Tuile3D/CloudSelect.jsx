import { MenuItem, TextField } from '@mui/material';

// Liste déroulante des jeux de données disponibles pour la ville.
export function CloudSelect({ items, value, onChange }) {
  return (
    <TextField select size="small" fullWidth label="Jeu de données" value={value} onChange={(event) => onChange(event.target.value)}>
      {items.map((item) => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}
    </TextField>
  );
}
