/**
 * Régions actives du Soleil et éruptions localisées, en direct.
 *
 * Deux sources, indépendantes l'une de l'autre :
 *  - NOAA SWPC « solar_regions.json » : les groupes de taches observés, chacun avec sa latitude et sa longitude
 *    héliographiques (repère de Stonyhurst, c'est-à-dire mesurées depuis le méridien qui fait face à la Terre), sa
 *    surface, son nombre de taches et les probabilités d'éruption de classe C, M et X des prochaines 24 heures ;
 *  - NASA DONKI « FLR » : les éruptions réellement observées, chacune avec sa classe GOES et le lieu d'où elle est
 *    partie (champ `sourceLocation`, de la forme « N16E35 »), également en coordonnées de Stonyhurst.
 *
 * Les positions sont rendues en degrés : latitude positive au nord, longitude positive à l'ouest (W), négative à
 * l'est (E), comme le veut la convention solaire. Elles valent à l'instant d'observation porté par chaque entrée :
 * c'est au client de les faire tourner jusqu'à l'instant présent, la rotation du Soleil emportant les régions
 * d'est en ouest (voir sunSurfaceMath.jsx côté moteur).
 *
 * Aucune clé n'est nécessaire : le point d'entrée DONKI du CCMC est ouvert, celui de la NOAA aussi. Chaque flux est
 * lu séparément : un flux en panne laisse l'autre répondre. Le résultat est gardé 15 minutes en mémoire.
 */
// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';

/** Adresse de base du centre de météo spatiale de la NOAA. */
// Déclare l'adresse de la NOAA.
const SWPC = 'https://services.swpc.noaa.gov';
/** Adresse de base du service DONKI du CCMC (NASA), sans clé d'API. */
// Déclare l'adresse de DONKI.
const DONKI = 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get';
/** Durée de garde en mémoire : 15 minutes. */
// Déclare la durée de garde.
const TTL_MS = 15 * 60 * 1_000;
/** Délai maximal d'un appel : 15 secondes. */
// Déclare le délai maximal.
const TIMEOUT_MS = 15_000;
/** Profondeur de la fenêtre des éruptions demandées à DONKI, en jours. */
// Déclare la profondeur de la fenêtre.
const FLARE_WINDOW_DAYS = 3;
/** Nombre maximal de régions rendues : au-delà, les plus petites n'apportent rien à l'affichage. */
// Déclare le nombre maximal de régions.
const MAX_REGIONS = 24;
/** Nombre maximal d'éruptions localisées rendues. */
// Déclare le nombre maximal d'éruptions.
const MAX_FLARES = 16;

/** Une région active : un groupe de taches, avec sa position et son potentiel d'éruption. */
// Ouvre la description d'une région active.
export interface SolarRegion {
  /** Numéro NOAA de la région (ex. 4571). */
  // number : son numéro.
  number: number;
  /** Latitude héliographique, en degrés, positive au nord. */
  // lat : sa latitude.
  lat: number;
  /** Longitude de Stonyhurst, en degrés, positive à l'ouest, valable à la date `observedAt`. */
  // lon : sa longitude.
  lon: number;
  /** Longitude de Carrington, en degrés : fixée au Soleil, donc indépendante du temps. */
  // carringtonLon : sa longitude de Carrington, ou null.
  carringtonLon: number | null;
  /** Date d'observation de la position (AAAA-MM-JJ), les positions valant 24h00 UTC ce jour-là. */
  // observedAt : sa date d'observation.
  observedAt: string;
  /** Surface du groupe, en millionièmes de disque solaire. */
  // area : sa surface.
  area: number;
  /** Étendue en longitude du groupe, en degrés. */
  // extent : son étendue.
  extent: number;
  /** Nombre de taches du groupe. */
  // spots : son nombre de taches.
  spots: number;
  /** Classification de McIntosh du groupe (ex. « Dao »), ou null. */
  // spotClass : sa classe de taches.
  spotClass: string | null;
  /** Classe magnétique du groupe (ex. « Beta »), ou null. */
  // magClass : sa classe magnétique.
  magClass: string | null;
  /** Probabilités d'éruption des prochaines 24 heures, en pourcentage, par classe. */
  // probability : ses probabilités d'éruption.
  probability: { c: number; m: number; x: number };
  /** Nombre d'éruptions de chaque classe déjà comptées sur la région. */
  // events : ses éruptions déjà comptées.
  events: { c: number; m: number; x: number };
// Fin de la description d'une région.
}

