// Format commun, identifiants, distance, fusion des confiances.
import { AtmosphericEvent, EARTH_RADIUS_KM, haversineKm, makeEventId } from './atmospheric-event';
// Cap entre deux points (déjà utilisé pour le déplacement des cyclones).
import { bearingDeg } from './cyclones';
// Codage des réflectivités et intensité estimée.
import { DBZ_CODE_OFFSET, rainRateMmH } from './radar';

// Cellules orageuses estimées d'après le radar (StormEngine, partie données). Méthode : sur la mosaïque mondiale des
// réflectivités, une cellule est une zone d'un seul tenant d'au moins 40 dBZ contenant un noyau d'au moins 45 dBZ
// (seuil usuel de la convection profonde) ; elle est suivie d'une image à l'autre (10 minutes) par le plus proche
// voisin compatible avec une vitesse plausible, ce qui donne sa persistance et son déplacement. C'est une ESTIMATION :
// le radar ne voit pas la foudre, une forte réflectivité peut venir de grêle fondante, de pluie stratiforme intense ou
// d'un écho parasite ; la persistance sur plusieurs images réduit ce dernier risque, sans l'annuler.

/** Seuil de la zone de la cellule, en dBZ. */
// Déclare et exporte le seuil de la zone.
export const CELL_EDGE_DBZ = 40;
/** Seuil du noyau convectif, en dBZ. */
// Déclare et exporte le seuil du noyau.
export const CELL_CORE_DBZ = 45;
/** Nombre minimal de pixels d'une cellule (un pixel isolé est trop souvent un écho parasite). */
// Déclare et exporte la taille minimale.
export const CELL_MIN_PIXELS = 2;
/** Vitesse maximale plausible d'une cellule, km/h (au-delà, deux cellules ne sont pas la même). */
// Déclare et exporte la vitesse maximale.
export const MAX_CELL_SPEED_KMH = 120;
/** Marge de résolution ajoutée à la distance de suivi, km (la position d'une cellule est connue à un pixel près). */
// Déclare et exporte la marge de suivi.
export const TRACK_SLACK_KM = 25;
/** Nombre maximal de cellules rendues (les plus fortes d'abord). */
// Déclare et exporte la limite.
export const MAX_CELLS = 1500;
// Circonférence équatoriale de la Terre, km.
const EARTH_CIRC_KM = 2 * Math.PI * EARTH_RADIUS_KM;

/** Grille de réflectivités dans le plan Web Mercator mondial : codes de la pluie et de la neige, origine et taille. */
// Forme de la grille.
export interface RadarGrid {
  // rain, snow : codes par pixel (voir radar.ts), ligne par ligne.
  rain: Uint8Array; snow: Uint8Array;
  // width, height : les dimensions de la grille.
  width: number; height: number;
  // worldPx : le côté du monde entier en pixels à ce niveau (512 × 2^z).
  worldPx: number;
  // x0, y0 : la position du coin haut-gauche de la grille dans le monde, en pixels.
  x0: number; y0: number;
// Fin de RadarGrid.
}

/** Une cellule détectée sur une image. */
// Forme d'une cellule.
export interface RadarCell {
  // lon, lat : le centre, pondéré par la réflectivité linéaire (le noyau compte davantage).
  lon: number; lat: number;
  // maxDbz, meanDbz : la réflectivité maximale et moyenne de la zone.
  maxDbz: number; meanDbz: number;
  // areaKm2 : la surface de la zone (≥ 40 dBZ) ; coreKm2 : celle du noyau (≥ 45 dBZ).
  areaKm2: number; coreKm2: number;
  // pixels : le nombre de pixels ; snowShare : la part de pixels de neige.
  pixels: number; snowShare: number;
  // bbox : l'emprise ouest, sud, est, nord (degrés ; l'ouest peut dépasser l'est à l'antiméridien).
  bbox: [number, number, number, number];
// Fin de RadarCell.
}

/** Longitude et latitude (degrés) d'un point du plan Mercator mondial donné en pixels. */
// Déclare et exporte pixelToLonLat : abscisse, ordonnée, côté du monde.
export function pixelToLonLat(px: number, py: number, worldPx: number): [number, number] {
  // Longitude : proportionnelle à l'abscisse, ramenée entre −180 et 180.
  const lon = ((((px / worldPx) * 360 - 180) + 540) % 360) - 180;
  // Latitude : inverse de Mercator.
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / worldPx))) * 180) / Math.PI;
  // Point.
  return [lon, lat];
// Fin de pixelToLonLat.
}

