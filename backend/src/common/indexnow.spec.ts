// Fonctions testées.
import { INDEXNOW_ENDPOINT, indexNowKey, indexNowUrls, submitIndexNow } from './indexnow';

// Groupe de tests d'IndexNow.
describe('IndexNow', () => {
  // Activation.
  it('n’est actif que sur Render, hors prévisualisation, avec une clé valide', () => {
    // Production avec clé.
    expect(indexNowKey({ RENDER: 'true', INDEXNOW_KEY: ' abcd1234ef ' })).toBe('abcd1234ef');
    // Sans Render.
    expect(indexNowKey({ INDEXNOW_KEY: 'abcd1234ef' })).toBeNull();
    // Prévisualisation.
    expect(indexNowKey({ RENDER: 'true', IS_PULL_REQUEST: 'true', INDEXNOW_KEY: 'abcd1234ef' })).toBeNull();
    // Clé trop courte.
    expect(indexNowKey({ RENDER: 'true', INDEXNOW_KEY: 'abc' })).toBeNull();
  // Fin du test.
  });

  // Adresses.
  it('soumet l’accueil et les pages du sitemap, sans doublon', () => {
    // Liste.
    const urls = indexNowUrls();
    // Accueil en tête.
    expect(urls[0]).toBe('https://www.gobaispace.com/');
    // Une page d'astre et une fenêtre.
    expect(urls).toContain('https://www.gobaispace.com/mars');
    expect(urls).toContain('https://www.gobaispace.com/galerie');
    // Sans doublon.
    expect(new Set(urls).size).toBe(urls.length);
  // Fin du test.
  });

  // Envoi.
  it('envoie hôte, clé, emplacement de la clé et adresses, et ne lève jamais', async () => {
    // Faux fetch qui garde la requête.
    const sent: { url?: string; body?: Record<string, unknown> } = {};
    const fake = (async (url: string, init: { body: string }) => { sent.url = url; sent.body = JSON.parse(init.body); return { status: 202 }; }) as unknown as typeof fetch;
    // Accepté.
    expect(await submitIndexNow('abcd1234ef', ['https://www.gobaispace.com/mars'], fake)).toBe(202);
    // Contenu envoyé.
    expect(sent.url).toBe(INDEXNOW_ENDPOINT);
    expect(sent.body).toEqual({ host: 'www.gobaispace.com', key: 'abcd1234ef', keyLocation: 'https://www.gobaispace.com/abcd1234ef.txt', urlList: ['https://www.gobaispace.com/mars'] });
    // Erreur réseau : 0.
    const broken = (async () => { throw new Error('réseau'); }) as unknown as typeof fetch;
    expect(await submitIndexNow('abcd1234ef', [], broken)).toBe(0);
  // Fin du test.
  });
// Fin du groupe.
});
