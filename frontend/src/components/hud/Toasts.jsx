import { Alert, Stack } from '@mui/material';
import { safe } from '@/theme/mediaQueries';

const SEVERITY = { warn: 'warning', error: 'error', info: 'info', ok: 'success' };

/** Messages éphémères, empilés en haut au centre (au-dessus des panneaux et des dialogues). */
export function Toasts({ toasts, onDismiss }) {
  return (
    <Stack
      spacing={1}
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.snackbar, left: '50%', transform: 'translateX(-50%)',
        top: `calc(${safe('top')} + 14px)`, width: 'min(440px, calc(100vw - 28px))', pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <Alert
          key={t.id}
          severity={SEVERITY[t.tone] || 'info'}
          variant="filled"
          onClose={() => onDismiss(t.id)}
          closeText="Fermer le message"
          sx={{ pointerEvents: 'auto', overflowWrap: 'anywhere', boxShadow: 6 }}
        >
          {t.text}
        </Alert>
      ))}
    </Stack>
  );
}
