// Inject : injection d'une dépendance par son jeton ; Injectable : rend le service injectable.
import { Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Type (effacé à la compilation) de la réponse des frontières.
import type { BordersDto } from '../../dto/borders.dto';
// Fonction qui calcule le milieu de chaque pays.
import { countryCenters } from './country-centers';
// Type (effacé à la compilation) d'un document TopoJSON.
import type { Topology } from '../world-atlas/topology';
// Service World Atlas, qui fournit la topologie des pays.
import { WorldAtlasService } from '../world-atlas/world-atlas.service';
 
/* -------------------------------------------------------------------------------------------------
 * Décodage minimal de TopoJSON (https://github.com/topojson/topojson-specification), sans dépendance.
 * Sert à extraire les frontières entre pays (arcs partagés par deux géométries distinctes) et les littoraux
 * (arcs utilisés par une seule géométrie, moins les découpes artificielles de la carte).
 * ----------------------------------------------------------------------------------------------- */
 
// Type Point : une longitude et une latitude.
type Point = [number, number];
 
/** Arcs en coordonnées réelles [lon, lat] (dé-quantifiés si besoin). */
// Fonction decodeArcs : rend les arcs de la topologie en coordonnées réelles.
function decodeArcs(topo: Topology): Point[][] {
  // Transformation de quantification, absente si les coordonnées sont déjà réelles.
  const t = topo.transform;
  // Pour chaque arc :
  return topo.arcs.map((arc) => {
    // sans transformation, chaque point est recopié tel quel ;
    if (!t) return arc.map(([x, y]) => [x, y] as Point);
    // sinon, position courante en entiers, à zéro au départ ;
    let x = 0, y = 0;
    // pour chaque point, donné en écart avec le précédent :
    return arc.map(([dx, dy]) => {
      // avance en x ;
      x += dx;
      // avance en y ;
      y += dy;
      // et convertit en degrés : entier × échelle + décalage, pour la longitude puis la latitude.
      return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] as Point;
    // Fin du point.
    });
  // Fin de l'arc.
  });
// Fin de decodeArcs.
}
 
/** Indices d'arcs (≥ 0) utilisés par une géométrie, quelle que soit sa profondeur (Polygon, MultiPolygon…). */
// Fonction arcIndices : ramasse dans un ensemble tous les numéros d'arcs d'une géométrie, quelle que soit la profondeur des listes.
function arcIndices(arcs: unknown, out: Set<number>): Set<number> {
  // Un nombre : c'est un numéro d'arc ; un numéro négatif désigne l'arc ~n parcouru à l'envers, on garde son numéro positif.
  if (typeof arcs === 'number') out.add(arcs < 0 ? ~arcs : arcs);
  // Une liste : on recommence sur chacun de ses éléments.
  else if (Array.isArray(arcs)) arcs.forEach((a) => arcIndices(a, out));
  // Renvoie l'ensemble.
  return out;
// Fin de arcIndices.
}
 
/** Nombre de géométries distinctes de l'objet qui utilisent chaque arc. */
// Fonction arcOwners : compte, pour chaque arc, combien de géométries l'utilisent.
function arcOwners(topo: Topology, objectName: string): Map<number, number> {
  // Géométries de l'objet demandé (les pays).
  const geometries = topo.objects[objectName]?.geometries;
  // Objet absent : erreur.
  if (!geometries) throw new Error(`Objet TopoJSON « ${objectName} » introuvable`);
  // Table numéro d'arc → nombre de géométries.
  const owners = new Map<number, number>();
  // Pour chaque géométrie :
  for (const g of geometries) {
    // pour chacun de ses arcs, compté une seule fois par géométrie, ajoute 1 à son compteur.
    for (const i of arcIndices(g.arcs, new Set())) owners.set(i, (owners.get(i) ?? 0) + 1);
  // Fin de la boucle.
  }
  // Renvoie la table.
  return owners;
// Fin de arcOwners.
}
 
/**
 * Frontières terrestres : arcs utilisés par au moins deux géométries différentes
 * (un arc utilisé par une seule est un littoral, ou une découpe à ±180°).
 */
// Fonction sharedBorders : les frontières terrestres.
function sharedBorders(topo: Topology, objectName = 'countries'): Point[][] {
  // Nombre de géométries par arc.
  const owners = arcOwners(topo, objectName);
  // Arcs en coordonnées réelles.
  const arcs = decodeArcs(topo);
  // À partir de toutes les entrées de la table :
  return [...owners.entries()]
    // garde les arcs utilisés par au moins deux pays ;
    .filter(([, n]) => n >= 2)
    // les trie par numéro d'arc, pour un résultat stable ;
    .sort((a, b) => a[0] - b[0])
    // remplace chaque numéro par l'arc lui-même ;
    .map(([i]) => arcs[i])
    // et retire les arcs introuvables.
    .filter(Boolean);
// Fin de sharedBorders.
}
 
// Tolérance : un dix-millième de degré.
const EDGE = 1e-4; // ≈ 10 m : tolérance d'arrondi de la quantification
 
/** Segment le long d'un bord de la carte (méridien ±180° ou pôle Sud) : découpe des polygones, pas un vrai rivage. */
// Fonction isMapEdge : le segment entre deux points longe-t-il un bord de la carte ?
const isMapEdge = ([lon0, lat0]: Point, [lon1, lat1]: Point) =>
  // Oui si les deux points sont sur le méridien 180° du même côté (est ou ouest),
  (Math.abs(lon0) >= 180 - EDGE && Math.abs(lon1) >= 180 - EDGE && Math.sign(lon0) === Math.sign(lon1))
  // ou si les deux sont au pôle Sud.
  || (lat0 <= -90 + EDGE && lat1 <= -90 + EDGE);
 
