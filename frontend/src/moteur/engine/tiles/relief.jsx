// Relief générique des astres tuilés : un seul module pour tous, chacun avec les données qu'il a.
//
//  - « terrarium » : vraies altitudes en tuiles (Terre : AWS Terrain Tiles, libres et sans clé). Le maillage de chaque
//    tuile est soulevé à la bonne hauteur et les pentes sont ombrées. Altitude en mètres codée dans la couleur :
//    rouge × 256 + vert + bleu / 256 − 32768.
//  - « image » : pas de données d'altitude. Le relief est estimé à partir de l'image elle-même (les variations de
//    luminosité sont lues comme des pentes) : un ombrage seulement, sans volume. C'est une estimation, pas une mesure.
//
// Fond des océans (« ocean » d'un relief terrarium) : les tuiles d'altitude de la Terre les plus fines ne décrivent que
// les terres (la mer y vaut 0). Une seconde source, plus grossière, donne la profondeur des fonds marins (AWS Terrain
// Tiles : GEBCO et ETOPO1 sous la mer). Là où la première dit « mer », le maillage est creusé à la profondeur de la
// seconde et ses pentes sont ombrées. La caméra, elle, reste au-dessus du niveau de la mer.
//
// Les fonctions de calcul sont pures (testées dans relief.test.jsx) ; `ReliefSource` charge les tuiles d'altitude.

// Importe fillTemplate, qui remplit l'adresse d'une tuile, depuis mercator.
import { fillTemplate } from './mercator';

// Déclare et exporte les deux types de relief.
export const RELIEF_KINDS = ['terrarium', 'image'];
/** Segments par côté d'une tuile soulevée : assez de sommets pour dessiner une vallée (17 × 17 sommets). */
// Déclare et exporte le nombre de segments par côté d'une tuile soulevée : 16.
export const RELIEF_SEGMENTS = 16;
/** Jupe des tuiles soulevées : plus profonde, les bords de deux tuiles voisines ne tombent pas à la même hauteur. */
// Déclare et exporte la profondeur de la jupe des tuiles soulevées : 0,04.
export const RELIEF_SKIRT = 0.04;
/** Plus haut sommet possible (m) : marge des volumes englobants. */
// Déclare et exporte la plus grande altitude possible : 9000 m.
export const MAX_HEIGHT_M = 9000;

/** Altitude (m) d'un pixel Terrarium (composantes 0 … 255). Le fond des mers est ramené à 0 : la mer reste plate. */
// Déclare et exporte terrariumMeters : les trois composantes du pixel.
export function terrariumMeters(r, g, b) {
  // Renvoie l'altitude décodée, jamais négative.
  return Math.max(0, r * 256 + g + b / 256 - 32768);
// Fin de terrariumMeters.
}

/** Plus grande profondeur possible (m) : fosse des Mariannes, avec une marge. En dessous, le pixel est sans donnée. */
// Déclare et exporte la plus grande profondeur possible : 11 500 m.
export const MAX_DEPTH_M = 11500;
/** Altitude (m) jusqu'à laquelle un pixel de la première source est tenu pour de la mer (0, avec une marge d'arrondi). */
// Déclare et exporte l'altitude sous laquelle un pixel est tenu pour de la mer : 0,5 m.
export const SEA_LEVEL_M = 0.5;
/** Ombrage des fonds marins accentué : leurs pentes sont bien plus douces que celles des montagnes. */
// Déclare et exporte l'accentuation de l'ombrage des fonds marins : 4.
export const OCEAN_SHADE_BOOST = 4;

/** Altitude brute (m) d'un pixel Terrarium, profondeurs comprises ; un pixel sans donnée (noir) vaut 0. */
// Déclare et exporte terrariumRaw : les trois composantes du pixel.
export function terrariumRaw(r, g, b) {
  // Altitude décodée, profondeurs comprises.
  const h = r * 256 + g + b / 256 - 32768;
  // En dessous de la plus grande profondeur : 0 ; sinon l'altitude.
  return h < -MAX_DEPTH_M ? 0 : h;
// Fin de terrariumRaw.
}

/**
 * Hauteur (m) d'un point avec le fond des océans : l'altitude de la terre si elle est au-dessus de la mer, sinon la
 * profondeur donnée par la source des fonds marins (jamais positive : une côte mal alignée ne crée pas d'île).
 * Tant que la tuile des fonds n'est pas arrivée (`oceanM` null), on garde ce que dit la première source, mer plate
 * si elle ne décrit que les terres. Même calcul que le shader des tuiles (voir tileShaders.jsx, hMeters).
 */
