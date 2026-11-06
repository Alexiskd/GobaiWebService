import { Box, Paper, Stack, Typography } from '@mui/material';

/** Caractéristiques de l'astre : libellé à gauche, valeur (et note) alignée à droite. */
export function Facts({ items }) {
  if (!items?.length) return null;
  return (
    <Paper variant="outlined" component="dl" sx={{ m: 0, bgcolor: 'transparent', backdropFilter: 'none' }}>
      {items.map(({ term, value, note }, i) => (
        <Stack
          key={term}
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          spacing={2}
          sx={{ px: 1.5, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}
        >
          <Typography component="dt" variant="body2" color="text.secondary">{term}</Typography>
          <Box component="dd" sx={{ m: 0, textAlign: 'right' }}>
            <Typography variant="body2">{value}</Typography>
            {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{note}</Typography>}
          </Box>
        </Stack>
      ))}
    </Paper>
  );
}
