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
      ['GET', '/atmosphere/fires', 'Incendies.'],
      ['GET', '/atmosphere/fires/tiles/{tx}/{ty}', 'Points chauds d’une tuile.'],
      ['GET', '/atmosphere/cyclones', 'Cyclones actifs.'],
      ['GET', '/atmosphere/lightning', 'Foudre.'],
      ['GET', '/atmosphere/radar', 'Radar des précipitations.'],
      ['GET', '/atmosphere/storms', 'Orages.'],
      ['GET', '/atmosphere/aerosols', 'Aérosols.'],
      ['GET', '/atmosphere/winds', 'Vents.'],
      ['GET', '/assistant/config', 'Réglage de l’assistant côté serveur (désactivé : l’assistant passe par la clé de l’utilisateur).'],
    ],
  },
  {
    group: 'Tuiles et cartes', controller: 'tiles/tiles.controller.ts',
    routes: [
      ['GET', '/tiles/layers', 'Liste des couches de tuiles.'],
      ['GET', '/tiles/layers/{id}', 'Modèle d’adresse d’une couche.'],
      ['GET', '/tiles/layers/{id}/attribution', 'Mention des sources de la zone visible (paramètres zoom, north, south, east, west).'],
      ['GET', '/tiles/satellites/status', 'État des cartes des satellites naturels.'],
      ['GET', '/tiles/satellites/{body}/layers', 'Couches d’un satellite ou d’une géante gazeuse.'],
      ['GET', '/tiles/moon-blend/status', 'Variantes du modèle 3D de la Lune.'],
      ['GET', '/tiles/earth-wind', 'Vents du moment.'],
      ['GET', '/tiles/earth-clouds/cover', 'Couverture nuageuse du moment.'],
      ['GET', '/tiles/earth/plan', 'Table de priorité des sources d’imagerie de la Terre.'],
      ['GET', '/tiles/lidar-hd/cities', 'Villes couvertes par le LiDAR HD.'],
    ],
  },
  {
    group: 'Galerie', controller: 'galerie/galerie.controller.ts',
    routes: [
      ['GET', '/galerie', 'Photos et vidéos de la galerie, lues dans PostgreSQL (table GALERIE_TABLE, galerie_items par défaut) ; { total: 0, folders: [] } sans DATABASE_URL.'],
    ],
  },
  {
    group: 'Contributions', controller: 'contributions/contributions.controller.ts',
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
    routes: [
      ['GET', '/donations/config', 'Réglage des dons (désactivés dans l’édition statique).'],
      ['POST', '/donations/orders', 'Création d’un ordre de don.'],
      ['POST', '/donations/orders/{id}/capture', 'Encaissement d’un ordre.'],
      ['POST', '/donations/orders/{id}/cancel', 'Annulation d’un ordre.'],
    ],
  },
];

/** Nombre total de routes documentées. */
export const countDocRoutes = () => API_DOC_GROUPS.reduce((n, g) => n + g.routes.length, 0);
