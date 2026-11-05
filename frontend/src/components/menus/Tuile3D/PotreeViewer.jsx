import { cloudBaseUrl } from './format';
import { usePotreeViewer } from './usePotreeViewer';

// Viewer Potree : canvas WebGL du nuage, boutons de recentrage et plein écran.
export function PotreeViewer({ cloud, coarse }) {
  const { hostRef, status, error, recenter, fullscreen } = usePotreeViewer(cloudBaseUrl(cloud), coarse);

  return (
    <>
      <div className="city-pointcloud-viewer" aria-label={`Nuage 3D : ${cloud.name}`}>
        <div className="city-pointcloud-canvas-host" ref={hostRef} />
        {status === 'ready' && (
          <div className="city-pointcloud-tools">
            <button type="button" onClick={recenter} title="Recentrer la vue" aria-label="Recentrer la vue">◎</button>
            <button type="button" onClick={fullscreen} title="Plein écran" aria-label="Plein écran">⛶</button>
          </div>
        )}
        {status === 'loading' && <p className="city-pointcloud-message">Chargement du nuage Potree…</p>}
        {status === 'error' && <p className="city-pointcloud-message is-error">Viewer indisponible : {error}</p>}
      </div>
      {status === 'ready' && (
        <p className="city-pointcloud-hint">
          {coarse
            ? 'Un doigt pour tourner · deux doigts pour zoomer et déplacer'
            : 'Glisser pour tourner · clic droit pour déplacer · molette pour zoomer'}
        </p>
      )}
    </>
  );
}
