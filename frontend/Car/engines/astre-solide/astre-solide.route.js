/**
 * Vol entre deux lieux sur le globe de près : « Paris → Tokyo ». Les noms sont cherchés parmi les villes Natural Earth
 * déjà chargées (la plus peuplée d'abord) ; la caméra suit l'arc du grand cercle, monte puis redescend, le regard
 * tourné vers la route. Fonctions pures.
 */

// Radians par degré.
const RAD = Math.PI / 180;
// Rayon de la Terre (km).
const R_KM = 6371;

/** Les deux noms d'un trajet écrit « A → B », « A - B », « A > B », « A à B » ou « de A à B » ; null sinon. */
// Déclare et exporte parseRoute : le texte (début).
export function parseRoute(text) {
  // Texte nettoyé, sans « de » au début.
  const t = String(text ?? '').trim().replace(/^de\s+/i, '');
  // Coupé au premier séparateur.
  const m = /^(.+?)\s*(?:→|->|>|—|–|\s-\s|\sà\s|\sa\s|\sto\s|\svers\s)\s*(.+)$/i.exec(t);
  // Deux noms non vides : eux.
  return m && m[1].trim() && m[2].trim() ? [m[1].trim(), m[2].trim()] : null;
// Fin de parseRoute.
}

/** Texte replié pour comparer : minuscules, sans accents ni ponctuation. */
// Déclare fold : le texte.
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Ville d'un nom (nom français ou d'origine) : nom exact d'abord, sinon début du nom ; la plus peuplée l'emporte. */
// Déclare et exporte findCity : les villes (de la plus peuplée à la moins peuplée) et le nom (début).
export function findCity(cities, name) {
  // Nom replié.
  const q = fold(name);
  // Vide : rien.
  if (!q || !Array.isArray(cities)) return null;
  // Noms d'une ville, repliés.
  const names = (c) => [c?.nameFr, c?.name].filter(Boolean).map(fold);
  // Nom exact, sinon début du nom (la liste est déjà de la plus peuplée à la moins peuplée).
  return cities.find((c) => names(c).includes(q) && Number.isFinite(c.lon)) ?? cities.find((c) => names(c).some((n) => n.startsWith(q)) && Number.isFinite(c.lon)) ?? null;
// Fin de findCity.
}

/** Angle (radians) entre deux points { lon, lat } en degrés, sur la sphère. */
// Déclare et exporte arcAngle : les deux points (début).
export function arcAngle(a, b) {
  // Formule de haversine.
  const h = Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  // Angle.
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
// Fin de arcAngle.
}

/** Distance (km) le long du grand cercle. */
// Déclare et exporte routeKm : les deux points.
export const routeKm = (a, b) => arcAngle(a, b) * R_KM;

/** Point (degrés) à la fraction t du grand cercle de a à b. */
// Déclare et exporte greatCircle : les deux points et la fraction (début).
export function greatCircle(a, b, t) {
  // Angle du trajet.
  const d = arcAngle(a, b);
  // Même point : a.
  if (d < 1e-12) return { lon: a.lon, lat: a.lat };
  // Poids de l'interpolation sphérique.
  const A = Math.sin((1 - t) * d) / Math.sin(d), B = Math.sin(t * d) / Math.sin(d);
  // Directions des deux points.
  const [la1, lo1, la2, lo2] = [a.lat * RAD, a.lon * RAD, b.lat * RAD, b.lon * RAD];
  // Point interpolé.
  const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
  const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
  const z = A * Math.sin(la1) + B * Math.sin(la2);
  // Longitude et latitude.
  return { lon: Math.atan2(y, x) / RAD, lat: Math.atan2(z, Math.hypot(x, y)) / RAD };
// Fin de greatCircle.
}

/** Cap (degrés, 0 = nord, sens horaire) de a vers b. */
// Déclare et exporte bearing : les deux points (début).
export function bearing(a, b) {
  // Latitudes et écart de longitude en radians.
  const p1 = a.lat * RAD, p2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
  // Cap.
  const h = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD;
  // Entre 0 et 360.
  return (h + 360) % 360;
// Fin de bearing.
}

/** Durée du vol (ms) : 3 s pour un saut court, jusqu'à 12 s pour un demi-tour du monde. */
// Déclare et exporte routeDurationMs : la distance (km).
export const routeDurationMs = (km) => Math.round(3000 + 9000 * Math.min(1, Math.max(0, km) / 20000));

/** Altitude de croisière (m) : environ un tiers de la distance, entre 30 km et 4 000 km. */
// Déclare et exporte cruiseAltitudeM : la distance (km).
export const cruiseAltitudeM = (km) => Math.min(4e6, Math.max(3e4, (km * 1000) / 3));

/** Altitude (m) à la fraction t : de l'altitude de départ à celle d'arrivée, avec une bosse de croisière au milieu. */
// Déclare et exporte routeAltitudeM : la fraction, les altitudes de départ, d'arrivée et de croisière (début).
export function routeAltitudeM(t, startM, endM, cruiseM) {
  // Altitude de base : de l'une à l'autre.
  const base = startM + (endM - startM) * t;
  // Bosse : nulle aux deux bouts, la croisière au milieu.
  return base + Math.max(0, cruiseM - Math.max(startM, endM)) * Math.sin(Math.PI * t);
// Fin de routeAltitudeM.
}

/** Fraction adoucie (départ et arrivée en douceur). */
// Déclare et exporte easeRoute : la fraction du temps.
export const easeRoute = (u) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };
