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
 * La table donne aussi les paliers de zoom (EARTH_TIERS), de la vue de l'espace jusqu'à la rue, choisis d'après la
 * distance affichée en km : pour chacun, la source prioritaire, le niveau de tuile le plus fin, le nombre maximal de
 * tuiles chargées (ordinateur et téléphone) et les détails affichés. `fieldOnly` : seules les tuiles du champ de la
 * caméra sont chargées (aucun préchargement prédictif hors champ), les autres sont déchargées.
 *
 * Elle décrit enfin la carte marine (`marine`, voir earth-seafloor.ts) : teinte NOAA (ETOPO 2022) vue de l'espace,
 * fondu vers GEBCO aux zooms moyens, GEBCO seule avec isobathes et relief ombré aux zooms forts. Les seuils sont la
 * colonne « marine » des paliers ; la durée du fondu est `marine.fadeMs`.
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
// Importe la carte marine de la couche unique et sa forme, depuis les fonds marins.
import { earthMarine, type EarthMarine } from './earth-seafloor';

/** Version de la table : elle change quand les règles changent (le navigateur la garde avec la description de la couche). */
// Déclare et exporte la version de la table : 3 (carte marine ajoutée ; 2 : paliers de zoom).
export const EARTH_PLAN_VERSION = 3;

/** En-tête de cache de la table : un jour, puis une semaine d'affichage immédiat avec vérification en arrière-plan. */
// Déclare et exporte l'en-tête de cache de la table.
export const EARTH_PLAN_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

/** Adresse de la table, donnée au navigateur dans la description de la couche unique. */
// Déclare et exporte l'adresse de la table.
export const EARTH_PLAN_PATH = '/api/v1/tiles/earth/plan';

/** Détails affichés à un palier : océans, côtes, routes, noms et carte marine. */
// Déclare et exporte la forme des détails d'un palier.
export interface EarthTierDetails {
  // oceans : « teinte » (couleur des profondeurs) ou « relief » (relief des fonds ombré).
  oceans: 'teinte' | 'relief';
  // coasts : littoraux tracés.
  coasts: boolean;
  // roads : rues et routes (calque OpenFreeMap) demandées.
  roads: boolean;
  // names : noms des villes et des pays.
  names: boolean;
  // marine : carte marine « noaa » (teinte vue de l'espace), « fondu » (NOAA vers GEBCO) ou « gebco » (GEBCO seule).
  marine: 'noaa' | 'fondu' | 'gebco';
// Fin de EarthTierDetails.
}

/** Un palier de zoom : de quelle distance à quelle distance, quelle source, quel niveau, combien de tuiles, quels détails. */
// Déclare et exporte la forme d'un palier.
export interface EarthTier {
  // id : l'identifiant du palier.
  id: string;
  // label : son nom affiché.
  label: string;
  // maxKm : distance affichée (altitude au-dessus du sol, km) jusqu'à laquelle il s'applique ; null pour le dernier.
  maxKm: number | null;
  // source : la source prioritaire à cette distance.
  source: string;
  // maxZoom : le niveau de tuile le plus fin chargé (résolution des tuiles).
  maxZoom: number;
  // maxTiles : le nombre maximal de tuiles chargées en même temps, sur ordinateur et sur téléphone.
  maxTiles: { desktop: number; phone: number };
  // details : les détails affichés.
  details: EarthTierDetails;
// Fin de EarthTier.
}

/**
 * Paliers de zoom, du plus proche au plus lointain. Les distances sont celles des niveaux d'échelle affichés (Rue,
 * Quartier, Ville, Région, Pays, Continent, Planète). Le niveau le plus fin de chaque palier est celui qu'il faut au
 * centre de l'écran à sa distance la plus courte, plus un niveau de marge pour les vues de biais. Sur téléphone, environ
 * trois quarts des tuiles d'un ordinateur : même détail au centre de l'écran, les bords prennent un niveau moins fin.
 */
