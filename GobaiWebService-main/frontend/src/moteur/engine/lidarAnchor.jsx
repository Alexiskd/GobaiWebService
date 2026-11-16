// Calage GPS d'un nuage LiDAR sur le globe (usage interne au moteur, aucune commande utilisateur).
// Le calage vient du catalogue (GET /pointclouds/:nom → `anchor`) : la coordonnée GPS est posée au centre de l'emprise,
// en bas du nuage (Z minimal). Même calcul que le serveur (backend/src/services/pointclouds/lidar-anchor.ts) :
// natif → Est-Nord-Haut autour de l'ancrage → WGS84 exact → sphère unité de la Terre (repère de lonLatToXYZ).
// Importe la conversion d'une longitude et d'une latitude en point 3D.
import { lonLatToXYZ } from './tiles/mercator';
// Importe le rayon de la Terre, en mètres.
import { EARTH_RADIUS_M } from './gps';

// Demi-grand axe de l'ellipsoïde WGS84, en mètres.
const A = 6_378_137;
// Aplatissement de l'ellipsoïde WGS84.
const F = 1 / 298.257223563;
// Carré de son excentricité.
const E2 = F * (2 - F);
// Facteur de conversion des degrés en radians.
const RAD = Math.PI / 180;

/** Point natif sur lequel la coordonnée GPS est posée : centre de l'emprise X/Y, Z minimal. */
// Déclare et exporte lidarAnchorOrigin : reçoit l'emprise du nuage.
export function lidarAnchorOrigin(b) {
  // Le centre de l'emprise en x et en y, au z minimal.
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: b.minZ };
// Fin de lidarAnchorOrigin.
}

// Déclare toEcef : latitude, longitude et altitude vers des coordonnées cartésiennes centrées sur la Terre.
function toEcef(lat, lon, alt) {
  // Latitude et longitude en radians, sinus et cosinus de la latitude.
  const la = lat * RAD, lo = lon * RAD, sl = Math.sin(la), cl = Math.cos(la);
  // Rayon de courbure de l'ellipsoïde à cette latitude.
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  // Les trois coordonnées cartésiennes.
  return [(n + alt) * cl * Math.cos(lo), (n + alt) * cl * Math.sin(lo), (n * (1 - E2) + alt) * sl];
// Fin de toEcef.
}

// Déclare toGeodetic : coordonnées cartésiennes vers latitude, longitude et altitude.
function toGeodetic([x, y, z]) {
  // Distance à l'axe des pôles.
  const p = Math.hypot(x, y);
  // Première estimation de la latitude ; altitude à zéro.
  let lat = Math.atan2(z, p * (1 - E2)), alt = 0;
  // Huit itérations d'affinage.
  for (let i = 0; i < 8; i++) {
    // Sinus de la latitude et rayon de courbure.
    const sl = Math.sin(lat), n = A / Math.sqrt(1 - E2 * sl * sl);
    // Altitude correspondante.
    alt = p / Math.cos(lat) - n;
    // Latitude corrigée.
    lat = Math.atan2(z, p * (1 - (E2 * n) / (n + alt)));
  // Fin des itérations.
  }
  // Renvoie la latitude et la longitude en degrés, et l'altitude.
  return { lat: lat / RAD, lon: Math.atan2(y, x) / RAD, alt };
// Fin de toGeodetic.
}

/**
 * Position WGS84 d'un point natif { x, y, z } du nuage, ancrage GPS posé au centre du bas du nuage.
 * @param {{ bounds: object, anchor: { lat: number, lon: number, alt?: number, heading?: number } }} cloud
 */
// Déclare et exporte lidarToGeodetic : un point du nuage, son emprise et son ancrage.
export function lidarToGeodetic(p, { bounds, anchor }) {
  // Le point d'ancrage dans le nuage.
  const o = lidarAnchorOrigin(bounds);
  // L'orientation de l'ancrage en radians, son cosinus et son sinus.
  const t = (anchor.heading || 0) * RAD, c = Math.cos(t), s = Math.sin(t);
  // Écart du point à l'ancrage, en x et en y.
  const dx = p.x - o.x, dy = p.y - o.y;
  // Écart vers l'est, vers le nord et vers le haut, après rotation.
  const e = dx * c + dy * s, n = -dx * s + dy * c, u = p.z - o.z;
  // Latitude et longitude de l'ancrage, en radians.
  const la = anchor.lat * RAD, lo = anchor.lon * RAD;
  // Leurs sinus et cosinus.
  const sla = Math.sin(la), cla = Math.cos(la), slo = Math.sin(lo), clo = Math.cos(lo);
  // Coordonnées cartésiennes de l'ancrage.
  const [x0, y0, z0] = toEcef(anchor.lat, anchor.lon, anchor.alt || 0);
  // Convertit le point final en latitude, longitude et altitude (début).
  return toGeodetic([
    // Sa coordonnée x.
    x0 - slo * e - sla * clo * n + cla * clo * u,
    // Sa coordonnée y.
    y0 + clo * e - sla * slo * n + cla * slo * u,
    // Sa coordonnée z.
    z0 + cla * n + sla * u,
  // Fin de la conversion.
  ]);
// Fin de lidarToGeodetic.
}

/** Point natif → repère du maillage de la Terre (sphère unité, rayon EARTH_RADIUS_M), altitude comprise. */
// Déclare et exporte lidarToGlobe : un point du nuage et le nuage.
export function lidarToGlobe(p, cloud) {
  // Sa position géographique.
  const g = lidarToGeodetic(p, cloud);
  // Son point sur la sphère de la Terre, relevé de son altitude.
  return lonLatToXYZ(g.lon, g.lat, 1 + g.alt / EARTH_RADIUS_M);
// Fin de lidarToGlobe.
}
