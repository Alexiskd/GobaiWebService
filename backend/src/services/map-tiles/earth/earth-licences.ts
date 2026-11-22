/**
 * Licences des sources d'images de la Terre, et garde-fou des exports payants.
 *
 * Afficher une image sur le site gratuit et la **revendre** dans un export payant sont deux usages différents.
 * Seules les sources dont la licence autorise une réutilisation commerciale (avec attribution) peuvent entrer
 * dans un export vendu. Une source dont la licence n'a pas été vérifiée est traitée comme non commerciale.
 *
 * Le moteur de la couche unique n'emploie une source qu'à partir de son niveau `lowZoom` (ou `minZoom`). Les
 * exports de la Terre sont donc plafonnés sous le premier niveau de toute source non commerciale : aucune de
 * leurs images ne peut s'y retrouver.
 */
import { EARTH_SOURCES, type EarthSource, type EarthSourceId } from './earth-sources';

/** Licence d'une source, et autorisation de revente dans un export payant. */
export interface EarthLicence {
  /** Licence telle qu'elle est publiée par le fournisseur. */
  licence: string;
  /** Vrai seulement quand la licence autorise la réutilisation commerciale et qu'elle a été vérifiée. */
  commercial: boolean;
}

/**
 * Table des licences, une ligne par source d'images de la Terre.
 * `commercial: false` = non vérifié ou non commercial : la source reste affichée sur le site, jamais vendue.
 */
export const EARTH_LICENCES: Record<Exclude<EarthSourceId, 'gebco' | 'gebco-flat' | 'ncei'>, EarthLicence> = {
  lu: { licence: 'CC0 1.0', commercial: true },
  ch: { licence: 'Conditions swisstopo (OGD) — à vérifier', commercial: false },
  be: { licence: 'IGN/NGI — à vérifier', commercial: false },
  nl: { licence: 'CC BY 4.0', commercial: true },
  at: { licence: 'CC BY 4.0', commercial: true },
  cz: { licence: 'CC BY 4.0', commercial: true },
  'de-sn': { licence: 'dl-de/by-2-0', commercial: true },
  'de-he': { licence: 'dl-de/zero-2-0', commercial: true },
  'de-nw': { licence: 'dl-de/zero-2-0', commercial: true },
  'de-by': { licence: 'CC BY 4.0', commercial: true },
  ign: { licence: 'Licence Ouverte 2.0 (Etalab)', commercial: true },
  es: { licence: 'CC BY 4.0', commercial: true },
  it: { licence: 'Geoportale Nazionale — à vérifier', commercial: false },
  pl: { licence: 'GUGiK — à vérifier', commercial: false },
  jp: { licence: 'Conditions d’utilisation du GSI — à vérifier', commercial: false },
  'au-nsw': { licence: 'CC BY 4.0', commercial: true },
  usgs: { licence: 'Domaine public (USGS)', commercial: true },
  // Mosaïque 2016 uniquement : les millésimes suivants d'EOX sont en CC BY-NC-SA (non commercial).
  sentinel2: { licence: 'CC BY 4.0 (millésime 2016)', commercial: true },
  gibs: { licence: 'Domaine public (NASA)', commercial: true },
};

/** La source peut-elle entrer dans un export vendu ? Inconnue = non. */
export const isCommercialSource = (id: EarthSourceId): boolean =>
  (EARTH_LICENCES as Record<string, EarthLicence | undefined>)[id]?.commercial === true;

/** Premier niveau de zoom auquel le moteur emploie une source. */
const firstZoom = (s: EarthSource): number => s.lowZoom ?? s.minZoom;

/**
 * Niveau de zoom le plus fin qu'un export de la Terre peut atteindre sans contenir d'image non commerciale :
 * juste sous le premier niveau de la source non commerciale la plus précoce. Infini s'il n'y en a aucune.
 */
export function maxCommercialEarthZoom(sources: EarthSource[] = EARTH_SOURCES): number {
  const blocked = sources.filter((s) => !isCommercialSource(s.id)).map(firstZoom);
  return blocked.length ? Math.min(...blocked) - 1 : Number.POSITIVE_INFINITY;
}
