import { useEffect, useRef, useState } from 'react';
import { Button, Popover, Typography } from '@mui/material';
import { tilesApi } from '@/api';
import { useHud } from '@/engine/hudStore';
import { useViewport } from '@/hooks/useViewport';
import { STRIP_H, TOOLBAR_H, edge } from '@/theme/layout';
import { safe } from '@/theme/mediaQueries';
import { InfoIcon } from '../ui/icons';

const ATTRIBUTION_DEBOUNCE_MS = 700;

/** Mention de source de la carte affichée, redemandée quand la vue se stabilise. */
export function Attribution({ hud, moonReal = false, extra = '' }) {
  const { compact } = useViewport();
  const tiles = useHud(hud, (s) => s.tiles);
  const layerId = tiles?.layerId ?? null;
  const b = tiles?.bounds ?? null;
  const [copyright, setCopyright] = useState('');
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);

  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;
  useEffect(() => {
    if (!layerId || !b) { setCopyright(''); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});
    }, ATTRIBUTION_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);
  const mars = useHud(hud, (s) => s.marsTiles);
  const mercury = useHud(hud, (s) => s.mercuryTiles);
  const venus = useHud(hud, (s) => s.venusTiles);
  const tileText = tiles?.layerId ? tiles.attributionText : '';
  // Lune « réelle » : détail Kaguya (fond) coloré par les couleurs naturelles NASA SVS.
  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';

  // Construction en liste : plus de cascade de conditions pour les séparateurs.
  const parts = [
    copyright && { key: 'c', node: <span>{copyright}</span> },
    moonText && { key: 'moon', node: <span>Lune : {moonText}</span> },
    mars?.layerId && { key: 'mars', node: <span>Mars : {mars.attributionText}</span> },
    mercury?.layerId && { key: 'mercury', node: <span>Mercure : {mercury.attributionText}</span> },
    venus?.layerId && { key: 'venus', node: <span>Vénus : {venus.attributionText}</span> },
    extra && { key: 'extra', node: <span>{extra}</span> },
  ].filter(Boolean);

  if (!tileText && !parts.length) return null;

  const content = (
    <>
      {tileText && <Typography component="strong" variant="inherit" sx={{ fontWeight: 600, color: 'text.primary' }}>{tileText}</Typography>}
      {parts.map((p, i) => (
        <span key={p.key}>{(tileText || i > 0) ? (p.key === 'c' ? ' ' : ' · ') : ''}{p.node}</span>
      ))}
    </>
  );

  // Petit écran : les sources sont repliées derrière un bouton pour libérer la carte.
  if (compact) {
    return (
      <>
        <Button
          ref={anchor}
          size="small"
          variant="text"
          color="inherit"
          startIcon={<InfoIcon fontSize="small" />}
          aria-label="Afficher les sources"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          sx={{
            position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', 6),
            bottom: `calc(${TOOLBAR_H + STRIP_H + 8}px + ${safe('bottom')})`,
            minHeight: 32, opacity: 0.85, textShadow: '0 0 4px #000',
          }}
        >
          Sources
        </Button>
        <Popover
          open={open}
          anchorEl={anchor.current}
          onClose={() => setOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          slotProps={{ paper: { sx: { p: 1.5, maxWidth: 'min(360px, calc(100vw - 24px))', maxHeight: '30dvh', overflowY: 'auto' } } }}
        >
          <Typography variant="caption" color="text.secondary" component="p">{content}</Typography>
        </Popover>
      </>
    );
  }
  return (
    <Typography
      variant="caption"
      component="p"
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right'), bottom: `calc(${safe('bottom')} + 76px)`,
        maxWidth: '46vw', textAlign: 'right', color: 'text.secondary', textShadow: '0 0 4px #000, 0 0 2px #000',
        pointerEvents: 'none', fontSize: '0.68rem', m: 0,
      }}
    >
      {content}
    </Typography>
  );
}
