import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHudStore } from '@/engine/hudStore';
import { bodyId } from '@/engine/bodyPlaces';
import { fetchBorders, fetchCityLabels, fetchMoonEphemeris, fetchMoonOrbiters, fetchMoonPhases, fetchShadowCam, fetchShadowCamMeta, resolveApiUrl } from '@/api';
import { useSolarEngine } from '@/hooks/useSolarEngine';
import { useP2P } from '@/hooks/useP2P';
import { useTileLayers } from '@/hooks/useTileLayers';
import { useToasts } from '@/hooks/useToasts';
import { createP2PBridge } from '@/p2p/client';
import SceneLabels from './SceneLabels';
import HudTop from './HudTop';
import Navigator from './Navigator';
import Toolbar from './Toolbar';
import ZoomPad from './ZoomPad';
import Compass from './Compass';
import CommandPalette from './CommandPalette';
import ShortcutsHelp from './ShortcutsHelp';
import Attribution from './Attribution';
import Toasts from './Toasts';
import LivePanel, { LayersPanel } from './GlobalComponents';
import P2PPanel from './P2PPanel';

// Les anciennes réponses de l'API n'ont pas de champ `body` : ce sont des couches de la Terre.
const isMoonLayer = (l) => l.body === 'moon';
const isMarsLayer = (l) => l.body === 'mars';
const isMercuryLayer = (l) => l.body === 'mercury';
const isEarthLayer = (l) => !l.body || l.body === 'earth';

// Scène complète : monte le moteur 3D et l'interface, une fois les données de l'API reçues.
export default function SolarScene({ data }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  // Passerelle stable : le moteur de tuiles la connaît dès sa création, le client P2P s'y greffe ensuite.
  const p2pBridge = useRef(createP2PBridge()).current;
  // Éléments d'étiquettes remplis par <SceneLabels>, lus par le moteur.
  const labels = useMemo(() => ({ sun: null, planets: [], cities: [] }), []);
  const hud = useMemo(
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, moonLive: null, bodyLive: null, compass: null }),
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
  const p2p = useP2P({ bridge: p2pBridge, engineRef, onToast: push });
  const { engine, focus, error } = useSolarEngine({ containerRef, data, labels, hud, p2p: p2pBridge, engineRef });
  const tileLayers = useTileLayers();
  const { publishData, latestData } = p2p;

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

  const earthLayers = useMemo(() => tileLayers.layers.filter(isEarthLayer), [tileLayers.layers]);
  const moonLayers = useMemo(() => tileLayers.layers.filter(isMoonLayer), [tileLayers.layers]);
  const marsLayers = useMemo(() => tileLayers.layers.filter(isMarsLayer), [tileLayers.layers]);
  const mercuryLayers = useMemo(() => tileLayers.layers.filter(isMercuryLayer), [tileLayers.layers]);
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
        .then((r) => { engine.setMoonOrbiters(r); publishData('ephemeris/moon/orbiters', r); })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          const cached = latestData('ephemeris/moon/orbiters');
          if (cached) {
            engine.setMoonOrbiters(cached);
            push('JPL Horizons injoignable : positions des sondes reçues d’un pair.', 'warn', 9000);
          } else console.warn('Sondes lunaires indisponibles :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 2 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine, publishData, latestData, push]);

  // Prochaines phases (U.S. Naval Observatory), redemandées toutes les 6 h.
  useEffect(() => {
    let ctrl = null;
    const load = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      fetchMoonPhases(ctrl.signal)
        .then((r) => { setMoonPhases(r); publishData('ephemeris/moon/phases', r); })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          const cached = latestData('ephemeris/moon/phases');
          if (cached) {
            setMoonPhases(cached);
            push('USNO injoignable : phases de la Lune reçues d’un pair.', 'warn', 9000);
          } else console.warn('USNO indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [publishData, latestData, push]);

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
        .then((r) => { engine.setMoonEphemeris(r.points); publishData('ephemeris/moon', r); })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          const cached = latestData('ephemeris/moon');
          if (cached?.points?.length) {
            engine.setMoonEphemeris(cached.points);
            push('JPL Horizons injoignable : éphémérides lunaires reçues d’un pair.', 'warn', 9000);
          } else console.warn('JPL Horizons indisponible :', e.message);
        });
    };
    load();
    const timer = setInterval(load, 6 * 3600 * 1000);
    return () => { clearInterval(timer); ctrl?.abort(); };
  }, [engine, publishData, latestData, push]);

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

  // Au démarrage : premier fond photo proposé par l'API, pour la Terre, la Lune, Mars et Mercure.
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
  }, [engine, tileLayers, earthLayers, moonLayers, marsLayers, mercuryLayers, moonRealAvailable, chooseBase, chooseMoonBase, chooseMarsBase, chooseMercuryBase, push]);


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
      else if (e.key.toLowerCase() === 'p') setPanel((p) => (p === 'p2p' ? null : 'p2p'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="stage" ref={containerRef} />
      <SceneLabels data={data} registry={labels} onSelectBody={selectFocus} />

      <HudTop hud={hud} />
      <LivePanel
        hud={hud}
        data={data}
        phases={moonPhases}
        onSide={moonSide}
        onSelectOrbiter={selectOrbiter}
        onGoMoon={goMoonSite}
        onGoPlace={pickPlace}
        onGoMars={goMarsSite}
        onGoMercury={goMercurySite}
      />
      <Navigator bodies={navBodies} focus={focus} onSelect={selectFocus} />
      <Compass hud={hud} onRecalibrate={recalibrateNorth} />
      <ZoomPad onZoom={zoom} />
      <Toolbar
        hud={hud}
        auto={auto}
        tilt={tilt}
        layersOpen={panel === 'layers'}
        p2pOpen={panel === 'p2p'}
        peerCount={p2p.peerCount}
        onSearch={() => setPanel('search')}
        onToggleLayers={() => toggle('layers')}
        onToggleP2P={() => toggle('p2p')}
        onToggleAuto={() => setAuto((v) => !v)}
        onToggleTilt={() => setTilt((v) => !v)}
        onReset={resetView}
      />
      <LayersPanel
        open={panel === 'layers'}
        onClose={closePanel}
        hud={hud}
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
      <P2PPanel
        open={panel === 'p2p'}
        onClose={closePanel}
        state={p2p.state}
        peerCount={p2p.peerCount}
        onToast={push}
        onConnect={p2p.connect}
        onDisconnect={p2p.disconnect}
        onViewRole={p2p.setViewRole}
        onTileSharing={p2p.setTileSharing}
        onSendFile={p2p.sendFile}
        onRespondFile={p2p.respondFile}
        onCancelTransfer={p2p.cancelTransfer}
        onDismissTransfer={p2p.dismissTransfer}
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
