import { Typography } from '@mui/material';

/** Note d'information du panneau Contributions. */
export function Note({ children }) {
  return <Typography variant="body2" color="text.secondary">{children}</Typography>;
}
