// Importe le point du globe d'une longitude et d'une latitude (même repère que les autres calques de la Terre).
import { lonLatToUnit } from '../EruptionEngine/volcanoesMath.jsx';

// Calculs du calque des cyclones (sans three.js, donc testables seuls) : nettoyage de la liste reçue du serveur
// (/atmosphere/cyclones), couleurs et tailles par catégorie, repère local (est, nord, haut) d'un point du globe,
// positions et opacités de la trajectoire observée.
//
// Taille du tourbillon : le rayon moyen des vents de 34 nœuds quand le centre de prévision le publie (NHC), sinon un
// SYMBOLE par catégorie (ordre de grandeur réaliste d'un bouclier nuageux, 150 à 440 km de rayon). Le sens de
// rotation est physique : antihoraire dans l'hémisphère nord, horaire dans l'hémisphère sud. Rayons de vent par
// quadrant (34, 50, 64 nœuds) et trajectoire prévue viennent de la prévision officielle (statut « prévu »).

/** Couleur (échelle de Saffir-Simpson usuelle) et rayon du symbole (km) de chaque catégorie. */
// Déclare et exporte les styles par catégorie (début).
export const CYCLONE_STYLE = {
  // Dépression tropicale : bleu clair.
  TD: { color: '#5ebaff', radiusKm: 150, eye: 0 },
  // Tempête tropicale : cyan.
  TS: { color: '#00e5e0', radiusKm: 220, eye: 0 },
  // Catégorie 1 : jaune très pâle.
  C1: { color: '#ffffcc', radiusKm: 280, eye: 0.55 },
  // Catégorie 2 : jaune.
  C2: { color: '#ffe775', radiusKm: 320, eye: 0.7 },
  // Catégorie 3 : orangé.
  C3: { color: '#ffc140', radiusKm: 360, eye: 0.85 },
  // Catégorie 4 : orange.
  C4: { color: '#ff8f20', radiusKm: 400, eye: 1 },
  // Catégorie 5 : rouge.
  C5: { color: '#ff6060', radiusKm: 440, eye: 1 },
  // Intensité inconnue : gris.
  NC: { color: '#c8c8c8', radiusKm: 200, eye: 0 },
// Fin des styles.
};
/** Nombre maximal de cyclones dessinés. */
// Déclare et exporte le maximum : 30.
export const MAX_CYCLONES = 30;
/** Rayon de la Terre en kilomètres. */
// Déclare et exporte le rayon terrestre.
export const EARTH_KM = 6371;

/** Style d'une catégorie (inconnue : celui de NC). */
// Déclare et exporte styleOf : le code de catégorie.
export const styleOf = (code) => CYCLONE_STYLE[code] ?? CYCLONE_STYLE.NC;

/** Sens de rotation vu de l'espace : +1 antihoraire (nord), −1 horaire (sud). */
// Déclare et exporte spinOf : la latitude.
export const spinOf = (lat) => (lat >= 0 ? 1 : -1);

/** Nettoie la liste du serveur : cyclones aux coordonnées valides, trajectoire lisible, MAX_CYCLONES au plus. */
// Déclare et exporte normalizeCyclones : la liste reçue.
export function normalizeCyclones(list) {
  // Cyclones gardés.
  const out = [];
  // Identifiants déjà vus.
  const seen = new Set();
  // Pour chaque entrée, si la liste en est une (début).
  for (const c of Array.isArray(list) ? list : []) {
    // Position.
    const lon = Number(c?.lon), lat = Number(c?.lat);
    // Identifiant.
    const id = String(c?.id ?? `${lon},${lat}`);
    // Illisible, hors du globe ou déjà vu : ignoré.
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || seen.has(id)) continue;
    // Noté.
    seen.add(id);
    // Détails du serveur.
    const d = c.details ?? {};
    // Trajectoire : positions lisibles [lon, lat, heure, vent].
    const track = (Array.isArray(d.track) ? d.track : []).filter((p) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])) && Math.abs(Number(p[1])) <= 90 && Math.abs(Number(p[0])) <= 180).map((p) => [Number(p[0]), Number(p[1]), Number(p[2]) || 0, p[3] === null || p[3] === undefined ? null : Number(p[3])]);
    // Prévision officielle : échéances lisibles [lon, lat, heure, vent, catégorie], dans l'ordre.
    const forecast = (Array.isArray(d.forecast?.points) ? d.forecast.points : []).filter((p) => Number.isFinite(Number(p?.lon)) && Number.isFinite(Number(p?.lat)) && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180).map((p) => [Number(p.lon), Number(p.lat), Number(p.t) || 0, p.windKt === null || p.windKt === undefined ? null : Number(p.windKt), CYCLONE_STYLE[p.category] ? p.category : 'NC']);
    // Rayons de vent de l'analyse : seuils dont les quatre rayons (km) sont lisibles.
    const radii = normalizeRadii(d.windRadiiKm);
    // Cyclone gardé.
    out.push({ id, name: String(c.name || ''), lon, lat, category: CYCLONE_STYLE[d.category] ? d.category : 'NC', windKt: Number.isFinite(Number(d.windKt)) && d.windKt !== null ? Number(d.windKt) : null, pressureMb: Number.isFinite(Number(d.pressureMb)) && d.pressureMb !== null ? Number(d.pressureMb) : null, spin: spinOf(lat), track, forecast, radii, forecastIssuedAt: forecast.length ? String(d.forecast.issuedAt || '') : null, flags: Array.isArray(c.flags) ? c.flags.map(String) : [] });
    // Maximum atteint : arrêt.
    if (out.length >= MAX_CYCLONES) break;
  // Fin de la boucle.
  }
  // Renvoie les cyclones.
  return out;
