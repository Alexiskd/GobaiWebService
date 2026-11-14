# Go白ناन्टех

Go白ناन्टех is a browser-based solar-system scene with a NestJS API and a React/Three.js frontend.

## Natural satellites (Jupiter, Saturn)

Io, Europa, Ganymede, Callisto, Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus are shown like the Moon: synchronous rotation (longitude 0 facing the planet), tiled global mosaics, orbit lines, focus targets and markers.

- Positions: `GET /api/v1/ephemeris/satellites` (JPL Horizons, planet → satellite vectors, 20 min step, cached). Without Horizons the client falls back to a circular orbit and says the position is approximate.
- Maps: `GET /api/v1/tiles/satellite/{id}/{z}/{x}/{y}`, relayed and cached in memory. The source of each satellite is probed at startup and logged (`[Satellites] Io → …`): NASA Solar System Treks product candidates first, then the USGS Astrogeology WMS (`planetarymaps.usgs.gov`, `simp_cyl` maps). Override a satellite with `SATELLITE_TILES_<ID>` (WMTS base URL, e.g. `SATELLITE_TILES_IO=https://trek.nasa.gov/tiles/Io/EQ/<product>`).

## Gas giants (Jupiter, Saturn, Uranus, Neptune)

NASA Solar System Treks has no portal for the gas giants, so their global maps come from the USGS Astrogeology WMS (`jupiter_simp_cyl.map`, etc.), relayed by the same `GET /api/v1/tiles/satellite/{id}/{z}/{x}/{y}` route and logged at startup. Each planet is oriented by its real IAU pole, so Saturn's rings lie in the plane of its moons' orbits. They have no ground. Outside, zooming works on the altitude above the cloud tops, so the approach stays progressive down to 0.05 % of the radius (about 35 km for Jupiter); zooming again at that floor flies through the cloud deck, and inside the planet zooming works on the distance to the centre. Each giant is drawn with its real flattening (Saturn's polar radius is 10 % shorter), and Saturn's rings use the real radii of the D, C, B, A and F rings and of the Cassini, Encke and Keeler gaps.

## Base maps: always on

Every body present in the engine always gets a base map. For each body the client tries its preferred layer, then its NASA Trek layers, then any other imagery layer (USGS…); a failed layer is replaced by the next candidate, with spaced retries (5 s to 2 min, six attempts). A choice made by hand in the menus, including "none", is never overridden. Natural satellites are still only added to the engine when they have a NASA Trek map; the Sun has no map source.

## Simulated detail beyond the map resolution

The maps of the gas giants (USGS, level 5) and of the natural satellites stop early. Beyond the native resolution of the image the tile shader adds fractal detail (zonal streaks for the giants, grain and small craters for the satellites), so zooming keeps revealing structure instead of a blur: 9 extra levels for the giants, 11 for the satellites (down to 250 m above the ground). This detail is **not an observation**. It only appears where the real image is magnified more than about four times, the sources line then reads « détail simulé au-delà de la résolution des images », and `engine.setTileDetail(false)` turns it off.

## Earth: one imagery layer, every source

The Earth has a single imagery layer, `earth-hd`, zoomable to level 19 everywhere. The server (`earth-sources.ts`, `earth-imagery.service.ts`) picks the source tile by tile:

| Source | Coverage | Levels | Key |
| --- | --- | --- | --- |
| Orthophotos, Luxembourg (geoportail.lu) | Luxembourg | 12–19 | none |
| SWISSIMAGE (swisstopo) | Switzerland | 12–19 | none |
| Orthophotos, Belgium (IGN/NGI, WMS) | Belgium | 12–19 | none |
| Luchtfoto (PDOK) | Netherlands | 12–19 | none |
| Orthofoto (basemap.at) | Austria | 12–19 | none |
| Ortofoto (ČÚZK) | Czechia | 12–19 | none |
| DOP, Germany (WMS cut into tiles) | Saxony, Hesse, North Rhine-Westphalia, Bavaria | 12–19 | none |
| IGN orthophotos (Géoplateforme) | France | 12–19 | none |
| PNOA (IGN España) | Spain | 12–19 | none |
| Ortofoto 2012 (Geoportale Nazionale, WMS cut into tiles) | Italy | 12–18 | none |
| Ortofotomapa (Geoportal.gov.pl, WMS) | Poland | 12–19 | none |
| GSI seamless photo | Japan | 12–18 | none |
| NSW Imagery | Australia: New South Wales only | 12–19 | none |
| USGS The National Map | United States | 12–16 | none |
| Sentinel-2 cloudless 2016 (EOX) | world | 0–14 | none |
| NASA GIBS Blue Marble | world | 0–8 (fallback) | none |

- **Direct loading (the fast path).** The browser no longer fetches every Earth tile through this server. `GET /api/v1/tiles/layers/earth-hd` returns the list of sources (`direct`), and the client (`tiles/earthDirect.jsx`, `tiles/tileSource.jsx`) applies the same rules as the server: it picks the source of each tile and loads it straight from the provider (IGN, EOX, NASA GIBS, swisstopo, PDOK…), several hosts in parallel. A national source that answers with an empty tile hands over to the next one; beyond the native level the tile is cropped in the browser from its ancestor, which is downloaded once. The relay below is only used for services the browser cannot load itself (WMS: Germany, Italy, Belgium, Poland) and as a fallback: any failed direct load falls back to the relay for that tile, and a source that fails five times in a row is relayed for one minute, then two, four… Switches: `EARTH_DIRECT=0` on the server, or `localStorage['gobai:tuiles-directes'] = '0'` in one browser, send everything through the relay again.
- **Instant base, on the Moon's model.** The whole Earth at levels 0–3 (85 tiles; 0–2 on phones) is preloaded and never evicted, and the files of directly loaded tiles up to level 7, plus those of the far view below, are kept on the browser's disk (Cache Storage `earth-direct-v1`): on later visits the globe is drawn without the network.
- **Far view: one imagery from far to near.** National sources whose provider also serves its own reduced mosaic (`lowZoom`, level 8; 9 for Japan) are laid over the world image above their native level: a tile fully covered by the national source is shown as is, a tile straddling the border is composed pixel by pixel in the browser (national image where it has one, world image elsewhere). The country keeps its detailed imagery when seen from far, down to level 8. Not for WMS countries (Germany, Italy, Belgium, Poland) nor the United States. A level a provider does not serve is dropped after six failures, without touching the native levels. Switch: `EARTH_FAR_ORTHO=0`.
- **Same colours on every layer.** Each national source is matched to the world mosaic (the reference): the browser compares a few tiles of the source with the same places in the world mosaic, on 32 px thumbnails, and derives a gain and an offset per channel (mean and standard deviation transfer, bounded to 0.6–1.6 and ±0.25). The tile shader applies them (`colGain`, `colOff`); the arrays are shared by all tiles of a source, so tiles already on screen follow as the measure settles (3 to 12 tiles), and the measure is kept in `localStorage` for later visits. Tiles that come through the relay are not corrected. Switches: `EARTH_COLOR_MATCH=0` on the server, `localStorage['gobai:couleurs'] = '0'` in one browser.
- **Speed.** Earth tiles are prefetched like the Moon's: the tiles of the area the camera is heading to are loaded ahead (predicted view 1.5 s later, 120° cone), and tiles leaving the screen stay decoded in memory (300 images, 96 on phones) so coming back needs no network. 16 downloads in parallel (8 on phones). Images are decoded off the main thread before use (`img.decode()`), so arriving tiles no longer stall the frame. A native tile seen fully covered by its source exempts all its descendants from any pixel check: inside a country, tiles load without reading a single pixel. A direct load that has not answered after 4 s goes to the relay.
- **Smooth level changes.** On every tiled body, a hexagonal cell never swaps its image in one frame (`tiles/hexDisplay.jsx`). Zooming in, the sharper image fades in over the previous one, which stays underneath until the fade ends; zooming out, the large cell is laid underneath at once and the small cells on top fade out. 320 ms, eased at both ends; a change of direction mid-fade starts from the opacity already reached, and a late frame does not make the fade jump. During a continuous zoom the wanted images change faster than a fade lasts: an image that was fading in and is no longer wanted finishes its fade and then stays underneath in turn, so there is always an opaque image under the ones appearing (no flicker, no dip to the background), and each wave of fades sits slightly above the previous one so two images of the same cell never share a plane. Fade materials are reused, the background sphere stays visible during a fade (a cell appearing at the screen edge starts from the background image, not from the black sky), and phones keep their full frame rate for the duration of a fade. No fade when the system asks for reduced motion.
- **Coverage edges (borders, coasts).** When the tile of a national source has an area without image, the hole is filled by the next source (another country, or the world image), pixel by pixel, only inside the empty area and its neighbouring blocks (16 × 16 blocks, from a thumbnail): a white roof elsewhere is kept. Near the edge the thresholds are wider, so the compression halo of the photo's border does not leave a light fringe. During the cross-fade the ancestor keeps its own colour correction.
- Relay: the most detailed source for the tile is asked first. If it fails, or has not answered after `EARTH_HEDGE_MS` (450 ms), the next one is asked too and the first answer wins.
- A source that fails three times in a row is set aside for one minute, so a dead provider no longer costs its timeout on every tile.
- Countries without ready-made national tiles are cut from their map service (WMS): one `GetMap` request per 256 px tile, on the tile's Web Mercator extent, like the planetary mosaics of the USGS. Germany has no free national service, so it is covered Land by Land (four Länder so far).
- Canada, Brazil, India and the rest of Australia have no free national imagery finer than Sentinel-2 as a map or tile service (their catalogues are scene downloads). They stay on the Sentinel-2 mosaic, cut and enlarged beyond level 14.
- Each national source is limited to a rectangle around its country; the rectangles overlap, so the list goes from the smallest country to the largest. A national source that answers with an empty tile (white, black or transparent: outside its territory) hands over to the next one without counting as a failure, and is not asked again for the finer tiles of the same place. A tile that is only partly empty (straddling a border) is served as is.
- Only the IGN, EOX and GIBS addresses were tried for real; the other national addresses come from knowledge of those services. A wrong address only costs three failed requests per minute (circuit breaker); check `GET /api/v1/tiles/earth/sources` after deployment.
- Beyond the native level of every source, the tile is cropped from its nearest native ancestor and enlarged; the ancestor is fetched once and shared by all its descendants.
- A tile served by a fallback source is cached for 10 minutes only (server memory and browser), so the best image comes back once its source answers again. `X-Tile-Source` names the source of each tile, and `GET /api/v1/tiles/earth/sources` lists the active sources with their successes, failures and average latency.
- Not included: countries whose free imagery needs a key or an account (Denmark, Finland, Norway, New Zealand), or is not free (United Kingdom); Google Map Tiles (removed from the project earlier), Copernicus Data Space and STAC catalogues (account or scene search, not ready-made tiles), Planet/Maxar/Airbus (contract).

## Relief (one generic module for every tiled body)

`tiles/relief.jsx` gives each tiled body the relief its data allows; the choice is one line in `tiledBodies.jsx` (`relief`).

- **Earth, real elevations (`terrarium`).** Elevation tiles are loaded beside the imagery already on screen, from the first source that answers: Mapterhorn (free, no key, 512 px Terrarium tiles from Copernicus GLO-30, about 19 m per pixel at the equator at level 12; tile address read from `https://tiles.mapterhorn.com/tilejson.json`), then AWS Terrain Tiles (Mapzen, 256 px, about 38 m per pixel). A source whose TileJSON is unreachable, or whose first four tiles fail, is replaced by the next one for the session. Levels 5 to 12. On phones the relief is lighter (`tuneRelief`: 9 × 9 vertices per tile, elevation tiles one level coarser, relief from level 6). A switch in Settings → "Relief en volume" turns it off. The mesh of each tile gets 17 × 17 vertices and the vertex shader lifts them to their real height (sea floor kept at 0); the fragment shader shades the slopes with a fixed north-west light, as on a map. The image is shown first and the relief is added when its tile arrives. The camera stays above the lifted ground (`TileManager.groundFloor`, one pixel read three times a second). Only with Web Mercator layers.
- **Mars, Mercury, natural satellites: estimated relief (`image`).** No elevation tiles are wired for them, so the shader reads the brightness variations of the image itself as slopes and shades them. This is an estimate, not a measurement, and it adds no volume. The Moon keeps its LOLA shading.
- Setting: `engine.setRelief(on, exaggeration)` (1 = real heights), kept in `localStorage['gobai:relief']` (`0` = off, a number = exaggeration). There is no button in the interface yet.
- Known limits: at the edge between two elevation tiles on steep ground, a thin gap can show (hidden by deeper skirts in most cases); labels and borders are not lifted; over-zoomed tiles reuse level 12 elevations.
- LiDAR: the tile boxes already sit at their real altitude, so they now rest on the lifted ground. Real 3D points: see the next section.

## View lock, Moon orbit and Moon mosaic

- **View lock** (`engine/viewLock.jsx`, toolbar button "Verrouillage <name>", next to "Vue 3/4"). Two bodies are involved: the focus body, which the camera orbits and the zoom moves towards, and the body nearest to it (the Moon for the Earth, the Earth for the Moon, Io for Jupiter…), named on the button. Pressing the button turns the camera at once towards that nearest body; the camera stays on its orbit around the focus body and the zoom still moves towards the focus body. Releasing it puts the camera back exactly where it was when the lock was set. The button can be pressed whether or not the nearest body is in the camera's field of view. Changing focus drops the lock.
- **Moon orbit.** The Moon already sits at its true distance (about 60 Earth radii, from the ephemeris). Its orbit line used to fade to 12 % away from the Moon; it now stays at 55 % or more all the way round, brightest at the Moon.
- **Moon mosaic.** The Kaguya TC mosaic has gaps (transparent or black pixels, missing tiles). The server now fills them before caching a tile (`moon-reconstruct.ts`, `MoonTileCacheService`): the same area of the LRO WAC global mosaic (NASA Moon Trek, 100 m per pixel, no gaps) is laid under Kaguya, matched to the brightness and contrast of the valid Kaguya pixels of the tile, with a softened edge. A Kaguya tile missing at NASA is rebuilt entirely from WAC. If `sharp` cannot load or NASA cannot be reached, the tile is served as before. The start-up log reports how many tiles were rebuilt. Browsers drop their old Moon tile cache (`moon-tiles-v1`).
- **Moon poles, LROC upscaling and tile speed.**
  - *Poles.* Beyond 70° of latitude the Kaguya mosaic is not realistic in places (orbit strips lit differently, black or saturated areas). There, and only there, it is blended with the LROC WAC mosaic: brightness comes from LROC, the fine grain stays Kaguya's. The blend grows with latitude (none at 70°, full at 84°); Kaguya areas that agree with LROC are left untouched. Near the poles the brightness match between the two mosaics is the one measured once on the whole Moon (level 0), the same for every tile.
  - *LROC upscaling.* Beyond its native level the LROC fill is enlarged with a Lanczos filter and re-sharpened, with a margin around the cropped area so tile edges are computed from real neighbours. Level 8 of the WAC mosaic is tried first and dropped if NASA does not serve it. This makes the fill look sharper; it does not add real detail. The brightness match now follows a least-squares fit, so Kaguya's own grain no longer inflates the contrast of the fill.
  - *Speed.* Moon tiles are re-encoded as WebP (several times lighter than NASA's PNG), kept in server memory for the most requested ones (32 MB) and on disk, served with a one-year immutable cache header, and loaded 12 at a time by the app (6 on phones). When the app requests a tile, its four children are prepared in the background, so zooming in finds them already on the server. On-screen tiles come first: while the app is waiting for a tile, the start-up preload and the look-ahead pause (the server only has a fraction of a CPU), and the look-ahead does not run during the preload. Tile addresses carry `?v=3` and browsers drop `moon-tiles-v1` and `moon-tiles-v2`.

## LiDAR tiles as real 3D points

One IGN LiDAR HD tile (central Paris, `LHD_FXX_0652_6863`, 16.6 million points, flown on 3 March 2023, Licence Ouverte 2.0) is drawn point by point on the Earth.

- **Data.** `backend/data/lidar/<tile>/` holds `manifest.json` and one gzip file per node of the tile's COPC octree (358 files, 55 MB). The octree is additive: the root shows the whole tile at once (67,000 points), each level adds points twice as dense, down to the full survey. Per point: position quantised to 4 cm, a display class (ground, roof, facade, three vegetation heights, water, bridge…) and a brightness computed once (laser intensity × slope shading of the surface model × occlusion). Format: `backend/src/services/lidar-tiles/lidar-tiles.ts`.
- **Storage.** At start-up the server copies the files into PostgreSQL (table `lidar_nodes`, same pattern as the gallery) and serves them from there, with a 40 MB memory cache; without `DATABASE_URL` it serves the files. `GET /api/v1/lidar` lists the tiles, `GET /api/v1/lidar/:tile/:node?v=<hash>` returns one node, already gzipped, cached for a year by the browser (the hash is in the address).
- **Display** (`engine/lidarPoints.jsx`, pure logic and tests in `lidarPointsMath.jsx`). Only points inside the camera's field of view are loaded: a tile outside the view (or behind the horizon) downloads nothing, and a download in progress is cancelled as soon as its node leaves the view; points already received stay in memory, hidden. The root is fetched while the camera is still far away, once the tile is in view. Near the tile, a few times per second, the engine picks the nodes whose points would be too far apart on screen without their children, coarsest and nearest first, within a point budget (6 million on a computer, 2.2 million on a phone) and inside the camera's field. Points are drawn at the size that fills surfaces once the wanted detail is loaded; detail still loading shows as sparse points over the imagery, never as large discs. No fade: a point appears as soon as its file is decoded, with the same day and night tint as the map tiles.
- **Colour (draping, fusion).** The survey has no colour. By default each point takes the colour of the IGN orthophoto pixel straight above or below it (`engine/lidarDrape.jsx`, pure maths and tests in `lidarDrapeMath.jsx`): the orthophoto tiles covering the tile are drawn into one image (level 18 on a computer, 11 × 11 tiles, 0.39 m per pixel; level 17 on a phone), a coarse preview first, and an affine transform maps the tile's metres to that image (under half a pixel of error over the kilometre). The shader then fuses the photo with what the laser knows: the precomputed brightness keeps the relief readable (40 %), and facades, which a top-down photo does not show, keep half of their class tint. Where the photo has not arrived yet, points keep their class colour. Settings → "Couleurs de la photo" / "Types de points" (`localStorage['gobai:lidar-3d-couleur']`). Photos already loaded stay in the browser (`lidar-drape-v1`).
- **Tiles on disk.** `backend/tools/lidar/telecharger_tuiles.py` (standard library only) downloads the map images of an area to a local folder: LiDAR HD shading PNGs, Terrarium relief PNGs and, on request, orthophotos. Default area: the Paris tile (565 files). It resumes where it stopped and refuses more than 5,000 files per run. Checked against a local test server, not against the IGN servers.
- **Offline colourisation.** `backend/tools/lidar/colorize.py` colours any LAS/LAZ from a georeferenced image with PDAL and writes COPC or LAZ for QGIS, CloudCompare, Potree or Cesium (CRS check, noise removal, optional thinning, bounded memory). It was not run where it was written (no PDAL): only the pipeline construction was checked.
- **Depth.** The map relief (about 30 m per pixel, roofs included) lies above the streets measured by the laser. Inside the tile's box, depth is reset, the points are drawn with their own logarithmic depth (millimetre precision near the ground, where the engine's shared depth buffer only resolves about 0.8 m), then the box writes a normal depth back for what is drawn later.
- **Adding a tile.** `backend/tools/lidar/`: `lazdec.c` is a dependency-free LAZ 1.4 decoder (point format 6, layered compression) written for this, `prepare.py` reads the COPC hierarchy, decodes, shades and writes the files. `gcc -O2 -o lazdec lazdec.c`, then `python3 prepare.py <tile.copc.laz> <id> "<name>" <date>`. It assumes an IGN LiDAR HD tile in Lambert-93.
- **Kept on the device.** Nothing more is stored in PostgreSQL: from Europe, a tile served by the database (hosted in the USA) arrives later than from its provider. Instead, elevation and sea-floor tiles already seen stay in the browser's Cache Storage (`relief-v1`, 3,000 files on a computer, 900 on a phone), and so do the LiDAR HD shading tiles at every level (`lidar-hd-v1`, 6,000 / 1,800); the oldest files leave first (`tiles/diskCache.jsx`). The predictive prefetch now also downloads, at low priority and without decoding, the elevation tiles of the area the camera is heading to. The point tile's root is fetched at start-up wherever the camera is, and its first detail level within 400 km.
- Setting: Settings → "Nuage de points LiDAR en 3D" (on by default, kept in `localStorage['gobai:lidar-3d']`), with a button that flies to the tile.
- Known limits: the orthophoto is not a true orthophoto, so tall roofs can be coloured a few metres off, and facades only get an approximate colour; water returns almost no laser pulse, so the Seine shows the imagery underneath; a hill in front of a tile would not hide it (Paris is flat).


## Performance notes

- A body's tiles are only selected, preloaded and requested while it is the focused body or at least 3 px in radius on screen. At start-up only the Earth (and the Moon when it is large enough) load tiles; the other planets and satellites load theirs when approached.
- Over-zoomed tiles of the same area share one GPU texture (the native ancestor image) instead of uploading it once per tile.
- Planet orbit lines are closed ellipses of 2048 points, uniform in eccentric anomaly; satellites outside the focused planet's system are recomputed twice per second instead of every frame.

## Interface language

The **Langue** button (next to sound and help) translates the whole interface. Default: the browser language.

- Language list: all ISO 639-3 languages (~7,900, SIL via `wooorm/iso-639-3`), languages per country and writing systems from Unicode CLDR, in `frontend/public/data/languages.json` (rebuild with `frontend/scripts/build-languages.mjs`).
- Translation: MyMemory, from the browser, only for texts actually displayed, cached per language in `localStorage`. Numbers are stripped before sending, so live values (distances, times) never trigger new requests.
- Machine translation exists for a few hundred languages only. For the others the interface falls back to the macrolanguage, then the official language of the chosen country, then English, and the language panel says so.
- Optional build variable `VITE_MYMEMORY_EMAIL`: contact address sent to MyMemory, which raises its free daily quota.
- Elements with `translate="no"` (and map labels) are never translated.

## Deployment (Render, single web service)

The NestJS API also serves the compiled frontend (`frontend/dist`) on the same origin: one service, one URL, no CORS. Routes under `/api` go to the API; every other `GET` returns the React app.

From the repository root:

```powershell
npm run build   # installs backend + frontend, builds frontend (Vite) then backend (Nest)
npm start       # node backend/dist/main.js — site on http://localhost:3001/
```

On Render, either use the `render.yaml` Blueprint or create a **Web Service** manually:

| Setting | Value |
| --- | --- |
| Root Directory | *(empty — repository root)* |
| Runtime | Node (version from `.node-version`: 22) |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Render provides `PORT`. Do not set `VITE_API_URL` for the web build (the site calls `/api` on its own origin). Other backend variables are listed in `backend/.env.example`. The tile cache and `pointclouds/` folder live in `backend/` on Render's ephemeral disk.

## Development and checks

Run the API and frontend using the repository's existing scripts. The frontend Vite proxy forwards `/api` to `http://localhost:3001` by default.

```powershell
cd backend
npm run dev

cd frontend
npm run dev
```

Checks:

```powershell
cd frontend
npm test
npm run build

cd backend
npm run build
npm test -- --runInBand
```

## Clean-up of unused files (12 November 2026)

Files that nothing loaded were removed: an old backup folder (`frontend/_sauvegarde_avant_optimisation`), a 22.6 MB Mars image, a duplicate logo, the crayon textures, two unused icons and the old stylesheet `frontend/src/composante/styles.css`. That stylesheet was not imported anywhere; the three rule groups the app still needed (the blue "My position" dot, its pulse, and touch handling on clickable labels) now live in `SceneStyles.jsx`, the styles the app really loads. The logo shown on the loading screen and in the title bar is now `logo.webp` (56 KB instead of 1.38 MB); `logo.png` stays for the sitemap. Every source file left in `frontend/src` and `backend/src` is reachable from the app.

## Streets and roads of the world (12 November 2026)

A new Earth overlay, "Rues et routes" (Settings → Earth layers, off by default), draws the road network of the whole world with street names. Data: OpenStreetMap through the OpenFreeMap vector tiles (OpenMapTiles schema) — free, no API key, no account. The browser loads the tiles straight from `tiles.openfreemap.org`; nothing goes through this server.

- The tile address is read from the provider's TileJSON (`https://tiles.openfreemap.org/planet`) because it changes with each data update; the last known address is kept in the browser as a fallback.
- `vectorTile.jsx` decodes the vector tiles (protobuf) without any dependency and reads only the two layers used (`transportation`, `transportation_name`). `roadStyle.jsx` holds the drawing rules; `roadSource.jsx` draws each tile on a transparent canvas and plugs into the existing overlay slot of the tile layer.
- From far away (levels 6 to 10) only motorways and main roads exist in the data; secondary roads, then every street from level 12, paths from level 15. Names: main roads from level 10, streets from level 15, written straight along the road, never cut at a tile edge.
- The data stops at level 14; beyond, the level-14 tile is redrawn enlarged up to level 17, so lines stay sharp.
- One overlay per tile: turning the streets on turns the IGN LiDAR HD overlay off, and the other way round.
- Vector tiles carry every map layer, so they are heavier to download than image tiles; phones use 256 px canvases at every level to save memory.

## Flat Earth tiles by default (12 November 2026)

The Earth map is now flat by default: tiles are plain squares on the sphere, with no elevation tiles and no sea-floor tiles to download, so the map appears faster. Before, every tile was built as a raised mesh and fetched its elevation even when the relief was switched off; now a tile layer without relief asks for nothing.

- Setting: Settings → "Relief de la Terre en 3D" (off by default, stored under `gobai:relief-3d`; the old key `gobai:relief`, on by default, is no longer read). Turning it on or off rebuilds the displayed tiles in place from the caches.
- The relief shading of the other bodies (estimated from the image, no download) is always on.
- LiDAR point tiles: on a flat map the cloud is lowered so that its ground (median of the points classified as ground in the root node) lies on the map; with the relief on it stays at its real altitude.

## Earth sources: a missing tile is not an outage (12 November 2026)

The production log showed the national sources being switched off for a minute several times a day ("Orthophotos IGN écartée pendant une minute"), each time after HTTP 404 answers for tiles at sea or in a neighbouring country inside the source's rectangular extent; Sentinel-2 was switched off the same way once. While a source is off, its whole country falls back to the next, coarser source: a patchwork of sharp and blurry tiles, and tiles routed through the server relay instead of straight from the provider.

- **Server relay** (`earth-imagery.service.ts`): a 404, 204 or 410 from every address of a source means "no tile here". The next source serves the tile, the tile is remembered as outside the coverage of a national source, and the source's health is untouched. Real failures (5xx, timeouts, network errors) still count.
- **Browser** (`tileSource.jsx`, `earthDirect.jsx`): the browser cannot read the status of a failed image, so the rule is: an immediate error from a source that returned an image in the last two minutes is a missing tile. It is remembered for ten minutes (with its descendants) and the next source is loaded directly, without the relay and without counting towards the circuit breaker. A timeout, or a source that has never answered, is still a failure.


## Contributions: LiDAR placements and votes (14 November 2026)

The **Contribuer** window is back, rebuilt around the IGN LiDAR HD grid instead of the former peer-to-peer store.

- **Automatic placement from the LAZ coordinates.** The browser reads only the header of a `.las`/`.laz` file (`moteur/contributions/lasHeader.jsx`): bounding box, point count, and the declared CRS — the EPSG code of the GeoTIFF keys (VLR 34735) or the OGC WKT (VLR 2112 / EVLR). The file itself is never uploaded; an IGN LiDAR HD tile weighs hundreds of megabytes and stays on the contributor's machine. The server recomputes the position itself from that header (`services/contributions/placement.ts`): Lambert-93 (EPSG:2154, the projection of every LiDAR HD delivery) is converted to WGS84 by the two-parallel conformal conic (`lambert93.ts`), and a file that declares no CRS is still recognised as Lambert-93 when its coordinates fall inside metropolitan France. The centre of the repository's own tile (652 500; 6 862 500) comes out at 48.8607816 N / 2.3525702 E — the anchor written in `backend/data/lidar/paris-0652-6863/manifest.json`, to 5 mm. The grid-north heading (meridian convergence) and the 1 km IGN tile (`LHD_FXX_0652_6863`) are derived the same way, so a published placement has the same `{ bounds, anchor }` shape as a LiDAR tile and the engine draws it with the existing maths (`moteur/engine/lidarAnchor.jsx`). Surveys in plain WGS84 degrees (EPSG:4326) are placed too; any other projected CRS is refused with a message rather than placed wrongly.
- **Accounts without email.** A pseudonym and password, with no email address or validation step. Passwords are stored only as salted scrypt digests. Web sessions use a standard compact JWT signed with HS512, carrying `iss`, `aud`, `sub`, `iat`, `exp`, `jti` and a revocation version. The browser receives it only as the `gobai_session` HttpOnly cookie (`Secure` in production, `SameSite=Lax`); JavaScript never reads or persists the JWT. Logout increments `session_version` in PostgreSQL, immediately invalidating older sessions for that account. External API clients can continue using the legacy Bearer signup/login routes.
- **Votes on the placements.** One vote per account and per placement, up for "well placed" and down for "wrong place"; clicking the same arrow again withdraws it. The list sorts by *populaire* (the Reddit hot score: `log10(|score|)` plus age, so the first votes weigh more than the next ones), *recent* or *meilleur*. From three votes on, a placement is shown as validated (70 % or more in favour) or contested (40 % or less), and its footprint on the globe is drawn in green, red or amber accordingly. A pseudonym costs nothing to create, so a vote signals rather than proves — as the window says.
- **Storage.** `contribution_accounts`, `contributions` and `contribution_votes` in PostgreSQL (`DATABASE_URL`, same pattern as the gallery); without a database everything is kept in memory, lost at restart, and both the server log and the window say so.
- **Routes.** `POST /api/v1/contributions/session/signup` and `/session/login` (HttpOnly browser session), `/session/logout` (revoke), plus `/signup` and `/login` for external Bearer clients; `GET /me`, `GET /api/v1/contributions?sort=…` (readable without an account), `POST /api/v1/contributions` (publish), `POST /api/v1/contributions/:id/vote`, `DELETE /api/v1/contributions/:id` (its author only).

## Planetary orbits: VSOP87A locally, no per-frame network calls (14 November 2026)

The eight planets are now calculated with the full rectangular **VSOP87A** series of Bretagnon & Francou (1988), rather than the lower-precision secular Kepler-element table. The coefficient files are versioned in `backend/src/services/ephemeris/vsop87a/`; the same evaluator is imported by the browser engine and the NestJS API, so both sides use exactly the same series and arithmetic.

- **Full series, J2000 frame.** 30,502 terms across X, Y and Z for Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Each coordinate is evaluated as the sum of `A × cos(B + C × τ) × τ^α`, with `τ = (JD(TT) − 2451545) / 365250`. Units are AU; the axes are the dynamical ecliptic and equinox J2000.
- **Analytical velocity.** The derivative of every trigonometric term and its time polynomial is evaluated directly and divided by 365250 days. No finite differences and no HTTP request per rendered frame.
- **The Earth is the Earth.** VSOP87A's EARTH series is the geocentric centre of the Earth in heliocentric coordinates, not the Earth–Moon barycentre. The scene no longer adds the former ELP barycentric offset a second time. The Moon remains on its own ELP calculation.
- **Actual orbit line.** The displayed curve is reconstructed from the instantaneous VSOP87A position and velocity as an osculating ellipse. It is tangent to the current state, rather than being a static ellipse from the old secular elements.
- **Fallback.** Kepler's equation remains available for bodies without a VSOP87A series, including Pluto, and for explicit pedagogical mean-anomaly overrides. Natural satellites retain their own Kepler element models.
- **Independent check.** Mars, heliocentric ecliptic J2000, 1 January 2026 0 h TDB: position error **7,708 km** and velocity error **1.21 m/s** against the frozen JPL reference vector. The previous secular Kepler model was about 39,000 km off at that epoch. This is a comparison with a reference state, not a claim that VSOP87A is a replacement for modern DE440/DE441 ephemerides.
- **Time contract.** Input instants remain UTC; evaluation uses TT (TDB is approximated by TT as in the VSOP87 documentation). API states continue to include epoch, time scale, centre, frame, units, model and accuracy metadata.

VSOP87 is an analytical theory fitted to the DE200 numerical integration. It is suitable for fast local planetary positions and long-range analytical work within its stated validity interval; a current JPL Horizons/SPICE state remains the validation reference when mission-grade accuracy is required. N-body propagation (REBOUND/WHFast or IAS15) remains a separate mode for dynamically evolving a system, not a substitute for an ephemeris lookup.

## API documentation (14 November 2026)

The OpenAPI document is built from the controllers themselves and served at `/api/docs` (Swagger UI) and `/api/docs-json`; `npm run openapi:export` writes `openapi.json` without starting the server. It had drifted well behind the code, and has been brought back in line.

- **Every controller is now in a named group.** Five of them — Sun, Moon, Mars, Mercury, Volcanoes — carried no `@ApiTags` at all and landed in Swagger's unlabelled default bucket; and of the tags actually in use, only six of twenty were declared with a description. All twenty are now declared in `openapi.ts`, in reading order: the solar system first, then the Earth's map, then the site, then operations.
- **Every route has a summary.** The same five controllers had no `@ApiOperation` anywhere, so roughly half the API — 48 routes — showed up as bare paths with no explanation and no documented response. All 107 routes across the twenty controllers now carry one.
- **Authentication is declared.** Two schemes: `session` (bearer token from `/contributions/signup` or `/contributions/login`) and `admin-token` (the `x-admin-token` header for disconnecting an external API). They replace the hand-written header parameters, so Swagger UI's *Authorize* button now works and the routes that need credentials say so.
- **The description matches the service.** It mentions the LiDAR tiles and the contributions, states that `/api/health` is deliberately unversioned, and records that orbits are computed on this server from elements versioned in the repository rather than fetched from an ephemeris service — with every snapshot carrying its epoch, time scale, centre, frame, units and accuracy. Version bumped to 2.1.
- **It stays in line.** `openapi.spec.ts` reads the controller sources and fails if a controller has no tag, if a tag is not declared, if a route has no summary, or if a declared tag has no controller. It does not boot NestJS, so it runs in a fraction of a second.

One thing the documentation now states plainly rather than hides: `GET /api/v1/sun/:body` still calls JPL Horizons at request time. It is the last route that depends on an external ephemeris service.

## Paid exports: JWT and Stripe (14 November 2026)

Browsing the site stays free and untouched. What is sold is *retrieval*: the complete 3D model of a body, its tiles assembled into one image, and the orbit API. None of the routes the browser uses to draw the map were put behind payment.

- **JWT (RFC 7519), implemented in `common/jwt.ts`.** HS256 over `node:crypto`, no dependency. Standard claims — `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti` — plus a `scope` array carrying what was bought. The pitfalls are handled explicitly and tested: the algorithm is pinned to HS256 so a token announcing `none` or `RS256` is refused rather than letting the attacker pick how his own signature is checked; the signature is compared in constant time; `exp`/`nbf` get a 60-second clock skew; `iss` and `aud` are enforced. The payload is signed, not encrypted — it is readable by the bearer, so nothing secret goes in it.
- **A guard, not a global lock.** `@RequiresScope('body:mars')` on a route; the scope may be derived from the path. Routes without the decorator are untouched, so the guard cannot silently close the public API. Without `SESSION_SECRET` the paid routes close rather than open.
- **Stripe Checkout, reusing the donations client.** `GET /store/catalogue`, `POST /store/orders`, `POST /store/orders/{id}/claim`. The product id is written into Stripe's `client_reference_id` at payment time, so the claim step reads what was actually paid for instead of trusting the browser — without it, three products sharing a price would be interchangeable. Payment is verified against Stripe, never against the return URL.
- **What the exports actually produce.** `GET /export/bodies/{body}/model.glb` writes a glTF 2.0 binary by hand: a spheroid at true scale in kilometres (Mars comes out 3 389.5 units of radius, Saturn flattened by 9.8 %), textured with the body's tiles. The mosaic is *not* reprojected; instead the sphere's texture coordinates follow the tile grid's own projection, so a Web Mercator mosaic lands correctly, with the caps beyond 85.05° stretched from the last row — the standard compromise, documented. `GET /export/bodies/{body}/tiles.jpg` returns the assembled image, and `GET /export/orbits` the positions, velocities and osculating elements from the same local model the scene uses.
- **Prices.** 1 500 € per body (100 000 € for Earth), 1 999 € for all tiles, and 4 999 € for everything. Body prices are configurable with `PRICE_BODY_CENTS` and `PRICE_EARTH_CENTS`; orbit calculation remains separately rented by the hour.

**One thing to check before selling anything.** The exports bundle third-party map data, and their licences differ. NASA imagery is public domain and IGN's Géoplateforme is Licence Ouverte 2.0, both of which allow commercial reuse with attribution. But EOX Sentinel-2 cloudless is distributed CC BY-NC-SA — **non-commercial** — and the OpenStreetMap-derived layers are ODbL, which carries share-alike obligations on derived databases. Selling a mosaic built from those is likely to breach their terms. The exports carry the layer's attribution in the GLB's `copyright` field and in the `X-Attribution` header, which satisfies attribution but does not turn a non-commercial licence into a commercial one. Restricting the sold layers to the sources that permit resale is a decision for the site owner, not something this change makes for him.

## The last JPL dependency, and orbits by the hour (14 November 2026)

**A correction first.** The previous note said `GET /api/v1/sun/:body` still called JPL Horizons at request time. It did not: the call had already been stripped out and the method left throwing `503 — JPL Horizons a été retiré de l'app`. The route was not an external dependency, it was simply dead. It now works again, computed here.

- **Sub-solar point, computed locally** (`services/sun/subsolar.ts`). The point where the Sun stands at the zenith, which lights the Moon and Mars globes: heliocentric position from the orbital elements, then a change into the frame that turns with the body. Mars uses the IAU rotation model — pole α₀ = 317.681 43°, δ₀ = 52.886 5°, prime meridian advancing 350.891 982 26° a day. The Moon uses Cassini's laws, the same ones that orient it in the 3D scene, so the API and the globe now agree instead of coming from different sources.
- **Checked against physics, not against another service.** Mars' sub-solar latitude swings to ±25.20° — its obliquity is 25.19°; the Martian solar day comes out within a minute of 24 h 39 min 35 s; the Sun never leaves ±1.55° of the lunar equator, tilted 1.54°; and it circles the Moon once per synodic month. The Horizons parser and its fetch plumbing are deleted, and the OpenAPI examples that still credited "JPL Horizons (NASA/JPL-Caltech)" as the source of the local ephemeris tables are corrected.
- **Orbits are now rented by the hour**, €1 000 an hour, per body. The JWT already carried an expiry, so the meter is the token itself: buy three hours of Mars and the token holds `orbit:mars` and dies three hours later. The hour count is written into Stripe's `client_reference_id` alongside the product, so the claim step cannot be talked into issuing more hours than were paid for, and the amount is `price × hours`. Bounded to one month per purchase.
- **The €4 999 bundle no longer covers orbits.** It would have undercut the hourly rate by a factor of several hundred. `scopeAllows` makes the exception explicit: the universal scope opens every model and every tile, and nothing of `orbit:*`.

Everything else is unchanged: browsing the site is free, and the orbit computation behind the paid route is the same local model the scene uses.
