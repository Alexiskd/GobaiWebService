import { Box, FormControlLabel, Switch as MuiSwitch, Typography } from '@mui/material';

/** Interrupteur : toute la ligne est cliquable, le bouton est toujours aligné à droite. */
export function Switch({ checked, disabled, onChange, label, hint }) {
  return (
    <FormControlLabel
      disableTypography
      labelPlacement="start"
      disabled={disabled}
      sx={{ m: 0, pl: 1.5, pr: 0.5, py: 0.5, width: '100%', justifyContent: 'space-between', gap: 1, '&:hover': { bgcolor: 'action.hover' } }}
      control={(
        <MuiSwitch
          size="small"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          slotProps={{ input: { role: 'switch' } }}
        />
      )}
      label={(
        <Box sx={{ py: 0.75 }}>
          <Typography variant="body2">{label}</Typography>
          {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hint}</Typography>}
        </Box>
      )}
    />
  );
}
