import { useState } from 'react';
import { Box, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Typography } from '@mui/material';
import { useViewport } from '@/hooks/useViewport';
import { edge } from '@/theme/layout';

const CheckIcon = () => (
  <Box component="svg" viewBox="0 0 24 24" aria-hidden="true" sx={{ width: 16, height: 16, fill: 'currentColor' }}>
    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </Box>
);

/** Bouton d'un menu de la barre (style Visual Studio : texte compact, surligné au survol et quand il est ouvert). */
function BarButton({ label, open, onOpen, onHover }) {
  return (
    <ButtonBase
      onClick={onOpen}
      onMouseEnter={onHover}
      aria-haspopup="menu"
      aria-expanded={open ? 'true' : undefined}
      sx={{
        px: 1.25, height: '100%', fontSize: 13, color: 'text.primary', borderRadius: 0.5,
        bgcolor: open ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {label}
    </ButtonBase>
  );
}

/**
 * Petite barre de menus façon Visual Studio, en haut au centre.
 * « Affichage » liste les astres avec leur numéro (la Lune en 04 bis) ; « Lune (04 bis) » y va directement.
 */
export function MenuBar({ bodies, focus, onSelect }) {
  const { compact } = useViewport();
  const [menu, setMenu] = useState(null); // { id, anchor }
  if (compact) return null;

  const moon = bodies.find((b) => /bis$/.test(b.number || ''));
  const open = (id) => (e) => setMenu({ id, anchor: e.currentTarget });
  // Comme dans Visual Studio : un menu ouvert suit le survol des autres titres.
  const hover = (id) => (e) => { if (menu && menu.id !== id) setMenu({ id, anchor: e.currentTarget }); };
  const close = () => setMenu(null);
  const pick = (index) => { onSelect(index); close(); };

  const item = (body) => (
    <MenuItem key={body.name} dense selected={focus === body.index} onClick={() => pick(body.index)} sx={{ fontSize: 13, minHeight: 28 }}>
      <ListItemIcon sx={{ minWidth: 26 }}>{focus === body.index && <CheckIcon />}</ListItemIcon>
      <ListItemText primary={body.name} slotProps={{ primary: { fontSize: 13 } }} />
      <Typography variant="caption" color="text.secondary" sx={{ ml: 3, fontFamily: 'monospace' }}>{body.number}</Typography>
    </MenuItem>
  );

  return (
    <Paper
      component="nav"
      square
      elevation={4}
      aria-label="Menu"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, top: edge('top', 12), left: '50%', transform: 'translateX(-50%)',
        height: 30, display: 'flex', alignItems: 'stretch', px: 0.5, py: 0.25, borderRadius: 1,
      }}
    >
      <BarButton label="Affichage" open={menu?.id === 'view'} onOpen={open('view')} onHover={hover('view')} />
      <BarButton label="Lune" open={menu?.id === 'moon'} onOpen={open('moon')} onHover={hover('moon')} />

      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 240, borderRadius: 0.5, mt: 0.5 } }, list: { dense: true } }}
      >
        {menu?.id === 'view' && bodies.map(item)}
        {menu?.id === 'moon' && moon && [
          item(moon),
          <Divider key="d" />,
          <MenuItem key="info" disabled dense sx={{ fontSize: 12 }}>Satellite de la Terre — 04 bis</MenuItem>,
        ]}
      </Menu>
    </Paper>
  );
}
