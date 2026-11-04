import { useEffect, useState } from 'react';
import { useHud } from '@/engine/hudStore';
import { tilesApi } from '@/api';

const DEBOUNCE_MS = 700;

/** Mention de source de la carte affichée, redemandée quand la vue se stabilise. */

export default function Attribution({ hud, moonReal = false, extra = '' }) {
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
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);
  const mars = useHud(hud, (s) => s.marsTiles);
  const mercury = useHud(hud, (s) => s.mercuryTiles);
  const tileText = tiles?.layerId ? tiles.attributionText : '';
  // Lune « réelle » : détail Kaguya (fond) coloré par les couleurs naturelles NASA SVS.
  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';
  const marsText = mars?.layerId ? mars.attributionText : '';
  const mercuryText = mercury?.layerId ? mercury.attributionText : '';
  return (
    <p className="attribution">
      {tileText && <strong>{tileText}</strong>}
      {copyright && <span> {copyright}</span>}
      {moonText && <span>{tileText ? ' · ' : ''}Lune : {moonText}</span>}
      {marsText && <span>{tileText || moonText ? ' · ' : ''}Mars : {marsText}</span>}
      {mercuryText && <span>{tileText || moonText || marsText ? ' · ' : ''}Mercure : {mercuryText}</span>}
      {extra && <span>{tileText || moonText || marsText || mercuryText ? ' · ' : ''}{extra}</span>}
    </p>
  );
}
