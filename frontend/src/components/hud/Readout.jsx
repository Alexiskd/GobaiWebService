import { Stack, Typography } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { useViewport } from '@/hooks/useViewport';

/** Lecture du zoom (et du niveau de carte de la Terre), intégrée à la barre d'outils. */
export function Readout({ hud }) {
  const { compact } = useViewport();
  const zoomText = useHud(hud, (s) => s.zoomText);
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  return (
    <Stack direction="row" spacing={1.5} aria-live="off" sx={{ px: 1, alignItems: 'center', whiteSpace: 'nowrap', minWidth: 0 }}>
      <Typography variant="caption" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{zoomText}</Typography>
      {tileZoom !== null && !compact && <Typography variant="caption" color="text.secondary">carte niveau {tileZoom}</Typography>}
    </Stack>
  );
}
