import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Paper, Typography, useMediaQuery } from '@mui/material';
import { cloudBaseUrl } from './format';
import { QUERIES, safe } from '@/theme/mediaQueries';
import { edge } from '@/theme/layout';
import { usePointCloudCatalog } from './usePointCloudCatalog';
import { useLyonDataset } from './useLyonDataset';
import { usePanelLock } from './usePanelLock';
import { Tuile3DHeader } from './Tuile3DHeader';
import { CityLocation } from './CityLocation';
import { LyonLidar } from './LyonLidar';
import { CloudSelect } from './CloudSelect';
import { CloudMeta } from './CloudMeta';
import { PotreeViewer } from './PotreeViewer';

// Panneau « Tuile 3D » : nuage de points Potree d'une ville.
// Écran large : panneau flottant. Mobile / téléphone en paysage : plein écran.
// Composants MUI stylés par `sx` ; la disposition suit `useMediaQuery`.

export function Tuile3D({ city, open, onClose }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const coarse = useMediaQuery(QUERIES.coarse, { noSsr: true });
  const catalog = usePointCloudCatalog(open);
  const [selectedName, setSelectedName] = useState('');
  const cityKey = city ? `${city.name}|${city.lat}|${city.lon}` : '';
  const isLyon = /lyon/i.test(city?.name || '');
  const lyonDataset = useLyonDataset(open, isLyon);
  usePanelLock(open, onClose, compact);

  // `potreeUrl` ou `potreeBaseUrl` : le filtre et le viewer utilisent maintenant la même règle.
  const available = useMemo(() => catalog.items.filter((item) => cloudBaseUrl(item)), [catalog.items]);
  const selected = available.find((item) => item.name === selectedName) || available[0] || null;

  useEffect(() => {
    if (available.length && !available.some((item) => item.name === selectedName)) {
      setSelectedName(available[0].name);
    }
  }, [available, selectedName]);

  if (!open || !city) return null;

  return (
    <Paper
      component="section"
      elevation={12}
      role="dialog"
      aria-modal={compact ? 'true' : 'false'} // plein écran sur mobile : c'est alors une vraie modale
      aria-label={`Nuages 3D de ${city.name}`}
      sx={{
        position: 'fixed', zIndex: (t) => t.zIndex.panel, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        ...(compact ? {
          inset: 0, borderRadius: 0, pt: safe('top'), pb: safe('bottom'),
        } : {
          right: edge('right'), top: '50%', transform: 'translateY(-50%)',
          width: 'clamp(340px, 34vw, 560px)', maxHeight: 'min(80vh, 780px)',
        }),
      }}
    >
      <Tuile3DHeader name={city.name} onClose={onClose} />
      <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', p: 2, display: 'grid', gap: 1.5, minHeight: 0 }}>
        <CityLocation lat={Number(city.lat)} lon={Number(city.lon)} />
        {isLyon && <LyonLidar dataset={lyonDataset} />}
        {catalog.status === 'loading' && <Typography variant="body2" color="text.secondary">Recherche des jeux de données…</Typography>}
        {catalog.status === 'error' && <Alert severity="error">Catalogue indisponible : {catalog.error}</Alert>}
        {catalog.status === 'ready' && !available.length && !isLyon && (
          <Alert severity="info">
            Aucun jeu Potree converti n’est associé. Placez les données converties dans
            <Box component="code" sx={{ ml: 0.5 }}>POINTCLOUD_DIR/potree/&lt;nom-du-fichier&gt;/cloud.js</Box>.
          </Alert>
        )}
        {selected && (
          <>
            {available.length > 1 && <CloudSelect items={available} value={selected.name} onChange={setSelectedName} />}
            <CloudMeta cloud={selected} />
            <PotreeViewer key={`${cityKey}|${selected.name}`} cloud={selected} coarse={coarse} />
          </>
        )}
      </Box>
    </Paper>
  );
}
