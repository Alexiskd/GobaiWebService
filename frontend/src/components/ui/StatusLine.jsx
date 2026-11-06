import { Box, Stack, Typography } from '@mui/material';

const TONE_COLOR = { ok: 'success.main', busy: 'info.main', bad: 'error.main' };

/** Ligne d'état : pastille de couleur (ok, en cours, erreur) et texte. */
export function StatusLine({ text, tone, title }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" role="status" title={title} sx={{ px: 0.5, py: 1 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 8, height: 8, borderRadius: '50%', flex: 'none', bgcolor: TONE_COLOR[tone] || 'text.disabled',
          animation: tone === 'busy' ? 'status-pulse 1.2s ease-in-out infinite' : 'none',
          '@keyframes status-pulse': { '50%': { opacity: 0.35 } },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      <Typography variant="caption" color={tone === 'bad' ? 'error' : 'text.secondary'}>{text}</Typography>
    </Stack>
  );
}
