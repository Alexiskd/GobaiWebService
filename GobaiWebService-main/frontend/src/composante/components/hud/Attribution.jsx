  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;

  useEffect(() => {

    if (!layerId || !b) { setCopyright(''); return undefined; }

    const ctrl = new AbortController();

    const t = setTimeout(() => {

      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});

    }, ATTRIBUTION_DEBOUNCE_MS);

    return () => { clearTimeout(t); ctrl.abort(); };

  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);

  const mars = useHud(hud, (s) => s.marsTiles);

  const mercury = useHud(hud, (s) => s.mercuryTiles);

  const venus = useHud(hud, (s) => s.venusTiles);

  const satellites = useHud(hud, (s) => satelliteTiles()

    .map((t) => (s[t.hudKey]?.layerId ? s[t.hudKey].attributionText : ''))

    .filter(Boolean)

    .join('\n'));

  const tileText = tiles?.layerId ? tiles.attributionText : '';

  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';

  const rows = [

    tileText && ['Terre', tileText],

    copyright && copyright !== tileText && ['Terre (zone visible)', copyright],

    moonText && ['Lune', moonText],

    mars?.layerId && ['Mars', mars.attributionText],

    mercury?.layerId && ['Mercure', mercury.attributionText],

    venus?.layerId && ['Vénus', venus.attributionText],

    ...(satellites ? satellites.split('\n').map((t) => splitLabel(t, 'Satellites')) : []),

    ...(extra ? extra.split(' · ').map((t) => splitLabel(t, 'Données')) : []),

    ['Éphémérides', 'Orbites de Kepler (calcul local) · USNO'],

    ['Galerie', 'NASA Image and Video Library (images-api.nasa.gov)'],

    ['Phobos et Deimos (modèles 3D)', 'NASA/JPL-Caltech — science.nasa.gov'],

    ['Lunes sphériques', 'JPL SSD, NASA NSSDC · images : NASA Image and Video Library'],

  ].filter(Boolean);

  return (

    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="sm" fullWidth aria-label="Anthropic Node Open Source">

      <PanelHeader title="Anthropic Node Open Source" onClose={onClose} />

      <Tabs

        value={tab}

        onChange={(e, v) => setTab(v)}

        variant="scrollable"

        scrollButtons="auto"

        aria-label="Sections de la fenêtre Anthropic Node Open Source"

        sx={{ flex: 'none', minHeight: 40, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 40 } }}

      >

        <Tab value="credits" label="Générique" id="node-tab-credits" aria-controls="node-panel-credits" />

        <Tab value="sources" label="Sources et Entreprises" id="node-tab-sources" aria-controls="node-panel-sources" />

        <Tab value="apis" label="API" id="node-tab-apis" aria-controls="node-panel-apis" />

        <Tab value="tree" label="Arborescence" id="node-tab-tree" aria-controls="node-panel-tree" />

        <Tab value="docs" label="Documentation API" id="node-tab-docs" aria-controls="node-panel-docs" />

        <Tab value="flux" label="Flux cognitif" id="node-tab-flux" aria-controls="node-panel-flux" />

      </Tabs>

      <DialogContent sx={{ pt: 1 }}>

        <Box role="tabpanel" id={`node-panel-${tab}`} aria-labelledby={`node-tab-${tab}`}>

          {tab === 'docs' ? <ApiDocs /> : tab === 'flux' ? <FluxCognitif /> : tab === 'credits' ? <Credits /> : tab === 'tree' ? <SiteTree /> : tab === 'apis' ? <ApiList /> : <SourcesAndCompanies rows={rows} />}

        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>

          Touche S pour ouvrir ou fermer cette fenêtre.

        </Typography>

      </DialogContent>

    </Dialog>

  );

}
