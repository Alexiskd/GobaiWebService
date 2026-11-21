// Moteur 2D « Moto » : Moto : trait épais lissé.
import { createGroundEngine } from '../../groundEngine.js';

export const moto = createGroundEngine({
  id: 'moto', label: 'Moto', color: '#d84315', glyph: '🏍️', smooth: 2, width: 5, dash: [], stops: false, speedKmh: 70,
});
