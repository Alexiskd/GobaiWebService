// Moteur 2D « Vélo » : Vélo : trait continu lissé, pistes et routes.
import { createGroundEngine } from '../../groundEngine.js';

export const velo = createGroundEngine({
  id: 'velo', label: 'Vélo', color: '#00897b', glyph: '🚴', smooth: 2, width: 4, dash: [], stops: false, speedKmh: 16,
});
