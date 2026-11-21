// Moteur 3D « Ballon » : Ballon : montée lente à 3 km, dérive, descente lente.
import { climbCruiseDescent, createFlightEngine } from '../../flightEngine.js';

export const ballon = createFlightEngine({
  id: 'ballon', label: 'Ballon', color: '#ab47bc', glyph: '🎈', shape: 'ballon', cruiseKm: 3, profile: climbCruiseDescent(0.35, 0.35), speedKmh: 25,
});
