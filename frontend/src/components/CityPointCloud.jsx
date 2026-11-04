import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalStyles, useMediaQuery } from '@mui/material';
import { fetchLyonPointCloud, fetchPointClouds, resolveApiUrl } from '@/api';

// Panneau « Tuile 3D » : nuage de points Potree d'une ville.
// Écran large : panneau flottant. Mobile / téléphone en paysage : plein écran.
// Tous les styles sont en MUI (`GlobalStyles` + `useMediaQuery`), aucun fichier .css.

// ---------------------------------------------------------------- Requêtes média

const QUERIES = {
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
  landscapePhone: '(max-height: 500px) and (orientation: landscape) and (pointer: coarse)',
  coarse: '(pointer: coarse)',
};
const MQ = {
  compact: `@media ${QUERIES.compact}`,
  landscapePhone: `@media ${QUERIES.landscapePhone}`,
  coarse: `@media ${QUERIES.coarse}`,
  tablet: '@media (max-width: 1024px)',
  xl: '@media (min-width: 1441px)',
};

// ---------------------------------------------------------------- Styles MUI

const TOUCH = '44px';
const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

const pointCloudStyles = {
  // ------------------------------------------------ Panneau (écran large)
  'html .city-pointcloud': {
    width: 'clamp(340px, 34vw, 560px)',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: `calc(100dvh - 32px - ${safe('top')} - ${safe('bottom')})`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  'html .city-pointcloud > header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flex: 'none',
  },
  'html .city-pointcloud > header h2': {
    margin: 0,
    fontSize: 'clamp(17px, 1vw + 12px, 22px)',
    overflowWrap: 'anywhere',
  },
  'html .city-pointcloud-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingBottom: `calc(8px + ${safe('bottom')})`,
  },
  'html .city-pointcloud-location': { margin: 0, opacity: 0.8, fontVariantNumeric: 'tabular-nums' },

  // ------------------------------------------------ Méta-données : jamais de débordement
  'html .city-pointcloud-meta': { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.9em' },
  'html .city-pointcloud-meta span, html .city-pointcloud-message, html .city-pointcloud-message code': {
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    minWidth: 0,
  },

  // ------------------------------------------------ Sélecteur
  'html .city-pointcloud-select': { display: 'flex', flexDirection: 'column', gap: '6px' },
  'html .city-pointcloud-select select': { width: '100%', minWidth: 0, boxSizing: 'border-box' },

  // ------------------------------------------------ Viewer 3D
  'html .city-pointcloud-viewer': {
    position: 'relative',
    width: '100%',
    height: 'clamp(240px, 42dvh, 520px)',
    flex: 'none',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#080c14',
  },
  'html .city-pointcloud-canvas-host': { position: 'absolute', inset: 0 },
  'html .city-pointcloud-canvas': {
    display: 'block',
    width: '100% !important',
    height: '100% !important',
    touchAction: 'none', // les gestes (rotation, pincement) vont aux OrbitControls
    outline: 'none',
  },
  'html .city-pointcloud-viewer .city-pointcloud-message': {
    position: 'absolute',
    inset: 'auto 12px 12px 12px',
    margin: 0,
    pointerEvents: 'none',
  },
  'html .city-pointcloud-tools': {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '6px',
    zIndex: 1,
  },
  'html .city-pointcloud-tools button': {
    minWidth: '36px',
    minHeight: '36px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(12, 16, 28, 0.78)',
    color: '#fff',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    cursor: 'pointer',
  },
  'html .city-pointcloud-hint': { margin: 0, fontSize: '12px', opacity: 0.7 },

  // ------------------------------------------------ LiDAR Lyon
  'html .city-pointcloud-lyon': { display: 'flex', flexDirection: 'column', gap: '8px' },
  'html .city-pointcloud-lyon h3': { margin: 0 },
  'html .city-pointcloud-ept-frame': {
    width: '100%',
    height: 'clamp(240px, 42dvh, 520px)',
    border: 0,
    borderRadius: '10px',
    background: '#080c14',
    display: 'block',
  },
  'html .city-pointcloud-lyon a': { alignSelf: 'flex-start', padding: '4px 0' },

  // ================================================ Grand écran
  [MQ.xl]: {
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': { height: 'clamp(320px, 48dvh, 640px)' },
  },

  // ================================================ Tablette
  [MQ.tablet]: {
    'html .city-pointcloud': { width: 'min(460px, calc(100vw - 32px))' },
  },

  // ================================================ Tactile
  [MQ.coarse]: {
    'html .city-pointcloud button, html .city-pointcloud select, html .city-pointcloud-tools button': {
      minHeight: TOUCH,
      minWidth: TOUCH,
    },
    'html .city-pointcloud select': { fontSize: '16px' }, // pas de zoom auto sur iOS
  },

  // ================================================ Mobile : plein écran
  [MQ.compact]: {
    'html .city-pointcloud': {
      position: 'fixed',
      inset: 0,
      transform: 'none !important',
      width: '100%',
      maxWidth: 'none',
      height: '100dvh',
      maxHeight: 'none',
      margin: 0,
      borderRadius: 0,
      zIndex: 70,
      padding: `calc(${safe('top')} + 10px) calc(${safe('right')} + 12px) 0 calc(${safe('left')} + 12px)`,
    },
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': {
      height: 'max(260px, 55dvh)',
      borderRadius: '8px',
    },
    'html .city-pointcloud-meta': { fontSize: '12px' },
  },

  // ================================================ Téléphone en paysage : le nuage prend la hauteur
  [MQ.landscapePhone]: {
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': {
      height: `calc(100dvh - ${safe('top')} - ${safe('bottom')} - 80px)`,
    },
    'html .city-pointcloud-location': { display: 'none' },
  },
};

