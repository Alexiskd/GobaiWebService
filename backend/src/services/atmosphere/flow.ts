// Format commun, identifiants, distance.
import { AtmosphericEvent, haversineKm, makeEventId } from './atmospheric-event';
// Vitesse et direction météo → composantes vers l'est et vers le nord (déjà utilisé pour les nuages).
import { windComponents } from '../map-tiles/earth-wind';

// Vents et courants-jets (AtmosphericFlowEngine, partie données). Source : Open-Meteo (modèles météo, sans clé, usage
// non commercial, licence CC BY 4.0), vent du moment à quatre niveaux, sur une grille mondiale de 12° × 10° lue en une
// seule requête (510 points : sous la limite de 600 appels par minute de l'accès gratuit, chaque point comptant pour
// un appel). Ce sont des sorties de MODÈLE (analyse et prévision immédiate), pas des mesures : statut « estimé ».
// Les courants-jets sont repérés sur le niveau 250 hPa : dans chaque colonne de longitude et chaque hémisphère, le
// maximum de vitesse d'au moins 30 m/s entre 20° et 75° de latitude, puis les maxima voisins sont reliés en axes.

/** Grille demandée : 30 colonnes de 12° à partir de 180° O, 17 lignes de 10° de 80° S à 80° N (510 points). */
// Déclare et exporte la grille.
export const FLOW_GRID = { width: 30, height: 17, lonStart: -180, lonStep: 12, latStart: -80, latStep: 10 } as const;

/** Un niveau : identifiant, libellé, altitude typique (km), variables Open-Meteo de la vitesse et de la direction. */
// Forme d'un niveau.
export interface FlowLevel {
  // id : l'identifiant du niveau.
  id: string;
  // label : le libellé.
  label: string;
  // altKm : l'altitude typique, km.
  altKm: number;
  // speed, dir : les variables de la vitesse et de la direction.
  speed: string; dir: string;
// Fin de FlowLevel.
}

/** Niveaux lus : au sol, 850 hPa, 500 hPa et 250 hPa (celui des courants-jets) ; 8 variables, un seul appel par point. */
// Déclare et exporte les niveaux.
export const FLOW_LEVELS: FlowLevel[] = [
  // Au sol, 10 m.
  { id: '10m', label: 'Au sol (10 m)', altKm: 0.01, speed: 'wind_speed_10m', dir: 'wind_direction_10m' },
  // 850 hPa, environ 1,5 km.
  { id: '850hPa', label: '850 hPa (≈ 1,5 km)', altKm: 1.5, speed: 'wind_speed_850hPa', dir: 'wind_direction_850hPa' },
  // 500 hPa, environ 5,6 km.
  { id: '500hPa', label: '500 hPa (≈ 5,6 km)', altKm: 5.6, speed: 'wind_speed_500hPa', dir: 'wind_direction_500hPa' },
  // 250 hPa, environ 10,4 km : courants-jets.
  { id: '250hPa', label: '250 hPa (≈ 10,4 km)', altKm: 10.4, speed: 'wind_speed_250hPa', dir: 'wind_direction_250hPa' },
// Fin des niveaux.
];

/** Vitesse minimale d'un courant-jet, m/s (seuil usuel : 30 m/s, soit 108 km/h). */
// Déclare et exporte le seuil des courants-jets.
export const JET_MIN_MS = 30;
/** Bande de latitude des courants-jets (valeur absolue, degrés). */
// Déclare et exporte la bande de latitude.
export const JET_LAT_BAND = [20, 75] as const;
/** Écart de latitude maximal entre deux maxima voisins d'un même axe, degrés. */
// Déclare et exporte l'écart maximal.
export const JET_MAX_STEP_DEG = 15;
/** Nombre minimal de colonnes d'un axe (3 colonnes : au moins 24° de longitude). */
// Déclare et exporte la longueur minimale.
export const JET_MIN_COLUMNS = 3;