/**
 * Littoraux (mers, océans, grands lacs fermés comme la Caspienne) : arcs utilisés par une seule géométrie.
 * Les segments qui longent les bords de la carte (±180°, pôle Sud de l'Antarctique) sont retirés : la polyligne est
 * coupée à cet endroit.
 */
// Fonction coastlines : les littoraux.
function coastlines(topo: Topology, objectName = 'countries'): Point[][] {
  // Nombre de géométries par arc.
  const owners = arcOwners(topo, objectName);
  // Arcs en coordonnées réelles.
  const arcs = decodeArcs(topo);
  // Polylignes produites.
  const out: Point[][] = [];
  // Pour chaque arc utilisé par un seul pays, dans l'ordre des numéros :
  for (const [i] of [...owners.entries()].filter(([, n]) => n === 1).sort((a, b) => a[0] - b[0])) {
    // l'arc ;
    const arc = arcs[i];
    // introuvable : on passe.
    if (!arc) continue;
    // Polyligne en cours, commencée au premier point de l'arc.
    let current: Point[] = [arc[0]];
    // Pour chaque point suivant :
    for (let k = 1; k < arc.length; k++) {
      // si le segment qui y mène longe un bord de la carte,
      if (isMapEdge(arc[k - 1], arc[k])) {
        // la polyligne en cours est gardée si elle a au moins deux points,
        if (current.length > 1) out.push(current);
        // et une nouvelle commence à ce point ;
        current = [arc[k]];
      // sinon le point s'ajoute à la polyligne en cours.
      } else current.push(arc[k]);
    // Fin de la boucle des points.
    }
    // Garde la dernière polyligne si elle a au moins deux points.
    if (current.length > 1) out.push(current);
  // Fin de la boucle des arcs.
  }
  // Renvoie les littoraux.
  return out;
// Fin de coastlines.
}
 
/* -------------------------------------------------------------------------------------------------
 * Service
 * ----------------------------------------------------------------------------------------------- */
 
// Fonction round : arrondit à 3 décimales (environ 100 m).
const round = (v: number) => Math.round(v * 1000) / 1000;
 
/** Polyligne → liste plate arrondie, sans les points répétés que l'arrondi peut créer. */
// Fonction flatten : transforme une polyligne en liste plate de nombres.
function flatten(line: Point[]): number[] {
  // Liste produite.
  const out: number[] = [];
  // Pour chaque point :
  for (const [lon, lat] of line) {
    // longitude et latitude arrondies ;
    const x = round(lon), y = round(lat);
    // point identique au précédent après arrondi : on le saute ;
    if (out.length && out[out.length - 2] === x && out[out.length - 1] === y) continue;
    // sinon on ajoute ses deux nombres.
    out.push(x, y);
  // Fin de la boucle.
  }
  // Renvoie la liste.
  return out;
// Fin de flatten.
}
 
/**
 * Frontières des pays (Natural Earth, via world-atlas en TopoJSON). La topologie vient de WorldAtlasService ;
 * les frontières sont décodées une fois au premier appel puis gardées en mémoire ; en cas d'échec, l'appel
 * suivant réessaie.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des frontières.
export class BordersService {
  // Résultat gardé en mémoire : une promesse, ou null tant que rien n'a été demandé.
  private cache: Promise<BordersDto> | null = null;
 
  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // le service World Atlas.
    private readonly atlas: WorldAtlasService,
  // Corps du constructeur vide.
  ) {}
 
  // Méthode get : renvoie les frontières.
  get(): Promise<BordersDto> {
    // Si rien n'est en mémoire :
    if (!this.cache) {
      // lance le calcul et garde sa promesse ; s'il échoue,
      this.cache = this.load().catch((e) => {
        // on oublie la promesse, pour que l'appel suivant réessaie,
        this.cache = null;
        // et l'erreur est transmise à l'appelant.
        throw e;
      // Fin du traitement d'échec.
      });
    // Fin du cas.
    }
    // Renvoie la promesse (la même pour tous les appels simultanés).
    return this.cache;
  // Fin de get.
  }
 
  /** Milieux des pays ; un échec ici ne doit pas priver la carte de ses frontières. */
  // Méthode privée centers : le milieu de chaque pays.
  private centers(topo: Topology): BordersDto['countries'] {
    // Essaie
    try {
      // de les calculer à partir de la topologie et de ses arcs décodés ;
      return countryCenters(topo, decodeArcs(topo), 'countries');
    // en cas d'erreur,
    } catch {
      // une liste vide : la carte garde ses frontières, sans les noms de pays.
      return [];
    // Fin du cas.
    }
  // Fin de centers.
  }

  // Méthode privée load : fabrique la réponse.
  private async load(): Promise<BordersDto> {
    // Attend la topologie des pays auprès du service World Atlas.
    const topo = await this.atlas.countries();
 
    // Fonction keep : une polyligne utile a au moins deux points, soit quatre nombres.
    const keep = (l: number[]) => l.length >= 4;
    // Frontières : arcs partagés, aplatis, polylignes trop courtes retirées.
    const lines = sharedBorders(topo, 'countries').map(flatten).filter(keep);
    // Littoraux : même traitement.
    const coasts = coastlines(topo, 'countries').map(flatten).filter(keep);
    // Objet renvoyé :
    return {
      // nom du jeu de données ;
      source: this.config.borders.label,
      // mention à afficher ;
      attribution: 'Frontières : Natural Earth',
      // nombre de frontières ;
      count: lines.length,
      // les frontières ;
      lines,
      // les littoraux ;
      coastlines: coasts,
      // le milieu de chaque pays.
      countries: this.centers(topo),
    // Fin de l'objet.
    };
  // Fin de load.
  }
// Fin du service.
}