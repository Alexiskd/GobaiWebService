// Importe le format commun et ses outils.
import { AtmosphericEvent, isLonLat, makeEventId } from './atmospheric-event';

// LightningEngine, partie données (sans NestJS, donc testable seule) : impacts de foudre de l'API Xweather Lightning
// (réseau de détection de Vaisala). Référence : xweather.com/docs/weather-api/endpoints/lightning.
//  - Accès standard : les 5 dernières minutes, 100 km de rayon et 1 000 impacts au plus par requête ; l'archive, les
//    emprises rectangulaires et 50 000 impacts par requête demandent l'option Lightning Enterprise.
//  - Chaque impact : position, heure (ms), nature (CG nuage-sol, IC intra-nuage), courant de crête « peakamp » dont le
//    signe donne la polarité, nombre de capteurs, chi² de la localisation (plus il est bas, plus elle est sûre).
// Seule la POSITION et l'HEURE d'un impact sont mesurées : la forme d'un éclair dessinée à l'écran est procédurale.

/** Rayon d'une requête en accès standard, en kilomètres. */
// Rayon d'une requête : 100 km.
export const LIGHTNING_RADIUS_KM = 100;
/** Fenêtre de l'accès standard, en minutes. */
// Fenêtre : 5 minutes.
export const LIGHTNING_WINDOW_MIN = 5;
/** Nombre maximal d'impacts par requête en accès standard. */
// Limite : 1 000 impacts.
export const LIGHTNING_LIMIT = 1000;

/** Un impact de foudre. */
// Forme d'un impact.
export interface Strike {
  // id : identifiant Xweather.
  id: string;
  // lon, lat : position, en degrés.
  lon: number; lat: number;
  // t : heure de l'impact, en millisecondes UTC.
  t: number;
  // type : « cg » (nuage-sol), « ic » (intra-nuage), ou null si non précisé.
  type: 'cg' | 'ic' | null;
  // peakAmp : courant de crête (« peakamp » de Xweather, signe = polarité), ou null.
  peakAmp: number | null;
  // sensors : nombre de capteurs ayant détecté l'impact, ou null.
  sensors: number | null;
  // chi : chi² de la localisation (bas = sûre), ou null.
  chi: number | null;
// Fin de Strike.
}

// Type Row : un objet aux champs de type inconnu.
type Row = Record<string, unknown>;
// num : la valeur si c'est un nombre fini, sinon null.
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Lit une réponse de l'API Xweather Lightning : les impacts, ou l'erreur rendue par l'API (accès refusé…). */
// Fonction parseXweatherLightning : la réponse JSON.
export function parseXweatherLightning(json: unknown): { strikes: Strike[]; error: string | null } {
  // Réponse vue comme un objet.
  const r = (json ?? {}) as Row;
  // Échec signalé par l'API : son message (description, sinon code), sans rien d'autre.
  if (r.success === false) { const e = (r.error ?? {}) as Row; return { strikes: [], error: String(e.description || e.code || 'erreur Xweather') }; }
  // Impacts : une liste, ou un seul objet.
  const list = Array.isArray(r.response) ? (r.response as Row[]) : r.response && typeof r.response === 'object' ? [r.response as Row] : [];
  // Impacts lus.
  const strikes: Strike[] = [];
  // Pour chaque enregistrement :
  for (const s of list) {
    // position ;
    const loc = (s?.loc ?? {}) as Row, lat = num(loc.lat), lon = num(loc.long);
    // observation et impulsion ;
    const ob = (s?.ob ?? {}) as Row, pulse = (ob.pulse ?? {}) as Row;
    // heure : en millisecondes si donnée, sinon secondes × 1 000 ;
    const t = num(ob.timestampMS) ?? (num(ob.timestamp) !== null ? (num(ob.timestamp) as number) * 1000 : null);
    // illisible : ignoré ;
    if (!isLonLat(lon, lat) || t === null) continue;
    // nature, en minuscules ;
    const type = String(pulse.type ?? '').toLowerCase();
    // impact.
    strikes.push({ id: String(s.id ?? `${lon},${lat},${t}`), lon: lon as number, lat: lat as number, t, type: type === 'cg' || type === 'ic' ? type : null, peakAmp: num(pulse.peakamp), sensors: num(pulse.numSensors), chi: num(pulse.chiSquare) });
  // Fin de la boucle.
  }
  // Impacts, sans erreur.
  return { strikes, error: null };
// Fin de parseXweatherLightning.
}

