/**
 * Endpoints externes effectivement déclarés dans le code exécutable du frontend.
 * Les services optionnels/inactifs par défaut sont signalés explicitement.
 * Ne pas ajouter une source sur la seule base d'un ancien crédit ou d'un commentaire.
 *
 * Vérification du 20 nov. 2026, hôte par hôte, contre le code de frontend/Car :
 *  - retiré : JPL Horizons (ssd.jpl.nasa.gov) — plus aucun appel, les orbites sont calculées par Kepler dans le navigateur ;
 *  - ajoutés : Claude Platform et Mistral AI (assistant, avec la clé de l'utilisateur), NASA SVS (vidéo de l'écran de chargement), Google Fonts (fichiers).
 * `key: true` : le service n'est appelé que si l'utilisateur a saisi sa clé. `requis: true` : l'application ne
 * s'ouvre pas sans lui, son interrupteur est donc verrouillé dans l'onglet « API ».
 */
export const API_GROUPS = [
  {
    group: 'Astronomie et éphémérides',
    items: [
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
    group: 'Traduction et contenus',
    items: [
      { name: 'MyMemory', host: 'api.mymemory.translated.net', use: 'Traduction des noms de villes et des textes de l’interface.', kind: 'api' },
      { name: 'Google Fonts', host: 'fonts.googleapis.com', use: 'Feuilles de style des polices, lues par le serveur et relayées (/api/fonts) : le navigateur ne contacte pas Google.', kind: 'static' },
      { name: 'Google Draco CDN', host: 'www.gstatic.com', use: 'Décodeur Draco des modèles 3D, relayé par le serveur (/api/fonts/draco).', kind: 'static' },
      { name: 'Polices Google', host: 'fonts.gstatic.com', use: 'Fichiers des polices (Google Sans), relayés par le serveur avec les feuilles de style.', kind: 'static' },
      { name: 'NASA Scientific Visualization Studio', host: 'svs.gsfc.nasa.gov', use: 'Vidéo du survol de la Lune affichée par l’écran de chargement.', kind: 'static' },
    ],
  },
  {
    group: 'Assistant et accès',
    items: [
      { name: 'Claude Platform (Anthropic)', host: 'api.anthropic.com', use: 'Assistant, si vous vous connectez à Claude : la question est relayée par le serveur avec votre propre clé, gardée dans votre navigateur.', kind: 'api', key: true },
      { name: 'Mistral AI (La Plateforme)', host: 'api.mistral.ai', use: 'Assistant, si vous vous connectez à Mistral : la question est relayée par le serveur avec votre propre clé, gardée dans votre navigateur.', kind: 'api', key: true },
    ],
  },
];

export const countApis = (groups = API_GROUPS) => groups.reduce((n, group) => n + group.items.length, 0);
