import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { CloseIcon, DragIndicatorIcon } from './icons';

/**
 * En-tête commun des fenêtres : poignée de déplacement (ou de tiroir sur mobile), surtitre, titre et actions.
 * `dragProps` (useDraggable) fait de tout l'en-tête la poignée ; `onClose` ajoute le bouton de fermeture.
 */
export function PanelHeader({ kicker, title, titleAdornment, onClose, closeLabel = 'Fermer', actions, dragProps, sheet = false, onClick, sx }) {
  const draggable = Boolean(dragProps?.onPointerDown);
  return (
    <Stack
      component="header"
      direction="row"
      alignItems="center"
      spacing={1}
      {...dragProps}
      onClick={onClick}
      sx={{
        position: 'relative', px: 2, pt: sheet ? 2 : 1.5, pb: 1, flex: 'none',
        borderBottom: 1, borderColor: 'divider',
        cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default', userSelect: 'none', touchAction: draggable ? 'none' : 'auto',
        ...sx,
      }}
    >
      {sheet && (
        <Box aria-hidden="true" sx={{ position: 'absolute', top: 6, left: '50%', ml: '-18px', width: 36, height: 4, borderRadius: 2, bgcolor: 'text.disabled' }} />
      )}
      {draggable && <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', ml: -1 }} aria-hidden="true" />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {kicker && <Typography variant="overline" color="primary" sx={{ display: 'block', lineHeight: 1.6 }}>{kicker}</Typography>}
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</Typography>
          {titleAdornment}
        </Stack>
      </Box>
      {actions}
      {onClose && (
        <Tooltip title={closeLabel}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label={closeLabel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

/** Badge « En direct » : pastille rouge qui pulse (immobile si l'utilisateur réduit les animations). */
export function LiveChip() {
  return (
    <Box
      component="span"
      role="status"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 4,
        bgcolor: 'error.dark', color: 'common.white', typography: 'caption', fontWeight: 600, lineHeight: 1.4,
        '&::before': {
          content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: 'common.white',
          animation: 'live-pulse 1.6s ease-in-out infinite',
        },
        '@keyframes live-pulse': { '50%': { opacity: 0.25 } },
        '@media (prefers-reduced-motion: reduce)': { '&::before': { animation: 'none' } },
      }}
    >
      En direct
    </Box>
  );
}
