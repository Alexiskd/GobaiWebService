/**
 * Océans du modèle 3D de la Terre (export GLB, ouvert dans Blender) : deux objets à part.
 *  - « Terre — relief et fonds marins » : le sphéroïde soulevé par les altitudes (terres et fonds marins, relief
 *    exagéré), texturé par le satellite HD sur les terres et par l'image GEBCO des fonds au large ;
 *  - « Océans — surface de l'eau » : le sphéroïde au niveau de la mer, texturé par la couleur réelle de l'eau
 *    (chlorophylle du mois, table calculée avec ocpy), transparent sur les terres et peu à peu opaque au large.
 * Mêmes règles que le satellite HD du navigateur (voir frontend seafloorFusion.jsx et oceanColour.jsx).
 * Fonctions pures, testées dans earth-oceans.spec.ts.
 */

// Importe le maillage d'une sphère et son type.
import { sphereMesh, type SphereMesh } from './glb';
// Importe la table des couleurs de l'eau et les bornes de sa chlorophylle.
import { OCEAN_COLOURS, OCEAN_LOG_CHL } from './ocean-colour-lut';

/** Profondeur (m) jusqu'à laquelle les terres et les côtes gardent l'image satellite (même règle que le navigateur). */
// Profondeur où commence l'eau du large : 10 m.
export const SEA_SHALLOW_M = -10;
/** Profondeur (m) à partir de laquelle seule l'eau du large est montrée. */
// Profondeur où l'eau du large est complète : 50 m.
export const SEA_DEEP_M = -50;
/** Opacité de la surface de l'eau au large : le relief des fonds reste visible dessous. */
// Opacité de l'eau au large : 0,8.
export const WATER_ALPHA = 0.8;
/** Chlorophylle par défaut (mg/m³), sans donnée proche ou sans image de chlorophylle. */
// Logarithme de la chlorophylle par défaut : 0,15 mg/m³.
export const DEFAULT_LOG_CHL = Math.log10(0.15);
// Latitude maximale de la projection Web Mercator, en radians.
const MERCATOR_MAX_LAT = 2 * Math.atan(Math.exp(Math.PI)) - Math.PI / 2;

// Fonction seaWeight : part de l'eau du large à une altitude (m) : 0 au-dessus de −10 m, 1 sous −50 m.
export const seaWeight = (m: number): number => (!(m < SEA_SHALLOW_M) ? 0 : m <= SEA_DEEP_M ? 1 : (SEA_SHALLOW_M - m) / (SEA_SHALLOW_M - SEA_DEEP_M));

/** Altitudes (m) d'une image Terrarium en pixels bruts (`channels` octets par pixel) ; un pixel sans donnée vaut 0. */
// Fonction decodeTerrarium : les pixels bruts et le nombre d'octets par pixel.
export function decodeTerrarium(raw: Uint8Array, channels: number): Int16Array {
  // Une altitude par pixel.
  const out = new Int16Array(raw.length / channels);
  // Pour chaque pixel (début).
  for (let k = 0; k < out.length; k++) {
    // Altitude décodée : rouge × 256 + vert + bleu / 256 − 32 768.
    const h = raw[k * channels] * 256 + raw[k * channels + 1] + raw[k * channels + 2] / 256 - 32768;
    // Sans donnée (sous la plus grande profondeur) : 0 ; sinon arrondie et bornée.
    out[k] = h < -11500 ? 0 : Math.max(-32768, Math.min(32767, Math.round(h)));
  // Fin de la boucle.
  }
  // Renvoie les altitudes.
  return out;
// Fin de decodeTerrarium.
}

// Forme d'une grille carrée en projection Web Mercator : son côté et ses valeurs (première ligne au nord).
export interface MercatorGrid { size: number; values: Int16Array }

/** Valeur interpolée de la grille en (u, v) ∈ [0, 1]² (u vers l'est depuis 180° O, v vers le sud), u faisant le tour. */
// Fonction sampleGrid : la grille, u et v.
export function sampleGrid(grid: MercatorGrid, u: number, v: number): number {
  // Côté de la grille.
  const n = grid.size;
  // Colonne et ligne (centres des pixels), la ligne bornée.
  const x = u * n - 0.5, y = Math.min(n - 1, Math.max(0, v * n - 0.5));
  // Colonne de gauche, ligne du dessus et poids.
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  // Colonnes voisines (le tour du monde) et ligne du dessous.
  const c0 = ((x0 % n) + n) % n, c1 = (c0 + 1) % n, r1 = Math.min(n - 1, y0 + 1), g = grid.values;
  // Interpolation entre les quatre pixels.
  return (g[y0 * n + c0] * (1 - fx) + g[y0 * n + c1] * fx) * (1 - fy) + (g[r1 * n + c0] * (1 - fx) + g[r1 * n + c1] * fx) * fy;
// Fin de sampleGrid.
}

