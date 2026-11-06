import { Paper, Typography } from '@mui/material';

// Métadonnées lues dans l'en-tête du fichier : nombre de points, format et système de coordonnées.
export function LazMeta({ metadata }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'transparent', backdropFilter: 'none', display: 'grid', gap: 0.5 }}>
      <Typography variant="body2">{metadata.pointCount.toLocaleString('fr-FR')} points · format {metadata.pointFormat}</Typography>
      <Typography variant="caption" color="text.secondary" title={metadata.crsWkt || undefined} sx={{ overflowWrap: 'anywhere' }}>
        CRS : {metadata.crsWkt ? `${metadata.crsWkt.slice(0, 90)}${metadata.crsWkt.length > 90 ? '…' : ''}` : 'non défini dans le fichier'}
      </Typography>
    </Paper>
  );
}
