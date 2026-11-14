/**
 * API externes appelées par l'application, relevées dans le code (backend/src et frontend/src), pour l'onglet « API »
 * de la fenêtre Anthropic Node Open Source. `host` = adresse appelée ; `key` = l'API n'est appelée que si sa clé ou son compte
 * est configuré sur le serveur. À tenir à jour quand une API est ajoutée ou retirée.
 */
// Déclare et exporte la liste des API, classées par groupe (début du tableau).
export const API_GROUPS = [
  // Début d'un groupe.
  {
    // Nom du groupe : « Terre : imagerie ».
    group: 'Terre : imagerie',
    // Les API du groupe (début de la liste).
    items: [
      // API « IGN Géoplateforme », appelée à l'adresse data.geopf.fr.
      { name: 'IGN Géoplateforme', host: 'data.geopf.fr', use: 'Orthophotos de la France et calques LiDAR HD (ombrages des modèles de surface, de terrain et de hauteur)' },
      // API « EOX Sentinel-2 cloudless », appelée à l'adresse tiles.maps.eox.at.
      { name: 'EOX Sentinel-2 cloudless', host: 'tiles.maps.eox.at', use: 'Imagerie satellite du monde' },
      // API « NASA GIBS », appelée à l'adresse gibs.earthdata.nasa.gov.
      { name: 'NASA GIBS', host: 'gibs.earthdata.nasa.gov', use: 'Imagerie satellite de la Terre ; Terre à l’instant T : GOES-East, GOES-West et Himawari, une image toutes les 10 minutes' },
      // API « EUMETView (EUMETSAT) », appelée à l'adresse view.eumetsat.int.
      { name: 'EUMETView (EUMETSAT)', host: 'view.eumetsat.int', use: 'Terre à l’instant T : Meteosat (Europe, Afrique), une image toutes les 10 minutes' },
      // API « NOAA NESDIS Satellite Maps », appelée à l'adresse satellitemaps.nesdis.noaa.gov.
      { name: 'NOAA NESDIS Satellite Maps', host: 'satellitemaps.nesdis.noaa.gov', use: 'Terre à l’instant T : mosaïque GOES la plus récente, en secours' },
      // API « USGS National Map », appelée à l'adresse basemap.nationalmap.gov.
      { name: 'USGS National Map', host: 'basemap.nationalmap.gov', use: 'Imagerie des États-Unis' },
      // API « Mapterhorn », appelée à l'adresse tiles.mapterhorn.com.
      { name: 'Mapterhorn', host: 'tiles.mapterhorn.com', use: 'Altitudes de la Terre (Copernicus GLO-30) : relief en volume et ombrage des pentes' },
      // API « AWS Terrain Tiles (Mapzen) », appelée à l'adresse s3.amazonaws.com.
      { name: 'AWS Terrain Tiles (Mapzen)', host: 's3.amazonaws.com', use: 'Altitudes de la Terre : source de secours du relief, et profondeur des fonds marins (GEBCO, ETOPO1)' },
      // API « Open-Meteo (API d’altitude) », appelée à l'adresse api.open-meteo.com.
      { name: 'Open-Meteo (API d’altitude)', host: 'api.open-meteo.com', use: 'Dénivelé des trajets, demandé par le serveur' },
      // API « NASA EONET », appelée à l'adresse eonet.gsfc.nasa.gov.
      { name: 'NASA EONET', host: 'eonet.gsfc.nasa.gov', use: 'Volcans en éruption dans le monde, en direct, demandés par le serveur' },
      // API « swisstopo SWISSIMAGE », appelée à l'adresse wmts.geo.admin.ch.
      { name: 'swisstopo SWISSIMAGE', host: 'wmts.geo.admin.ch', use: 'Orthophotos de la Suisse' },
      // API « IGN Espagne PNOA », appelée à l'adresse www.ign.es.
      { name: 'IGN Espagne PNOA', host: 'www.ign.es', use: 'Orthophotos de l’Espagne' },
      // API « PDOK Luchtfoto », appelée à l'adresse service.pdok.nl.
      { name: 'PDOK Luchtfoto', host: 'service.pdok.nl', use: 'Orthophotos des Pays-Bas' },
      // API « IGN/NGI Belgique », appelée à l'adresse wms.ngi.be.
      { name: 'IGN/NGI Belgique', host: 'wms.ngi.be', use: 'Orthophotos de la Belgique' },
      // API « Géoportail du Luxembourg », appelée à l'adresse wmts1.geoportail.lu.
      { name: 'Géoportail du Luxembourg', host: 'wmts1.geoportail.lu', use: 'Orthophotos du Luxembourg' },
      // API « basemap.at », appelée à l'adresse mapsneu.wien.gv.at.
      { name: 'basemap.at', host: 'mapsneu.wien.gv.at', use: 'Orthophotos de l’Autriche' },
      // API « ČÚZK », appelée à l'adresse ags.cuzk.gov.cz.
      { name: 'ČÚZK', host: 'ags.cuzk.gov.cz', use: 'Orthophotos de la Tchéquie' },
      // API « Geoportal.gov.pl », appelée à l'adresse mapy.geoportal.gov.pl.
      { name: 'Geoportal.gov.pl', host: 'mapy.geoportal.gov.pl', use: 'Orthophotos de la Pologne' },
      // API « GSI Japon », appelée à l'adresse cyberjapandata.gsi.go.jp.
      { name: 'GSI Japon', host: 'cyberjapandata.gsi.go.jp', use: 'Photos aériennes du Japon' },
      // API « Geobasis NRW », appelée à l'adresse www.wms.nrw.de.
      { name: 'Geobasis NRW', host: 'www.wms.nrw.de', use: 'Orthophotos de Rhénanie-du-Nord-Westphalie (Allemagne)' },
      // API « LDBV Bavière », appelée à l'adresse geoservices.bayern.de.
      { name: 'LDBV Bavière', host: 'geoservices.bayern.de', use: 'Orthophotos de Bavière (Allemagne)' },
      // API « GeoSN Saxe », appelée à l'adresse geodienste.sachsen.de.
      { name: 'GeoSN Saxe', host: 'geodienste.sachsen.de', use: 'Orthophotos de Saxe (Allemagne)' },
      // API « HVBG Hesse », appelée à l'adresse www.gds-srv.hessen.de.
      { name: 'HVBG Hesse', host: 'www.gds-srv.hessen.de', use: 'Orthophotos de Hesse (Allemagne)' },
      // API « Geoportale Nazionale », appelée à l'adresse wms.pcn.minambiente.it.
      { name: 'Geoportale Nazionale', host: 'wms.pcn.minambiente.it', use: 'Orthophotos de l’Italie (2012)' },
      // API « NSW Spatial Services », appelée à l'adresse maps.six.nsw.gov.au.
      { name: 'NSW Spatial Services', host: 'maps.six.nsw.gov.au', use: 'Imagerie de Nouvelle-Galles du Sud (Australie)' },
    // Fin de la liste des API du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Terre : météo et lieux ».
    group: 'Terre : météo et lieux',
    // Les API du groupe (début de la liste).
    items: [
      // API « Xweather Raster Maps », appelée à l'adresse maps.api.xweather.com ; seulement si sa clé est configurée sur le serveur.
      { name: 'Xweather Raster Maps', host: 'maps.api.xweather.com', use: 'Images satellite des nuages', key: true },
      // API « Open-Meteo », appelée à l'adresse api.open-meteo.com.
      { name: 'Open-Meteo', host: 'api.open-meteo.com', use: 'Météo des villes, vents en altitude et couverture nuageuse du moment' },
      // API « Photon (komoot, OpenStreetMap) », appelée à l'adresse photon.komoot.io.
      { name: 'Photon (komoot, OpenStreetMap)', host: 'photon.komoot.io', use: 'Recherche de lieux' },
      // API « OpenFreeMap (OpenStreetMap, OpenMapTiles) », appelée à l'adresse tiles.openfreemap.org.
      { name: 'OpenFreeMap (OpenStreetMap, OpenMapTiles)', host: 'tiles.openfreemap.org', use: 'Rues et routes du monde, avec leurs noms' },
    // Fin de la liste des API du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Lune, planètes et satellites ».
    group: 'Lune, planètes et satellites',
    // Les API du groupe (début de la liste).
    items: [
      // API « NASA Solar System Treks », appelée à l'adresse trek.nasa.gov.
      { name: 'NASA Solar System Treks', host: 'trek.nasa.gov', use: 'Cartes de la Lune, de Mars et des satellites' },
      // API « USGS Astrogeology », appelée à l'adresse planetarymaps.usgs.gov.
      { name: 'USGS Astrogeology', host: 'planetarymaps.usgs.gov', use: 'Cartes de la Lune, de Mars, de Mercure et des satellites' },
      // API « LROC LunaServ », appelée à l'adresse wms.im-ldi.com.
      { name: 'LROC LunaServ', host: 'wms.im-ldi.com', use: 'Cartes de la Lune et de Mercure' },
      // API « OpenPlanetaryMap (CARTO) », appelée à l'adresse cartocdn-gusc.global.ssl.fastly.net.
      { name: 'OpenPlanetaryMap (CARTO)', host: 'cartocdn-gusc.global.ssl.fastly.net', use: 'Fonds de carte de la Lune et de Mars' },
      // API « Esri ArcGIS », appelée à l'adresse astro.arcgis.com, tiles.arcgis.com.
      { name: 'Esri ArcGIS', host: 'astro.arcgis.com, tiles.arcgis.com', use: 'Mosaïque CTX de Mars, fond de carte de Mercure' },
      // API « NASA Scientific Visualization Studio », appelée à l'adresse svs.gsfc.nasa.gov.
      { name: 'NASA Scientific Visualization Studio', host: 'svs.gsfc.nasa.gov', use: 'Modèle 3D et couleurs de la Lune' },
      // API « NASA Science », appelée à l'adresse assets.science.nasa.gov.
      { name: 'NASA Science', host: 'assets.science.nasa.gov', use: 'Modèles 3D de Phobos et de Deimos' },
    // Fin de la liste des API du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Éphémérides et Soleil ».
    group: 'Éphémérides et Soleil',
    // Les API du groupe (début de la liste).
    items: [
      // API « U.S. Naval Observatory », appelée à l'adresse aa.usno.navy.mil.
      { name: 'U.S. Naval Observatory', host: 'aa.usno.navy.mil', use: 'Phases de la Lune et éphémérides' },
      // API « NOAA Space Weather Prediction Center », appelée à l'adresse services.swpc.noaa.gov.
      { name: 'NOAA Space Weather Prediction Center', host: 'services.swpc.noaa.gov', use: 'Activité solaire' },
      // API « NASA DONKI (CCMC) », appelée à l'adresse kauai.ccmc.gsfc.nasa.gov.
      { name: 'NASA DONKI (CCMC)', host: 'kauai.ccmc.gsfc.nasa.gov', use: 'Éruptions solaires observées, avec leur classe GOES et leur région active, demandées par le serveur' },
      // API « JPL Horizons », appelée à l'adresse ssd.jpl.nasa.gov.
      { name: 'JPL Horizons', host: 'ssd.jpl.nasa.gov', use: 'Éléments orbitaux des planètes naines, relevés par le script d’import du serveur' },
    // Fin de la liste des API du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Galerie et interface ».
    group: 'Galerie et interface',
    // Les API du groupe (début de la liste).
    items: [
      // API « NASA Image and Video Library », appelée à l'adresse images-api.nasa.gov.
      { name: 'NASA Image and Video Library', host: 'images-api.nasa.gov', use: 'Images de la galerie' },
      // API « MyMemory (Translated) », appelée à l'adresse api.mymemory.translated.net.
      { name: 'MyMemory (Translated)', host: 'api.mymemory.translated.net', use: 'Traduction de l’interface et des noms de villes' },
      // API « Google Fonts », appelée à l'adresse fonts.googleapis.com.
      { name: 'Google Fonts', host: 'fonts.googleapis.com', use: 'Police Google Sans' },
      // API « Stripe », appelée à l'adresse api.stripe.com ; seulement si sa clé est configurée sur le serveur.
      { name: 'Stripe', host: 'api.stripe.com', use: 'Dons par carte bancaire', key: true },
      // API « Anthropic (Claude) », appelée à l'adresse api.anthropic.com ; seulement si sa clé est configurée sur le serveur.
      { name: 'Anthropic (Claude)', host: 'api.anthropic.com', use: 'Assistant de la barre d’outils', key: true },
      // API « Google Draco (CDN) », appelée à l'adresse www.gstatic.com.
      { name: 'Google Draco (CDN)', host: 'www.gstatic.com', use: 'Décodeur Draco des modèles 3D de la Lune, de Phobos et de Deimos' },
    // Fin de la liste des API du groupe.
    ],
  // Fin du groupe.
  },
// Fin de la liste des groupes.
];

/** Nombre total d'API listées. */
// countApis : additionne le nombre d'API de chaque groupe (par défaut, de tous les groupes).
export const countApis = (groups = API_GROUPS) => groups.reduce((n, g) => n + g.items.length, 0);
