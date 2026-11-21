// Moteur 2D « Cheval » : Cheval : pointillés, chemins.
import { createGroundEngine } from '../../groundEngine.js';

export const cheval = createGroundEngine({
  id: 'cheval', label: 'Cheval', color: '#795548', glyph: '🐎', smooth: 2, width: 4, dash: [6, 3], stops: false, speedKmh: 20,
});
