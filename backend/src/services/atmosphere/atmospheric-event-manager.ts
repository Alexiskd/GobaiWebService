// Importe le format commun et ses outils.
import { AtmosphericEvent, AtmosphericEventType, ageMs, isLonLat } from './atmospheric-event';
// Importe la déduplication entre sources.
import { DedupOptions, dedupEvents } from './event-dedup';
// Importe la normalisation des noms de cyclones (clé d'identité).
import { normalizeStormName } from './cyclones';

// AtmosphericEventManager (sans NestJS, donc testable seul) : le point de passage unique de tous les événements
// atmosphériques normalisés. Pour chaque calque, il :
//  - écarte les événements illisibles (coordonnées hors du globe, aucune provenance) ;
//  - écarte les événements périmés (plus vieux que l'âge maximal de leur famille) ;
//  - écarte les événements trop peu sûrs (« ne pas représenter un phénomène qu'aucune source fiable ne confirme ») ;
//  - déduplique entre sources en gardant toutes les provenances ;
//  - garde la trace de ce qui a été écarté et pourquoi, des pannes de fournisseurs et des contradictions.

/** Âge maximal d'un événement affiché, par famille (au-delà, la donnée est périmée). */
// Âges maximaux, en millisecondes.
export const MAX_EVENT_AGE_MS: Record<AtmosphericEventType, number> = {
  // Points chauds : la durée des fichiers FIRMS.
  hotspot: 24 * 3_600_000,
  // Incendies déclarés : trois semaines sans mise à jour.
  wildfire: 21 * 24 * 3_600_000,
  // Cyclones : 36 heures sans position.
  cyclone: 36 * 3_600_000,
  // Foudre : 30 minutes.
  lightning: 30 * 60_000,
  // Cellules orageuses : 3 heures.
  storm: 3 * 3_600_000,
  // Précipitations : 1 heure.
  precipitation: 3_600_000,
  // Aérosols et fumées : 24 heures.
  aerosol: 24 * 3_600_000, smoke: 24 * 3_600_000,
  // Vents : 6 heures ; courants-jets : 12 heures ; brouillard : 6 heures.
  wind: 6 * 3_600_000, 'jet-stream': 12 * 3_600_000, fog: 6 * 3_600_000,
// Fin des âges maximaux.
};

/** Confiance minimale d'un événement affiché. */
// Seuil de confiance : 0,5.
export const MIN_EVENT_CONFIDENCE = 0.5;

/** Règles de déduplication par famille (distance, fenêtre de temps, clé d'identité). */
// Règles par famille.
export const DEDUP_RULES: Partial<Record<AtmosphericEventType, DedupOptions>> = {
  // Incendies déclarés : 5 km et 3 jours (le même feu déclaré par deux agences).
  wildfire: { radiusKm: 5, windowMs: 3 * 24 * 3_600_000 },
  // Cyclones : même nom, ou 600 km et 12 heures.
  cyclone: { radiusKm: 600, windowMs: 12 * 3_600_000, keyOf: (e) => (e.name ? normalizeStormName(e.name) || null : null) },
// Fin des règles.
};

/** Un événement écarté et sa raison. */
// Forme d'une exclusion.
export interface Exclusion {
  // id : l'identifiant de l'événement (ou son nom).
  id: string;
  // name : son nom, ou null.
  name: string | null;
  // reason : la raison, en clair.
  reason: string;
// Fin de Exclusion.
}

/** Résultat du filtrage d'une liste. */
// Forme du résultat.
export interface Finalized {
  // shown : les événements affichables.
  shown: AtmosphericEvent[];
  // excluded : les événements écartés.
  excluded: Exclusion[];
// Fin de Finalized.
}

/** Filtre puis déduplique une liste d'événements, à l'instant `now`. */
// Fonction finalizeEvents : la liste et l'instant de référence.
export function finalizeEvents(events: AtmosphericEvent[], now: number): Finalized {
  // Événements gardés et écartés.
  const kept: AtmosphericEvent[] = [], excluded: Exclusion[] = [];
  // ex : note une exclusion.
  const ex = (e: AtmosphericEvent, reason: string) => excluded.push({ id: e.id, name: e.name, reason });
  // Pour chaque événement :
  for (const e of events) {
    // position illisible : écarté ;
    if (!isLonLat(e.lon, e.lat)) { ex(e, 'position hors du globe'); continue; }
    // aucune provenance : écarté ;
    if (!e.sources?.length) { ex(e, 'aucune source'); continue; }
    // âge de la dernière détection ;
    const age = ageMs(e.detectedAt, now);
    // périmé : écarté ;
    if (age > (MAX_EVENT_AGE_MS[e.type] ?? 24 * 3_600_000)) { ex(e, `donnée périmée (${Number.isFinite(age) ? `${Math.round(age / 3_600_000)} h` : 'heure illisible'})`); continue; }
    // daté de plus d'une heure dans le futur (horloge du fournisseur) : écarté ;
    if (age < -3_600_000) { ex(e, 'heure dans le futur'); continue; }
    // trop peu sûr : écarté ;
    if (!(e.confidence >= MIN_EVENT_CONFIDENCE)) { ex(e, `confiance insuffisante (${e.confidence})`); continue; }
    // gardé.
    kept.push(e);
  // Fin de la boucle.
  }
  // Familles présentes.
  const types = [...new Set(kept.map((e) => e.type))];
  // Déduplication famille par famille (sans règle : liste inchangée).
  const shown = types.flatMap((t) => { const list = kept.filter((e) => e.type === t); const rule = DEDUP_RULES[t]; return rule ? dedupEvents(list, rule) : list; });
  // Résultat.
  return { shown, excluded };
// Fin de finalizeEvents.
}

