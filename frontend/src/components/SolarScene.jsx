import { useMemo, useRef } from 'react';
import { bodyId } from '@/engine/bodyPlaces';
import { createHudStore, useHud } from '@/engine/hudStore';
import { useBubbleSound } from '@/hooks/useBubbleSound';
import { useSolarEngine } from '@/hooks/useSolarEngine';
import { useTileLayers } from '@/hooks/useTileLayers';
import { useToasts } from '@/hooks/useToasts';
import { useViewport } from '@/hooks/useViewport';
import { ResponsiveStyles } from '@/styles/responsiveStyles';
import { Attribution } from './hud/Attribution';
import { Compass } from './hud/Compass';
import { GpsFrame } from './hud/GpsFrame';
import { HudTop } from './hud/HudTop';
import { Navigator } from './hud/Navigator';
import { SceneLabels } from './hud/SceneLabels';
import { Toasts } from './hud/Toasts';
import { ZoomPad } from './hud/ZoomPad';
import { Toolbar } from './toolbar/Toolbar';
import { Aide } from './menus/Aide';
import { Contribuer } from './menus/Contribuer/Contribuer';
import { Informations } from './menus/Informations/Informations';
import { LidarGlobe } from './menus/LidarGlobe/LidarGlobe';
import { Rechercher } from './menus/Rechercher';
import { Tuile3D } from './menus/Tuile3D/Tuile3D';
import { bordersHintText, cityNamesHintText, moonModelHintText, shadowcamHintText } from './scene/layerHints';
import { useCameraToggles } from './scene/useCameraToggles';
import { useDocumentViewport } from './scene/useDocumentViewport';
import { useEarthDisplay } from './scene/useEarthDisplay';
import { useGlobeLidar } from './scene/useGlobeLidar';
import { useMapFeeds } from './scene/useMapFeeds';
import { useMoonFeeds } from './scene/useMoonFeeds';
import { useMoonLayers } from './scene/useMoonLayers';
import { usePanels } from './scene/usePanels';
import { useSceneActions } from './scene/useSceneActions';
import { useSceneLayers } from './scene/useSceneLayers';
import { useStageResize } from './scene/useStageResize';
import { useTileBases } from './scene/useTileBases';

