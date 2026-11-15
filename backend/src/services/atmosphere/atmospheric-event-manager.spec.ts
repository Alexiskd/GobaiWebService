// Format commun et outils testés.
import { AtmosphericEvent, combineConfidence, haversineKm, isLonLat, makeEventId, mergeProvenance } from './atmospheric-event';
// Gestionnaire et filtrage testés.
import { AtmosphericEventManager, finalizeEvents, inBbox } from './atmospheric-event-manager';
// Déduplication testée.
import { dedupEvents } from './event-dedup';

// Instant de référence des tests.
const NOW = Date.UTC(2026, 10, 15, 12);

// ev : un événement d'essai, champs remplacés par `o`.
const ev = (o: Partial<AtmosphericEvent> & { provider?: string }): AtmosphericEvent => ({
  // Identifiant, famille, nom.
  id: 'x', type: 'wildfire', name: null,
  // Position et géométrie.
  lon: 0, lat: 0, geometry: { type: 'Point', coordinates: [0, 0] }, altitudeM: null,
  // Heures : il y a une heure.
  detectedAt: new Date(NOW - 3_600_000).toISOString(), validFrom: new Date(NOW - 3_600_000).toISOString(), validTo: null,
  // Intensité, confiance.
  intensity: { value: 10, unit: 'ha', label: null }, confidence: 0.9,
  // Provenance.
  sources: [{ provider: o.provider ?? 'eonet-wildfires', sourceId: o.id ?? 'x', url: null, observedAt: null, fetchedAt: '' }],
  // Résolution, statut, confirmation, alertes, détails.
  resolution: { spatialM: null, temporalS: null }, status: 'observé', confirmed: true, flags: [], details: {},
  // Champs remplacés.
  ...o,
// Fin de l'événement.
});

// Groupe de tests : le format commun.
describe('format commun des événements atmosphériques', () => {
  // Test : les outils.
  it('contrôle les coordonnées, mesure les distances, combine les confiances, réunit les provenances', () => {
    // Coordonnées.
    expect([isLonLat(10, 20), isLonLat(200, 0), isLonLat(NaN, 0), isLonLat('1', 2)]).toEqual([true, false, false, false]);
    // Paris–Londres : environ 344 km.
    expect(Math.round(haversineKm(2.3522, 48.8566, -0.1276, 51.5072))).toBe(344);
    // Deux sources à 0,6 et 0,5 : 0,8 ; jamais la certitude.
    expect([combineConfidence([0.6, 0.5]), combineConfidence([1, 1])]).toEqual([0.8, 0.99]);
    // Identifiant nettoyé.
    expect(makeEventId('cyclone', 'multi', 'PENA 2026/a')).toBe('cyclone:multi:PENA_2026_a');
    // Provenances sans doublon.
    expect(mergeProvenance([{ provider: 'a', sourceId: '1', url: null, observedAt: null, fetchedAt: '' }], [{ provider: 'a', sourceId: '1', url: 'u', observedAt: null, fetchedAt: '' }, { provider: 'b', sourceId: '1', url: null, observedAt: null, fetchedAt: '' }]).map((p) => p.provider)).toEqual(['a', 'b']);
  // Fin du test.
  });
// Fin du groupe.
});

// Groupe de tests : déduplication et gestionnaire.
describe('AtmosphericEventManager', () => {
  // Test : la déduplication.
  it('réunit deux déclarations du même incendie, garde les provenances et les deux mesures', () => {
    // Même feu déclaré par deux agences, à 2 km d'écart.
    const a = ev({ id: 'a', lon: 10, lat: 45, provider: 'eonet-wildfires' }), b = ev({ id: 'b', lon: 10.02, lat: 45.01, provider: 'gdacs-wf', intensity: { value: 30, unit: 'ha', label: null } });
    // Feu lointain.
    const c = ev({ id: 'c', lon: 20, lat: 45 });
    // Déduplication à 5 km.
    const out = dedupEvents([a, b, c], { radiusKm: 5, windowMs: 3 * 86_400_000 });
    // Deux incendies.
    expect(out).toHaveLength(2);
    // Le premier réunit deux provenances.
    expect(out[0].sources.map((s) => s.provider)).toEqual(['eonet-wildfires', 'gdacs-wf']);
    // Deux mesures gardées pour comparaison.
    expect((out[0].details.readings as unknown[]).length).toBe(2);
    // Confiance combinée de deux sources indépendantes.
    expect(out[0].confidence).toBe(0.99);
  // Fin du test.
  });

  // Test : le filtrage.
  it('écarte les événements périmés, peu sûrs, sans source ou hors du globe, et dit pourquoi', () => {
    // Liste : un bon, un périmé (30 jours), un peu sûr, un sans source, un hors du globe.
    const { shown, excluded } = finalizeEvents([
      // Bon.
      ev({ id: 'ok' }),
      // Périmé.
      ev({ id: 'vieux', detectedAt: new Date(NOW - 30 * 86_400_000).toISOString() }),
      // Peu sûr.
      ev({ id: 'faible', confidence: 0.2, lon: 50 }),
      // Sans source.
      ev({ id: 'orphelin', sources: [], lon: 60 }),
      // Hors du globe.
      ev({ id: 'ailleurs', lat: 120 }),
    // Fin de la liste.
    ], NOW);
    // Un seul gardé.
    expect(shown.map((e) => e.id)).toEqual(['ok']);
    // Quatre écartés, chacun avec sa raison.
    expect(excluded.map((x) => x.reason.split(' ')[0])).toEqual(['donnée', 'confiance', 'aucune', 'position']);
  // Fin du test.
  });

  // Test : le gestionnaire.
  it('garde un instantané par calque, filtre par famille et par emprise, compte les contradictions', () => {
    // Gestionnaire.
    const m = new AtmosphericEventManager();
    // Calque des incendies : un feu.
    m.update('incendies', [ev({ id: 'f', lon: 10, lat: 45 })], { stale: false, errors: [] }, NOW);
    // Calque des cyclones : un cyclone avec une contradiction, fournisseur en panne.
    m.update('cyclones', [ev({ id: 'c', type: 'cyclone', name: 'Pena', lon: -173, lat: 10, flags: ['contradiction : vent'] })], { stale: true, errors: ['gdacs : HTTP 503'] }, NOW);
    // Famille.
    expect(m.query({ types: ['cyclone'] }).map((e) => e.id)).toEqual(['c']);
    // Emprise à cheval sur l'antiméridien.
    expect(m.query({ bbox: [170, 0, -170, 20] }).map((e) => e.id)).toEqual(['c']);
    // Contrôle : contradictions, péremption et pannes du calque des cyclones.
    const h = m.health().find((x) => x.layer === 'cyclones')!;
    // Une contradiction, périmé, une panne.
    expect([h.contradictions, h.stale, h.errors]).toEqual([1, true, ['gdacs : HTTP 503']]);
    // Emprise ordinaire.
    expect([inBbox(5, 5, [0, 0, 10, 10]), inBbox(15, 5, [0, 0, 10, 10])]).toEqual([true, false]);
  // Fin du test.
  });
// Fin du groupe.
});
