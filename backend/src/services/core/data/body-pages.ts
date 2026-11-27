// Fonction qui retire les accents et les majuscules d'un texte.
import { normalize } from '../../../common/text';
// Chiffres des astres, fabrication des questions-réponses, et tournure « de »/« du »/« d’ » devant un nom.
import { BODY_FACTS, bodyQuestions, ofLabel } from './body-facts';
// Adresse anglaise jumelle d'une page (hreflang).
import { englishPathFor } from './en-slugs';

// Index généré à partir des 5 000 expressions du fichier SEO source (copié dans dist par Nest, voir nest-cli.json : outDir « dist/… »).
type SeoKeywordRecord = { keyword: string; category: string };
type SeoKeywordCoverage = { pages: Record<string, { fr: SeoKeywordRecord[]; en: SeoKeywordRecord[] }> };
// Fichier absent (copie Nest ratée) : index vide plutôt qu'un plantage du build et du serveur au démarrage.
const SEO_KEYWORD_COVERAGE: SeoKeywordCoverage = (() => {
  // Essaie de charger l'index des mots-clés.
  try { return require('../../content/seo/data/keyword-coverage.json') as SeoKeywordCoverage; }
  // Introuvable : aucun mot-clé, les pages restent correctes.
  catch { console.warn('[SEO] keyword-coverage.json introuvable : mots-clés désactivés'); return { pages: {} }; }
})();

/** Expressions les plus utiles à afficher dans le contenu éditorial d'une page, sans bourrage de mots-clés. */
export function seoKeywordsForPage(slug: string, language: 'fr' | 'en' = 'fr', limit = 12): string[] {
  const route = slug === '' || slug === '/' ? '/' : `/${slug.replace(/^\/+|\/+$/g, '').toLowerCase()}`;
  const records = SEO_KEYWORD_COVERAGE.pages[route]?.[language] ?? [];
  const priority: Record<string, number> = {
    page_specific: 0, systeme_solaire: 0, solar_system: 0, terre_cartographie: 0, earth_mapping: 0,
    galerie: 0, gallery: 0, long_tail_planetary: 1, planetary_features: 2, orbites: 2, orbits: 2,
    astronomie: 2, astronomy: 2, lidar_topographie: 2, lidar_topography: 2,
    donnees_sources: 2, data_sources: 2, moteur_3d: 3, '3d_engine': 3,
    semantic_variants: 4, semantic_combinations: 5,
  };
  return [...records]
    .filter((record) => record.keyword && !/[{}]/.test(record.keyword))
    .sort((a, b) => (priority[a.category] ?? 9) - (priority[b.category] ?? 9))
    .map((record) => record.keyword.replace(/\bde le\b/gi, 'du').replace(/\bà le\b/gi, 'au'))
    .filter((keyword, index, all) => all.indexOf(keyword) === index)
    .slice(0, Math.max(0, limit));
}

/**
 * Pages de référencement : une adresse par astre (https://www.gobaispace.com/mars, /titan…).
 * Le serveur renvoie l'application avec un titre, une description et une adresse canonique propres à l'astre ;
 * le site lit l'adresse au chargement et se téléporte sur l'astre. L'adresse est le nom français sans accent.
 * Les fenêtres du site ont aussi leur adresse (/galerie, /node) : le site les ouvre au chargement.
 * Liste reprise dans frontend/public/sitemap.xml : toute page ajoutée ici doit l'être aussi là-bas.
 * Mot-clé visé par le site : « système solaire 3D » (SITE_KEYWORD) — repris dans le titre de chaque astre et dans son
 * fil d'Ariane, qui rattache la page à l'accueil.
 */
// Forme d'une page de référencement.
export interface BodyPage {
  // slug : son adresse, sans la barre oblique.
  slug: string;
  // name : le nom de l'astre ou de la fenêtre.
  name: string;
  /** Avec article, pour les phrases : « la Lune », « Mars ». */
  // label : le nom avec son article.
  label: string;
  // kind : sa nature, parmi cinq.
  kind: 'étoile' | 'planète' | 'planète naine' | 'satellite' | 'fenêtre';
  /** Titre affiché dans le texte de départ et, suivi du nom du site, dans l'onglet et les résultats de recherche. */
  // heading : son titre.
  heading: string;
  // description : sa description.
  description: string;
// Fin de BodyPage.
}

// Adresse du site en ligne.
export const SITE_URL = 'https://www.gobaispace.com';
// Nom de l'application.
export const APP_NAME = 'Go白ناन्टех';
// Mot-clé visé par le site.
export const SITE_KEYWORD = 'Système solaire 3D';

