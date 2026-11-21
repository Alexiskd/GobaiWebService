// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';

// Adresse du flux NASA EONET : événements naturels en cours, catégorie volcans, sans clé.
const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open';
// Durée de garde en mémoire : 30 minutes (EONET est mis à jour quelques fois par jour).
const TTL_MS = 30 * 60 * 1_000;
// Délai maximal d'un appel : 15 secondes.
const TIMEOUT_MS = 15_000;

// Forme d'un volcan en éruption.
export interface ActiveVolcano {
  // id : l'identifiant EONET de l'événement.
  id: string;
  // name : le nom du volcan et son pays, tels que publiés.
  name: string;
  // lon : sa longitude, en degrés.
  lon: number;
  // lat : sa latitude, en degrés.
  lat: number;
  // date : la date de la dernière observation, ou null.
  date: string | null;
  // link : la fiche du volcan chez sa source (Smithsonian), ou null.
  link: string | null;
// Fin de ActiveVolcano.
}

// Forme de la réponse.
export interface ActiveVolcanoes {
  // source : l'origine des données.
  source: string;
  // generatedAt : l'heure de fabrication de la réponse.
  generatedAt: string;
  // volcanoes : les volcans en éruption.
  volcanoes: ActiveVolcano[];
// Fin de ActiveVolcanoes.
}

// Type Row : un objet aux champs de type inconnu.
type Row = Record<string, unknown>;
// Fonction str : rend la valeur si c'est un texte non vide, sinon null.
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Lit la réponse d'EONET : un volcan par événement, placé à sa dernière position ponctuelle connue. */
// Fonction parseVolcanoes : met la réponse d'EONET sous forme de liste de volcans.
export function parseVolcanoes(json: unknown): ActiveVolcano[] {
  // Les événements de la réponse ; aucun si la forme est inattendue.
  const events = (json as Row | null)?.events;
  // Pas une liste : aucun volcan.
  if (!Array.isArray(events)) return [];
  // Liste des volcans.
  const out: ActiveVolcano[] = [];
  // Pour chaque événement :
  for (const e of events as Row[]) {
    // son identifiant et son titre ;
    const id = str(e?.id), name = str(e?.title);
    // ses positions, de la plus ancienne à la plus récente ;
    const geometry = Array.isArray(e?.geometry) ? (e.geometry as Row[]) : [];
    // la dernière position de type point ;
    const point = [...geometry].reverse().find((g) => g?.type === 'Point' && Array.isArray(g.coordinates));
    // ses coordonnées : longitude puis latitude ;
    const [lon, lat] = ((point?.coordinates as unknown[]) || []).map(Number);
    // sans identifiant, sans nom ou hors du globe : événement ignoré.
    if (!id || !name || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // Première source de l'événement.
    const source = Array.isArray(e.sources) ? (e.sources as Row[])[0] : undefined;
    // Ajoute le volcan.
    out.push({ id, name, lon, lat, date: str(point?.date), link: str(source?.url) });
  // Fin de la boucle.
  }
  // Renvoie les volcans.
  return out;
// Fin de parseVolcanoes.
}

/**
 * Volcans en éruption dans le monde, en direct (NASA EONET, qui relaie le Smithsonian Global Volcanism Program).
 * Résultat gardé 30 min en mémoire ; si EONET ne répond pas, la dernière liste connue est renvoyée.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des volcans.
export class VolcanoesService {
  // Réponse gardée en mémoire avec son heure ; null au départ.
  private cache: { at: number; data: ActiveVolcanoes } | null = null;
  // Lecture en cours, partagée entre les demandes simultanées ; null s'il n'y en a pas.
  private inFlight: Promise<ActiveVolcanoes> | null = null;

  // Méthode active.
  async active(): Promise<ActiveVolcanoes> {
    // Réponse en mémoire de moins de 30 minutes : on la rend.
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.data;
    // Si aucune lecture n'est en cours :
    if (!this.inFlight) {
      // on en lance une, et on efface la marque quand elle se termine, réussie ou non.
      this.inFlight = this.load().finally(() => { this.inFlight = null; });
    // Fin du cas.
    }
    // Renvoie la lecture en cours.
    return this.inFlight;
  // Fin de active.
  }

  // Méthode privée load.
  private async load(): Promise<ActiveVolcanoes> {
    // Volcans lus ; null si EONET ne répond pas.
    let volcanoes: ActiveVolcano[] | null = null;
    // Essaie
    try {
      // d'appeler EONET, avec abandon au bout du délai ;
      const res = await fetch(EONET_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // réponse correcte : la liste des volcans.
      if (res.ok) volcanoes = parseVolcanoes(await res.json());
    // En cas d'échec réseau,
    } catch {
      // la liste reste null.
      volcanoes = null;
    // Fin du cas.
    }
    // EONET en panne : la dernière liste connue, ou une liste vide.
    if (!volcanoes) return this.cache?.data ?? this.wrap([]);
    // Réponse.
    const data = this.wrap(volcanoes);
    // La garde en mémoire avec l'heure.
    this.cache = { at: Date.now(), data };
    // La renvoie.
    return data;
  // Fin de load.
  }

  // Méthode privée wrap : habille une liste de volcans en réponse.
  private wrap(volcanoes: ActiveVolcano[]): ActiveVolcanoes {
    // Origine des données, heure de fabrication et volcans.
    return { source: 'NASA EONET (eonet.gsfc.nasa.gov) · Smithsonian Global Volcanism Program', generatedAt: new Date().toISOString(), volcanoes };
  // Fin de wrap.
  }
// Fin du service.
}
