// Importe la conversion longitude, latitude → point de la sphère unité.
import { lonLatToUnit } from '../../EruptionEngine/volcanoesMath.jsx';
// Importe le point d'arrivée d'un déplacement sur le globe.
import { destination } from './cycloneMath.jsx';

// Calcul du radar des précipitations et des orages (sans three.js, donc testable seul) : choix des images et des
// tuiles, codage des réflectivités servi par le serveur, légende, mise en forme des cellules orageuses estimées et
// des avertissements officiels.

/** Niveau des tuiles de la vue mondiale : 1 (2 × 2 tuiles de 512 px, 1 024 px pour le tour du monde). */
// Déclare et exporte le niveau mondial.
export const RADAR_GLOBAL_ZOOM = 1;
/** Niveau des tuiles du détail autour du point visé : 5 (environ 2,4 km par pixel à l'équateur). */
// Déclare et exporte le niveau du détail.
export const RADAR_DETAIL_ZOOM = 5;
/** Côté des tuiles, en pixels. */
// Déclare et exporte le côté des tuiles.
export const RADAR_TILE_PX = 512;
/** Tuiles par côté du bloc de détail (2 × 2 : 1 024 px, environ 22° de longitude). */
// Déclare et exporte la taille du bloc de détail.
export const RADAR_DETAIL_TILES = 2;
/** Altitude (rayons terrestres) sous laquelle le détail est chargé (≈ 2 900 km) ; au-dessus de 0,7, il est libéré. */
// Déclare et exporte l'altitude du chargement du détail.
export const RADAR_DETAIL_ALT = 0.45;
// Déclare et exporte l'altitude de la libération du détail.
export const RADAR_DETAIL_RELEASE_ALT = 0.7;
/** Nombre d'images de l'animation : 6 (les 50 dernières minutes, une image toutes les 10 minutes). */
// Déclare et exporte le nombre d'images animées.
export const RADAR_ANIM_FRAMES = 6;
/** Durée d'une image dans l'animation (s) et pause sur la dernière (s). */
// Déclare et exporte la durée d'une image.
export const RADAR_STEP_S = 0.8;
// Déclare et exporte la pause sur la dernière image.
export const RADAR_HOLD_S = 1.8;
/** Codage des réflectivités dans les tuiles servies : code = dBZ + 11 ; 0 = aucun écho. */
// Déclare et exporte le décalage du codage.
export const DBZ_CODE_OFFSET = 11;

/**
 * Échelle des couleurs de la pluie (réflectivité en dBZ → couleur), du crachin aux noyaux convectifs ; la neige a sa
 * propre échelle, du blanc au violet. Le shader du calque en reprend exactement les paliers.
 */
// Déclare et exporte l'échelle de la pluie.
export const RAIN_SCALE = [[5, '#9ad7ff'], [15, '#3d8bff'], [25, '#2fbf4f'], [35, '#ffe14a'], [40, '#ff9b2f'], [45, '#ff3b2f'], [50, '#c4162a'], [55, '#e040fb']];
// Déclare et exporte l'échelle de la neige.
export const SNOW_SCALE = [[5, '#eef6ff'], [20, '#c7d8ff'], [30, '#a9a4ff'], [40, '#8a6bff']];

/** Intensité estimée (mm/h) d'une réflectivité, par Marshall-Palmer (Z = 200 R^1,6) ; la même relation que le serveur. */
// Déclare et exporte rainRate : la réflectivité.
export const rainRate = (dbz) => Math.round(((10 ** (dbz / 10)) / 200) ** (1 / 1.6) * 10) / 10;

/** Légende de l'échelle de la pluie : paliers, couleur et intensité estimée, en clair. */
// Déclare et exporte radarLegend.
export function radarLegend() {
  // Chaque palier : réflectivité, couleur, intensité estimée.
  return RAIN_SCALE.map(([dbz, color]) => ({ dbz, color, label: `${dbz} dBZ ≈ ${rainRate(dbz) < 1 ? rainRate(dbz).toLocaleString('fr-FR') : Math.round(rainRate(dbz))} mm/h` }));
// Fin de radarLegend.
}

