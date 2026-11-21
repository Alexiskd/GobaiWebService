// Moteur 2D « Bateau » : Bateau : courbes larges sur l'eau.
import { createGroundEngine } from '../../groundEngine.js';

export const bateau = createGroundEngine({
  id: 'bateau', label: 'Bateau', color: '#0277bd', glyph: '🚢', smooth: 3, width: 5, dash: [12, 6], stops: false, speedKmh: 30,
});
