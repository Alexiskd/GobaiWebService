// Fonctions testées : les votes et le classement des placements.
import { hotScore, netScore, placementStatus, sortContributions } from './ranking';

// Groupe de tests.
describe('ranking', () => {
  // Test : le score net.
  it('compte le score net', () => {
    // Voix pour moins voix contre.
    expect(netScore({ up: 5, down: 2 })).toBe(3);
    expect(netScore({ up: 0, down: 4 })).toBe(-4);
  // Fin du test.
  });

  // Test : l'état d'un placement.
  it('ne tranche qu’à partir de trois voix', () => {
    // Trop peu de voix.
    expect(placementStatus({ up: 1, down: 0 })).toBe('attente');
    expect(placementStatus({ up: 0, down: 2 })).toBe('attente');
    // Nettement approuvé (70 % et plus).
    expect(placementStatus({ up: 3, down: 0 })).toBe('valide');
    expect(placementStatus({ up: 7, down: 3 })).toBe('valide');
    // Nettement refusé (40 % et moins).
    expect(placementStatus({ up: 1, down: 4 })).toBe('conteste');
    // Partagé : toujours en attente.
    expect(placementStatus({ up: 3, down: 3 })).toBe('attente');
  // Fin du test.
  });

  // Test : les trois tris.
  it('trie par populaire, récent et meilleur', () => {
    // Trois placements : un vieux très approuvé, un tout neuf sans voix, un récent apprécié.
    const now = Date.now();
    const items = [
      { id: 'vieux', up: 40, down: 0, createdAt: new Date(now - 7 * 86_400_000) },
      { id: 'neuf', up: 0, down: 0, createdAt: new Date(now) },
      { id: 'recent', up: 6, down: 1, createdAt: new Date(now - 3_600_000) },
    ];
    // Le plus récent d'abord.
    expect(sortContributions(items, 'recent').map((i) => i.id)).toEqual(['neuf', 'recent', 'vieux']);
    // Le meilleur score net d'abord.
    expect(sortContributions(items, 'meilleur').map((i) => i.id)).toEqual(['vieux', 'recent', 'neuf']);
    // Populaire : l'âge fait redescendre le vieux placement, même très approuvé.
    expect(sortContributions(items, 'populaire').map((i) => i.id)).toEqual(['recent', 'neuf', 'vieux']);
    // La liste d'origine n'est pas modifiée.
    expect(items.map((i) => i.id)).toEqual(['vieux', 'neuf', 'recent']);
  // Fin du test.
  });

  // Test : le score populaire.
  it('fait peser les premières voix plus que les suivantes', () => {
    // Même date, scores différents.
    const at = new Date();
    // Dix voix valent plus qu'une.
    expect(hotScore({ up: 10, down: 0 }, at)).toBeGreaterThan(hotScore({ up: 1, down: 0 }, at));
    // Mais pas dix fois plus : l'écart de 1 à 10 vaut une décade, comme de 10 à 100.
    const gap1 = hotScore({ up: 10, down: 0 }, at) - hotScore({ up: 1, down: 0 }, at);
    const gap2 = hotScore({ up: 100, down: 0 }, at) - hotScore({ up: 10, down: 0 }, at);
    expect(gap1).toBeCloseTo(gap2, 6);
    // Un placement contesté passe sous un placement sans voix publié au même instant.
    expect(hotScore({ up: 0, down: 5 }, at)).toBeLessThan(hotScore({ up: 0, down: 0 }, at));
  // Fin du test.
  });
// Fin du groupe.
});
