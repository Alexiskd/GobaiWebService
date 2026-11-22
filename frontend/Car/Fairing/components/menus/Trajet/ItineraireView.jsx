// Visualisation de l'itinéraire : chaque étape est modélisée par le moteur de son moyen de locomotion
// (Engine/ItineraireEngine) — en 3D pour les véhicules volants, en 2D pour ceux qui roulent, marchent ou naviguent.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Button, Chip, IconButton, Tooltip, useMediaQuery } from '@/Fairing/kit';
// Importe le réglage jour/nuit : le dessin du trajet suit le thème de l'interface.
import { DAY, getDayNight, subscribeDayNight } from '@/Engine/shared/lib/device/dayNight';
// Importe les conversions des valeurs de style calculées au rendu.
import { tok } from '@/Fairing/kit/sx';
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
  const dayNight = useSyncExternalStore(subscribeDayNight, getDayNight, getDayNight);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
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
  const dark = dayNight !== DAY;
  // Couleur du texte du thème en cours (la même que --color-ink).
  const ink = dark ? '#f4f7ff' : '#19243a';

  // Un nouvel itinéraire repart de la vue d'ensemble.
  useEffect(() => { setSel('all'); progress.current = 0; }, [itinerary]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model.tracks.length) return undefined;
    progress.current = 0;
    const colors = { background: dark ? '#0b1220' : '#eef3fb', grid: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)', text: ink };
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
  }, [kind, sel, model, dark, track, ink]);

  if (!model.tracks.length) return <p className="t-body2 text-soft">Aucune étape exploitable dans cet itinéraire.</p>;

  return (
    <div className="flex flex-col gap-3" aria-label="Itinéraire modélisé">
      {itinerary.summary && <p className="t-body2 text-soft">{itinerary.summary}</p>}

      <div className="relative rounded-[16px] overflow-hidden border border-line">
        {/* Un canvas par type de rendu : un canvas 2D ne peut plus devenir WebGL. */}
        <canvas
          key={`${kind}-${sel}`} ref={canvasRef} role="img"
          aria-label={kind === '3d' ? 'Vue 3D de l’étape aérienne' : 'Carte 2D de l’itinéraire'}
          style={{ display: 'block', width: '100%', height: 280, touchAction: kind === '3d' ? 'none' : 'auto', cursor: kind === '3d' ? 'grab' : 'default' }}
        />
        <div className="flex flex-row gap-1 absolute top-2 left-2 items-center">
          <Chip size="small" label={kind === '3d' ? '3D' : '2D'} color={kind === '3d' ? 'primary' : 'default'} />
          {kind === '3d' && <Chip size="small" variant="outlined" label="Glisser : tourner · molette : zoom" className="bg-surface" />}
        </div>
        <Tooltip title={playing ? 'Pause' : 'Lecture'}>
          <IconButton onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Mettre en pause' : 'Lire l’animation'} className="absolute bottom-1.5 right-1.5 bg-surface w-10 h-10 hover:bg-surface">
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>
      </div>

      {sel !== 'all' && track?.dimension === '3d' && !webgl && (
        <span className="t-caption text-soft">La 3D n’est pas disponible sur cet appareil : l’étape est montrée en 2D.</span>
      )}

      <ul aria-label="Étapes" className="flex flex-col gap-1.5 m-0 p-0 list-none">
        <li>
          <Button fullWidth variant={sel === 'all' ? 'contained' : 'outlined'} onClick={() => setSel('all')} aria-pressed={sel === 'all'} className="justify-between normal-case min-h-11">
            <span>Vue d’ensemble</span>
            <span>{formatDuration(model.totalMinutes)} · {formatKm(model.totalKm)}</span>
          </Button>
        </li>
        {model.tracks.map((t, i) => (
          <li key={t.index}>
            <Button
              fullWidth variant={sel === i ? 'contained' : 'outlined'} onClick={() => setSel(i)} aria-pressed={sel === i}
              className="justify-between normal-case min-h-11 border-l-6 text-left gap-2" style={{ borderLeftColor: tok(t.color) }}
            >
              <div className="min-w-0">
                <span className="t-body2 font-semibold">{t.glyph} {t.modeLabel}</span>
                {t.label && <span className="t-caption block opacity-80 whitespace-normal">{t.label}</span>}
              </div>
              <div className="flex flex-row gap-1.5 items-center flex-none">
                <Chip size="small" label={t.dimension === '3d' ? '3D' : '2D'} variant="outlined" />
                <span className="t-caption tabular-nums whitespace-nowrap">{formatDuration(t.minutes)} · {formatKm(t.km)}</span>
              </div>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
