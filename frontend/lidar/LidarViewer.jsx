import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Checkbox, Chip, Divider, IconButton, LinearProgress, MenuItem, Paper, Select, Slider, Stack, Switch,
  ThemeProvider, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { LidarEngine } from './LidarEngine.js';
import { COLOR_MODES, GRADIENTS, classInfo } from './colormaps.js';
import { crayonBox, crayonTheme } from '@/styles/crayonMuiTheme';

// Visionneuse LiDAR : dépôt d'un fichier .las / .laz, réglages d'affichage, classes, outils de mesure.
// Thème crayon partagé (ThemeProvider local : la visionneuse reste utilisable hors de l'app). Plein écran sur mobile pour le panneau de réglages.

// Thème crayon de l'application (traits blancs sur bleu), partagé avec les styles globaux.
const theme = crayonTheme;

const COMPACT = '(max-width: 720px), (max-height: 500px) and (pointer: coarse)';
const nf = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const count = (v) => (v >= 1e6 ? `${nf(v / 1e6, v >= 1e7 ? 0 : 1)} M` : v >= 1e4 ? `${nf(v / 1e3)} k` : nf(v));
const glass = crayonBox;

function Section({ title, children, action }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="overline" sx={{ lineHeight: 1.6, letterSpacing: '0.08em', opacity: 0.65 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Stack>
  );
}

function Row({ label, children, hint }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ minHeight: 36 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        {hint && <Typography variant="caption" sx={{ opacity: 0.55, display: 'block' }}>{hint}</Typography>}
      </Box>
      {children}
    </Stack>
  );
}

function Swatch({ color }) {
  return <Box component="span" sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color, flex: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }} />;
}

/**
 * @param source       File, Blob, ArrayBuffer ou URL à charger d'emblée (facultatif)
 * @param name         nom affiché du nuage
 * @param maxPoints    points chargés au maximum (défaut 25 millions)
 * @param lazWasmBase  dossier de laz-perf.wasm si besoin
 * @param onClose      affiche un bouton Fermer
 * @param onLoaded     (info) => … après chargement
 */
