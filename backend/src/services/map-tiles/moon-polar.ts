/**
 * Calottes polaires de la Lune : pyramide de tuiles en stéréographique polaire, partagée avec le client
 * (frontend/src/engine/tiles/projection.js). Sans elle, les tuiles en plate carrée se resserrent en éventail vers le
 * pôle (pixels étirés, triangles dégénérés, filtrage anisotrope extrême) : c'est l'aspect « tourbillon » des pôles.
 *  - sphère de 1 737 400 m, méridien central 0°, échelle vraie au pôle ;
 *  - carré de ±550 km autour du pôle (≈ jusqu'à 72° de latitude sur les axes) découpé en 2^z × 2^z tuiles de 256 px ;
 *  - y croît du haut de l'image vers le bas ; pôle Sud : +y vers 0° de longitude ; pôle Nord : +y vers 180°.
 */
export const MOON_RADIUS_M = 1737400;
export const POLAR_HALF_SIZE_M = 550000;
/** Latitude (valeur absolue) au-delà de laquelle les calottes remplacent les tuiles en plate carrée. */
export const POLAR_CAP_LAT = 75;

const D = Math.PI / 180;
export type Pole = 'north' | 'south';

export function polarXYToLonLat(x: number, y: number, pole: Pole): [number, number] {
  const c = 2 * Math.atan(Math.hypot(x, y) / (2 * MOON_RADIUS_M));
  if (pole === 'south') return [Math.atan2(x, y) / D, -(90 - c / D)];
  return [Math.atan2(x, -y) / D, 90 - c / D];
}

/** Coordonnées projetées (m) du point (u, v) ∈ [0, 1]² de la tuile (z, x, y) ; v = 0 en haut. */
export function polarTilePoint(z: number, x: number, y: number, u: number, v: number): [number, number] {
  const size = (2 * POLAR_HALF_SIZE_M) / 2 ** z;
  return [-POLAR_HALF_SIZE_M + (x + u) * size, POLAR_HALF_SIZE_M - (y + v) * size];
}

/** Taille d'un pixel (m) au niveau z. */
export const polarPixelSize = (z: number, tileSize = 256) => (2 * POLAR_HALF_SIZE_M) / (tileSize * 2 ** z);

/** Couches polaires : chacune est reprojetée depuis sa couche en plate carrée (même source NASA, même détail). */
export const POLAR_LAYERS = [
  { id: 'moon-kaguya', maxZoom: 8, srcMaxZoom: 10 },     // ≈ 17 m/px au niveau 8 (source ≈ 20 m/px)
  { id: 'moon-lola-shade', maxZoom: 4, srcMaxZoom: 6 },  // ≈ 270 m/px (source ≈ 330 m/px)
] as const;