// Fin de normalizeCyclones.
}

/** Repère local d'un point du globe : haut (normale), est et nord, unitaires ; est × nord = haut. */
// Déclare et exporte localFrame : longitude et latitude.
export function localFrame(lon, lat) {
  // Haut : le point du globe.
  const up = lonLatToUnit(lon, lat);
  // Longueur de la projection sur l'équateur ; aux pôles, une valeur minuscule évite la division par zéro.
  const el = Math.hypot(up[0], up[2]) || 1e-9;
  // Est : tangent au parallèle, vers les longitudes croissantes.
  const east = [up[2] / el, 0, -up[0] / el];
  // Nord : haut × est.
  const north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
  // Les trois axes.
  return { up, east, north };
// Fin de localFrame.
}

/**
 * Positions de la trajectoire à `radius` rayons du centre : les segments de plus de `stepDeg` degrés sont découpés
 * le long du grand cercle, pour que la ligne suive la courbure de la Terre sans passer sous le sol.
 */
// Déclare et exporte trackPositions : les positions [lon, lat, …], le rayon et le pas.
export function trackPositions(track, radius = 1.002, stepDeg = 1) {
  // Points de sortie.
  const out = [];
  // Pour chaque position (début).
  track.forEach((p, i) => {
    // Point du globe de la position.
    const b = lonLatToUnit(p[0], p[1]);
    // Première position : ajoutée telle quelle.
    if (i === 0) { out.push(...b.map((v) => v * radius)); return; }
    // Position précédente.
    const a = lonLatToUnit(track[i - 1][0], track[i - 1][1]);
    // Angle entre les deux.
    const ang = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    // Nombre de pas : un par `stepDeg` degrés, au moins un.
    const steps = Math.max(1, Math.ceil((ang * 180) / Math.PI / stepDeg - 1e-9));
    // Pour chaque pas : interpolation sphérique (slerp), puis mise au rayon.
    for (let s = 1; s <= steps; s++) {
      // Fraction du segment.
      const f = s / steps;
      // Poids du slerp (angle nul : interpolation linéaire).
      const wa = ang > 1e-9 ? Math.sin((1 - f) * ang) / Math.sin(ang) : 1 - f, wb = ang > 1e-9 ? Math.sin(f * ang) / Math.sin(ang) : f;
      // Point interpolé, au rayon voulu.
      out.push((a[0] * wa + b[0] * wb) * radius, (a[1] * wa + b[1] * wb) * radius, (a[2] * wa + b[2] * wb) * radius);
    // Fin des pas.
    }
  // Fin du parcours.
  });
  // Renvoie les positions.
  return new Float32Array(out);
// Fin de trackPositions.
}

/** Opacités le long de la trajectoire : de 0,25 (plus ancienne) à 1 (position courante). */
// Déclare et exporte trackAlphas : le nombre de points.
export function trackAlphas(count) {
  // Tableau des opacités.
  const a = new Float32Array(count);
  // Pour chaque point : montée régulière (un seul point : pleine opacité).
  for (let i = 0; i < count; i++) a[i] = count > 1 ? 0.25 + 0.75 * (i / (count - 1)) : 1;
  // Renvoie les opacités.
  return a;
// Fin de trackAlphas.
}

/** Texte court d'un cyclone : nom, catégorie et vent (kt et km/h), pression si connue. */
// Déclare et exporte cycloneSummary : le cyclone nettoyé.
export function cycloneSummary(c) {
  // Vent en nœuds et en km/h, s'il est connu.
  const wind = c.windKt === null ? '' : ` ${Math.round(c.windKt)} kt (${Math.round(c.windKt * 1.852)} km/h)`;
  // Pression, si elle est connue.
  const pressure = c.pressureMb === null ? '' : ` · ${Math.round(c.pressureMb)} hPa`;
  // Prévision officielle : sa dernière échéance, en jours.
  const fc = c.forecast?.length > 1 ? ` · prévision sur ${Math.round((c.forecast[c.forecast.length - 1][2] - c.forecast[0][2]) / 86_400_000)} j` : '';
  // Rayons de vent publiés.
  const radii = c.radii ? ' · rayons de vent' : '';
  // Nom, catégorie, vent, pression, prévision et rayons.
  return `${c.name || 'Sans nom'} · ${c.category === 'NC' ? 'intensité inconnue' : c.category}${wind}${pressure}${fc}${radii}`;
// Fin de cycloneSummary.
}

