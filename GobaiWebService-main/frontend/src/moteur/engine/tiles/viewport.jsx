// Importe la conversion d'un point 3D en longitude et latitude.
import { xyzToLonLat } from './mercator';

/**
 * Emprise géographique approximative de ce que voit la caméra, pour demander la mention de sources.
 * `cam` = position caméra dans le repère de la Terre (rayon 1). Résultat en degrés.
 */
// Déclare et exporte viewportBounds : la position de la caméra, l'angle de champ vertical et les proportions de l'écran.
export function viewportBounds(cam, fovY, aspect) {
  // Distance de la caméra au centre de la Terre.
  const d = Math.hypot(cam[0], cam[1], cam[2]);
  // Caméra à la surface ou en dessous, ou distance illisible : pas d'emprise.
  if (!(d > 1)) return null;
  // Longitude et latitude du point survolé.
  const [lon, lat] = xyzToLonLat(cam);
  // Demi-angle de champ sur la diagonale de l'écran.
  const halfDiag = Math.atan(Math.tan(fovY / 2) * Math.hypot(1, aspect));
  // Rayon du terrain visible : limité par l'horizon, sinon par le cône de vue (approximation plane).
  // Rayon angulaire du terrain visible : le plus petit de l'horizon et du cône de vue.
  const rho = Math.min(Math.acos(1 / d), Math.atan(Math.tan(halfDiag) * (d - 1)));
  // Ce rayon, en degrés.
  const deg = (rho * 180) / Math.PI;
  // clampLat : borne une latitude entre -90 et 90.
  const clampLat = (v) => Math.max(-90, Math.min(90, v));
  // Limites nord et sud.
  const north = clampLat(lat + deg), south = clampLat(lat - deg);
  // Cosinus de la latitude la plus haute de la zone (plafonnée à 89°), jamais sous 0,01.
  const cos = Math.max(Math.cos((Math.min(Math.abs(lat) + deg, 89) * Math.PI) / 180), 0.01);
  // Vrai si la zone fait tout le tour en longitude.
  const wide = deg / cos >= 180;
  // wrap : ramène une longitude entre -180 et 180.
  const wrap = (v) => ((((v + 180) % 360) + 360) % 360) - 180;
  // Renvoie les quatre limites (tout le tour si la zone est large) et un niveau de zoom indicatif.
  return { north, south, west: wide ? -180 : wrap(lon - deg / cos), east: wide ? 180 : wrap(lon + deg / cos), zoomHint: Math.max(0, Math.round(Math.log2(360 / Math.max(deg * 2, 1e-6)))) };
// Fin de viewportBounds.
}
