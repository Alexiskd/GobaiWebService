// Format commun, identifiants et contrôle des coordonnées.
import { AtmosphericEvent, isLonLat, makeEventId } from './atmospheric-event';

// Avertissements officiels d'orages violents et de tornades du National Weather Service (États-Unis), lus dans l'API
// publique api.weather.gov (GeoJSON, sans clé, en-tête User-Agent demandé). Ce sont des avertissements émis par des
// prévisionnistes, chacun avec sa zone (polygone), sa durée, la grêle et les rafales attendues, la façon dont le
// phénomène a été détecté (« radar indicated » ou « observed ») et le déplacement de l'orage : ils CONFIRMENT
// officiellement un orage violent dans leur zone, à la différence des cellules estimées d'après le radar.

/** Adresse des alertes actives. */
// Déclare et exporte l'adresse.
export const NWS_ALERTS_URL = 'https://api.weather.gov/alerts/active';
/** Avertissements lus (une requête par nature). */
// Déclare et exporte les natures lues.
export const NWS_STORM_EVENTS = ['Tornado Warning', 'Severe Thunderstorm Warning'];
/** Adresse des alertes actives d'une nature. */
// Déclare et exporte nwsAlertsUrl : la nature.
export const nwsAlertsUrl = (event: string): string => `${NWS_ALERTS_URL}?status=actual&event=${encodeURIComponent(event)}`;
// Pouces → centimètres ; nœuds et miles par heure → km/h.
const IN_CM = 2.54, KT_KMH = 1.852, MPH_KMH = 1.609344;

/** Déplacement publié : cap vers lequel va l'orage, vitesse et positions de référence ([lon, lat]). */
// Forme du déplacement.
export interface NwsMotion {
  // bearingDeg : le cap vers lequel va l'orage (le NWS publie la direction d'où il vient).
  bearingDeg: number;
  // speedKmh : la vitesse, km/h.
  speedKmh: number;
  // points : les positions de l'orage à l'heure publiée.
  points: [number, number][];
  // at : l'heure de ces positions (ISO 8601), ou null.
  at: string | null;
// Fin de NwsMotion.
}

/**
 * Lit le déplacement publié (« eventMotionDescription ») : « 2024-05-29T02:30:00-00:00...storm...262DEG...38KT...3266 9733 »,
 * soit l'heure, la direction D'OÙ vient l'orage (degrés), la vitesse (nœuds) et des positions en centièmes de degré
 * (latitude nord, longitude ouest). Null si le texte est illisible.
 */
// Déclare et exporte parseMotion : le texte.
export function parseMotion(text: unknown): NwsMotion | null {
  // Texte attendu.
  if (typeof text !== 'string') return null;
  // Direction et vitesse.
  const m = /(\d{1,3})DEG\.{3}(\d{1,3})KT/.exec(text);
  // Absentes : null.
  if (!m) return null;
  // Positions : paires de nombres après la vitesse.
  const nums = (text.slice(m.index + m[0].length).match(/\d{3,5}/g) ?? []).map(Number);
  // Paires (latitude, longitude ouest) → [longitude, latitude], contrôlées.
  const points: [number, number][] = [];
  // Paire par paire.
  for (let i = 0; i + 1 < nums.length; i += 2) { const lat = nums[i] / 100, lon = -nums[i + 1] / 100; if (isLonLat(lon, lat)) points.push([lon, lat]); }
  // Heure en tête du texte.
  const t = Date.parse(text.split('...')[0]);
  // Déplacement : cap retourné (vers où), vitesse convertie.
  return { bearingDeg: (Number(m[1]) + 180) % 360, speedKmh: Math.round(Number(m[2]) * KT_KMH), points, at: Number.isFinite(t) ? new Date(t).toISOString() : null };
// Fin de parseMotion.
}

// first : la première valeur d'un paramètre NWS (les paramètres sont des listes de textes).
const first = (params: Record<string, unknown> | undefined, key: string): string | null => {
  // Valeur du paramètre.
  const v = params?.[key];
  // Liste : son premier texte ; texte : lui-même ; sinon null.
  return Array.isArray(v) ? (typeof v[0] === 'string' ? v[0] : null) : typeof v === 'string' ? v : null;
// Fin de first.
};

// outerRing : l'anneau extérieur d'un polygone (ou du plus grand polygone d'un multipolygone), ou null.
function outerRing(geometry: unknown): [number, number][] | null {
  // Géométrie attendue.
  const g = geometry as { type?: string; coordinates?: unknown } | null;
  // Anneaux candidats.
  const rings = g?.type === 'Polygon' ? [(g.coordinates as unknown[])?.[0]] : g?.type === 'MultiPolygon' ? ((g.coordinates as unknown[]) ?? []).map((p) => (p as unknown[])?.[0]) : [];
  // Anneaux lisibles (au moins 4 points sur le globe).
  const ok = rings.map((r) => (Array.isArray(r) ? r.filter((p): p is [number, number] => Array.isArray(p) && isLonLat(p[0], p[1])).map((p) => [Number(p[0]), Number(p[1])] as [number, number]) : [])).filter((r) => r.length >= 4);
  // Le plus long, ou null.
  return ok.sort((a, b) => b.length - a.length)[0] ?? null;
// Fin de outerRing.
}

/**
 * Lit une réponse /alerts/active (GeoJSON) : avertissements d'orages violents et de tornades en vigueur à `now`, avec
 * une zone. Les annulations, les messages d'exercice et les avertissements expirés ou sans zone sont écartés.
 */
