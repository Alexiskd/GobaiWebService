#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'seo/gobai-seo-keywords-fr-en.json');
const outputPath = resolve(root, 'backend/src/services/content/seo/data/keyword-coverage.json');
const reportPath = resolve(root, 'seo/keyword-coverage-report.md');
const auditIndexPath = resolve(root, 'seo/keyword-coverage.json');

const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const routes = new Set([
  '/', '/soleil', '/mercure', '/venus', '/terre', '/lune', '/mars', '/phobos', '/deimos',
  '/jupiter', '/saturne', '/uranus', '/neptune', '/pluton', '/io', '/europe', '/ganymede',
  '/callisto', '/mimas', '/encelade', '/tethys', '/dione', '/rhea', '/titan', '/japet',
  '/miranda', '/ariel', '/umbriel', '/titania', '/oberon', '/triton', '/charon',
  '/galerie', '/node', '/faire-un-don',
]);
const bodyAliases = {
  soleil: ['soleil', 'sun'], mercure: ['mercure', 'mercury'], venus: ['venus'],
  terre: ['terre', 'earth'], lune: ['lune', 'moon'], mars: ['mars'], phobos: ['phobos'],
  deimos: ['deimos'], jupiter: ['jupiter'], saturne: ['saturne', 'saturn'], uranus: ['uranus'],
  neptune: ['neptune'], pluton: ['pluton', 'pluto'], io: ['io'], europe: ['europe', 'europa'],
  ganymede: ['ganymede'], callisto: ['callisto'], mimas: ['mimas'],
  encelade: ['encelade', 'enceladus'], tethys: ['tethys'], dione: ['dione'], rhea: ['rhea'],
  titan: ['titan'], japet: ['japet', 'iapetus'], miranda: ['miranda'], ariel: ['ariel'],
  umbriel: ['umbriel'], titania: ['titania'], oberon: ['oberon'], triton: ['triton'],
  charon: ['charon'], galerie: ['galerie', 'gallery'], node: ['node', 'data sources', 'sources de donnees'],
};
const categoryRoutes = {
  systeme_solaire: '/', solar_system: '/', astronomie: '/', astronomy: '/', orbites: '/', orbits: '/',
  moteur_3d: '/', '3d_engine': '/', technology_long_tail: '/',
  terre_cartographie: '/terre', earth_mapping: '/terre',
  lidar_topographie: '/terre', lidar_topography: '/terre',
  donnees_sources: '/node', data_sources: '/node',
  galerie: '/galerie', gallery: '/galerie',
};

function assignPage(item) {
  const declared = item.target_page?.toLowerCase();
  if (declared === '/iapetus') return '/japet';
  if (declared && routes.has(declared)) return declared;

  const keyword = normalize(item.keyword);
  const matches = [];
  for (const [slug, aliases] of Object.entries(bodyAliases)) {
    for (const alias of aliases) {
      const term = normalize(alias);
      if (new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(keyword)) {
        matches.push([term.length, slug]);
      }
    }
  }
  if (matches.length) {
    matches.sort((a, b) => b[0] - a[0]);
    const candidate = `/${matches[0][1]}`;
    if (routes.has(candidate)) return candidate;
  }

  const categoryRoute = categoryRoutes[item.category];
  if (categoryRoute) return categoryRoute;
  if (/\b(lidar|topograph|terrain|earth|globe|cartograph|geograph|latitude|longitude|country|city|relief)\b/.test(keyword)) return '/terre';
  if (/\b(nasa|usgs|jpl|dataset|data source|open data|imager|sentinel|lroc|mola|kaguya)\b/.test(keyword)) return '/node';
  if (/\b(gallery|galerie|image|photo|texture|rendering)\b/.test(keyword)) return '/galerie';
  return '/';
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!Array.isArray(source.keywords) || source.keywords.length !== 5000) {
  throw new Error(`Le fichier source doit contenir exactement 5 000 mots-clés (reçu : ${source.keywords?.length ?? 0}).`);
}
const pages = {};
const ids = new Set();
for (const item of source.keywords) {
  if (!item.id || !item.keyword || !['fr', 'en'].includes(item.language)) {
    throw new Error(`Entrée de mot-clé invalide : ${JSON.stringify(item)}`);
  }
  if (ids.has(item.id)) throw new Error(`Identifiant dupliqué : ${item.id}`);
  ids.add(item.id);
  const page = assignPage(item);
  if (!pages[page]) pages[page] = { fr: [], en: [] };
  pages[page][item.language].push({
    id: item.id,
    keyword: item.keyword,
    category: item.category,
    search_intent: item.search_intent,
    origin: item.origin,
    source_target_page: item.target_page ?? null,
  });
}
const languageCounts = Object.fromEntries(['fr', 'en'].map((lang) => [
  lang, Object.values(pages).reduce((sum, group) => sum + group[lang].length, 0),
]));
const output = {
  schema_version: source.schema_version,
  project: source.project,
  source_file: 'seo/gobai-seo-keywords-fr-en.json',
  keyword_count: ids.size,
  language_counts: languageCounts,
  mapped_page_count: Object.keys(pages).length,
  pages,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
await writeFile(auditIndexPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
await mkdir(dirname(reportPath), { recursive: true });
const report = [
  '# Couverture des 5 000 mots-clés Gobai', '',
  `- Expressions source : **${ids.size}**`,
  `- Français : **${languageCounts.fr}**`,
  `- Anglais : **${languageCounts.en}**`,
  `- Pages cibles : **${Object.keys(pages).length}**`,
  '- Toutes les expressions sont affectées à une page existante.',
  '- Les expressions sans `target_page` sont affectées selon leur catégorie et leur sujet.',
  '- `/iapetus` est normalisé vers la route française existante `/japet`.', '',
  '## Répartition par page', '',
  '| Page | Français | Anglais | Total |',
  '|---|---:|---:|---:|',
  ...Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)).map(([page, group]) =>
    `| \`${page}\` | ${group.fr.length} | ${group.en.length} | ${group.fr.length + group.en.length} |`),
  '', '## Règle éditoriale', '',
  'Les 5 000 expressions sont conservées dans `seo/keyword-coverage.json` et affectées à une page dans l’index chargé par le backend. Le rendu HTML sélectionne uniquement des expressions pertinentes pour le contenu visible de chaque page ; il ne publie pas les 5 000 expressions en bloc dans `meta keywords`. Les autres variantes servent à la couverture éditoriale, à la planification des FAQ et aux futures améliorations de contenu. Les volumes de recherche ne sont pas fournis par le JSON source et ne sont donc pas supposés.', '',
].join('\n');
await writeFile(reportPath, report, 'utf8');
console.log(`SEO keywords: ${ids.size} expressions (${languageCounts.fr} FR / ${languageCounts.en} EN), ${Object.keys(pages).length} pages.`);
