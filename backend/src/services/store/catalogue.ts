/**
 * Catalogue des exports payants et droits portés par le jeton JWT.
 *
 * Ce qui est vendu, c'est la **récupération** des données : le modèle 3D complet d'un astre, ses tuiles
 * assemblées en une seule image, et l'API de calcul d'orbite. La consultation du site reste libre : les routes
 * que le navigateur utilise pour afficher la carte ne sont pas touchées.
 *
 * Un achat donne un jeton JWT dont le champ `scope` liste les droits accordés. Le jeton est la preuve d'achat :
 * il est signé par le serveur, lisible par son porteur, et vaut un an.
 *
 * Tout est pur et testable : ni Stripe, ni base de données ici.
 */
import { PLANETS, SUN } from '../data/bodies.data';

/** Astres vendus à l'unité : les planètes du catalogue, la Lune, et le Soleil. */
export const BODY_IDS = [...PLANETS.map((p) => p.name), 'Lune', SUN.name] as const;

/**
 * Astres dont un fond de carte existe réellement et peut donc être assemblé : ceux que le site tuile.
 * Les autres se vendent sans fond de carte — leur modèle 3D est un sphéroïde aux dimensions réelles, sans
 * texture. La liste est celle des astres tuilés du moteur (moteur/engine/tiledBodies côté site) ; l'autorité
 * reste le service des tuiles, interrogé par `/export/bodies`, qui dit pour chaque astre s'il a une couche.
 */
export const TILED_BODY_KEYS: readonly string[] = ['terre', 'lune', 'mars', 'mercure', 'venus'];

/** Le Soleil, qui n'a ni fond de carte ni orbite : on vend son modèle et sa position apparente. */
export const SUN_KEY = 'soleil';

/** Identifiant d'un astre dans les droits : son nom en minuscules sans accent. */
export const bodyKey = (nom: string): string => nom.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();

/** Cet astre a-t-il un fond de carte à assembler ? */
export const hasTiles = (nom: string): boolean => TILED_BODY_KEYS.includes(bodyKey(nom));

/** Droits connus : un astre, toutes les tuiles, le calcul d'orbite, ou tout. */
export type Scope = string;

/** Droit qui donne accès à tout le reste. */
export const SCOPE_ALL = 'all';
/** Droit sur l'assemblage des tuiles de n'importe quel astre. */
export const SCOPE_TILES = 'tiles';
/** Droit sur l'API de calcul d'orbite, tous astres confondus (plus vendu : l'orbite se loue à l'heure). */
export const SCOPE_ORBITS = 'orbits';
/** Droit sur le calcul de l'orbite d'un astre précis, loué à l'heure. */
export const scopeOfOrbit = (nom: string): Scope => `orbit:${bodyKey(nom)}`;
/** Droit sur un astre : son modèle 3D et ses tuiles. */
export const scopeOfBody = (nom: string): Scope => `body:${bodyKey(nom)}`;

/** Un article du catalogue. */
export interface Product {
  /** Identifiant stable, employé par la page de paiement. */
  id: string;
  /** Intitulé montré à l'acheteur et inscrit sur le reçu Stripe. */
  label: string;
  /** Ce que l'article donne. */
  description: string;
  /** Prix en centimes, dans la devise du catalogue. */
  cents: number;
  /** Droits accordés par l'achat. */
  scopes: Scope[];
  /** Vrai quand le prix est horaire : le montant payé et la durée du jeton suivent le nombre d'heures achetées. */
  hourly?: boolean;
  /** Vrai quand l'article comprend un fond de carte assemblé ; faux pour un astre sans tuiles. */
  tiled?: boolean;
}

/** Devise du catalogue. */
export const CURRENCY = 'eur';

/** Durée de validité d'un jeton d'accès acheté : un an. */
export const LICENCE_SECONDS = 365 * 24 * 3600;