// Fonction mercatorV : coordonnée v (0 au nord, 1 au sud) d'une latitude en radians, bornée à la projection.
export const mercatorV = (lat: number): number => 0.5 - Math.log(Math.tan(Math.PI / 4 + Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) / 2)) / (2 * Math.PI);
// Fonction mercatorLat : latitude (degrés) d'une coordonnée v.
export const mercatorLat = (v: number): number => (Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180) / Math.PI;

/**
 * Texture du relief : pixels RGB (`size` × `size`, Web Mercator) du satellite, remplacés peu à peu par ceux des fonds
 * GEBCO là où les altitudes sont sous la mer. Les deux images ont la même taille. Modifie et renvoie `land`.
 */
// Fonction composeSeabed : pixels du satellite, pixels des fonds, leur côté, et la grille des altitudes.
export function composeSeabed(land: Uint8Array, sea: Uint8Array, size: number, elevation: MercatorGrid): Uint8Array {
  // Pour chaque ligne et chaque colonne (début).
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // Part de l'eau du large à cet endroit.
    const w = seaWeight(sampleGrid(elevation, (i + 0.5) / size, (j + 0.5) / size));
    // Aucune : pixel suivant.
    if (!w) continue;
    // Indice du rouge.
    const k = (j * size + i) * 3;
    // Rouge, vert et bleu : mélange des deux images.
    for (let c = 0; c < 3; c++) land[k + c] = Math.round(land[k + c] + (sea[k + c] - land[k + c]) * w);
  // Fin des boucles.
  }
  // Renvoie les pixels.
  return land;
// Fin de composeSeabed.
}

/** Logarithmes de la chlorophylle d'une image grise brute (`channels` octets par pixel, dernier = transparence) ; NaN sans donnée. */
// Fonction decodeChlorophyll : les pixels bruts, le nombre d'octets par pixel, et les bornes de l'échelle (mg/m³).
export function decodeChlorophyll(raw: Uint8Array, channels: number, min: number, max: number): Float32Array {
  // Logarithmes des bornes.
  const lo = Math.log10(min), hi = Math.log10(max);
  // Une valeur par pixel.
  const out = new Float32Array(raw.length / channels);
  // Pour chaque pixel : NaN s'il est transparent, sinon le logarithme codé par son gris.
  for (let k = 0; k < out.length; k++) out[k] = raw[k * channels + channels - 1] < 128 ? Number.NaN : lo + (raw[k * channels] / 255) * (hi - lo);
  // Renvoie la grille.
  return out;
// Fin de decodeChlorophyll.
}

