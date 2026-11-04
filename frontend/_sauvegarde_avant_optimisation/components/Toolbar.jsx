import { useHud } from '@/engine/hudStore';

function Readout({ hud }) {
  const zoomText = useHud(hud, (s) => s.zoomText);
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  return (
    <div className="readout" aria-live="off">
      <span>{zoomText}</span>
      {tileZoom !== null && <span className="dim">carte niveau {tileZoom}</span>}
    </div>
  );
}

export default function Toolbar({
  hud, auto, tilt, layersOpen, p2pOpen, peerCount = 0,
  onSearch, onToggleLayers, onToggleAuto, onToggleTilt, onToggleP2P, onReset,
}) {
  return (
    <>
      <Readout hud={hud} />
      <div className="toolbar" role="toolbar" aria-label="Actions">
        <button onClick={onSearch} title="Rechercher une ville ou un astre (Ctrl K)">Rechercher</button>
        <button aria-pressed={layersOpen} onClick={onToggleLayers}>Couches</button>
        <button aria-pressed={p2pOpen} onClick={onToggleP2P} title="Pair-à-pair : tuiles, fichiers et visite synchronisée (P)">
          P2P{peerCount > 0 ? ` · ${peerCount}` : ''}
        </button>
        <button aria-pressed={auto} onClick={onToggleAuto} title="Rotation automatique">Rotation</button>
        <button aria-pressed={tilt} onClick={onToggleTilt} title="Vue 3/4 automatique en approchant du sol">Vue 3/4</button>
        <button onClick={onReset} title="Retour à la vue d’ensemble (0 du pavé numérique)">Vue globale</button>
      </div>
    </>
  );
}
