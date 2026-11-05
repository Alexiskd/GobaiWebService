// Métadonnées lues dans l'en-tête du fichier : nombre de points, format et système de coordonnées.
export function LazMeta({ metadata }) {
  return (
    <div className="contribution-meta">
      <span>{metadata.pointCount.toLocaleString('fr-FR')} points · format {metadata.pointFormat}</span>
      <span title={metadata.crsWkt || undefined}>
        CRS : {metadata.crsWkt ? `${metadata.crsWkt.slice(0, 90)}${metadata.crsWkt.length > 90 ? '…' : ''}` : 'non défini dans le fichier'}
      </span>
    </div>
  );
}
