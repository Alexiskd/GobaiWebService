import { useEffect, useState } from 'react';
import { tilesApi } from '@/api';
import { useHud } from '@/engine/hudStore';
import { useViewport } from '@/hooks/useViewport';

const ATTRIBUTION_DEBOUNCE_MS = 700;

/** Mention de source de la carte affichée, redemandée quand la vue se stabilise. */
export function Attribution({ hud, moonReal = false, extra = '' }) {
  const { compact } = useViewport();
  const tiles = useHud(hud, (s) => s.tiles);
  const layerId = tiles?.layerId ?? null;
  const b = tiles?.bounds ?? null;
  const [copyright, setCopyright] = useState('');

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
      {tileText && <strong>{tileText}</strong>}
      {parts.map((p, i) => (
        <span key={p.key}>{(tileText || i > 0) ? (p.key === 'c' ? ' ' : ' · ') : ''}{p.node}</span>
      ))}
    </>
  );

  // Petit écran : les sources sont repliées derrière un bouton pour libérer la carte.
  if (compact) {
    return (
      <details className="attribution attribution-compact">
        <summary aria-label="Afficher les sources">ⓘ Sources</summary>
        <p>{content}</p>
      </details>
    );
  }
  return <p className="attribution">{content}</p>;
}
