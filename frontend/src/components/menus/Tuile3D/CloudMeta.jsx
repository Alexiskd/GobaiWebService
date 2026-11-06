import { Chip, Stack } from '@mui/material';
import { formatPointCount, fixed } from './format';

/** Liste de métadonnées en puces (nombre de points, système de coordonnées, emprise…). */
export function MetaChips({ items }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {items.filter(Boolean).map((text) => (
        <Chip key={text} label={text} size="small" variant="outlined" sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} />
      ))}
    </Stack>
  );
}

// Métadonnées du nuage sélectionné : nombre de points, système de coordonnées et emprise native.
export function CloudMeta({ cloud }) {
  return (
    <MetaChips
      items={[
        formatPointCount(cloud.pointCount),
        cloud.coordinateSystemWkt ? 'CRS embarqué' : 'CRS non détecté dans l’en-tête LAS',
        cloud.bounds && `Emprise native : ${fixed(cloud.bounds.minX, 2)}, ${fixed(cloud.bounds.minY, 2)} – ${fixed(cloud.bounds.maxX, 2)}, ${fixed(cloud.bounds.maxY, 2)}`,
      ]}
    />
  );
}