/** Une éruption localisée : classe GOES, instants, et le lieu d'où elle est partie. */
// Ouvre la description d'une éruption localisée.
export interface LocatedFlare {
  /** Classe GOES complète (ex. « M1.2 »). */
  // cls : sa classe.
  cls: string;
  /** Début, maximum et fin, en texte ISO, ou null quand la donnée manque. */
  // begin : son début.
  begin: string | null;
  // peak : son maximum.
  peak: string | null;
  // end : sa fin.
  end: string | null;
  /** Latitude héliographique du départ, en degrés, positive au nord. */
  // lat : sa latitude.
  lat: number;
  /** Longitude de Stonyhurst du départ, en degrés, positive à l'ouest, valable à l'instant `peak` ou `begin`. */
  // lon : sa longitude.
  lon: number;
  /** Numéro NOAA de la région d'origine, ou null quand elle n'était pas encore numérotée. */
  // region : le numéro de sa région.
  region: number | null;
// Fin de la description d'une éruption.
}

/** Forme de la réponse de la route. */
// Ouvre la description de la réponse.
export interface SolarRegionsData {
  /** Origine des données. */
  // source : l'origine des données.
  source: string;
  /** Heure de fabrication de la réponse. */
  // generatedAt : l'heure de fabrication.
  generatedAt: string;
  /** Repère des positions, pour lever toute ambiguïté côté client. */
  // frame : le repère des positions.
  frame: string;
  /** Les régions actives, de la plus grande à la plus petite. */
  // regions : les régions actives.
  regions: SolarRegion[];
  /** Les éruptions localisées, de la plus récente à la plus ancienne. */
  // flares : les éruptions localisées.
  flares: LocatedFlare[];
// Fin de la description de la réponse.
}

/** Type Row : une ligne de données, un objet aux champs de type inconnu. */
// Déclare le type Row.
type Row = Record<string, unknown>;

/**
 * Convertit une valeur en nombre fini, ou rend null. Les champs absents de la NOAA et de DONKI valent `null` ou
 * la chaîne vide, que `Number` transformerait en zéro : ils sont écartés avant toute conversion, pour qu'une
 * position manquante ne devienne pas une position à zéro degré, c'est-à-dire au centre du disque.
 */
// Déclare num.
const num = (v: unknown): number | null => {
  // Valeur absente ou texte vide : null, sans conversion.
  if (v === null || v === undefined || v === '') return null;
  // Un nombre est pris tel quel ; toute autre valeur est convertie.
  const n = typeof v === 'number' ? v : Number(v);
  // Nombre fini : on le rend ; sinon null.
  return Number.isFinite(n) ? n : null;
// Fin de num.
};
/** Rend la valeur si c'est un texte non vide, sinon null. */
// Déclare str.
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** Convertit une valeur en nombre fini, ou rend zéro : pour les compteurs, qu'un trou ne doit pas casser. */
// Déclare count.
const count = (v: unknown): number => num(v) ?? 0;

/**
 * Lit une position héliographique écrite à la manière de la NOAA et de la NASA, « N16E35 » : lettre de l'hémisphère,
 * latitude, lettre de la direction, longitude. Rend la latitude (positive au nord) et la longitude de Stonyhurst
 * (positive à l'ouest), ou null si le texte n'a pas cette forme.
 */
// Déclare et exporte parseStonyhurst : le texte de la position.
export function parseStonyhurst(text: unknown): { lat: number; lon: number } | null {
  // Le texte, nettoyé ; absent : rien.
  const s = str(text);
  // Sans texte : null.
  if (!s) return null;
  // Cherche la forme attendue, sans distinction de casse.
  const m = /^([NS])\s*(\d{1,2})\s*([EW])\s*(\d{1,3})$/i.exec(s.replace(/\s+/g, ''));
  // Forme non reconnue : null.
  if (!m) return null;
  // La latitude, négative dans l'hémisphère sud.
  const lat = Number(m[2]) * (m[1].toUpperCase() === 'S' ? -1 : 1);
  // La longitude, négative vers l'est.
  const lon = Number(m[4]) * (m[3].toUpperCase() === 'E' ? -1 : 1);
  // Valeurs hors des bornes physiques : null.
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // Rend la position.
  return { lat, lon };
// Fin de parseStonyhurst.
}

