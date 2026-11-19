// Crochets React.
import { useEffect, useMemo, useState } from 'react';
// Éléments d'interface.
import { Alert, Box, Button, Card, CardContent, Chip, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
// Icône de lien externe.
import { OpenInNewIcon } from '../../ui/icons';
// Appels vérifiés au backend.
import { requestExport, verifyExportAccess } from '@/moteur/api/store';
import { get } from '@/moteur/api/client';
import { Viewer3DDialog } from './Viewer3DDialog';

/** Copie un texte dans le presse-papiers ; renvoie vrai si cela a marché. */
async function copy(text) {
  try {
    await globalThis.navigator?.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Construit toutes les possibilités réellement permises par le scope acheté. */
function exportOptions(scopes = [], bodyCatalog = []) {
  const options = [];
  const bodiesSet = new Set();
  for (const scope of scopes) {
    if (scope === 'all') {
      bodyCatalog.forEach((body) => { if (body?.key) bodiesSet.add(body.key); });
      continue;
    }
    if (scope.startsWith('body:')) bodiesSet.add(scope.slice(5));
  }
  for (const body of bodiesSet) {
    options.push({ id: `model-${body}`, label: `Modèle 3D · ${body}`, scope: `body:${body}`, path: `/export/bodies/${body}/model.glb`, format: 'GLB', body });
    if (bodyCatalog.some((item) => item?.key === body && item.hasTiles)) {
      options.push({ id: `tiles-${body}`, label: `Fond de carte · ${body}`, scope: `tiles:${body}`, path: `/export/bodies/${body}/tiles.jpg`, format: 'JPEG', body });
    }
  }
  if (scopes.includes('tiles') || scopes.includes('all')) {
    for (const body of bodyCatalog.filter((item) => item?.hasTiles).map((item) => item.key)) {
      if (!options.some((option) => option.id === `tiles-${body}`)) {
        options.push({ id: `tiles-${body}`, label: `Fond de carte · ${body}`, scope: scopes.includes('all') ? 'all' : 'tiles', path: `/export/bodies/${body}/tiles.jpg`, format: 'JPEG', body });
      }
    }
  }
  for (const scope of scopes) {
    if (scope.startsWith('orbit:')) {
      const body = scope.slice(6);
      options.push({ id: `orbit-${body}`, label: body === 'soleil' ? 'Position apparente · Soleil' : `Trajectoire orbitale · ${body}`, scope, path: '/export/orbits', format: 'JSON', body });
    }
  }
  return options;
}

/** Une carte d'achat, qui affiche uniquement les exports effectivement autorisés après vérification serveur. */
function AchatCard({ licence, apiBase, bodies = [], layers = [] }) {
  const [open, setOpen] = useState(false);
  const [viewerBody, setViewerBody] = useState('');
  const [copied, setCopied] = useState('');
  const [verification, setVerification] = useState({ state: 'checking', message: 'Vérification cryptographique du jeton…', scopes: [] });
  const [tokenReady, setTokenReady] = useState(false);
  const [downloads, setDownloads] = useState({});
  const [params, setParams] = useState({ zoom: 4, quality: 'normale', steps: 365, from: '', to: '', layer: '' });
  const options = useMemo(() => exportOptions(verification.scopes, bodies), [verification.scopes, bodies]);

  useEffect(() => {
    let alive = true;
    setTokenReady(false);
    verifyExportAccess(licence.token).then((result) => {
      if (alive) { setTokenReady(true); setVerification({ state: 'valid', message: 'Jeton authentifié par le backend.', scopes: result.scopes || [] }); }
    }).catch((error) => {
      if (!alive) return;
      setVerification({
        state: error.status === 401 ? 'invalid' : error.status === 403 ? 'forbidden' : 'unavailable',
        message: error.status === 401
          ? `Jeton refusé (401) : ${error.message}`
          : error.status === 403
            ? `Droits refusés (403) : ${error.message}`
            : `Vérification indisponible : ${error.message}`,
        scopes: [],
      });
      setTokenReady(false);
    });
    return () => { alive = false; };
  }, [licence.token]);

  const copyToken = async () => setCopied(await copy(licence.token) ? 'Clé copiée.' : 'Copie refusée par le navigateur.');
  const download = async (option) => {
    if (!tokenReady) return;
    setDownloads((state) => ({ ...state, [option.id]: 'Téléchargement…' }));
    try {
      const selectedLayer = params.layer || layers.find((layer) => layer.body === option.body)?.id;
      const query = option.format === 'GLB'
        ? { zoom: params.zoom, quality: params.quality, ...(selectedLayer ? { layer: selectedLayer } : {}) }
        : option.format === 'JPEG'
          ? { zoom: params.zoom, ...(selectedLayer ? { layer: selectedLayer } : {}) }
          : { body: option.body, steps: params.steps, ...(params.from ? { from: new Date(params.from).toISOString() } : {}), ...(params.to ? { to: new Date(params.to).toISOString() } : {}) };
      const response = await requestExport(option.path, licence.token, { query });
      if (option.format === 'JSON') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gobai-${option.body}-orbite.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = match?.[1] || `gobai-${option.id.toLowerCase()}.${option.format.toLowerCase()}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setDownloads((state) => ({ ...state, [option.id]: 'Téléchargement terminé.' }));
    } catch (error) {
      setDownloads((state) => ({ ...state, [option.id]: error.status === 401 ? `401 · Jeton invalide/expiré : ${error.message}` : error.status === 403 ? `403 · Droit absent : ${error.message}` : error.message || 'Échec du téléchargement.' }));
    }
  };

  return (
    <Card variant="outlined" sx={{ bgcolor: 'transparent' }}>
      <CardContent sx={{ display: 'grid', gap: 1, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography component="h4" variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>{licence.product.label}</Typography>
          <Typography variant="caption" color="text.secondary">
            {licence.hours > 1 ? `${licence.hours} h · ` : ''}jusqu’au {new Date(licence.expiresAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {licence.scopes.map((scope) => <Chip key={scope} size="small" variant="outlined" label={scope} sx={{ fontFamily: 'monospace' }} />)}
        </Stack>
        <Alert severity={verification.state === 'valid' ? 'success' : verification.state === 'checking' ? 'info' : 'error'}>
          {verification.message}
        </Alert>
        {verification.state === 'valid' && options.length > 0 && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Typography variant="subtitle2">Exports autorisés pour cet achat</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
              <TextField select size="small" label="Zoom" value={params.zoom} onChange={(event) => setParams((value) => ({ ...value, zoom: Number(event.target.value) }))}>
                {[0,1,2,3,4,5].map((zoom) => <MenuItem key={zoom} value={zoom}>{zoom}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Qualité du modèle" value={params.quality} onChange={(event) => setParams((value) => ({ ...value, quality: event.target.value }))}>
                {['basse','normale','haute'].map((quality) => <MenuItem key={quality} value={quality}>{quality}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="Points orbitaux" value={params.steps} onChange={(event) => setParams((value) => ({ ...value, steps: Math.max(1, Math.min(10000, Number(event.target.value) || 1)) }))} />
              <TextField select size="small" label="Couche API" value={params.layer} onChange={(event) => setParams((value) => ({ ...value, layer: event.target.value }))}>
                <MenuItem value="">Automatique par astre</MenuItem>
                {layers.filter((layer) => layer.body).map((layer) => (
                  <MenuItem key={layer.id} value={layer.id}>{layer.label} · {layer.body} · {layer.provider}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              <TextField size="small" label="Début (UTC, facultatif)" type="datetime-local" InputLabelProps={{ shrink: true }} value={params.from} onChange={(event) => setParams((value) => ({ ...value, from: event.target.value }))} />
              <TextField size="small" label="Fin (UTC, facultatif)" type="datetime-local" InputLabelProps={{ shrink: true }} value={params.to} onChange={(event) => setParams((value) => ({ ...value, to: event.target.value }))} />
            </Box>
            {options.map((option) => (
              <Stack key={option.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ justifyContent: 'space-between', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{option.format} · {option.path}</Typography>
                  {downloads[option.id] && <Typography variant="caption" display="block" color={downloads[option.id].startsWith('401') || downloads[option.id].startsWith('403') ? 'error' : 'text.secondary'}>{downloads[option.id]}</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  {option.format === 'GLB' && <Button size="small" variant="contained" onClick={() => setViewerBody(option.body)} disabled={!tokenReady}>Lancer dans Gobai Space</Button>}
                  <Button size="small" variant="outlined" onClick={() => download(option)} disabled={!tokenReady || Boolean(downloads[option.id] === 'Téléchargement…')}>Télécharger</Button>
                </Stack>
              </Stack>
            ))}
          </Box>
        )}
        {verification.state === 'valid' && options.length === 0 && <Alert severity="warning">Aucun droit d’export reconnu dans ce jeton. Contactez le support avec l’identifiant de votre achat.</Alert>}
        <TextField size="small" multiline maxRows={3} value={licence.token} label="Clé d’API (JWT signé, non chiffré)" slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '0.72rem' } } }} />
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" onClick={copyToken}>Copier la clé</Button>
          <Button size="small" onClick={() => setOpen((value) => !value)}>{open ? 'Masquer le code' : 'Afficher les droits du jeton'}</Button>
          {copied && <Typography variant="caption" color="text.secondary" role="status">{copied}</Typography>}
        </Stack>
        <Viewer3DDialog open={Boolean(viewerBody)} body={viewerBody} licenceToken={licence.token} onClose={() => setViewerBody('')} />
        {open && <Box component="pre" sx={{ m: 0, p: 1.25, fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', borderRadius: 1.5, bgcolor: 'action.hover' }}>{JSON.stringify({ scopes: verification.scopes, expiresAt: licence.expiresAt }, null, 2)}</Box>}
      </CardContent>
    </Card>
  );
}

export function MesAchats({ licences, bodies = [], apiBase, docsUrl, persistent }) {
  const [layers, setLayers] = useState([]);
  useEffect(() => {
    let alive = true;
    get('/tiles/layers').then((data) => { if (alive) setLayers(data.layers || []); })
      .catch(() => { if (alive) setLayers([]); });
    return () => { alive = false; };
  }, []);
  if (!licences.length) return null;
  return (
    <Box component="section" aria-label="Mes achats" sx={{ display: 'grid', gap: 1 }}>
      <Typography component="h3" variant="subtitle2">Mes clés d’API</Typography>
      <Typography variant="body2" color="text.secondary">
        Chaque clé est vérifiée cryptographiquement par le backend avant d’activer les téléchargements. Un jeton
        JWT est signé, mais sa charge n’est pas chiffrée : ne le partagez pas publiquement. Les permissions sont
        contrôlées à nouveau sur chaque route de téléchargement.
        {persistent === false && ' Attention : ce serveur garde les achats en mémoire, ils seront perdus à son redémarrage.'}
        {docsUrl && <> {' '}Documentation de l’API : <Link href={docsUrl} target="_blank" rel="noreferrer">ouvrir Swagger <OpenInNewIcon sx={{ fontSize: '0.9rem', verticalAlign: '-0.15em' }} /></Link></>}
      </Typography>
      <Stack spacing={1}>
        {licences.map((licence) => <AchatCard key={licence.payment || licence.product.id} licence={licence} bodies={bodies} layers={layers} apiBase={apiBase} />)}
      </Stack>
    </Box>
  );
}
