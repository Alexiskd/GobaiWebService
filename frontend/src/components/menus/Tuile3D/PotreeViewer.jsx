import { Alert, Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { cloudBaseUrl } from './format';
import { usePotreeViewer } from './usePotreeViewer';

// Viewer Potree : canvas WebGL du nuage, boutons de recentrage et plein écran.
export function PotreeViewer({ cloud, coarse }) {
  const { hostRef, status, error, recenter, fullscreen } = usePotreeViewer(cloudBaseUrl(cloud), coarse);

  return (
    <>
      <Box
        aria-label={`Nuage 3D : ${cloud.name}`}
        sx={{
          position: 'relative', width: '100%', height: coarse ? 'clamp(320px, 48dvh, 640px)' : 'clamp(240px, 42dvh, 520px)',
          overflow: 'hidden', borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: '#000',
        }}
      >
        <Box
          ref={hostRef}
          sx={{ position: 'absolute', inset: 0, '& canvas': { display: 'block', width: '100% !important', height: '100% !important', touchAction: 'none' } }}
        />
        {status === 'ready' && (
          <Paper elevation={4} sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5, p: 0.5 }}>
            <Tooltip title="Recentrer la vue"><IconButton size="small" onClick={recenter} aria-label="Recentrer la vue">◎</IconButton></Tooltip>
            <Tooltip title="Plein écran"><IconButton size="small" onClick={fullscreen} aria-label="Plein écran">⛶</IconButton></Tooltip>
          </Paper>
        )}
        {status === 'loading' && (
          <Typography variant="body2" color="text.secondary" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            Chargement du nuage Potree…
          </Typography>
        )}
        {status === 'error' && <Alert severity="error" sx={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>Viewer indisponible : {error}</Alert>}
      </Box>
      {status === 'ready' && (
        <Typography variant="caption" color="text.secondary">
          {coarse
            ? 'Un doigt pour tourner · deux doigts pour zoomer et déplacer'
            : 'Glisser pour tourner · clic droit pour déplacer · molette pour zoomer'}
        </Typography>
      )}
    </>
  );
}
