// Visualisation de l'itinéraire : chaque étape est modélisée par le moteur de son moyen de locomotion
// (Engine/ItineraireEngine) — en 3D pour les véhicules volants, en 2D pour ceux qui roulent, marchent ou naviguent.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { modelItinerary } from '@/Engine/ItineraireEngine/modes.js';
import { createRenderer2D } from '@/Engine/ItineraireEngine/render2d.js';
import { createRenderer3D } from '@/Engine/ItineraireEngine/render3d.js';
import { formatDuration, formatKm } from '@/Engine/shared/lib/app/trajet';
import { PauseIcon, PlayArrowIcon } from '../../ui/icons.jsx';

/** Durée d'un tour d'animation (ms). */
const LOOP_MS = 9000;

/**
 * `itinerary` : la réponse de POST /position/itineraire. Une vue d'ensemble en 2D, puis une vue par étape :
 * 3D (tourner au glisser, zoomer à la molette) pour un véhicule volant, 2D pour les autres.
 */
export function ItineraireView({ itinerary }) {
  const theme = useTheme();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const model = useMemo(() => modelItinerary(itinerary), [itinerary]);
  // 'all' : vue d'ensemble ; sinon l'indice de l'étape.
  const [sel, setSel] = useState('all');
  const [playing, setPlaying] = useState(!reduced);
  // Faux si la 3D (WebGL) n'a pas pu démarrer : les étapes aériennes passent alors en 2D.
  const [webgl, setWebgl] = useState(true);
  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  const progress = useRef(0);
  playingRef.current = playing;

  const track = sel === 'all' ? null : model.tracks[sel] ?? null;
  const kind = track && track.dimension === '3d' && webgl ? '3d' : '2d';
  const dark = theme.palette.mode === 'dark';

  // Un nouvel itinéraire repart de la vue d'ensemble.
  useEffect(() => { setSel('all'); progress.current = 0; }, [itinerary]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model.tracks.length) return undefined;
    progress.current = 0;
    const colors = { background: dark ? '#0b1220' : '#eef3fb', grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', text: theme.palette.text.primary };
    let draw, resize, dispose = () => {};
    if (kind === '3d') {
      let r;
      try { r = createRenderer3D(canvas, { background: colors.background }); } catch { setWebgl(false); return undefined; }
      r.setTrack(track);
      draw = (u) => { r.setProgress(u); r.render(); };
      resize = () => r.resize();
      dispose = () => r.dispose();
    } else {
      const r = createRenderer2D(canvas);
      const shown = track ? [track] : model.tracks;
      draw = (u) => r.draw(shown, u, { colors });
      resize = () => r.resize();
    }
    resize();
    let raf = 0, last = performance.now();
    const tick = (now) => {
      const dt = now - last; last = now;
      if (playingRef.current) progress.current = (progress.current + dt / LOOP_MS) % 1;
      draw(progress.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
    ro?.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); dispose(); };
  }, [kind, sel, model, dark, track, theme.palette.text.primary]);

  if (!model.tracks.length) return <Typography variant="body2" color="text.secondary">Aucune étape exploitable dans cet itinéraire.</Typography>;

  return (
    <Stack spacing={1.5} aria-label="Itinéraire modélisé">
      {itinerary.summary && <Typography variant="body2" color="text.secondary">{itinerary.summary}</Typography>}

      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        {/* Un canvas par type de rendu : un canvas 2D ne peut plus devenir WebGL. */}
        <canvas
          key={`${kind}-${sel}`} ref={canvasRef} role="img"
          aria-label={kind === '3d' ? 'Vue 3D de l’étape aérienne' : 'Carte 2D de l’itinéraire'}
          style={{ display: 'block', width: '100%', height: 280, touchAction: kind === '3d' ? 'none' : 'auto', cursor: kind === '3d' ? 'grab' : 'default' }}
        />
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, left: 8, alignItems: 'center' }}>
          <Chip size="small" label={kind === '3d' ? '3D' : '2D'} color={kind === '3d' ? 'primary' : 'default'} />
          {kind === '3d' && <Chip size="small" variant="outlined" label="Glisser : tourner · molette : zoom" sx={{ bgcolor: 'background.paper' }} />}
        </Stack>
        <Tooltip title={playing ? 'Pause' : 'Lecture'}>
          <IconButton onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Mettre en pause' : 'Lire l’animation'} sx={{ position: 'absolute', bottom: 6, right: 6, bgcolor: 'background.paper', width: 40, height: 40, '&:hover': { bgcolor: 'background.paper' } }}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {sel !== 'all' && track?.dimension === '3d' && !webgl && (
        <Typography variant="caption" color="text.secondary">La 3D n’est pas disponible sur cet appareil : l’étape est montrée en 2D.</Typography>
      )}

      <Stack component="ul" spacing={0.75} aria-label="Étapes" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        <Box component="li">
          <Button fullWidth variant={sel === 'all' ? 'contained' : 'outlined'} onClick={() => setSel('all')} aria-pressed={sel === 'all'} sx={{ justifyContent: 'space-between', textTransform: 'none', minHeight: 44 }}>
            <span>Vue d’ensemble</span>
            <span>{formatDuration(model.totalMinutes)} · {formatKm(model.totalKm)}</span>
          </Button>
        </Box>
        {model.tracks.map((t, i) => (
          <Box component="li" key={t.index}>
            <Button
              fullWidth variant={sel === i ? 'contained' : 'outlined'} onClick={() => setSel(i)} aria-pressed={sel === i}
              sx={{ justifyContent: 'space-between', textTransform: 'none', minHeight: 44, borderLeft: 6, borderLeftColor: t.color, textAlign: 'left', gap: 1 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{t.glyph} {t.modeLabel}</Typography>
                {t.label && <Typography component="span" variant="caption" sx={{ display: 'block', opacity: 0.8, whiteSpace: 'normal' }}>{t.label}</Typography>}
              </Box>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flex: 'none' }}>
                <Chip size="small" label={t.dimension === '3d' ? '3D' : '2D'} variant="outlined" />
                <Typography component="span" variant="caption" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDuration(t.minutes)} · {formatKm(t.km)}</Typography>
              </Stack>
            </Button>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
