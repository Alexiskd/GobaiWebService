import { Box, Button, IconButton, ListItemIcon, ListItemText, MenuItem, Tooltip } from '@mui/material';

const Icon = ({ children, size = 18 }) => (
  <Box component="span" aria-hidden="true" sx={{ fontSize: size, lineHeight: 1, width: '1.2em', textAlign: 'center' }}>{children}</Box>
);

/**
 * Bouton de la barre d’outils : icône + libellé (complet sur ordinateur, court sur mobile), état « enfoncé » en
 * couleur primaire. Dans le menu « Plus » du mobile, il devient une entrée de menu.
 */
export function ToolbarButton({ action, compact, inMenu = false, onPick }) {
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  const common = {
    'aria-pressed': inMenu ? undefined : pressed,
    'aria-label': action.label,
    'data-no-sound': action.noSound ? '' : undefined,
    disabled: action.disabled,
    onClick: () => { action.onClick?.(); if (inMenu) onPick?.(); },
  };

  if (inMenu) {
    return (
      <MenuItem {...common} selected={Boolean(pressed)} title={action.title}>
        <ListItemIcon><Icon>{action.icon}</Icon></ListItemIcon>
        <ListItemText primary={action.label} />
      </MenuItem>
    );
  }

  if (!compact && action.iconOnly) {
    return (
      <Tooltip title={action.title || action.label}>
        <span>
          <IconButton {...common} color={pressed ? 'primary' : 'default'} sx={{ width: 40, height: 40 }}>
            <Icon>{action.icon}</Icon>
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={action.title || ''} disableHoverListener={compact}>
      <span style={{ display: 'inline-flex', minWidth: 0, width: compact ? '100%' : undefined }}>
        <Button
          {...common}
          variant={pressed ? 'contained' : 'text'}
          color={pressed ? 'primary' : 'inherit'}
          startIcon={compact ? undefined : <Icon>{action.icon}</Icon>}
          sx={compact ? {
            flexDirection: 'column', gap: 0.25, minWidth: 0, width: '100%', py: 0.5, px: 0.5, fontSize: 11, lineHeight: 1.2,
          } : { whiteSpace: 'nowrap', px: 1.5 }}
        >
          {compact && <Icon size={20}>{action.icon}</Icon>}
          {compact ? (action.short || action.label) : action.label}
        </Button>
      </span>
    </Tooltip>
  );
}
