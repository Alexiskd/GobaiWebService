// Fonctions testées.
import { LIGHTNING_LIMIT, lightningCell, lightningStats, parseXweatherLightning, strikeConfidence, strikeToEvent, xweatherLightningUrl } from './lightning';

// Instant d'essai.
const T = Date.UTC(2026, 10, 15, 15, 0);
// Réponse d'essai au format de l'API Xweather Lightning (champs documentés) : un impact nuage-sol négatif, un
// intra-nuage positif sans heure en millisecondes, un enregistrement sans position.
const RESPONSE = { success: true, error: null, response: [
  // Nuage-sol, courant négatif, 5 capteurs.
  { id: 'a1', loc: { lat: 45.1, long: 5.2 }, ob: { timestamp: T / 1000, timestampMS: T, pulse: { type: 'cg', peakamp: -23000, numSensors: 5, chiSquare: 1.1 } } },
  // Intra-nuage, courant positif, heure en secondes seulement.
  { id: 'a2', loc: { lat: 45.12, long: 5.21 }, ob: { timestamp: T / 1000 - 30, pulse: { type: 'IC', peakamp: 8000, numSensors: 1, chiSquare: 9 } } },
  // Sans position : ignoré.
  { id: 'a3', ob: { timestamp: T / 1000 } },
// Fin de la réponse.
] };

// Groupe de tests : la foudre (Xweather Lightning).
describe('foudre : impacts Xweather Lightning', () => {
  // Test : la lecture.
  it('lit position, heure, nature, polarité, capteurs et chi², ignore les impacts illisibles', () => {
    // Lecture.
    const { strikes, error } = parseXweatherLightning(RESPONSE);
    // Deux impacts, sans erreur.
    expect([strikes.length, error]).toEqual([2, null]);
    // Premier : nuage-sol.
    expect(strikes[0]).toEqual({ id: 'a1', lon: 5.2, lat: 45.1, t: T, type: 'cg', peakAmp: -23000, sensors: 5, chi: 1.1 });
    // Second : intra-nuage (nature en majuscules), heure en secondes convertie.
    expect([strikes[1].type, strikes[1].t]).toEqual(['ic', T - 30_000]);
  // Fin du test.
  });

  // Test : les erreurs de l'API.
  it('rend le message d’erreur de l’API (accès refusé) sans impact', () => {
    // Réponse d'erreur.
    expect(parseXweatherLightning({ success: false, error: { code: 'insufficient_scope', description: 'Access to the lightning endpoint is not available' } })).toEqual({ strikes: [], error: 'Access to the lightning endpoint is not available' });
    // Réponse vide ou inattendue.
    expect(parseXweatherLightning(null)).toEqual({ strikes: [], error: null });
  // Fin du test.
  });

  // Test : la confiance et le format commun.
  it('rend un impact observé au format commun, avec sa polarité et sa nature', () => {
    // Impacts lus.
    const [cg, ic] = parseXweatherLightning(RESPONSE).strikes;
    // Confiance : 5 capteurs sûrs, 1 capteur avec chi² élevé moins sûr.
    expect([strikeConfidence(cg), strikeConfidence(ic)]).toEqual([0.9, 0.4]);
    // Événement.
    const e = strikeToEvent(cg, '2026-11-15T15:00:05.000Z');
    // Famille, statut, nature, polarité, intensité.
    expect([e.type, e.status, e.details.kind, e.details.polarity, e.intensity.value]).toEqual(['lightning', 'observé', 'nuage-sol', 'négative', 23000]);
  // Fin du test.
  });

  // Test : les statistiques.
  it('calcule fréquence, densité, natures, polarités et zones actives', () => {
    // Quatre impacts dans la même cellule de 0,1°, un ailleurs.
    const near = Array.from({ length: 4 }, (_, i) => ({ id: `n${i}`, lon: 5.21, lat: 45.11, t: T, type: 'cg' as const, peakAmp: -1000, sensors: 3, chi: 1 }));
    // Statistiques sur 100 km et 5 min.
    const st = lightningStats([...near, { id: 'f', lon: 6, lat: 46, t: T, type: 'ic', peakAmp: 500, sensors: 3, chi: 1 }]);
    // Nombres.
    expect([st.count, st.cg, st.ic, st.negative, st.positive, st.perMin]).toEqual([5, 4, 1, 4, 1, 1]);
    // Densité : 5 impacts sur π × 100² km².
    expect(st.densityPerKm2).toBeCloseTo(5 / (Math.PI * 10000), 6);
    // Une zone active de 4 impacts.
    expect(st.zones).toEqual([{ lon: 5.21, lat: 45.11, count: 4 }]);
    // Limite atteinte : signalée.
    expect(lightningStats(new Array(LIGHTNING_LIMIT).fill(near[0])).truncated).toBe(true);
  // Fin du test.
  });

  // Test : la cellule partagée et l'adresse.
  it('arrondit le point visé au demi-degré et forme l’adresse de la requête', () => {
    // Arrondi.
    expect(lightningCell(5.26, 45.74)).toEqual({ lon: 5.5, lat: 45.5, key: '5.5,45.5' });
    // Au-delà de l'antiméridien : ramené à l'ouest.
    expect(lightningCell(181.2, 0).lon).toBe(-179);
    // Adresse : action closest, point (latitude, longitude), rayon, limite.
    expect(xweatherLightningUrl('ID', 'SECRET', 5.5, 45.5)).toBe('https://data.api.xweather.com/lightning/closest?p=45.5%2C5.5&radius=100km&limit=1000&client_id=ID&client_secret=SECRET');
  // Fin du test.
  });
// Fin du groupe.
});
