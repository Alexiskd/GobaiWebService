// Fonctions testées : lecture des positions courantes.
import { parseGdacsCyclones, parseHemisphere, parseNhcStorms, parseUtc } from './cyclone-sources';
// Fonctions testées : fusion des cyclones.
import { CYCLONE_MAX_AGE_MS, bearingDeg, mergeCyclones, movementOf, normalizeStormName, saffirSimpson } from './cyclones';
// Type des trajectoires.
import { StormTrack } from './eonet';

// Entité GDACS réelle (cyclone PENA-26, novembre 2026), propriétés utiles.
const GDACS = { type: 'FeatureCollection', features: [
  // Cyclone courant.
  { type: 'Feature', geometry: { type: 'Point', coordinates: [-173.4, 9.8] }, properties: {
    // Type, identifiants et noms.
    eventtype: 'TC', eventid: 1001348, episodeid: 24, eventname: 'PENA-26', name: 'Tropical Cyclone PENA-26',
    // Alerte, état courant, dates (UTC sans fuseau), agence.
    alertlevel: 'Green', iscurrent: 'true', fromdate: '2026-11-06T21:00:00', todate: '2026-11-12T15:00:00', datemodified: '2026-11-12T14:52:09', source: 'NOAA',
    // Sévérité : vent maximal en km/h.
    severitydata: { severity: 92.592, severitytext: 'Tropical Depression (maximum wind speed of 93 km/h)', severityunit: 'km/h' },
    // Adresses.
    url: { report: 'https://www.gdacs.org/report.aspx?eventid=1001348' },
  // Fin des propriétés.
  } },
  // Cyclone ancien, plus courant : ignoré.
  { type: 'Feature', geometry: { type: 'Point', coordinates: [100, 10] }, properties: { eventtype: 'TC', eventid: 1, eventname: 'OLD-26', iscurrent: 'false', todate: '2026-01-01T00:00:00' } },
// Fin de la collection.
] };

// Trajectoire d'essai : deux positions à 6 h d'écart, cap vers l'ouest.
const track = (name: string, lon: number, lat: number, t: number, windKt: number): StormTrack => ({
  // Fournisseur, clé, nom, agence, fiche.
  provider: 'eonet-storms', key: name, name, agencies: ['JTWC'], url: null,
  // Deux positions : 1° plus à l'est 6 h avant.
  points: [{ lon: lon + 1, lat, t: t - 6 * 3_600_000, windKt: windKt - 5 }, { lon, lat, t, windKt }],
// Fin de la trajectoire.
});