/**
 * Prix par défaut, en centimes. Chacun se change par une variable d'environnement, sans toucher au code.
 * `orbitHour` : le calcul d'orbite d'un astre se loue à l'heure, 1 000 € l'heure.
 */
const DEFAULT_PRICES = { body: 150_000, earth: 10_000_000, tiles: 199_900, all: 499_900, orbitHour: 100_000 };

/** Nombre d'heures maximal qu'une location d'orbite peut couvrir d'un coup : un mois. */
export const MAX_ORBIT_HOURS = 744;

/** Lit un prix dans l'environnement : un entier de centimes strictement positif, sinon la valeur par défaut. */
export function priceFrom(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  // Valeur brute.
  const raw = env[key]?.trim();
  // Absente : le prix par défaut.
  if (!raw) return fallback;
  // Nombre entier de centimes.
  const cents = Number(raw);
  // Valeur inutilisable : le prix par défaut, plutôt qu'un article à zéro euro.
  return Number.isInteger(cents) && cents > 0 ? cents : fallback;
// Fin de priceFrom.
}

/**
 * Le catalogue complet, construit à partir de l'environnement.
 *  - un article par astre (modèle 3D et tuiles de cet astre) ;
 *  - un article pour les tuiles de tous les astres ;
 *  - un article par astre pour le calcul de son orbite, loué à l'heure ;
 *  - un article qui réunit le tout.
 */
/** Ce que l'article d'un astre contient : le Soleil n'a pas de fond de carte, les astres non tuilés non plus. */
function bodyDescription(nom: string): string {
  // Le Soleil : un sphéroïde aux dimensions réelles, et sa position apparente en prime.
  if (bodyKey(nom) === SUN_KEY) {
    // Sa description.
    return 'Modèle 3D du Soleil au rayon réel (695 713 km), au format GLB. Le Soleil n’a pas de fond de carte : '
      + 'le modèle est livré sans texture, à habiller avec vos propres images.';
  // Fin du cas du Soleil.
  }
  // Un astre tuilé : le modèle et son fond de carte.
  if (hasTiles(nom)) return `Modèle 3D complet de ${nom} au rayon réel, texturé par son fond de carte, et ce fond de carte assemblé en une seule image.`;
  // Un astre sans tuiles : le modèle seul, dit clairement.
  return `Modèle 3D de ${nom} au rayon réel, au format GLB. Cet astre n’a pas encore de fond de carte : le modèle est livré sans texture.`;
// Fin de bodyDescription.
}

