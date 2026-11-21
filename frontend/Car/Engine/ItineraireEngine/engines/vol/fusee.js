// Moteur 3D « Fusée » : Fusée : arc suborbital, apogée à 200 km.
import { createFlightEngine } from '../../flightEngine.js';

export const fusee = createFlightEngine({
  id: 'fusee', label: 'Fusée', color: '#fb8c00', glyph: '🚀', shape: 'fusee', cruiseKm: 200, profile: (u) => Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7, speedKmh: 25000,
});