// Groupe de tests : le CycloneEngine, partie données.
describe('cyclones : lecture, fusion entre fournisseurs, catégories', () => {
  // Test : les catégories.
  it('classe le vent soutenu selon Saffir-Simpson', () => {
    // Bornes de chaque classe.
    expect([20, 34, 63, 64, 83, 96, 113, 137, null].map((w) => saffirSimpson(w).code)).toEqual(['TD', 'TS', 'TS', 'C1', 'C2', 'C3', 'C4', 'C5', 'NC']);
  // Fin du test.
  });

  // Test : les noms.
  it('normalise les noms publiés par les agences', () => {
    // Typhon, tempête, suffixe GDACS, accents, restes d'un cyclone.
    expect(['Typhoon Cempaka', 'Tropical Storm Pena', 'PENA-26', 'Tropical Cyclone PENA-26', 'Remnants of Hurricane Éva', 'Tropical Depression 31W'].map(normalizeStormName)).toEqual(['CEMPAKA', 'PENA', 'PENA', 'PENA', 'EVA', '31W']);
  // Fin du test.
  });

  // Test : les formats NHC et GDACS.
  it('lit les positions NHC (hémisphères en lettres) et GDACS (UTC sans fuseau, cyclones courants seulement)', () => {
    // « 65.0W » : −65.
    expect([parseHemisphere('28.7N'), parseHemisphere('65.0W'), parseHemisphere('x')]).toEqual([28.7, -65, null]);
    // Heure GDACS lue en UTC.
    expect(parseUtc('2026-11-12T15:00:00')).toBe(Date.UTC(2026, 10, 12, 15));
    // GDACS : un seul cyclone courant.
    const g = parseGdacsCyclones(GDACS);
    // Nom, position, vent (≈ 50 kt), alerte, agence.
    expect([g.length, g[0].name, g[0].lon, g[0].lat, Math.round(g[0].windKt!), g[0].alertLevel, g[0].agency]).toEqual([1, 'PENA-26', -173.4, 9.8, 50, 'Green', 'NOAA']);
    // NHC : champs numériques absents, textes à la place.
    const n = parseNhcStorms({ activeStorms: [{ id: 'al052026', name: 'Ernesto', classification: 'HU', intensity: '75', pressure: '977', latitude: '28.7N', longitude: '65.0W', lastUpdate: '2026-08-16T21:00:00.000Z' }] });
    // Position, vent, pression.
    expect([n[0].lon, n[0].lat, n[0].windKt, n[0].pressureMb, n[0].classification]).toEqual([-65, 28.7, 75, 977, 'HU']);
    // Hors saison : liste vide.
    expect(parseNhcStorms({ activeStorms: [] })).toEqual([]);
  // Fin du test.
  });

  // Test : le déplacement estimé.
  it('estime le cap et la vitesse depuis les deux dernières positions', () => {
    // Plein ouest le long de l'équateur.
    expect(Math.round(bearingDeg(1, 0, 0, 0))).toBe(270);
    // 1° de longitude à l'équateur en 6 h : environ 18,5 km/h.
    expect(movementOf(track('X', 0, 0, Date.UTC(2026, 10, 14), 50).points)).toEqual({ dirDeg: 270, speedKmh: 19 });
    // Une seule position : pas de déplacement.
    expect(movementOf([{ lon: 0, lat: 0, t: 0, windKt: null }])).toBeNull();
  // Fin du test.
  });

  // Test : la fusion.
  it('réunit EONET et GDACS par le nom, garde toutes les provenances, signale une contradiction de vent', () => {
    // Instant de référence : 3 h après le relevé GDACS.
    const now = Date.UTC(2026, 10, 12, 18);
    // Trajectoire EONET : Pena à 30 kt à 12 h.
    const eonet = [track('Tropical Storm Pena', -173.2, 9.8, Date.UTC(2026, 10, 12, 12), 30)];
    // Relevé GDACS à 15 h : 50 kt (contradiction de 20 kt, plus de 20 %).
    const gdacs = parseGdacsCyclones(GDACS);
    // Fusion.
    const { cyclones, excluded } = mergeCyclones(eonet, gdacs, { gdacs: '2026-11-12T16:00:00.000Z' }, now);
    // Un seul cyclone, aucun écarté.
    expect([cyclones.length, excluded.length]).toEqual([1, 0]);
    // Le cyclone.
    const c = cyclones[0];
    // Position la plus récente : celle de GDACS.
    expect([c.lon, c.lat]).toEqual([-173.4, 9.8]);
    // Deux fournisseurs.
    expect(c.sources.map((s) => s.provider).sort()).toEqual(['eonet-storms', 'gdacs']);
    // Vent courant : celui du relevé le plus récent (GDACS), catégorie tempête tropicale.
    expect([c.details.windKt, c.details.category]).toEqual([50, 'TS']);
    // Contradiction signalée.
    expect(c.flags.some((f) => f.startsWith('contradiction'))).toBe(true);
    // Trajectoire observée : une ligne.
    expect(c.geometry.type).toBe('LineString');
    // Hémisphère nord : rotation antihoraire.
    expect(c.details.hemisphere).toBe('nord');
  // Fin du test.
  });

  // Test : les données périmées et les cyclones distincts.
  it('écarte un cyclone sans position récente, ne confond pas deux cyclones nommés proches', () => {
    // Instant de référence.
    const now = Date.UTC(2026, 10, 15, 12);
    // Cempaka : dernière position il y a 4 jours.
    const old = track('Typhoon Cempaka', 154.1, 30.2, Date.UTC(2026, 10, 11, 12), 65);
    // Deux cyclones nommés à 300 km l'un de l'autre, positions récentes.
    const a = track('Typhoon Alpha', 130, 20, now - 3_600_000, 90), b = track('Typhoon Beta', 132.5, 21, now - 3_600_000, 70);
    // Fusion.
    const { cyclones, excluded } = mergeCyclones([old, a, b], [], {}, now);
    // Alpha et Beta restent distincts.
    expect(cyclones.map((c) => c.name)).toEqual(['Typhoon Alpha', 'Typhoon Beta']);
    // Cempaka écarté, avec sa raison.
    expect([excluded[0].name, excluded[0].reason]).toEqual(['Typhoon Cempaka', 'dernière position il y a 96 h']);
    // Seuil : 36 heures.
    expect(CYCLONE_MAX_AGE_MS).toBe(36 * 3_600_000);
  // Fin du test.
  });
// Fin du groupe.
});
