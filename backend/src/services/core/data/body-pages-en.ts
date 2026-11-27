// Pages françaises (adresses, nature, image de partage) et constantes du site.
import { APP_NAME, BODY_PAGES, SITE_URL, WINDOW_PAGES, seoKeywordsForPage, type BodyPage } from './body-pages';
// Chiffres et FAQ en anglais.
import { BODY_FACTS_EN, bodyQuestionsEn } from './body-facts-en';
// Adresses anglaises.
import { EN_HOME_PATH, EN_SLUG_OF, englishPathFor } from './en-slugs';

/**
 * Version anglaise du site : https://www.gobaispace.com/en (accueil) et /en/<slug anglais> (/en/jupiter, /en/moon…).
 * Chaque page anglaise est la jumelle d'une page française (même astre, même fenêtre) : les deux se déclarent l'une
 * l'autre par hreflang (fr, en, x-default = français). Le nom de l'application n'est jamais traduit.
 */

/** Une page anglaise : sa jumelle française, son adresse anglaise, ses textes. */
export interface EnglishPage {
  // Page française jumelle.
  fr: BodyPage;
  // Adresse anglaise, sans « /en/ » (« moon »).
  slug: string;
  // Nom affiché (« Moon »).
  name: string;
  // Nom dans une phrase (« the Moon », « Mars »).
  label: string;
  // Titre de la page (H1).
  heading: string;
  // Description (balise meta et premier paragraphe).
  description: string;
}

// Adresse anglaise de l'accueil.
export const EN_HOME_URL = `${SITE_URL}${EN_HOME_PATH}`;
// Mot-clé visé en anglais.
export const EN_KEYWORD = '3D Solar System';

/** Textes anglais par adresse française : [nom, nom dans une phrase, description] ; adresses dans en-slugs.ts. */
const EN: Record<string, [string, string, string]> = {
  soleil: ['Sun', 'the Sun', 'The Sun in 3D, live: the star at the centre of the solar system, 109 times the diameter of Earth, with its key figures.'],
  mercure: ['Mercury', 'Mercury', 'Mercury in 3D, live: the planet closest to the Sun, covered with the NASA map of its cratered surface.'],
  venus: ['Venus', 'Venus', 'Venus in 3D, live: the planet with a retrograde rotation, with the NASA map of the terrain hidden under its clouds.'],
  terre: ['Earth', 'Earth', 'Earth in 3D, live: satellite imagery down to the ground, cities, countries and borders, at 1:1 scale.'],
  lune: ['Moon', 'the Moon', 'The Moon in 3D, live: its real position around Earth, NASA surface maps, craters, maria and landing sites.'],
  mars: ['Mars', 'Mars', 'Mars in 3D, live: the red planet with NASA maps of its surface, volcanoes, canyons and landing sites.'],
  phobos: ['Phobos', 'Phobos', 'Phobos in 3D, live: the largest moon of Mars, with the NASA 3D model of its irregular shape and its real-time orbit.'],
  deimos: ['Deimos', 'Deimos', 'Deimos in 3D, live: the small outer moon of Mars, with the NASA 3D model of its irregular shape and its real-time orbit.'],
  jupiter: ['Jupiter', 'Jupiter', 'Jupiter in 3D, live: the largest planet in the solar system, its cloud bands, its interior and its four large moons.'],
  saturne: ['Saturn', 'Saturn', 'Saturn in 3D, live: the gas giant, its modelled rings and its moons, from Mimas to Titan.'],
  uranus: ['Uranus', 'Uranus', 'Uranus in 3D, live: the ice giant tipped on its side, at its real position in the solar system.'],
  neptune: ['Neptune', 'Neptune', 'Neptune in 3D, live: the most distant planet of the solar system, at its real position around the Sun.'],
  pluton: ['Pluto', 'Pluto', 'Pluto in 3D, live: the dwarf planet at the edge of the solar system, on its tilted, eccentric orbit.'],
  io: ['Io', 'Io', 'Io in 3D, live: the volcanic moon of Jupiter, with the NASA map of its surface and its real-time orbit.'],
  europe: ['Europa', 'Europa', 'Europa in 3D, live: the icy moon of Jupiter and its ocean beneath the ice, with the NASA map of its surface.'],
  ganymede: ['Ganymede', 'Ganymede', 'Ganymede in 3D, live: the largest moon in the solar system, orbiting Jupiter, with the NASA map of its surface.'],
  callisto: ['Callisto', 'Callisto', 'Callisto in 3D, live: the heavily cratered moon of Jupiter, with the NASA map of its surface.'],
  mimas: ['Mimas', 'Mimas', 'Mimas in 3D, live: the small moon of Saturn and its huge Herschel crater, with the NASA map of its surface.'],
  encelade: ['Enceladus', 'Enceladus', 'Enceladus in 3D, live: the moon of Saturn with ice geysers, with the NASA map of its surface.'],
  tethys: ['Tethys', 'Tethys', 'Tethys in 3D, live: the icy moon of Saturn, with the NASA map of its surface and its real-time orbit.'],
  dione: ['Dione', 'Dione', 'Dione in 3D, live: the moon of Saturn with ice cliffs, with the NASA map of its surface.'],
  rhea: ['Rhea', 'Rhea', 'Rhea in 3D, live: the second-largest moon of Saturn, with the NASA map of its surface.'],
  titan: ['Titan', 'Titan', 'Titan in 3D, live: the largest moon of Saturn, the only moon in the solar system with a thick atmosphere.'],
  japet: ['Iapetus', 'Iapetus', 'Iapetus in 3D, live: the two-faced moon of Saturn, one side bright and one dark, with the NASA map of its surface.'],
  miranda: ['Miranda', 'Miranda', 'Miranda in 3D, live: the small moon of Uranus with chaotic terrain, flown by Voyager 2 in 1986, at its real position.'],
  ariel: ['Ariel', 'Ariel', 'Ariel in 3D, live: the brightest moon of Uranus, cut by valleys, flown by Voyager 2 in 1986, at its real position.'],
  umbriel: ['Umbriel', 'Umbriel', 'Umbriel in 3D, live: the darkest moon of Uranus, covered with ancient craters, flown by Voyager 2 in 1986.'],
  titania: ['Titania', 'Titania', 'Titania in 3D, live: the largest moon of Uranus, cut by canyons, flown by Voyager 2 in 1986, at its real position.'],
  oberon: ['Oberon', 'Oberon', 'Oberon in 3D, live: the outermost large moon of Uranus, heavily cratered, flown by Voyager 2 in 1986.'],
  triton: ['Triton', 'Triton', 'Triton in 3D, live: the largest moon of Neptune, on its retrograde orbit, flown by Voyager 2 in 1989.'],
  charon: ['Charon', 'Charon', 'Charon in 3D, live: the large moon of Pluto, flown by New Horizons in 2015, at its real position.'],
  galerie: ['Gallery', 'the gallery', 'The Gobai Space gallery: NASA images and videos of the planets, dwarf planets, giants and their moons, sorted by body.'],
  node: ['Node Open Source', 'Node Open Source', 'Node Open Source: the data sources and open projects behind Gobai Space, from NASA Trek maps to IGN and Sentinel-2 imagery.'],
  'faire-un-don': ['Donate to the developer of the Gobai app', 'donations', 'Support the developer of the Gobai app: a card donation helps keep the 3D solar system free, ad-free and online.'],
};

