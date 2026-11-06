import { Button, Stack, Typography } from '@mui/material';

// Champ de choix du fichier LAZ, seul format accepté.
export function LazFileField({ inputRef, busy, onChange }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Button component="label" variant="contained" disabled={busy}>
        Choisir un fichier LAZ
        <input ref={inputRef} type="file" accept=".laz" onChange={onChange} disabled={busy} hidden />
      </Button>
      <Typography variant="body2" color="text.secondary">Fichier LAZ uniquement (maximum 256 Mio)</Typography>
    </Stack>
  );
}
