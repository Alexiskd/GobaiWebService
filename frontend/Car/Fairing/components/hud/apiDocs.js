/**
 * Documentation de l'API de Go白ناन्टех, affichée dans l'onglet « Documentation API » de la fenêtre Node.
 *
 * Refonte : l'ancienne page décrivait le backend de l'ancien dépôt (https://www.gobaispace.com/api/v1, Swagger,
 * 300 requêtes par minute…), supprimé de l'édition statique. Cette page décrit l'API réellement présente dans ce
 * dépôt : le petit service NestJS de frontend/Car/Computing/api. Chaque route listée existe dans un contrôleur
 * (*.controller.ts) — le test apiDocs.test.jsx relit les contrôleurs et le vérifie dans les deux sens.
 *
 * Ce service est facultatif : le site statique fonctionne sans lui. Quand il ne répond pas, le client
 * (Computing/api/client.jsx) rend la même réponse « contrat » embarquée, et les envois (POST) sont refusés (503).
 */

// Dossier de l'API dans le dépôt.
export const API_DOC_DIR = 'frontend/Car/Computing/api';
// Adresse de l'API lancée sur l'ordinateur (hôte et port par défaut de main.ts ; port réglable par API_PORT).
export const API_DOC_BASE = 'http://127.0.0.1:3000';
// Variable de construction qui branche le site sur une API en ligne.
export const API_DOC_ENV = 'VITE_API_BASE';

/** Règles d'usage, en une ligne chacune. */
export const API_DOC_RULES = [
  ['Rôle', 'Servir les contrats des routes que l’interface consomme ; la galerie lit en plus une base PostgreSQL.'],
  ['Facultatif', 'Le site statique n’en dépend pas : sans API joignable, le client rend le même contrat embarqué.'],
  ['Adresse', `Aucune adresse publique fixe. En local : ${API_DOC_BASE}. En ligne : celle donnée à ${API_DOC_ENV} lors de la construction.`],
  ['CORS', 'Ouvert (cors: true) : appelable depuis n’importe quel site.'],
  ['Format', 'JSON en UTF-8. Aucun préfixe de version : les chemins partent de la racine.'],
  ['Envois', 'Les routes POST existent dans l’API, mais le site statique ne les appelle pas (réponse 503 côté client).'],
  ['Secrets', `Seule la galerie en demande un : DATABASE_URL, côté serveur. Jamais de secret dans une variable VITE_*.`],
];

/** Commandes prêtes à copier. */
export const API_DOC_EXAMPLES = [
  { label: 'Lancer', code: `cd ${API_DOC_DIR}\nnpm install\nnpm start` },
  { label: 'curl', code: `curl "${API_DOC_BASE}/tiles/earth/plan"` },
  { label: 'JavaScript', code: `const res = await fetch('${API_DOC_BASE}/galerie');\nconst { total, folders } = await res.json();\nconsole.log(total, folders);` },
  { label: 'Brancher le site', code: `${API_DOC_ENV}=https://mon-api.exemple npm run build` },
];