/** Surface (km²) d'un pixel de la ligne `py` du plan Mercator mondial : côté équatorial × cos(latitude), au carré. */
// Déclare et exporte pixelAreaKm2 : ordonnée du centre du pixel, côté du monde.
export function pixelAreaKm2(py: number, worldPx: number): number {
  // Latitude du centre du pixel.
  const lat = pixelToLonLat(0, py, worldPx)[1];
  // Côté du pixel, km.
  const side = (EARTH_CIRC_KM / worldPx) * Math.cos((lat * Math.PI) / 180);
  // Surface.
  return side * side;
// Fin de pixelAreaKm2.
}

/**
 * Détecte les cellules d'une grille : zones connexes (8 voisins) d'au moins 40 dBZ, pluie ou neige, contenant un noyau
 * d'au moins 45 dBZ, d'au moins 2 pixels. Une grille couvrant toute la largeur du monde est refermée à l'antiméridien.
 */
// Déclare et exporte detectCells : la grille.
export function detectCells(g: RadarGrid): RadarCell[] {
  // Codes des seuils.
  const edge = CELL_EDGE_DBZ + DBZ_CODE_OFFSET, core = CELL_CORE_DBZ + DBZ_CODE_OFFSET;
  // Grille refermée en longitude si elle couvre le monde entier.
  const wraps = g.x0 === 0 && g.width === g.worldPx;
  // Pixels déjà rangés dans une cellule.
  const seen = new Uint8Array(g.width * g.height);
  // Pile de parcours : indices et abscisses dépliées (pour les cellules à cheval sur l'antiméridien).
  const stackI: number[] = [], stackX: number[] = [];
  // Cellules trouvées.
  const cells: RadarCell[] = [];
  // code : le plus fort des deux codes d'un pixel (pluie ou neige).
  const code = (i: number): number => Math.max(g.rain[i], g.snow[i]);
  // Surface d'un pixel par ligne, calculée une fois.
  const rowArea = Float64Array.from({ length: g.height }, (_, y) => pixelAreaKm2(g.y0 + y + 0.5, g.worldPx));
  // Pixel par pixel, à la recherche d'un départ de zone (début).
  for (let start = 0; start < seen.length; start++) {
    // Déjà rangé, ou sous le seuil de la zone : suivant.
    if (seen[start] || code(start) < edge) continue;
    // Parcours de la zone : départ empilé et marqué.
    stackI.push(start); stackX.push(start % g.width); seen[start] = 1;
    // Cumuls : pixels, neige, poids, positions pondérées, réflectivités, surfaces, bornes.
    let n = 0, nSnow = 0, w = 0, sx = 0, sy = 0, sumDbz = 0, maxCode = 0, area = 0, coreArea = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // Tant que la pile n'est pas vide (début).
    while (stackI.length) {
      // Pixel suivant et son abscisse dépliée.
      const i = stackI.pop() as number, ux = stackX.pop() as number;
      // Ligne du pixel.
      const y = (i / g.width) | 0;
      // Code et réflectivité.
      const c = code(i), dbz = c - DBZ_CODE_OFFSET;
      // Poids : réflectivité linéaire relative au seuil (le noyau domine le centre).
      const wt = 10 ** ((dbz - CELL_EDGE_DBZ) / 10);
      // Cumuls.
      n++; if (g.snow[i] > g.rain[i]) nSnow++; w += wt; sx += wt * (ux + 0.5); sy += wt * (y + 0.5); sumDbz += dbz; if (c > maxCode) maxCode = c; area += rowArea[y]; if (c >= core) coreArea += rowArea[y];
      // Bornes.
      if (ux < minX) minX = ux; if (ux > maxX) maxX = ux; if (y < minY) minY = y; if (y > maxY) maxY = y;
      // Les 8 voisins (début).
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        // Le pixel lui-même : ignoré.
        if (!dx && !dy) continue;
        // Ligne voisine hors de la grille : ignorée.
        const ny = y + dy; if (ny < 0 || ny >= g.height) continue;
        // Abscisse voisine dépliée, puis ramenée dans la grille (refermée, ou bornée).
        const nux = ux + dx, nx = ((nux % g.width) + g.width) % g.width; if (!wraps && (nux < 0 || nux >= g.width)) continue;
        // Indice voisin.
        const j = ny * g.width + nx;
        // Déjà rangé, ou sous le seuil : ignoré.
        if (seen[j] || code(j) < edge) continue;
        // Marqué et empilé.
        seen[j] = 1; stackI.push(j); stackX.push(nux);
      // Fin des voisins.
      }
    // Fin du parcours de la zone.
    }
    // Sans noyau, ou trop petite : écartée.
    if (maxCode < core || n < CELL_MIN_PIXELS) continue;
    // Centre pondéré, dans le monde.
    const [lon, lat] = pixelToLonLat(g.x0 + sx / w, g.y0 + sy / w, g.worldPx);
    // Coins de l'emprise.
    const [west, north] = pixelToLonLat(g.x0 + minX, g.y0 + minY, g.worldPx), [east, south] = pixelToLonLat(g.x0 + maxX + 1, g.y0 + maxY + 1, g.worldPx);
    // Cellule gardée, arrondie (centre au centième de degré, surfaces au km²).
    cells.push({ lon: round(lon, 3), lat: round(lat, 3), maxDbz: maxCode - DBZ_CODE_OFFSET, meanDbz: round(sumDbz / n, 1), areaKm2: Math.round(area), coreKm2: Math.round(coreArea), pixels: n, snowShare: round(nSnow / n, 2), bbox: [round(west, 3), round(south, 3), round(east, 3), round(north, 3)] });
  // Fin de la recherche.
  }
  // Les plus fortes d'abord, puis les plus étendues ; coupées à la limite.
  return cells.sort((a, b) => b.maxDbz - a.maxDbz || b.areaKm2 - a.areaKm2).slice(0, MAX_CELLS);