export function LidarViewer({ source = null, name, maxPoints, lazWasmBase, onClose, onLoaded, sx }) {
  const compact = useMediaQuery(COMPACT, { noSsr: true });
  const coarse = useMediaQuery('(pointer: coarse)', { noSsr: true });
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const fileRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [progress, setProgress] = useState({ phase: '', ratio: 0 });
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [picked, setPicked] = useState(null);
  const [measure, setMeasure] = useState(null);
  const [zRange, setZRange] = useState(null);
  const [classes, setClasses] = useState({});
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia?.(COMPACT).matches);
  const [dragOver, setDragOver] = useState(false);

  // Moteur : créé une fois, détruit au démontage.
  useEffect(() => {
    let engine;
    try {
      engine = new LidarEngine(hostRef.current, { maxPoints, lazWasmBase });
    } catch (e) {
      setStatus('error');
      setError(e.message);
      return undefined;
    }
    engineRef.current = engine;
    const offs = [
      engine.on('progress', setProgress),
      engine.on('stats', setStats),
      engine.on('pick', setPicked),
      engine.on('measure', setMeasure),
    ];
    return () => {
      offs.forEach((off) => off());
      engine.dispose();
      engineRef.current = null;
    };
  }, [maxPoints, lazWasmBase]);

  const load = useCallback(async (src, label) => {
    const engine = engineRef.current;
    if (!engine || !src) return;
    setStatus('loading');
    setError('');
    setPicked(null);
    setMeasure(null);
    setProgress({ phase: 'Lecture du fichier', ratio: 0 });
    try {
      const loaded = await engine.load(src, { name: label });
      setInfo(loaded);
      setSettings(engine.getSettings());
      setZRange([loaded.min[2], loaded.max[2]]);
      setClasses(Object.fromEntries(Object.keys(loaded.classCounts).map((c) => [c, true])));
      setStatus('ready');
      onLoaded?.(loaded);
    } catch (e) {
      if (e.message === 'Chargement remplacé par un autre.') return;
      setStatus('error');
      setError(e.message);
    }
  }, [onLoaded]);

  useEffect(() => { if (source) load(source, name); }, [source, name, load]);

  /** Applique un réglage au moteur puis resynchronise l'interface. */
  const apply = (fn) => {
    const engine = engineRef.current;
    if (!engine) return;
    fn(engine);
    setSettings(engine.getSettings());
  };

  const openFile = (file) => {
    if (!file) return;
    if (!/\.(las|laz)$/i.test(file.name)) {
      setStatus('error');
      setError('Choisissez un fichier .las ou .laz.');
      return;
    }
    load(file, file.name);
  };

  const screenshot = () => {
    const url = engineRef.current?.screenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(info?.name || 'nuage').replace(/\.(las|laz)$/i, '')}.png`;
    a.click();
  };

  const fullscreen = () => {
    const el = rootRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el?.requestFullscreen?.();
  };

  const toggleClass = (c, on) => {
    setClasses((prev) => ({ ...prev, [c]: on }));
    apply((e) => e.setClassVisible(Number(c), on));
  };
  const setAllClasses = (on) => {
    setClasses((prev) => Object.fromEntries(Object.keys(prev).map((c) => [c, on])));
    apply((e) => e.setAllClassesVisible(on));
  };

  const ready = status === 'ready' && info && settings;
  const classList = info ? Object.entries(info.classCounts).map(([c, n]) => ({ c, n, ...classInfo(Number(c)) })).sort((a, b) => a.c - b.c) : [];
  const help = coarse
    ? 'Un doigt : tourner · Deux doigts : zoomer et déplacer · Double tape : recentrer'
    : 'Glisser : tourner · Clic droit ou Maj : déplacer · Molette : zoom · Double-clic : recentrer · R : vue globale · T : dessus · M : mesure · Échap : effacer';

  const panel = ready && (
    <Stack spacing={2.25} divider={<Divider flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />}>
      <Section title="Coloration">
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {COLOR_MODES.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              size="small"
              clickable
              disabled={m.id === 'rgb' && !info.hasRgb}
              color={settings.colorMode === m.id ? 'primary' : 'default'}
              variant={settings.colorMode === m.id ? 'filled' : 'outlined'}
              onClick={() => apply((e) => e.setColorMode(m.id))}
            />
          ))}
        </Stack>
        {settings.colorMode === 'elevation' && (
          <Row label="Dégradé">
            <Select size="small" value={settings.gradient} onChange={(ev) => apply((e) => e.setGradient(ev.target.value))} sx={{ minWidth: 120 }}>
              {Object.entries(GRADIENTS).map(([id, g]) => <MenuItem key={id} value={id}>{g.label}</MenuItem>)}
            </Select>
          </Row>
        )}
        {settings.colorMode === 'returns' && (
          <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ fontSize: 12, opacity: 0.8 }}>
            {[['#ffd140', 'Unique'], ['#4dd973', 'Premier'], ['#5999ff', 'Intermédiaire'], ['#f25959', 'Dernier']].map(([c, l]) => (
              <Stack key={l} direction="row" alignItems="center" gap={0.75}><Swatch color={c} />{l}</Stack>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="Affichage">
        <Box>
          <Typography variant="body2">Taille des points</Typography>
          <Slider size="small" min={0.5} max={8} step={0.5} value={settings.pointSize} valueLabelDisplay="auto"
            onChange={(_, v) => apply((e) => e.setPointSize(v))} />
        </Box>
        <Row label="Taille adaptative" hint="Selon la densité locale">
          <Switch size="small" checked={settings.sizeMode === 'adaptive'} onChange={(_, on) => apply((e) => e.setSizeMode(on ? 'adaptive' : 'fixed'))} />
        </Row>
        <Row label="Ombrage EDL" hint="Fait ressortir le relief">
          <Switch size="small" checked={settings.edl} onChange={(_, on) => apply((e) => e.setEDL(on))} />
        </Row>
        {settings.edl && (
          <Slider size="small" min={0} max={3} step={0.1} value={settings.edlStrength} valueLabelDisplay="auto"
            aria-label="Force de l’ombrage" onChange={(_, v) => apply((e) => e.setEDLStrength(v))} />
        )}
        <Box>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">Budget de points</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{count(settings.pointBudget)}</Typography>
          </Stack>
          <Slider size="small" min={0.5} max={15} step={0.5} value={settings.pointBudget / 1e6}
            onChange={(_, v) => apply((e) => e.setPointBudget(v * 1e6))} />
          <Typography variant="caption" sx={{ opacity: 0.55 }}>Moins de points = plus fluide sur les petites machines.</Typography>
        </Box>
      </Section>

      {zRange && info.max[2] > info.min[2] && (
        <Section title="Altitude">
          <Slider size="small" min={Math.floor(info.min[2])} max={Math.ceil(info.max[2])} step={0.1} value={zRange}
            valueLabelDisplay="auto" valueLabelFormat={(v) => `${nf(v, 1)} m`} disableSwap
            onChange={(_, v) => { setZRange(v); apply((e) => e.setZRange(v)); }} />
          <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 12, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
            <span>{nf(zRange[0], 1)} m</span><span>{nf(zRange[1], 1)} m</span>
          </Stack>
        </Section>
      )}

      {classList.length > 0 && (
        <Section
          title="Classes"
          action={(
            <Stack direction="row" gap={0.5}>
              <Button size="small" onClick={() => setAllClasses(true)}>Toutes</Button>
              <Button size="small" onClick={() => setAllClasses(false)}>Aucune</Button>
            </Stack>
          )}
        >
          <Box sx={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            {classList.map(({ c, n, name: label, color }, i) => (
              <Stack
                key={c}
                component="label"
                direction="row"
                alignItems="center"
                gap={1}
                sx={{ px: 1, minHeight: coarse ? 44 : 34, cursor: 'pointer', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
              >
                <Checkbox size="small" checked={classes[c] !== false} onChange={(_, on) => toggleClass(c, on)} sx={{ p: 0.5 }} />
                <Swatch color={color} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={`Classe ${c}`}>{label}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{count(n)}</Typography>
              </Stack>
            ))}
          </Box>
        </Section>
      )}

      <Section title="Outils">
        <ToggleButtonGroup size="small" exclusive fullWidth value={settings.tool} onChange={(_, v) => v && apply((e) => e.setTool(v))}>
          <ToggleButton value="info">Infos point</ToggleButton>
          <ToggleButton value="measure">Mesure</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" gap={1}>
          <Button size="small" variant="outlined" fullWidth onClick={() => engineRef.current?.resetView()}>Vue globale</Button>
          <Button size="small" variant="outlined" fullWidth onClick={() => engineRef.current?.topView()}>Vue de dessus</Button>
        </Stack>
      </Section>

      <Section title="Fichier">
        <Stack spacing={0.5} sx={{ fontSize: 12, opacity: 0.8, fontVariantNumeric: 'tabular-nums', '& b': { fontWeight: 600 } }}>
          <span><b>LAS {info.version}</b> · format {info.pointFormat} · {info.compressed ? 'compressé (LAZ)' : 'non compressé'}</span>
          <span>{info.crsLabel}</span>
          <span>{nf(info.pointCount)} points chargés{info.stride > 1 ? ` sur ${nf(info.filePointCount)} (1 sur ${info.stride})` : ''}</span>
          <span>X {nf(info.min[0], 2)} → {nf(info.max[0], 2)}</span>
          <span>Y {nf(info.min[1], 2)} → {nf(info.max[1], 2)}</span>
          <span>Z {nf(info.min[2], 2)} → {nf(info.max[2], 2)}</span>
          <span>Lecture {nf(info.timings.decodeMs / 1000, 1)} s · indexation {nf(info.timings.indexMs / 1000, 1)} s · {info.nodeCount} nœuds</span>
          {info.software && <span>Produit par {info.software}</span>}
        </Stack>
      </Section>
    </Stack>
  );

  return (
    <ThemeProvider theme={theme}>
      <Box
        ref={rootRef}
        sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, overflow: 'hidden', bgcolor: '#05070d', color: 'text.primary', ...sx }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); openFile(e.dataTransfer.files?.[0]); }}
      >
        <Box ref={hostRef} sx={{ position: 'absolute', inset: 0 }} />
        <input ref={fileRef} type="file" accept=".las,.laz" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />

        {/* Barre du haut */}
        <Paper
          elevation={0}
          sx={{
            ...glass,
            position: 'absolute', top: { xs: 8, sm: 12 }, left: { xs: 8, sm: 12 },
            right: { xs: 8, sm: ready && panelOpen && !compact ? 352 : 12 },
            display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>{info?.name || 'Visionneuse LiDAR'}</Typography>
            <Typography variant="caption" noWrap sx={{ opacity: 0.6, display: 'block' }}>
              {info ? `${count(info.pointCount)} points · ${info.crsLabel}` : 'Fichiers .las et .laz'}
            </Typography>
          </Box>
          <Tooltip title="Ouvrir un fichier .las ou .laz"><Button size="small" variant="contained" onClick={() => fileRef.current?.click()}>Ouvrir</Button></Tooltip>
          {ready && !compact && <Tooltip title="Capture PNG"><Button size="small" onClick={screenshot}>Capture</Button></Tooltip>}
          {ready && !compact && <Tooltip title="Plein écran"><IconButton size="small" onClick={fullscreen} aria-label="Plein écran">⛶</IconButton></Tooltip>}
          {ready && <Tooltip title={panelOpen ? 'Masquer les réglages' : 'Afficher les réglages'}><Button size="small" variant={panelOpen ? 'outlined' : 'text'} onClick={() => setPanelOpen((v) => !v)}>Réglages</Button></Tooltip>}
          {onClose && <Tooltip title="Fermer"><IconButton size="small" onClick={onClose} aria-label="Fermer">×</IconButton></Tooltip>}
        </Paper>

        {/* Panneau de réglages : colonne à droite, tiroir bas sur mobile */}
        {ready && panelOpen && (
          <Paper
            elevation={0}
            sx={{
              ...glass,
              position: 'absolute', overflowY: 'auto', overscrollBehavior: 'contain', p: 2,
              ...(compact
                ? { left: 0, right: 0, bottom: 0, maxHeight: '58dvh', borderRadius: '18px 18px 0 0', pb: 'calc(16px + env(safe-area-inset-bottom, 0px))' }
                : { top: 12, right: 12, bottom: 12, width: 328 }),
            }}
          >
            {compact && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.3)', mx: 'auto', mb: 1.5 }} />}
            {panel}
          </Paper>
        )}

        {/* Accueil / erreur : zone de dépôt */}
        {(status === 'idle' || status === 'error') && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2, pointerEvents: 'none' }}>
            <Paper
              elevation={0}
              onClick={() => fileRef.current?.click()}
              sx={{
                ...glass, pointerEvents: 'auto', cursor: 'pointer', textAlign: 'center',
                width: 'min(460px, 100%)', p: { xs: 3, sm: 4 }, border: '1.5px dashed rgba(79, 195, 247, 0.5)',
                transition: 'border-color 150ms ease, transform 150ms ease',
                '&:hover': { borderColor: '#4fc3f7', transform: 'translateY(-1px)' },
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>Déposez un nuage LiDAR</Typography>
              <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>Fichier .las ou .laz (LAS 1.0 à 1.4), par exemple une dalle LiDAR HD de l’IGN.</Typography>
              <Button variant="contained">Choisir un fichier</Button>
              {status === 'error' && <Typography variant="body2" sx={{ color: '#ff8a80', mt: 2 }} role="alert">{error}</Typography>}
            </Paper>
          </Box>
        )}

        {/* Chargement */}
        {status === 'loading' && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2, pointerEvents: 'none' }}>
            <Paper elevation={0} sx={{ ...glass, width: 'min(380px, 100%)', p: 2.5 }} role="status">
              <Typography variant="body2" sx={{ mb: 1 }}>{progress.phase || 'Chargement…'}</Typography>
              <LinearProgress variant="determinate" value={Math.round((progress.ratio || 0) * 100)} />
              <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.75 }}>{Math.round((progress.ratio || 0) * 100)} %</Typography>
            </Paper>
          </Box>
        )}

        {/* Point sélectionné */}
        {picked && settings?.tool === 'info' && (
          <Paper elevation={0} sx={{ ...glass, position: 'absolute', left: 12, bottom: compact && panelOpen ? 'calc(58dvh + 8px)' : 40, width: 'min(300px, calc(100% - 24px))', p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="overline" sx={{ opacity: 0.65, lineHeight: 1.6 }}>Point sélectionné</Typography>
              <IconButton size="small" onClick={() => engineRef.current?.clearSelection()} aria-label="Fermer">×</IconButton>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.4, fontSize: 13, fontVariantNumeric: 'tabular-nums', '& dt': { opacity: 0.6 }, '& dd': { m: 0, textAlign: 'right' } }} component="dl">
              <dt>X</dt><dd>{nf(picked.x, 3)}</dd>
              <dt>Y</dt><dd>{nf(picked.y, 3)}</dd>
              <dt>Z</dt><dd>{nf(picked.z, 3)} m</dd>
              <dt>Classe</dt>
              <dd><Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.75}><Swatch color={classInfo(picked.classification).color} />{classInfo(picked.classification).name}</Stack></dd>
              <dt>Intensité</dt><dd>{nf(picked.intensity)}</dd>
              <dt>Retour</dt><dd>{picked.returnNumber} / {picked.numberOfReturns || 1}</dd>
              {picked.rgb && (<><dt>Couleur</dt><dd><Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.75}><Swatch color={`rgb(${picked.rgb.join(',')})`} />{picked.rgb.join(', ')}</Stack></dd></>)}
            </Box>
          </Paper>
        )}

        {/* Mesure */}
        {ready && settings.tool === 'measure' && (
          <Paper elevation={0} sx={{ ...glass, position: 'absolute', left: 12, bottom: compact && panelOpen ? 'calc(58dvh + 8px)' : 40, width: 'min(300px, calc(100% - 24px))', p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="overline" sx={{ opacity: 0.65, lineHeight: 1.6 }}>Mesure</Typography>
              <Button size="small" onClick={() => engineRef.current?.clearMeasurements()} disabled={!measure?.points}>Effacer</Button>
            </Stack>
            {measure?.segments?.length ? (
              <Stack spacing={0.4} sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                <Stack direction="row" justifyContent="space-between"><span style={{ opacity: 0.6 }}>Longueur</span><b>{nf(measure.total, 2)} m</b></Stack>
                <Stack direction="row" justifyContent="space-between"><span style={{ opacity: 0.6 }}>À plat</span><span>{nf(measure.totalHorizontal, 2)} m</span></Stack>
                <Stack direction="row" justifyContent="space-between"><span style={{ opacity: 0.6 }}>Dénivelé (dernier segment)</span><span>{measure.segments.at(-1).dz >= 0 ? '+' : ''}{nf(measure.segments.at(-1).dz, 2)} m</span></Stack>
                <Typography variant="caption" sx={{ opacity: 0.55 }}>{measure.points} points · cliquez pour prolonger</Typography>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.7 }}>{measure?.points ? 'Cliquez sur un deuxième point.' : 'Cliquez sur le nuage pour poser le premier point.'}</Typography>
            )}
          </Paper>
        )}

        {/* Barre d'état */}
        {ready && !(compact && panelOpen) && (
          <Tooltip title={help} placement="top-start">
            <Typography
              variant="caption"
              sx={{ position: 'absolute', left: 14, bottom: 12, opacity: 0.6, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 2px #000', cursor: 'help', maxWidth: 'calc(100% - 28px)' }}
              noWrap
            >
              {stats ? `${stats.fps} img/s · ${count(stats.points)} points affichés · ${stats.nodes} nœuds` : ' '} · ?
            </Typography>
          </Tooltip>
        )}

        {dragOver && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(5, 7, 13, 0.7)', border: '2px dashed #4fc3f7', pointerEvents: 'none' }}>
            <Typography variant="h6">Déposez le fichier .las / .laz</Typography>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default LidarViewer;
