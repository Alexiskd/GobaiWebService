// Moteur 2D « Marche » : Piéton : tracé en pointillés, courbe douce.
import { createGroundEngine } from '../../groundEngine.js';

export const marche = createGroundEngine({
  id: 'marche', label: 'Marche', color: '#2e7d32', glyph: '🚶', smooth: 1, width: 4, dash: [2, 6], stops: false, speedKmh: 5,
});