/** Points de la grille, ligne par ligne du sud au nord, puis d'ouest en est. */
// Déclare et exporte flowPoints.
export function flowPoints(): { lon: number; lat: number }[] {
  // Points.
  const out: { lon: number; lat: number }[] = [];
  // Ligne par ligne, colonne par colonne.
  for (let y = 0; y < FLOW_GRID.height; y++) for (let x = 0; x < FLOW_GRID.width; x++) out.push({ lon: FLOW_GRID.lonStart + x * FLOW_GRID.lonStep, lat: FLOW_GRID.latStart + y * FLOW_GRID.latStep });
  // Points.
  return out;
// Fin de flowPoints.
}

/** Adresse de la requête Open-Meteo : tous les points, les 8 variables du moment, vitesses en m/s. */
// Déclare et exporte flowUrl.
export function flowUrl(): string {
  // Points.
  const pts = flowPoints();
  // Paramètres, virgules laissées telles quelles (permises dans une requête) : une adresse deux fois plus courte.
  const q = `latitude=${pts.map((p) => p.lat).join(',')}&longitude=${pts.map((p) => p.lon).join(',')}&current=${FLOW_LEVELS.flatMap((l) => [l.speed, l.dir]).join(',')}&wind_speed_unit=ms`;
  // Adresse.
  return `https://api.open-meteo.com/v1/forecast?${q}`;
// Fin de flowUrl.
}

/** Vents d'un niveau : composantes vers l'est et vers le nord (m/s) par point de la grille, vitesse maximale. */
// Forme des vents d'un niveau.
export interface LevelWinds {
  // u, v : les composantes, dans l'ordre des points.
  u: number[]; v: number[];
  // maxMs : la vitesse maximale.
  maxMs: number;
// Fin de LevelWinds.
}

/**
 * Lit la réponse d'Open-Meteo (une entrée par point, dans l'ordre demandé). Un niveau dont une valeur manque est
 * indisponible (null) ; null pour toute la réponse si elle n'a pas le bon nombre de points.
 */
// Déclare et exporte parseFlow : le JSON.
export function parseFlow(json: unknown): { levels: Record<string, LevelWinds | null>; validAt: string | null } | null {
  // Liste attendue (un seul point : un objet).
  const list = Array.isArray(json) ? json : null;
  // Mauvais nombre de points : null.
  if (!list || list.length !== FLOW_GRID.width * FLOW_GRID.height) return null;
  // Niveaux lus.
  const levels: Record<string, LevelWinds | null> = {};
  // Niveau par niveau (début).
  for (const l of FLOW_LEVELS) {
    // Composantes et vitesse maximale.
    const u: number[] = [], v: number[] = []; let maxMs = 0, ok = true;
    // Point par point.
    for (const p of list as { current?: Record<string, unknown> }[]) {
      // Vitesse et direction.
      const s = Number(p?.current?.[l.speed]), d = Number(p?.current?.[l.dir]);
      // Valeur manquante (variable refusée, null) : niveau indisponible.
      if (p?.current?.[l.speed] === null || p?.current?.[l.dir] === null || !Number.isFinite(s) || !Number.isFinite(d)) { ok = false; break; }
      // Composantes, au dixième.
      const [e, n] = windComponents(s, d);
      // Gardées.
      u.push(Math.round(e * 10) / 10); v.push(Math.round(n * 10) / 10); if (s > maxMs) maxMs = s;
    // Fin des points.
    }
    // Niveau gardé ou indisponible.
    levels[l.id] = ok ? { u, v, maxMs: Math.round(maxMs * 10) / 10 } : null;
  // Fin des niveaux.
  }
  // Heure de validité.
  const t = (list[0] as { current?: { time?: unknown } })?.current?.time;
  // Résultat.
  return { levels, validAt: typeof t === 'string' ? t : null };
// Fin de parseFlow.
}

