// Moteur 2D « Voiture » : Voiture : suit la route, peu lissée.
import { createGroundEngine } from '../../groundEngine.js';

export const voiture = createGroundEngine({
  id: 'voiture', label: 'Voiture', color: '#1565c0', glyph: '🚗', smooth: 1, width: 5, dash: [], stops: false, speedKmh: 70,
});