// Déclare et exporte seaFloorMeters : l'altitude de la terre et la profondeur de la source des fonds.
export function seaFloorMeters(landM, oceanM) {
  // Au-dessus du niveau de la mer : l'altitude de la terre.
  if (landM > SEA_LEVEL_M) return landM;
  // Sans profondeur connue : l'altitude de la première source, jamais positive.
  if (oceanM === null || oceanM === undefined) return Math.min(0, landM);
  // Sinon : la profondeur, bornée entre la plus grande profondeur et 0.
  return Math.max(-MAX_DEPTH_M, Math.min(0, oceanM));
// Fin de seaFloorMeters.
}

/** Choix « fond des océans » gardé dans le navigateur (« gobai:relief-ocean ») : « 0 » le coupe, sinon il est actif. */
// Déclare et exporte oceanChoice : vrai, sauf pour la valeur « 0 ».
export const oceanChoice = (raw) => raw !== '0';

/** Composantes Terrarium (0 … 255) d'une altitude en mètres : l'inverse, pour les tests et les données de synthèse. */
// Déclare et exporte terrariumPixel : une altitude en mètres.
export function terrariumPixel(meters) {
  // Valeur décalée de 32 768.
  const v = meters + 32768;
  // Composantes rouge (les multiples de 256) et verte (le reste entier).
  const r = Math.floor(v / 256), g = Math.floor(v) % 256;
  // Renvoie les trois composantes, la bleue portant la partie décimale.
  return [r, g, Math.floor((v - Math.floor(v)) * 256)];
// Fin de terrariumPixel.
}

/** Taille au sol (m) d'un pixel d'une tuile Mercator de `size` px de côté au niveau `z`, à la latitude `latDeg`. */
// Déclare et exporte metersPerTexel : le niveau, la latitude, le rayon en mètres et la taille de la tuile (256 par défaut).
export function metersPerTexel(z, latDeg, radiusM, size = 256) {
  // Renvoie le tour de l'astre divisé par le nombre de pixels du niveau, multiplié par le cosinus de la latitude (au moins 0,05).
  return ((2 * Math.PI * radiusM) / 2 ** z / size) * Math.max(Math.cos((latDeg * Math.PI) / 180), 0.05);
// Fin de metersPerTexel.
}

/**
 * Réglage du relief d'un astre, complété et borné, ou null s'il n'en a pas.
 * @param cfg { kind, template?, minZoom?, maxZoom?, exaggeration?, shade?, strength? }
 */
// Déclare et exporte normalizeRelief : le réglage de l'astre et son rayon en kilomètres.
export function normalizeRelief(cfg, radiusKm) {
  // Réglage absent ou type inconnu : null.
  if (!cfg || !RELIEF_KINDS.includes(cfg.kind)) return null;
  // Pour le type Terrarium (début).
  if (cfg.kind === 'terrarium') {
    // Sources d'altitude, dans l'ordre d'essai : { tilejson } (adresse lue dans la fiche du fournisseur) ou { template }.
    // Sources : la liste donnée, ou l'adresse unique, sans les entrées vides.
    const sources = (cfg.sources ?? (cfg.template ? [{ template: cfg.template }] : [])).filter((s) => s && (s.template || s.tilejson));
    // Aucune source ou rayon invalide : null.
    if (!sources.length || !(radiusKm > 0)) return null;
    // Fond des océans : une source de profondeurs (voir l'en-tête), prise à un niveau grossier — la bathymétrie
    // mondiale n'a guère plus de 450 m de finesse, et une tuile grossière sert toutes les tuiles affichées qu'elle couvre.
    // Fond des océans, s'il a une adresse :
    const ocean = cfg.ocean?.template
      // sa source, des niveaux de 0 au maximum donné (8 par défaut, 12 au plus) et la taille de ses tuiles ;
      ? { sources: [{ template: cfg.ocean.template }], minZoom: 0, maxZoom: clamp(Math.round(cfg.ocean.maxZoom ?? 8), 0, 12), tileSize: cfg.ocean.tileSize ?? 256 }
      // sinon aucun.
      : null;
    // Renvoie le réglage complété (début).
    return {
      // Le type, les sources et le rayon en mètres.
      kind: 'terrarium', sources, radiusM: radiusKm * 1000,
      // Le niveau minimal (5 par défaut) et le niveau maximal (12 par défaut, 15 au plus).
      minZoom: Math.max(0, cfg.minZoom ?? 5), maxZoom: Math.min(15, cfg.maxZoom ?? 12),
      // Le nombre de segments, entre 2 et 32.
      segments: clamp(Math.round(cfg.segments ?? RELIEF_SEGMENTS), 2, 32),
      // L'exagération, entre 0 et 10, et l'ombrage, entre 0 et 1.
      exaggeration: clamp(cfg.exaggeration ?? 1, 0, 10), shade: clamp(cfg.shade ?? 0.8, 0, 1),
      // Le fond des océans, s'il existe.
      ...(ocean ? { ocean } : {}),
    // Fin du réglage.
    };
  // Fin du cas Terrarium.
  }
  // Type « image » : la force, entre 0 et 1, 0,5 par défaut.
  return { kind: 'image', strength: clamp(cfg.strength ?? 0.5, 0, 1) };
// Fin de normalizeRelief.
}

