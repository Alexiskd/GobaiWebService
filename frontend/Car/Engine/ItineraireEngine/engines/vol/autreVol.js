// Moteur 3D « Autre (aérien) » : Engin aérien inconnu : profil de vol générique.
import { climbCruiseDescent, createFlightEngine } from '../../flightEngine.js';

export const autreVol = createFlightEngine({
  id: 'autre-vol', label: 'Autre (aérien)', color: '#7e57c2', glyph: '🛩️', shape: 'point', cruiseKm: 5, profile: climbCruiseDescent(0.2, 0.2), speedKmh: 300,
});