function PointCloudStyles() {
  return <GlobalStyles styles={pointCloudStyles} />;
}

// ---------------------------------------------------------------- Utilitaires

const numberFormat = new Intl.NumberFormat('fr-FR');

// BigInt() plantait sur un nombre décimal ou une chaîne mal formée.
const formatPointCount = (value) => {
  if (value === null || value === undefined || value === '') return 'Nombre de points inconnu';
  try {
    const text = String(value).trim();
    const formatted = /^\d+$/.test(text) ? numberFormat.format(BigInt(text)) : numberFormat.format(Math.round(Number(text)));
    return formatted === 'NaN' ? 'Nombre de points inconnu' : `${formatted} points`;
  } catch {
    return 'Nombre de points inconnu';
  }
};

const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '—');

// URL de base du nuage : `potreeBaseUrl`, sinon dossier de `potreeUrl` (…/cloud.js).
const cloudBaseUrl = (cloud) => cloud.potreeBaseUrl
  || (cloud.potreeUrl ? cloud.potreeUrl.replace(/\/?cloud\.js(\?.*)?$/i, '/') : null);

// ---------------------------------------------------------------- Viewer Potree

function PotreeViewer({ cloud, coarse }) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null); // { recenter, fullscreen } exposés par l'effet
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const baseUrl = cloudBaseUrl(cloud);

  useEffect(() => {
    const host = hostRef.current; // capturé : la ref peut être nulle au démontage
    let active = true;
    let frame = 0;
    let renderer;
    let controls;
    let pointCloud;
    let resizeObserver;
    let onVisibility;

    async function start() {
      try {
        if (!baseUrl) throw new Error('URL du nuage Potree absente du catalogue.');
        const [{ Potree }, THREE, { OrbitControls }] = await Promise.all([
          import('potree-core'),
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);
        if (!active || !host) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x080c14);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1e9);
        renderer = new THREE.WebGLRenderer({
          antialias: !coarse, // l'antialiasing coûte cher sur mobile
          logarithmicDepthBuffer: true,
          powerPreference: 'high-performance',
        });
        // Mobile : densité limitée à 1,5 pour garder un rendu fluide et éviter la surchauffe.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
        renderer.domElement.className = 'city-pointcloud-canvas';
        renderer.domElement.tabIndex = 0;
        host.replaceChildren(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.rotateSpeed = coarse ? 0.6 : 1;
        controls.zoomSpeed = coarse ? 0.8 : 1;

        const resize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight, false);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        const potree = new Potree();
        if (coarse) potree.pointBudget = Math.min(potree.pointBudget ?? 1_000_000, 1_000_000);
        pointCloud = await potree.loadPointCloud('cloud.js', resolveApiUrl(baseUrl));
        if (!active) return;
        scene.add(pointCloud);

        const bounds = pointCloud.boundingSphere || pointCloud.geometry?.boundingSphere;
        const recenter = () => {
          if (bounds?.center && Number.isFinite(bounds.radius) && bounds.radius > 0) {
            controls.target.copy(bounds.center);
            camera.position.copy(bounds.center).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(bounds.radius * 2.5));
            camera.near = Math.max(bounds.radius / 10000, 0.01);
            camera.far = Math.max(bounds.radius * 100, 1000);
          } else {
            camera.position.set(0, 0, 100);
            controls.target.set(0, 0, 0);
          }
          camera.updateProjectionMatrix();
          controls.update();
        };
        recenter();
        viewerRef.current = {
          recenter,
          fullscreen: () => {
            const el = host.parentElement;
            if (document.fullscreenElement) document.exitFullscreen?.();
            else (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el);
          },
        };

        setStatus('ready');
        const render = () => {
          if (!active) return;
          frame = requestAnimationFrame(render);
          controls.update();
          potree.updatePointClouds([pointCloud], camera, renderer);
          renderer.render(scene, camera);
        };
        // Onglet caché : on arrête la boucle (batterie, mobile).
        onVisibility = () => {
          cancelAnimationFrame(frame);
          if (!document.hidden && active) render();
        };
        document.addEventListener('visibilitychange', onVisibility);
        render();
      } catch (cause) {
        if (active) {
          setError(cause?.message || String(cause));
          setStatus('error');
        }
      }
    }

    start();
    return () => {
      active = false;
      viewerRef.current = null;
      cancelAnimationFrame(frame);
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (pointCloud) {
        pointCloud.parent?.remove(pointCloud);
        pointCloud.dispose?.();
      }
      // Libère vraiment le contexte WebGL : les navigateurs mobiles en limitent le nombre.
      renderer?.forceContextLoss?.();
      renderer?.dispose();
      host?.replaceChildren();
    };
  }, [baseUrl, coarse]);

  return (
    <>
      <div className="city-pointcloud-viewer" aria-label={`Nuage 3D : ${cloud.name}`}>
        <div className="city-pointcloud-canvas-host" ref={hostRef} />
        {status === 'ready' && (
          <div className="city-pointcloud-tools">
            <button type="button" onClick={() => viewerRef.current?.recenter()} title="Recentrer la vue" aria-label="Recentrer la vue">◎</button>
            <button type="button" onClick={() => viewerRef.current?.fullscreen()} title="Plein écran" aria-label="Plein écran">⛶</button>
          </div>
        )}
        {status === 'loading' && <p className="city-pointcloud-message">Chargement du nuage Potree…</p>}
        {status === 'error' && <p className="city-pointcloud-message is-error">Viewer indisponible : {error}</p>}
      </div>
      {status === 'ready' && (
        <p className="city-pointcloud-hint">
          {coarse
            ? 'Un doigt pour tourner · deux doigts pour zoomer et déplacer'
            : 'Glisser pour tourner · clic droit pour déplacer · molette pour zoomer'}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Panneau

export function CityPointCloud({ city, open, onClose }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const coarse = useMediaQuery(QUERIES.coarse, { noSsr: true });
  const [catalog, setCatalog] = useState({ items: [], status: 'idle', error: null });
  const [lyonDataset, setLyonDataset] = useState({ data: null, status: 'idle', error: null });
  const [selectedName, setSelectedName] = useState('');
  const cityKey = city ? `${city.name}|${city.lat}|${city.lon}` : '';
  const isLyon = /lyon/i.test(city?.name || '');

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setCatalog({ items: [], status: 'loading', error: null });
    fetchPointClouds(controller.signal)
      .then(({ items }) => setCatalog({ items: Array.isArray(items) ? items : [], status: 'ready', error: null }))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setCatalog({ items: [], status: 'error', error: cause.message });
      });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open || !isLyon) {
      setLyonDataset({ data: null, status: 'idle', error: null });
      return undefined;
    }
    const controller = new AbortController();
    setLyonDataset({ data: null, status: 'loading', error: null });
    fetchLyonPointCloud(controller.signal)
      .then((data) => setLyonDataset({ data, status: 'ready', error: null }))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setLyonDataset({ data: null, status: 'error', error: cause.message });
      });
    return () => controller.abort();
  }, [open, isLyon]);

  // Échap ferme ; en plein écran mobile, le fond ne défile pas.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', onKey);
    let previous;
    if (compact) {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      if (compact) document.body.style.overflow = previous;
    };
  }, [open, onClose, compact]);

  // `potreeUrl` ou `potreeBaseUrl` : le filtre et le viewer utilisent maintenant la même règle.
  const available = useMemo(() => catalog.items.filter((item) => cloudBaseUrl(item)), [catalog.items]);
  const selected = available.find((item) => item.name === selectedName) || available[0] || null;

  // Calculée une seule fois par jeu de données, et sans planter sur une URL invalide.
  const lyonViewerUrl = useMemo(() => {
    if (!lyonDataset.data?.eptUrl) return '';
    try {
      const ept = new URL(resolveApiUrl(lyonDataset.data.eptUrl), window.location.origin).href;
      return `https://potree.org/potree/examples/ept.html?r=${encodeURIComponent(ept)}`;
    } catch {
      return '';
    }
  }, [lyonDataset.data]);

  useEffect(() => {
    if (available.length && !available.some((item) => item.name === selectedName)) {
      setSelectedName(available[0].name);
    }
  }, [available, selectedName]);

  if (!open || !city) return null;

  const lat = Number(city.lat);
  const lon = Number(city.lon);

  return (
    <section
      className="city-pointcloud panel"
      role="dialog"
      aria-modal={compact ? 'true' : 'false'} // plein écran sur mobile : c'est alors une vraie modale
      aria-label={`Nuages 3D de ${city.name}`}
    >
      <PointCloudStyles />
      <header>
        <div>
          <span className="city-pointcloud-kicker">Tuile urbaine · Potree</span>
          <h2>{city.name}</h2>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Fermer le nuage 3D">×</button>
      </header>
      <div className="city-pointcloud-body">
        {Number.isFinite(lat) && Number.isFinite(lon) && (
          <p className="city-pointcloud-location">
            {Math.abs(lat).toFixed(3)}° {lat >= 0 ? 'N' : 'S'} · {Math.abs(lon).toFixed(3)}° {lon >= 0 ? 'E' : 'O'}
          </p>
        )}
        {isLyon && (
          <section className="city-pointcloud-lyon" aria-label="LiDAR de la Métropole de Lyon">
            <h3>LiDAR Métropole de Lyon · 2018</h3>
            {lyonDataset.status === 'loading' && <p className="city-pointcloud-message">Chargement des métadonnées EPT…</p>}
            {lyonDataset.status === 'error' && (
              <p className="city-pointcloud-message is-error">Jeu de données indisponible : {lyonDataset.error}</p>
            )}
            {lyonDataset.data && (
              <>
                <div className="city-pointcloud-meta">
                  <span>{formatPointCount(lyonDataset.data.pointCount)}</span>
                  {lyonDataset.data.coordinateSystem && <span>{lyonDataset.data.coordinateSystem}</span>}
                  {lyonDataset.data.license && <span>{lyonDataset.data.license}</span>}
                  {lyonDataset.data.note && <span>{lyonDataset.data.note}</span>}
                </div>
                {lyonViewerUrl ? (
                  <iframe
                    className="city-pointcloud-ept-frame"
                    title="Viewer Potree du LiDAR de la Métropole de Lyon"
                    src={lyonViewerUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    allow="fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <p className="city-pointcloud-message is-error">Adresse EPT invalide.</p>
                )}
                {lyonDataset.data.sourceUrl && (
                  <a href={lyonDataset.data.sourceUrl} target="_blank" rel="noreferrer noopener">
                    Source officielle — data.gouv.fr
                  </a>
                )}
              </>
            )}
          </section>
        )}
        {catalog.status === 'loading' && <p className="city-pointcloud-message">Recherche des jeux de données…</p>}
        {catalog.status === 'error' && <p className="city-pointcloud-message is-error">Catalogue indisponible : {catalog.error}</p>}
        {catalog.status === 'ready' && !available.length && !isLyon && (
          <p className="city-pointcloud-message">
            Aucun jeu Potree converti n’est associé. Placez les données converties dans
            <code> POINTCLOUD_DIR/potree/&lt;nom-du-fichier&gt;/cloud.js</code>.
          </p>
        )}
        {selected && (
          <>
            {available.length > 1 && (
              <label className="city-pointcloud-select">
                Jeu de données
                <select value={selected.name} onChange={(event) => setSelectedName(event.target.value)}>
                  {available.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
              </label>
            )}
            <div className="city-pointcloud-meta">
              <span>{formatPointCount(selected.pointCount)}</span>
              <span>{selected.coordinateSystemWkt ? 'CRS embarqué' : 'CRS non détecté dans l’en-tête LAS'}</span>
              {selected.bounds && (
                <span>
                  Emprise native : {fixed(selected.bounds.minX, 2)}, {fixed(selected.bounds.minY, 2)}
                  {' – '}{fixed(selected.bounds.maxX, 2)}, {fixed(selected.bounds.maxY, 2)}
                </span>
              )}
            </div>
            <PotreeViewer key={`${cityKey}|${selected.name}`} cloud={selected} coarse={coarse} />
          </>
        )}
      </div>
    </section>
  );
}
