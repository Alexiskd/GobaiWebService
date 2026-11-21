// Fonction testée.
import { parseVolcanoes } from './volcanoes.service';

// Groupe de tests : la lecture de la réponse d'EONET.
describe('volcans en éruption (NASA EONET)', () => {
  // Test : un événement complet.
  it('garde l’identifiant, le nom, la dernière position et la fiche source', () => {
    // Réponse d'essai : un volcan avec deux positions.
    const json = { events: [{
      // Identifiant et titre.
      id: 'EONET_1', title: 'Stromboli Volcano, Italy',
      // Source.
      sources: [{ id: 'SIVolcano', url: 'https://volcano.si.edu/volcano.cfm?vn=211040' }],
      // Deux positions : la plus récente est la dernière.
      geometry: [
        // Ancienne position.
        { type: 'Point', date: '2026-01-01T00:00:00Z', coordinates: [15.0, 38.0] },
        // Position récente.
        { type: 'Point', date: '2026-06-01T00:00:00Z', coordinates: [15.213, 38.789] },
      // Fin des positions.
      ],
    // Fin de la réponse.
    }] };
    // Résultat attendu : un volcan à sa dernière position.
    expect(parseVolcanoes(json)).toEqual([{
      // Ses champs.
      id: 'EONET_1', name: 'Stromboli Volcano, Italy', lon: 15.213, lat: 38.789, date: '2026-06-01T00:00:00Z', link: 'https://volcano.si.edu/volcano.cfm?vn=211040',
    // Fin du résultat.
    }]);
  // Fin du test.
  });

  // Test : les événements inutilisables.
  it('ignore les événements sans nom, sans point ou hors du globe, et les réponses inattendues', () => {
    // Réponse d'essai : trois événements inutilisables.
    const json = { events: [
      // Sans titre.
      { id: 'A', geometry: [{ type: 'Point', coordinates: [1, 2] }] },
      // Sans position ponctuelle.
      { id: 'B', title: 'B', geometry: [{ type: 'Polygon', coordinates: [[[1, 2]]] }] },
      // Latitude impossible.
      { id: 'C', title: 'C', geometry: [{ type: 'Point', coordinates: [10, 120] }] },
    // Fin des événements.
    ] };
    // Aucun volcan gardé.
    expect(parseVolcanoes(json)).toEqual([]);
    // Réponse vide ou inattendue : aucun volcan.
    expect(parseVolcanoes(null)).toEqual([]);
    // Réponse sans liste d'événements : aucun volcan.
    expect(parseVolcanoes({ events: 'x' })).toEqual([]);
  // Fin du test.
  });
// Fin du groupe.
});
