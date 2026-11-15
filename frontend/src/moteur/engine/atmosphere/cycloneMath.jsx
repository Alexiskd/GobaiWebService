// Importe le point du globe d'une longitude et d'une latitude (même repère que les autres calques de la Terre).
import { lonLatToUnit } from '../volcanoesMath';

// Calculs du calque des cyclones (sans three.js, donc testables seuls) : nettoyage de la liste reçue du serveur
// (/atmosphere/cyclones), couleurs et tailles par catégorie, repère local (est, nord, haut) d'un point du globe,
// positions et opacités de la trajectoire observée.
//
// La taille du tourbillon dessiné est un SYMBOLE par catégorie (ordre de grandeur réaliste d'un bouclier nuageux,
// 150 à 440 km de rayon) : les rayons de vent ne sont pas encore fournis par les sources branchées. Le sens de
// rotation, lui, est physique : antihoraire dans l'hémisphère nord, horaire dans l'hémisphère sud.

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
    // Cyclone gardé.
    out.push({ id, name: String(c.name || ''), lon, lat, category: CYCLONE_STYLE[d.category] ? d.category : 'NC', windKt: Number.isFinite(Number(d.windKt)) && d.windKt !== null ? Number(d.windKt) : null, pressureMb: Number.isFinite(Number(d.pressureMb)) && d.pressureMb !== null ? Number(d.pressureMb) : null, spin: spinOf(lat), track, flags: Array.isArray(c.flags) ? c.flags.map(String) : [] });
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
  // Nom, catégorie, vent et pression.
  return `${c.name || 'Sans nom'} · ${c.category === 'NC' ? 'intensité inconnue' : c.category}${wind}${pressure}`;
// Fin de cycloneSummary.
}
