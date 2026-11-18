// Importe le point du globe d'une longitude et d'une latitude (même repère que les autres calques de la Terre).
import { lonLatToUnit } from '../../EruptionEngine/volcanoesMath.jsx';

// Calculs du calque des incendies (sans three.js, donc testables seuls) : nettoyage des colonnes reçues du serveur
// (/atmosphere/fires et /atmosphere/fires/tiles), tableaux envoyés au shader de fireLayer.jsx, choix des tuiles de
// détail autour du point visé. Trois natures de points, distinguées dans le shader :
//  - FIRE_KIND.cell      : cellule agrégée de 0,5° (points chauds de la vue du globe) ;
//  - FIRE_KIND.hotspot   : point chaud un par un (vue rapprochée, par tuile de 10°) ;
//  - FIRE_KIND.confirmed : incendie CONFIRMÉ par une agence (anneau), à ne pas confondre avec un point chaud.

/** Natures des points du calque. */
// Déclare et exporte les trois natures.
export const FIRE_KIND = { cell: 0, hotspot: 1, confirmed: 2 };
/** Nombre maximal de points d'un nuage : protège la carte graphique d'une réponse démesurée. */
// Déclare et exporte le maximum : 60 000 points.
export const MAX_FIRE_POINTS = 60_000;
/** Taille des tuiles de détail, en degrés (la même que le serveur). */
// Déclare et exporte la taille des tuiles : 10 degrés.
export const FIRE_TILE_DEG = 10;
/** Altitude (en rayons terrestres) sous laquelle le détail par tuile est chargé : environ 3 000 km. */
// Déclare et exporte le seuil du détail.
export const FIRE_DETAIL_ALT = 0.47;
/** Fenêtres de temps proposées, en heures. */
// Déclare et exporte les fenêtres : 3, 6, 12 et 24 heures.
export const FIRE_WINDOWS_H = [3, 6, 12, 24];

// col : la colonne `name` de l'objet si c'est un tableau, sinon un tableau vide.
const col = (o, name) => (Array.isArray(o?.[name]) ? o[name] : []);

/**
 * Colonnes du serveur vers une liste de points { lon, lat, frp, ageMin, n, conf, kind } : valeurs illisibles et
 * coordonnées hors du globe écartées, MAX_FIRE_POINTS au plus.
 */
// Déclare et exporte normalizeFireColumns : les colonnes et la nature des points.
export function normalizeFireColumns(columns, kind) {
  // Colonnes de position.
  const lon = col(columns, 'lon'), lat = col(columns, 'lat');
  // Colonnes de mesure.
  const frp = col(columns, 'frp'), age = col(columns, 'ageMin'), n = col(columns, 'n'), conf = col(columns, 'conf');
  // Points gardés.
  const out = [];
  // Pour chaque ligne (début).
  for (let i = 0; i < lon.length && out.length < MAX_FIRE_POINTS; i++) {
    // Position.
    const lo = Number(lon[i]), la = Number(lat[i]);
    // Hors du globe ou illisible : ignorée.
    if (!Number.isFinite(lo) || !Number.isFinite(la) || Math.abs(la) > 90 || Math.abs(lo) > 180) continue;
    // Point : mesures absentes ramenées à des valeurs neutres.
    out.push({ lon: lo, lat: la, frp: Math.max(0, Number(frp[i]) || 0), ageMin: Math.max(0, Number(age[i]) || 0), n: Math.max(1, Number(n[i]) || 1), conf: Math.min(1, Math.max(0, Number(conf[i] ?? 1) || 0)), kind });
  // Fin de la boucle.
  }
  // Renvoie les points.
  return out;
// Fin de normalizeFireColumns.
}

/** Incendies confirmés (événements au format commun) vers des points ; âge compté depuis `now`. */
// Déclare et exporte confirmedToPoints : les événements et l'instant de référence (ms).
export function confirmedToPoints(events, now) {
  // Points gardés.
  const out = [];
  // Pour chaque événement, si la liste en est une (début).
  for (const e of Array.isArray(events) ? events : []) {
    // Position.
    const lon = Number(e?.lon), lat = Number(e?.lat);
    // Illisible ou pas un incendie confirmé : ignoré.
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || e?.confirmed !== true) continue;
    // Heure de la dernière mise à jour.
    const t = Date.parse(e.detectedAt);
    // Point : âge en minutes, surface en hectares à la place de la puissance.
    out.push({ lon, lat, frp: Math.max(0, Number(e?.intensity?.value) || 0), ageMin: Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60_000)) : 0, n: 1, conf: 1, kind: FIRE_KIND.confirmed });
  // Fin de la boucle.
  }
  // Renvoie les points.
  return out;
// Fin de confirmedToPoints.
}

