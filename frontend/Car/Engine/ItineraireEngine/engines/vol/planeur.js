// Moteur 3D « Planeur » : Planeur : lancé en altitude, plané jusqu'à l'atterrissage.
import { climbCruiseDescent, createFlightEngine, smoothstep } from '../../flightEngine.js';

export const planeur = createFlightEngine({
  id: 'planeur', label: 'Planeur', color: '#43a047', glyph: '🪂', shape: 'planeur', cruiseKm: 3, profile: (u) => Math.max(0, 1 - Math.min(1, Math.max(0, u)))**0.8 * smoothstep(u / 0.05), speedKmh: 110,
});
