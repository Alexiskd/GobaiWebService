// Fonctions testées.
import { ACRE_HA, centerOf, parseEonetStorms, parseEonetWildfires, toKnots } from './eonet';

// Groupe de tests : la lecture de NASA EONET.
describe('NASA EONET : incendies déclarés et trajectoires de tempêtes', () => {
  // Test : les incendies déclarés.
  it('rend un incendie confirmé à sa dernière position, surface en hectares, agence source', () => {
    // Réponse d'essai : un incendie avec deux relevés.
    const json = { events: [{
      // Identifiant, titre, non clos.
      id: 'EONET_1', title: 'Park Fire, California', closed: null,
      // Agence source.
      sources: [{ id: 'IRWIN', url: 'https://irwin.example/1' }],
      // Deux relevés : le second est le plus récent.
      geometry: [
        // Premier relevé.
        { magnitudeValue: 100, magnitudeUnit: 'acres', date: '2026-11-01T00:00:00Z', type: 'Point', coordinates: [-121.8, 39.9] },
        // Relevé récent.
        { magnitudeValue: 1000, magnitudeUnit: 'acres', date: '2026-11-10T00:00:00Z', type: 'Point', coordinates: [-121.7, 40.0] },
      // Fin des relevés.
      ],
    // Fin de la réponse.
    }] };
    // Lecture.
    const [e] = parseEonetWildfires(json, '2026-11-14T00:00:00.000Z');
    // Famille, statut, confirmation.
    expect([e.type, e.status, e.confirmed]).toEqual(['wildfire', 'observé', true]);
    // Dernière position.
    expect([e.lon, e.lat]).toEqual([-121.7, 40.0]);
    // Début et dernière mise à jour.
    expect([e.validFrom, e.detectedAt]).toEqual(['2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z']);
    // Surface en hectares.
    expect(e.intensity.value).toBe(Math.round(1000 * ACRE_HA));
    // Agence source et provenance.
    expect([e.details.agencies, e.sources[0].provider, e.sources[0].url]).toEqual([['IRWIN'], 'eonet-wildfires', 'https://irwin.example/1']);
  // Fin du test.
  });

  // Test : les géométries.
  it('prend le centre d’un polygone, ignore les géométries illisibles et les réponses inattendues', () => {
    // Carré de 2° autour de (11, 1) (le dernier sommet répète le premier).
    expect(centerOf({ type: 'Polygon', coordinates: [[[10, 0], [12, 0], [12, 2], [10, 2], [10, 0]]] })).toEqual([11, 1]);
    // Point hors du globe.
    expect(centerOf({ type: 'Point', coordinates: [10, 95] })).toBeNull();
    // Réponse inattendue.
    expect(parseEonetWildfires({ events: 'x' }, '')).toEqual([]);
    // Événement sans date.
    expect(parseEonetWildfires({ events: [{ id: 'A', title: 'A', geometry: [{ type: 'Point', coordinates: [1, 1] }] }] }, '')).toEqual([]);
  // Fin du test.
  });

  // Test : les unités de vent.
  it('convertit le vent en nœuds', () => {
    // Nœuds.
    expect(toKnots(65, 'kts')).toBe(65);
    // Kilomètres par heure (GDACS).
    expect(toKnots(92.592, 'km/h')).toBeCloseTo(50, 2);
    // Miles par heure.
    expect(toKnots(115, 'mph')).toBeCloseTo(99.93, 1);
    // Vide ou unité inconnue.
    expect([toKnots('', 'kts'), toKnots(10, 'furlongs')]).toEqual([null, null]);
  // Fin du test.
  });

  // Test : les trajectoires réelles (typhon Cempaka, novembre 2026).
  it('lit la trajectoire d’un typhon, positions triées, vent en nœuds', () => {
    // Réponse d'essai : trois positions publiées dans le désordre.
    const json = { events: [{
      // Identifiant et titre.
      id: 'EONET_26157', title: 'Typhoon Cempaka',
      // Source : JTWC.
      sources: [{ id: 'JTWC', url: 'https://www.metoc.navy.mil/jtwc/products/wp3126.tcw' }],
      // Positions.
      geometry: [
        // Troisième.
        { magnitudeValue: 95.0, magnitudeUnit: 'kts', date: '2026-11-09T18:00:00Z', type: 'Point', coordinates: [136.6, 24.6] },
        // Première.
        { magnitudeValue: 35.0, magnitudeUnit: 'kts', date: '2026-11-07T00:00:00Z', type: 'Point', coordinates: [144.2, 19.1] },
        // Deuxième.
        { magnitudeValue: 50.0, magnitudeUnit: 'kts', date: '2026-11-07T06:00:00Z', type: 'Point', coordinates: [142.9, 19.8] },
      // Fin des positions.
      ],
    // Fin de la réponse.
    }] };
    // Lecture.
    const [tr] = parseEonetStorms(json);
    // Nom, agence, fournisseur.
    expect([tr.name, tr.agencies, tr.provider]).toEqual(['Typhoon Cempaka', ['JTWC'], 'eonet-storms']);
    // Vents dans l'ordre du temps.
    expect(tr.points.map((p) => p.windKt)).toEqual([35, 50, 95]);
  // Fin du test.
  });
// Fin du groupe.
});
