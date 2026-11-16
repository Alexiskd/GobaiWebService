// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';

// Adresse de base du centre de météo spatiale de la NOAA.
const SWPC = 'https://services.swpc.noaa.gov';
// Durée de garde en mémoire : 10 minutes.
const TTL_MS = 10 * 60 * 1_000;
// Délai maximal d'un appel : 15 secondes.
const TIMEOUT_MS = 15_000;

// Forme d'une éruption solaire.
export interface SolarFlare {
  /** Classe GOES (ex. « M1.4 », « X2.0 »). */
  // cls : sa classe.
  cls: string;
  // begin : son début, ou null.
  begin: string | null;
  // peak : son maximum, ou null.
  peak: string | null;
// Fin de SolarFlare.
}

// Forme de la réponse.
export interface SolarActivity {
  // source : l'origine des données.
  source: string;
  // generatedAt : l'heure de fabrication de la réponse.
  generatedAt: string;
  /** Indice Kp planétaire (0 à 9) le plus récent et son heure UTC. */
  // kp : l'indice Kp et son heure, ou null.
  kp: { value: number; time: string } | null;
  /** Nombre de taches solaires du dernier mois publié. */
  // sunspots : le nombre de taches et son mois, ou null.
  sunspots: { value: number; month: string } | null;
  /** Vitesse du vent solaire (km/s). */
  // solarWind : la vitesse du vent solaire et son heure, ou null.
  solarWind: { speed: number; time: string | null } | null;
  /** Éruptions des 7 derniers jours, la plus récente en premier (C et plus). */
  // flares : les éruptions récentes.
  flares: SolarFlare[];
// Fin de SolarActivity.
}

// Type Row : une ligne de données, un objet aux champs de type inconnu.
type Row = Record<string, unknown>;
// Fonction num : convertit une valeur en nombre, ou null.
const num = (v: unknown): number | null => {
  // Un nombre est pris tel quel ; toute autre valeur est convertie.
  const n = typeof v === 'number' ? v : Number(v);
  // Nombre fini : on le rend ; sinon null.
  return Number.isFinite(n) ? n : null;
// Fin de num.
};
// Fonction str : rend la valeur si c'est un texte non vide, sinon null.
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Tableau JSON NOAA : liste d'objets, ou liste de lignes dont la première est l'en-tête. */
// Fonction rowsOf : met un tableau de la NOAA sous forme de liste d'objets.
export function rowsOf(json: unknown): Row[] {
  // Pas un tableau, ou tableau vide : aucune ligne.
  if (!Array.isArray(json) || json.length === 0) return [];
  // Si le premier élément est lui-même un tableau, c'est un tableau avec en-tête :
  if (Array.isArray(json[0])) {
    // la première ligne donne les noms de colonnes, les autres les données ;
    const [head, ...rest] = json as unknown[][];
    // chaque ligne de données devient un objet nom de colonne → valeur.
    return rest.map((r) => Object.fromEntries(head.map((h, i) => [String(h), r[i]])));
  // Fin du cas.
  }
  // Sinon c'est déjà une liste d'objets : on ne garde que les objets.
  return json.filter((r) => r && typeof r === 'object') as Row[];
// Fin de rowsOf.
}

// Fonction parseKp : lit l'indice Kp le plus récent.
export function parseKp(json: unknown): SolarActivity['kp'] {
  // Lignes du tableau.
  const rows = rowsOf(json);
  // De la dernière ligne à la première :
  for (let i = rows.length - 1; i >= 0; i--) {
    // la ligne ;
    const r = rows[i];
    // sa valeur, cherchée sous les quatre noms que la NOAA a utilisés ;
    const value = num(r.Kp ?? r.kp ?? r.kp_index ?? r.estimated_kp);
    // son heure, sous deux noms possibles ;
    const time = str(r.time_tag ?? r.time);
    // première ligne complète trouvée : c'est la plus récente.
    if (value !== null && time) return { value, time };
  // Fin de la boucle.
  }
  // Aucune ligne complète : null.
  return null;
// Fin de parseKp.
}

// Fonction parseSunspots : lit le dernier nombre de taches solaires.
export function parseSunspots(json: unknown): SolarActivity['sunspots'] {
  // Lignes du tableau.
  const rows = rowsOf(json);
  // De la dernière ligne à la première :
  for (let i = rows.length - 1; i >= 0; i--) {
    // la ligne ;
    const r = rows[i];
    // le nombre de taches, sous deux noms possibles ;
    const value = num(r.ssn ?? r['sunspot_number']);
    // son mois, sous deux noms possibles ;
    const month = str(r['time-tag'] ?? r.time_tag);
    // première ligne valide (nombre positif ou nul et mois présent) : c'est la plus récente.
    if (value !== null && value >= 0 && month) return { value, month };
  // Fin de la boucle.
  }
  // Aucune ligne valide : null.
  return null;
// Fin de parseSunspots.
}

