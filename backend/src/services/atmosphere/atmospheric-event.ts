// Format commun des phénomènes atmosphériques (sans NestJS, donc testable seul).
//
// Chaque fournisseur (NASA FIRMS, NASA EONET, GDACS, NOAA NHC…) a son propre format : ses lectures sont ramenées à
// un seul objet, AtmosphericEvent, avant toute fusion ou tout affichage. Un événement garde toujours sa provenance
// (fournisseurs, identifiants, heures de lecture) et son statut : observé, estimé (calculé à partir d'observations)
// ou prévu (sortie d'un modèle ou d'une prévision officielle).

/** Familles de phénomènes du moteur atmosphérique. */
// Type des familles : points chauds, incendies confirmés, cyclones, puis les familles des lots suivants.
export type AtmosphericEventType = 'hotspot' | 'wildfire' | 'cyclone' | 'lightning' | 'storm' | 'precipitation' | 'aerosol' | 'smoke' | 'wind' | 'jet-stream' | 'fog';

/** Statut d'un événement : mesuré, déduit d'une mesure, ou prévu. */
// Type du statut : observé, estimé ou prévu.
export type AtmosphericEventStatus = 'observé' | 'estimé' | 'prévu';

/** Une lecture d'un fournisseur ayant contribué à l'événement. */
// Forme d'une provenance.
export interface Provenance {
  // provider : l'identifiant du fournisseur dans le registre (providers.ts).
  provider: string;
  // sourceId : l'identifiant de l'objet chez le fournisseur, ou null.
  sourceId: string | null;
  // url : la fiche de l'objet chez le fournisseur, ou null.
  url: string | null;
  // observedAt : l'heure de la mesure selon le fournisseur (ISO 8601), ou null.
  observedAt: string | null;
  // fetchedAt : l'heure à laquelle le serveur a lu la donnée (ISO 8601).
  fetchedAt: string;
// Fin de Provenance.
}

/** Géométrie GeoJSON réduite : un point, une ligne (trajectoire) ou un polygone (zone). */
// Forme de la géométrie.
export interface EventGeometry {
  // type : Point, LineString ou Polygon.
  type: 'Point' | 'LineString' | 'Polygon';
  // coordinates : longitude puis latitude, en degrés, à la manière de GeoJSON.
  coordinates: number[] | number[][] | number[][][];
// Fin de EventGeometry.
}

/** Événement atmosphérique au format commun. */
// Forme d'un événement.
export interface AtmosphericEvent {
  // id : identifiant unique et stable (type, fournisseur, clé).
  id: string;
  // type : la famille du phénomène.
  type: AtmosphericEventType;
  // name : le nom publié (cyclone, incendie), ou null.
  name: string | null;
  // lon : la longitude du point représentatif, en degrés.
  lon: number;
  // lat : la latitude du point représentatif, en degrés.
  lat: number;
  // geometry : la géométrie complète (point, trajectoire observée, zone).
  geometry: EventGeometry;
  // altitudeM : l'altitude du phénomène en mètres (bas et haut), ou null si elle n'est pas connue.
  altitudeM: { min: number; max: number } | null;
  // detectedAt : l'heure de la détection la plus récente (ISO 8601).
  detectedAt: string;
  // validFrom : le début de validité (ISO 8601).
  validFrom: string;
  // validTo : la fin de validité (ISO 8601), ou null si elle n'est pas connue.
  validTo: string | null;
  // intensity : la valeur mesurée, son unité et un libellé lisible.
  intensity: { value: number | null; unit: string; label: string | null };
  // confidence : la confiance, de 0 (aucune) à 1 (certaine).
  confidence: number;
  // sources : toutes les lectures qui ont contribué à l'événement.
  sources: Provenance[];
  // resolution : la taille d'un pixel de mesure (m) et l'écart entre deux mesures (s), ou null.
  resolution: { spatialM: number | null; temporalS: number | null };
  // status : observé, estimé ou prévu.
  status: AtmosphericEventStatus;
  // confirmed : vrai si une agence l'a confirmé (incendie déclaré), faux pour une simple détection satellite.
  confirmed: boolean;
  // flags : les alertes de contrôle (données périmées, sources contradictoires).
  flags: string[];
  // details : les champs propres à la famille (catégorie d'un cyclone, trajectoire, satellites…).
  details: Record<string, unknown>;
// Fin de AtmosphericEvent.
}

