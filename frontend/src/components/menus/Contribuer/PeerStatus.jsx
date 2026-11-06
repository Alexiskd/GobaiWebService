import { Chip, Stack } from '@mui/material';
import { Note } from './Note';

// État de la synchronisation pair-à-pair, avec l'erreur éventuelle.
export function PeerStatus({ status, error }) {
  return (
    <Stack spacing={1} alignItems="flex-start">
      <Chip role="status" size="small" color={error ? 'warning' : 'default'} variant="outlined" label={status} />
      {error && <Note>P2P : {error}</Note>}
    </Stack>
  );
}
