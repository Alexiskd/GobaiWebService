// Importe le format commun et ses outils.
import { AtmosphericEvent, isLonLat, makeEventId } from './atmospheric-event';

// Lecture de NASA EONET (sans NestJS, donc testable seule) : événements naturels en cours, relayés depuis les agences.
//  - Incendies (catégorie wildfires) : incendies DÉCLARÉS par une agence (IRWIN, InciWeb, services forestiers…) ;
//    ils sont marqués confirmés, à la différence des points chauds satellite (firms.ts).
//  - Tempêtes (catégorie severeStorms) : cyclones suivis par le JTWC et le NHC, avec leur trajectoire observée
//    (une position toutes les 6 h) et le vent soutenu à chaque position.

// Type Row : un objet aux champs de type inconnu.
type Row = Record<string, unknown>;
// str : la valeur si c'est un texte non vide, sinon null.
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Un acre en hectares. */
// Conversion des acres en hectares.
export const ACRE_HA = 0.40468564;

/** Point représentatif d'une géométrie EONET : le point lui-même, ou le centre d'un polygone ; null si illisible. */
// Fonction centerOf : la géométrie.
export function centerOf(g: Row | undefined): [number, number] | null {
  // Coordonnées brutes.
  const c = g?.coordinates as unknown;
  // Point : longitude puis latitude.
  if (g?.type === 'Point' && Array.isArray(c)) { const [lon, lat] = c.map(Number); return isLonLat(lon, lat) ? [lon, lat] : null; }
  // Polygone : premier anneau.
  const ring = g?.type === 'Polygon' && Array.isArray(c) && Array.isArray(c[0]) ? (c[0] as unknown[]) : null;
  // Ni point ni polygone : rien.
  if (!ring?.length) return null;
  // Sommets lisibles (le dernier répète le premier dans GeoJSON : il est retiré).
  const pts = ring.slice(0, -1).map((p) => (Array.isArray(p) ? p.map(Number) : [NaN, NaN])).filter(([lon, lat]) => isLonLat(lon, lat));
  // Aucun sommet : rien.
  if (!pts.length) return null;
  // Moyenne des sommets.
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
// Fin de centerOf.
}

/** Incendies déclarés : un événement confirmé par incendie, à sa dernière position connue. */
// Fonction parseEonetWildfires : la réponse et l'heure de lecture.
export function parseEonetWildfires(json: unknown, fetchedAt: string): AtmosphericEvent[] {
  // Événements de la réponse.
  const events = (json as Row | null)?.events;
  // Pas une liste : aucun incendie.
  if (!Array.isArray(events)) return [];
  // Incendies lus.
  const out: AtmosphericEvent[] = [];
  // Pour chaque événement :
  for (const e of events as Row[]) {
    // identifiant et titre ;
    const id = str(e?.id), title = str(e?.title);
    // géométries, de la plus ancienne à la plus récente ;
    const geometry = Array.isArray(e?.geometry) ? (e.geometry as Row[]) : [];
    // la plus récente qui a une position ;
    const last = [...geometry].reverse().find((g) => centerOf(g));
    // sa position ;
    const center = centerOf(last);
    // heure de cette géométrie ;
    const at = str(last?.date);
    // incomplet : ignoré ;
    if (!id || !title || !center || !at || !Number.isFinite(Date.parse(at))) continue;
    // première géométrie datée (début de l'incendie) ;
    const first = str(geometry[0]?.date) ?? at;
    // surface publiée, en acres ou en hectares ;
    const mag = Number(last?.magnitudeValue), unit = str(last?.magnitudeUnit)?.toLowerCase() ?? '';
    // surface en hectares, ou null ;
    const ha = Number.isFinite(mag) && mag > 0 ? (unit.startsWith('acre') ? mag * ACRE_HA : unit === 'ha' || unit.startsWith('hect') ? mag : null) : null;
    // agences sources ;
    const agencies = Array.isArray(e.sources) ? (e.sources as Row[]).map((s) => str(s?.id)).filter((s): s is string => Boolean(s)) : [];
    // fiche de la première agence ;
    const link = Array.isArray(e.sources) ? str((e.sources as Row[])[0]?.url) : null;
    // incendie (début).
    out.push({
      // Identifiant stable.
      id: makeEventId('wildfire', 'eonet', id),
      // Famille et nom publié.
      type: 'wildfire', name: title,
      // Position et géométrie.
      lon: center[0], lat: center[1], geometry: { type: 'Point', coordinates: center },
      // Altitude inconnue.
      altitudeM: null,
      // Heures : dernière mise à jour, début, fin si l'événement est clos.
      detectedAt: at, validFrom: first, validTo: str(e.closed),
      // Intensité : la surface déclarée, si elle est publiée.
      intensity: { value: ha === null ? null : Math.round(ha), unit: 'ha', label: ha === null ? null : 'Surface déclarée' },
      // Confiance : déclaration d'agence.
      confidence: 0.95,
      // Provenance : EONET, avec la fiche de l'agence.
      sources: [{ provider: 'eonet-wildfires', sourceId: id, url: link, observedAt: at, fetchedAt }],
      // Résolution : non publiée.
      resolution: { spatialM: null, temporalS: null },
      // Observé et confirmé par une agence.
      status: 'observé', confirmed: true, flags: [],
      // Détails : agences sources.
      details: { agencies },
    // Fin de l'incendie.
    });
  // Fin de la boucle.
  }
  // Renvoie les incendies.
  return out;
// Fin de parseEonetWildfires.
}