/** Images de la réponse /atmosphere/radar, nettoyées et triées : [{ id, time (ms) }], de la plus ancienne à la plus récente. */
// Déclare et exporte normalizeFrames : la réponse.
export function normalizeFrames(data) {
  // Liste reçue.
  const list = Array.isArray(data?.frames) ? data.frames : [];
  // Images lisibles, triées.
  return list.map((f) => ({ id: typeof f?.id === 'string' ? f.id : '', time: Date.parse(f?.time) })).filter((f) => /^[A-Za-z0-9_-]{4,64}$/.test(f.id) && Number.isFinite(f.time)).sort((a, b) => a.time - b.time);
// Fin de normalizeFrames.
}

/** Images à afficher : les `n` plus récentes (animation), ou la dernière seule. */
// Déclare et exporte framesToShow : les images triées, l'animation et le nombre d'images.
export function framesToShow(frames, animate = true, n = RADAR_ANIM_FRAMES) {
  // Aucune : liste vide.
  if (!frames.length) return [];
  // Animation : les n dernières ; sinon la dernière.
  return animate ? frames.slice(-n) : frames.slice(-1);
// Fin de framesToShow.
}

/**
 * Place dans l'animation à l'instant `t` (secondes) pour `n` images : indice de l'image affichée, de la suivante et
 * part du fondu (0 : l'image seule). La dernière image est tenue plus longtemps, puis la boucle reprend.
 */
// Déclare et exporte animationState : le temps, le nombre d'images, la durée d'une image et la pause.
export function animationState(t, n, step = RADAR_STEP_S, hold = RADAR_HOLD_S) {
  // Une image ou moins : l'image seule.
  if (n <= 1) return { a: 0, b: 0, mix: 0 };
  // Durée d'une boucle.
  const loop = (n - 1) * step + hold;
  // Temps dans la boucle.
  const u = ((t % loop) + loop) % loop;
  // Pendant la pause : la dernière image.
  if (u >= (n - 1) * step) return { a: n - 1, b: n - 1, mix: 0 };
  // Image courante et avancement dans son pas.
  const a = Math.floor(u / step), f = u / step - a;
  // Fondu sur le dernier tiers du pas vers l'image suivante.
  return { a, b: a + 1, mix: Math.max(0, (f - 0.66) / 0.34) };
// Fin de animationState.
}

/** Position Web Mercator (0 à 1, depuis le nord-ouest) d'un point : [x, y]. */
// Déclare et exporte mercator : longitude et latitude (degrés).
export function mercator(lon, lat) {
  // Latitude bornée aux limites de Mercator.
  const la = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  // Abscisse et ordonnée.
  return [(lon + 180) / 360, 0.5 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / (2 * Math.PI)];
// Fin de mercator.
}

/**
 * Bloc de tuiles du détail autour d'un point : `n` × `n` tuiles du niveau `z` dont le centre est le plus proche du
 * point. Rend { z, x0, y0, n, key, box } : x0 peut sortir de la grille (le serveur reçoit la colonne ramenée dedans),
 * box = [u0, v0, côté] du bloc en coordonnées Mercator 0 à 1 (u0 non ramené, pour le passage de l'antiméridien).
 */
// Déclare et exporte detailBlock : longitude, latitude, niveau, tuiles par côté.
export function detailBlock(lon, lat, z = RADAR_DETAIL_ZOOM, n = RADAR_DETAIL_TILES) {
  // Tuiles par côté du monde.
  const N = 2 ** z;
  // Position du point, en tuiles.
  const [mx, my] = mercator(lon, lat);
  // Coin du bloc : centre du bloc au plus près du point.
  const x0 = Math.round(mx * N - n / 2), y0 = Math.max(0, Math.min(N - n, Math.round(my * N - n / 2)));
  // Bloc.
  return { z, x0, y0, n, key: `${z}/${((x0 % N) + N) % N}/${y0}`, box: [x0 / N, y0 / N, n / N] };
// Fin de detailBlock.
}

