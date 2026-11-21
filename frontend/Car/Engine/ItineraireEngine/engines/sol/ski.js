// Moteur 2D « Ski » : Ski : traces longues et fluides.
import { createGroundEngine } from '../../groundEngine.js';

export const ski = createGroundEngine({
  id: 'ski', label: 'Ski', color: '#4fc3f7', glyph: '⛷️', smooth: 3, width: 4, dash: [], stops: false, speedKmh: 25,
});
