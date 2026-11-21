// Moteur 3D « Drone » : Drone : vol très bas, 120 m.
import { climbCruiseDescent, createFlightEngine } from '../../flightEngine.js';

export const drone = createFlightEngine({
  id: 'drone', label: 'Drone', color: '#00acc1', glyph: '🛸', shape: 'rotor', cruiseKm: 0.12, profile: climbCruiseDescent(0.06, 0.06), speedKmh: 50,
});
