// Fonctions testées.
import { nwsAlertsUrl, parseMotion, parseNwsAlerts } from './nws-alerts';

// Instant d'essai.
const NOW = Date.UTC(2026, 4, 29, 2, 40);
// Zone d'essai (polygone fermé, longitude puis latitude).
const RING = [[-97.5, 32.5], [-97.0, 32.5], [-97.0, 32.9], [-97.5, 32.9], [-97.5, 32.5]];
// feature : avertissement d'essai au format de l'API (propriétés et paramètres documentés).
const feature = (props: Record<string, unknown>, params: Record<string, string[]> = {}, geometry: unknown = { type: 'Polygon', coordinates: [RING] }) => ({ id: `https://api.weather.gov/alerts/${String(props.id)}`, type: 'Feature', geometry, properties: { status: 'Actual', messageType: 'Alert', sent: '2026-05-29T02:30:00+00:00', expires: '2026-05-29T03:15:00+00:00', parameters: params, ...props } });

// Groupe de tests : les avertissements du NWS.
describe('orages : avertissements officiels du NWS', () => {
  // Test : déplacement publié.
  it('lit le déplacement publié (direction d’origine retournée, nœuds en km/h, positions)', () => {
    // Texte au format du NWS.
    const m = parseMotion('2026-05-29T02:30:00-00:00...storm...262DEG...38KT...3266 9733 3250 9760');
    // Cap vers lequel va l'orage, vitesse, positions, heure.
    expect(m).toEqual({ bearingDeg: 82, speedKmh: 70, points: [[-97.33, 32.66], [-97.6, 32.5]], at: '2026-05-29T02:30:00.000Z' });
    // Texte illisible : null.
    expect(parseMotion('rien')).toBeNull();
  // Fin du test.
  });

  // Test : lecture des avertissements.
  it('garde les avertissements en vigueur avec zone, écarte annulations, exercices, expirés, sans zone et autres natures', () => {
    // Collection d'essai.
    const json = { features: [
      // Orage violent indiqué par le radar : grêle de 1,75 pouce, rafales de 60 mph, déplacement publié.
      feature({ id: 'svr', event: 'Severe Thunderstorm Warning', headline: 'Severe Thunderstorm Warning issued', senderName: 'NWS Fort Worth TX', areaDesc: 'Tarrant, TX' }, { maxHailSize: ['1.75'], maxWindGust: ['60 MPH'], hailThreat: ['RADAR INDICATED'], thunderstormDamageThreat: ['CONSIDERABLE'], eventMotionDescription: ['2026-05-29T02:30:00-00:00...storm...262DEG...38KT...3266 9733'] }),
      // Tornade observée.
      feature({ id: 'tor', event: 'Tornado Warning' }, { tornadoDetection: ['OBSERVED'] }),
      // Annulation.
      feature({ id: 'can', event: 'Tornado Warning', messageType: 'Cancel' }),
      // Exercice.
      feature({ id: 'tst', event: 'Tornado Warning', status: 'Test' }),
      // Expiré.
      feature({ id: 'old', event: 'Severe Thunderstorm Warning', expires: '2026-05-29T02:00:00+00:00' }),
      // Sans zone.
      feature({ id: 'nogeo', event: 'Severe Thunderstorm Warning' }, {}, null),
      // Autre nature.
      feature({ id: 'flood', event: 'Flood Warning' }),
    // Fin de la collection.
    ] };
    // Lecture.
    const events = parseNwsAlerts(json, '2026-05-29T02:39:00.000Z', NOW);
    // Deux avertissements gardés.
    expect(events.map((e) => e.details.kind)).toEqual(['orage violent', 'tornade']);
    // Orage violent : estimé (radar), confirmé (officiel), grêle en cm, rafales en km/h, déplacement.
    const svr = events[0];
    // Valeurs.
    expect([svr.status, svr.confirmed, svr.confidence, svr.details.hailCm, svr.details.gustKmh, svr.details.detection, svr.details.damageThreat, (svr.details.motion as { bearingDeg: number }).bearingDeg]).toEqual(['estimé', true, 0.85, 4.4, 97, 'radar indicated', 'considerable', 82]);
    // Intensité : la grêle ; centre de la zone ; fin de validité.
    expect([svr.intensity.value, svr.intensity.unit, svr.lon, svr.lat, svr.validTo]).toEqual([4.4, 'cm (grêle)', -97.25, 32.7, '2026-05-29T03:15:00.000Z']);
    // Tornade : observée, confiance 0,95.
    expect([events[1].status, events[1].confidence, events[1].intensity.label]).toEqual(['observé', 0.95, 'Avertissement de tornade']);
  // Fin du test.
  });

  // Test : adresse.
  it('forme l’adresse d’une nature d’avertissement', () => {
    // Adresse encodée.
    expect(nwsAlertsUrl('Tornado Warning')).toBe('https://api.weather.gov/alerts/active?status=actual&event=Tornado%20Warning');
  // Fin du test.
  });
// Fin du groupe.
});
