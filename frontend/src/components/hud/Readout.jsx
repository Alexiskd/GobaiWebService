import { useHud } from '@/engine/hudStore';

export function Readout({ hud }) {
  const zoomText = useHud(hud, (s) => s.zoomText);
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  return (
    <div className="readout" aria-live="off">
      <span>{zoomText}</span>
      {tileZoom !== null && <span className="dim">carte niveau {tileZoom}</span>}
    </div>
  );
}