/** Seuils des rayons de vent (nœuds) et leur couleur : jaune (34), orange (50), rouge (64), comme les cartes du NHC. */
// Déclare et exporte les couleurs des rayons de vent.
export const RADII_STYLE = { 34: '#ffd84a', 50: '#ff9a3c', 64: '#ff4d4d' };

/** Rayons de vent lus : { 34: [NE, SE, SO, NO] en km, … }, seuils incomplets ou nuls écartés ; null si aucun. */
// Déclare et exporte normalizeRadii : l'objet du serveur.
export function normalizeRadii(raw) {
  // Rayons gardés.
  const out = {};
  // Pour chaque seuil (début).
  for (const kt of [34, 50, 64]) {
    // Ses quatre rayons.
    const r = raw?.[kt];
    // Quatre nombres positifs ou nuls, entre 0 et 2 500 km, dont un au moins non nul : gardés.
    if (Array.isArray(r) && r.length === 4 && r.every((v) => Number.isFinite(Number(v)) && v !== null && Number(v) >= 0 && Number(v) <= 2500) && r.some((v) => Number(v) > 0)) out[kt] = r.map(Number);
  // Fin des seuils.
  }
  // Aucun seuil : null.
  return Object.keys(out).length ? out : null;
// Fin de normalizeRadii.
}

/** Point du globe à une distance (km) et un cap (degrés depuis le nord, sens horaire) d'un point de départ. */
// Déclare et exporte destination : longitude, latitude, cap et distance.
export function destination(lon, lat, bearingDeg, km) {
  // Degrés vers radians.
  const r = Math.PI / 180;
  // Distance angulaire, cap et latitude de départ.
  const d = km / EARTH_KM, b = bearingDeg * r, la1 = lat * r;
  // Latitude d'arrivée.
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  // Longitude d'arrivée.
  const lo2 = lon * r + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  // En degrés, longitude ramenée entre −180 et 180.
  return [((((lo2 / r) + 540) % 360) - 180), la2 / r];
// Fin de destination.
}

/**
 * Contour d'un seuil de vent autour du centre : quart de cercle NE (caps 0 à 90°), SE, SO puis NO, chacun à son rayon ;
 * un quadrant nul se réduit au centre. Rend des positions sur la sphère (rayon `radius`), boucle fermée.
 */
// Déclare et exporte radiiOutline : longitude, latitude, les quatre rayons (km), le rayon de pose et le pas (degrés).
export function radiiOutline(lon, lat, radiiKm, radius = 1.0025, stepDeg = 6) {
  // Points de sortie.
  const out = [];
  // Pour chaque quadrant (début).
  for (let q = 0; q < 4; q++) {
    // Pour chaque cap du quart de cercle (bornes comprises).
    for (let a = q * 90; a <= (q + 1) * 90 + 1e-9; a += stepDeg) {
      // Point au rayon du quadrant (centre pour un rayon nul).
      const [plon, plat] = radiiKm[q] > 0 ? destination(lon, lat, a, radiiKm[q]) : [lon, lat];
      // Sur la sphère, au rayon de pose.
      out.push(...lonLatToUnit(plon, plat).map((v) => v * radius));
    // Fin des caps.
    }
  // Fin des quadrants.
  }
  // Boucle fermée : le premier point répété.
  out.push(out[0], out[1], out[2]);
  // Renvoie les positions.
  return new Float32Array(out);
// Fin de radiiOutline.
}

/** Opacités en pointillés le long d'un tracé : `on` points visibles puis `off` points éteints, en alternance. */
// Déclare et exporte dashAlphas : le nombre de points, la longueur des traits et des blancs, et l'opacité des traits.
export function dashAlphas(count, on = 2, off = 2, alpha = 0.9) {
  // Tableau des opacités.
  const a = new Float32Array(count);
  // Pour chaque point : trait ou blanc selon sa place dans le motif.
  for (let i = 0; i < count; i++) a[i] = i % (on + off) < on ? alpha : 0;
  // Renvoie les opacités.
  return a;
// Fin de dashAlphas.
}

/** Rayon du tourbillon (km) : le rayon moyen des vents de 34 nœuds s'il est publié (taille réelle), sinon le symbole. */
// Déclare et exporte vortexRadiusKm : le cyclone nettoyé.
export function vortexRadiusKm(c) {
  // Rayons des vents de 34 nœuds.
  const r = c.radii?.[34];
  // Quadrants non nuls.
  const nz = r ? r.filter((v) => v > 0) : [];
  // Moyenne publiée, sinon le rayon du symbole de la catégorie.
  return nz.length ? nz.reduce((s, v) => s + v, 0) / nz.length : styleOf(c.category).radiusKm;
// Fin de vortexRadiusKm.
}
