import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHudStore, useHud } from '@/engine/hudStore';
import { bodyId } from '@/engine/bodyPlaces';
import {
  fetchBorders, fetchCityLabels, fetchMoonEphemeris, fetchMoonOrbiters, fetchMoonPhases,
  fetchShadowCam, fetchShadowCamMeta, resolveApiUrl, searchPlaces, tilesApi,
} from '@/api';
import { useSolarData } from '@/hooks/useSolarData';
import { useSolarEngine } from '@/hooks/useSolarEngine';
import { useTileLayers } from '@/hooks/useTileLayers';
import { useToasts } from '@/hooks/useToasts';
import { useDraggable } from '@/hooks/useDraggable';
import { BodyLayersMenu, BodyPlacesInfo, useBodyView } from './AdaptiveComponents';
import PayPalDonateButton from './PayPalDonateButton';

// Composantes globales du frontend : tout ce qui est commun aux astres.
// Seules les deux composantes de AdaptiveComponents.jsx changent selon la planète.

// ---------------------------------------------------------------- Utilitaires partagés

const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const coords = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'O'}`;
const defaultOpen = () => typeof window === 'undefined' || window.innerWidth > 720;

// ---------------------------------------------------------------- Recherche de lieux

/**
 * Recherche dans les lieux d’un corps (villes, lieux lunaires, repères planétaires).
 * `onPick` absent : la liste reste informative (corps sans surface navigable).
 */
export function PlaceSearch({ places, onPick, placeholder = 'Rechercher un lieu…', max = 8 }) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());

  const results = useMemo(() => {
    if (!q) return [];
    return places
      .filter((f) => fold(f.name).includes(q)
        || (f.native && fold(f.native).includes(q))
        || (f.kind && fold(f.kind).includes(q))
        || (f.info && fold(f.info).includes(q)))
      .slice(0, max);
  }, [q, places, max]);

  const detail = (f) => [f.kind, f.native ? f.name : null, f.info, coords(f.lat, f.lon)]
    .filter(Boolean).join(' · ');

  return (
    <div className="moon-search place-search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onPick && results[0]) onPick(results[0]);
          else if (e.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck="false"
      />
      {q && (
        <ul>
          {results.map((f) => (
            <li key={f.name}>
              {onPick ? (
                <button onClick={() => onPick(f)} title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </button>
              ) : (
                <div className="place-row" title={f.info || coords(f.lat, f.lon)}>
                  <span>{f.native || f.name}</span>
                  <small>{detail(f)}</small>
                </div>
              )}
            </li>
          ))}
          {!results.length && <li className="empty">Aucun lieu pour « {query} ».</li>}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Attribution

const ATTRIBUTION_DEBOUNCE_MS = 700;

/** Mention de source de la carte affichée, redemandée quand la vue se stabilise. */
export function Attribution({ hud, moonReal = false, extra = '' }) {
  const tiles = useHud(hud, (s) => s.tiles);
  const layerId = tiles?.layerId ?? null;
  const b = tiles?.bounds ?? null;
  const [copyright, setCopyright] = useState('');

  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;
  useEffect(() => {
    if (!layerId || !b) { setCopyright(''); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});
    }, ATTRIBUTION_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);
  const mars = useHud(hud, (s) => s.marsTiles);
  const mercury = useHud(hud, (s) => s.mercuryTiles);
  const venus = useHud(hud, (s) => s.venusTiles);
  const tileText = tiles?.layerId ? tiles.attributionText : '';
  // Lune « réelle » : détail Kaguya (fond) coloré par les couleurs naturelles NASA SVS.
  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';
  const marsText = mars?.layerId ? mars.attributionText : '';
  const mercuryText = mercury?.layerId ? mercury.attributionText : '';
  const venusText = venus?.layerId ? venus.attributionText : '';
  return (
    <p className="attribution">
      {tileText && <strong>{tileText}</strong>}
      {copyright && <span> {copyright}</span>}
      {moonText && <span>{tileText ? ' · ' : ''}Lune : {moonText}</span>}
      {marsText && <span>{tileText || moonText ? ' · ' : ''}Mars : {marsText}</span>}
      {mercuryText && <span>{tileText || moonText || marsText ? ' · ' : ''}Mercure : {mercuryText}</span>}
      {venusText && <span>{tileText || moonText || marsText || mercuryText ? ' · ' : ''}Vénus : {venusText}</span>}
      {extra && <span>{tileText || moonText || marsText || mercuryText || venusText ? ' · ' : ''}{extra}</span>}
    </p>
  );
}

// ---------------------------------------------------------------- Palette de recherche

const MAX_RESULTS = 40;
const WORLD_DEBOUNCE_MS = 300;

/**
 * Recherche rapide (Ctrl K ou /) : astres, villes de l’API, puis lieux mondiaux si Uber Maps est configuré.
 * ↑ ↓ pour choisir, Entrée pour aller, Échap pour fermer.
 * `cities` = liste de l’API ; `index` renvoie à cette liste (utilisé par le moteur).
 */
export function CommandPalette({ open, onClose, cities, bodyNames, onPickCity, onPickBody, onPickPlace, worldSearch = false }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [world, setWorld] = useState({ q: '', items: [], status: 'idle' }); // résultats du fournisseur mondial
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const index = useMemo(() => [
    ...bodyNames.map((name, i) => ({ type: 'body', name, key: fold(name), i, sub: 'Astre' })),
    ...cities.map((c, i) => ({ type: 'city', name: c.name, key: fold(c.name), i, sub: coords(c.lat, c.lon) })),
  ], [cities, bodyNames]);

  // Recherche mondiale via le backend, avec un court délai pendant la frappe.
  useEffect(() => {
    const q = query.trim();
    if (!open || !worldSearch || q.length < 2) { setWorld({ q: '', items: [], status: 'idle' }); return undefined; }
    const ctrl = new AbortController();
    setWorld((w) => ({ ...w, status: 'loading' }));
    const t = setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => setWorld({ q, items: r.items, status: 'ready' }))
        .catch((e) => { if (e.name !== 'AbortError') setWorld({ q, items: [], status: 'error' }); });
    }, WORLD_DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, worldSearch, query]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const hits = q ? index.filter((r) => r.key.includes(q)) : index.filter((r) => r.type === 'body');
    // Les débuts de nom d’abord.
    if (q) hits.sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)));
    const local = hits.slice(0, MAX_RESULTS);
    // Lieux du monde entier, sans doublon avec les villes déjà listées.
    const seen = new Set(local.filter((r) => r.type === 'city').map((r) => r.key));
    const places = world.items
      .filter((p) => !seen.has(fold(p.name)))
      .map((p, i) => ({ type: 'place', name: p.name, i, place: p, sub: p.context || coords(p.lat, p.lon) }));
    return [...local, ...places];
  }, [index, query, world.items]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;

  const choose = (r) => {
    if (!r) return;
    if (r.type === 'city') onPickCity(r.i);
    else if (r.type === 'place') onPickPlace?.(r.place);
    else onPickBody(r.i);
    onClose();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Rechercher">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={worldSearch ? 'N’importe quelle ville du monde, une planète…' : 'Une ville, une planète…'}
          autoComplete="off"
          spellCheck="false"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `pal-${active}` : undefined}
        />
        <ul id="palette-list" role="listbox" ref={listRef}>
          {results.map((r, n) => (
            <li
              key={`${r.type}-${r.i}`}
              id={`pal-${n}`}
              role="option"
              aria-selected={n === active}
              onMouseMove={() => setActive(n)}
              onClick={() => choose(r)}
            >
              <span>{r.name}</span>
              <small>{r.sub}</small>
            </li>
          ))}
          {!results.length && world.status !== 'loading' && <li className="empty" aria-disabled="true">Aucun résultat pour « {query} ». Essayez un autre nom.</li>}
          {worldSearch && world.status === 'loading' && <li className="empty" aria-disabled="true">Recherche dans le monde entier…</li>}
          {worldSearch && world.status === 'error' && <li className="empty" aria-disabled="true">Recherche mondiale indisponible.</li>}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Boussole

// Boussole : aiguille 3D (pointe rouge au nord, pointe blanche au sud) qui tourne avec le cap ;
// un clic recale la caméra sur le nord géographique.
export function Compass({ hud, onRecalibrate }) {
  const compass = useHud(hud, (s) => s.compass);
  if (!compass) return null;

  const deg = (compass.angle * 180) / Math.PI;
  const shown = Math.round(((deg % 360) + 540) % 360 - 180);
  const side = shown === 0 ? 'en haut' : shown === 180 || shown === -180 ? 'en bas' : `${Math.abs(shown)}° ${shown > 0 ? 'à droite' : 'à gauche'}`;
  const hint = `Nord ${side} · cliquer pour recaler la caméra sur le nord`;

  return (
    <div className="compass-pad">
      <button type="button" className="compass" title={hint} aria-label={`Boussole, ${hint}`} onClick={onRecalibrate}>
        <img
          className="compass-needle"
          src="/compass-needle.webp"
          alt=""
          draggable="false"
          style={{ transform: `rotate(${deg}deg)` }}
        />
        <span className="compass-mark" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- En-tête du HUD

export function HudTop({ hud }) {
  const date = useHud(hud, (s) => s.date);
  const focusText = useHud(hud, (s) => s.focusText);
  const drag = useDraggable('titre');
  return (
    <header className="title" ref={drag.ref} style={drag.style} {...drag.handleProps}>
      <img className="brand-logo" src="/logo.png" alt="" width="96" height="96" draggable={false} />
      <div className="title-text">
        <h1>
          Gobai Space ١д१壹אη하 <span className="live">en direct</span>
        </h1>
        <p>{date}</p>
        <p>{focusText}</p>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- Rail des astres

// Rail des astres : un clic centre la vue sur l'astre, sans changer le niveau de zoom.
// Les tuiles larges (Soleil, Lune) ouvrent et ferment la grille bento.
export const Navigator = memo(function Navigator({ bodies, focus, onSelect }) {
  const drag = useDraggable('navigation');
  return (
    <nav className="navigator" aria-label="Astres" ref={drag.ref} style={drag.style} {...drag.handleProps}>
      <span className="nav-title" aria-hidden="true"><span className="drag-grip" />Navigation</span>
      {bodies.map((body, i) => {
        const wide = i === 0 || i === bodies.length - 1;
        return (
          <button
            key={body.name}
            className={wide ? 'nav-item nav-wide' : 'nav-item'}
            style={{ '--body': body.color }}
            aria-current={focus === i ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className="nav-orb" aria-hidden="true" />
            <span className="nav-name">{body.name}</span>
            <span className="nav-id" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          </button>
        );
      })}
    </nav>
  );
});

// ---------------------------------------------------------------- Étiquettes de scène

// Étiquettes HTML superposées à la scène. Le moteur les positionne à chaque image
// (transform / display) via les éléments enregistrés dans `registry` ; React ne les
// re-rend jamais (composant mémoïsé, props stables).
export const SceneLabels = memo(function SceneLabels({ data, registry, onSelectBody }) {
  const { sun, planets } = data.bodies;
  return (
    <>
      <div className="l" ref={(el) => { registry.sun = el; }} style={{ '--c': sun.color }}>
        {sun.name}
      </div>

      {planets.map((p, i) => (
        <div
          key={p.name}
          className="l"
          ref={(el) => { registry.planets[i] = el; }}
          style={{ '--c': p.color }}
          title={`Cliquer pour centrer ${p.name}`}
          onClick={(e) => { e.stopPropagation(); onSelectBody(i + 1); }}
        >
          {p.name}
        </div>
      ))}

      {data.cities.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="l"
          ref={(el) => { registry.cities[i] = el; }}
          style={{ '--c': '#fff', fontSize: 11, display: 'none' }}
        >
          {c.name}
        </div>
      ))}

    </>
  );
});

// ---------------------------------------------------------------- Aide clavier

const KEYS = [
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  ['+  /  −', 'Zoomer, dézoomer'],
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  ['L', 'Ouvrir ou fermer les informations'],
  ['?', 'Afficher cette aide'],
  ['Échap', 'Fermer le panneau ouvert'],
];

export function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel help" role="dialog" aria-modal="true" aria-label="Raccourcis clavier">
        <header>
          <h2>Raccourcis clavier</h2>
          <button className="ghost" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <dl>
          {KEYS.map(([k, d]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
          ))}
        </dl>
        <p className="hint">Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Notifications

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          <button className="ghost" onClick={() => onDismiss(t.id)} aria-label="Fermer le message">×</button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Barre d’outils

function Readout({ hud }) {
  const zoomText = useHud(hud, (s) => s.zoomText);
  const tileZoom = useHud(hud, (s) => (s.tiles && s.tiles.layerId ? s.tiles.zoom : null));
  return (
    <div className="readout" aria-live="off">
      <span>{zoomText}</span>
      {tileZoom !== null && <span className="dim">carte niveau {tileZoom}</span>}
    </div>
  );
}

export function Toolbar({
  hud, auto, tilt, layersOpen,
  onSearch, onToggleLayers, onToggleAuto, onToggleTilt, onReset,
}) {
  return (
    <>
      <Readout hud={hud} />
      <div className="toolbar" role="toolbar" aria-label="Actions">
        <button onClick={onSearch} title="Rechercher une ville ou un astre (Ctrl K)">Rechercher</button>
        <button aria-pressed={layersOpen} onClick={onToggleLayers}>Informations</button>
        <button aria-pressed={auto} onClick={onToggleAuto} title="Rotation automatique">Rotation</button>
        <button aria-pressed={tilt} onClick={onToggleTilt} title="Vue 3/4 automatique en approchant du sol">Vue 3/4</button>
        <button onClick={onReset} title="Retour à la vue d’ensemble (0 du pavé numérique)">Vue globale</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Zoom

const HOLD_INTERVAL_MS = 65;

// Boutons + / − flottants : le zoom se répète tant que le bouton reste enfoncé
// (souris ou écran tactile).
export function ZoomPad({ onZoom }) {
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = (factor) => (e) => {
    e.preventDefault();
    stop();
    onZoom(factor);
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  };

  // Accessibilité clavier : Entrée / Espace = un cran de zoom.
  const onKeyDown = (factor) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(factor);
    }
  };

  useEffect(() => {
    const events = ['pointerup', 'pointercancel', 'pointerleave'];
    events.forEach((t) => window.addEventListener(t, stop));
    window.addEventListener('blur', stop);
    return () => {
      stop();
      events.forEach((t) => window.removeEventListener(t, stop));
      window.removeEventListener('blur', stop);
    };
  }, [stop]);

  return (
    <div className="zoom-pad" role="group" aria-label="Contrôles de zoom">
      <button title="Maintenir pour zoomer" aria-label="Maintenir pour zoomer" onPointerDown={start(0.94)} onKeyDown={onKeyDown(0.94)}>
        +
      </button>
      <button title="Maintenir pour dézoomer" aria-label="Maintenir pour dézoomer" onPointerDown={start(1.064)} onKeyDown={onKeyDown(1.064)}>
        −
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Panneau unique (droite)

/** Panneau unique à droite : « astre en direct » puis « Informations » quand elles sont ouvertes. */
function BodyPanelShell({ view, hud, layersOpen, onCloseLayers, menu, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const drag = useDraggable('panneau');
  const layersRef = useRef(null);

  useEffect(() => {
    if (!layersOpen) return;
    setOpen(true);
    layersRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [layersOpen]);

  return (
    <section
      className="panel moon-live live-panel"
      data-body={view?.id}
      aria-label={view ? `${view.name} en direct` : 'Informations'}
      ref={drag.ref}
      style={drag.style}
    >
      <header {...drag.handleProps}>
        <span className="drag-grip" aria-hidden="true" />
        <h2>{view ? <>{view.name} <span className="live">en direct</span></> : 'Informations'}</h2>
        <button className="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Réduire' : 'Déplier'}>
          {open ? '–' : '+'}
        </button>
      </header>
      {open && (
        <>
          {children}
          {layersOpen && (
            <section className="layers-section" aria-label="Informations" ref={layersRef}>
              <header>
                {view && <h3>Informations{menu.bodyName ? ` · ${menu.bodyName}` : ''}</h3>}
                <button className="ghost" onClick={onCloseLayers} aria-label="Fermer les informations">×</button>
              </header>
              <BodyLayersMenu hud={hud} {...menu} />
            </section>
          )}
        </>
      )}
    </section>
  );
}

export function BodyPanel({ hud, data, phases, handlers, layersOpen, onCloseLayers, ...menu }) {
  const view = useBodyView({ hud, data, phases, handlers });
  if (!view && !layersOpen) return null;

  return (
    <BodyPanelShell view={view} hud={hud} layersOpen={layersOpen} onCloseLayers={onCloseLayers} menu={menu}>
      {view && <BodyPlacesInfo view={view} handlers={handlers} Search={PlaceSearch} />}
    </BodyPanelShell>
  );
}

// ---------------------------------------------------------------- Scène complète

// Les anciennes réponses de l'API n'ont pas de champ `body` : ce sont des couches de la Terre.
const isMoonLayer = (l) => l.body === 'moon';
const isMarsLayer = (l) => l.body === 'mars';
const isMercuryLayer = (l) => l.body === 'mercury';
const isVenusLayer = (l) => l.body === 'venus';
const isEarthLayer = (l) => !l.body || l.body === 'earth';

// Scène complète : monte le moteur 3D et l'interface, une fois les données de l'API reçues.
export function SolarScene({ data }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  // Éléments d'étiquettes remplis par <SceneLabels>, lus par le moteur.
  const labels = useMemo(() => ({ sun: null, planets: [], cities: [] }), []);
  const hud = useMemo(
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null }),
    []
  );
  const bodyNames = useMemo(
    () => [data.bodies.sun.name, ...data.bodies.planets.map((p) => p.name), data.bodies.moon.name],
    [data]
  );
  const navBodies = useMemo(
    () => [
      { name: data.bodies.sun.name, color: data.bodies.sun.color || '#ffb300' },
      ...data.bodies.planets.map((p) => ({ name: p.name, color: p.color || '#8b97b3' })),
      { name: data.bodies.moon.name, color: '#d8d2c4' },
    ],
    [data]
  );

  const { toasts, push, dismiss } = useToasts();
  const { engine, focus, error } = useSolarEngine({ containerRef, data, labels, hud, engineRef });
  const tileLayers = useTileLayers();

  // Astre visualisé : 0 = vue d'ensemble (Soleil), 1..n = planètes, dernier = Lune.
  const moonIndex = bodyNames.length - 1;
  const currentBodyId = focus === 0 ? null : focus === moonIndex ? 'moon' : bodyId(data.bodies.planets[focus - 1]);
  const currentBodyName = focus === 0 ? null : bodyNames[focus];

  const [auto, setAuto] = useState(true);
  const [tilt, setTilt] = useState(true);
  const [roads, setRoads] = useState(true);
  const [shade, setShade] = useState(true);
  const [borders, setBorders] = useState(true);
  const [coasts, setCoasts] = useState(true);
  const [countryNames, setCountryNames] = useState(false);
  const [cityNames, setCityNames] = useState(false);
  const [cityInfo, setCityInfo] = useState(null); // { attribution, count } une fois chargés
  const [bordersInfo, setBordersInfo] = useState(null); // { attribution } une fois chargées
  const [baseId, setBaseId] = useState(null);         // fond de la Terre (null = pas encore chargé)
  // Lune « réelle » : détail Kaguya coloré par les couleurs naturelles (NASA SVS), une seule texture de surface.
  const [moonBaseId, setMoonBaseId] = useState(null);
  const [marsBaseId, setMarsBaseId] = useState(null);
  const [mercuryBaseId, setMercuryBaseId] = useState(null);
  const [venusBaseId, setVenusBaseId] = useState(null);
  const [moonColorOk, setMoonColorOk] = useState(null); // texture des couleurs : null = en cours, true / false
  const [moonFeatures, setMoonFeatures] = useState(false);
  const [moonOrbiters, setMoonOrbiters] = useState(false);
  const [moonModel, setMoonModel] = useState(false);
  const [moonPhases, setMoonPhases] = useState(null);
  const [shadowcam, setShadowcam] = useState(false);
  const [shadowcamInfo, setShadowcamInfo] = useState(null); // { count } ou { error }
  const [moonModelInfo, setMoonModelInfo] = useState(null); // null = pas chargé, 'loading', { … } ou { error }
  const [panel, setPanel] = useState(null);     // 'layers' | 'search' | 'help' | null
  const autoChosen = useRef(false);
  const baseRequest = useRef(0);
  const moonRequest = useRef(0);
  const marsRequest = useRef(0);
  const mercuryRequest = useRef(0);
  const venusRequest = useRef(0);

  const earthLayers = useMemo(() => tileLayers.layers.filter(isEarthLayer), [tileLayers.layers]);
  const moonLayers = useMemo(() => tileLayers.layers.filter(isMoonLayer), [tileLayers.layers]);
  const marsLayers = useMemo(() => tileLayers.layers.filter(isMarsLayer), [tileLayers.layers]);
  const mercuryLayers = useMemo(() => tileLayers.layers.filter(isMercuryLayer), [tileLayers.layers]);
  const venusLayers = useMemo(() => tileLayers.layers.filter(isVenusLayer), [tileLayers.layers]);
  // Détail Kaguya : les tuiles s'affinent en zoomant ; l'ombrage LOLA ne sert que de secours.
  const moonDetailLayer = moonLayers.find((l) => l.id.includes('kaguya')) || null;
  const moonShadeLayer = moonLayers.find((l) => l.id.includes('lola-shade')) || null;
  const moonRealAvailable = Boolean(moonShadeLayer || moonDetailLayer);
  const baseLayer = earthLayers.find((l) => l.id === baseId) || null;
  const overlayLayer = earthLayers.find((l) => l.kind === 'overlay') || null;
  // Un fond « plan », « relief » ou « hybride » contient déjà routes et noms ; le calque ne sert que sur la photo.
  const roadsIncluded = baseLayer && baseLayer.kind !== 'imagery';
  const roadsUnavailable = baseLayer?.kind === 'imagery' && !overlayLayer;
  const roadsHint = roadsIncluded ? 'Déjà inclus dans ce fond' : roadsUnavailable ? 'Non proposé par ce fournisseur' : undefined;
  // Les fonds « plan », « relief » ou « hybride » ont déjà leurs noms de villes : on n'en superpose pas d'autres.
  const namesIncluded = Boolean(baseLayer && baseLayer.kind !== 'imagery');
  const showCityNames = cityNames && !namesIncluded;

  // L'état de l'interface est la source de vérité ; le moteur le suit.
  useEffect(() => { engine?.setAutoRotate(auto); }, [engine, auto]);
  useEffect(() => { engine?.setTilt(tilt); }, [engine, tilt]);
  useEffect(() => { engine?.setTileShade(shade); }, [engine, shade]);
  useEffect(() => { engine?.setBordersVisible(borders); }, [engine, borders]);
  useEffect(() => { engine?.setCoastsVisible(coasts); }, [engine, coasts]);
  useEffect(() => { engine?.setCountryLabelsVisible(countryNames); }, [engine, countryNames]);
  useEffect(() => { engine?.setCityLabelsVisible(showCityNames); }, [engine, showCityNames]);
  useEffect(() => { engine?.setMoonFeatureTypes(moonFeatures ? ['landing', 'mare', 'crater', 'region'] : []); }, [engine, moonFeatures]);
  useEffect(() => { engine?.setMoonOrbitersVisible(moonOrbiters); }, [engine, moonOrbiters]);
  useEffect(() => { engine?.setMoonModelVisible(moonModel); }, [engine, moonModel]);
  useEffect(() => { engine?.setShadowCamVisible(shadowcam); }, [engine, shadowcam]);

  // Danuri : catalogue des mosaïques ShadowCam (pôles Nord et Sud) ; les images se chargent en approchant d'un pôle.
  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchShadowCam(ctrl.signal)
      .then((r) => {
        engine.setShadowCam(r.items, {
          meta: (id, res) => fetchShadowCamMeta(id, res),
          imageUrl: (id, res) => resolveApiUrl(`/api/v1/danuri/shadowcam/${encodeURIComponent(id)}/${res}/image.png`),
        });
        setShadowcamInfo({ count: r.items.length, source: r.source });
      })
      .catch((e) => { if (e.name !== 'AbortError') setShadowcamInfo({ error: e.message }); });
    return () => ctrl.abort();
  }, [engine]);

  // Sondes en orbite lunaire (positions réelles JPL Horizons) : table de 6 h 30, redemandée toutes les 2 h.
  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonOrbiters(ctrl.signal)
        .then((r) => engine.setMoonOrbiters(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('Sondes lunaires indisponibles :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 2 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  // Prochaines phases (U.S. Naval Observatory), redemandées toutes les 6 h.
  useEffect(() => {
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonPhases(ctrl.signal)
        .then((r) => setMoonPhases(r))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('USNO indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, []);

  // Modèle 3D officiel de la Lune (NASA, GLB, plusieurs Mo) : chargé la première fois que la Lune est ciblée.
  useEffect(() => {
    if (!engine || focus !== moonIndex || !moonModel || moonModelInfo) return;
    setMoonModelInfo('loading');
    engine.loadMoonModel(resolveApiUrl('/api/v1/tiles/moon-model.glb'))
      .then((info) => setMoonModelInfo(info || {}))
      .catch((err) => {
        setMoonModelInfo({ error: err.message || String(err) });
        push(`Modèle 3D de la Lune indisponible : ${err.message || err}`, 'warn', 9000);
      });
  }, [engine, focus, moonIndex, moonModel, moonModelInfo, push]);

  // Position exacte de la Lune (JPL Horizons) : table de ≈ 50 h, redemandée toutes les 6 h. En cas d'échec, le moteur
  // garde la théorie ELP abrégée (≈ 0,05° près) sans rien afficher d'alarmant.
  useEffect(() => {
    if (!engine) return undefined;
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonEphemeris(ctrl.signal)
        .then((r) => engine.setMoonEphemeris(r.points))
        .catch((e) => {
          if (e.name === 'AbortError') return;
          console.warn('JPL Horizons indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine]);

  // Noms des villes du monde entier (Natural Earth), affichés sur les fonds sans noms.
  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchCityLabels(ctrl.signal)
      .then((r) => { engine.setCityLabels(r.items); setCityInfo({ attribution: r.attribution, count: r.count }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Noms des villes indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  // Frontières des pays et littoraux : chargés une fois depuis l'API (Natural Earth), posés sur la Terre par le moteur.
  useEffect(() => {
    if (!engine) return undefined;
    const ctrl = new AbortController();
    fetchBorders(ctrl.signal)
      .then((r) => { engine.setBorders(r); setBordersInfo({ attribution: r.attribution }); })
      .catch((e) => { if (e.name !== 'AbortError') push(`Frontières indisponibles : ${e.message}`, 'warn', 9000); });
    return () => ctrl.abort();
  }, [engine, push]);

  const chooseBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++baseRequest.current;
    setBaseId(id);
    try {
      await e.setTileBase(id);
    } catch (err) {
      if (request !== baseRequest.current) return;
      setBaseId(null);
      push(`Fond de la Terre indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [engineRef, push]);

  const chooseMoonBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++moonRequest.current;
    setMoonBaseId(id);
    const real = id === 'real';
    try {
      // Lune « réelle » : fond = détail Kaguya (sinon l'ombrage), couleurs naturelles dans le shader.
      // Aucun calque superposé : une seule texture de surface, sans relief LOLA plaqué par-dessus.
      const pan = real && Boolean(moonDetailLayer);
      e.setMoonComposite(real, { pan });
      await Promise.all([
        e.setMoonTileBase(real ? (moonDetailLayer || moonShadeLayer).id : id),
        e.setMoonTileOverlay(null),
      ]);
    } catch (err) {
      if (request !== moonRequest.current) return;
      setMoonBaseId(null);
      push(`Carte de la Lune indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [engineRef, push, moonShadeLayer, moonDetailLayer]);

  const chooseMarsBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++marsRequest.current;
    setMarsBaseId(id);
    try {
      await e.setMarsTileBase(id);
    } catch (err) {
      if (request !== marsRequest.current) return;
      setMarsBaseId(null);
      push(`Carte de Mars indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [engineRef, push]);

  const chooseVenusBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++venusRequest.current;
    setVenusBaseId(id);
    try {
      await e.setVenusTileBase(id);
    } catch (err) {
      if (request !== venusRequest.current) return;
      setVenusBaseId(null);
      push(`Carte de Vénus indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [engineRef, push]);

  const chooseMercuryBase = useCallback(async (id) => {
    const e = engineRef.current;
    if (!e) return;
    const request = ++mercuryRequest.current;
    setMercuryBaseId(id);
    try {
      await e.setMercuryTileBase(id);
    } catch (err) {
      if (request !== mercuryRequest.current) return;
      setMercuryBaseId(null);
      push(`Carte de Mercure indisponible : ${err.message}.`, 'error', 9000);
    }
  }, [engineRef, push]);

  // Au démarrage : premier fond photo proposé par l'API, pour la Terre, la Lune, Mars, Mercure et Vénus.
  useEffect(() => {
    if (!engine || tileLayers.status !== 'ready' || autoChosen.current) return;
    autoChosen.current = true;
    // De préférence la photo avec les noms des villes (hybride), sinon la photo seule.
    const first = earthLayers.find((l) => l.kind === 'hybrid') || earthLayers.find((l) => l.kind === 'imagery');
    if (first) chooseBase(first.id);
    if (moonRealAvailable) chooseMoonBase('real');
    const mars = marsLayers.find((l) => l.kind === 'imagery');
    if (mars) chooseMarsBase(mars.id);
    // Mercure : mosaïque MESSENGER de Mercury Trek, sinon le fond QuickMap, sinon la première imagerie.
    const mercury = mercuryLayers.find((l) => l.provider === 'mercury-trek-wmts')
      || mercuryLayers.find((l) => l.provider === 'mercury-quickmap')
      || mercuryLayers.find((l) => l.kind === 'imagery');
    if (mercury) chooseMercuryBase(mercury.id);
    // Vénus : mosaïque radar Magellan de Venus Trek, sinon la première imagerie.
    const venus = venusLayers.find((l) => l.id === 'venus-magellan-c3')
      || venusLayers.find((l) => l.kind === 'imagery');
    if (venus) chooseVenusBase(venus.id);
  }, [engine, tileLayers, earthLayers, moonLayers, marsLayers, mercuryLayers, venusLayers, moonRealAvailable, chooseBase, chooseMoonBase, chooseMarsBase, chooseMercuryBase, chooseVenusBase, push]);


  // Couleurs naturelles de la Lune (NASA SVS CGI Moon Kit), relayées par le backend.
  useEffect(() => {
    if (!engine) return;
    engine.loadMoonColor(resolveApiUrl('/api/v1/tiles/moon-color.jpg'))
      .then(() => setMoonColorOk(true))
      .catch((err) => { setMoonColorOk(false); push(`Couleurs de la Lune indisponibles : ${err.message}`, 'warn', 9000); });
  }, [engine, push]);

  // Calque de routes et noms sur la photo.
  useEffect(() => {
    if (!engine) return;
    const wanted = roads && baseLayer?.kind === 'imagery' && overlayLayer ? overlayLayer.id : null;
    engine.setTileOverlay(wanted).catch((err) => push(`Routes indisponibles : ${err.message}`, 'warn'));
  }, [engine, roads, baseLayer, overlayLayer, push]);

  const selectFocus = useCallback((i) => engineRef.current?.setFocus(i), [engineRef]);
  const zoom = useCallback((f) => engineRef.current?.zoom(f), [engineRef]);
  const resetView = useCallback(() => engineRef.current?.resetView(), [engineRef]);
  // Recalage boussole : on arrête la rotation automatique, sinon le nord repart aussitôt.
  const recalibrateNorth = useCallback(() => {
    if (engineRef.current?.recalibrateNorth()) setAuto(false);
  }, [engineRef]);
  const pickCity = useCallback((index) => engineRef.current?.goCity(index), [engineRef]);
  const pickPlace = useCallback((place) => engineRef.current?.goTo(place), [engineRef]);
  const moonSide = useCallback((side) => engineRef.current?.viewMoonSide(side), [engineRef]);
  const selectOrbiter = useCallback((id) => engineRef.current?.selectOrbiter(id), [engineRef]);
  const goMoonSite = useCallback((site, altitudeKm) => engineRef.current?.goMoon(site, altitudeKm), [engineRef]);
  const goMarsSite = useCallback((site) => engineRef.current?.goToMars(site), [engineRef]);
  const goMercurySite = useCallback((site) => engineRef.current?.goToMercury(site), [engineRef]);
  const goVenusSite = useCallback((site) => engineRef.current?.goToVenus(site), [engineRef]);
  const closePanel = useCallback(() => setPanel(null), []);
  const toggle = (name) => setPanel((p) => (p === name ? null : name));

  // Raccourcis clavier (le zoom est géré par le moteur).
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPanel('search'); return; }
      if (e.key === 'Escape') { setPanel(null); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPanel('search'); }
      else if (e.key === '?') setPanel((p) => (p === 'help' ? null : 'help'));
      else if (e.key.toLowerCase() === 'l') setPanel((p) => (p === 'layers' ? null : 'layers'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="stage" ref={containerRef} />
      <SceneLabels data={data} registry={labels} onSelectBody={selectFocus} />

      <HudTop hud={hud} />
      <PayPalDonateButton />
      <BodyPanel
        hud={hud}
        data={data}
        phases={moonPhases}
        handlers={{
          onSide: moonSide,
          onSelectOrbiter: selectOrbiter,
          onGoMoon: goMoonSite,
          onGoPlace: pickPlace,
          onGoMars: goMarsSite,
          onGoMercury: goMercurySite,
          onGoVenus: goVenusSite,
        }}
        layersOpen={panel === 'layers'}
        onCloseLayers={closePanel}
        bodyId={currentBodyId}
        bodyName={currentBodyName}
        layers={earthLayers}
        moonRealAvailable={moonRealAvailable}
        moonColorOk={moonColorOk}
        moonLayers={moonLayers}
        moonBaseId={moonBaseId}
        onMoonBase={chooseMoonBase}
        marsLayers={marsLayers}
        marsBaseId={marsBaseId}
        onMarsBase={chooseMarsBase}
        mercuryLayers={mercuryLayers}
        mercuryBaseId={mercuryBaseId}
        onMercuryBase={chooseMercuryBase}
        venusLayers={venusLayers}
        venusBaseId={venusBaseId}
        onVenusBase={chooseVenusBase}
        provider={tileLayers.provider}
        listStatus={tileLayers.status}
        listError={tileLayers.error}
        baseId={baseId}
        onBase={chooseBase}
        roads={roadsIncluded ? true : roadsUnavailable ? false : roads}
        onRoads={setRoads}
        roadsHint={roadsHint}
        shade={shade}
        onShade={setShade}
        borders={borders}
        onBorders={setBorders}
        bordersHint={bordersInfo ? 'Natural Earth 1:50m' : 'Chargement…'}
        coasts={coasts}
        onCoasts={setCoasts}
        countryNames={countryNames}
        onCountryNames={setCountryNames}
        cityNames={namesIncluded ? true : cityNames}
        onCityNames={setCityNames}
        cityNamesHint={namesIncluded ? 'Déjà inclus dans ce fond' : cityInfo ? `${cityInfo.count.toLocaleString('fr-FR')} villes · Natural Earth · visibles en zoomant` : 'Chargement…'}
        cityNamesDisabled={namesIncluded}
        moonFeatures={moonFeatures}
        onMoonFeatures={setMoonFeatures}
        moonOrbiters={moonOrbiters}
        onMoonOrbiters={setMoonOrbiters}
        shadowcam={shadowcam}
        onShadowcam={setShadowcam}
        shadowcamHint={shadowcamInfo?.error ? `Indisponible : ${shadowcamInfo.error}` : shadowcamInfo ? `${shadowcamInfo.count} cratères en ombre permanente · ShadowCam (NASA) à bord de Danuri` : 'Chargement du catalogue…'}
        moonModel={moonModel}
        onMoonModel={setMoonModel}
        moonModelHint={
          moonModelInfo === 'loading' ? 'Chargement du modèle…'
            : moonModelInfo?.error ? `Indisponible : ${moonModelInfo.error}`
              : moonModelInfo ? 'NASA (LRO, couleurs et relief) · vue d’ensemble, tuiles en zoomant'
                : 'NASA (LRO) · chargé en ciblant la Lune'
        }
      />
      <Navigator bodies={navBodies} focus={focus} onSelect={selectFocus} />
      <Compass hud={hud} onRecalibrate={recalibrateNorth} />
      <ZoomPad onZoom={zoom} />
      <Toolbar
        hud={hud}
        auto={auto}
        tilt={tilt}
        layersOpen={panel === 'layers'}
        onSearch={() => setPanel('search')}
        onToggleLayers={() => toggle('layers')}
        onToggleAuto={() => setAuto((v) => !v)}
        onToggleTilt={() => setTilt((v) => !v)}
        onReset={resetView}
      />
      <Attribution
        hud={hud}
        moonReal={moonBaseId === 'real'}
        extra={[
          (borders || coasts) && bordersInfo ? bordersInfo.attribution : '',
          showCityNames && cityInfo ? cityInfo.attribution : '',
        ].filter(Boolean).join(' · ')}
      />
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <CommandPalette
        open={panel === 'search'}
        onClose={closePanel}
        cities={data.cities}
        bodyNames={bodyNames}
        onPickCity={pickCity}
        onPickPlace={pickPlace}
        worldSearch={tileLayers.placeSearch}
        onPickBody={selectFocus}
      />
      <ShortcutsHelp open={panel === 'help'} onClose={closePanel} />

      {!engine && <div className="loading">{error || 'Chargement de la Terre et de la Lune…'}</div>}
    </>
  );
}

// ---------------------------------------------------------------- Entrée de l’application

// Point d'entrée : récupère les données auprès de l'API NestJS puis affiche la scène.
export function SolarSystem() {
  const { status, data, error, retry } = useSolarData();

  if (status === 'ready') return <SolarScene data={data} />;

  return (
    <div className="loading">
      {status === 'loading' ? (
        'Connexion à l’API…'
      ) : (
        <div className="fail">
          <p>Impossible de joindre l’API : {error}.</p>
          <p className="hint">Lancez le backend (<code>npm run dev:api</code>, port 3001), puis réessayez.</p>
          <button onClick={retry}>Réessayer</button>
        </div>
      )}
    </div>
  );
}

export default SolarSystem;
