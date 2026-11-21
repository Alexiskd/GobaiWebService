// Moteur 2D « Autre (au sol) » : Moyen inconnu au sol : tracé neutre.
import { createGroundEngine } from '../../groundEngine.js';

export const autreSol = createGroundEngine({
  id: 'autre-sol', label: 'Autre (au sol)', color: '#757575', glyph: '📍', smooth: 1, width: 4, dash: [], stops: false, speedKmh: 30,
});