// Fonction parseWind : lit la vitesse du vent solaire.
export function parseWind(json: unknown): SolarActivity['solarWind'] {
  // La réponse est un objet, ou une liste dont on prend le premier élément.
  const r = (Array.isArray(json) ? json[0] : json) as Row | undefined;
  // Pas d'objet : null.
  if (!r || typeof r !== 'object') return null;
  // Vitesse, sous trois noms possibles.
  const speed = num(r.WindSpeed ?? r.proton_speed ?? r.speed);
  // Sans vitesse : null ; sinon la vitesse et son heure.
  return speed === null ? null : { speed, time: str(r.TimeStamp ?? r.time_tag) };
// Fin de parseWind.
}

// Fonction parseFlares : lit les éruptions récentes.
export function parseFlares(json: unknown): SolarFlare[] {
  // À partir des lignes du tableau :
  return rowsOf(json)
    // chaque ligne devient une éruption (classe, début, maximum) ;
    .map((r) => ({ cls: str(r.max_class ?? r.class) ?? '', begin: str(r.begin_time), peak: str(r.max_time) }))
    // on garde les classes C, M et X, les plus fortes ;
    .filter((f) => /^[CMX]/i.test(f.cls))
    // triées de la plus récente à la plus ancienne, d'après le maximum ou à défaut le début ;
    .sort((a, b) => Date.parse(b.peak ?? b.begin ?? '') - Date.parse(a.peak ?? a.begin ?? ''))
    // douze au plus.
    .slice(0, 12);
// Fin de parseFlares.
}

/**
 * Activité solaire en direct (NOAA Space Weather Prediction Center) : indice Kp, taches, vent solaire,
 * éruptions récentes. Chaque flux est indépendant : un flux en panne donne null sans bloquer les autres.
 * Résultat gardé 10 min en mémoire.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de l'activité solaire.
export class SolarActivityService {
  // Réponse gardée en mémoire avec son heure ; null au départ.
  private cache: { at: number; data: SolarActivity } | null = null;
  // Lecture en cours, partagée entre les demandes simultanées ; null s'il n'y en a pas.
  private inFlight: Promise<SolarActivity> | null = null;

  // Méthode activity.
  async activity(): Promise<SolarActivity> {
    // Réponse en mémoire de moins de 10 minutes : on la rend.
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.data;
    // Si aucune lecture n'est en cours :
    if (!this.inFlight) {
      // on en lance une, et on efface la marque quand elle se termine, réussie ou non.
      this.inFlight = this.load().finally(() => { this.inFlight = null; });
    // Fin du cas.
    }
    // Renvoie la lecture en cours.
    return this.inFlight;
  // Fin de activity.
  }

  // Méthode privée load.
  private async load(): Promise<SolarActivity> {
    // Interroge les quatre flux en même temps et attend leurs réponses :
    const [kp, ssn, wind, flares] = await Promise.all([
      // indice Kp ;
      this.json('/products/noaa-planetary-k-index.json'),
      // cycle solaire observé (taches) ;
      this.json('/json/solar-cycle/observed-solar-cycle-indices.json'),
      // vitesse du vent solaire ;
      this.json('/products/summary/solar-wind-speed.json'),
      // éruptions des 7 derniers jours.
      this.json('/json/goes/primary/xray-flares-7-day.json'),
    // Fin des appels.
    ]);
    // Réponse :
    const data: SolarActivity = {
      // origine des données ;
      source: 'NOAA Space Weather Prediction Center (services.swpc.noaa.gov)',
      // heure de fabrication ;
      generatedAt: new Date().toISOString(),
      // indice Kp ;
      kp: parseKp(kp),
      // taches ;
      sunspots: parseSunspots(ssn),
      // vent solaire ;
      solarWind: parseWind(wind),
      // éruptions.
      flares: parseFlares(flares),
    // Fin de la réponse.
    };
    // On ne garde en cache que si au moins un flux a répondu.
    // Si au moins un flux a donné quelque chose, la réponse est gardée en mémoire avec l'heure.
    if (data.kp || data.sunspots || data.solarWind || data.flares.length) this.cache = { at: Date.now(), data };
    // La renvoie.
    return data;
  // Fin de load.
  }

  // Méthode privée json : lit un flux.
  private async json(path: string): Promise<unknown> {
    // Essaie
    try {
      // de l'appeler, avec abandon au bout du délai ;
      const res = await fetch(`${SWPC}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // réponse correcte : son JSON ; sinon null.
      return res.ok ? await res.json() : null;
    // En cas d'échec réseau,
    } catch {
      // null : ce flux manque, les autres ne sont pas touchés.
      return null;
    // Fin du cas.
    }
  // Fin de json.
  }
// Fin du service.
}