// Fin de detectCells.
}

// round : arrondi à `d` décimales.
function round(v: number, d: number): number {
  // Facteur.
  const f = 10 ** d;
  // Arrondi.
  return Math.round(v * f) / f;
// Fin de round.
}

/**
 * Associe chaque cellule d'une image à une cellule de l'image précédente (`dtMin` minutes plus tôt) : le plus proche
 * voisin à moins de la distance permise par la vitesse maximale (plus la marge de résolution), chaque cellule
 * précédente servant au plus une fois, les paires les plus proches d'abord. Rend, pour chaque cellule, l'indice de la
 * précédente ou −1.
 */
// Déclare et exporte matchCells : cellules courantes, précédentes, écart de temps (minutes).
export function matchCells(current: RadarCell[], previous: RadarCell[], dtMin: number): number[] {
  // Distance maximale, km.
  const maxKm = (MAX_CELL_SPEED_KMH * dtMin) / 60 + TRACK_SLACK_KM;
  // Paires candidates : (courante, précédente, distance).
  const pairs: [number, number, number][] = [];
  // Pour chaque paire proche (début).
  current.forEach((c, i) => previous.forEach((p, j) => {
    // Écart rapide en latitude (1° ≈ 111 km) : trop loin, ignorée.
    if (Math.abs(c.lat - p.lat) * 111 > maxKm) return;
    // Distance sur la sphère.
    const d = haversineKm(c.lon, c.lat, p.lon, p.lat);
    // Assez proche : candidate.
    if (d <= maxKm) pairs.push([i, j, d]);
  // Fin des paires.
  }));
  // Les plus proches d'abord.
  pairs.sort((a, b) => a[2] - b[2]);
  // Résultat : −1 par défaut ; précédentes déjà prises.
  const match = current.map(() => -1), taken = new Set<number>();
  // Attribution gloutonne.
  for (const [i, j] of pairs) if (match[i] < 0 && !taken.has(j)) { match[i] = j; taken.add(j); }
  // Associations.
  return match;
// Fin de matchCells.
}

/** Cellule de la dernière image, avec sa persistance et son déplacement estimé. */
// Forme d'une cellule suivie.
export interface TrackedCell extends RadarCell {
  // frames : le nombre d'images consécutives où la cellule est suivie (1 : nouvelle).
  frames: number;
  // track : les positions passées, de la plus ancienne à la plus récente ([lon, lat, heure ms]).
  track: [number, number, number][];
  // motion : le déplacement estimé (cap vers lequel elle va, vitesse), sur au moins 20 minutes, ou null.
  motion: { bearingDeg: number; speedKmh: number; overMin: number } | null;
// Fin de TrackedCell.
}

/**
 * Suit les cellules de la dernière image à travers les précédentes (`frames` : de la plus ancienne à la plus récente,
 * chacune avec son heure). Le déplacement est mesuré entre la position la plus ancienne suivie et la dernière, si elles
 * sont séparées d'au moins 20 minutes (en deçà, l'imprécision d'un pixel domine).
 */