/** Un axe de courant-jet : points [lon, lat, vitesse m/s] d'ouest en est, vitesse maximale et moyenne, hémisphère. */
// Forme d'un axe.
export interface JetAxis {
  // points : les positions et vitesses de l'axe.
  points: [number, number, number][];
  // maxMs, meanMs : les vitesses maximale et moyenne.
  maxMs: number; meanMs: number;
  // hemisphere : nord ou sud.
  hemisphere: 'nord' | 'sud';
  // lengthKm : la longueur de l'axe.
  lengthKm: number;
// Fin de JetAxis.
}

/**
 * Repère les axes de courants-jets sur une grille de vents (250 hPa) : maximum de vitesse ≥ 30 m/s par colonne et par
 * hémisphère dans la bande 20°-75°, latitude affinée par une parabole sur les voisins ; maxima de colonnes voisines
 * reliés si leurs latitudes diffèrent de 15° au plus ; axes d'au moins 3 colonnes. Grille refermée en longitude.
 */
// Déclare et exporte detectJets : les vents du niveau.
export function detectJets(w: LevelWinds): JetAxis[] {
  // Dimensions et pas.
  const { width: W, height: H, lonStart, lonStep, latStart, latStep } = FLOW_GRID;
  // speed : vitesse au point (x, y).
  const speed = (x: number, y: number): number => Math.hypot(w.u[y * W + x], w.v[y * W + x]);
  // Axes trouvés.
  const jets: JetAxis[] = [];
  // Hémisphère par hémisphère (début).
  for (const hemi of ['nord', 'sud'] as const) {
    // Maximum de chaque colonne : [latitude, vitesse] ou null.
    const peaks = Array.from({ length: W }, (_, x) => {
      // Meilleure ligne.
      let best = -1, bestS = 0;
      // Lignes de la bande de l'hémisphère.
      for (let y = 0; y < H; y++) { const lat = latStart + y * latStep, a = Math.abs(lat); if ((hemi === 'nord' ? lat > 0 : lat < 0) && a >= JET_LAT_BAND[0] && a <= JET_LAT_BAND[1]) { const s = speed(x, y); if (s > bestS) { bestS = s; best = y; } } }
      // Sous le seuil : aucun.
      if (best < 0 || bestS < JET_MIN_MS) return null;
      // Voisins pour l'affinage (bornés à la grille).
      const s0 = best > 0 ? speed(x, best - 1) : bestS, s2 = best < H - 1 ? speed(x, best + 1) : bestS;
      // Décalage du sommet de la parabole (en lignes), borné à ±0,5.
      const den = s0 - 2 * bestS + s2, off = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (s0 - s2)) / den)) : 0;
      // Latitude affinée et vitesse.
      return [latStart + (best + off) * latStep, bestS] as [number, number];
    // Fin des maxima.
    });
    // Colonnes déjà rangées dans un axe.
    const used = new Array(W).fill(false);
    // Départs : une colonne avec maximum dont la voisine ouest n'en continue pas l'axe (sinon toute la boucle).
    const continues = (x: number): boolean => { const a = peaks[(x - 1 + W) % W], b = peaks[x]; return Boolean(a && b && Math.abs(a[0] - b[0]) <= JET_MAX_STEP_DEG); };
    // Ordre des départs : les débuts d'axes, puis le reste (axe faisant tout le tour du globe).
    const starts = [...Array.from({ length: W }, (_, x) => x).filter((x) => peaks[x] && !continues(x)), ...Array.from({ length: W }, (_, x) => x).filter((x) => peaks[x])];
    // Pour chaque départ (début).
    for (const x0 of starts) {
      // Déjà rangée : suivante.
      if (used[x0]) continue;
      // Axe : colonnes successives vers l'est.
      const pts: [number, number, number][] = [];
      // Colonne courante, et longitude dépliée (continue à l'antiméridien).
      let x = x0, k = 0;
      // Tant que la colonne a un maximum non rangé qui continue l'axe (début).
      while (peaks[x] && !used[x] && (pts.length === 0 || continues(x))) {
        // Rangée.
        used[x] = true;
        // Point : longitude ramenée entre −180 et 180, latitude, vitesse.
        pts.push([((((lonStart + (x0 + k) * lonStep) + 540) % 360) - 180), Math.round(peaks[x]![0] * 10) / 10, Math.round(peaks[x]![1] * 10) / 10]);
        // Colonne suivante.
        x = (x + 1) % W; k++;
      // Fin de l'axe.
      }
      // Trop court : écarté.
      if (pts.length < JET_MIN_COLUMNS) continue;
      // Vitesses.
      const speeds = pts.map((p) => p[2]);
      // Longueur.
      let len = 0; for (let i = 1; i < pts.length; i++) len += haversineKm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      // Axe gardé.
      jets.push({ points: pts, maxMs: Math.max(...speeds), meanMs: Math.round((speeds.reduce((s, v) => s + v, 0) / speeds.length) * 10) / 10, hemisphere: hemi, lengthKm: Math.round(len) });
    // Fin des départs.
    }
  // Fin des hémisphères.
  }
  // Les plus rapides d'abord.
  return jets.sort((a, b) => b.maxMs - a.maxMs);
