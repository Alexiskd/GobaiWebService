// Moteur 2D « Train » : Train : courbes très douces, gares marquées.
import { createGroundEngine } from '../../groundEngine.js';

export const train = createGroundEngine({
  id: 'train', label: 'Train', color: '#455a64', glyph: '🚆', smooth: 3, width: 5, dash: [14, 6], stops: true, speedKmh: 120,
});