// Déclare et exporte parseNwsAlerts : le JSON, l'heure de lecture et l'instant de référence.
export function parseNwsAlerts(json: unknown, fetchedAt: string, now: number): AtmosphericEvent[] {
  // Collection attendue.
  const features = (json as { features?: unknown } | null)?.features;
  // Pas de liste : rien.
  if (!Array.isArray(features)) return [];
  // Événements.
  const out: AtmosphericEvent[] = [];
  // Avertissement par avertissement (début).
  for (const f of features) {
    // Propriétés.
    const p = (f as { properties?: Record<string, unknown> } | null)?.properties;
    // Nature.
    const event = typeof p?.event === 'string' ? p.event : '';
    // Nature non suivie, message d'exercice ou annulation : écarté.
    if (!NWS_STORM_EVENTS.includes(event) || p?.status !== 'Actual' || p?.messageType === 'Cancel') continue;
    // Fin de validité : fin du phénomène, sinon expiration du message.
    const end = Date.parse(String(p.ends ?? p.expires ?? ''));
    // Expiré : écarté.
    if (!Number.isFinite(end) || end < now) continue;
    // Zone.
    const ring = outerRing((f as { geometry?: unknown }).geometry);
    // Sans zone (avertissement par comté seulement) : écarté (il ne peut pas être placé sans inventer de contour).
    if (!ring) continue;
    // Centre : moyenne des sommets (le dernier répète le premier).
    const pts = ring.slice(0, -1).length ? ring.slice(0, -1) : ring;
    // Longitude et latitude moyennes.
    const lon = pts.reduce((s, q) => s + q[0], 0) / pts.length, lat = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    // Paramètres publiés.
    const params = p.parameters as Record<string, unknown> | undefined;
    // Tornade ?
    const tornado = event === 'Tornado Warning';
    // Détection : « OBSERVED » (vu par un observateur ou confirmé), sinon indiquée par le radar.
    const detection = first(params, 'tornadoDetection') ?? first(params, 'hailThreat') ?? first(params, 'windThreat');
    // Observé ?
    const observed = /OBSERVED/i.test(detection ?? '');
    // Grêle maximale (pouces → cm).
    const hailIn = Number(first(params, 'maxHailSize'));
    // Rafales maximales (« 60 MPH » ou « 50 KT » → km/h).
    const gustM = /(\d+)\s*(MPH|KT)/i.exec(first(params, 'maxWindGust') ?? '');
    // Rafales, km/h.
    const gustKmh = gustM ? Math.round(Number(gustM[1]) * (gustM[2].toUpperCase() === 'KT' ? KT_KMH : MPH_KMH)) : null;
    // Heures : émission, début, fin.
    const sent = Date.parse(String(p.sent ?? '')), onset = Date.parse(String(p.onset ?? p.effective ?? p.sent ?? ''));
    // Heure d'émission, en ISO (lecture à défaut).
    const sentIso = Number.isFinite(sent) ? new Date(sent).toISOString() : fetchedAt;
    // Identifiant chez le NWS.
    const sourceId = typeof p.id === 'string' ? p.id : String(f && (f as { id?: unknown }).id);
    // Événement (début).
    out.push({
      // Identifiant, famille, nom.
      id: makeEventId('storm', 'nws', sourceId), type: 'storm', name: typeof p.headline === 'string' ? p.headline : event,
      // Centre et zone.
      lon: Math.round(lon * 1000) / 1000, lat: Math.round(lat * 1000) / 1000, geometry: { type: 'Polygon', coordinates: [ring] },
      // Altitude : sans objet.
      altitudeM: null,
      // Heures.
      detectedAt: sentIso, validFrom: Number.isFinite(onset) ? new Date(onset).toISOString() : sentIso, validTo: new Date(end).toISOString(),
      // Intensité : la grêle attendue si elle est publiée, sinon les rafales.
      intensity: Number.isFinite(hailIn) && hailIn > 0 ? { value: Math.round(hailIn * IN_CM * 10) / 10, unit: 'cm (grêle)', label: tornado ? 'Avertissement de tornade' : 'Avertissement d’orage violent' } : { value: gustKmh, unit: 'km/h (rafales)', label: tornado ? 'Avertissement de tornade' : 'Avertissement d’orage violent' },
      // Confiance : observé 0,95 ; indiqué par le radar 0,85.
      confidence: observed ? 0.95 : 0.85,
      // Provenance.
      sources: [{ provider: 'nws-alerts', sourceId, url: typeof (f as { id?: unknown }).id === 'string' ? (f as { id: string }).id : null, observedAt: sentIso, fetchedAt }],
      // Résolution : zone tracée par le prévisionniste.
      resolution: { spatialM: null, temporalS: null },
      // Observé (témoin, dégâts) ou estimé (radar) ; confirmé : avertissement officiel.
      status: observed ? 'observé' : 'estimé', confirmed: true, flags: [],
      // Détails : nature, émetteur, zone, sévérité, grêle, rafales, détection, dégâts possibles, déplacement.
      details: { kind: tornado ? 'tornade' : 'orage violent', event, sender: typeof p.senderName === 'string' ? p.senderName : null, area: typeof p.areaDesc === 'string' ? p.areaDesc : null, severity: p.severity ?? null, certainty: p.certainty ?? null, hailCm: Number.isFinite(hailIn) && hailIn > 0 ? Math.round(hailIn * IN_CM * 10) / 10 : null, gustKmh, detection: detection ? detection.toLowerCase() : null, damageThreat: (first(params, 'thunderstormDamageThreat') ?? first(params, 'tornadoDamageThreat'))?.toLowerCase() ?? null, motion: parseMotion(first(params, 'eventMotionDescription')) },
    // Fin de l'événement.
    });
  // Fin des avertissements.
  }
  // Événements.
  return out;
// Fin de parseNwsAlerts.
}
