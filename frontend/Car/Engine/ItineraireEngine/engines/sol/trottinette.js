// Moteur 2D « Trottinette » : Trottinette : trait lissé interrompu.
import { createGroundEngine } from '../../groundEngine.js';

export const trottinette = createGroundEngine({
  id: 'trottinette', label: 'Trottinette', color: '#8e24aa', glyph: '🛴', smooth: 2, width: 4, dash: [10, 4], stops: false, speedKmh: 15,
});
