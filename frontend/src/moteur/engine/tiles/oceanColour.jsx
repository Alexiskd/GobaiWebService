// Couleur réelle de l'eau du large dans le satellite HD : chlorophylle du mois (image du serveur, voir backend
// earth-chlorophyll.ts) → couleur de l'eau (table calculée avec ocpy, voir scripts/couleur-ocean.py) → ombrée par le
// relief des fonds (altitudes Terrarium). Fonctions pures, sans navigateur (testées dans oceanColour.test.jsx).

// Importe la table des couleurs de l'eau et les bornes de sa chlorophylle.
import { OCEAN_COLOURS, OCEAN_LOG_CHL } from './oceanColourLut';

/** Chlorophylle des mers sans donnée proche (mg/m³) : valeur courante du large. */
// Déclare et exporte le logarithme de la chlorophylle par défaut : 0,15 mg/m³.
export const DEFAULT_LOG_CHL = Math.log10(0.15);
/** Passes de comblement des trous de la grille (côtes, glace, nuages) : un trou de 40 cases au plus est comblé. */
// Déclare et exporte le nombre de passes de comblement : 40.
export const FILL_PASSES = 40;
/**
 * Exagération du relief des fonds pour l'ombrage, pour des pixels de 150 m (niveau 10) : leurs pentes sont très
 * douces. Elle croît avec la racine de la taille des pixels, pour que dorsales et fosses restent lisibles de loin.
 */
// Déclare et exporte l'exagération du relief des fonds au niveau 10 : 12.
export const SEA_RELIEF_EXAGGERATION = 12;
// Taille de pixel (m) de cette exagération de référence : 150 m.
const SEA_RELIEF_REF_M = 150;

/** Logarithmes de la chlorophylle d'une image grise (2 composantes utiles : gris, transparence) ; NaN sans donnée. */
// Déclare et exporte decodeChlorophyll : les pixels RGBA, et les bornes de l'échelle en mg/m³.
export function decodeChlorophyll(rgba, min, max) {
  // Logarithmes des bornes.
  const lo = Math.log10(min), hi = Math.log10(max);
  // Une valeur par pixel.
  const out = new Float32Array(rgba.length / 4);
  // Pour chaque pixel : NaN s'il est transparent, sinon le logarithme codé par son gris.
  for (let k = 0; k < out.length; k++) out[k] = rgba[k * 4 + 3] < 128 ? NaN : lo + (rgba[k * 4] / 255) * (hi - lo);
  // Renvoie la grille.
  return out;
// Fin de decodeChlorophyll.
}

/**
 * Comble les trous de la grille (w × h, longitudes qui se rejoignent) : à chaque passe, une case vide prend la moyenne
 * de ses voisines connues. Ce qui reste vide prend la valeur par défaut. Modifie et renvoie la grille.
 */
// Déclare et exporte fillGaps : la grille, ses dimensions et le nombre de passes.
export function fillGaps(grid, w, h, passes = FILL_PASSES) {
  // Pour chaque passe (début).
  for (let p = 0; p < passes; p++) {
    // Cases comblées pendant cette passe : appliquées à la fin, pour ne pas avancer plus d'une case par passe.
    const filled = [];
    // Pour chaque case (début).
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      // Case connue : suivante.
      if (!Number.isNaN(grid[j * w + i])) continue;
      // Somme et nombre des voisines connues.
      let sum = 0, n = 0;
      // Pour les huit voisines (début).
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        // Ligne voisine ; hors de la grille : suivante.
        const jj = j + dj; if (jj < 0 || jj >= h || (!di && !dj)) continue;
        // Valeur voisine, la longitude faisant le tour.
        const v = grid[jj * w + ((i + di + w) % w)];
        // Connue : ajoutée.
        if (!Number.isNaN(v)) { sum += v; n++; }
      // Fin des voisines.
      }
      // Au moins une voisine : moyenne à poser.
      if (n) filled.push(j * w + i, sum / n);
    // Fin des cases.
    }
    // Rien de comblé : fini.
    if (!filled.length) break;
    // Pose les moyennes.
    for (let k = 0; k < filled.length; k += 2) grid[filled[k]] = filled[k + 1];
  // Fin des passes.
  }
  // Ce qui reste vide : la valeur par défaut.
  for (let k = 0; k < grid.length; k++) if (Number.isNaN(grid[k])) grid[k] = DEFAULT_LOG_CHL;
  // Renvoie la grille.
  return grid;
// Fin de fillGaps.
}

/** Logarithme de la chlorophylle en (lon, lat), interpolé dans la grille d'emprise [ouest, sud, est, nord]. */
// Déclare et exporte logChlAt : la grille comblée, ses dimensions, son emprise, la longitude et la latitude.
export function logChlAt(grid, w, h, [west, south, east, north], lon, lat) {
  // Colonne et ligne (centres des cases), la ligne bornée à la grille.
  const u = ((lon - west) / (east - west)) * w - 0.5, v = Math.min(h - 1, Math.max(0, ((north - lat) / (north - south)) * h - 0.5));
  // Colonne de gauche, ligne du dessus et poids.
  const u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
  // Colonnes voisines, la longitude faisant le tour ; ligne du dessous bornée.
  const c0 = ((u0 % w) + w) % w, c1 = (c0 + 1) % w, r1 = Math.min(h - 1, v0 + 1);
  // Interpolation entre les quatre cases.
  return (grid[v0 * w + c0] * (1 - fu) + grid[v0 * w + c1] * fu) * (1 - fv) + (grid[r1 * w + c0] * (1 - fu) + grid[r1 * w + c1] * fu) * fv;
// Fin de logChlAt.
}

