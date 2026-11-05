import { formatPointCount, fixed } from './format';

// Métadonnées du nuage sélectionné : nombre de points, système de coordonnées et emprise native.
export function CloudMeta({ cloud }) {
  return (
    <div className="city-pointcloud-meta">
      <span>{formatPointCount(cloud.pointCount)}</span>
      <span>{cloud.coordinateSystemWkt ? 'CRS embarqué' : 'CRS non détecté dans l’en-tête LAS'}</span>
      {cloud.bounds && (
        <span>
          Emprise native : {fixed(cloud.bounds.minX, 2)}, {fixed(cloud.bounds.minY, 2)}
          {' – '}{fixed(cloud.bounds.maxX, 2)}, {fixed(cloud.bounds.maxY, 2)}
        </span>
      )}
    </div>
  );
}
