/**
 * Endpoints externes effectivement déclarés dans le code exécutable du frontend.
 * Les services optionnels/inactifs par défaut sont signalés explicitement.
 * Ne pas ajouter une source sur la seule base d'un ancien crédit ou d'un commentaire.
 */
export const API_GROUPS = [
  {
    group: 'Astronomie et éphémérides',
    items: [
      { name: 'JPL Horizons', host: 'ssd.jpl.nasa.gov', use: 'Vecteurs d’état des corps du Système solaire, demandés par le client Horizons.', kind: 'api' },
      { name: 'ESA Gaia DR3', host: 'gea.esac.esa.int', use: 'Catalogue astrométrique Gaia DR3 (requêtes TAP).', kind: 'api' },
      { name: 'CDS SIMBAD', host: 'simbad.cds.unistra.fr, simbad.cfa.harvard.edu, simbad.idia.ac.za', use: 'Résolution de noms et recherche d’objets ; endpoints déclarés mais désactivés par défaut sans proxy.', kind: 'api' },
      { name: 'NASA Exoplanet Archive', host: 'exoplanetarchive.ipac.caltech.edu', use: 'Catalogue des exoplanètes ; endpoint déclaré mais désactivé par défaut sans proxy.', kind: 'api' },
    ],
  },
  {
    group: 'Terre, relief et cartographie',
    items: [
      { name: 'Mapterhorn', host: 'tiles.mapterhorn.com', use: 'Métadonnées TileJSON et tuiles d’altitude du relief terrestre.', kind: 'tiles' },
      { name: 'AWS Terrain Tiles', host: 's3.amazonaws.com', use: 'Tuiles d’altitude Terrarium utilisées comme source de relief et de secours.', kind: 'static' },
      { name: 'OpenFreeMap', host: 'tiles.openfreemap.org', use: 'Style et tuiles cartographiques des routes et lieux.', kind: 'tiles' },
      { name: 'Light Pollution Atlas', host: 'djlorenz.github.io', use: 'Tuiles de pollution lumineuse 2025.', kind: 'tiles' },
    ],
  },
  {
    group: 'Météo, traduction et contenus',
    items: [
      { name: 'Open-Meteo', host: 'api.open-meteo.com', use: 'Prévisions météo et données atmosphériques des villes.', kind: 'api' },
      { name: 'MyMemory', host: 'api.mymemory.translated.net', use: 'Traduction des noms de villes et des textes de l’interface.', kind: 'api' },
      { name: 'NASA Image and Video Library', host: 'images-api.nasa.gov', use: 'Recherche des images affichées dans la galerie.', kind: 'api' },
      { name: 'Google Fonts', host: 'fonts.googleapis.com', use: 'Feuilles de style des polices utilisées par l’interface.', kind: 'static' },
      { name: 'Google Draco CDN', host: 'www.gstatic.com', use: 'Chargement du décodeur Draco des modèles 3D.', kind: 'static' },
    ],
  },
];

export const countApis = (groups = API_GROUPS) => groups.reduce((n, group) => n + group.items.length, 0);