/** Comble les trous d'une grille w × h (longitudes qui se rejoignent) : moyenne des voisines, passe après passe. */
// Fonction fillGaps : la grille, ses dimensions et le nombre de passes (40).
export function fillGaps(grid: Float32Array, w: number, h: number, passes = 40): Float32Array {
  // Pour chaque passe (début).
  for (let p = 0; p < passes; p++) {
    // Cases comblées pendant cette passe (indice, valeur), posées à la fin.
    const filled: number[] = [];
    // Pour chaque case vide (début).
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      // Case connue : suivante.
      if (!Number.isNaN(grid[j * w + i])) continue;
      // Somme et nombre des voisines connues.
      let sum = 0, n = 0;
      // Les huit voisines, la longitude faisant le tour.
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const jj = j + dj; if (jj < 0 || jj >= h || (!di && !dj)) continue; const v = grid[jj * w + ((i + di + w) % w)]; if (!Number.isNaN(v)) { sum += v; n++; } }
      // Au moins une voisine : la moyenne.
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

// Forme de la chlorophylle : grille comblée en plate carrée (nord en haut, depuis 180° O), et ses dimensions.
export interface ChlorophyllGrid { grid: Float32Array; w: number; h: number }

/** Couleur sRGB de l'eau du large pour un logarithme de chlorophylle (table interpolée, bornée). */
// Fonction waterColour : le logarithme de la chlorophylle.
export function waterColour(logChl: number): [number, number, number] {
  // Position dans la table, bornée.
  const t = Math.min(1, Math.max(0, (logChl - OCEAN_LOG_CHL[0]) / (OCEAN_LOG_CHL[1] - OCEAN_LOG_CHL[0]))) * (OCEAN_COLOURS.length - 1);
  // Couleur de gauche, de droite et poids.
  const k = Math.min(OCEAN_COLOURS.length - 2, Math.floor(t)), f = t - k, a = OCEAN_COLOURS[k], b = OCEAN_COLOURS[k + 1];
  // Interpolation des trois composantes.
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
// Fin de waterColour.
}

/**
 * Texture de la surface de l'eau : pixels RGBA (`size` × `size`, Web Mercator) : couleur réelle de l'eau selon la
 * chlorophylle du lieu (par défaut 0,15 mg/m³ sans grille), opacité nulle sur les terres et 0,8 au large.
 */
// Fonction waterTexture : le côté, la grille des altitudes et la chlorophylle (ou null).
export function waterTexture(size: number, elevation: MercatorGrid, chl: ChlorophyllGrid | null): Uint8Array {
  // Pixels RGBA.
  const out = new Uint8Array(size * size * 4);
  // Pour chaque ligne (début).
  for (let j = 0; j < size; j++) {
    // Coordonnée v du centre de la ligne, et sa latitude.
    const v = (j + 0.5) / size, lat = mercatorLat(v);
    // Ligne de la chlorophylle (centres des cases), bornée.
    const cy = chl ? Math.min(chl.h - 1, Math.max(0, ((90 - lat) / 180) * chl.h - 0.5)) : 0;
    // Pour chaque colonne (début).
    for (let i = 0; i < size; i++) {
      // Coordonnée u du centre du pixel.
      const u = (i + 0.5) / size;
      // Part de l'eau du large.
      const w = seaWeight(sampleGrid(elevation, u, v));
      // Terre : pixel transparent.
      if (!w) continue;
      // Chlorophylle du lieu : case la plus proche, sinon la valeur par défaut.
      const lc = chl ? chl.grid[Math.round(cy) * chl.w + Math.min(chl.w - 1, Math.floor(u * chl.w))] : DEFAULT_LOG_CHL;
      // Couleur de l'eau.
      const c = waterColour(lc);
      // Indice du rouge.
      const k = (j * size + i) * 4;
      // Couleur, et opacité selon la profondeur.
      out[k] = Math.round(c[0]); out[k + 1] = Math.round(c[1]); out[k + 2] = Math.round(c[2]); out[k + 3] = Math.round(255 * WATER_ALPHA * w);
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie les pixels.
  return out;
// Fin de waterTexture.
}

/** Recalcule les normales d'un maillage d'après ses triangles (relief soulevé : les normales de la sphère ne vont plus). */
// Fonction recomputeNormals : le maillage, modifié.
export function recomputeNormals(mesh: SphereMesh): SphereMesh {
  // Positions, indices et normales.
  const p = mesh.positions, idx = mesh.indices, n = mesh.normals.fill(0);
  // Pour chaque triangle (début).
  for (let t = 0; t < idx.length; t += 3) {
    // Ses trois sommets.
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    // Deux côtés.
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    // Produit vectoriel : normale pondérée par l'aire.
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    // Ajoutée aux trois sommets.
    for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
  // Fin des triangles.
  }
  // Pour chaque sommet : normale ramenée à la longueur 1.
  for (let v = 0; v < n.length; v += 3) { const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1; n[v] /= l; n[v + 1] /= l; n[v + 2] /= l; }
  // Renvoie le maillage.
  return mesh;
// Fin de recomputeNormals.
}

/**
 * Sphéroïde soulevé par les altitudes : chaque sommet s'éloigne du centre de (altitude × exagération), en km.
 * Les altitudes sont lues dans la grille Web Mercator (au-delà de 85° : la dernière ligne).
 */
// Fonction reliefMesh : le rayon (km), les bandes, l'aplatissement, la grille des altitudes et l'exagération.
export function reliefMesh(radiusKm: number, rings: number, segments: number, flattening: number, elevation: MercatorGrid, exaggeration: number): SphereMesh {
  // Le sphéroïde, texture en Web Mercator.
  const mesh = sphereMesh(radiusKm, rings, segments, flattening, 'mercator');
  // Rayon polaire.
  const polar = radiusKm * (1 - flattening);
  // Pour chaque sommet (début).
  for (let i = 0; i < mesh.vertexCount; i++) {
    // Sa position.
    const x = mesh.positions[3 * i], y = mesh.positions[3 * i + 1], z = mesh.positions[3 * i + 2];
    // Sa latitude (d'après la direction sur la sphère unité).
    const lat = Math.asin(Math.max(-1, Math.min(1, y / polar)));
    // Son altitude (m), à sa coordonnée u et à la coordonnée v de sa latitude.
    const h = sampleGrid(elevation, mesh.uvs[2 * i], mercatorV(lat));
    // Facteur d'éloignement : 1 + altitude exagérée / rayon.
    const f = 1 + (h / 1000) * exaggeration / radiusKm;
    // Nouvelle position.
    mesh.positions[3 * i] = x * f; mesh.positions[3 * i + 1] = y * f; mesh.positions[3 * i + 2] = z * f;
  // Fin des sommets.
  }
  // Normales recalculées.
  return recomputeNormals(mesh);
// Fin de reliefMesh.
}