// Déclare et exporte trackCells : les images (heure et cellules).
export function trackCells(frames: { time: number; cells: RadarCell[] }[]): TrackedCell[] {
  // Aucune image : aucune cellule.
  if (!frames.length) return [];
  // Dernière image.
  const last = frames[frames.length - 1];
  // Associations de chaque image avec la précédente (index i : image i avec i − 1).
  const links = frames.map((f, i) => (i ? matchCells(f.cells, frames[i - 1].cells, (f.time - frames[i - 1].time) / 60_000) : []));
  // Pour chaque cellule de la dernière image (début).
  return last.cells.map((cell, k) => {
    // Positions suivies, en remontant le temps.
    const track: [number, number, number][] = [[cell.lon, cell.lat, last.time]];
    // Indice courant dans l'image courante.
    let idx = k;
    // Remontée image par image tant que l'association existe.
    for (let i = frames.length - 1; i > 0 && idx >= 0; i--) { idx = links[i][idx]; if (idx >= 0) { const p = frames[i - 1].cells[idx]; track.unshift([p.lon, p.lat, frames[i - 1].time]); } }
    // Position la plus ancienne suivie.
    const first = track[0];
    // Durée suivie, minutes.
    const overMin = (last.time - first[2]) / 60_000;
    // Distance parcourue, km.
    const km = haversineKm(first[0], first[1], cell.lon, cell.lat);
    // Déplacement : sur au moins 20 minutes, sinon inconnu.
    const motion = overMin >= 20 ? { bearingDeg: Math.round(bearingDeg(first[0], first[1], cell.lon, cell.lat)), speedKmh: Math.round((km / overMin) * 60), overMin: Math.round(overMin) } : null;
    // Cellule suivie.
    return { ...cell, frames: track.length, track, motion };
  // Fin du parcours.
  });
// Fin de trackCells.
}

/** Libellé de l'intensité d'une cellule selon sa réflectivité maximale. */
// Déclare et exporte cellLabel : la réflectivité maximale.
export const cellLabel = (maxDbz: number): string => (maxDbz >= 55 ? 'cellule convective très forte' : maxDbz >= 50 ? 'cellule convective forte' : 'cellule convective modérée');

/** Confiance d'une cellule : 0,5 (une image), 0,65 (deux), 0,75 (trois ou plus), +0,05 si le noyau dépasse 50 dBZ. */
// Déclare et exporte cellConfidence : la cellule suivie.
export const cellConfidence = (c: TrackedCell): number => Math.round(((c.frames >= 3 ? 0.75 : c.frames === 2 ? 0.65 : 0.5) + (c.maxDbz >= 50 ? 0.05 : 0)) * 100) / 100;

/** Cellule suivie → événement « storm » au format commun (estimé, non confirmé). */
// Déclare et exporte cellToEvent : la cellule, l'heure de l'image, l'identifiant de l'image et l'heure de lecture.
export function cellToEvent(c: TrackedCell, frameTime: number, frameId: string, fetchedAt: string): AtmosphericEvent {
  // Heure de l'image, en ISO.
  const at = new Date(frameTime).toISOString();
  // Drapeaux : nouvelle cellule, neige.
  const flags = [...(c.frames === 1 ? ['cellule vue sur une seule image (écho parasite possible)'] : []), ...(c.snowShare > 0.5 ? ['majoritairement de la neige'] : [])];
  // Événement (début).
  return {
    // Identifiant (image et position), famille, nom.
    id: makeEventId('storm', 'radar-cells', `${frameId}:${c.lon.toFixed(2)},${c.lat.toFixed(2)}`), type: 'storm', name: null,
    // Centre et emprise.
    lon: c.lon, lat: c.lat, geometry: { type: 'Polygon', coordinates: [[[c.bbox[0], c.bbox[1]], [c.bbox[2], c.bbox[1]], [c.bbox[2], c.bbox[3]], [c.bbox[0], c.bbox[3]], [c.bbox[0], c.bbox[1]]]] },
    // Altitude : inconnue (composite de réflectivité, pas de sommet d'écho).
    altitudeM: null,
    // Heures : celle de l'image.
    detectedAt: at, validFrom: at, validTo: at,
    // Intensité : réflectivité maximale.
    intensity: { value: c.maxDbz, unit: 'dBZ', label: cellLabel(c.maxDbz) },
    // Confiance et provenance.
    confidence: cellConfidence(c), sources: [{ provider: 'rainviewer', sourceId: frameId, url: null, observedAt: at, fetchedAt }],
    // Résolution : celle de la grille mondiale de détection (environ 20 km à l'équateur), 10 minutes.
    resolution: { spatialM: 19_600, temporalS: 600 },
    // Estimée d'après le radar, jamais « confirmée » (le radar ne voit pas la foudre).
    status: 'estimé', confirmed: false, flags,
    // Détails : méthode, surfaces, intensité estimée, persistance, trajectoire et déplacement.
    details: { method: `zone ≥ ${CELL_EDGE_DBZ} dBZ avec noyau ≥ ${CELL_CORE_DBZ} dBZ (composite radar)`, meanDbz: c.meanDbz, areaKm2: c.areaKm2, coreKm2: c.coreKm2, rainRateMmH: rainRateMmH(c.maxDbz, c.snowShare > 0.5), rainRateMethod: 'Marshall-Palmer (estimation)', snowShare: c.snowShare, frames: c.frames, track: c.track.map(([lon, lat, t]) => [lon, lat, new Date(t).toISOString()]), motion: c.motion ? { ...c.motion, status: 'estimé' } : null },
  // Fin de l'événement.
  };
// Fin de cellToEvent.
}