// Fonction capitalize : met la première lettre en majuscule.
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Fonction page : fabrique la page d'un astre à partir de son nom, de son nom avec article, de sa nature et de sa description.
const page = (name: string, label: string, kind: BodyPage['kind'], description: string): BodyPage => ({
  // L'adresse est le nom sans accents ni majuscules ; le titre est « <Nom> en 3D et en direct ».
  slug: normalize(name), name, label, kind, heading: `${capitalize(label)} en 3D et en direct`, description,
// Fin de page.
});

/** Fenêtre du site (galerie, Node…) : adresse et titre choisis à la main. */
// Fonction windowPage : fabrique la page d'une fenêtre, dont l'adresse et le titre sont donnés.
const windowPage = (slug: string, name: string, heading: string, description: string): BodyPage => ({
  // Le nom sert aussi de nom avec article ; la nature est « fenêtre ».
  slug, name, label: name, kind: 'fenêtre', heading, description,
// Fin de windowPage.
});

/** Fenêtres du site ayant leur adresse ; ouvertes au chargement par SolarScene.jsx (même liste d'adresses). */
// Pages des fenêtres du site :
export const WINDOW_PAGES: BodyPage[] = [
  // la galerie, à l'adresse /galerie ;
  windowPage('galerie', 'Galerie', 'Galerie d’images du système solaire', 'La galerie de Gobai Space : images et vidéos NASA des planètes, des planètes naines, des géantes et de leurs satellites, classées par astre.'),
  // la fenêtre des sources, à l'adresse /node.
  windowPage('node', 'Node Open Source', 'Node Open Source : sources des données', 'Node Open Source : les sources de données et les projets libres derrière Gobai Space, des cartes NASA Trek à l’imagerie IGN et Sentinel-2.'),
  // la fenêtre des dons, à l'adresse /faire-un-don.
  windowPage('faire-un-don', 'Dons au développeur de l’application Gobai', 'Dons au développeur de l’application Gobai', 'Soutenir le développeur de l’application Gobai : un don par carte bancaire aide à garder le système solaire en 3D gratuit, sans publicité et en ligne.'),
// Fin de la liste.
];

