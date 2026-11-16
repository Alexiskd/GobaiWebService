# Relief géométrique de Mars — MOLA

Mars utilise désormais le même pipeline de relief en tuiles Terrarium que la Terre : le backend lit un DEM MOLA en flottants TIFF, le convertit en PNG Terrarium, puis le moteur de tuiles déplace réellement le maillage avec les altitudes.

- Source scientifique : MOLA (Mars Global Surveyor), DEM mondial nominal 463 m.
- Source de référence et licence : USGS Astrogeology, domaine public / CC0 : https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- Service ImageServer par défaut : `Mars_MGS_MOLA_DEM_mosaic_global_463m_8` sur NASA Mars Trek.
- Route interne : `/api/v1/tiles/mars-relief/{z}/{x}/{y}.png`.
- Niveaux servis : 0 à 8 ; le frontend utilise les niveaux 2 à 8.
- Altitudes signées : conservées pour représenter les bassins sous le datum MOLA et les hauts reliefs, notamment Olympus Mons.

Si le point d'accès ImageServer de l'environnement est différent, définir `MARS_RELIEF_IMAGESERVER_URL` dans l'environnement backend (Render) avec l'URL de base du service ImageServer, sans `/exportImage`.

Le nom de la composante d'interface est « ChatGPT ». Cette modification ne remplace pas le fournisseur configuré côté backend : le service d'assistant existant utilise toujours l'API Anthropic. Pour utiliser l'API OpenAI, il faudra une modification distincte du service backend, de ses variables secrètes et de ses contrats d'API.
