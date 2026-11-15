// Importe le format commun et ses outils : distance, confiance combinée, réunion des provenances.
import { AtmosphericEvent, ageMs, combineConfidence, haversineKm, mergeProvenance } from './atmospheric-event';

// Déduplication entre sources (sans NestJS, donc testable seule).
//
// Deux lectures sont le même phénomène si elles sont de la même famille et, soit portent la même clé (le même nom de
// cyclone, par exemple), soit sont proches dans l'espace ET dans le temps. Les lectures d'un même phénomène sont
// réunies en un seul événement qui garde toutes les provenances et toutes les mesures (details.readings), pour que les
// contradictions entre fournisseurs restent visibles. Le regroupement est transitif (A≈B et B≈C : un seul événement).
// Coût quadratique : prévu pour quelques centaines d'événements (cyclones, incendies déclarés) ; les points chauds
// satellite, par dizaines de milliers, ont leur propre fusion sur grille (firms.ts).

/** Une mesure d'intensité gardée par fournisseur, pour comparer les sources. */
// Forme d'une mesure.
export interface Reading {
  // provider : le fournisseur.
  provider: string;
  // value : la valeur mesurée, ou null.
  value: number | null;
  // unit : son unité.
  unit: string;
  // at : l'heure de la mesure (ISO 8601).
  at: string;
// Fin de Reading.
}

/** Réglages de la déduplication. */
// Forme des réglages.
export interface DedupOptions {
  // radiusKm : distance au-delà de laquelle deux lectures sont distinctes.
  radiusKm: number;
  // windowMs : écart de temps au-delà duquel deux lectures sont distinctes.
  windowMs: number;
  // keyOf : clé d'identité facultative (deux lectures de même clé non nulle sont le même phénomène).
  keyOf?: (e: AtmosphericEvent) => string | null;
// Fin de DedupOptions.
}

// Rang des statuts : une observation l'emporte sur une estimation, qui l'emporte sur une prévision.
const STATUS_RANK: Record<string, number> = { 'observé': 3, 'estimé': 2, 'prévu': 1 };

/** Vrai si `a` doit servir de base à la fusion plutôt que `b` : meilleur statut, puis plus récent, puis plus sûr. */
// Fonction better : les deux événements.
function better(a: AtmosphericEvent, b: AtmosphericEvent): boolean {
  // Statuts différents : le mieux classé.
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] > STATUS_RANK[b.status];
  // Heures de détection.
  const ta = Date.parse(a.detectedAt), tb = Date.parse(b.detectedAt);
  // Heures différentes : la plus récente.
  if (ta !== tb) return ta > tb;
  // Sinon : la plus grande confiance.
  return a.confidence >= b.confidence;
// Fin de better.
}

/** Les mesures d'un événement : celles déjà réunies, sinon la sienne. */
// Fonction readingsOf : l'événement.
export function readingsOf(e: AtmosphericEvent): Reading[] {
  // Mesures déjà réunies par une fusion précédente.
  const known = e.details?.readings;
  // Présentes : on les rend.
  if (Array.isArray(known)) return known as Reading[];
  // Sinon : la mesure de l'événement, attribuée à son premier fournisseur.
  return [{ provider: e.sources[0]?.provider ?? 'inconnu', value: e.intensity.value, unit: e.intensity.unit, at: e.detectedAt }];
// Fin de readingsOf.
}

/** Réunit deux lectures du même phénomène en un événement. */
// Fonction mergePair : les deux événements.
export function mergePair(a: AtmosphericEvent, b: AtmosphericEvent): AtmosphericEvent {
  // Base : la meilleure des deux ; autre : la seconde.
  const [base, other] = better(a, b) ? [a, b] : [b, a];
  // Fournisseurs distincts de chaque côté.
  const pa = new Set(base.sources.map((s) => s.provider)), pb = new Set(other.sources.map((s) => s.provider));
  // Vrai si l'autre lecture apporte au moins un fournisseur nouveau (lectures indépendantes).
  const independent = [...pb].some((p) => !pa.has(p));
  // Confiance : combinée si les sources sont indépendantes, sinon la plus haute.
  const confidence = independent ? combineConfidence([base.confidence, other.confidence]) : Math.max(base.confidence, other.confidence);
  // Événement réuni : la base, complétée (début).
  return {
    // Les champs de la base.
    ...base,
    // Nom : celui de la base, sinon celui de l'autre lecture.
    name: base.name ?? other.name,
    // Toutes les provenances, sans doublon.
    sources: mergeProvenance(base.sources, other.sources),
    // La confiance calculée.
    confidence,
    // Début de validité : le plus ancien des deux.
    validFrom: Date.parse(other.validFrom) < Date.parse(base.validFrom) ? other.validFrom : base.validFrom,
    // Alertes : réunies sans doublon.
    flags: [...new Set([...base.flags, ...other.flags])],
    // Détails : ceux de l'autre lecture, recouverts par ceux de la base, et toutes les mesures.
    details: { ...other.details, ...base.details, readings: [...readingsOf(base), ...readingsOf(other)] },
  // Fin de l'événement réuni.
  };
// Fin de mergePair.
}

/** Vrai si deux événements de même famille sont le même phénomène, selon les réglages. */
// Fonction sameEvent : les deux événements et les réglages.
export function sameEvent(a: AtmosphericEvent, b: AtmosphericEvent, o: DedupOptions): boolean {
  // Familles différentes : jamais le même.
  if (a.type !== b.type) return false;
  // Clés d'identité, si la règle en donne.
  const ka = o.keyOf?.(a) ?? null, kb = o.keyOf?.(b) ?? null;
  // Même clé non nulle : le même phénomène.
  if (ka && kb && ka === kb) return true;
  // Écart de temps entre les deux détections.
  const dt = Math.abs(ageMs(a.detectedAt, 0) - ageMs(b.detectedAt, 0));
  // Proches dans le temps et dans l'espace : le même phénomène.
  return dt <= o.windowMs && haversineKm(a.lon, a.lat, b.lon, b.lat) <= o.radiusKm;
// Fin de sameEvent.
}

/** Déduplique une liste d'événements : un événement par phénomène, provenances et mesures conservées. */
// Fonction dedupEvents : la liste et les réglages.
export function dedupEvents(events: AtmosphericEvent[], o: DedupOptions): AtmosphericEvent[] {
  // Parent de chaque événement dans les groupes (union-find) : lui-même au départ.
  const parent = events.map((_, i) => i);
  // find : la racine du groupe d'un événement, en raccourcissant le chemin.
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  // Pour chaque paire d'événements :
  for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
    // même phénomène : leurs groupes sont réunis.
    if (sameEvent(events[i], events[j], o)) parent[find(j)] = find(i);
  // Fin des paires.
  }
  // Événement réuni de chaque groupe, rangé par racine.
  const merged = new Map<number, AtmosphericEvent>();
  // Pour chaque événement, dans l'ordre d'arrivée :
  events.forEach((e, i) => {
    // la racine de son groupe ;
    const root = find(i);
    // l'événement déjà réuni pour ce groupe ;
    const prev = merged.get(root);
    // le premier du groupe est pris tel quel, les suivants y sont fusionnés.
    merged.set(root, prev ? mergePair(prev, e) : e);
  // Fin du parcours.
  });
  // Les événements réunis, dans l'ordre d'arrivée de leur premier membre.
  return [...merged.values()];
// Fin de dedupEvents.
}