/**
 * Lit le tableau « solar_regions.json » de la NOAA : ne garde que la journée d'observation la plus récente, une
 * entrée par numéro de région, et range les régions de la plus grande à la plus petite.
 */
// Déclare et exporte parseRegions : le JSON de la NOAA.
export function parseRegions(json: unknown): SolarRegion[] {
  // Pas un tableau : aucune région.
  if (!Array.isArray(json)) return [];
  // Les lignes qui sont des objets.
  const rows = json.filter((r) => r && typeof r === 'object') as Row[];
  // La date d'observation la plus récente présente dans le tableau, ou null.
  const latest = rows.reduce<string | null>((best, r) => {
    // La date de la ligne.
    const date = str(r.observed_date);
    // Garde la plus grande dans l'ordre du texte, qui est aussi l'ordre chronologique pour AAAA-MM-JJ.
    return date && (!best || date > best) ? date : best;
  // Valeur de départ : aucune date.
  }, null);
  // Sans date : aucune région.
  if (!latest) return [];
  // Les régions, une par numéro.
  const byNumber = new Map<number, SolarRegion>();
  // Pour chaque ligne (début).
  for (const r of rows) {
    // Lignes d'un autre jour : ignorées.
    if (str(r.observed_date) !== latest) continue;
    // Le numéro de la région, sa latitude et sa longitude.
    const number = num(r.region);
    // La latitude.
    const lat = num(r.latitude);
    // La longitude.
    const lon = num(r.longitude);
    // Une entrée sans numéro ni position complète n'est pas plaçable : ignorée.
    if (number === null || lat === null || lon === null) continue;
    // Positions hors des bornes physiques : ignorées.
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // Range la région sous son numéro, la dernière ligne lue l'emportant.
    byNumber.set(number, {
      // son numéro ;
      number,
      // sa latitude ;
      lat,
      // sa longitude ;
      lon,
      // sa longitude de Carrington ;
      carringtonLon: num(r.carrington_longitude),
      // sa date d'observation ;
      observedAt: latest,
      // sa surface ;
      area: count(r.area),
      // son étendue ;
      extent: count(r.extent),
      // son nombre de taches ;
      spots: count(r.number_spots),
      // sa classe de taches ;
      spotClass: str(r.spot_class),
      // sa classe magnétique ;
      magClass: str(r.mag_class),
      // ses probabilités d'éruption ;
      probability: { c: count(r.c_flare_probability), m: count(r.m_flare_probability), x: count(r.x_flare_probability) },
      // ses éruptions déjà comptées.
      events: { c: count(r.c_xray_events), m: count(r.m_xray_events), x: count(r.x_xray_events) },
    // Fin de l'enregistrement.
    });
  // Fin de la boucle.
  }
  // Les régions rangées de la plus grande à la plus petite, puis bornées en nombre.
  return [...byNumber.values()].sort((a, b) => b.area - a.area || b.spots - a.spots).slice(0, MAX_REGIONS);
// Fin de parseRegions.
}

/**
 * Lit le tableau « FLR » de DONKI : ne garde que les éruptions dont le lieu de départ est lisible, de la plus
 * récente à la plus ancienne.
 */
// Déclare et exporte parseLocatedFlares : le JSON de DONKI.
export function parseLocatedFlares(json: unknown): LocatedFlare[] {
  // Pas un tableau : aucune éruption.
  if (!Array.isArray(json)) return [];
  // À partir des lignes qui sont des objets :
  return (json.filter((r) => r && typeof r === 'object') as Row[])
    // chaque ligne devient une éruption, ou null si son lieu de départ est illisible ;
    .map((r) => {
      // Le lieu de départ.
      const at = parseStonyhurst(r.sourceLocation);
      // Sans lieu lisible : null, la ligne sera écartée.
      if (!at) return null;
      // La classe GOES ; absente : la ligne sera écartée.
      const cls = str(r.classType);
      // Sans classe : null.
      if (!cls) return null;
      // L'éruption.
      return {
        // sa classe ;
        cls,
        // son début ;
        begin: str(r.beginTime),
        // son maximum ;
        peak: str(r.peakTime),
        // sa fin ;
        end: str(r.endTime),
        // sa latitude ;
        lat: at.lat,
        // sa longitude ;
        lon: at.lon,
        // le numéro de sa région.
        region: num(r.activeRegionNum),
      // Fin de l'éruption.
      };
    // Fin de la transformation.
    })
    // on écarte les lignes illisibles ;
    .filter((f): f is LocatedFlare => f !== null)
    // on range de la plus récente à la plus ancienne, d'après le maximum ou à défaut le début ;
    .sort((a, b) => Date.parse(b.peak ?? b.begin ?? '') - Date.parse(a.peak ?? a.begin ?? ''))
    // on borne le nombre rendu.
    .slice(0, MAX_FLARES);
// Fin de parseLocatedFlares.
}

