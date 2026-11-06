import { useEffect } from 'react';
import { GlobalStyles } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { formatDistance, formatLat, formatLon, gpsDecimals, niceScale } from '@/engine/gps';
import { useViewport } from '@/hooks/useViewport';

// Cadre GPS de la Terre : coordonnées des quatre coins de la zone visible, centre (réticule), barre d'échelle et
// altitude. Le nombre de décimales suit l'échelle (≈ un pixel à l'écran : 7 décimales ≈ 1 cm à l'échelle de 10 m).
// Sur mobile, le bas du cadre est relevé au-dessus de la barre d'outils : les coins affichés restent visibles.

const ARROWS = { nw: '↖', ne: '↗', sw: '↙', se: '↘' };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const styles = {
  '.gps-chip': {
    position: 'fixed',
    zIndex: 26,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
    padding: '2px 6px',
    font: `11.5px/1.35 ${MONO}`,
    color: '#202122',
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid #a2a9b1',
    borderRadius: '2px',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  '.gps-chip b': { fontWeight: 700, color: '#000' },
  '.gps-chip .gps-off': { color: '#72777d', fontFamily: 'inherit' },
  '.gps-nw': { top: 'calc(var(--safe-t, 0px) + 5px)', left: 'calc(var(--safe-l, 0px) + 5px)' },
  '.gps-ne': { top: 'calc(var(--safe-t, 0px) + 5px)', right: 'calc(var(--safe-r, 0px) + 5px)', flexDirection: 'row-reverse' },
  '.gps-sw': { bottom: 'calc(var(--gps-bottom, 0px) + 5px)', left: 'calc(var(--safe-l, 0px) + 5px)' },
  '.gps-se': { bottom: 'calc(var(--gps-bottom, 0px) + 5px)', right: 'calc(var(--safe-r, 0px) + 5px)', flexDirection: 'row-reverse' },
  // Centre et échelle : au-dessus de la barre d'outils sur ordinateur, au-dessus des coins du bas sur mobile.
  '.gps-center': {
    bottom: 'calc(var(--gps-bottom, 0px) + 74px)',
    left: 'calc(var(--safe-l, 0px) + 5px)',
    flexWrap: 'wrap',
    maxWidth: 'calc(100vw - 10px)',
  },
  '.gps-scale': { display: 'inline-flex', alignItems: 'center', gap: '5px' },
  '.gps-scale i': {
    display: 'inline-block',
    height: '6px',
    borderLeft: '1.5px solid #202122',
    borderRight: '1.5px solid #202122',
    borderBottom: '1.5px solid #202122',
  },
  '.gps-cross': {
    position: 'fixed',
    zIndex: 23,
    left: '50%',
    top: '50%',
    width: '18px',
    height: '18px',
    margin: '-9px 0 0 -9px',
    pointerEvents: 'none',
    background: 'linear-gradient(#fff, #fff) center / 1.5px 100% no-repeat, linear-gradient(#fff, #fff) center / 100% 1.5px no-repeat',
    filter: 'drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000)',
  },
  // Téléphone : coordonnées sur deux lignes (latitude / longitude) pour tenir à deux par bord.
  '.gps-chip.is-compact': { flexDirection: 'column', alignItems: 'flex-start', gap: 0, fontSize: '10.5px' },
  '.gps-ne.is-compact, .gps-se.is-compact': { alignItems: 'flex-end' },
  '.gps-center.gps-center-compact': { bottom: 'calc(var(--gps-bottom, 0px) + 44px)', fontSize: '10.5px' },
};

function Corner({ corner, digits, compact }) {
  const cls = `gps-chip gps-${corner.id}${compact ? ' is-compact' : ''}`;
  if (corner.lat === null) {
    return <div className={cls} aria-hidden="true"><b>{ARROWS[corner.id]}</b><span className="gps-off">espace</span></div>;
  }
  const lat = formatLat(corner.lat, digits), lon = formatLon(corner.lon, digits);
  return (
    <div className={cls} aria-hidden="true">
      {compact ? (
        <><span><b>{ARROWS[corner.id]}</b> {lat}</span><span>{lon}</span></>
      ) : (
        <><b>{ARROWS[corner.id]}</b><span>{lat}, {lon}</span></>
      )}
    </div>
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
        const tops = [...document.querySelectorAll('.toolbar, .navigator-strip')]
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
      <GlobalStyles styles={styles} />
      {['nw', 'ne', 'sw', 'se'].map((id) => corners[id] && <Corner key={id} corner={corners[id]} digits={digits} compact={compact} />)}
      {gps.center && (
        <>
          <div className="gps-cross" aria-hidden="true" />
          <div className={compact ? 'gps-chip gps-center gps-center-compact' : 'gps-chip gps-center'} role="status" aria-live="off">
            <b>⌖</b>
            <span>{formatLat(gps.center.lat, digits)}, {formatLon(gps.center.lon, digits)}</span>
            {scale && (
              <span className="gps-scale" title="Échelle au centre de l’écran">
                <i style={{ width: `${Math.round(scale.px)}px` }} />
                {scale.label}
              </span>
            )}
            {Number.isFinite(gps.altitudeM) && <span>· alt. {formatDistance(Math.max(0, gps.altitudeM))}</span>}
          </div>
        </>
      )}
    </>
  );
}
