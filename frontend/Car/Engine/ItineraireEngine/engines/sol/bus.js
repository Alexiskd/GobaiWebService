// Moteur 2D « Bus » : Bus : suit la route, arrêts marqués.
import { createGroundEngine } from '../../groundEngine.js';

export const bus = createGroundEngine({
  id: 'bus', label: 'Bus', color: '#f9a825', glyph: '🚌', smooth: 1, width: 5, dash: [], stops: true, speedKmh: 30,
});