/** Tuiles d'un bloc : [{ x (ramenée dans la grille), y, dx, dy (place dans le bloc) }]. */
// Déclare et exporte blockTiles : le bloc.
export function blockTiles({ z, x0, y0, n }) {
  // Tuiles par côté du monde.
  const N = 2 ** z;
  // Liste.
  const tiles = [];
  // Ligne par ligne, colonne par colonne.
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) tiles.push({ x: (((x0 + dx) % N) + N) % N, y: y0 + dy, dx, dy });
  // Tuiles.
  return tiles;
// Fin de blockTiles.
}

/** Réflectivité (dBZ) d'un octet servi, ou null (0 : aucun écho). */
// Déclare et exporte dbzOfCode : le code.
export const dbzOfCode = (code) => (code > 0 ? code - DBZ_CODE_OFFSET : null);

// num : un nombre, ou NaN pour une valeur absente (Number(null) vaudrait 0).
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
// Couleurs des cellules par réflectivité maximale : modérée, forte, très forte.
const CELL_COLORS = [[55, '#ff3df2'], [50, '#ff4b3a'], [0, '#ffb02e']];

/**
 * Orages de la réponse /atmosphere/storms, mis en forme pour le calque : cellules estimées { lon, lat, dbz, radiusKm,
 * frames, conf, color, arrow ([[lon, lat], [lon, lat]] : déplacement estimé sur 30 minutes, ou null) } et avertissements
 * { ring, tornado, observed, arrow }.
 */
// Déclare et exporte normalizeStorms : la réponse.
export function normalizeStorms(data) {
  // Cellules reçues.
  const cells = (Array.isArray(data?.cells) ? data.cells : []).map((e) => {
    // Position et réflectivité lisibles.
    const lon = num(e?.lon), lat = num(e?.lat), dbz = num(e?.intensity?.value);
    // Illisible : écartée.
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(dbz)) return null;
    // Surface et rayon équivalent (au moins 8 km).
    const area = Number(e?.details?.areaKm2) || 0, radiusKm = Math.max(8, Math.sqrt(area / Math.PI));
    // Déplacement estimé.
    const m = e?.details?.motion;
    // Flèche sur 30 minutes, si le déplacement est connu.
    const arrow = m && Number.isFinite(Number(m.bearingDeg)) && Number(m.speedKmh) > 0 ? [[lon, lat], destination(lon, lat, Number(m.bearingDeg), Number(m.speedKmh) / 2)] : null;
    // Cellule.
    return { lon, lat, dbz, radiusKm, frames: Number(e?.details?.frames) || 1, conf: Number(e?.confidence) || 0.5, color: CELL_COLORS.find(([min]) => dbz >= min)[1], arrow };
  // Lisibles seulement.
  }).filter(Boolean);
  // Avertissements reçus.
  const warnings = (Array.isArray(data?.warnings) ? data.warnings : []).map((e) => {
    // Anneau de la zone.
    const ring = (Array.isArray(e?.geometry?.coordinates?.[0]) ? e.geometry.coordinates[0] : []).map((p) => [num(p?.[0]), num(p?.[1])]).filter(([lo, la]) => Number.isFinite(lo) && Number.isFinite(la) && Math.abs(la) <= 90);
    // Zone trop courte : écarté.
    if (ring.length < 4) return null;
    // Déplacement publié.
    const m = e?.details?.motion;
    // Flèche sur 30 minutes depuis le centre de la zone.
    const arrow = m && Number(m.speedKmh) > 0 && Number.isFinite(num(e?.lon)) && Number.isFinite(num(e?.lat)) ? [[num(e.lon), num(e.lat)], destination(num(e.lon), num(e.lat), Number(m.bearingDeg), Number(m.speedKmh) / 2)] : null;
    // Avertissement.
    return { ring, tornado: e?.details?.kind === 'tornade', observed: e?.status === 'observé', arrow };
  // Lisibles seulement.
  }).filter(Boolean);
  // Résultat.
  return { cells, warnings };