/** Confiance d'un impact : nombre de capteurs et chi² de la localisation. */
// Fonction strikeConfidence : l'impact.
export function strikeConfidence(s: Strike): number {
  // Base : 0,7 ; 0,9 avec au moins trois capteurs ; 0,6 avec un seul.
  let c = s.sensors === null ? 0.7 : s.sensors >= 3 ? 0.9 : s.sensors >= 2 ? 0.75 : 0.6;
  // Localisation douteuse (chi² élevé) : confiance réduite.
  if (s.chi !== null && s.chi > 5) c -= 0.2;
  // Bornée entre 0,3 et 0,95, arrondie au centième.
  return Math.round(Math.min(0.95, Math.max(0.3, c)) * 100) / 100;
// Fin de strikeConfidence.
}

/** Impact au format commun : observé (position et heure mesurées), polarité et nature dans les détails. */
// Fonction strikeToEvent : l'impact et l'heure de lecture.
export function strikeToEvent(s: Strike, fetchedAt: string): AtmosphericEvent {
  // Heure, en ISO.
  const at = new Date(s.t).toISOString();
  // Événement (début).
  return {
    // Identifiant, famille, sans nom.
    id: makeEventId('lightning', 'xweather', s.id), type: 'lightning', name: null,
    // Position et géométrie ponctuelle.
    lon: s.lon, lat: s.lat, geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    // Altitude : non fournie (l'altitude intra-nuage est obsolète chez Xweather).
    altitudeM: null,
    // Heures : l'impact est instantané.
    detectedAt: at, validFrom: at, validTo: at,
    // Intensité : le courant de crête tel que publié.
    intensity: { value: s.peakAmp === null ? null : Math.abs(s.peakAmp), unit: 'peakamp', label: 'Courant de crête (Xweather)' },
    // Confiance et provenance.
    confidence: strikeConfidence(s), sources: [{ provider: 'xweather-lightning', sourceId: s.id, url: null, observedAt: at, fetchedAt }],
    // Résolution : non publiée par impact.
    resolution: { spatialM: null, temporalS: null },
    // Observé ; confirmé par le réseau de détection.
    status: 'observé', confirmed: true, flags: [],
    // Détails : nature, polarité, capteurs, chi².
    details: { kind: s.type === 'cg' ? 'nuage-sol' : s.type === 'ic' ? 'intra-nuage' : null, polarity: s.peakAmp === null ? null : s.peakAmp < 0 ? 'négative' : 'positive', sensors: s.sensors, chiSquare: s.chi },
  // Fin de l'événement.
  };
// Fin de strikeToEvent.
}

/** Statistiques d'un ensemble d'impacts sur un disque de `radiusKm` pendant `windowMin` minutes. */
// Forme des statistiques.
export interface LightningStats {
  // count : nombre d'impacts ; cg, ic : par nature ; positive, negative : par polarité.
  count: number; cg: number; ic: number; positive: number; negative: number;
  // perMin : fréquence, impacts par minute.
  perMin: number;
  // densityPerKm2 : densité, impacts par km² sur la fenêtre.
  densityPerKm2: number;
  // zones : zones actives (cellules de 0,1° avec au moins 3 impacts), les plus actives d'abord.
  zones: { lon: number; lat: number; count: number }[];
  // truncated : vrai si la limite de la requête est atteinte (il y a peut-être plus d'impacts).
  truncated: boolean;
// Fin de LightningStats.
}