// Pages des astres :
export const BODY_PAGES: BodyPage[] = [
  // Page de Soleil (étoile) : nom avec article « le Soleil », puis sa description.
  page('Soleil', 'le Soleil', 'étoile', 'Le Soleil en 3D et en direct : l’étoile au centre du système solaire, 109 fois le diamètre de la Terre, avec ses caractéristiques.'),
  // Page de Mercure (planète) : nom avec article « Mercure », puis sa description.
  page('Mercure', 'Mercure', 'planète', 'Mercure en 3D et en direct : la planète la plus proche du Soleil, habillée de la carte NASA de sa surface criblée de cratères.'),
  // Page de Vénus (planète) : nom avec article « Vénus », puis sa description.
  page('Vénus', 'Vénus', 'planète', 'Vénus en 3D et en direct : la planète à la rotation rétrograde, avec la carte NASA de son relief caché sous les nuages.'),
  // Page de Terre (planète) : nom avec article « la Terre », puis sa description.
  page('Terre', 'la Terre', 'planète', 'La Terre en 3D et en direct : imagerie satellite jusqu’au sol, villes, pays, frontières et météo, à l’échelle 1:1.'),
  // Page de Lune (satellite) : nom avec article « la Lune », puis sa description.
  page('Lune', 'la Lune', 'satellite', 'La Lune en 3D et en direct : position réelle autour de la Terre, cartes NASA de la surface, cratères, mers et sites d’alunissage.'),
  // Page de Mars (planète) : nom avec article « Mars », puis sa description.
  page('Mars', 'Mars', 'planète', 'Mars en 3D et en direct : la planète rouge avec les cartes NASA de sa surface, ses volcans, ses canyons et ses sites d’atterrissage.'),
  // Page de Phobos (satellite) : nom avec article « Phobos », puis sa description.
  page('Phobos', 'Phobos', 'satellite', 'Phobos en 3D et en direct : la plus grande lune de Mars, avec le modèle 3D NASA de sa forme irrégulière et son orbite en temps réel.'),
  // Page de Deimos (satellite) : nom avec article « Deimos », puis sa description.
  page('Deimos', 'Deimos', 'satellite', 'Deimos en 3D et en direct : la petite lune extérieure de Mars, avec le modèle 3D NASA de sa forme irrégulière et son orbite en temps réel.'),
  // Page de Jupiter (planète) : nom avec article « Jupiter », puis sa description.
  page('Jupiter', 'Jupiter', 'planète', 'Jupiter en 3D et en direct : la plus grande planète du système solaire, ses bandes de nuages, son intérieur et ses quatre grandes lunes.'),
  // Page de Saturne (planète) : nom avec article « Saturne », puis sa description.
  page('Saturne', 'Saturne', 'planète', 'Saturne en 3D et en direct : la géante gazeuse, ses anneaux modélisés et ses lunes, de Mimas à Titan.'),
  // Page de Uranus (planète) : nom avec article « Uranus », puis sa description.
  page('Uranus', 'Uranus', 'planète', 'Uranus en 3D et en direct : la géante de glace couchée sur son orbite, à sa position réelle dans le système solaire.'),
  // Page de Neptune (planète) : nom avec article « Neptune », puis sa description.
  page('Neptune', 'Neptune', 'planète', 'Neptune en 3D et en direct : la planète la plus lointaine du système solaire, à sa position réelle autour du Soleil.'),
  // Page de Pluton (planète naine) : nom avec article « Pluton », puis sa description.
  page('Pluton', 'Pluton', 'planète naine', 'Pluton en 3D et en direct : la planète naine aux confins du système solaire, sur son orbite inclinée et excentrique.'),
  // Page de Io (satellite) : nom avec article « Io », puis sa description.
  page('Io', 'Io', 'satellite', 'Io en 3D et en direct : la lune volcanique de Jupiter, avec la carte NASA de sa surface et son orbite en temps réel.'),
  // Page de Europe (satellite) : nom avec article « Europe », puis sa description.
  page('Europe', 'Europe', 'satellite', 'Europe en 3D et en direct : la lune glacée de Jupiter et son océan sous la banquise, avec la carte NASA de sa surface.'),
  // Page de Ganymède (satellite) : nom avec article « Ganymède », puis sa description.
  page('Ganymède', 'Ganymède', 'satellite', 'Ganymède en 3D et en direct : la plus grande lune du système solaire, en orbite autour de Jupiter, avec la carte NASA de sa surface.'),
  // Page de Callisto (satellite) : nom avec article « Callisto », puis sa description.
  page('Callisto', 'Callisto', 'satellite', 'Callisto en 3D et en direct : la lune de Jupiter couverte de cratères, avec la carte NASA de sa surface.'),
  // Page de Mimas (satellite) : nom avec article « Mimas », puis sa description.
  page('Mimas', 'Mimas', 'satellite', 'Mimas en 3D et en direct : la petite lune de Saturne et son immense cratère Herschel, avec la carte NASA de sa surface.'),
  // Page de Encelade (satellite) : nom avec article « Encelade », puis sa description.
  page('Encelade', 'Encelade', 'satellite', 'Encelade en 3D et en direct : la lune de Saturne aux geysers de glace, avec la carte NASA de sa surface.'),
  // Page de Téthys (satellite) : nom avec article « Téthys », puis sa description.
  page('Téthys', 'Téthys', 'satellite', 'Téthys en 3D et en direct : la lune glacée de Saturne, avec la carte NASA de sa surface et son orbite en temps réel.'),
  // Page de Dioné (satellite) : nom avec article « Dioné », puis sa description.
  page('Dioné', 'Dioné', 'satellite', 'Dioné en 3D et en direct : la lune de Saturne aux falaises de glace, avec la carte NASA de sa surface.'),
  // Page de Rhéa (satellite) : nom avec article « Rhéa », puis sa description.
  page('Rhéa', 'Rhéa', 'satellite', 'Rhéa en 3D et en direct : la deuxième plus grande lune de Saturne, avec la carte NASA de sa surface.'),
  // Page de Titan (satellite) : nom avec article « Titan », puis sa description.
  page('Titan', 'Titan', 'satellite', 'Titan en 3D et en direct : la plus grande lune de Saturne, la seule du système solaire à posséder une atmosphère épaisse.'),
  // Page de Japet (satellite) : nom avec article « Japet », puis sa description.
  page('Japet', 'Japet', 'satellite', 'Japet en 3D et en direct : la lune de Saturne à deux visages, l’un clair et l’autre sombre, avec la carte NASA de sa surface.'),
  // Page de Miranda (satellite) : nom avec article « Miranda », puis sa description.
  page('Miranda', 'Miranda', 'satellite', 'Miranda en 3D et en direct : la petite lune d’Uranus au relief chaotique, survolée par Voyager 2 en 1986, à sa position réelle.'),
  // Page de Ariel (satellite) : nom avec article « Ariel », puis sa description.
  page('Ariel', 'Ariel', 'satellite', 'Ariel en 3D et en direct : la lune la plus claire d’Uranus, striée de vallées, survolée par Voyager 2 en 1986, à sa position réelle.'),
  // Page de Umbriel (satellite) : nom avec article « Umbriel », puis sa description.
  page('Umbriel', 'Umbriel', 'satellite', 'Umbriel en 3D et en direct : la lune la plus sombre d’Uranus, couverte de cratères anciens, survolée par Voyager 2 en 1986, à sa position réelle.'),
  // Page de Titania (satellite) : nom avec article « Titania », puis sa description.
  page('Titania', 'Titania', 'satellite', 'Titania en 3D et en direct : la plus grande lune d’Uranus, entaillée de canyons, survolée par Voyager 2 en 1986, à sa position réelle.'),
  // Page de Obéron (satellite) : nom avec article « Obéron », puis sa description.
  page('Obéron', 'Obéron', 'satellite', 'Obéron en 3D et en direct : la grande lune la plus lointaine d’Uranus, très cratérisée, survolée par Voyager 2 en 1986, à sa position réelle.'),
  // Page de Triton (satellite) : nom avec article « Triton », puis sa description.
  page('Triton', 'Triton', 'satellite', 'Triton en 3D et en direct : la plus grande lune de Neptune, sur son orbite rétrograde, survolée par Voyager 2 en 1989, à sa position réelle.'),
  // Page de Charon (satellite) : nom avec article « Charon », puis sa description.
  page('Charon', 'Charon', 'satellite', 'Charon en 3D et en direct : la grande lune de Pluton, survolée par New Horizons en 2015, à sa position réelle.'),
// Fin de la liste.
];