/** Date au format AAAA-MM-JJ attendu par DONKI, à partir d'un instant en millisecondes. */
// Déclare et exporte donkiDate : l'instant.
export function donkiDate(ms: number): string {
  // La partie date de l'écriture ISO.
  return new Date(ms).toISOString().slice(0, 10);
// Fin de donkiDate.
}

/**
 * Régions actives et éruptions localisées, en direct. Chaque flux est indépendant : un flux en panne rend une liste
 * vide sans empêcher l'autre de répondre. Résultat gardé 15 min en mémoire, et lecture partagée entre les demandes
 * simultanées pour ne pas appeler les deux services plusieurs fois de suite.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des régions actives.
export class SolarRegionsService {
  // Réponse gardée en mémoire avec son heure ; null au départ.
  private cache: { at: number; data: SolarRegionsData } | null = null;
  // Lecture en cours, partagée entre les demandes simultanées ; null s'il n'y en a pas.
  private inFlight: Promise<SolarRegionsData> | null = null;

  /** Régions actives et éruptions localisées, depuis le cache quand il est frais. */
  // Méthode regions.
  async regions(): Promise<SolarRegionsData> {
    // Réponse en mémoire de moins de 15 minutes : on la rend.
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.data;
    // Si aucune lecture n'est en cours :
    if (!this.inFlight) {
      // on en lance une, et on efface la marque quand elle se termine, réussie ou non.
      this.inFlight = this.load().finally(() => { this.inFlight = null; });
    // Fin du cas.
    }
    // Renvoie la lecture en cours.
    return this.inFlight;
  // Fin de regions.
  }

  // Méthode privée load : lit les deux flux et compose la réponse.
  private async load(): Promise<SolarRegionsData> {
    // Instant de la lecture.
    const now = Date.now();
    // Premier jour de la fenêtre des éruptions.
    const from = donkiDate(now - FLARE_WINDOW_DAYS * 86_400_000);
    // Dernier jour de la fenêtre : aujourd'hui.
    const to = donkiDate(now);
    // Interroge les deux services en même temps et attend leurs réponses :
    const [regions, flares] = await Promise.all([
      // les régions actives de la NOAA ;
      this.json(`${SWPC}/json/solar_regions.json`),
      // les éruptions localisées de DONKI.
      this.json(`${DONKI}/FLR?startDate=${from}&endDate=${to}`),
    // Fin des appels.
    ]);
    // Réponse :
    const data: SolarRegionsData = {
      // origine des données ;
      source: 'NOAA SWPC (solar_regions.json) et NASA CCMC DONKI (FLR)',
      // heure de fabrication ;
      generatedAt: new Date(now).toISOString(),
      // repère des positions ;
      frame: 'Héliographique de Stonyhurst : latitude positive au nord, longitude positive à l’ouest',
      // les régions actives ;
      regions: parseRegions(regions),
      // les éruptions localisées.
      flares: parseLocatedFlares(flares),
    // Fin de la réponse.
    };
    // On ne garde en cache que si au moins un flux a répondu : sinon la prochaine demande réessaie aussitôt.
    if (data.regions.length || data.flares.length) this.cache = { at: now, data };
    // La renvoie.
    return data;
  // Fin de load.
  }

  // Méthode privée json : lit un flux à l'adresse complète donnée.
  private async json(url: string): Promise<unknown> {
    // Essaie
    try {
      // de l'appeler, avec abandon au bout du délai ;
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // réponse correcte : son JSON ; sinon null.
      return res.ok ? await res.json() : null;
    // En cas d'échec réseau,
    } catch {
      // null : ce flux manque, l'autre n'est pas touché.
      return null;
    // Fin du cas.
    }
  // Fin de json.
  }
// Fin du service.
}
