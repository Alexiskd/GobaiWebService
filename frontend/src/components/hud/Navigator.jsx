import { memo, useEffect, useRef } from 'react';
import { Box, Chip, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Paper, Stack, Typography } from '@mui/material';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';
import { RAIL, STRIP_H, TOOLBAR_H, edge } from '@/theme/layout';
import { safe } from '@/theme/mediaQueries';
import { DragIndicatorIcon } from '../ui/icons';

/** Pastille de l'astre, à sa couleur. */
const Orb = ({ color, size = 14 }) => (
  <Box
    aria-hidden="true"
    sx={{
      width: size, height: size, borderRadius: '50%', flex: 'none',
      background: `radial-gradient(circle at 32% 30%, #fff8 0, ${color} 45%, #0008 100%)`, boxShadow: `0 0 8px ${color}66`,
    }}
  />
);

// Grand écran : rail déplaçable (liste). Petit écran : bande horizontale de puces au-dessus de la barre d'outils.
export const Navigator = memo(function Navigator({ bodies, focus, onSelect }) {
  const { compact } = useViewport();
  const drag = useHudDraggable('navigation', !compact);
  const activeRef = useRef(null);

  // En bande horizontale, l'astre actif reste visible.
  useEffect(() => {
    if (compact) activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [compact, focus]);

  if (compact) {
    return (
      <Paper
        component="nav"
        square
        aria-label="Astres"
        data-hud="nav-strip"
        sx={{
          position: 'fixed', zIndex: (t) => t.zIndex.toolbar - 5, left: 0, right: 0,
          bottom: `calc(${TOOLBAR_H}px + ${safe('bottom')})`, height: STRIP_H,
          borderTop: 1, borderColor: 'divider', overflowX: 'auto', overflowY: 'hidden',
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, scrollSnapType: 'x proximity',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ height: '100%', px: 1, width: 'max-content' }}>
          {bodies.map((body, i) => {
            const current = focus === i;
            return (
              <Chip
                key={body.name}
                ref={current ? activeRef : undefined}
                icon={<Orb color={body.color} size={12} />}
                label={body.name}
                clickable
                color={current ? 'primary' : 'default'}
                variant={current ? 'filled' : 'outlined'}
                aria-current={current ? 'true' : undefined}
                onClick={() => onSelect(i)}
                sx={{ height: 40, borderRadius: 5, scrollSnapAlign: 'center', '& .MuiChip-icon': { ml: 1.25 } }}
              />
            );
          })}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      component="nav"
      elevation={4}
      aria-label="Astres"
      ref={drag.ref}
      style={drag.style}
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, left: edge('left'), top: '50%', transform: 'translateY(-50%)',
        width: RAIL, maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto',
      }}
    >
      <List
        dense
        subheader={(
          <ListSubheader
            component="div"
            {...drag.handleProps}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
          >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', ml: -0.75 }} aria-hidden="true" />
            Navigation
          </ListSubheader>
        )}
      >
        {bodies.map((body, i) => {
          const current = focus === i;
          return (
            <ListItemButton
              key={body.name}
              selected={current}
              aria-current={current ? 'true' : undefined}
              onClick={() => onSelect(i)}
              sx={{ borderRadius: 2, mx: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}><Orb color={body.color} /></ListItemIcon>
              <ListItemText primary={body.name} />
              <Typography variant="caption" color="text.disabled" aria-hidden="true">{String(i + 1).padStart(2, '0')}</Typography>
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
});
