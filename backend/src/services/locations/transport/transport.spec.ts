// Vols et trains : lecture des réponses, aéroport le plus proche, liens de réservation.
import {
  MAX_OFFERS, aviasalesUrl, nearestAirport, navitiaDate, parisNow, parseAirports, parseFlights, parseTrainJourneys, toNavitiaDate,
} from './transport';

const AIRPORTS = parseAirports([
  { code: 'CDG', city_code: 'PAR', name: 'Charles de Gaulle', coordinates: { lat: 49.0097, lon: 2.5479 }, flightable: true, iata_type: 'airport' },
  { code: 'NCE', city_code: 'NCE', name: 'Nice Côte d’Azur', coordinates: { lat: 43.6584, lon: 7.2159 }, flightable: true, iata_type: 'airport' },
  { code: 'XPG', city_code: 'PAR', name: 'Gare du Nord', coordinates: { lat: 48.88, lon: 2.355 }, flightable: true, iata_type: 'railway' },
  { code: 'ZZZ', name: 'Fermé', coordinates: { lat: 48.9, lon: 2.3 }, flightable: false },
]);

describe('transport', () => {
  it('ne garde que les aéroports ouverts aux vols', () => {
    expect(AIRPORTS.map((a) => a.code)).toEqual(['CDG', 'NCE']);
  });

  it('trouve l’aéroport le plus proche, et rien au-delà de 300 km', () => {
    expect(nearestAirport({ lat: 48.99, lon: 2.09 }, AIRPORTS)?.cityCode).toBe('PAR');
    expect(nearestAirport({ lat: 40.71, lon: -74.0 }, AIRPORTS)).toBeNull();
  });

  it('ajoute l’identifiant d’affilié au lien Aviasales', () => {
    expect(aviasalesUrl('/search/PAR0512NCE1?t=abc', '12345')).toBe('https://www.aviasales.com/search/PAR0512NCE1?t=abc&marker=12345');
    expect(aviasalesUrl('https://pirate.example/x', '1')).toBe('https://www.aviasales.com/?marker=1');
  });

  it('lit les prix des vols, triés du moins cher au plus cher', () => {
    const offers = parseFlights({
      success: true, currency: 'eur',
      data: [
        { price: 89, airline: 'AF', flight_number: '7700', origin_airport: 'ORY', destination_airport: 'NCE', departure_at: '2026-12-05T07:00:00+01:00', transfers: 0, duration_to: 85, link: '/search/x' },
        { price: 49, airline: 'U2', flight_number: '4011', origin_airport: 'CDG', destination_airport: 'NCE', departure_at: '2026-12-05T09:10:00+01:00', transfers: 0, duration_to: 90, link: '/search/y' },
        { price: 0, departure_at: '2026-12-05T10:00:00+01:00' },
      ],
    }, 'm');
    expect(offers.map((o) => o.price)).toEqual([49, 89]);
    expect(offers[0]).toMatchObject({ currency: 'EUR', airline: 'U2', durationMinutes: 90, bookingUrl: 'https://www.aviasales.com/search/y?marker=m' });
    expect(parseFlights({ success: false }, 'm')).toEqual([]);
  });

  it('convertit les dates Navitia', () => {
    expect(navitiaDate('20261205T074500')).toBe('2026-12-05T07:45:00');
    expect(navitiaDate('demain')).toBe('');
    expect(toNavitiaDate('2026-12-05')).toBe('20261205T060000');
  });

  it('lit les trajets SNCF et ignore ceux sans train', () => {
    const journeys = parseTrainJourneys({
      journeys: [
        {
          departure_date_time: '20261205T074500', arrival_date_time: '20261205T133000', duration: 20700, nb_transfers: 0,
          co2_emission: { value: 1520.4, unit: 'gEC' },
          sections: [
            { type: 'street_network' },
            { type: 'public_transport', display_informations: { commercial_mode: 'TGV INOUI', headsign: '6173' }, from: { name: 'Paris Gare de Lyon' }, to: { name: 'Nice Ville' } },
          ],
        },
        { departure_date_time: '20261205T080000', arrival_date_time: '20261205T090000', duration: 3600, sections: [{ type: 'street_network' }] },
      ],
    });
    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toMatchObject({ durationMinutes: 345, trains: ['TGV INOUI 6173'], from: 'Paris Gare de Lyon', to: 'Nice Ville', co2Grams: 1520 });
    expect(journeys.length).toBeLessThanOrEqual(MAX_OFFERS);
  });
});

describe('parisNow', () => {
  it('donne la date de Paris, pas celle de UTC', () => {
    // 22 nov. 2026 à 23 h 30 UTC = 23 nov. à 0 h 30 à Paris (UTC+1).
    expect(parisNow(Date.UTC(2026, 10, 22, 23, 30))).toEqual({ date: '2026-11-23', dateTime: '2026-11-23T00:30' });
    expect(toNavitiaDate('2026-11-23T00:30')).toBe('20261123T003000');
  });
});
