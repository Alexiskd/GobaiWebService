import { Box, FormControlLabel, Radio as MuiRadio, Typography } from '@mui/material';

export function Radio({ name, checked, onChange, label, description }) {
  return (
    <FormControlLabel
      disableTypography
      sx={{ m: 0, px: 1, py: 0.5, width: '100%', alignItems: 'flex-start', '&:hover': { bgcolor: 'action.hover' } }}
      control={<MuiRadio size="small" name={name} checked={Boolean(checked)} onChange={onChange} sx={{ mt: 0.25 }} />}
      label={(
        <Box sx={{ py: 0.75 }}>
          <Typography variant="body2" sx={{ fontWeight: checked ? 600 : 400 }}>{label}</Typography>
          {description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{description}</Typography>}
        </Box>
      )}
    />
  );
}
