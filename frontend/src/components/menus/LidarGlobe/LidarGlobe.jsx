import { Suspense, lazy, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActions, CardContent, CircularProgress, FormControlLabel, LinearProgress, MenuItem,
  Paper, Slider, Stack, Switch, TextField, Typography, useMediaQuery,
} from '@mui/material';
import { QUERIES, safe } from '@/theme/mediaQueries';
import { RAIL, edge } from '@/theme/layout';
import { PanelHeader } from '../../ui/PanelHeader';

// Panneau « LiDAR » : dépose des fichiers .las / .laz (ou une URL), liste des nuages posés sur le globe et réglages.
// L'état et la couche 3D vivent dans useGlobeLidar (SolarScene) : fermer le panneau garde les nuages affichés.
// Écran large : panneau flottant à gauche. Mobile / téléphone en paysage : plein écran.

const LidarViewer = lazy(() => import('@lidar/LidarViewer.jsx').then((m) => ({ default: m.LidarViewer })));
const MODES = [
  { id: 'rgb', label: 'Couleurs', needsRgb: true },
  { id: 'elevation', label: 'Altitude' },
  { id: 'intensity', label: 'Intensité' },
  { id: 'classification', label: 'Classes' },
  { id: 'returns', label: 'Retours' },
];
const nf = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const count = (v) => (v >= 1e6 ? `${nf(v / 1e6, 1)} M` : v >= 1e4 ? `${nf(v / 1e3)} k` : nf(v));
const coords = (lat, lon) => `${nf(Math.abs(lat), 5)}° ${lat >= 0 ? 'N' : 'S'} · ${nf(Math.abs(lon), 5)}° ${lon >= 0 ? 'E' : 'O'}`;
const meters = (v) => (v >= 1000 ? `${nf(v / 1000, 1)} km` : `${nf(v)} m`);

function PositionForm({ cloud, onPlace }) {
  const [lat, setLat] = useState(cloud.lat ?? '');
  const [lon, setLon] = useState(cloud.lon ?? '');
  const [invalid, setInvalid] = useState(false);
  const submit = (event) => {
    event.preventDefault();
    const ok = onPlace(cloud.id, Number(String(lat).replace(',', '.')), Number(String(lon).replace(',', '.')));
    setInvalid(!ok);
  };
  return (
    <Box component="form" onSubmit={submit}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField size="small" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': 'Latitude' } }} />
        <TextField size="small" placeholder="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': 'Longitude' } }} />
        <Button type="submit" variant="contained">Placer</Button>
      </Stack>
      {invalid && <Typography variant="body2" color="error" sx={{ mt: 1 }}>Latitude entre −90 et 90, longitude entre −180 et 180.</Typography>}
    </Box>
  );
}

