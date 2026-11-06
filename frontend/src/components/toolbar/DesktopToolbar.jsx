import { Divider, Paper, Stack } from '@mui/material';
import { safe } from '@/theme/mediaQueries';
import { Readout } from '../hud/Readout';
import { ToolbarButton } from './ToolbarButton';

// Ordinateur / laptop : une seule ligne alignée, groupes séparés, indicateur de zoom intégré à gauche.
export function DesktopToolbar({ hud, actions }) {
  const groups = ['explore', 'data', 'camera', 'help']
    .map((g) => actions.filter((a) => a.group === g))
    .filter((list) => list.length);

  return (
    <Paper
      elevation={6}
      role="toolbar"
      aria-label="Actions"
      data-hud="toolbar"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.toolbar, left: '50%', transform: 'translateX(-50%)',
        bottom: `calc(${safe('bottom')} + 12px)`, maxWidth: 'calc(100vw - 28px)', overflowX: 'auto',
        display: 'flex', alignItems: 'center', gap: 0.5, p: 0.75, scrollbarWidth: 'none',
      }}
    >
      <Readout hud={hud} />
      {groups.map((list) => (
        <Stack key={list[0].group} direction="row" alignItems="center" spacing={0.5} role="group" aria-label={list[0].group}>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          {list.map((a) => <ToolbarButton key={a.id} action={a} compact={false} />)}
        </Stack>
      ))}
    </Paper>
  );
}
