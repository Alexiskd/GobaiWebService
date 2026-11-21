// Moteur 3D « Hélicoptère » : Hélicoptère : vol bas, montée et descente rapides.
import { climbCruiseDescent, createFlightEngine } from '../../flightEngine.js';

export const helicoptere = createFlightEngine({
  id: 'helicoptere', label: 'Hélicoptère', color: '#e53935', glyph: '🚁', shape: 'rotor', cruiseKm: 0.6, profile: climbCruiseDescent(0.08, 0.08), speedKmh: 220,
});
