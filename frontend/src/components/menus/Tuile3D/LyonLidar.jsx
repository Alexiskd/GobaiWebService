import { useMemo } from 'react';
import { Alert, Box, Link, Stack, Typography } from '@mui/material';
import { resolveApiUrl } from '@/api';
import { formatPointCount } from './format';
import { MetaChips } from './CloudMeta';

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
    <Stack component="section" spacing={1} aria-label="LiDAR de la Métropole de Lyon">
      <Typography component="h3" variant="subtitle2">LiDAR Métropole de Lyon · 2018</Typography>
      {dataset.status === 'loading' && <Typography variant="body2" color="text.secondary">Chargement des métadonnées EPT…</Typography>}
      {dataset.status === 'error' && <Alert severity="error">Jeu de données indisponible : {dataset.error}</Alert>}
      {dataset.data && (
        <>
          <MetaChips
            items={[
              formatPointCount(dataset.data.pointCount),
              dataset.data.coordinateSystem,
              dataset.data.license,
              dataset.data.note,
            ]}
          />
          {viewerUrl ? (
            <Box
              component="iframe"
              title="Viewer Potree du LiDAR de la Métropole de Lyon"
              src={viewerUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="fullscreen"
              allowFullScreen
              sx={{ width: '100%', height: 'clamp(240px, 42dvh, 520px)', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: '#000' }}
            />
          ) : (
            <Alert severity="error">Adresse EPT invalide.</Alert>
          )}
          {dataset.data.sourceUrl && (
            <Link href={dataset.data.sourceUrl} target="_blank" rel="noreferrer noopener" variant="body2" sx={{ alignSelf: 'flex-start' }}>
              Source officielle — data.gouv.fr
            </Link>
          )}
        </>
      )}
    </Stack>
  );
}