export function buildCatalogue(env: NodeJS.ProcessEnv = process.env): Product[] {
  // Les trois prix.
  const body = priceFrom(env, 'PRICE_BODY_CENTS', DEFAULT_PRICES.body);
  const earth = priceFrom(env, 'PRICE_EARTH_CENTS', DEFAULT_PRICES.earth);
  const tiles = priceFrom(env, 'PRICE_TILES_CENTS', DEFAULT_PRICES.tiles);
  const all = priceFrom(env, 'PRICE_ALL_CENTS', DEFAULT_PRICES.all);
  const orbitHour = priceFrom(env, 'PRICE_ORBIT_HOUR_CENTS', DEFAULT_PRICES.orbitHour);
  // Un article par astre, puis les trois articles groupés.
  return [
    ...BODY_IDS.map((nom) => ({
      id: `body-${bodyKey(nom)}`,
      label: `Export de ${nom}`,
      description: bodyDescription(nom),
      cents: bodyKey(nom) === 'terre' ? earth : body,
      scopes: [scopeOfBody(nom)],
      tiled: hasTiles(nom),
    })),
    {
      id: 'tiles',
      label: 'Fonds de carte de tous les astres',
      description: `Fond de carte assemblé de chaque astre tuilé — ${TILED_BODY_KEYS.join(', ')} — en une seule `
        + 'image par astre, à la résolution disponible.',
      cents: tiles,
      scopes: [SCOPE_TILES],
      tiled: true,
    },
    ...BODY_IDS.map((nom) => ({
      id: `orbit-${bodyKey(nom)}`,
      label: bodyKey(nom) === SUN_KEY ? 'Position apparente du Soleil' : `Calcul d’orbite de ${nom}`,
      description: bodyKey(nom) === SUN_KEY
        // Le Soleil est au centre du repère : ce qui se calcule, c'est sa position vue de la Terre.
        ? 'Position du Soleil vue de la Terre sur la période demandée : coordonnées écliptiques et équatoriales, '
          + 'distance, et point de la Terre où il est au zénith. Loué à l’heure : le jeton expire au bout des '
          + 'heures achetées.'
        // Les autres astres ont une orbite héliocentrique.
        : `Positions, vitesses et éléments orbitaux de ${nom}, sur la période demandée. Loué à l’heure : `
          + 'le jeton expire au bout des heures achetées.',
      cents: orbitHour,
      scopes: [scopeOfOrbit(nom)],
      hourly: true,
    })),
    {
      id: 'all',
      label: 'Tout le catalogue',
      description: 'Modèles 3D et fonds de carte de tous les astres, Soleil compris. Le calcul d’orbite et la '
        + 'position du Soleil se louent à part, à l’heure.',
      cents: all,
      scopes: [SCOPE_ALL],
      tiled: true,
    },
  ];
// Fin de buildCatalogue.
}

/** Un article par son identifiant, ou null. */
export const productById = (id: string, catalogue: readonly Product[]): Product | null => catalogue.find((p) => p.id === id) ?? null;

/**
 * Les droits accordés suffisent-ils pour le droit demandé ?
 * `all` ouvre tout ; `tiles` ouvre l'assemblage de n'importe quel astre ; sinon l'accord doit être exact.
 */
export function scopeAllows(granted: readonly unknown[] | undefined, needed: Scope): boolean {
  // Aucun droit accordé.
  if (!Array.isArray(granted)) return false;
  // Les droits lisibles seulement.
  const have = granted.filter((s): s is string => typeof s === 'string');
  // Le droit universel ouvre tout, sauf le calcul d'orbite : celui-ci se loue à l'heure, pour chaque astre.
  if (have.includes(SCOPE_ALL) && !needed.startsWith('orbit:')) return true;
  // Le droit exact.
  if (have.includes(needed)) return true;
  // L'assemblage des tuiles d'un astre s'ouvre de deux façons : le droit sur toutes les tuiles, ou le droit
  // sur cet astre — l'article d'un astre comprend son modèle 3D et ses tuiles.
  if (needed.startsWith('tiles:')) {
    // Le droit sur toutes les tuiles.
    if (have.includes(SCOPE_TILES)) return true;
    // Ou le droit sur cet astre précis.
    if (have.includes(`body:${needed.slice('tiles:'.length)}`)) return true;
  // Fin du cas des tuiles.
  }
  // Sinon : refus.
  return false;
// Fin de scopeAllows.
}

/** Prix d'un article pour un nombre d'heures : horaire, le montant suit les heures ; sinon, le prix fixe. */
export function priceFor(product: Product, hours = 1): number {
  // Article à prix fixe : les heures ne comptent pas.
  if (!product.hourly) return product.cents;
  // Nombre d'heures entier, d'au moins une heure et d'au plus un mois.
  const n = Math.max(1, Math.min(MAX_ORBIT_HOURS, Math.floor(hours)));
  // Le montant.
  return product.cents * n;
// Fin de priceFor.
}

/** Prix total, en centimes, d'une liste d'articles. */
export const totalCents = (products: readonly Product[]): number => products.reduce((n, p) => n + p.cents, 0);

/** Montant en centimes, mis en forme pour l'affichage (« 499,00 € »). */
export const formatPrice = (cents: number, currency: string = CURRENCY): string =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 });
