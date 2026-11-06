import { Box, Paper } from '@mui/material';
import { STRIP_H, TOOLBAR_H } from '@/theme/layout';
import { safe } from '@/theme/mediaQueries';
import { Readout } from '../hud/Readout';
import { Plus } from '../menus/Plus';
import { ToolbarButton } from './ToolbarButton';

// Petit écran : actions principales visibles, le reste dans le menu « Plus ».
export function CompactToolbar({ hud, actions }) {
  return (
    <>
      <Box
        sx={{
          position: 'fixed', zIndex: (t) => t.zIndex.hud, left: `calc(${safe('left')} + 6px)`,
          bottom: `calc(${TOOLBAR_H + STRIP_H + 8}px + ${safe('bottom')})`, maxWidth: '60vw',
          pointerEvents: 'none', textShadow: '0 0 6px #000',
        }}
      >
        <Readout hud={hud} />
      </Box>
      <Paper
        square
        elevation={8}
        role="toolbar"
        aria-label="Actions"
        data-hud="toolbar"
        sx={{
          position: 'fixed', zIndex: (t) => t.zIndex.toolbar, left: 0, right: 0, bottom: 0, minHeight: TOOLBAR_H,
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', alignItems: 'center', gap: 0.5,
          px: `calc(${safe('left')} + 6px)`, pt: 0.75, pb: `calc(${safe('bottom')} + 6px)`,
        }}
      >
        {actions.filter((a) => a.primary).map((a) => <ToolbarButton key={a.id} action={a} compact />)}
        <Plus actions={actions.filter((a) => !a.primary)} />
      </Paper>
    </>
  );
}