/** Calcule fréquence, densité, natures, polarités et zones actives. */
// Fonction lightningStats : les impacts, le rayon, la fenêtre et la limite de la requête.
export function lightningStats(strikes: Strike[], radiusKm = LIGHTNING_RADIUS_KM, windowMin = LIGHTNING_WINDOW_MIN, limit = LIGHTNING_LIMIT): LightningStats {
  // Cellules de 0,1° : clé → { sommes des positions, nombre }.
  const cells = new Map<string, { sx: number; sy: number; n: number }>();
  // Pour chaque impact : sa cellule.
  for (const s of strikes) { const k = `${Math.floor(s.lon * 10)},${Math.floor(s.lat * 10)}`; const c = cells.get(k) ?? { sx: 0, sy: 0, n: 0 }; c.sx += s.lon; c.sy += s.lat; c.n++; cells.set(k, c); }
  // Zones actives : au moins 3 impacts, barycentre, triées.
  const zones = [...cells.values()].filter((c) => c.n >= 3).map((c) => ({ lon: Math.round((c.sx / c.n) * 1000) / 1000, lat: Math.round((c.sy / c.n) * 1000) / 1000, count: c.n })).sort((a, b) => b.count - a.count);
  // Surface du disque, en km².
  const area = Math.PI * radiusKm * radiusKm;
  // Statistiques (début).
  return {
    // Nombre total, par nature et par polarité.
    count: strikes.length, cg: strikes.filter((s) => s.type === 'cg').length, ic: strikes.filter((s) => s.type === 'ic').length,
    // Polarités.
    positive: strikes.filter((s) => s.peakAmp !== null && s.peakAmp > 0).length, negative: strikes.filter((s) => s.peakAmp !== null && s.peakAmp < 0).length,
    // Fréquence et densité.
    perMin: Math.round((strikes.length / windowMin) * 10) / 10, densityPerKm2: Number((strikes.length / area).toPrecision(3)),
    // Zones et troncature.
    zones, truncated: strikes.length >= limit,
  // Fin des statistiques.
  };
// Fin de lightningStats.
}

/** Centre de requête arrondi à 0,5° : les visiteurs proches partagent la même lecture (cache géographique). */
// Fonction lightningCell : longitude et latitude.
export function lightningCell(lon: number, lat: number): { lon: number; lat: number; key: string } {
  // Arrondis au demi-degré, latitude bornée.
  const rl = Math.round(lon * 2) / 2, ra = Math.max(-89.5, Math.min(89.5, Math.round(lat * 2) / 2));
  // Longitude ramenée entre −180 et 180.
  const lo = rl > 180 ? rl - 360 : rl < -180 ? rl + 360 : rl;
  // Centre et clé.
  return { lon: lo, lat: ra, key: `${lo},${ra}` };
// Fin de lightningCell.
}

/** Adresse d'une requête Xweather Lightning (identifiants compris : ne jamais l'écrire dans un journal ni la renvoyer). */
// Fonction xweatherLightningUrl : identifiants, centre et rayon.
export function xweatherLightningUrl(clientId: string, clientSecret: string, lon: number, lat: number, radiusKm = LIGHTNING_RADIUS_KM): string {
  // Paramètres : point, rayon, limite, identifiants.
  const q = new URLSearchParams({ p: `${lat},${lon}`, radius: `${radiusKm}km`, limit: String(LIGHTNING_LIMIT), client_id: clientId, client_secret: clientSecret });
  // Adresse de l'action « closest » (les plus proches d'abord).
  return `https://data.api.xweather.com/lightning/closest?${q.toString()}`;
// Fin de xweatherLightningUrl.
}

/** Adresse d'une tuile Xweather Raster Maps de la couche des impacts de foudre (identifiants compris). */
// Fonction xweatherLightningTileUrl : identifiants et tuile.
export const xweatherLightningTileUrl = (clientId: string, clientSecret: string, z: number, x: number, y: number) => `https://maps.api.xweather.com/${clientId}_${clientSecret}/lightning-strikes/${z}/${x}/${y}/current.png`;