function CloudCard({ cloud, lidar, onInspect }) {
  const { info } = cloud;
  const ready = cloud.status === 'ready';
  const pct = Math.round((cloud.ratio || 0) * 100);
  return (
    <Card variant="outlined" component="article" sx={{ bgcolor: 'transparent', backdropFilter: 'none' }}>
      <CardContent sx={{ display: 'grid', gap: 1, pb: 1 }}>
        <Typography component="h3" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{cloud.name}</Typography>
        {cloud.status === 'loading' && (
          <>
            <Typography variant="caption" color="text.secondary">{cloud.phase} · {pct} %</Typography>
            <LinearProgress variant="determinate" value={pct} />
          </>
        )}
        {cloud.status === 'error' && <Alert severity="error">{cloud.error}</Alert>}
        {info && (
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            {count(info.pointCount)} points{info.stride > 1 ? ` (1 sur ${info.stride} des ${count(info.filePointCount)})` : ''}
            {' · '}{meters(info.sizeMeters[0])} × {meters(info.sizeMeters[1])}
            <br />{info.crsLabel || 'Système non défini'}{info.projection ? ` → ${info.projection}` : ''}
            {Number.isFinite(cloud.lat) && <><br />{coords(cloud.lat, cloud.lon)}</>}
          </Typography>
        )}
        {cloud.status === 'needs-position' && (
          <>
            <Alert severity="warning">Système de coordonnées non reconnu : indiquez la position du centre (grille supposée en mètres, x vers l’est).</Alert>
            <PositionForm cloud={cloud} onPlace={lidar.place} />
          </>
        )}
        {ready && (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                label="Couleur des points"
                value={cloud.colorMode || 'elevation'}
                onChange={(e) => lidar.setColorMode(cloud.id, e.target.value)}
                sx={{ flex: 1 }}
              >
                {MODES.filter((m) => !m.needsRgb || info?.hasRgb).map((m) => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
              </TextField>
              <Button variant="outlined" onClick={() => lidar.flyTo(cloud.id)}>Aller</Button>
            </Stack>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Switch size="small" checked={cloud.visible} onChange={(e) => lidar.setVisible(cloud.id, e.target.checked)} />}
                label={<Typography variant="body2">Visible</Typography>}
              />
              <FormControlLabel
                title="Le globe n'a pas de relief : le sol du nuage est posé sur la sphère. Décoché : altitude du fichier."
                control={<Switch size="small" checked={cloud.groundClamp} onChange={(e) => lidar.setGroundClamp(cloud.id, e.target.checked)} />}
                label={<Typography variant="body2">Poser au sol</Typography>}
              />
            </Stack>
          </>
        )}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
        {info && <Button size="small" onClick={() => onInspect(cloud)}>Vue détaillée</Button>}
        <Button size="small" color="error" onClick={() => lidar.remove(cloud.id)}>{cloud.status === 'loading' ? 'Annuler' : 'Retirer'}</Button>
      </CardActions>
    </Card>
  );
}

export function LidarGlobe({ open, onClose, lidar }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState('');
  const [inspected, setInspected] = useState(null);

  const onDrop = (event) => {
    event.preventDefault();
    setOver(false);
    lidar.addFiles(event.dataTransfer?.files);
  };
  const submitUrl = (event) => {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;
    lidar.addUrl(value);
    setUrl('');
  };

  return (
    <>
      {open && (
        <Paper
          component="section"
          elevation={12}
          role="dialog"
          aria-modal={compact ? 'true' : 'false'}
          aria-label="Nuages LiDAR sur le globe"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
          onDrop={onDrop}
          sx={{
            position: 'fixed', zIndex: (t) => t.zIndex.panel, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            ...(compact ? {
              inset: 0, borderRadius: 0, pt: safe('top'), pb: safe('bottom'),
            } : {
              left: `calc(${edge('left')} + ${RAIL + 14}px)`, top: '50%', transform: 'translateY(-50%)',
              width: 'min(400px, calc(100vw - 28px))', maxHeight: 'min(80vh, 780px)',
            }),
          }}
        >
          <PanelHeader kicker="Nuages de points" title="LiDAR sur le globe" onClose={onClose} />
          <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', p: 2, display: 'grid', gap: 1.5, minHeight: 0 }}>
            <Stack
              spacing={1}
              alignItems="center"
              sx={{
                textAlign: 'center', p: 2, borderRadius: 2, border: '1px dashed',
                borderColor: over ? 'primary.main' : 'divider', bgcolor: over ? 'action.hover' : 'transparent',
              }}
            >
              <Typography variant="body2" color="text.secondary">Déposez des fichiers .las / .laz géoréférencés (Lambert-93, CC, UTM, WGS84…)</Typography>
              <Button variant="contained" onClick={() => inputRef.current?.click()}>Ouvrir des fichiers</Button>
              <input
                ref={inputRef}
                type="file"
                accept=".las,.laz"
                multiple
                hidden
                onChange={(e) => { lidar.addFiles(e.target.files); e.target.value = ''; }}
              />
            </Stack>
            <Stack component="form" direction="row" spacing={1} onSubmit={submitUrl}>
              <TextField
                size="small"
                fullWidth
                placeholder="ou URL d’un .las / .laz"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': 'URL d’un nuage' } }}
              />
              <Button type="submit" variant="outlined">Charger</Button>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary" id="lidar-point-size" sx={{ whiteSpace: 'nowrap' }}>Taille des points</Typography>
              <Slider
                size="small"
                min={1}
                max={8}
                step={0.5}
                value={lidar.pointSize}
                onChange={(_, v) => lidar.setPointSize(Number(v))}
                aria-labelledby="lidar-point-size"
              />
              <Typography variant="body2" sx={{ whiteSpace: 'nowrap', minWidth: 44 }}>{nf(lidar.pointSize, 1)} px</Typography>
            </Stack>
            {lidar.clouds.length === 0 && (
              <Typography variant="body2" color="text.secondary">Aucun nuage chargé. Les points s’affichent à leur position réelle sur la Terre.</Typography>
            )}
            {lidar.clouds.map((cloud) => <CloudCard key={cloud.id} cloud={cloud} lidar={lidar} onInspect={setInspected} />)}
          </Box>
        </Paper>
      )}
      {inspected && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 10, bgcolor: '#05070d' }}>
          <Suspense
            fallback={(
              <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ height: '100%' }}>
                <CircularProgress />
                <Typography color="text.secondary">Chargement de la visionneuse…</Typography>
              </Stack>
            )}
          >
            <LidarViewer source={inspected.source} name={inspected.name} onClose={() => setInspected(null)} sx={{ height: '100%' }} />
          </Suspense>
        </Box>
      )}
    </>
  );
}
