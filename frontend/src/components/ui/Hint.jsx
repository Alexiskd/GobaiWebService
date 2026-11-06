import { Typography } from '@mui/material';

export function Hint({ children }) {
  return <Typography variant="body2" color="text.secondary" sx={{ my: 1, px: 0.5 }}>{children}</Typography>;
}
