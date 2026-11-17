import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Link, Typography } from '@mui/material';

const EMBED_CONFIG_PROPERTY = '__keepTrackEmbedConfig';
const EMBED_READY_EVENT = 'keeptrack-embed:ready';
const DEFAULT_SRC = import.meta.env.VITE_KEEPTRACK_EMBED_URL || '/keeptrack/index.html';

const EMBED_CONFIG = {
  apiVersion: '1',
  catalog: { mode: 'full' },
  ownership: { selection: 'shared', camera: 'shared', time: 'shared' },
  ui: {
    bottomMenu: false,
    topMenu: false,
    search: false,
    timeControls: false,
    keyboard: false,
    contextMenu: false,
    toasts: false,
    infoBox: false,
    hover: false,
  },
  layers: { dayNight: true, graticule: false, orbits: false, labels: 'all', labelBudget: 300 },
};

/** KeepTrack hébergé sur la même origine : accès au contrat window.keepTrackEmbed officiel. */
export function KeepTrackEarth({ visible, showTrackedObjects, zoomFactor = 1, resetSignal = 0 }) {
  const mountRef = useRef(null);
  const iframeRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const applyLayers = useCallback((shown) => {
    const api = apiRef.current;
    if (!api?.isReady) return;
    try {
      api.setLayers({ labels: shown ? 'all' : 'none', orbits: shown });
      if (shown) api.setGroundTracks('host', { pastMin: 45, futureMin: 90, stepSec: 60 });
      else api.setGroundTracks(null);
    } catch (e) {
      setError(e?.message || 'Impossible de modifier les couches KeepTrack.');
    }
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let alive = true;
    let timeout;
    const iframe = document.createElement('iframe');
    iframe.title = 'KeepTrack — catalogue et suivi des objets orbitaux';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'fullscreen';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#05070c;';
    iframe[EMBED_CONFIG_PROPERTY] = EMBED_CONFIG;
    const expectedOrigin = window.location.origin;
    const src = new URL(DEFAULT_SRC, expectedOrigin);

    if (src.origin !== expectedOrigin) {
      setStatus('error');
      setError('KeepTrack doit être hébergé sur la même origine que Gobai pour permettre le pilotage par son API officielle.');
      return undefined;
    }

    const onReady = () => {
      if (!alive) return;
      const api = iframe.contentWindow?.keepTrackEmbed;
      if (!api?.isReady) return;
      apiRef.current = api;
      setStatus('ready');
      setError('');
      try {
        api.setCamera({ mode: 'earth', center: { lat: 0, lon: 0 }, zoom: 1 });
        api.setLayers({ labels: showTrackedObjects ? 'all' : 'none', orbits: showTrackedObjects });
        if (showTrackedObjects) api.setGroundTracks('host', { pastMin: 45, futureMin: 90, stepSec: 60 });
      } catch (e) {
        setError(e?.message || 'L’API KeepTrack a refusé la configuration initiale.');
      }
    };
    const onLoad = () => {
      if (!alive) return;
      const api = iframe.contentWindow?.keepTrackEmbed;
      if (api?.isReady) onReady();
      else {
        clearTimeout(timeout);
        timeout = window.setTimeout(() => {
          if (!alive || apiRef.current) return;
          setStatus('error');
          setError(`Le moteur KeepTrack ne répond pas à ${src.pathname}. Copie le dossier de build KeepTrack dans frontend/public/keeptrack/ ou configure VITE_KEEPTRACK_EMBED_URL.`);
        }, 12000);
      }
    };

    iframe.addEventListener(EMBED_READY_EVENT, onReady);
    iframe.addEventListener('load', onLoad);
    mount.appendChild(iframe);
    iframeRef.current = iframe;
    setStatus('loading');
    setError('');
    iframe.src = src.href;

    return () => {
      alive = false;
      clearTimeout(timeout);
      iframe.removeEventListener(EMBED_READY_EVENT, onReady);
      iframe.removeEventListener('load', onLoad);
      try { apiRef.current?.setGroundTracks(null); } catch { /* frame déjà arrêté */ }
      apiRef.current = null;
      iframeRef.current = null;
      iframe.remove();
    };
  // Le frame est créé une seule fois ; les réglages sont appliqués par les effets ci-dessous.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { applyLayers(showTrackedObjects); }, [showTrackedObjects, applyLayers]);

  useEffect(() => {
    const mount = mountRef.current;
    if (mount) mount.style.visibility = visible ? 'visible' : 'hidden';
    const api = apiRef.current;
    if (!api?.isReady) return;
    try { if (visible) api.resume(); else api.suspend(); } catch { /* frame en cours de fermeture */ }
  }, [visible, status]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api?.isReady) return;
    try {
      const zoom = Math.max(1, Math.min(30, Number(zoomFactor) || 1));
      api.setCamera({ mode: 'earth', zoom });
    } catch (e) {
      setError(e?.message || 'Synchronisation du zoom KeepTrack impossible.');
    }
  }, [zoomFactor]);

  useEffect(() => {
    if (!resetSignal || !apiRef.current?.isReady) return;
    try { apiRef.current.setCamera({ mode: 'earth', center: { lat: 0, lon: 0 }, zoom: 1 }); }
    catch (e) { setError(e?.message || 'Réinitialisation de la caméra KeepTrack impossible.'); }
  }, [resetSignal]);

  return (
    <Box data-keeptrack-embed sx={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', bgcolor: '#05070c' }}>
      <Box ref={mountRef} sx={{ position: 'absolute', inset: 0, visibility: visible ? 'visible' : 'hidden' }} />
      {status === 'loading' && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3, pointerEvents: 'none' }}>
          <Typography variant="body2" color="grey.400">Initialisation du moteur orbital KeepTrack…</Typography>
        </Box>
      )}
      {status === 'error' && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3, bgcolor: '#080d17' }}>
          <Alert severity="warning" sx={{ maxWidth: 560, bgcolor: 'rgba(20,29,44,.94)' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>KeepTrack non disponible dans cette installation</Typography>
            <Typography variant="body2">{error}</Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>Le dépôt amont fournit une API d’intégration same-origin : une iframe distante ne peut pas être pilotée par Gobai.</Typography>
            <Link href="https://github.com/thkruz/keeptrack.space" target="_blank" rel="noreferrer" underline="hover">Dépôt officiel KeepTrack</Link>
          </Alert>
        </Box>
      )}
    </Box>
  );
}
