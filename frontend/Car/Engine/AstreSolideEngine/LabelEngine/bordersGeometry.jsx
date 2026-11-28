// Importe le style unique des calques (palette Orbite).
import { LINES, hexNumber } from '../../../engines/astre-solide/astre-solide.style.js';
// Géométrie des frontières, sans three.js (testable) : polylignes lon/lat → segments 3D sur la sphère unité.
// Importe la conversion d'une longitude et d'une latitude en point 3D.
import { lonLatToXYZ } from '../MapEngine/mercator.jsx';

// Pas maximal de découpe d'un segment, en degrés.
const MAX_STEP_DEG = 0.25; // découpe : la corde d'un segment de 0,25° s'enfonce de ≈ 2,4e-6 rayon (≈ 15 m) sous la sphère

/**
 * @param {number[][]} lines  polylignes plates [lon1, lat1, lon2, lat2, …] (degrés), format de GET /borders
 * @returns {Float32Array} positions de segments (paires de points) pour THREE.LineSegments, sur la sphère de rayon 1
 */
// Déclare et exporte buildBorderSegments : reçoit les polylignes.
export function buildBorderSegments(lines) {
  // Coordonnées produites.
  const out = [];
  // Pour chaque polyligne.
  for (const line of lines) {
    // Pour chaque couple de points consécutifs.
    for (let i = 2; i + 1 < line.length; i += 2) {
      // Longitude et latitude des deux points.
      const lon0 = line[i - 2], lat0 = line[i - 1], lon1 = line[i], lat1 = line[i + 1];
      // Plus de 180° d'écart en longitude : segment ignoré.
      if (Math.abs(lon1 - lon0) > 180) continue; // saut de l'antiméridien : pas de segment à travers le globe
      // Nombre de pas : le plus grand écart divisé par le pas maximal, au moins 1.
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon1 - lon0), Math.abs(lat1 - lat0)) / MAX_STEP_DEG));
      // Point de départ, en 3D.
      let prev = lonLatToXYZ(lon0, lat0);
      // Pour chaque pas.
      for (let k = 1; k <= steps; k++) {
        // Avancement, de 0 à 1.
        const t = k / steps;
        // Point intermédiaire, interpolé en longitude et en latitude.
        const p = lonLatToXYZ(lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t);
        // Ajoute le segment : le point précédent, puis ce point.
        out.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
        // Ce point devient le précédent.
        prev = p;
      // Fin des pas.
      }
    // Fin des couples de points.
    }
  // Fin des polylignes.
  }
  // Renvoie les coordonnées dans un tableau de nombres à virgule flottante.
  return new Float32Array(out);
// Fin de buildBorderSegments.
}

/**
 * Hauteur des frontières au-dessus du sol (rayons) selon l'altitude de la caméra : juste au-dessus des tuiles de près
 * (elles montent jusqu'à ≈ 2e-5), plus haut de loin pour éviter tout scintillement avec la surface.
 */
// borderLift : hauteur des frontières, 1 % de l'altitude de la caméra, bornée entre 2,6e-5 et 2e-3 rayon.
export const borderLift = (altitude) => Math.min(2e-3, Math.max(2.6e-5, altitude * 0.01));

/** Style des frontières terrestres : or de la palette Orbite (style unique des calques, astre-solide.style.js). */
export const BORDER_STYLE = Object.freeze({ color: hexNumber(LINES.border.color), opacity: LINES.border.alpha });
/** Style des littoraux : nacre neutre, plus discrète que les frontières, sans bleu (le bleu clair a été retiré du rendu). */
export const COAST_STYLE = Object.freeze({ color: hexNumber(LINES.coast.color), opacity: LINES.coast.alpha });
