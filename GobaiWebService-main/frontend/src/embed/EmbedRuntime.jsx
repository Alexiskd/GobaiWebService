import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SolarEngine } from '@/moteur/engine/engine';
import { fetchSceneData, tilesApi } from '@/moteur/api';
import { createHudStore } from '@/moteur/engine/hudStore';
import './embed.css';

const NS = 'gobai';
const VERSION = 1;

function getParentOrigin() {
  const value = new URLSearchParams(location.search).get('parentOrigin');
  if (!value || value === 'null' || value === '*') return null;
  try {
    const parsed = new URL(value);
    return parsed.origin === value ? parsed.origin : null;
  } catch { return null; }
}

function send(type, payload = {}) {
  const targetOrigin = getParentOrigin();
  if (!targetOrigin || window.parent === window) return;
  window.parent.postMessage({ namespace: NS, version: VERSION, type, payload }, targetOrigin);
}

function EmbedRuntime() {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let engine;
    const params = new URLSearchParams(location.search);
    const planet = params.get('planet') || 'terre';
    const transparent = params.get('transparent') !== 'false';
    const controls = params.get('controls') !== 'false';
    const hud = createHudStore({ date: '', focusText: '', zoomText: '', zoomShort: '', scaleText: '', cityFocus: null, tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null, gps: null, lidarPoints: null, viewLock: null, fps: 0, perf: null });
    const labels = { sun: null, planets: [], cities: [] };

    (async () => {
      try {
        const dataUrl = params.get('dataUrl');
        const data = dataUrl
          ? await fetch(dataUrl).then((r) => { if (!r.ok) throw new Error(`Chargement des données impossible (${r.status})`); return r.json(); })
          : await fetchSceneData();
        if (cancelled) return;
        engine = new SolarEngine({
          container: hostRef.current,
          data,
          labels,
          hud,
          tilesApi,
          options: { transparent, embed: true },
          onFocusChange: (index) => send('planet.change', {
            index,
            planet: engine?.focusTargets?.[index]?.name || null,
          }),
        });
        engineRef.current = engine;
        if (transparent || params.get('stars') === 'false') engine.setSkyVisible(false);
        if (planet) engine.focusBySlug(planet);
        if (!controls) engine.removeInput?.();
        setReady(true);
        send('embed.ready', { planet, transparent, controls });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || String(e));
          send('embed.error', { message: e?.message || String(e) });
        }
      }
    })();

    const expectedOrigin = getParentOrigin();
    const onMessage = (event) => {
      if (event.source !== window.parent || !expectedOrigin || event.origin !== expectedOrigin) return;
      const message = event.data;
      if (!message || message.namespace !== NS || message.version !== VERSION || typeof message.type !== 'string' || !engineRef.current) return;
      const payload = message.payload || {};
      try {
        switch (message.type) {
          case 'planet.change': engineRef.current.focusBySlug(String(payload.planet || '')); break;
          case 'camera.focus': engineRef.current.focusBySlug(String(payload.planet || '')); break;
          case 'camera.zoom': {
            const factor = Number(payload.factor);
            if (Number.isFinite(factor) && factor > 0) engineRef.current.zoom(factor);
            break;
          }
          case 'camera.rotate': {
            const azimuth = Number(payload.azimuth || 0);
            const elevation = Number(payload.elevation || 0);
            if (Number.isFinite(azimuth) && Number.isFinite(elevation)) {
              engineRef.current.az += azimuth * Math.PI / 180;
              engineRef.current.el = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, engineRef.current.el + elevation * Math.PI / 180));
              engineRef.current.markActive?.();
            }
            break;
          }
          case 'engine.pause': engineRef.current.setSuspended(true); break;
          case 'engine.resume': engineRef.current.setSuspended(false); break;
          default: break;
        }
      } catch (e) { send('embed.error', { message: e?.message || String(e) }); }
    };
    window.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
      engineRef.current = null;
      engine?.dispose();
    };
  }, []);

  return <main className="gobai-embed-root">
    <div ref={hostRef} className="gobai-embed-stage" aria-label="Globe 3D interactif" />
    {error && <div className="gobai-embed-error" role="alert">Gobai Embed : {error}</div>}
    {!ready && !error && <div className="gobai-embed-loading" aria-label="Chargement du globe" />}
  </main>;
}

const root = createRoot(document.getElementById('gobai-embed-root'));
root.render(<EmbedRuntime />);