/**
 * Réglage du relief selon l'appareil.
 *
 * Sur tous les appareils, altitude partagée (`coarse: 1`) : avec une source en tuiles de 512 px, la tuile d'altitude
 * est prise un niveau au-dessus de l'image. Une seule tuile d'altitude sert alors les quatre tuiles d'image qu'elle
 * couvre : quatre fois moins de téléchargements et de mémoire graphique, pour la finesse d'une tuile de 256 px (un
 * point d'altitude pour deux pixels d'écran au plus, interpolé par le shader). C'est le principe des serveurs de
 * globes (Google Earth Enterprise) : le relief est rangé à un niveau plus grossier que l'imagerie et partagé entre
 * les nœuds voisins. Au-delà du niveau le plus fin de la source, rien ne change.
 *
 * Sur téléphone, en plus : maillage deux fois moins fin (9 × 9 sommets par tuile), relief à partir d'un niveau plus
 * loin et un niveau moins détaillé.
 */
// Déclare et exporte tuneRelief : le réglage et le mode petit appareil.
export function tuneRelief(relief, small) {
  // Réglage absent : rendu tel quel.
  if (!relief) return relief;
  // Sur ordinateur : un réglage Terrarium reçoit coarse à 1 ; les autres sont inchangés.
  if (!small) return relief.kind === 'terrarium' ? { ...relief, coarse: 1 } : relief;
  // Sur petit appareil, type « image » : force réduite de 20 %.
  if (relief.kind !== 'terrarium') return { ...relief, strength: relief.strength * 0.8 };
  // coarse : avec une source en tuiles de 512 px, on prend la tuile d'altitude du niveau au-dessus (même finesse
  // qu'une tuile de 256 px, mais une seule image pour quatre tuiles affichées).
  // Fond des océans : un niveau moins fin lui aussi (quatre fois moins de tuiles de profondeur).
  // Fond des océans : un niveau maximal de moins.
  const ocean = relief.ocean ? { ocean: { ...relief.ocean, maxZoom: Math.max(0, relief.ocean.maxZoom - 1) } } : {};
  // Renvoie le réglage allégé : moitié moins de segments (4 au moins), un niveau maximal de moins, un niveau minimal de plus, et coarse à 1.
  return { ...relief, ...ocean, segments: Math.max(4, Math.round(relief.segments / 2)), maxZoom: Math.max(relief.minZoom + 1, relief.maxZoom - 1), minZoom: relief.minZoom + 1, coarse: 1 };
// Fin de tuneRelief.
}

/**
 * Réglage choisi par l'utilisateur, gardé dans le navigateur : « 0 » coupe le relief, un nombre fixe son exagération
 * (1 = hauteurs réelles). Renvoie { on, exaggeration } ; `fallback` : exagération par défaut de l'astre ;
 * `defaultOn` : état quand rien n'est gardé (le relief en volume de la Terre est coupé par défaut : carte à plat,
 * affichée plus vite).
 */