// Fin de normalizeStorms.
}

/**
 * Contour d'une zone suivant la courbure du globe, en segments (paires de points de la sphère de rayon `radius`, à
 * plat), avec `step` degrés au plus entre deux points ; l'anneau est refermé s'il ne l'est pas.
 */
// Déclare et exporte ringSegments : l'anneau, le rayon et le pas.
export function ringSegments(ring, radius = 1.0016, step = 0.5) {
  // Anneau refermé.
  const closed = ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? [...ring, ring[0]] : ring;
  // Points densifiés.
  const pts = [];
  // Segment par segment (début).
  for (let i = 0; i + 1 < closed.length; i++) {
    // Extrémités.
    const [lo1, la1] = closed[i], [lo2, la2] = closed[i + 1];
    // Écart en longitude ramené entre −180 et 180.
    const dlo = ((((lo2 - lo1) + 540) % 360) - 180);
    // Nombre de pas.
    const k = Math.max(1, Math.ceil(Math.max(Math.abs(dlo), Math.abs(la2 - la1)) / step));
    // Points intermédiaires (sans le dernier, repris au segment suivant).
    for (let j = 0; j < k; j++) pts.push(lonLatToUnit(lo1 + (dlo * j) / k, la1 + ((la2 - la1) * j) / k).map((v) => v * radius));
  // Fin des segments.
  }
  // Paires consécutives, la dernière revenant au premier point ; à plat.
  return pts.flatMap((p, i) => [...p, ...pts[(i + 1) % pts.length]]);
// Fin de ringSegments.
}

/** Cap (degrés depuis le nord, sens horaire) d'un point vers un autre. */
// Déclare et exporte bearing : départ et arrivée (degrés).
export function bearing(lon1, lat1, lon2, lat2) {
  // Degrés vers radians.
  const r = Math.PI / 180;
  // Composantes du cap.
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r), x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  // Cap entre 0 et 360.
  return ((Math.atan2(y, x) / r) + 360) % 360;
// Fin de bearing.
}

/**
 * Flèche de déplacement sur le globe, en segments (paires de points de la sphère de rayon `radius`, à plat) : le
 * trajet de `from` à `to` en `k` pas le long du grand cercle, puis deux branches de pointe à ±150° du cap d'arrivée.
 */
// Déclare et exporte arrowSegments : départ et arrivée ([lon, lat]), rayon, nombre de pas.
export function arrowSegments(from, to, radius = 1.0017, k = 8) {
  // Cap et distance du trajet (km, sphère de 6 371 km).
  const b = bearing(from[0], from[1], to[0], to[1]), r = Math.PI / 180;
  // Distance angulaire (haversine).
  const h = Math.sin(((to[1] - from[1]) * r) / 2) ** 2 + Math.cos(from[1] * r) * Math.cos(to[1] * r) * Math.sin(((to[0] - from[0]) * r) / 2) ** 2;
  // Distance, km.
  const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  // Trajet nul : aucune flèche.
  if (!(km > 0.5)) return [];
  // Points du trajet.
  const path = Array.from({ length: k + 1 }, (_, i) => (i === k ? to : destination(from[0], from[1], b, (km * i) / k)));
  // Cap à l'arrivée (du dernier pas vers la pointe).
  const bt = bearing(path[k - 1][0], path[k - 1][1], to[0], to[1]);
  // Longueur des branches de la pointe : un quart du trajet, au moins 6 km.
  const head = Math.max(6, km / 4);
  // Branches de la pointe.
  const arms = [destination(to[0], to[1], bt + 150, head), destination(to[0], to[1], bt - 150, head)];
  // Paires de points : segments du trajet, puis les deux branches.
  const pairs = [...path.slice(1).map((p, i) => [path[i], p]), [to, arms[0]], [to, arms[1]]];
  // Positions à plat.
  return pairs.flatMap((pair) => pair.flatMap(([lo, la]) => lonLatToUnit(lo, la).map((v) => v * radius)));
// Fin de arrowSegments.
}