/** Groupes de routes : méthode, chemin, description. Un groupe par contrôleur NestJS. */
export const API_DOC_GROUPS = [
  {
    group: 'Scène', controller: 'scene/scene.controller.ts',
    // Sources externes réellement interrogées par ce contrôleur (voir API_DOC_SOURCES) : la résistance du groupe
    // (résistanceDuGroupe, plus bas) est celle de la plus fragile d’entre elles.
    sources: ['interne', 'ign-geoplateforme', 'nasa-donki-swpc', 'nasa-eonet-gvp'],
    routes: [
      ['GET', '/borders', 'Frontières des pays et littoraux.'],
      ['GET', '/places', 'Recherche d’un lieu.'],
      ['GET', '/places/labels', 'Noms des villes, pour les étiquettes de carte.'],
      ['GET', '/pointclouds', 'Nuages de points disponibles.'],
      ['GET', '/lidar', 'Dalles LiDAR autour d’un point.'],
      ['GET', '/ephemeris/moon', 'Positions de la Lune.'],
      ['GET', '/ephemeris/satellites', 'Positions des satellites naturels.'],
      ['GET', '/ephemeris/moon/phases', 'Phases de la Lune.'],
      ['GET', '/sun/regions', 'Régions actives et éruptions du Soleil.'],
      ['GET', '/sun/activity', 'Activité solaire.'],
      ['GET', '/volcanoes', 'Volcans en éruption.'],
      ['GET', '/assistant/config', 'Réglage de l’assistant côté serveur (désactivé : l’assistant passe par la clé de l’utilisateur).'],
    ],
  },
  {
    group: 'Tuiles et cartes', controller: 'tiles/tiles.controller.ts',
    sources: ['nasa-imagery', 'ign-geoplateforme', 'interne'],
    routes: [
      ['GET', '/tiles/layers', 'Liste des couches de tuiles.'],
      ['GET', '/tiles/layers/{id}', 'Modèle d’adresse d’une couche.'],
      ['GET', '/tiles/layers/{id}/attribution', 'Mention des sources de la zone visible (paramètres zoom, north, south, east, west).'],
      ['GET', '/tiles/satellites/status', 'État des cartes des satellites naturels.'],
      ['GET', '/tiles/satellites/{body}/layers', 'Couches d’un satellite ou d’une géante gazeuse.'],
      ['GET', '/tiles/moon-blend/status', 'Variantes du modèle 3D de la Lune.'],
      ['GET', '/tiles/earth/plan', 'Table de priorité des sources d’imagerie de la Terre.'],
      ['GET', '/tiles/lidar-hd/cities', 'Villes couvertes par le LiDAR HD.'],
    ],
  },
  {
    group: 'Galerie', controller: 'galerie/galerie.controller.ts',
    sources: ['interne'],
    routes: [
      ['GET', '/galerie', 'Photos et vidéos de la galerie, lues dans PostgreSQL (table GALERIE_TABLE, galerie_items par défaut) ; { total: 0, folders: [] } sans DATABASE_URL.'],
    ],
  },
  {
    group: 'Contributions', controller: 'contributions/contributions.controller.ts',
    sources: ['interne'],
    routes: [
      ['GET', '/contributions', 'Liste des contributions.'],
      ['POST', '/contributions/signup', 'Inscription d’un contributeur.'],
      ['POST', '/contributions/login', 'Connexion d’un contributeur.'],
      ['POST', '/contributions', 'Envoi d’une contribution.'],
      ['POST', '/contributions/vote', 'Vote sur une contribution.'],
      ['POST', '/contributions/remove', 'Retrait d’une contribution.'],
    ],
  },
  {
    group: 'Dons', controller: 'donations/donations.controller.ts',
    sources: ['stripe'],
    routes: [
      ['GET', '/donations/config', 'Réglage des dons (désactivés dans l’édition statique).'],
      ['POST', '/donations/orders', 'Création d’un ordre de don.'],
      ['POST', '/donations/orders/{id}/capture', 'Encaissement d’un ordre.'],
      ['POST', '/donations/orders/{id}/cancel', 'Annulation d’un ordre.'],
    ],
  },
];

/**
 * Résistance des sources externes réellement interrogées par ce backend : derrière chaque groupe de routes, une ou
 * plusieurs API tierces (ou aucune, quand tout est interne). Chaque source est évaluée ici par le nombre de requêtes
 * qu’elle peut raisonnablement absorber par jour, à l’échelle globale du site (tous les visiteurs confondus, pas par
 * visiteur), et par la résistance qui en découle : la marge dont l’application dispose avant que cette source ne la
 * limite ou ne la coupe. Les chiffres viennent des politiques publiées par chaque fournisseur, pas d’une mesure sur
 * ce dépôt ; faute de chiffre publié, `parJour` reste `null` et la résistance se juge sur la politique connue (clé
 * exigée, garantie de service, fragilité d’une page lue plutôt qu’appelée). Relevé le 20 novembre 2026.
 */