/** Titre (H1) anglais : « Jupiter in 3D, live » pour un astre, titre propre pour une fenêtre. */
const headingEn = (fr: BodyPage, name: string, label: string): string => {
  // Fenêtres : titres écrits à la main.
  if (fr.slug === 'galerie') return 'Gallery of solar system images';
  if (fr.slug === 'node') return 'Node Open Source: data sources';
  if (fr.slug === 'faire-un-don') return name;
  // Astres : nom (avec article en tête de phrase) suivi de « in 3D, live ».
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} in 3D, live`;
};

/** Toutes les pages anglaises, dans l'ordre des pages françaises (astres puis fenêtres). */
export const ENGLISH_PAGES: EnglishPage[] = [...BODY_PAGES, ...WINDOW_PAGES].flatMap((fr) => {
  // Textes anglais de cette page.
  const t = EN[fr.slug];
  // Adresse anglaise.
  const slug = EN_SLUG_OF[fr.slug];
  // Pas de traduction : pas de page anglaise.
  if (!t || !slug) return [];
  // Page anglaise.
  const [name, label, description] = t;
  return [{ fr, slug, name, label, heading: headingEn(fr, name, label), description }];
});

// Table adresse anglaise → page.
const BY_EN_SLUG = new Map(ENGLISH_PAGES.map((p) => [p.slug, p]));

/** Adresse anglaise d'une page française (accueil si absente). */
export function englishUrlFor(frSlug: string | null): string {
  // Adresse complète du chemin anglais.
  return `${SITE_URL}${englishPathFor(frSlug)}`;
}

/**
 * Chemin → page anglaise : « /en » et « /en/ » donnent { page: null } (accueil), « /en/Moon/ » donne la page de la
 * Lune, tout autre chemin undefined. Majuscules et barre finale tolérées (la redirection 301 les corrige).
 */
export function englishPageFor(path: string): { page: EnglishPage | null } | undefined {
  // /en, /en/ ou /en/<un segment>, en ignorant la casse.
  const m = /^\/en(?:\/([^/]*))?\/?$/i.exec(path);
  // Autre chemin.
  if (!m) return undefined;
  // Pas de segment : accueil.
  if (!m[1]) return { page: null };
  // Segment décodé, en minuscules.
  let seg = m[1];
  try { seg = decodeURIComponent(seg); } catch { return undefined; }
  // Page connue, ou undefined.
  const page = BY_EN_SLUG.get(seg.toLowerCase());
  return page ? { page } : undefined;
}

// Rend un texte inoffensif dans du HTML.
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Coupe un texte à la limite sans couper un mot.
const fit = (value: string, limit: number): string => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).replace(/\s+\S*$/, '').trim()}…`;
};
// Remplace le contenu d'une balise meta (name ou property).
const meta = (html: string, key: string, value: string): string =>
  html.replace(new RegExp(`(<meta\\s+(?:name|property)="${key}"\\s+content=")[^"]*(")`), (_m, a: string, b: string) => a + value + b);

