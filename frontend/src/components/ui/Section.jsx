import { Box, Typography } from '@mui/material';

/** Section d'un panneau : titre court en capitales (overline) puis contenu. */
export function Section({ title, children }) {
  return (
    <Box component="section" sx={{ mb: 2 }}>
      {title && <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2.2 }}>{title}</Typography>}
      {children}
    </Box>
  );
}
