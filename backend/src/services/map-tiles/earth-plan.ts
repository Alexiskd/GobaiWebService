/**
 * Table de priorité des sources de la couche unique de la Terre (« earth-hd »), servie au navigateur par
 * GET /api/v1/tiles/earth/plan. C'est la seule description des règles de choix : le navigateur ne garde aucune règle en
 * dur, il lit cette table et choisit, pour chaque cellule hexagonale, la première source de la table qui la couvre.
 *
 * Ordre de priorité (rang 1 = la plus prioritaire), celui de la liste des sources (earth-sources.ts) :
 *  1. les orthophotos officielles et gratuites de chaque pays ou région, de la plus petite emprise à la plus grande :
 *     l'IGN sur la France, swisstopo sur la Suisse, etc. ;
 *  2. Sentinel-2 cloudless (EOX) partout ailleurs ;
 *  3. NASA GIBS Blue Marble pour les plus petits niveaux.
 * La mosaïque instantanée (niveaux 0 à 3 de la couche, gardés en mémoire par le navigateur) sert de fond immédiat
 * pendant le chargement.
 *
 * Fonctions pures, testées dans earth-plan.spec.ts : ni NestJS ni réseau.
 */

// Ouvre l'import du module des sources de la Terre :
import {
  // le plan de chargement direct, les sources actives et le test d'un interrupteur coupé ;
  directPlan, enabledSources, isOff,
  // et trois types : une source, une emprise et l'identifiant d'une source.
  type Bbox, type EarthSource, type EarthSourceId,
// Fin de l'import.
} from './earth-sources';

/** Version de la table : elle change quand les règles changent (le navigateur la garde avec la description de la couche). */
// Déclare et exporte la version de la table : 1.
export const EARTH_PLAN_VERSION = 1;

/** En-tête de cache de la table : un jour, puis une semaine d'affichage immédiat avec vérification en arrière-plan. */
// Déclare et exporte l'en-tête de cache de la table.
export const EARTH_PLAN_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

/** Adresse de la table, donnée au navigateur dans la description de la couche unique. */
// Déclare et exporte l'adresse de la table.
export const EARTH_PLAN_PATH = '/api/v1/tiles/earth/plan';

/** Une ligne de la table : une source, son rang, son emprise, ses niveaux et sa façon d'être chargée. */
// Déclare et exporte la forme d'une ligne de la table.
export interface EarthPlanSource {
  // id : l'identifiant de la source.
  id: EarthSourceId;
  // label : son nom affiché.
  label: string;
  // attribution : sa mention.
  attribution: string;
  // priority : son rang, 1 pour la plus prioritaire.
  priority: number;
  // minZoom et maxZoom : ses niveaux natifs.
  minZoom: number;
  // Niveau le plus fin.
  maxZoom: number;
  // bboxes : ses emprises [ouest, sud, est, nord] ; absentes pour une source mondiale.
  bboxes?: Bbox[];
  // templates : ses modèles d'adresse chargeables par le navigateur ; absents, la tuile passe par le relais.
  templates?: string[];
  // lowZoom : niveau à partir duquel la source sert sa mosaïque réduite, vue de loin (sources nationales).
  lowZoom?: number;
// Fin de EarthPlanSource.
}

/** La table complète. */
// Déclare et exporte la forme de la table.
export interface EarthPlan {
  // version : la version de la table.
  version: number;
  // layerId : la couche décrite, toujours « earth-hd ».
  layerId: 'earth-hd';
  // relay : le modèle d'adresse du relais du serveur, pour les sources que le navigateur ne peut pas charger lui-même.
  relay: string;
  // colorMatch : l'accord des couleurs des sources sur la mosaïque mondiale est-il actif ?
  colorMatch: boolean;
  // sources : les lignes, dans l'ordre de priorité.
  sources: EarthPlanSource[];
// Fin de EarthPlan.
}

/**
 * Table de priorité des sources actives. `EARTH_DIRECT=0` retire tous les modèles d'adresse (tout passe par le relais),
 * `EARTH_COLOR_MATCH=0` coupe l'accord des couleurs.
 */
// Déclare et exporte earthPlan : les sources (les actives par défaut) et l'environnement.
export function earthPlan(sources: EarthSource[] = enabledSources(), env: Record<string, string | undefined> = process.env): EarthPlan {
  // Plan de chargement direct (modèles d'adresse et niveaux bas), par identifiant de source ; vide s'il est coupé.
  const direct = new Map((directPlan(sources, env) ?? []).map((d) => [d.id, d]));
  // Renvoie la table :
  return {
    // sa version, la couche décrite et le relais ;
    version: EARTH_PLAN_VERSION, layerId: 'earth-hd', relay: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}',
    // l'accord des couleurs ;
    colorMatch: !isOff(env.EARTH_COLOR_MATCH),
    // une ligne par source, dans l'ordre de la liste (début) :
    sources: sources.map((s, i): EarthPlanSource => {
      // ce que le plan direct dit de cette source ;
      const d = direct.get(s.id);
      // la ligne :
      return {
        // identifiant, nom, mention et rang ;
        id: s.id, label: s.label, attribution: s.attribution, priority: i + 1,
        // niveaux natifs ;
        minZoom: s.minZoom, maxZoom: s.maxZoom,
        // emprises, s'il y en a ;
        ...(s.bboxes ? { bboxes: s.bboxes } : {}),
        // modèles d'adresse pour le navigateur, s'il peut la charger lui-même ;
        ...(d?.templates ? { templates: d.templates } : {}),
        // niveau bas de la vue de loin, s'il y en a un.
        ...(d?.lowZoom !== undefined ? { lowZoom: d.lowZoom } : {}),
      // Fin de la ligne.
      };
    // Fin des lignes.
    }),
  // Fin de la table.
  };
// Fin de earthPlan.
}