/** Position d'une trajectoire de cyclone. */
// Forme d'une position.
export interface TrackPoint {
  // lon, lat : position du centre, en degrés.
  lon: number; lat: number;
  // t : heure, en millisecondes UTC.
  t: number;
  // windKt : vent soutenu en nœuds, ou null.
  windKt: number | null;
// Fin de TrackPoint.
}

/** Trajectoire observée d'un cyclone, lue chez un fournisseur. */
// Forme d'une trajectoire.
export interface StormTrack {
  // provider : le fournisseur (providers.ts).
  provider: string;
  // key : l'identifiant chez le fournisseur.
  key: string;
  // name : le nom publié, avec son titre (« Typhoon Cempaka »).
  name: string;
  // agencies : les agences sources (JTWC, NHC…).
  agencies: string[];
  // url : la fiche de l'agence, ou null.
  url: string | null;
  // points : les positions, de la plus ancienne à la plus récente.
  points: TrackPoint[];
// Fin de StormTrack.
}

/** Vent en nœuds, depuis une valeur et son unité (kts, mph, km/h, m/s) ; null si illisible. */
// Fonction toKnots : la valeur et l'unité.
export function toKnots(value: unknown, unit: unknown): number | null {
  // Valeur numérique.
  const v = Number(value);
  // Illisible ou négative : null.
  if (value === null || value === undefined || value === '' || !Number.isFinite(v) || v < 0) return null;
  // Unité en minuscules.
  const u = typeof unit === 'string' ? unit.toLowerCase().replace(/\s/g, '') : '';
  // Miles par heure.
  if (u === 'mph') return v / 1.15078;
  // Kilomètres par heure.
  if (u === 'km/h' || u === 'kph' || u === 'kmh') return v / 1.852;
  // Mètres par seconde.
  if (u === 'm/s' || u === 'mps') return v * 1.943844;
  // Nœuds (ou unité absente : EONET publie les tempêtes en nœuds).
  return u === '' || u.startsWith('kt') || u === 'knots' ? v : null;
// Fin de toKnots.
}

/** Tempêtes : une trajectoire par cyclone suivi, positions triées dans le temps. */
// Fonction parseEonetStorms : la réponse.
export function parseEonetStorms(json: unknown): StormTrack[] {
  // Événements de la réponse.
  const events = (json as Row | null)?.events;
  // Pas une liste : aucune trajectoire.
  if (!Array.isArray(events)) return [];
  // Trajectoires lues.
  const out: StormTrack[] = [];
  // Pour chaque événement :
  for (const e of events as Row[]) {
    // identifiant et titre ;
    const key = str(e?.id), name = str(e?.title);
    // incomplet : ignoré ;
    if (!key || !name) continue;
    // positions lisibles (points datés) ;
    const points: TrackPoint[] = (Array.isArray(e.geometry) ? (e.geometry as Row[]) : []).flatMap((g) => {
      // position du point ;
      const c = g?.type === 'Point' ? centerOf(g) : null;
      // heure ;
      const t = Date.parse(str(g?.date) ?? '');
      // illisible : rien ; sinon la position et son vent.
      return c && Number.isFinite(t) ? [{ lon: c[0], lat: c[1], t, windKt: toKnots(g.magnitudeValue, g.magnitudeUnit) }] : [];
    // Fin des positions.
    }).sort((a, b) => a.t - b.t);
    // aucune position : ignoré ;
    if (!points.length) continue;
    // sources ;
    const sources = Array.isArray(e.sources) ? (e.sources as Row[]) : [];
    // trajectoire.
    out.push({ provider: 'eonet-storms', key, name, agencies: sources.map((s) => str(s?.id)).filter((s): s is string => Boolean(s)), url: str(sources[0]?.url), points });
  // Fin de la boucle.
  }
  // Renvoie les trajectoires.
  return out;
// Fin de parseEonetStorms.
}