export const API_DOC_SOURCES = [
  {
    id: 'interne', nom: 'Base interne (PostgreSQL, calculs locaux VSOP87, données embarquées : lieux GeoNames CC BY 4.0, Natural Earth)', hotes: '—', parJour: null,
    base: 'Aucun fournisseur tiers : la limite est celle du serveur et de la base de ce dépôt, pas d’un quota externe.',
    resistance: 'interne',
  },
  {
    id: 'nasa-imagery', nom: 'NASA GIBS, NASA Trek, USGS Astrogeology, portails cartographiques publics nationaux',
    hotes: 'gibs.earthdata.nasa.gov, trek.nasa.gov, planetarymaps.usgs.gov, et une douzaine de portails WMS/WMTS publics (PDOK, geo.admin.ch, GSI, NGI, GEBCO, ArcGIS…)',
    parJour: null,
    base: 'Services publics sans clé ; aucune de ces agences ne publie de quota numérique, usage raisonnable demandé.',
    resistance: 'elevee',
  },
  {
    id: 'ign-geoplateforme', nom: 'IGN Géoplateforme (LiDAR HD, tuiles françaises)', hotes: 'data.geopf.fr', parJour: 864000,
    base: 'Documenté par l’IGN (data.gouv.fr) : 10 requêtes/seconde par adresse IP pour le téléchargement, 40 pour la diffusion WMS — chiffre retenu : le plus bas des deux, converti par jour.',
    resistance: 'elevee',
  },
  {
    id: 'nasa-donki-swpc', nom: 'NASA DONKI + NOAA SWPC (activité solaire)', hotes: 'kauai.ccmc.gsfc.nasa.gov, services.swpc.noaa.gov', parJour: 24000,
    base: 'Clé NASA enregistrée (api.nasa.gov) : 1000 requêtes/heure. SWPC : aucun quota publié, cadence de mise à jour à respecter.',
    resistance: 'elevee',
  },
  {
    id: 'nasa-eonet-gvp', nom: 'NASA EONET + Smithsonian Global Volcanism Program', hotes: 'eonet.gsfc.nasa.gov, volcano.si.edu', parJour: null,
    base: 'EONET : API ouverte, aucune limite publiée. GVP : page HTML lue (pas une API) — fragile à un changement de mise en page, pas au débit.',
    resistance: 'moyenne',
  },
  {
    id: 'stripe', nom: 'Stripe (dons)', hotes: 'api.stripe.com, checkout.stripe.com', parJour: 8640000,
    base: 'Documenté par Stripe : 100 requêtes/seconde en mode live, pour l’ensemble du compte.',
    resistance: 'tresElevee',
  },
];

/** Index des sources par identifiant, pour les retrouver depuis `sources` d’un groupe. */
export const API_DOC_SOURCE_BY_ID = Object.fromEntries(API_DOC_SOURCES.map((s) => [s.id, s]));

/** Libellé et couleur de chaque niveau de résistance (teintes du thème de la fenêtre Node). */
export const API_DOC_RESISTANCE_LEVELS = {
  tresElevee: { libelle: 'Très élevée', couleur: 'success.main' },
  elevee: { libelle: 'Élevée', couleur: 'success.main' },
  moyenne: { libelle: 'Moyenne', couleur: 'warning.main' },
  faible: { libelle: 'Faible', couleur: 'error.main' },
  interne: { libelle: 'Interne', couleur: 'info.main' },
};

// Ordre du plus fragile au plus solide ; « interne » n’entre pas dans la comparaison (aucun quota tiers).
const RESISTANCE_ORDER = ['faible', 'moyenne', 'elevee', 'tresElevee'];

/**
 * Résistance d’un groupe de routes : celle de sa source externe la plus fragile (le maillon faible), avec le
 * nombre de requêtes par jour qu’elle documente (ou `null`, faute de chiffre publié par le fournisseur).
 * Un groupe entièrement interne (aucune source tierce) est jugé « interne ».
 */
export function resistanceDuGroupe(sources) {
  // Sources tierces seulement : « interne » ne limite jamais le groupe.
  const tierces = (sources || []).map((id) => API_DOC_SOURCE_BY_ID[id]).filter((s) => s && s.resistance !== 'interne');
  // Aucune source tierce : le groupe ne dépend que de ce dépôt.
  if (!tierces.length) return { resistance: 'interne', source: API_DOC_SOURCE_BY_ID.interne, parJour: null };
  // Le rang le plus bas (le plus fragile) parmi les sources du groupe.
  const rangMin = Math.min(...tierces.map((s) => RESISTANCE_ORDER.indexOf(s.resistance)));
  // Les sources à ce rang : s’il y en a plusieurs, celle qui documente le plus petit nombre de requêtes par jour
  // (à défaut de chiffre, la moins contraignante à afficher).
  const auRang = tierces.filter((s) => RESISTANCE_ORDER.indexOf(s.resistance) === rangMin);
  const source = auRang.reduce((pire, s) => (pire.parJour == null || (s.parJour != null && s.parJour < pire.parJour) ? s : pire), auRang[0]);
  return { resistance: source.resistance, source, parJour: source.parJour };
// Fin de resistanceDuGroupe.
}

/** Nombre total de routes documentées. */
export const countDocRoutes = () => API_DOC_GROUPS.reduce((n, g) => n + g.routes.length, 0);