// Déclare et exporte les paliers (début de la liste).
export const EARTH_TIERS: EarthTier[] = [
  // Rue : jusqu'à 0,4 km ; orthophotos nationales jusqu'au niveau 19 ; tout le détail.
  { id: 'rue', label: 'Rue', maxKm: 0.4, source: 'orthophotos nationales', maxZoom: 19, maxTiles: { desktop: 280, phone: 210 }, details: { oceans: 'relief', coasts: true, roads: true, names: true, marine: 'gebco' } },
  // Quartier : jusqu'à 3 km ; niveau 19.
  { id: 'quartier', label: 'Quartier', maxKm: 3, source: 'orthophotos nationales', maxZoom: 19, maxTiles: { desktop: 280, phone: 210 }, details: { oceans: 'relief', coasts: true, roads: true, names: true, marine: 'gebco' } },
  // Ville : jusqu'à 40 km ; niveau 17.
  { id: 'ville', label: 'Ville', maxKm: 40, source: 'orthophotos nationales', maxZoom: 17, maxTiles: { desktop: 280, phone: 210 }, details: { oceans: 'relief', coasts: true, roads: true, names: true, marine: 'gebco' } },
  // Région : jusqu'à 400 km ; niveau 14 ; orthophotos nationales vues de loin, sinon Sentinel-2.
  { id: 'region', label: 'Région', maxKm: 400, source: 'orthophotos nationales (vue de loin), sinon Sentinel-2', maxZoom: 14, maxTiles: { desktop: 260, phone: 200 }, details: { oceans: 'relief', coasts: true, roads: true, names: true, marine: 'fondu' } },
  // Pays : jusqu'à 2 500 km ; niveau 10 ; Sentinel-2.
  { id: 'pays', label: 'Pays', maxKm: 2500, source: 'Sentinel-2', maxZoom: 10, maxTiles: { desktop: 220, phone: 170 }, details: { oceans: 'teinte', coasts: true, roads: false, names: true, marine: 'fondu' } },
  // Continent : jusqu'à 9 000 km ; niveau 8 ; Sentinel-2.
  { id: 'continent', label: 'Continent', maxKm: 9000, source: 'Sentinel-2', maxZoom: 8, maxTiles: { desktop: 180, phone: 140 }, details: { oceans: 'teinte', coasts: true, roads: false, names: true, marine: 'noaa' } },
  // Planète : jusqu'à 120 000 km ; niveau 6 ; NASA GIBS et Sentinel-2.
  { id: 'planete', label: 'Planète', maxKm: 120_000, source: 'NASA GIBS, Sentinel-2', maxZoom: 6, maxTiles: { desktop: 120, phone: 100 }, details: { oceans: 'teinte', coasts: false, roads: false, names: false, marine: 'noaa' } },
  // Espace : au-delà ; la mosaïque instantanée seule (niveaux 0 à 3).
  { id: 'espace', label: 'Espace', maxKm: null, source: 'mosaïque instantanée', maxZoom: 3, maxTiles: { desktop: 85, phone: 85 }, details: { oceans: 'teinte', coasts: false, roads: false, names: false, marine: 'noaa' } },
// Fin des paliers.
];

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
  // tiers : les paliers de zoom, du plus proche au plus lointain.
  tiers: EarthTier[];
  // fieldOnly : seules les tuiles du champ de la caméra sont chargées ; les autres sont déchargées.
  fieldOnly: boolean;
  // marine : la carte marine (NOAA, GEBCO, isobathes, durée du fondu), ou null si les fonds marins sont coupés.
  marine: EarthMarine | null;
// Fin de EarthPlan.
}

/**
 * Table de priorité des sources actives. `EARTH_DIRECT=0` retire tous les modèles d'adresse (tout passe par le relais),
 * `EARTH_COLOR_MATCH=0` coupe l'accord des couleurs, `EARTH_SEAFLOOR=0` la carte marine.
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
    // les paliers de zoom, et le chargement limité au champ de la caméra ;
    tiers: EARTH_TIERS, fieldOnly: true,
    // la carte marine (null si EARTH_SEAFLOOR est coupé) ;
    marine: earthMarine(env),
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
