import { Box, Typography } from '@mui/material';

/** Groupe de champs avec légende, champs répartis en grille (3 colonnes, 1 sur très petit écran). */
export function Fieldset({ legend, children }) {
  return (
    <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
      <Typography component="legend" variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{legend}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>{children}</Box>
    </Box>
  );
}
