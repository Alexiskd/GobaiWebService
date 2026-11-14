// Fonction testée.
import { publicUrl } from './public-url';

// Groupe de tests de publicUrl.
describe('publicUrl', () => {
  // Premier test : Render et développement.
  it('donne l’adresse du site sur Render, localhost en développement', () => {
    // Avec la variable RENDER, le résultat doit être l'adresse du site.
    expect(publicUrl(10000, { RENDER: 'true' })).toBe('https://www.gobaispace.com');
    // Sans aucune variable, le résultat doit être localhost avec le port donné.
    expect(publicUrl(3001, {})).toBe('http://localhost:3001');
  // Fin du premier test.
  });

  // Second test : PUBLIC_URL est prioritaire.
  it('PUBLIC_URL passe avant tout, sans barre finale', () => {
    // Même sur Render, PUBLIC_URL l'emporte ; ses espaces et sa barre finale doivent être retirés.
    expect(publicUrl(3001, { RENDER: 'true', PUBLIC_URL: ' https://exemple.com/ ' })).toBe('https://exemple.com');
  // Fin du second test.
  });
// Fin du groupe.
});
