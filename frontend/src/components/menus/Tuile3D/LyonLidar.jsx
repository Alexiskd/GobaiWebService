import { useMemo } from 'react';
import { resolveApiUrl } from '@/api';
import { formatPointCount } from './format';

// Section « LiDAR Métropole de Lyon » : métadonnées EPT et viewer Potree externe.
export function LyonLidar({ dataset }) {
  // Calculée une seule fois par jeu de données, et sans planter sur une URL invalide.
  const viewerUrl = useMemo(() => {
    if (!dataset.data?.eptUrl) return '';
    try {
      const ept = new URL(resolveApiUrl(dataset.data.eptUrl), window.location.origin).href;
      return `https://potree.org/potree/examples/ept.html?r=${encodeURIComponent(ept)}`;
    } catch {
      return '';
    }
  }, [dataset.data]);

  return (
    <section className="city-pointcloud-lyon" aria-label="LiDAR de la Métropole de Lyon">
      <h3>LiDAR Métropole de Lyon · 2018</h3>
      {dataset.status === 'loading' && <p className="city-pointcloud-message">Chargement des métadonnées EPT…</p>}
      {dataset.status === 'error' && (
        <p className="city-pointcloud-message is-error">Jeu de données indisponible : {dataset.error}</p>
      )}
      {dataset.data && (
        <>
          <div className="city-pointcloud-meta">
            <span>{formatPointCount(dataset.data.pointCount)}</span>
            {dataset.data.coordinateSystem && <span>{dataset.data.coordinateSystem}</span>}
            {dataset.data.license && <span>{dataset.data.license}</span>}
            {dataset.data.note && <span>{dataset.data.note}</span>}
          </div>
          {viewerUrl ? (
            <iframe
              className="city-pointcloud-ept-frame"
              title="Viewer Potree du LiDAR de la Métropole de Lyon"
              src={viewerUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <p className="city-pointcloud-message is-error">Adresse EPT invalide.</p>
          )}
          {dataset.data.sourceUrl && (
            <a href={dataset.data.sourceUrl} target="_blank" rel="noreferrer noopener">
              Source officielle — data.gouv.fr
            </a>
          )}
        </>
      )}
    </section>
  );
}