/** Page anglaise complète (HTML) : accueil si `page` vaut null. */
export function renderEnglishPage(template: string, page: EnglishPage | null): string {
  // Adresse anglaise et adresse française jumelle.
  const url = page ? `${EN_HOME_URL}/${page.slug}` : EN_HOME_URL;
  const frUrl = page ? `${SITE_URL}/${page.fr.slug}` : `${SITE_URL}/`;
  // Fenêtre (galerie, Node, dons) ?
  const isWindow = page?.fr.kind === 'fenêtre';
  // Titre de l'onglet.
  const titleText = fit(page ? (isWindow ? `${page.name} | Gobai Space` : `${page.name} in 3D | 3D Solar System · Gobai Space`) : `3D Solar System, live · ${APP_NAME} (Gobai Space)`, 60);
  // Description.
  const descriptionText = fit(page ? page.description : 'Free live 3D solar system: explore the Sun, the planets and their moons at 1:1 scale, with Earth in satellite imagery and NASA maps.', 155);
  // Mots-clés anglais du catalogue SEO.
  const keywords = [EN_KEYWORD, ...seoKeywordsForPage(page ? page.fr.slug : '/', 'en', 12)].filter((v, i, all) => all.indexOf(v) === i);
  // Chiffres et FAQ (astres seulement).
  const facts = page && !isWindow ? BODY_FACTS_EN.get(page.fr.slug) ?? [] : [];
  const questions = page && !isWindow ? bodyQuestionsEn(page.label, facts) : HOME_FAQ;
  // Image de partage.
  const ogImage = page && !isWindow ? `${SITE_URL}/og/${page.fr.slug}.jpg` : `${SITE_URL}/og-image.jpg`;
  const ogAlt = esc(page && !isWindow ? `${page.name}: illustration, 3D solar system ${APP_NAME}` : `3D solar system · ${APP_NAME}`);
  // Textes rendus inoffensifs.
  const title = esc(titleText);
  const description = esc(descriptionText);

  // Langue du document.
  let html = template.replace(/<html lang="[^"]*"/, '<html lang="en"');
  // Titre.
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  // Adresse canonique.
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, (_m, a: string, b: string) => a + url + b);
  // Versions linguistiques : français, anglais, et le français par défaut.
  html = html.replace(/(<link\s+rel="alternate"\s+hreflang="(fr|en|x-default)"\s+href=")[^"]*(")/g, (_m, a: string, lang: string, b: string) => a + (lang === 'en' ? url : frUrl) + b);
  // Balises meta.
  html = meta(html, 'description', description);
  html = meta(html, 'keywords', esc(keywords.join(', ')));
  html = meta(html, 'og:locale', 'en_US');
  html = meta(html, 'og:url', url);
  html = meta(html, 'og:title', title);
  html = meta(html, 'og:description', description);
  html = meta(html, 'og:image', ogImage);
  html = meta(html, 'og:image:alt', ogAlt);
  html = meta(html, 'twitter:title', title);
  html = meta(html, 'twitter:description', description);
  html = meta(html, 'twitter:image', ogImage);
  html = meta(html, 'twitter:image:alt', ogAlt);

  // Texte de départ lu par les moteurs : remplacé en entier par sa version anglaise.
  const parts: string[] = [];
  // Titre et premier paragraphe.
  parts.push(`<h1>${esc(page ? page.heading : `3D Solar System, live: ${APP_NAME}`)}</h1>`);
  parts.push(`<p>${page ? description : `<strong>Gobai Space</strong> is a real-time 3D solar system at 1:1 scale that you explore right in your browser. Free and ad-free.`}</p>`);
  // Accueil : présentation et liens vers chaque page anglaise.
  if (!page) {
    parts.push('<h2>Explore the solar system in 3D</h2>');
    parts.push('<p>The Sun, the eight planets, Pluto and their moons are placed at their real current position, computed with Kepler’s laws. Zoom from the whole solar system down to the surface of a planet, on desktop or phone, with nothing to install.</p>');
    parts.push(`<h2>Solar system bodies in 3D</h2>\n        <nav class="seo-links" aria-label="Bodies">${ENGLISH_PAGES.map((p) => `<a href="${EN_HOME_URL}/${p.slug}">${esc(p.fr.kind === 'fenêtre' ? p.name : `${p.name} in 3D`)}</a>`).join('')}</nav>`);
  }
  // Chiffres.
  if (facts.length) parts.push(`<h2>${esc(page!.name)} in numbers</h2>\n        <ul>${facts.map((f) => `<li>${esc(f.label)}: ${esc(f.value)}</li>`).join('')}</ul>`);
  // Astres liés (planète mère ou satellites).
  if (page && !isWindow) {
    const related = relatedEn(page);
    if (related.length) parts.push(`<h2>${page.fr.kind === 'satellite' ? 'Parent planet' : 'Natural satellites'}</h2>\n        <ul>${related.map((p) => `<li><a href="${EN_HOME_URL}/${p.slug}">${esc(p.name)} in 3D</a></li>`).join('')}</ul>`);
  }
  // FAQ.
  if (questions.length) parts.push(`<h2>${page ? `Frequently asked questions about ${esc(page.label)}` : 'Frequently asked questions'}</h2>\n${questions.map((q) => `        <h3>${esc(q.question)}</h3>\n        <p>${esc(q.answer)}</p>`).join('\n')}`);
  // Lien vers la version française.
  parts.push(`<p><a href="${frUrl}" hreflang="fr" lang="fr">Version française</a></p>`);
  // Message de chargement.
  parts.push('<p>Loading the application…</p>');
  // Remplace tout le contenu de départ.
  html = html.replace(/(<main class="seo-shell">)[\s\S]*?(<\/main>)/, (_m, a: string, b: string) => `${a}\n        ${parts.join('\n        ')}\n      ${b}`);

  // Données structurées du modèle : la FAQ française de l'accueil est retirée.
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, a: string, json: string, c: string) => {
    try {
      const data = JSON.parse(json) as { '@graph'?: { '@type'?: string }[] };
      if (!Array.isArray(data['@graph'])) return m;
      data['@graph'] = data['@graph'].filter((node) => node['@type'] !== 'FAQPage');
      return `${a}${JSON.stringify(data).replace(/</g, '\\u003c')}${c}`;
    } catch { return m; }
  });
  // Données structurées anglaises : fil d'Ariane, page, sujet (astre) et FAQ.
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: EN_KEYWORD, item: EN_HOME_URL },
        ...(page ? [{ '@type': 'ListItem', position: 2, name: page.name, item: url }] : []),
      ],
    },
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: titleText, description: descriptionText, inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` }, primaryImageOfPage: ogImage,
      ...(page && !isWindow ? {
        about: {
          '@type': 'Thing', name: page.name, description: descriptionText,
          additionalProperty: facts.map((f) => ({ '@type': 'PropertyValue', name: f.label, value: f.value })),
        },
      } : {}),
    },
  ];
  if (questions.length) {
    graph.push({
      '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: 'en',
      mainEntity: questions.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
    });
  }
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  html = html.replace('</head>', () => `<script type="application/ld+json">${json}</script>\n  </head>`);
  // Page complète.
  return html;
}

/** FAQ de l'accueil anglais. */
const HOME_FAQ = [
  { question: 'Is Gobai Space free?', answer: 'Yes. Gobai Space is free, ad-free and runs in the browser with nothing to install.' },
  { question: 'Are the planet positions real?', answer: 'Yes. Every planet and moon is placed at its real current position, computed from its orbital elements with Kepler’s laws.' },
  { question: 'Does it work on a phone?', answer: 'Yes. The 3D solar system works on desktop and on recent phones, from the iPhone 15 and equivalent Android models.' },
];

/** Pages anglaises liées : planète mère d'un satellite, ou satellites d'une planète. */
function relatedEn(page: EnglishPage): EnglishPage[] {
  // Satellite : sa planète mère, lue dans le premier chiffre (« Natural satellite of Jupiter »).
  const type = BODY_FACTS_EN.get(page.fr.slug)?.find((f) => f.key === 'type')?.value ?? '';
  const parent = /^Natural satellite of (.+)$/.exec(type)?.[1];
  if (parent) return ENGLISH_PAGES.filter((p) => p.name === parent);
  // Planète : les satellites qui la nomment.
  return ENGLISH_PAGES.filter((p) => (BODY_FACTS_EN.get(p.fr.slug)?.find((f) => f.key === 'type')?.value ?? '') === `Natural satellite of ${page.name}`);
}
