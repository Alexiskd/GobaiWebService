// Fonctions testées.
import { NM_KM, atcfCoord, atcfTime, meanRadiusKm, parseAtcf } from './atcf';
// Fusion des prévisions dans les cyclones.
import { FORECAST_MAX_AGE_MS, attachForecasts, nhcForecastUrl } from './cyclones';
// Format commun.
import { AtmosphericEvent } from './atmospheric-event';

// Fichier ATCF d'essai, au format documenté (abrdeck) : une ancienne prévision, une ligne d'une autre technique, puis
// la prévision officielle de 12 h UTC (échéance 0 avec trois seuils de rayons, échéance 12 h, échéance 24 h en cercle entier).
const FST = [
  // Ancienne prévision officielle (6 h UTC) : ignorée au profit de la plus récente.
  'AL, 05, 2026081606, 03, OFCL,   0, 280N,  655W,  70,  980, HU,  34, NEQ,  200,  190,  130,  150, 1012,  240,  25,  85,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Autre technique (CARQ) : ignorée.
  'AL, 05, 2026081612, 01, CARQ,   0, 290N,  652W,  75,  977, HU,  34, NEQ,  999,  999,  999,  999, 1012,  240,  25,  90,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Échéance 0, vents de 34 nœuds.
  'AL, 05, 2026081612, 03, OFCL,   0, 290N,  652W,  75,  977, HU,  34, NEQ,  210,  200,  140,  160, 1012,  240,  25,  90,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Échéance 0, vents de 50 nœuds.
  'AL, 05, 2026081612, 03, OFCL,   0, 290N,  652W,  75,  977, HU,  50, NEQ,  110,  100,   60,   80, 1012,  240,  25,  90,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Échéance 0, vents de 64 nœuds.
  'AL, 05, 2026081612, 03, OFCL,   0, 290N,  652W,  75,  977, HU,  64, NEQ,   40,   40,   20,   30, 1012,  240,  25,  90,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Échéance 12 h.
  'AL, 05, 2026081612, 03, OFCL,  12, 312N,  650W,  85,    0, HU,  34, NEQ,  220,  210,  150,  170,    0,    0,   0, 105,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Échéance 24 h, rayon en cercle entier.
  'AL, 05, 2026081612, 03, OFCL,  24, 335N,  642W,  90,    0, HU,  34, AAA,  180,    0,    0,    0,    0,    0,   0, 110,   0,   L,   0,    ,   0,   0,    ERNESTO, D,',
  // Ligne illisible.
  'ligne sans aucun sens',
// Fin du fichier.
].join('\n');

// Groupe de tests : la prévision officielle au format ATCF.
describe('prévision officielle ATCF (NHC)', () => {
  // Test : les champs.
  it('lit les coordonnées en dixièmes de degré et l’heure de base', () => {
    // Nord et ouest.
    expect([atcfCoord('290N'), atcfCoord('652W'), atcfCoord('1234E'), atcfCoord('x')]).toEqual([29, -65.2, 123.4, null]);
    // Heure de base.
    expect(atcfTime('2026081612')).toBe(Date.UTC(2026, 7, 16, 12));
  // Fin du test.
  });

  // Test : le fichier.
  it('garde la prévision officielle la plus récente, ses échéances et ses rayons de vent en kilomètres', () => {
    // Lecture.
    const fc = parseAtcf(FST, 'AL052026')!;
    // Identifiant, nom, heure de base.
    expect([fc.id, fc.name, fc.issuedAt]).toEqual(['al052026', 'ERNESTO', Date.UTC(2026, 7, 16, 12)]);
    // Trois échéances, dans l'ordre.
    expect(fc.points.map((p) => p.tau)).toEqual([0, 12, 24]);
    // Échéance 0 : position, vent, pression.
    expect([fc.points[0].lon, fc.points[0].lat, fc.points[0].windKt, fc.points[0].pressureMb]).toEqual([-65.2, 29, 75, 977]);
    // Rayons des trois seuils, en kilomètres.
    expect(fc.points[0].radiiKm[64]).toEqual([40, 40, 20, 30].map((v) => Math.round(v * NM_KM)));
    // Pression nulle : inconnue.
    expect(fc.points[1].pressureMb).toBeNull();
    // Cercle entier : le même rayon dans les quatre quadrants.
    expect(fc.points[2].radiiKm[34]).toEqual([333, 333, 333, 333]);
    // Heure de validité de l'échéance 24 h.
    expect(fc.points[2].t).toBe(Date.UTC(2026, 7, 17, 12));
    // Rayon moyen des vents de 50 nœuds.
    expect(meanRadiusKm(fc.points[0].radiiKm, 50)).toBe(Math.round(((110 + 100 + 60 + 80) / 4) * NM_KM));
  // Fin du test.
  });

  // Test : les fichiers vides ou inattendus.
  it('ne rend rien pour un fichier vide, d’une autre technique ou illisible', () => {
    // Vide.
    expect(parseAtcf('', 'al01')).toBeNull();
    // Seulement CARQ.
    expect(parseAtcf(FST.split('\n')[1], 'al05')).toBeNull();
  // Fin du test.
  });

  // Test : l'ajout aux cyclones.
  it('attache la prévision au cyclone du NHC (statut prévu, rayons de l’analyse), signale une prévision périmée', () => {
    // Prévision lue.
    const fc = parseAtcf(FST, 'al052026')!;
    // Cyclone d'essai suivi par le NHC.
    const cyclone = { id: 'cyclone:multi:ERNESTO-2026', type: 'cyclone', name: 'Ernesto', lon: -65.2, lat: 29, sources: [{ provider: 'nhc', sourceId: 'al052026', url: null, observedAt: null, fetchedAt: '' }], flags: [], details: { category: 'C1' } } as unknown as AtmosphericEvent;
    // Instant : 2 h après l'émission.
    const [c] = attachForecasts([cyclone], [fc], '2026-08-16T14:00:00.000Z', fc.issuedAt + 2 * 3_600_000);
    // Prévision : statut, émetteur, trois échéances, catégorie de la dernière.
    const forecast = c.details.forecast as { status: string; provider: string; points: { category: string }[] };
    // Contrôle.
    expect([forecast.status, forecast.provider, forecast.points.length, forecast.points[2].category]).toEqual(['prévu', 'nhc-atcf', 3, 'C2']);
    // Rayons de l'analyse, estimés.
    expect([c.details.windRadiiStatus, Object.keys(c.details.windRadiiKm as object)]).toEqual(['estimé', ['34', '50', '64']]);
    // Provenance ajoutée, avec l'adresse du fichier.
    expect(c.sources[1]).toEqual({ provider: 'nhc-atcf', sourceId: 'al052026', url: nhcForecastUrl('al052026'), observedAt: '2026-08-16T12:00:00.000Z', fetchedAt: '2026-08-16T14:00:00.000Z' });
    // Prévision trop ancienne : non attachée, signalée.
    const [old] = attachForecasts([cyclone], [fc], '', fc.issuedAt + FORECAST_MAX_AGE_MS + 3_600_000);
    // Contrôle.
    expect([old.details.forecast, old.flags[0]]).toEqual([undefined, 'prévision NHC périmée (19 h)']);
    // Sans prévision : cyclone inchangé.
    expect(attachForecasts([cyclone], [], '', 0)[0]).toBe(cyclone);
  // Fin du test.
  });
// Fin du groupe.
});