// Déclare et exporte reliefChoice : la valeur gardée, l'exagération par défaut et l'état par défaut.
export function reliefChoice(raw, fallback = 1, defaultOn = true) {
  // Réponse par défaut : actif avec l'exagération par défaut, ou coupé.
  const byDefault = defaultOn ? { on: true, exaggeration: fallback } : { on: false, exaggeration: 0 };
  // Rien de gardé : la réponse par défaut.
  if (raw === null || raw === undefined || raw === '') return byDefault;
  // Valeur convertie en nombre.
  const n = Number(raw);
  // Illisible : la réponse par défaut.
  if (!Number.isFinite(n)) return byDefault;
  // Zéro ou moins : coupé.
  if (n <= 0) return { on: false, exaggeration: 0 };
  // Sinon : actif, avec l'exagération bornée entre 0,1 et 10.
  return { on: true, exaggeration: clamp(n, 0.1, 10) };
// Fin de reliefChoice.
}

/**
 * Point (lon, lat) dans une tuile : fraction horizontale (0 à l'ouest) et verticale (0 au sud), ou null s'il est
 * hors de la tuile. La latitude est prise linéaire dans la tuile : suffisant à partir du niveau 5.
 */
// Déclare et exporte pointInTile : les limites de la tuile, la longitude et la latitude.
export function pointInTile(bounds, lon, lat) {
  // Les quatre limites.
  const { west, east, north, south } = bounds;
  // Hors de la tuile : null.
  if (!(lon >= west && lon < east && lat <= north && lat > south)) return null;
  // Renvoie les fractions horizontale et verticale.
  return { u: (lon - west) / (east - west), v: (lat - south) / (north - south) };
// Fin de pointInTile.
}

/** Pixel (colonne, ligne depuis le haut) d'une image d'altitude pour un point (u, v) d'une tuile qui en affiche `rect`. */
// Déclare et exporte texelAt : la portion affichée, le point et la taille de l'image.
export function texelAt(rect, u, v, width, height) {
  // Position du point dans l'image entière, entre 0 et 1.
  const tu = rect[0] + u * rect[2], tv = rect[1] + v * rect[3];
  // Renvoie le pixel (début).
  return {
    // Sa colonne, bornée à l'image.
    px: Math.min(width - 1, Math.max(0, Math.floor(tu * width))),
    // Sa ligne depuis le haut, bornée à l'image.
    py: Math.min(height - 1, Math.max(0, Math.floor((1 - tv) * height))),
  // Fin du pixel.
  };
// Fin de texelAt.
}

/** Plancher de la caméra (rayons) au-dessus d'un sol à `meters` d'altitude, pour une exagération donnée. */
// Déclare et exporte groundFloorRadii : l'altitude et l'exagération, jamais négatives, multipliées puis divisées par le rayon.
export const groundFloorRadii = (meters, exaggeration, radiusM) => (Math.max(0, meters) * Math.max(0, exaggeration)) / radiusM;

