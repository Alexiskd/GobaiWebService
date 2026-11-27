// Lecture du modèle index.html.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Fonctions testées.
import { ENGLISH_PAGES, englishPageFor, renderEnglishPage } from './body-pages-en';
import { BODY_PAGES, WINDOW_PAGES } from './body-pages';

// Modèle : index.html du frontend.
const template = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'frontend', 'index.html'), 'utf8');

// Groupe de tests de la version anglaise.
describe('version anglaise', () => {
  // Une page anglaise par page française.
  it('a une jumelle anglaise pour chaque page française', () => {
    expect(ENGLISH_PAGES).toHaveLength(BODY_PAGES.length + WINDOW_PAGES.length);
  });

  // Adresses.
  it('reconnaît /en et /en/<page>, casse et barre finale comprises', () => {
    expect(englishPageFor('/en')).toEqual({ page: null });
    expect(englishPageFor('/EN/Moon/')?.page?.fr.slug).toBe('lune');
    expect(englishPageFor('/en/inconnu')).toBeUndefined();
    expect(englishPageFor('/energie')).toBeUndefined();
  });

  // Rendu d'une page.
  it('rend la page de la Lune en anglais, reliée à sa jumelle française', () => {
    const html = renderEnglishPage(template, englishPageFor('/en/moon')!.page);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('<link rel="canonical" href="https://www.gobaispace.com/en/moon"');
    expect(html).toContain('hreflang="fr" href="https://www.gobaispace.com/lune"');
    expect(html).toContain('hreflang="x-default" href="https://www.gobaispace.com/lune"');
    expect(html).toContain('<li>Mean diameter: 3,475 km</li>');
    expect(html).toContain('Frequently asked questions about the Moon');
    expect(html).not.toContain('Questions fréquentes');
  });
});