// Table adresse → page, qui réunit les astres et les fenêtres.
const BY_SLUG = new Map([...BODY_PAGES, ...WINDOW_PAGES].map((p) => [p.slug, p]));

/**
 * Planète (ou planète naine) mère de chaque satellite, pour varier son mot-clé de référencement : absente pour
 * le Soleil, les planètes et Pluton, qui n'ont pas de planète mère.
 */
const PARENT_OF = new Map<string, string>([
  ['lune', 'la Terre'], ['phobos', 'Mars'], ['deimos', 'Mars'],
  ['io', 'Jupiter'], ['europe', 'Jupiter'], ['ganymede', 'Jupiter'], ['callisto', 'Jupiter'],
  ['mimas', 'Saturne'], ['encelade', 'Saturne'], ['tethys', 'Saturne'], ['dione', 'Saturne'], ['rhea', 'Saturne'], ['titan', 'Saturne'], ['japet', 'Saturne'],
  ['miranda', 'Uranus'], ['ariel', 'Uranus'], ['umbriel', 'Uranus'], ['titania', 'Uranus'], ['oberon', 'Uranus'],
  ['triton', 'Neptune'], ['charon', 'Pluton'],
]);

/**
 * Mot-clé de référencement propre à un astre (balise meta "keywords", table seo_tags, tag_name=keywords) :
 * sa planète mère pour un satellite (le distingue des autres lunes), sa position réelle pour les autres astres.
 * Pour une fenêtre du site (galerie, dons…), le mot-clé général du site. Valeur par défaut, utilisée aussi bien
 * pour amorcer la table que pour le repli si la base est absente ou sans cette page (voir renderBodyPage).
 */
// Fonction focusKeyword : le mot-clé de référencement d'une page.
export function focusKeyword(body: BodyPage): string {
  // Fenêtre : le mot-clé général du site.
  if (body.kind === 'fenêtre') return SITE_KEYWORD;
  // Planète mère, s'il y en a une (satellite).
  const parent = PARENT_OF.get(body.slug);
  // Satellite : son nom avec sa planète mère (élision correcte : « d’Uranus », « de Mars »…) ; sinon : sa position réelle.
  return parent ? `${body.label} en 3D, lune ${ofLabel(parent)}` : `${body.label} en 3D, position réelle`;
// Fin de focusKeyword.
}

