import { TextField } from '@mui/material';

// Recherche dans le flux : nom, pseudo ou CID.
export function FeedSearch({ value, onChange }) {
  return (
    <TextField
      type="search"
      size="small"
      fullWidth
      label="Rechercher dans le flux"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Nom, pseudo ou CID…"
      slotProps={{ htmlInput: { inputMode: 'search', enterKeyHint: 'search', autoCapitalize: 'none', autoCorrect: 'off' } }}
    />
  );
}
