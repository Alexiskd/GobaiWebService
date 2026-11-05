import { Suspense, lazy, useRef, useState } from 'react';
import { GlobalStyles, useMediaQuery } from '@mui/material';

// Panneau « LiDAR » : dépose des fichiers .las / .laz (ou une URL), liste des nuages posés sur le globe et réglages.
// L'état et la couche 3D vivent dans useGlobeLidar (SolarScene) : fermer le panneau garde les nuages affichés.
// Écran large : panneau flottant à gauche. Mobile / téléphone en paysage : plein écran.

const LidarViewer = lazy(() => import('@lidar/LidarViewer.jsx').then((m) => ({ default: m.LidarViewer })));
const COMPACT = '(max-width: 720px), (max-height: 500px) and (pointer: coarse)';
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

const styles = {
  '.lidar-globe': {
    position: 'fixed', zIndex: 70, left: 'calc(var(--rail, 56px) + var(--gutter, 16px) * 2)', top: '50%',
    transform: 'translateY(-50%)', width: 'min(400px, calc(100vw - 2 * var(--gutter, 16px)))',
    maxHeight: 'min(80vh, 780px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 22px 60px rgba(0, 0, 0, 0.72)', boxSizing: 'border-box',
  },
  '.lidar-globe.is-compact': {
    left: 0, right: 0, top: 0, bottom: 0, transform: 'none', width: 'auto', maxHeight: 'none', borderRadius: 0,
    paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  '.lidar-globe > header': { borderBottom: '1px solid var(--line)', paddingBottom: '10px !important', flex: 'none' },
  '.lidar-globe-kicker': { display: 'block', marginBottom: 3, color: 'var(--sun)', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  '.lidar-globe-body': { overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 14px 14px', display: 'grid', gap: 12, minHeight: 0 },
  '.lidar-drop': {
    display: 'grid', gap: 8, justifyItems: 'center', textAlign: 'center', padding: '16px 12px',
    border: '1px dashed var(--line-strong)', borderRadius: 12, color: 'var(--dim)', fontSize: '0.8rem',
  },
  '.lidar-drop.is-over': { borderColor: 'var(--sun)', background: 'rgba(255, 179, 0, 0.06)', color: 'var(--ink)' },
  '.lidar-row': { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  '.lidar-row > input[type="text"], .lidar-row > input[type="number"], .lidar-globe select': {
    flex: '1 1 120px', minWidth: 0, padding: '7px 9px', color: 'var(--ink)', background: 'var(--panel-solid)',
    border: '1px solid var(--line-strong)', borderRadius: 8, font: 'inherit', fontSize: '0.8rem',
  },
  '.lidar-row button, .lidar-drop button': { padding: '6px 10px', fontSize: '0.8rem' },
  '.lidar-label': { color: 'var(--dim)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 },
  '.lidar-label input[type="range"]': { flex: 1, accentColor: 'var(--accent, #7fb2ff)' },
  '.lidar-card': { display: 'grid', gap: 8, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 12, background: 'rgba(255,255,255,0.02)' },
  '.lidar-card h3': { margin: 0, fontSize: '0.88rem', fontWeight: 600, overflowWrap: 'anywhere' },
  '.lidar-meta': { margin: 0, color: 'var(--dim)', fontSize: '0.74rem', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' },
  '.lidar-error': { margin: 0, color: '#ff8a80', fontSize: '0.78rem' },
  '.lidar-warn': { margin: 0, color: '#ffd180', fontSize: '0.78rem' },
  '.lidar-progress': { height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' },
  '.lidar-progress > span': { display: 'block', height: '100%', background: 'var(--sun)', transition: 'width 0.2s' },
  '.lidar-switch': { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--dim)', fontSize: '0.76rem', cursor: 'pointer' },
  '.lidar-viewer-overlay': { position: 'fixed', inset: 0, zIndex: 3100, background: '#05070d' },
};

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
    <form className="lidar-row" onSubmit={submit}>
      <input type="text" inputMode="decimal" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitude" />
      <input type="text" inputMode="decimal" placeholder="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitude" />
      <button type="submit">Placer</button>
      {invalid && <p className="lidar-error">Latitude entre −90 et 90, longitude entre −180 et 180.</p>}
    </form>
  );
}

function CloudCard({ cloud, lidar, onInspect }) {
  const { info } = cloud;
  const ready = cloud.status === 'ready';
  return (
    <article className="lidar-card">
      <h3>{cloud.name}</h3>
      {cloud.status === 'loading' && (
        <>
          <p className="lidar-meta">{cloud.phase} · {Math.round((cloud.ratio || 0) * 100)} %</p>
          <div className="lidar-progress"><span style={{ width: `${Math.round((cloud.ratio || 0) * 100)}%` }} /></div>
        </>
      )}
      {cloud.status === 'error' && <p className="lidar-error">{cloud.error}</p>}
      {info && (
        <p className="lidar-meta">
          {count(info.pointCount)} points{info.stride > 1 ? ` (1 sur ${info.stride} des ${count(info.filePointCount)})` : ''}
          {' · '}{meters(info.sizeMeters[0])} × {meters(info.sizeMeters[1])}
          <br />{info.crsLabel || 'Système non défini'}{info.projection ? ` → ${info.projection}` : ''}
          {Number.isFinite(cloud.lat) && <><br />{coords(cloud.lat, cloud.lon)}</>}
        </p>
      )}
      {cloud.status === 'needs-position' && (
        <>
          <p className="lidar-warn">Système de coordonnées non reconnu : indiquez la position du centre (grille supposée en mètres, x vers l’est).</p>
          <PositionForm cloud={cloud} onPlace={lidar.place} />
        </>
      )}
      {ready && (
        <>
          <div className="lidar-row">
            <select value={cloud.colorMode || 'elevation'} onChange={(e) => lidar.setColorMode(cloud.id, e.target.value)} aria-label="Couleur des points">
              {MODES.filter((m) => !m.needsRgb || info?.hasRgb).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button type="button" onClick={() => lidar.flyTo(cloud.id)}>Aller</button>
          </div>
          <div className="lidar-row">
            <label className="lidar-switch">
              <input type="checkbox" checked={cloud.visible} onChange={(e) => lidar.setVisible(cloud.id, e.target.checked)} /> Visible
            </label>
            <label className="lidar-switch" title="Le globe n'a pas de relief : le sol du nuage est posé sur la sphère. Décoché : altitude du fichier.">
              <input type="checkbox" checked={cloud.groundClamp} onChange={(e) => lidar.setGroundClamp(cloud.id, e.target.checked)} /> Poser au sol
            </label>
          </div>
        </>
      )}
      <div className="lidar-row">
        {info && <button type="button" onClick={() => onInspect(cloud)}>Vue détaillée</button>}
        <button type="button" onClick={() => lidar.remove(cloud.id)}>{cloud.status === 'loading' ? 'Annuler' : 'Retirer'}</button>
      </div>
    </article>
  );
}

export function LidarGlobe({ open, onClose, lidar }) {
  const compact = useMediaQuery(COMPACT, { noSsr: true });
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
        <section
          className={compact ? 'lidar-globe panel is-compact' : 'lidar-globe panel'}
          role="dialog"
          aria-modal={compact ? 'true' : 'false'}
          aria-label="Nuages LiDAR sur le globe"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
          onDrop={onDrop}
        >
          <GlobalStyles styles={styles} />
          <header>
            <div><span className="lidar-globe-kicker">Nuages de points</span><h2>LiDAR sur le globe</h2></div>
            <button type="button" className="ghost" onClick={onClose} aria-label="Fermer">×</button>
          </header>
          <div className="lidar-globe-body">
            <div className={over ? 'lidar-drop is-over' : 'lidar-drop'}>
              <span>Déposez des fichiers .las / .laz géoréférencés (Lambert-93, CC, UTM, WGS84…)</span>
              <button type="button" onClick={() => inputRef.current?.click()}>Ouvrir des fichiers</button>
              <input
                ref={inputRef}
                type="file"
                accept=".las,.laz"
                multiple
                hidden
                onChange={(e) => { lidar.addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
            <form className="lidar-row" onSubmit={submitUrl}>
              <input type="text" placeholder="ou URL d’un .las / .laz" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL d’un nuage" />
              <button type="submit">Charger</button>
            </form>
            <label className="lidar-label">
              Taille des points
              <input type="range" min="1" max="8" step="0.5" value={lidar.pointSize} onChange={(e) => lidar.setPointSize(Number(e.target.value))} />
              <span>{nf(lidar.pointSize, 1)} px</span>
            </label>
            {lidar.clouds.length === 0 && <p className="lidar-meta">Aucun nuage chargé. Les points s’affichent à leur position réelle sur la Terre.</p>}
            {lidar.clouds.map((cloud) => <CloudCard key={cloud.id} cloud={cloud} lidar={lidar} onInspect={setInspected} />)}
          </div>
        </section>
      )}
      {inspected && (
        <div className="lidar-viewer-overlay">
          <GlobalStyles styles={styles} />
          <Suspense fallback={<div className="loading">Chargement de la visionneuse…</div>}>
            <LidarViewer source={inspected.source} name={inspected.name} onClose={() => setInspected(null)} sx={{ height: '100%' }} />
          </Suspense>
        </div>
      )}
    </>
  );
}
