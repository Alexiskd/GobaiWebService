// Moteur 2D « Tramway » : Tramway : voie lissée, stations marquées.
import { createGroundEngine } from '../../groundEngine.js';

export const tramway = createGroundEngine({
  id: 'tramway', label: 'Tramway', color: '#c2185b', glyph: '🚋', smooth: 2, width: 5, dash: [], stops: true, speedKmh: 20,
});
