/**
 * Dépendances réellement déclarées dans frontend/package.json et backend/package.json, et stack GO- reprise dans le code.
 * Les liens GitHub ne sont affichés que pour ces paquets présents dans le manifeste.
 * Aucun dépôt, auteur, date de mise à jour ou backend supposé n'est ajouté ici.
 */
export const OPEN_SOURCE_CREDITS = [
  {
    group: 'Dépendances de production',
    items: [
      { name: 'React', repo: 'facebook/react', org: 'Meta', people: [] },
      { name: 'React DOM', repo: 'facebook/react', org: 'Meta', people: [] },
      { name: 'Three.js', repo: 'mrdoob/three.js', people: [] },
      { name: 'Base UI', repo: 'mui/base-ui', org: 'MUI', people: [] },
      { name: 'React Icons', repo: 'react-icons/react-icons', people: [] },
      { name: 'Lucide', repo: 'lucide-icons/lucide', people: [] },
    ],
  },
  {
    group: 'Dépendances de développement',
    items: [
      { name: 'Vite', repo: 'vitejs/vite', people: [] },
      { name: 'Tailwind CSS', repo: 'tailwindlabs/tailwindcss', org: 'Tailwind Labs', people: [] },
      { name: 'Plugin React pour Vite', repo: 'vitejs/vite-plugin-react', people: [] },
      { name: 'TypeScript', repo: 'microsoft/TypeScript', org: 'Microsoft', people: [] },
      { name: 'tsx', repo: 'privatenumber/tsx', people: [] },
      { name: '@types/node', repo: 'DefinitelyTyped/DefinitelyTyped', people: [] },
      { name: '@types/three', repo: 'DefinitelyTyped/DefinitelyTyped', people: [] },
    ],
  },
  {
    // Dépendances déclarées dans backend/package.json (API NestJS du backend).
    group: 'API NestJS (backend)',
    items: [
      { name: 'NestJS', repo: 'nestjs/nest', people: [] },
      { name: 'node-postgres (pg)', repo: 'brianc/node-postgres', people: [] },
      { name: 'reflect-metadata', repo: 'microsoft/reflect-metadata', org: 'Microsoft', people: [] },
      { name: 'RxJS', repo: 'ReactiveX/rxjs', people: [] },
    ],
  },
  {
    group: 'Stack GO-',
    items: [
      { name: '@go-/harmonie-3d', repo: 'Alexiskd/Go-', people: [] },
    ],
  },
];

/** Organisations liées aux dépôts effectivement référencés ci-dessus. */
export const SERVICE_ORGS = [
  { org: 'Anthropic', what: ['API Claude de l’assistant (Claude Platform), appelée avec la clé de l’utilisateur'] },
  { org: 'CDS Strasbourg', what: ['Service SIMBAD déclaré dans le client de catalogue astronomique (désactivé par défaut sans proxy)'] },
  { org: 'Caltech / NASA', what: ['NASA Exoplanet Archive déclaré dans le client de catalogue astronomique (désactivé par défaut sans proxy)'] },
  { org: 'David Lorenz', what: ['Tuiles du Light Pollution Atlas référencées par le moteur cartographique'] },
  { org: 'ESA', what: ['Gaia DR3 référencé par le service de catalogue astronomique'] },
  { org: 'Google', what: ['Google Fonts et décodeur Draco chargés par le frontend'] },
  { org: 'Mapterhorn', what: ['Métadonnées et tuiles d’altitude référencées par le moteur de relief'] },
  { org: 'Meta', what: ['React et React DOM, dépendances de production'] },
  { org: 'MUI', what: ['Base UI (fenêtres, infobulles, onglets, curseur), dépendance de production'] },
  { org: 'MyMemory', what: ['API de traduction appelée par les modules de traduction'] },
  { org: 'Mistral AI', what: ['API de l’assistant (La Plateforme), appelée avec la clé de l’utilisateur'] },
  { org: 'NASA', what: ['Vidéo du Scientific Visualization Studio sur l’écran de chargement'] },
  { org: 'OpenFreeMap', what: ['Tuiles cartographiques référencées par le moteur de routes'] },
  { org: 'Three.js', what: ['Bibliothèque 3D déclarée comme dépendance de production'] },
  { org: 'AWS', what: ['Tuiles d’altitude Terrarium référencées comme source de relief'] },
];

export function visibleCredits() {
  return OPEN_SOURCE_CREDITS.map(({ group, items }) => ({ group, items: items.slice() })).filter(({ items }) => items.length);
}

export function formatRepoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function orgsFromRepos() {
  const byOrg = new Map();
  for (const { items } of visibleCredits()) {
    for (const item of items) {
      if (!item.org || !item.repo) continue;
      if (!byOrg.has(item.org)) byOrg.set(item.org, []);
      const list = byOrg.get(item.org);
      if (!list.some((entry) => entry.repo === item.repo)) list.push(item);
    }
  }
  return [...byOrg].map(([org, items]) => ({ org, items })).sort((a, b) => a.org.localeCompare(b.org, 'fr'));
}
