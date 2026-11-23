/**
 * Sources d'imagerie du globe CesiumJS de la Terre : ouvertes, sans clé ni licence payante. Table de données lue par
 * le globe (cesium-earth.viewer.js), dans l'ordre d'empilement (la première en dessous). Fonctions pures.
 */

// Emprise de la France métropolitaine et de la Corse [ouest, sud, est, nord] (degrés), celle de la table du serveur.
export const FRANCE_BBOX = [-5.5, 41.2, 9.8, 51.3];

// Déclare et exporte les couches d'imagerie, de la plus basse à la plus haute (début).
export const CESIUM_IMAGERY = Object.freeze([
  // NASA GIBS Blue Marble : tout le globe, pôles compris (fond sous Sentinel-2, et seul au sud de −70°).
  Object.freeze({
    // Identifiant et mention.
    id: 'gibs', credit: 'NASA EOSDIS GIBS — Blue Marble',
    // Tuiles Web Mercator (ligne avant colonne), niveaux 0 à 8.
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    // Niveau le plus fin.
    maximumLevel: 8,
  // Fin de GIBS.
  }),
  // Sentinel-2 cloudless 2016 d'EOX (CC BY 4.0) : le monde au nord de −70°, niveaux 0 à 14.
  Object.freeze({
    // Identifiant et mention.
    id: 'sentinel2', credit: 'Sentinel-2 cloudless — s2maps.eu par EOX IT Services GmbH (données Copernicus Sentinel modifiées 2016), CC BY 4.0',
    // Tuiles Web Mercator (ligne avant colonne).
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
    // Niveau le plus fin et emprise (au sud de −70°, les tuiles sont vides).
    maximumLevel: 14, bbox: [-180, -70, 180, 85],
  // Fin de Sentinel-2.
  }),
  // Orthophotos IGN (Licence Ouverte 2.0) : la France, affichées de près seulement (niveau de terrain 10 et plus).
  Object.freeze({
    // Identifiant et mention.
    id: 'ign', credit: 'Orthophotos © IGN — Géoplateforme (Licence Ouverte 2.0)',
    // Requête WMTS de la Géoplateforme, jeu de tuiles PM (Web Mercator).
    url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    // Niveau le plus fin, emprise, et niveau de terrain à partir duquel la couche s'affiche.
    maximumLevel: 19, bbox: FRANCE_BBOX, minimumTerrainLevel: 10,
  // Fin de l'IGN.
  }),
// Fin des couches.
]);

/** Mentions de toutes les couches, sans doublon, séparées par un point médian. */
// Déclare et exporte imageryCredits : la table des couches.
export const imageryCredits = (layers = CESIUM_IMAGERY) => [...new Set(layers.map((l) => l.credit))].join(' · ');
