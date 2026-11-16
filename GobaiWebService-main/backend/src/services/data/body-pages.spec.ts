// Chiffres et fonctions de mise en forme testés.
import { BODY_FACTS, bodyQuestions, duration, fr, ofLabel } from './body-facts';
// Pages et fonctions de rendu testées.
import { BODY_PAGES, WINDOW_PAGES, bodyPageFor, markdownPageFor, renderBodyMarkdown, renderBodyPage, renderLlmsFull } from './body-pages';
// readFileSync : lit un fichier en entier.
import { readFileSync } from 'fs';
// join : assemble des morceaux de chemin.
import { join } from 'path';

// Modèle : le vrai index.html du frontend.
const template = readFileSync(join(__dirname, '../../../../frontend/index.html'), 'utf8');
// Fonction page : la page d'une adresse (le « ! » affirme qu'elle existe).
const page = (slug: string) => bodyPageFor(`/${slug}`)!;
// Fonction graphs : les blocs de données structurées d'un HTML,
const graphs = (html: string): { '@graph': { '@type': string }[] }[] =>
  // trouvés un par un et lus en JSON.
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

// Groupe de tests des pages des astres.
describe('pages des astres (référencement et assistants IA)', () => {
  // Premier test : nombres et durées.
  it('écrit les nombres et les durées en français', () => {
    // Séparateur de milliers.
    expect(fr(12742)).toBe('12 742');
    // Virgule décimale.
    expect(fr(5.43, 2)).toBe('5,43');
    // Moins de 2 jours : en heures.
    expect(duration(0.4135)).toBe('9,9 heures');
    // En jours, avec 2 décimales.
    expect(duration(27.321661)).toBe('27,32 jours');
    // Au-delà de 100 jours : sans décimale.
    expect(duration(686.98)).toBe('687 jours');
    // Une durée négative s'écrit sans signe.
    expect(duration(-243)).toBe('243 jours');
    // Au-delà de 2 ans : en années.
    expect(duration(29.46 * 365.25)).toBe('29,46 ans');
  // Fin du test.
  });

  // Deuxième test : la tournure « de ».
  it('accorde « de » avec le nom de l’astre', () => {
    // Devant « la ».
    expect(ofLabel('la Terre')).toBe('de la Terre');
    // « de le » devient « du ».
    expect(ofLabel('le Soleil')).toBe('du Soleil');
    // Devant une voyelle.
    expect(ofLabel('Io')).toBe('d’Io');
    // Devant une consonne.
    expect(ofLabel('Mars')).toBe('de Mars');
    // Devant une voyelle accentuée.
    expect(ofLabel('Obéron')).toBe('d’Obéron');
  // Fin du test.
  });

  // Troisième test : les chiffres.
  it('donne des chiffres cohérents aux planètes et aux satellites', () => {
    // Fonction value : la valeur d'un chiffre d'une page.
    const value = (slug: string, key: string) => BODY_FACTS.get(slug)!.find((f) => f.key === key)!.value;
    // Diamètre de la Terre.
    expect(value('terre', 'diameter')).toBe('12 742 km');
    // Durée de l'orbite de la Terre.
    expect(value('terre', 'orbit')).toBe('365 jours');
    // Distance de Mars au Soleil.
    expect(value('mars', 'distance')).toBe('1,52 UA (227,9 millions de km)');
    // Rotation de Vénus, rétrograde.
    expect(value('venus', 'rotation')).toBe('243 jours, rétrograde');
    // Distance de la Lune.
    expect(value('lune', 'distance')).toBe('384 400 km');
    // Orbite de Triton, rétrograde.
    expect(value('triton', 'orbit')).toBe('5,88 jours, en sens rétrograde');
    // Type de Titan.
    expect(value('titan', 'type')).toBe('Satellite naturel de Saturne');
    // Type d'Ariel, avec l'élision.
    expect(value('ariel', 'type')).toBe('Satellite naturel d’Uranus');
    // Phobos n'a pas de chiffres.
    expect(BODY_FACTS.has('phobos')).toBe(false);
    // Toutes les autres pages d'astres en ont, sauf Phobos et Deimos.
    for (const p of BODY_PAGES) if (!['phobos', 'deimos'].includes(p.slug)) expect(BODY_FACTS.has(p.slug)).toBe(true);
  // Fin du test.
  });

  // Quatrième test : les questions.
  it('tire des questions des chiffres', () => {
    // Questions de Mars.
    const q = bodyQuestions('Mars', BODY_FACTS.get('mars')!);
    // La question sur la distance au Soleil est présente.
    expect(q.map((x) => x.question)).toContain('À quelle distance du Soleil se trouve Mars ?');
    // Réponse sur la pesanteur de Mars.
    expect(q.find((x) => x.question.includes('pesanteur'))!.answer).toBe('La pesanteur de Mars est de 3,71 m/s².');
    // Pour Jupiter, la réponse précise le niveau de 1 bar.
    expect(bodyQuestions('Jupiter', BODY_FACTS.get('jupiter')!).find((x) => x.question.includes('pesanteur'))!.answer).toContain('1 bar');
    // Réponse sur le diamètre de Mars.
    expect(q.find((x) => x.question === 'Quel est le diamètre de Mars ?')!.answer).toBe('Le diamètre moyen de Mars est de 6 779 km.');
    // Pour la Lune, la distance est celle à sa planète.
    expect(bodyQuestions('la Lune', BODY_FACTS.get('lune')!)[1].answer).toBe('La Lune orbite en moyenne à 384 400 km du centre de sa planète.');
  // Fin du test.
  });

  // Cinquième test : la page d'un astre.
  it('rend la page d’un astre : chiffres, FAQ de l’astre, données structurées valides', () => {
    // Rend la page de Mars.
    const html = renderBodyPage(template, page('mars'));
    // Elle a le sous-titre des chiffres.
    expect(html).toContain('<h2>Mars en chiffres</h2>');
    // Et le diamètre dans la liste.
    expect(html).toContain('<li>Diamètre moyen : 6 779 km</li>');
    // Elle a la FAQ de Mars.
    expect(html).toContain('<h2>Questions fréquentes sur Mars</h2>');
    // Elle n'a plus la FAQ de l'accueil.
    expect(html).not.toContain('Gobai Space est-il gratuit');
    // Elle pointe vers sa version Markdown.
    expect(html).toContain('href="https://www.gobaispace.com/mars.md"');
    // Elle garde le paragraphe « Chargement ».
    expect(html).toContain('<p>Chargement de l’application…</p>');
    // Types des éléments de chaque bloc de données structurées.
    const types = graphs(html).map((g) => g['@graph'].map((n) => n['@type']));
    // Premier bloc : celui du site, sans FAQ ; second bloc : fil d'Ariane, page et FAQ de l'astre.
    expect(types).toEqual([['WebSite', 'WebApplication', 'Person'], ['BreadcrumbList', 'WebPage', 'FAQPage']]);
  // Fin du test.
  });

  // Sixième test : pages sans chiffres.
  it('rend une fenêtre et un astre sans chiffres sans FAQ', () => {
    // Pour une fenêtre et pour un astre sans chiffres :
    for (const slug of ['galerie', 'phobos']) {
      // rend la page ;
      const html = renderBodyPage(template, page(slug));
      // elle n'a pas de FAQ ;
      expect(html).not.toContain('Questions fréquentes');
      // et son second bloc n'a que le fil d'Ariane et la page.
      expect(graphs(html)[1]['@graph'].map((n) => n['@type'])).toEqual(['BreadcrumbList', 'WebPage']);
    // Fin de la boucle.
    }
  // Fin du test.
  });

  // Septième test : l'accueil.
  it('laisse la FAQ générale sur l’accueil', () => {
    // Le modèle d'origine garde sa FAQ générale.
    expect(graphs(template)[0]['@graph'].map((n) => n['@type'])).toContain('FAQPage');
  // Fin du test.
  });

  // Huitième test : le Markdown.
  it('sert chaque page en Markdown et le site entier en un texte', () => {
    // Une adresse en .md donne la page.
    expect(markdownPageFor('/mars.md')!.slug).toBe('mars');
    // La casse est ignorée.
    expect(markdownPageFor('/Titan.md')!.slug).toBe('titan');
    // Une page inconnue : rien.
    expect(markdownPageFor('/inconnu.md')).toBe(undefined);
    // Sans l'extension .md : rien.
    expect(markdownPageFor('/mars')).toBe(undefined);
    // Markdown de Mars.
    const md = renderBodyMarkdown(page('mars'));
    // Il commence par le titre.
    expect(md).toMatch(/^# Mars en 3D et en direct\n/);
    // Il contient la pesanteur.
    expect(md).toContain('- Pesanteur : 3,71 m/s²');
    // Et l'adresse de la page.
    expect(md).toContain('Page : https://www.gobaispace.com/mars');
    // Jamais trois retours à la ligne de suite.
    expect(md).not.toMatch(/\n{3,}/);
    // Une fenêtre n'a pas de section de chiffres.
    expect(renderBodyMarkdown(page('galerie'))).not.toContain('en chiffres');
    // Texte complet du site, avec un faux résumé.
    const full = renderLlmsFull('# Résumé\n');
    // Il commence par le résumé.
    expect(full).toMatch(/^# Résumé\n/);
    // Il a une partie pour le résumé et une par page.
    expect(full.split('\n---\n').length).toBe(1 + BODY_PAGES.length + WINDOW_PAGES.length);
  // Fin du test.
  });
// Fin du groupe.
});
