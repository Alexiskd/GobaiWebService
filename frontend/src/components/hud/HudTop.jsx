import { Box, Paper, Stack, Typography } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';
import { edge } from '@/theme/layout';
import { LiveChip } from '../ui/PanelHeader';

export function HudTop({ hud }) {
  const { compact } = useViewport();
  const date = useHud(hud, (s) => s.date);
  const focusText = useHud(hud, (s) => s.focusText);
  const drag = useHudDraggable('titre', !compact);
  return (
    <Paper
      component="header"
      elevation={4}
      ref={drag.ref}
      style={drag.style}
      {...drag.handleProps}
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, top: edge('top', compact ? 6 : 12), left: edge('left', compact ? 6 : 14),
        right: compact ? edge('right', 64) : 'auto', maxWidth: compact ? 'none' : 'calc(100vw - 28px)',
        display: 'flex', alignItems: 'center', gap: compact ? 1 : 1.75, px: compact ? 1 : 1.5, py: 1,
        cursor: compact ? 'default' : 'grab', userSelect: 'none', touchAction: compact ? 'auto' : 'none',
      }}
    >
      <Box
        component="img"
        src="/logo.png?v=3"
        alt="Logo Gobai"
        width={252}
        height={138}
        draggable={false}
        decoding="async"
        sx={{ width: compact ? 'clamp(64px, 20vw, 96px)' : 'clamp(96px, 9vw, 140px)', height: 'auto', flex: 'none', objectFit: 'contain' }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Typography component="h1" variant={compact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Gobai Space{' '}
            {!compact && <Box component="span" aria-hidden="true" sx={{ color: 'text.secondary', fontWeight: 400 }}>١д१壹אη하</Box>}
          </Typography>
          <LiveChip />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{date}</Typography>
        {focusText && !compact && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{focusText}</Typography>}
      </Box>
    </Paper>
  );
}