/** Rayon moyen de la Terre, en kilomètres. */
// Rayon terrestre moyen : 6 371 km.
export const EARTH_RADIUS_KM = 6371;

/** Vrai si la longitude et la latitude sont des nombres sur le globe. */
// Fonction isLonLat : contrôle une paire de coordonnées.
export function isLonLat(lon: unknown, lat: unknown): boolean {
  // Deux nombres finis, latitude entre −90 et 90, longitude entre −180 et 180.
  return typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
// Fin de isLonLat.
}

/** Distance sur la sphère entre deux points, en kilomètres (formule de haversine). */
// Fonction haversineKm : longitude et latitude des deux points.
export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  // Degrés vers radians.
  const r = Math.PI / 180;
  // Écart de latitude et écart de longitude, en radians.
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  // Terme de la formule de haversine.
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  // Distance : angle au centre fois le rayon.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
// Fin de haversineKm.
}

/** Identifiant stable d'un événement : type, fournisseur et clé, sans espace ni caractère spécial. */
// Fonction makeEventId : le type, le fournisseur et la clé propre au fournisseur.
export function makeEventId(type: AtmosphericEventType, provider: string, key: string | number): string {
  // Clé nettoyée : lettres, chiffres, points, tirets et soulignés seulement.
  const clean = String(key).trim().replace(/[^A-Za-z0-9._-]+/g, '_');
  // Les trois parties, séparées par deux-points.
  return `${type}:${provider}:${clean}`;
// Fin de makeEventId.
}

/** Âge d'une heure ISO par rapport à `now`, en millisecondes ; Infinity si l'heure est illisible. */
// Fonction ageMs : l'heure ISO et l'instant de référence.
export function ageMs(iso: string | null | undefined, now: number): number {
  // Heure lue en millisecondes.
  const t = iso ? Date.parse(iso) : NaN;
  // Illisible : âge infini (la donnée sera traitée comme périmée).
  return Number.isFinite(t) ? now - t : Infinity;
// Fin de ageMs.
}

/**
 * Confiance de plusieurs lectures indépendantes du même phénomène : 1 − Π(1 − cᵢ), plafonnée à 0,99. Deux satellites
 * qui voient le même feu sont plus sûrs qu'un seul ; aucune combinaison n'atteint la certitude.
 */
// Fonction combineConfidence : la liste des confiances, de 0 à 1.
export function combineConfidence(values: number[]): number {
  // Probabilité que toutes les lectures se trompent.
  let miss = 1;
  // Pour chaque confiance valide, bornée entre 0 et 1 :
  for (const c of values) if (Number.isFinite(c)) miss *= 1 - Math.min(1, Math.max(0, c));
  // Complément, plafonné à 0,99 et arrondi au centième.
  return Math.round(Math.min(0.99, 1 - miss) * 100) / 100;
// Fin de combineConfidence.
}

/** Réunit deux listes de provenances sans doublon (même fournisseur et même identifiant). */
// Fonction mergeProvenance : les deux listes.
export function mergeProvenance(a: Provenance[], b: Provenance[]): Provenance[] {
  // Clés déjà présentes.
  const seen = new Set(a.map((p) => `${p.provider}|${p.sourceId ?? ''}`));
  // Copie de la première liste.
  const out = [...a];
  // Pour chaque provenance de la seconde liste :
  for (const p of b) {
    // sa clé ;
    const key = `${p.provider}|${p.sourceId ?? ''}`;
    // déjà présente : ignorée ;
    if (seen.has(key)) continue;
    // sinon notée et ajoutée.
    seen.add(key); out.push(p);
  // Fin de la boucle.
  }
  // Renvoie la liste réunie.
  return out;
// Fin de mergeProvenance.
}