/**
 * Tableaux du shader : `position` (point du globe, 3 nombres) ; `fire` (puissance, heure de la détection en minutes
 * sur l'horloge du calque, nombre de détections, confiance) ; `kind` (nature) ; `seed` (graine du scintillement, entre
 * 0 et 1). L'heure de la détection vaut `refMin − âge` : `refMin` est l'heure de réception de la réponse sur l'horloge
 * du calque, si bien que le shader recalcule l'âge à chaque image (heure courante − heure de la détection) sans
 * reconstruire les tableaux, et avec de petits nombres (précision des flottants de la carte graphique).
 */
// Déclare et exporte buildFireAttributes : les points et l'heure de réception (minutes, horloge du calque).
export function buildFireAttributes(points, refMin = 0) {
  // Nombre de points.
  const count = points.length;
  // Positions.
  const position = new Float32Array(count * 3);
  // Mesures.
  const fire = new Float32Array(count * 4);
  // Natures.
  const kind = new Float32Array(count);
  // Graines.
  const seed = new Float32Array(count);
  // Pour chaque point (début).
  points.forEach((p, i) => {
    // Point du globe.
    const [x, y, z] = lonLatToUnit(p.lon, p.lat);
    // Position.
    position.set([x, y, z], i * 3);
    // Mesures : puissance, heure de la détection, nombre, confiance.
    fire.set([p.frp, refMin - p.ageMin, p.n, p.conf], i * 4);
    // Nature.
    kind[i] = p.kind;
    // Graine tirée de la position (stable d'une lecture à l'autre).
    seed[i] = Math.abs(Math.sin(p.lon * 12.9898 + p.lat * 78.233) * 43758.5453) % 1;
  // Fin du parcours.
  });
  // Renvoie les tableaux.
  return { count, position, fire, kind, seed };
// Fin de buildFireAttributes.
}

/** Colonne et ligne de la tuile qui contient un point (comme le serveur : depuis −180° et −90°). */
// Déclare et exporte fireTileOf : longitude et latitude.
export function fireTileOf(lon, lat) {
  // Colonne, bornée.
  const tx = Math.min(35, Math.max(0, Math.floor((lon + 180) / FIRE_TILE_DEG)));
  // Ligne, bornée.
  const ty = Math.min(17, Math.max(0, Math.floor((lat + 90) / FIRE_TILE_DEG)));
  // Les deux indices.
  return { tx, ty };
// Fin de fireTileOf.
}

/**
 * Tuiles de détail utiles autour du point visé : celles dont le centre est à moins de `radiusDeg` degrés d'arc,
 * les plus proches d'abord, `max` au plus. Clés « colonne,ligne ».
 */
// Déclare et exporte tilesAround : longitude et latitude visées, rayon en degrés et maximum.
export function tilesAround(lon, lat, radiusDeg, max = 16) {
  // Point visé sur le globe.
  const c = lonLatToUnit(lon, lat);
  // Tuiles retenues, avec leur distance.
  const found = [];
  // Pour chaque tuile du globe (début).
  for (let tx = 0; tx < 36; tx++) for (let ty = 0; ty < 18; ty++) {
    // Centre de la tuile.
    const p = lonLatToUnit(-180 + (tx + 0.5) * FIRE_TILE_DEG, -90 + (ty + 0.5) * FIRE_TILE_DEG);
    // Angle entre le centre et le point visé, en degrés.
    const deg = (Math.acos(Math.min(1, Math.max(-1, c[0] * p[0] + c[1] * p[1] + c[2] * p[2]))) * 180) / Math.PI;
    // Distance réduite de la demi-diagonale de la tuile (≈ 7°) : une tuile touchée par le cercle compte.
    if (deg - 7.1 <= radiusDeg) found.push({ key: `${tx},${ty}`, tx, ty, deg });
  // Fin des tuiles.
  }
  // Les plus proches d'abord, coupées au maximum.
  return found.sort((a, b) => a.deg - b.deg).slice(0, max);
// Fin de tilesAround.
}

/** Rayon utile (degrés d'arc) vu depuis une altitude en rayons terrestres : l'angle jusqu'à l'horizon, borné. */
// Déclare et exporte viewRadiusDeg : l'altitude.
export function viewRadiusDeg(alt) {
  // Angle de l'horizon depuis le centre : acos(1 / (1 + h)).
  const deg = (Math.acos(1 / (1 + Math.max(0, alt))) * 180) / Math.PI;
  // Borné entre 5 et 35 degrés.
  return Math.min(35, Math.max(5, deg));
// Fin de viewRadiusDeg.
}

/** Réunit les points de plusieurs tuiles de détail (dans l'ordre donné), MAX_FIRE_POINTS au plus. */
// Déclare et exporte mergeDetailTiles : les listes de points.
export function mergeDetailTiles(lists) {
  // Points réunis.
  const out = [];
  // Pour chaque liste (début).
  for (const list of lists) {
    // Pour chaque point, tant que le maximum n'est pas atteint : ajouté.
    for (const p of list) { if (out.length >= MAX_FIRE_POINTS) return out; out.push(p); }
  // Fin des listes.
  }
  // Renvoie les points.
  return out;
// Fin de mergeDetailTiles.
}