// Scène complète : moteur 3D, calques, panneaux et barre d’outils.
// La logique vit dans les hooks de `scene/` ; ce composant assemble et place les composantes.
export function SolarScene({ data }) {
  const viewport = useViewport();
  const { compact } = viewport;
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const labels = useMemo(() => ({ sun: null, planets: [], cities: [] }), []);
  const hud = useMemo(
    () => createHudStore({ date: '', focusText: '', zoomText: 'Zoom · molette ou pincement', cityFocus: null, tiles: null, moonTiles: null, marsTiles: null, mercuryTiles: null, venusTiles: null, moonLive: null, bodyLive: null, compass: null, gps: null }),
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

  useDocumentViewport(viewport);
  useStageResize(containerRef, engineRef);

  const { toasts, push, dismiss } = useToasts();
  const [sound, toggleSound] = useBubbleSound();
  const { engine, focus, error } = useSolarEngine({ containerRef, data, labels, hud, engineRef });
  const tileLayers = useTileLayers();
  const layers = useSceneLayers(tileLayers.layers);
  const bases = useTileBases({ engine, engineRef, status: tileLayers.status, layers, push });
  const camera = useCameraToggles(engine);
  const earth = useEarthDisplay({ engine, baseLayer: bases.baseLayer, overlayLayer: bases.overlayLayer, push });

  const moonIndex = bodyNames.length - 1;
  const currentBodyId = focus === 0 ? null : focus === moonIndex ? 'moon' : bodyId(data.bodies.planets[focus - 1]);
  const currentBodyName = focus === 0 ? null : bodyNames[focus];
  const bodySelected = focus !== 0;
  const cityFocus = useHud(hud, (s) => s.cityFocus);

  const moon = useMoonLayers({ engine, focus, moonIndex, push });
  const { moonPhases } = useMoonFeeds(engine);
  const { cityInfo, bordersInfo } = useMapFeeds({ engine, push });
  const actions = useSceneActions({ engineRef, setAuto: camera.setAuto });
  const panels = usePanels({ compact, bodySelected });
  const lidar = useGlobeLidar({ engine, push });

  return (
    <div className={compact ? 'app-shell is-compact' : 'app-shell'} data-vp={viewport.size}>
      <ResponsiveStyles />
      <div className="stage" ref={containerRef} />
      <SceneLabels data={data} registry={labels} onSelectBody={actions.selectFocus} />
      <GpsFrame hud={hud} engine={engine} />

      <HudTop/>
      <Informations
        hud={hud}
        data={data}
        phases={moonPhases}
        handlers={actions.handlers}
        layersOpen={panels.layersOpen}
        onCloseLayers={panels.closePanel}
        bodyId={currentBodyId}
        bodyName={currentBodyName}
        layers={layers.earthLayers}
        moonRealAvailable={layers.moonRealAvailable}
        moonColorOk={moon.moonColorOk}
        moonLayers={layers.moonLayers}
        moonBaseId={bases.moonBaseId}
        onMoonBase={bases.chooseMoonBase}
        marsLayers={layers.marsLayers}
        marsBaseId={bases.marsBaseId}
        onMarsBase={bases.chooseMarsBase}
        mercuryLayers={layers.mercuryLayers}
        mercuryBaseId={bases.mercuryBaseId}
        onMercuryBase={bases.chooseMercuryBase}
        venusLayers={layers.venusLayers}
        venusBaseId={bases.venusBaseId}
        onVenusBase={bases.chooseVenusBase}
        provider={tileLayers.provider}
        listStatus={tileLayers.status}
        listError={tileLayers.error}
        baseId={bases.baseId}
        onBase={bases.chooseBase}
        roads={earth.roadsIncluded ? true : earth.roadsUnavailable ? false : earth.roads}
        onRoads={earth.setRoads}
        roadsHint={earth.roadsHint}
        shade={earth.shade}
        onShade={earth.setShade}
        borders={earth.borders}
        onBorders={earth.setBorders}
        bordersHint={bordersHintText(bordersInfo)}
        coasts={earth.coasts}
        onCoasts={earth.setCoasts}
        countryNames={earth.countryNames}
        onCountryNames={earth.setCountryNames}
        cityNames={earth.namesIncluded ? true : earth.cityNames}
        onCityNames={earth.setCityNames}
        cityNamesHint={cityNamesHintText(earth.namesIncluded, cityInfo)}
        cityNamesDisabled={earth.namesIncluded}
        gps={earth.gps}
        onGps={earth.setGps}
        moonFeatures={moon.moonFeatures}
        onMoonFeatures={moon.setMoonFeatures}
        moonOrbiters={moon.moonOrbiters}
        onMoonOrbiters={moon.setMoonOrbiters}
        shadowcam={moon.shadowcam}
        onShadowcam={moon.setShadowcam}
        shadowcamHint={shadowcamHintText(moon.shadowcamInfo)}
        moonModel={moon.moonModel}
        onMoonModel={moon.setMoonModel}
        moonModelHint={moonModelHintText(moon.moonModelInfo)}
      />
      <Navigator bodies={navBodies} focus={focus} onSelect={actions.selectFocus} />
      <Compass hud={hud} onRecalibrate={actions.recalibrateNorth} />
      <ZoomPad onZoom={actions.zoom} />
      <Toolbar
        hud={hud}
        auto={camera.auto}
        tilt={camera.tilt}
        layersOpen={panels.layersOpen}
        bodySelected={bodySelected}
        citySelected={Boolean(cityFocus)}
        pointCloudOpen={panels.pointCloudOpen}
        onPointClouds={panels.togglePointClouds}
        contributionOpen={panels.contributionOpen}
        onContributions={panels.toggleContributions}
        lidarOpen={panels.lidarOpen}
        lidarCount={lidar.clouds.length}
        onLidar={panels.toggleLidar}
        onSearch={() => panels.setPanel('search')}
        onToggleLayers={panels.toggleLayers}
        onToggleAuto={() => camera.setAuto((v) => !v)}
        onToggleTilt={() => camera.setTilt((v) => !v)}
        onReset={actions.resetView}
        onHelp={() => panels.setPanel('help')}
        sound={sound}
        onToggleSound={toggleSound}
      />
      <Tuile3D
        city={cityFocus}
        open={panels.pointCloudOpen}
        onClose={() => panels.setPointCloudOpen(false)}
      />
      <LidarGlobe
        open={panels.lidarOpen}
        onClose={() => panels.setLidarOpen(false)}
        lidar={lidar}
      />
      <Contribuer
        engine={engine}
        open={panels.contributionOpen}
        onClose={() => panels.setContributionOpen(false)}
      />
      <Attribution
        hud={hud}
        moonReal={bases.moonBaseId === 'real'}
        extra={[
          (earth.borders || earth.coasts) && bordersInfo ? bordersInfo.attribution : '',
          earth.showCityNames && cityInfo ? cityInfo.attribution : '',
        ].filter(Boolean).join(' · ')}
      />
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <Rechercher
        open={panels.panel === 'search'}
        onClose={panels.closePanel}
        cities={data.cities}
        bodyNames={bodyNames}
        onPickCity={actions.pickCity}
        onPickPlace={actions.pickPlace}
        worldSearch={tileLayers.placeSearch}
        onPickBody={actions.selectFocus}
      />
      <Aide open={panels.panel === 'help'} onClose={panels.closePanel} />

      {!engine && <div className="loading">{error || 'Chargement de la Terre et de la Lune…'}</div>}
    </div>
  );
}