/** Page de l'astre pour un chemin d'URL (« /mars », « /Mars/ ») ; undefined si ce n'est pas une page d'astre. */
// Fonction bodyPageFor : la page qui correspond à un chemin d'adresse.
export function bodyPageFor(path: string): BodyPage | undefined {
  // Reconnaît un chemin d'un seul segment, avec ou sans barre finale.
  const m = /^\/([^/]+)\/?$/.exec(path);
  // Autre forme : pas une page.
  if (!m) return undefined;
  // Le segment.
  let segment = m[1];
  // Décode ses caractères encodés (%C3%A9 devient é) ; un encodage invalide : pas une page.
  try { segment = decodeURIComponent(segment); } catch { return undefined; }
  // Cherche la page par son adresse, accents et majuscules retirés.
  return BY_SLUG.get(normalize(segment));
// Fin de bodyPageFor.
}

/** Chiffres et questions-réponses d'une page d'astre (vides pour une fenêtre ou un astre sans chiffres). */
// Fonction bodyContent : les chiffres et les questions d'une page.
export function bodyContent(body: BodyPage): { facts: { label: string; value: string }[]; questions: { question: string; answer: string }[] } {
  // Chiffres : aucun pour une fenêtre, sinon ceux de l'astre (liste vide s'il n'en a pas).
  const facts = body.kind === 'fenêtre' ? [] : BODY_FACTS.get(body.slug) ?? [];
  // Renvoie les chiffres et les questions qui en sont tirées.
  return { facts, questions: bodyQuestions(body.label, facts) };
// Fin de bodyContent.
}

/**
 * Version Markdown d'une page (https://www.gobaispace.com/mars.md) : le même contenu que la page, en texte, pour les
 * assistants IA (convention llms.txt). Reprise bout à bout dans /llms-full.txt.
 */
// Fonction renderBodyMarkdown : la page en Markdown.
export function renderBodyMarkdown(body: BodyPage): string {
  // Adresse de la page.
  const url = `${SITE_URL}/${body.slug}`;
  // Ses chiffres et ses questions.
  const { facts, questions } = bodyContent(body);
  // Lignes du texte : le titre, la description en citation, l'adresse.
  const lines = [`# ${body.heading}`, '', `> ${body.description}`, '', `Page : ${url}`];
  // S'il y a des chiffres :
  if (facts.length) {
    // une section « en chiffres », un chiffre par ligne de liste ;
    lines.push('', `## ${body.name} en chiffres`, '', ...facts.map((f) => `- ${f.label} : ${f.value}`));
    // une section de questions fréquentes, chaque question en sous-titre suivie de sa réponse ;
    lines.push('', `## Questions fréquentes sur ${body.label}`, '', ...questions.flatMap((q) => [`### ${q.question}`, '', q.answer, '']));
    // et la ligne des sources.
    lines.push('Sources des chiffres : NASA NSSDCA (Planetary Fact Sheets) et JPL Solar System Dynamics.');
  // Fin du cas.
  }
  // Expressions associées à la page, sélectionnées dans le catalogue complet de 5 000 entrées.
  const relatedKeywords = seoKeywordsForPage(body.slug, 'fr', 12);
  if (relatedKeywords.length) {
    lines.push('', '## Sujets et recherches associés', '', `Cette page couvre également les sujets suivants : ${relatedKeywords.join(' ; ')}.`);
  }
  // Pour un astre (pas une fenêtre) :
  if (body.kind !== 'fenêtre') {
    // une section qui dit ce que l'application en montre, avec l'adresse.
    lines.push('', '## Dans l’application', '', `${APP_NAME} (Gobai Space) affiche ${body.label} en 3D, à sa position réelle du moment, gratuitement et sans installation : ${url}`);
  // Fin du cas.
  }
  // Assemble les lignes, réduit toute suite de lignes vides à une seule, et termine par un retour à la ligne.
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
// Fin de renderBodyMarkdown.
}

/** Tout le site en un seul texte (/llms-full.txt) : le résumé `llms` (public/llms.txt) puis chaque page en Markdown. */
// Fonction renderLlmsFull : tout le site en un seul texte.
export function renderLlmsFull(llms: string): string {
  // Le résumé, puis chaque page en Markdown, séparés par une ligne de trois tirets.
  return [llms.trim(), ...[...BODY_PAGES, ...WINDOW_PAGES].map((p) => renderBodyMarkdown(p).trim())].join('\n\n---\n\n') + '\n';
// Fin de renderLlmsFull.
}

/** Adresse « /mars.md » → page de l'astre, sinon undefined. */
// Fonction markdownPageFor : la page qui correspond à une adresse en « .md ».
export function markdownPageFor(path: string): BodyPage | undefined {
  // Reconnaît un chemin d'un seul segment terminé par « .md ».
  const m = /^(\/[^/]+)\.md$/.exec(path);
  // Si oui, cherche la page de ce chemin sans l'extension ; sinon undefined.
  return m ? bodyPageFor(m[1]) : undefined;
// Fin de markdownPageFor.
}