// Fin de detectJets.
}

/** Axe → événement « jet-stream » au format commun (estimé : sortie de modèle). */
// Déclare et exporte jetToEvent : l'axe, l'heure de validité et l'heure de lecture.
export function jetToEvent(j: JetAxis, validAt: string, fetchedAt: string): AtmosphericEvent {
  // Point de vitesse maximale.
  const top = j.points.reduce((a, b) => (b[2] > a[2] ? b : a));
  // Événement (début).
  return {
    // Identifiant, famille, nom.
    id: makeEventId('jet-stream', 'open-meteo', `${validAt}:${j.hemisphere}:${j.points[0][0]}`), type: 'jet-stream', name: `Courant-jet de l’hémisphère ${j.hemisphere}`,
    // Position : le point le plus rapide ; géométrie : l'axe.
    lon: top[0], lat: top[1], geometry: { type: 'LineString', coordinates: j.points.map(([lo, la]) => [lo, la]) },
    // Altitude : le niveau 250 hPa (environ 10,4 km).
    altitudeM: { min: 9_000, max: 12_000 },
    // Heures : la validité du modèle.
    detectedAt: validAt, validFrom: validAt, validTo: null,
    // Intensité : la vitesse maximale, km/h.
    intensity: { value: Math.round(j.maxMs * 3.6), unit: 'km/h', label: j.maxMs >= 60 ? 'courant-jet très fort' : j.maxMs >= 45 ? 'courant-jet fort' : 'courant-jet' },
    // Confiance : analyse d'un modèle global sur une grille grossière.
    confidence: 0.7,
    // Provenance.
    sources: [{ provider: 'open-meteo-winds', sourceId: null, url: null, observedAt: validAt, fetchedAt }],
    // Résolution : la grille (12° × 10°), une heure.
    resolution: { spatialM: 1_100_000, temporalS: 3_600 },
    // Estimé : sortie de modèle ; non confirmé.
    status: 'estimé', confirmed: false, flags: ['axe estimé sur une grille de 12° × 10° : position approximative'],
    // Détails : vitesses, hémisphère, longueur, niveau, méthode.
    details: { maxMs: j.maxMs, meanMs: j.meanMs, hemisphere: j.hemisphere, lengthKm: j.lengthKm, level: '250 hPa', method: `maximum de vitesse ≥ ${JET_MIN_MS} m/s par colonne entre ${JET_LAT_BAND[0]}° et ${JET_LAT_BAND[1]}° de latitude, maxima voisins reliés` },
  // Fin de l'événement.
  };
// Fin de jetToEvent.
}
