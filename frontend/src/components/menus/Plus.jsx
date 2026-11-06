import { useState } from 'react';
import { Badge, Box, Button, Menu } from '@mui/material';
import { ToolbarButton } from '../toolbar/ToolbarButton';

// Menu « Plus » de la barre compacte : regroupe les actions secondaires. Monté uniquement sur petit écran.
export function Plus({ actions }) {
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);

  // Indicateur sur « Plus » quand une option cachée est active.
  const hiddenActive = actions.some((a) => a.pressed);

  return (
    <>
      <Button
        color="inherit"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ flexDirection: 'column', gap: 0.25, minWidth: 0, width: '100%', py: 0.5, px: 0.5, fontSize: 11, lineHeight: 1.2 }}
      >
        <Badge color="primary" variant="dot" invisible={!hiddenActive}>
          <Box component="span" aria-hidden="true" sx={{ fontSize: 20, lineHeight: 1 }}>⋯</Box>
        </Badge>
        Plus
      </Button>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {actions.map((a) => <ToolbarButton key={a.id} action={a} compact inMenu onPick={close} />)}
      </Menu>
    </>
  );
}