// Fonction escapeHtml : rend un texte inoffensif dans du HTML,
const escapeHtml = (s: string): string =>
  // en remplaçant les quatre caractères spéciaux (&, <, >, ") par leur code.
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Limites éditoriales demandées pour les extraits de résultats (sans couper au milieu d'un mot).
const fitMeta = (value: string, limit: number): string => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1).replace(/\s+\S*$/, '').trim();
  return `${cut}…`;
};

// Identifiants Wikidata connus ; aucun identifiant n'est inventé pour les autres objets du catalogue.
const WIKIDATA: Record<string, string> = {
  soleil: 'Q525', mercure: 'Q308', venus: 'Q313', terre: 'Q2', lune: 'Q405', mars: 'Q111',
  jupiter: 'Q319', saturne: 'Q193', uranus: 'Q324', neptune: 'Q332', pluton: 'Q339',
};

function relatedBodyPages(body: BodyPage): BodyPage[] {
  if (body.kind === 'fenêtre') return [];
  const parentLabel = PARENT_OF.get(body.slug);
  if (parentLabel) {
    const parentName = parentLabel.replace(/^(la|le)\s+/i, '');
    const parent = BODY_PAGES.find((p) => normalize(p.name) === normalize(parentName));
    return parent ? [parent] : [];
  }
  return BODY_PAGES.filter((p) => PARENT_OF.get(p.slug) === body.label || PARENT_OF.get(p.slug) === body.name);
}

/**
 * Accueil pré-rendu : conserve le modèle Vite, avec les thèmes du catalogue SEO dans la seule balise meta keywords.
 */
