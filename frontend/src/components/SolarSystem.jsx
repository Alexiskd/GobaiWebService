import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useSolarData } from '@/hooks/useSolarData';
import { SolarScene } from './SolarScene';

/** Écran plein (chargement, erreur) centré au-dessus de tout. */
export function FullScreenMessage({ children }) {
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 20, display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      {children}
    </Box>
  );
}

export function SolarSystem() {
  const { status, data, error, retry } = useSolarData();

  if (status === 'ready') return <SolarScene data={data} />;

  return (
    <FullScreenMessage>
      {status === 'loading' ? (
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Connexion à l’API…</Typography>
        </Stack>
      ) : (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ maxWidth: 480 }}
          action={<Button color="inherit" size="small" onClick={retry}>Réessayer</Button>}
        >
          <Typography variant="body2">Impossible de joindre l’API : {error}.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Lancez le backend (<Box component="code">npm run dev:api</Box>, port 3001), puis réessayez.
          </Typography>
        </Alert>
      )}
    </FullScreenMessage>
  );
}

export default SolarSystem;