/** Instantané d'un calque. */
// Forme d'un instantané.
export interface LayerSnapshot {
  // layer : le nom du calque.
  layer: string;
  // events : les événements affichables.
  events: AtmosphericEvent[];
  // excluded : les événements écartés et leurs raisons.
  excluded: Exclusion[];
  // updatedAt : l'heure de la mise à jour (ISO 8601).
  updatedAt: string;
  // stale : vrai si au moins un fournisseur n'a rendu que sa dernière donnée connue.
  stale: boolean;
  // errors : les pannes de fournisseurs.
  errors: string[];
// Fin de LayerSnapshot.
}

/** Requête sur les événements de tous les calques. */
// Forme de la requête.
export interface EventQuery {
  // types : familles voulues (toutes si absent).
  types?: AtmosphericEventType[];
  // bbox : emprise [ouest, sud, est, nord] (tout le globe si absente ; ouest > est : passage de l'antiméridien).
  bbox?: [number, number, number, number];
  // limit : nombre maximal d'événements.
  limit?: number;
// Fin de EventQuery.
}

/** Vrai si un point est dans l'emprise (avec passage de l'antiméridien quand ouest > est). */
// Fonction inBbox : le point et l'emprise.
export function inBbox(lon: number, lat: number, [w, s, e, n]: [number, number, number, number]): boolean {
  // Hors des latitudes : non.
  if (lat < s || lat > n) return false;
  // Emprise ordinaire, ou à cheval sur l'antiméridien.
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
// Fin de inBbox.
}

/** Gestionnaire des événements atmosphériques : instantanés par calque, requêtes et état de contrôle. */
// Classe AtmosphericEventManager.
export class AtmosphericEventManager {
  // Instantanés par nom de calque.
  private layers = new Map<string, LayerSnapshot>();

  /** Remplace l'instantané d'un calque après filtrage et déduplication ; rend l'instantané. */
  // Méthode update : le calque, les événements, l'état des fournisseurs et l'instant de référence.
  update(layer: string, events: AtmosphericEvent[], meta: { stale: boolean; errors: string[]; excluded?: Exclusion[] }, now: number): LayerSnapshot {
    // Filtrage et déduplication.
    const { shown, excluded } = finalizeEvents(events, now);
    // Instantané : les exclusions du fournisseur (déjà faites en amont) puis celles du filtrage.
    const snap: LayerSnapshot = { layer, events: shown, excluded: [...(meta.excluded ?? []), ...excluded], updatedAt: new Date(now).toISOString(), stale: meta.stale, errors: meta.errors };
    // Rangé.
    this.layers.set(layer, snap);
    // Rendu.
    return snap;
  // Fin de update.
  }

  /** Instantané d'un calque, ou null. */
  // Méthode get : le calque.
  get(layer: string): LayerSnapshot | null {
    // Instantané rangé, ou null.
    return this.layers.get(layer) ?? null;
  // Fin de get.
  }

  /** Événements de tous les calques, filtrés par famille et par emprise. */
  // Méthode query : la requête.
  query(q: EventQuery = {}): AtmosphericEvent[] {
    // Tous les événements.
    let all = [...this.layers.values()].flatMap((s) => s.events);
    // Filtre des familles.
    if (q.types?.length) all = all.filter((e) => q.types!.includes(e.type));
    // Filtre de l'emprise.
    if (q.bbox) all = all.filter((e) => inBbox(e.lon, e.lat, q.bbox!));
    // Limite.
    return q.limit ? all.slice(0, q.limit) : all;
  // Fin de query.
  }

  /** État de contrôle : par calque, nombre d'événements, d'exclusions, de contradictions, péremption et pannes. */
  // Méthode health.
  health(): { layer: string; events: number; excluded: number; contradictions: number; stale: boolean; errors: string[]; updatedAt: string }[] {
    // Une ligne par calque.
    return [...this.layers.values()].map((s) => ({
      // Nom du calque et nombre d'événements.
      layer: s.layer, events: s.events.length,
      // Nombre d'exclusions.
      excluded: s.excluded.length,
      // Nombre d'événements portant une contradiction entre fournisseurs.
      contradictions: s.events.filter((e) => e.flags.some((f) => f.startsWith('contradiction'))).length,
      // Péremption, pannes et heure de mise à jour.
      stale: s.stale, errors: s.errors, updatedAt: s.updatedAt,
    // Fin de la ligne.
    }));
  // Fin de health.
  }
// Fin de AtmosphericEventManager.
}