export function renderHomePage(template: string): string {
  const relatedKeywords = seoKeywordsForPage('/', 'fr', 16);
  const keywords = ['système solaire 3D', ...relatedKeywords].filter((value, index, all) => all.indexOf(value) === index);
  const html = template.replace(
    /(<meta\s+name="keywords"\s+content=")[^"]*(")/,
    (_match, before: string, after: string) => `${before}${escapeHtml(keywords.join(', '))}${after}`,
  );
  // Pas de liste de mots-clés dans le texte : du texte caché bourré de mots-clés est sanctionné par Google.
  return html;
}

/**
 * index.html du site, avec le titre, la description, l'adresse canonique, les chiffres et la FAQ propres à la page.
 * tags : balisage SEO (titre, description…) lu dans la table seo_tags (voir seo-tags.service.ts) ; absent ou
 * sans valeur pour une clé donnée, le texte écrit ci-dessous dans le code (body.heading, body.description) sert
 * de repli, pour que le site reste correct même sans base de données.
 */
// Fonction renderBodyPage : fabrique le HTML d'une page à partir du modèle index.html.
export function renderBodyPage(template: string, body: BodyPage, tags?: Map<string, string>): string {
  // Adresse de la page.
  const url = `${SITE_URL}/${body.slug}`;
  // Astre : « Mars en 3D et en direct · Système solaire 3D Go白ناन्टех (Gobai Space) » ; fenêtre : sans le mot-clé.
  // Nom du site dans le titre : sans le mot-clé pour une fenêtre, avec pour un astre.
  const site = body.kind === 'fenêtre' ? `${APP_NAME} (Gobai Space)` : `${SITE_KEYWORD} ${APP_NAME} (Gobai Space)`;
  // Titre et description bruts (avant mise en forme HTML) : ceux de la table seo_tags s'ils sont renseignés, sinon ceux écrits dans le code.
  const defaultTitle = body.kind === 'fenêtre'
    ? `${body.name} | Gobai Space`
    : `${body.name} en 3D | Système solaire 3D · Gobai Space`;
  const titleText = fitMeta(tags?.get('title') || defaultTitle, 60);
  const descriptionText = fitMeta(tags?.get('description') || body.description, 155);
  // Mot-clé de référencement (balise meta "keywords") : celui de la table seo_tags, sinon celui calculé pour l'astre.
  const relatedKeywords = seoKeywordsForPage(body.slug, 'fr', 12);
  const keywordsText = tags?.get('keywords') || [focusKeyword(body), ...relatedKeywords].join(', ');
  // Titre complet, rendu inoffensif.
  const title = escapeHtml(titleText);
  // Description, rendue inoffensive.
  const description = escapeHtml(descriptionText);
  // Chiffres et questions de la page.
  const { facts, questions } = bodyContent(body);
  // Fonction meta : remplace le contenu d'une balise meta désignée par son nom,
  const meta = (html: string, key: string, value: string): string =>
    // en gardant le début et la fin de la balise et en changeant seulement la valeur.
    html.replace(new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`), (_m, a: string, b: string) => a + value + b);

  // Remplace la balise title du modèle.
  let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  // Remplace l'adresse canonique.
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, (_m, a: string, b: string) => a + url + b);
  // Versions linguistiques : cette page en français (aussi version par défaut) et sa jumelle anglaise (/en/…).
  html = html.replace(/(<link\s+rel="alternate"\s+hreflang="(fr|en|x-default)"\s+href=")[^"]*(")/g, (_m, a: string, lang: string, b: string) => a + (lang === 'en' ? `${SITE_URL}${englishPathFor(body.slug)}` : url) + b);
  // Version texte de la page pour les assistants IA : /mars.md à la place du résumé général.
  // Remplace l'adresse de la version Markdown.
  html = html.replace(/(<link\s+rel="alternate"\s+type="text\/markdown"\s+href=")[^"]*(")/, (_m, a: string, b: string) => `${a}${url}.md${b}`);
  // Remplace la description.
  html = meta(html, 'description', description);
  // Remplace le mot-clé de référencement, rendu inoffensif.
  html = meta(html, 'keywords', escapeHtml(keywordsText));
  // Remplace l'adresse pour les réseaux sociaux.
  html = meta(html, 'og:url', url);
  // Remplace le titre pour les réseaux sociaux.
  html = meta(html, 'og:title', title);
  // Remplace la description pour les réseaux sociaux.
  html = meta(html, 'og:description', description);
  // Image de partage propre à l'astre (frontend/public/og/<slug>.jpg, voir seo/tools/generate-og-images.py) ;
  // une fenêtre (Galerie, Node, dons) garde l'image générale du site.
  const ogImage = body.kind === 'fenêtre' ? `${SITE_URL}/og-image.jpg` : `${SITE_URL}/og/${body.slug}.jpg`;
  // Texte de remplacement de l'image.
  const ogAlt = escapeHtml(body.kind === 'fenêtre' ? `${body.name} · ${APP_NAME}` : `${body.name} : illustration, système solaire 3D ${APP_NAME}`);
  // Image pour Facebook, LinkedIn, WhatsApp…
  html = meta(html, 'og:image', ogImage);
  html = meta(html, 'og:image:alt', ogAlt);
  // Remplace le titre pour X (Twitter).
  html = meta(html, 'twitter:title', title);
  // Remplace la description pour X (Twitter).
  html = meta(html, 'twitter:description', description);
  // Image et texte de remplacement pour X (Twitter).
  html = meta(html, 'twitter:image', ogImage);
  html = meta(html, 'twitter:image:alt', ogAlt);
  // Texte de départ lu par les moteurs de recherche : le titre et la première phrase deviennent ceux de l'astre,
  // suivis de ses chiffres.
  // HTML des chiffres : s'il y en a,
  const factsHtml = facts.length
    // un sous-titre et une liste, chaque chiffre dans un élément, rendu inoffensif ;
    ? `\n        <h2>${escapeHtml(body.name)} en chiffres</h2>\n        <ul>\n${facts.map((f) => `          <li>${escapeHtml(f.label)} : ${escapeHtml(f.value)}</li>`).join('\n')}\n        </ul>`
    // sinon rien.
    : '';
  // Dans le texte de départ lu par les moteurs de recherche,
  html = html.replace(
    // repère le titre principal et le premier paragraphe,
    /(<main class="seo-shell">\s*<h1>)[\s\S]*?(<\/h1>\s*<p>)[\s\S]*?(<\/p>)/,
    // et les remplace par le titre de la page, sa description, puis ses chiffres.
    (_m, a: string, b: string, c: string) => {
      const related = relatedBodyPages(body);
      const relatedHtml = related.length
        ? `\n        <h2>${body.kind === 'satellite' ? 'Planète associée' : 'Satellites naturels'}</h2>\n        <ul>${related.map((item) => `<li><a href="/${escapeHtml(item.slug)}">${escapeHtml(item.name)} en 3D</a></li>`).join('')}</ul>`
        : '';
      return `${a}${escapeHtml(body.heading)}${b}${description}${c}${factsHtml}${relatedHtml}`;
    },
  // Fin du remplacement.
  );
  // FAQ : celle de l'accueil ne vaut que pour l'accueil. Ici, les questions de l'astre la remplacent (ou rien).
  // HTML des questions : s'il y en a,
  const faqHtml = questions.length
    // un sous-titre, puis chaque question en titre suivie de sa réponse ;
    ? `<h2>Questions fréquentes sur ${escapeHtml(body.label)}</h2>\n${questions.map((q) => `        <h3>${escapeHtml(q.question)}</h3>\n        <p>${escapeHtml(q.answer)}</p>\n`).join('')}        `
    // sinon rien.
    : '';
  // Remplace la FAQ de l'accueil, du sous-titre jusqu'au paragraphe « Chargement », par celle de la page.
  html = html.replace(/<h2>Questions fréquentes<\/h2>[\s\S]*?(?=<p>Chargement)/, () => faqHtml);
  // Dans le bloc de données structurées du modèle :
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, a: string, json: string, c: string) => {
    // essaie
    try {
      // de lire son JSON ;
      const data = JSON.parse(json) as { '@graph'?: { '@type'?: string }[] };
      // sans liste « @graph » : on le laisse tel quel ;
      if (!Array.isArray(data['@graph'])) return m;
      // retire la FAQ de l'accueil de la liste ;
      data['@graph'] = data['@graph'].filter((node) => node['@type'] !== 'FAQPage');
      // et réécrit le bloc, en échappant « < ».
      return `${a}${JSON.stringify(data).replace(/</g, '\\u003c')}${c}`;
    // En cas d'erreur de lecture,
    } catch {
      // on laisse le bloc tel quel.
      return m; // modèle inattendu : on le laisse tel quel
    // Fin du cas.
    }
  // Fin du remplacement.
  });
  // Données structurées de la page : fil d'Ariane (Système solaire 3D › astre), page et, pour un astre, sa FAQ.
  // Données structurées propres à la page :
  const graph: Record<string, unknown>[] = [
    // premier élément,
    {
      // un fil d'Ariane,
      '@type': 'BreadcrumbList',
      // son identifiant,
      '@id': `${url}#breadcrumb`,
      // ses deux étapes :
      itemListElement: [
        // l'accueil, sous le mot-clé du site ;
        { '@type': 'ListItem', position: 1, name: SITE_KEYWORD, item: `${SITE_URL}/` },
        // la page elle-même.
        { '@type': 'ListItem', position: 2, name: body.name, item: url },
      // Fin des étapes.
      ],
    // Fin du fil d'Ariane.
    },
    // Second élément,
    {
      // la page web,
      '@type': 'WebPage',
      // son identifiant,
      '@id': `${url}#webpage`,
      // son adresse,
      url,
      // son titre,
      name: titleText,
      // sa description,
      description: descriptionText,
      keywords: relatedKeywords,
      // sa langue,
      inLanguage: 'fr',
      // le site dont elle fait partie,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      // son fil d'Ariane,
      breadcrumb: { '@id': `${url}#breadcrumb` },
      // son image principale,
      primaryImageOfPage: `${SITE_URL}/og-image.jpg`,
      // et, pour un astre seulement,
      ...(body.kind === 'fenêtre' ? {} : {
        // ce dont elle parle :
        about: {
          // une « chose »,
          '@type': 'Thing',
          // son nom,
          name: body.name,
          // sa description,
          description: descriptionText,
          ...(WIKIDATA[body.slug] ? { sameAs: `https://www.wikidata.org/wiki/Q${WIKIDATA[body.slug].replace(/^Q/, '')}` } : {}),
          // et ses chiffres, chacun sous forme de propriété nommée.
          additionalProperty: facts.map((f) => ({ '@type': 'PropertyValue', name: f.label, value: f.value })),
        // Fin du sujet.
        },
      // Fin de l'ajout conditionnel.
      }),
    // Fin de la page web.
    },
  // Fin de la liste.
  ];
  // S'il y a des questions :
  if (questions.length) {
    // ajoute
    graph.push({
      // une FAQ,
      '@type': 'FAQPage',
      // son identifiant,
      '@id': `${url}#faq`,
      // sa langue,
      inLanguage: 'fr',
      // et chaque question avec sa réponse.
      mainEntity: questions.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
    // Fin de la FAQ.
    });
  // Fin du cas.
  }
  // « < » échappé : le texte ne peut pas refermer la balise script.
  // Sérialise ces données en JSON, en échappant « < ».
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  // Les insère dans un nouveau bloc, juste avant la fin de l'en-tête de la page.
  html = html.replace('</head>', () => `<script type="application/ld+json">${json}</script>\n  </head>`);
  // Renvoie le HTML.
  return html;
// Fin de renderBodyPage.
}
