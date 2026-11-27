// Fonctions testées.
import { canonicalRedirect, canonicalRedirectEnabled } from './canonical-url';

// Fabrique une requête GET sur un hôte et une adresse donnés (hôte officiel par défaut).
const get = (originalUrl: string, host = 'www.gobaispace.com') => ({ method: 'GET', host, originalUrl });

// Groupe de tests de canonicalRedirect.
describe('canonicalRedirect', () => {
  // Les bonnes adresses ne bougent pas.
  it('laisse passer les adresses déjà officielles', () => {
    // Accueil.
    expect(canonicalRedirect(get('/'))).toBeNull();
    // Page d'astre du sitemap.
    expect(canonicalRedirect(get('/mars'))).toBeNull();
    // Page de fenêtre du sitemap.
    expect(canonicalRedirect(get('/galerie'))).toBeNull();
    // Fichier du site.
    expect(canonicalRedirect(get('/legal/mentions-legales.html'))).toBeNull();
    // Hôte en majuscules avec un port : c'est quand même l'hôte officiel.
    expect(canonicalRedirect(get('/mars', 'WWW.GobaiSpace.com:443'))).toBeNull();
  // Fin du test.
  });

  // Autres hôtes.
  it('redirige les autres hôtes vers www.gobaispace.com, chemin et paramètres gardés', () => {
    // Adresse Render.
    expect(canonicalRedirect(get('/jupiter?x=1', 'gobai-space.onrender.com'))).toBe('https://www.gobaispace.com/jupiter?x=1');
    // Domaine sans www.
    expect(canonicalRedirect(get('/', 'gobaispace.com'))).toBe('https://www.gobaispace.com/');
  // Fin du test.
  });

  // Variantes d'une page d'astre.
  it('ramène les variantes d’une page d’astre à son adresse du sitemap', () => {
    // Majuscule.
    expect(canonicalRedirect(get('/Mars'))).toBe('https://www.gobaispace.com/mars');
    // Barre finale.
    expect(canonicalRedirect(get('/saturne/'))).toBe('https://www.gobaispace.com/saturne');
    // Accent encodé.
    expect(canonicalRedirect(get('/ganym%C3%A8de'))).toBe('https://www.gobaispace.com/ganymede');
  // Fin du test.
  });

  // Barre finale ailleurs.
  it('retire la barre finale des autres chemins sans extension', () => {
    // Chemin de deux segments.
    expect(canonicalRedirect(get('/legal/'))).toBe('https://www.gobaispace.com/legal');
  // Fin du test.
  });

  // Exclusions.
  it('ne touche jamais à l’API, à /.well-known ni aux écritures', () => {
    // API sur l'adresse Render (sonde de santé).
    expect(canonicalRedirect(get('/api/health', 'gobai-space.onrender.com'))).toBeNull();
    // Fichier Android.
    expect(canonicalRedirect(get('/.well-known/assetlinks.json', 'gobaispace.com'))).toBeNull();
    // POST sur un autre hôte.
    expect(canonicalRedirect({ method: 'POST', host: 'gobaispace.com', originalUrl: '/mars' })).toBeNull();
  // Fin du test.
  });
// Fin du groupe.
});

// Groupe de tests de canonicalRedirectEnabled.
describe('canonicalRedirectEnabled', () => {
  // Cas d'activation.
  it('active seulement sur Render, hors prévisualisation et interrupteur coupé', () => {
    // Production Render.
    expect(canonicalRedirectEnabled({ RENDER: 'true' })).toBe(true);
    // Développement.
    expect(canonicalRedirectEnabled({})).toBe(false);
    // Prévisualisation Render.
    expect(canonicalRedirectEnabled({ RENDER: 'true', IS_PULL_REQUEST: 'true' })).toBe(false);
    // Interrupteur manuel.
    expect(canonicalRedirectEnabled({ RENDER: 'true', CANONICAL_REDIRECT: 'off' })).toBe(false);
  // Fin du test.
  });
// Fin du groupe.
});
