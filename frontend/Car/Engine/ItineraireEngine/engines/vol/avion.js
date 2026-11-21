// Moteur 3D « Avion » : Avion de ligne : montée, croisière à 11 km, descente.
import { climbCruiseDescent, createFlightEngine } from '../../flightEngine.js';

export const avion = createFlightEngine({
  id: 'avion', label: 'Avion', color: '#1e88e5', glyph: '✈️', shape: 'avion', cruiseKm: 11, profile: climbCruiseDescent(0.15, 0.15), speedKmh: 800,
});
