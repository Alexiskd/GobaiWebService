import { Box, Fab, Tooltip } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { useViewport } from '@/hooks/useViewport';
import { edge } from '@/theme/layout';

export function Compass({ hud, onRecalibrate }) {
  const { compact } = useViewport();
  const compass = useHud(hud, (s) => s.compass);
  if (!compass) return null;

  const deg = (compass.angle * 180) / Math.PI;
  const shown = Math.round(((deg % 360) + 540) % 360 - 180);
  const side = shown === 0 ? 'en haut' : shown === 180 || shown === -180 ? 'en bas' : `${Math.abs(shown)}° ${shown > 0 ? 'à droite' : 'à gauche'}`;
  const hint = `Nord ${side} · toucher pour recaler la caméra sur le nord`;

  return (
    <Tooltip title={hint} placement="left">
      <Fab
        size="medium"
        aria-label={`Boussole, ${hint}`}
        onClick={onRecalibrate}
        sx={{
          position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', compact ? 8 : 14),
          top: compact ? edge('top', 8) : 'calc(50% - 116px)',
          bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.selected' },
        }}
      >
        <Box
          component="img"
          src="/compass-needle.webp"
          alt=""
          draggable={false}
          sx={{ width: '78%', height: '78%', objectFit: 'contain', pointerEvents: 'none' }}
          style={{ transform: `rotate(${deg}deg)` }}
        />
        {/* Repère fixe du nord, en haut de la boussole. */}
        <Box aria-hidden="true" sx={{ position: 'absolute', top: 3, left: '50%', ml: '-3px', width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />
      </Fab>
    </Tooltip>
  );
}
