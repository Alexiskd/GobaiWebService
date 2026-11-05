import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Chip, IconButton, LinearProgress, Paper, Stack, Switch, ThemeProvider, Tooltip, Typography,
  createTheme, useMediaQuery,
} from '@mui/material';

// Trek de la Terre : tour du monde guidé avec choix du fond d'imagerie (Esri World Imagery, Mapbox, Maxar).
// Bureau : colonne à gauche. Mobile : tiroir au-dessus de la barre d'outils.

const theme = createTheme({
  palette: { mode: 'dark', primary: { main: '#4fc3f7' }, background: { paper: '#0d1322' } },
  typography: { fontSize: 13, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  shape: { borderRadius: 10 },
});

const COMPACT = '(max-width: 720px), (max-height: 500px) and (pointer: coarse)';
const STEP_MS = 14_000; // durée d'une étape en visite guidée
const PROVIDER_NAMES = { esri: 'Esri', mapbox: 'Mapbox', maxar: 'Maxar' };

const glass = {
  bgcolor: 'rgba(12, 18, 32, 0.9)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
};

const providerOf = (layer) => (layer.id.startsWith('esri') ? 'esri' : layer.id.startsWith('mapbox') ? 'mapbox' : 'maxar');

/**
 * @param open, onClose
 * @param layers   fonds du Trek (GET /earth-trek/layers), disponibles ou non
 * @param stops    étapes (GET /earth-trek/stops)
 * @param status   'loading' | 'ready' | 'error' ; error : message
 * @param baseId   fond de la Terre actuellement affiché
 * @param onBase   (layerId) => change le fond
 * @param onGo     (stop) => vole jusqu'à l'étape
 */
export function EarthTrekPanel({ open, onClose, layers = [], stops = [], status = 'ready', error = null, baseId, onBase, onGo }) {
  const compact = useMediaQuery(COMPACT, { noSsr: true });
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [followLayer, setFollowLayer] = useState(true);
  const listRef = useRef(null);

  const available = layers.filter((l) => l.available);
  const current = layers.find((l) => l.id === baseId) || null;

  const visit = useCallback((i) => {
    const stop = stops[i];
    if (!stop) return;
    setIndex(i);
    setElapsed(0);
    if (followLayer && stop.layer && stop.layer !== baseId && layers.some((l) => l.id === stop.layer && l.available)) onBase?.(stop.layer);
    onGo?.(stop);
  }, [stops, followLayer, baseId, layers, onBase, onGo]);

  // Visite guidée : avance automatiquement d'une étape toutes les STEP_MS.
  useEffect(() => {
    if (!open || !playing || !stops.length) return undefined;
    const started = performance.now() - elapsed;
    const timer = setInterval(() => {
      const t = performance.now() - started;
      if (t >= STEP_MS) visit((index + 1) % stops.length);
      else setElapsed(t);
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing, index, stops.length, visit]);

  useEffect(() => { if (!open) setPlaying(false); }, [open]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index]);

  if (!open) return null;

  const togglePlay = () => {
    if (!playing && index < 0) visit(0);
    setPlaying((p) => !p);
  };

  return (
    <ThemeProvider theme={theme}>
      <Paper
        elevation={0}
        role="dialog"
        aria-label="Trek de la Terre"
        sx={{
          ...glass,
          position: 'fixed',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          color: 'text.primary',
          ...(compact
            ? { left: 0, right: 0, bottom: 'calc(var(--toolbar-h, 56px) + env(safe-area-inset-bottom, 0px))', maxHeight: '56dvh', borderRadius: '18px 18px 0 0' }
            : { left: 16, top: 150, bottom: 96, width: 340 }),
        }}
      >
        {/* En-tête */}
        <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.5, pb: 1 }} gap={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Trek de la Terre</Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>Tour du monde en imagerie satellite</Typography>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Fermer le Trek">×</IconButton>
        </Stack>

        {/* Fonds d'imagerie */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="overline" sx={{ opacity: 0.6, letterSpacing: '0.08em' }}>Imagerie</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {layers.map((layer) => {
              const chip = (
                <Chip
                  key={layer.id}
                  size="small"
                  label={layer.label}
                  clickable={layer.available}
                  disabled={!layer.available}
                  color={layer.id === baseId ? 'primary' : 'default'}
                  variant={layer.id === baseId ? 'filled' : 'outlined'}
                  onClick={() => layer.available && onBase?.(layer.id)}
                />
              );
              return layer.available ? chip : (
                <Tooltip key={layer.id} title={layer.reason || 'Indisponible'}><span>{chip}</span></Tooltip>
              );
            })}
          </Stack>
          {status === 'loading' && <Typography variant="caption" sx={{ opacity: 0.6 }}>Chargement des fonds…</Typography>}
          {status === 'error' && <Typography variant="caption" sx={{ color: '#ff8a80' }} role="alert">Trek indisponible : {error}</Typography>}
          {status === 'ready' && !available.length && (
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
              Aucun fond configuré : ajoutez les clés dans le .env du backend.
            </Typography>
          )}
          {current && (
            <Typography variant="caption" sx={{ opacity: 0.55, display: 'block', mt: 0.75 }}>
              {PROVIDER_NAMES[providerOf(current)]} · {current.attributionText}
            </Typography>
          )}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography variant="body2">Fond conseillé à chaque étape</Typography>
            <Switch size="small" checked={followLayer} onChange={(_, on) => setFollowLayer(on)} />
          </Stack>
        </Box>

        {/* Lecture */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Stack direction="row" gap={1}>
            <Button size="small" variant="outlined" disabled={!stops.length} onClick={() => visit(index <= 0 ? stops.length - 1 : index - 1)}>◀</Button>
            <Button size="small" variant="contained" fullWidth disabled={!stops.length} onClick={togglePlay}>
              {playing ? '❚❚ Pause' : index < 0 ? '▶ Démarrer le tour' : '▶ Reprendre'}
            </Button>
            <Button size="small" variant="outlined" disabled={!stops.length} onClick={() => visit((index + 1) % stops.length)}>▶</Button>
          </Stack>
          {playing && <LinearProgress variant="determinate" value={(elapsed / STEP_MS) * 100} sx={{ mt: 1, borderRadius: 1 }} />}
        </Box>

        {/* Étapes */}
        <Box ref={listRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {stops.map((stop, i) => {
            const active = i === index;
            return (
              <Box
                key={stop.id}
                component="button"
                type="button"
                data-active={active}
                onClick={() => visit(i)}
                sx={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  display: 'grid',
                  gridTemplateColumns: '28px minmax(0, 1fr)',
                  gap: 1.25,
                  width: '100%',
                  px: 2,
                  py: 1.1,
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  bgcolor: active ? 'rgba(79, 195, 247, 0.1)' : 'transparent',
                  '&:hover': { bgcolor: active ? 'rgba(79, 195, 247, 0.14)' : 'rgba(255,255,255,0.03)' },
                  '&:focus-visible': { outline: '2px solid #4fc3f7', outlineOffset: -2 },
                }}
              >
                <Box sx={{
                  width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                  bgcolor: active ? 'primary.main' : 'rgba(255,255,255,0.08)', color: active ? '#04121c' : 'inherit',
                }}
                >
                  {i + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="baseline" gap={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{stop.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.55 }} noWrap>{stop.country}</Typography>
                  </Stack>
                  {active && <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mt: 0.25 }}>{stop.blurb}</Typography>}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </ThemeProvider>
  );
}

export default EarthTrekPanel;