// clamp : borne une valeur entre un minimum et un maximum.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Adresse de tuiles lue dans une fiche TileJSON : { template, maxZoom }, ou null si elle n'en donne pas d'utilisable. */
// Déclare et exporte templateFromTileJson : la fiche TileJSON.
export function templateFromTileJson(json) {
  // Première adresse https de la fiche qui contient les trois jetons {z}, {x} et {y}.
  const template = Array.isArray(json?.tiles) ? json.tiles.find((t) => typeof t === 'string' && /^https:\/\//.test(t) && t.includes('{z}') && t.includes('{x}') && t.includes('{y}')) : null;
  // Aucune : null.
  if (!template) return null;
  // Renvoie l'adresse et le niveau maximal de la fiche, ou null s'il manque.
  return { template, maxZoom: Number.isFinite(json.maxzoom) ? json.maxzoom : null };
// Fin de templateFromTileJson.
}

// Nombre d'échecs avant de passer à la source suivante : 4.
const SWITCH_AFTER = 4; // échecs d'affilée, sans aucune réussite, avant de passer à la source suivante
// Nombre d'échecs sur la dernière source avant de renoncer : 8.
const BROKEN_AFTER = 8; // échecs d'affilée sur la dernière source avant de renoncer au relief

/**
 * Tuiles d'altitude d'un astre. Plusieurs sources possibles, dans l'ordre : la première qui répond est gardée ; si
 * elle ne répond pas (fiche introuvable, tuiles en échec dès le départ), on passe à la suivante. Un téléchargement par
 * adresse, partagé entre les tuiles d'image qui affichent des portions de la même tuile d'altitude.
 * `io` : { loadImage(url) → image décodée, fetchJson(url) → objet, warm?(url) → préchargement sur disque } fournis par l'appelant.
 */
// Déclare et exporte la classe ReliefSource (début).
export class ReliefSource {
  // Constructeur : les sources, les niveaux, le partage d'altitude et les accès (début).
  constructor({ sources, minZoom, maxZoom, coarse = 0 }, io) {
    // Garde le partage d'altitude.
    this.coarse = coarse;
    // Garde les sources.
    this.variants = sources;
    // Garde le niveau minimal.
    this.minZoom = minZoom;
    // Garde le niveau maximal demandé.
    this.maxZoomWanted = maxZoom;
    // Niveau maximal en vigueur.
    this.maxZoom = maxZoom;
    // Garde les accès.
    this.io = io;
    // Numéro de la source en cours : 0.
    this.index = 0;
    // Adresse des tuiles : inconnue.
    this.template = null;
    // Recherche de l'adresse en cours : aucune.
    this.resolving = null;
    // Téléchargements partagés, par adresse.
    this.shared = new Map(); // url → promesse d'image
    // Adresses déjà préchargées.
    this.warmed = new Set(); // adresses déjà préchargées vers le disque pendant la session
    // Nombre d'échecs d'affilée : 0.
    this.failures = 0;
    // La source en cours n'a pas encore répondu.
    this.succeeded = false;  // la source en cours a déjà répondu au moins une fois
  // Fin du constructeur.
  }

  /** Plus aucune source utilisable : on cesse de demander le relief, l'image reste affichée à plat. */
  // broken : vrai quand toutes les sources sont épuisées, ou quand la dernière a échoué huit fois d'affilée.
  get broken() { return this.index >= this.variants.length || (this.index === this.variants.length - 1 && this.failures >= BROKEN_AFTER); }

  /** Source en cours ({ template } ou { tilejson }), pour les crédits et le diagnostic. */
  // current : la source en cours, ou null.
  get current() { return this.variants[this.index] ?? null; }

  /** Passe à la source suivante (la précédente est abandonnée pour la session). */
  // next : passe à la source suivante (début).
  next() {
    // Numéro suivant.
    this.index++;
    // Adresse inconnue.
    this.template = null;
    // Aucune recherche en cours.
    this.resolving = null;
    // Échecs remis à 0.
    this.failures = 0;
    // Pas encore de réponse.
    this.succeeded = false;
    // Vide les téléchargements partagés.
    this.shared.clear();
  // Fin de next.
  }

  /** Adresse des tuiles de la source en cours : donnée, ou lue une fois dans sa fiche TileJSON. */
  // ready : l'adresse des tuiles de la source en cours (début).
  ready() {
    // Déjà connue : rendue tout de suite.
    if (this.template) return Promise.resolve(this.template);
    // Recherche déjà en cours : la même promesse.
    if (this.resolving) return this.resolving;
    // attempt : cherche l'adresse, source après source (début).
    const attempt = async () => {
      // Tant qu'il reste une source (début).
      while (this.index < this.variants.length) {
        // La source en cours.
        const v = this.variants[this.index];
        // Essai (début).
        try {
          // Son adresse : donnée, ou lue dans sa fiche TileJSON.
          const found = v.template ? { template: v.template, maxZoom: v.maxZoom ?? null } : templateFromTileJson(await this.io.fetchJson(v.tilejson));
          // Aucune : erreur.
          if (!found) throw new Error('fiche sans adresse de tuiles');
          // Garde l'adresse.
          this.template = found.template;
          // Niveau maximal : le plus petit de celui demandé et de celui de la source.
          this.maxZoom = Math.min(this.maxZoomWanted, found.maxZoom ?? this.maxZoomWanted);
          // Renvoie l'adresse.
          return this.template;
        // En cas d'erreur (début).
        } catch {
          // Passe à la source suivante.
          this.next();
        // Fin de l'essai.
        }
      // Fin de la boucle.
      }
      // Plus aucune source : erreur.
      throw new Error('aucune source d’altitude');
    // Fin de attempt.
    };
    // Lance la recherche et l'oublie une fois terminée.
    this.resolving = attempt().finally(() => { this.resolving = null; });
    // Renvoie la promesse.
    return this.resolving;
  // Fin de ready.
  }

  /** Niveau de la tuile d'altitude à prendre pour une tuile affichée au niveau `z` (source prête, voir ready). */
  // levelFor : le niveau de la tuile d'altitude pour un niveau affiché (début).
  levelFor(z) {
    // Un niveau de moins avec des tuiles de 512 pixels et le partage d'altitude ; sinon aucun.
    const drop = (this.current?.tileSize ?? 256) >= 512 ? this.coarse : 0;
    // Renvoie le niveau, entre 0 et le maximum.
    return Math.max(0, Math.min(this.maxZoom, z - drop));
  // Fin de levelFor.
  }

  // url : l'adresse d'une tuile.
  url(coord) { return fillTemplate(this.template, coord); }

  // fetchShared, asynchrone : le téléchargement partagé d'une tuile (début).
  async fetchShared(coord) {
    // Attend l'adresse de la source.
    await this.ready();
    // Adresse de la tuile.
    const url = this.url(coord);
    // Téléchargement déjà en cours ou terminé.
    let p = this.shared.get(url);
    // Sinon (début).
    if (!p) {
      // Numéro de la source au départ.
      const index = this.index;
      // Charge l'image ; en cas de réussite (début) :
      p = this.io.loadImage(url).then((img) => {
        // si la source n'a pas changé, les échecs reviennent à 0 et la source est notée comme ayant répondu ;
        if (index === this.index) { this.failures = 0; this.succeeded = true; }
        // renvoie l'image.
        return img;
      // En cas d'échec (début) :
      }, (e) => {
        // si la source n'a pas changé (début),
        if (index === this.index) {
          // le téléchargement est retiré du partage,
          this.shared.delete(url);
          // un échec de plus,
          this.failures++;
          // Source qui n'a jamais répondu : on essaie la suivante plutôt que de laisser l'astre sans relief.
          // et, pour une source qui n'a jamais répondu, après quatre échecs et s'il en reste une autre : source suivante.
          if (!this.succeeded && this.failures >= SWITCH_AFTER && this.index < this.variants.length - 1) this.next();
        // Fin de ce cas.
        }
        // L'erreur est relancée.
        throw e;
      // Fin du traitement.
      });
      // Range la promesse dans le partage.
      this.shared.set(url, p);
      // Au-delà de 400 entrées : la plus ancienne est retirée.
      if (this.shared.size > 400) this.shared.delete(this.shared.keys().next().value);
    // Fin de ce cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de fetchShared.
  }

  /**
   * Précharge une tuile d'altitude vers le disque du navigateur, sans la décoder (`io.warm`, facultatif) : elle sera
   * lue sur place quand l'image qu'elle soulève s'affichera. Renvoie true si une requête est partie ; rien tant que
   * l'adresse de la source n'est pas connue, ni pour une tuile déjà en mémoire ou déjà préchargée.
   */
  // warm : précharge une tuile vers le disque (début).
  warm(coord) {
    // Sans adresse, sans fonction de préchargement ou relief abandonné : refusé.
    if (!this.template || !this.io.warm || this.broken) return false;
    // Adresse de la tuile.
    const url = this.url(coord);
    // Déjà en mémoire ou déjà préchargée : refusé.
    if (this.shared.has(url) || this.warmed.has(url)) return false;
    // Au-delà de 2000 adresses notées : la liste est vidée.
    if (this.warmed.size >= 2000) this.warmed.clear();
    // Note l'adresse.
    this.warmed.add(url);
    // Lance le préchargement ; un échec est ignoré.
    Promise.resolve(this.io.warm(url)).catch(() => {}); // préchargement facultatif : un échec ne change rien
    // Lancé.
    return true;
  // Fin de warm.
  }

  // loadImage : l'image d'une tuile, avec un signal d'annulation facultatif (début).
  loadImage(coord, signal) {
    // Le téléchargement partagé.
    const p = this.fetchShared(coord);
    // Sans signal : cette promesse.
    if (!signal) return p;
    // Sinon, une promesse propre à cet appel (début).
    return new Promise((resolve, reject) => {
      // abort : la rejette avec une erreur AbortError.
      const abort = () => reject(Object.assign(new Error('annulé'), { name: 'AbortError' }));
      // Déjà annulé : rejet immédiat, l'erreur éventuelle du téléchargement étant ignorée.
      if (signal.aborted) { p.catch(() => {}); abort(); return; }
      // Écoute l'annulation, une seule fois.
      signal.addEventListener('abort', abort, { once: true });
      // À la fin du téléchargement : l'écoute est retirée, puis l'image est rendue ou l'erreur transmise.
      p.then((img) => { signal.removeEventListener('abort', abort); resolve(img); }, (e) => { signal.removeEventListener('abort', abort); reject(e); });
    // Fin de la promesse.
    });
  // Fin de loadImage.
  }
// Fin de la classe ReliefSource.
}
