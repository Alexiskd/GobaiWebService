// Moteur 2D « Métro » : Métro : tracé droit entre les stations.
import { createGroundEngine } from '../../groundEngine.js';

export const metro = createGroundEngine({
  id: 'metro', label: 'Métro', color: '#6a1b9a', glyph: '🚇', smooth: 0, width: 6, dash: [], stops: true, speedKmh: 30,
});
