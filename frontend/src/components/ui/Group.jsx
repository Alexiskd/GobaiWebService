import { Box, Divider, Paper, Stack, Typography } from '@mui/material';

/** Groupe de réglages : titre puis lignes de même hauteur séparées par un filet, dans une carte à contour. */
export function Group({ title, children }) {
  return (
    <Box role="group" aria-label={title} sx={{ mb: 2 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>{title}</Typography>
      <Paper variant="outlined" sx={{ bgcolor: 'transparent', backdropFilter: 'none', overflow: 'hidden' }}>
        <Stack divider={<Divider flexItem />}>{children}</Stack>
      </Paper>
    </Box>
  );
}
