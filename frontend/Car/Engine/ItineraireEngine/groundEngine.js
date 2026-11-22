/**
 * Fabrique des moteurs « sol » (modélisation 2D) : tout ce qui marche, roule, glisse ou navigue en suivant le sol ou l'eau.
 * Chaque moyen de locomotion (une ligne de GROUND_MODES, modeTable.js) donne seulement son style ; le calcul du tracé est commun :
 * les points de l'étape sont lissés (selon le moyen : un train n'a pas la même courbe qu'un piéton), puis
 * rééchantillonnés à intervalles réguliers pour que l'animation avance à vitesse constante.
 */
import { chaikin, polylineKm, sampleAlong } from './geo.js';

/**
 * `spec` : { id, label, color, glyph, smooth (itérations de lissage), width (px), dash ([] ou [trait, vide]),
 * stops (marquer les points intermédiaires : arrêts de bus, gares…), speedKmh }.
 */
export function createGroundEngine(spec) {
  return Object.freeze({
    id: spec.id, label: spec.label, dimension: '2d', category: 'sol',
    color: spec.color, glyph: spec.glyph, width: spec.width ?? 4, dash: spec.dash ?? [], speedKmh: spec.speedKmh,
    /** Modélise une étape { from, to, waypoints, minutes } : un tracé 2D échantillonné. */
    model(segment) {
      const raw = [segment.from, ...(segment.waypoints ?? []), segment.to];
      const smooth = chaikin(raw, spec.smooth ?? 0);
      const lengthKm = polylineKm(raw);
      const samples = Math.round(Math.min(240, Math.max(24, lengthKm * 4)));
      return {
        engineId: spec.id, dimension: '2d', category: 'sol', color: spec.color, glyph: spec.glyph, width: this.width, dash: this.dash,
        lengthKm, minutes: segment.minutes,
        points: sampleAlong(smooth, samples).map((p) => ({ ...p, alt: 0 })),
        // Arrêts : les points intermédiaires fournis par le modèle (gares, arrêts), seulement pour les moyens à arrêts.
        stops: spec.stops ? (segment.waypoints ?? []).map((w) => ({ lat: w.lat, lon: w.lon })) : [],
        from: segment.from, to: segment.to,
      };
    },
  });
}