/** Couleur sRGB [r, g, b] de l'eau du large pour un logarithme de chlorophylle (table interpolée, bornée). */
// Déclare et exporte waterColour : le logarithme de la chlorophylle.
export function waterColour(logChl) {
  // Position dans la table, bornée.
  const t = Math.min(1, Math.max(0, (logChl - OCEAN_LOG_CHL[0]) / (OCEAN_LOG_CHL[1] - OCEAN_LOG_CHL[0]))) * (OCEAN_COLOURS.length - 1);
  // Couleur de gauche, de droite et poids.
  const k = Math.min(OCEAN_COLOURS.length - 2, Math.floor(t)), f = t - k, a = OCEAN_COLOURS[k], b = OCEAN_COLOURS[k + 1];
  // Interpolation des trois composantes.
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
// Fin de waterColour.
}

// Lumière venant du nord-ouest, à 45° de hauteur (est, nord, haut), normée.
const LIGHT = [-0.5, 0.5, Math.SQRT1_2];

/**
 * Ombrage (0,7 … 1,3) d'un pixel d'après les altitudes voisines : 1 sur un fond plat, plus clair sur les pentes
 * tournées vers le nord-ouest, plus sombre de l'autre côté. `m` : taille d'un pixel au sol (m).
 */
// Déclare et exporte seaShade : les altitudes, la taille, la colonne, la ligne et la taille d'un pixel au sol.
export function seaShade(height, size, i, j, m) {
  // Voisins de gauche, de droite, du dessus et du dessous, bornés à la tuile.
  const l = height[j * size + Math.max(0, i - 1)], r = height[j * size + Math.min(size - 1, i + 1)];
  // Voisins du dessus (nord) et du dessous (sud).
  const n = height[Math.max(0, j - 1) * size + i], s = height[Math.min(size - 1, j + 1) * size + i];
  // Exagération pour cette taille de pixel.
  const ex = SEA_RELIEF_EXAGGERATION * Math.sqrt(Math.max(1, m / SEA_RELIEF_REF_M));
  // Pentes vers l'est et vers le nord, exagérées.
  const dx = ((r - l) / (2 * m)) * ex, dy = ((n - s) / (2 * m)) * ex;
  // Éclairement de la normale (−dx, −dy, 1) normée, rapporté à celui d'un fond plat.
  const lit = (-dx * LIGHT[0] - dy * LIGHT[1] + LIGHT[2]) / Math.sqrt(dx * dx + dy * dy + 1) / LIGHT[2];
  // Ombrage adouci et borné.
  return Math.min(1.3, Math.max(0.7, 1 + 0.6 * (lit - 1)));
// Fin de seaShade.
}

/**
 * Pixels RGBA de l'eau du large d'une tuile (z, x, y) de `size` px : couleur réelle selon la chlorophylle, ombrée par
 * le relief des fonds ; seuls les pixels où `mask` > 0 sont calculés. `chl` : { grid, w, h, bounds } (grille comblée).
 * `metersAt(lat)` : taille d'un pixel au sol à cette latitude.
 */
// Déclare et exporte oceanPixels : la tuile, les altitudes, les parts de mer, la chlorophylle, la taille au sol et la taille.
export function oceanPixels({ z, x, y, height, mask, chl, metersAt, size = 256 }) {
  // Pixels de sortie.
  const out = new Uint8ClampedArray(size * size * 4);
  // Nombre de tuiles par côté à ce niveau.
  const n = 2 ** z;
  // Pour chaque ligne (début).
  for (let j = 0; j < size; j++) {
    // Latitude du centre de la ligne (Mercator).
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (j + 0.5) / size)) / n))) * 180) / Math.PI;
    // Taille d'un pixel au sol.
    const m = metersAt(lat);
    // Pour chaque colonne (début).
    for (let i = 0; i < size; i++) {
      // Indice du pixel.
      const k = j * size + i;
      // Pas de mer ici : suivant.
      if (!(mask[k] > 0)) continue;
      // Longitude du centre du pixel.
      const lon = ((x + (i + 0.5) / size) / n) * 360 - 180;
      // Couleur de l'eau selon la chlorophylle du lieu.
      const c = waterColour(logChlAt(chl.grid, chl.w, chl.h, chl.bounds, lon, lat));
      // Ombrage par le relief des fonds.
      const sh = seaShade(height, size, i, j, m);
      // Pixel ombré, opaque.
      out[k * 4] = c[0] * sh; out[k * 4 + 1] = c[1] * sh; out[k * 4 + 2] = c[2] * sh; out[k * 4 + 3] = 255;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie les pixels.
  return out;
// Fin de oceanPixels.
}
