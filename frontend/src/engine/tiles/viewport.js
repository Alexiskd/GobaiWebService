import { xyzToLonLat } from './mercator.js';

/**
 * Emprise géographique approximative de ce que voit la caméra, pour demander la mention de sources.
 * `cam` = position caméra dans le repère de la Terre (rayon 1). Résultat en degrés.
 */
export function viewportBounds(cam, fovY, aspect) {
  const d = Math.hypot(cam[0], cam[1], cam[2]);
  if (!(d > 1)) return null;
  const [lon, lat] = xyzToLonLat(cam);
  const halfDiag = Math.atan(Math.tan(fovY / 2) * Math.hypot(1, aspect));
  // Rayon du terrain visible : limité par l'horizon, sinon par le cône de vue (approximation plane).
  const rho = Math.min(Math.acos(1 / d), Math.atan(Math.tan(halfDiag) * (d - 1)));
  const deg = (rho * 180) / Math.PI;
  const clampLat = (v) => Math.max(-90, Math.min(90, v));
  const north = clampLat(lat + deg), south = clampLat(lat - deg);
  const cos = Math.max(Math.cos((Math.min(Math.abs(lat) + deg, 89) * Math.PI) / 180), 0.01);
  const wide = deg / cos >= 180;
  const wrap = (v) => ((((v + 180) % 360) + 360) % 360) - 180;
  return { north, south, west: wide ? -180 : wrap(lon - deg / cos), east: wide ? 180 : wrap(lon + deg / cos), zoomHint: Math.max(0, Math.round(Math.log2(360 / Math.max(deg * 2, 1e-6)))) };
}
