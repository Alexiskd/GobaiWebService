import { useEffect } from 'react';
import { Box, Paper } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { formatDistance, formatLat, formatLon, gpsDecimals, niceScale } from '@/engine/gps';
import { useViewport } from '@/hooks/useViewport';
import { safe } from '@/theme/mediaQueries';

// Cadre GPS de la Terre : coordonnées des quatre coins de la zone visible, centre (réticule), barre d'échelle et
// altitude. Le nombre de décimales suit l'échelle (≈ un pixel à l'écran : 7 décimales ≈ 1 cm à l'échelle de 10 m).
// Sur mobile, le bas du cadre est relevé au-dessus de la barre d'outils : les coins affichés restent visibles.

const ARROWS = { nw: '↖', ne: '↗', sw: '↙', se: '↘' };
const BOTTOM = 'var(--gps-bottom, 0px)';
const POSITION = {
  nw: { top: `calc(${safe('top')} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  ne: { top: `calc(${safe('top')} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
  sw: { bottom: `calc(${BOTTOM} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  se: { bottom: `calc(${BOTTOM} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
};

/** Pastille de coordonnées : police à chasse fixe, chiffres alignés, au-dessus de la scène et sous les panneaux. */
function Chip({ sx, children, ...rest }) {
  return (
    <Paper
      elevation={2}
      {...rest}
      sx={{
        position: 'fixed', zIndex: 26, pointerEvents: 'none', display: 'flex', alignItems: 'baseline', gap: '5px',
        px: 0.75, py: 0.25, borderRadius: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 11.5, lineHeight: 1.35,
        '& b': { fontWeight: 700, color: 'primary.main' },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function Corner({ corner, digits, compact }) {
  const sx = {
    ...POSITION[corner.id],
    ...(compact && { flexDirection: 'column', alignItems: corner.id.endsWith('e') ? 'flex-end' : 'flex-start', gap: 0, fontSize: 10.5 }),
  };
  if (corner.lat === null) {
    return <Chip sx={sx} aria-hidden="true"><b>{ARROWS[corner.id]}</b><Box component="span" sx={{ color: 'text.secondary' }}>espace</Box></Chip>;
  }
  const lat = formatLat(corner.lat, digits), lon = formatLon(corner.lon, digits);
  return (
    <Chip sx={sx} aria-hidden="true">
      {compact ? (
        <><span><b>{ARROWS[corner.id]}</b> {lat}</span><span>{lon}</span></>
      ) : (
        <><b>{ARROWS[corner.id]}</b><span>{lat}, {lon}</span></>
      )}
    </Chip>
  );
}

/** Mesure la barre d'outils mobile pour relever le bas du cadre (et informe le moteur des coins à calculer). */
function useBottomInset(engine, compact) {
  useEffect(() => {
    if (!engine) return undefined;
    const measure = () => {
      let bottom = 0;
      if (compact) {
        // Barre d'outils et bande de navigation du bas : le cadre s'arrête au-dessus de la plus haute des deux.
        const tops = [...document.querySelectorAll('[data-hud="toolbar"], [data-hud="nav-strip"]')]
          .map((el) => el.getBoundingClientRect().top)
          .filter((t) => t > window.innerHeight / 2);
        if (tops.length) bottom = Math.max(0, window.innerHeight - Math.min(...tops) + 4);
      }
      document.documentElement.style.setProperty('--gps-bottom', `${bottom}px`);
      engine.setGpsInsets?.({ bottom: bottom + 5 });
    };
    measure();
    const t = setTimeout(measure, 300); // après la mise en page des barres
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [engine, compact]);
}

export function GpsFrame({ hud, engine }) {
  const { compact } = useViewport();
  const gps = useHud(hud, (s) => s.gps);
  useBottomInset(engine, compact);
  if (!gps) return null;

  const digits = gpsDecimals(gps.metersPerPixel);
  const scale = niceScale(gps.metersPerPixel, compact ? { minPx: 40, maxPx: 90 } : undefined);
  const corners = Object.fromEntries(gps.corners.map((c) => [c.id, c]));

  return (
    <>
      {['nw', 'ne', 'sw', 'se'].map((id) => corners[id] && <Corner key={id} corner={corners[id]} digits={digits} compact={compact} />)}
      {gps.center && (
        <>
          {/* Réticule du centre de l'écran. */}
          <Box
            aria-hidden="true"
            sx={{
              position: 'fixed', zIndex: 23, left: '50%', top: '50%', width: 18, height: 18, m: '-9px 0 0 -9px', pointerEvents: 'none',
              background: 'linear-gradient(#fff, #fff) center / 1.5px 100% no-repeat, linear-gradient(#fff, #fff) center / 100% 1.5px no-repeat',
              filter: 'drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000)',
            }}
          />
          <Chip
            role="status"
            aria-live="off"
            sx={{
              bottom: `calc(${BOTTOM} + ${compact ? 44 : 74}px)`, left: `calc(${safe('left')} + 5px)`,
              flexWrap: 'wrap', maxWidth: 'calc(100vw - 10px)', ...(compact && { fontSize: 10.5 }),
            }}
          >
            <b>⌖</b>
            <span>{formatLat(gps.center.lat, digits)}, {formatLon(gps.center.lon, digits)}</span>
            {scale && (
              <Box component="span" title="Échelle au centre de l’écran" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Box component="i" sx={{ display: 'inline-block', height: 6, border: '1.5px solid', borderTop: 0, borderColor: 'text.primary' }} style={{ width: `${Math.round(scale.px)}px` }} />
                {scale.label}
              </Box>
            )}
            {Number.isFinite(gps.altitudeM) && <span>· alt. {formatDistance(Math.max(0, gps.altitudeM))}</span>}
          </Chip>
        </>
      )}
    </>
  );
}
