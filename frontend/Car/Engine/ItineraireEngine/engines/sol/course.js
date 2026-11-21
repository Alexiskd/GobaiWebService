// Moteur 2D « Course à pied » : Coureur : pointillés serrés.
import { createGroundEngine } from '../../groundEngine.js';

export const course = createGroundEngine({
  id: 'course', label: 'Course à pied', color: '#ef6c00', glyph: '🏃', smooth: 1, width: 4, dash: [8, 4], stops: false, speedKmh: 10,
});
