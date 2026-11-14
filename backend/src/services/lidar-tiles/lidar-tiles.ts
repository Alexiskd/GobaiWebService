/**
 * Dalles LiDAR affichées en vrais points 3D sur la Terre : format des fichiers et fonctions pures (testées).
 *
 * Une dalle (LiDAR HD de l'IGN, 1 km × 1 km, nuage COPC) est préparée une fois pour le web et versionnée dans
 * backend/data/lidar/<dalle>/ : `manifest.json` et un fichier par nœud de l'octree (`nodes/<niveau>-<x>-<y>-<z>.bin`).
 * L'octree est additif : la racine donne tout de suite la dalle entière en basse densité (pas de 6,8 m), chaque niveau
 * ajoute des points deux fois plus serrés. Le navigateur ne charge que les nœuds proches de la caméra.
 *
 * Fichier d'un nœud, compressé en gzip (servi tel quel avec Content-Encoding : le navigateur le décompresse) — n points
 * triés en ordre de Morton, 8 octets par point rangés par plans :
 *   écarts de X (octets bas, puis octets hauts), écarts de Y, écarts de Z, classe d'affichage, luminosité.
 * X et Y sont comptés depuis le coin du nœud, Z depuis le bas de la dalle, en pas de `step` mètres ; chaque écart
 * (différence avec le point précédent) est codé en zigzag sur 16 bits. La luminosité (170 = neutre) réunit
 * l'intensité du retour laser, l'ombrage du relief et l'occlusion, calculés une fois à la préparation.
 */

/** Classes d'affichage (octet « classe » d'un point). */
// Noms des dix classes d'affichage d'un point, dans l'ordre de leur numéro (0 à 9).
export const LIDAR_CLASSES = ['divers', 'sol', 'végétation basse', 'végétation moyenne', 'végétation haute', 'toit', 'façade', 'eau', 'pont', 'sursol'] as const;

// Forme d'un nœud de l'octree dans le manifeste.
export interface LidarNode {
  /** Clé du nœud : « niveau-x-y-z » dans l'octree. */
  // k : sa clé.
  k: string;
  /** Nombre de points. */
  // n : son nombre de points.
  n: number;
  /** Taille du fichier compressé (octets). */
  // b : la taille de son fichier.
  b: number;
  /** Début du sha256 du fichier : change l'adresse quand le contenu change (cache permanent du navigateur). */
  // h : le début de l'empreinte de son fichier.
  h: string;
// Fin de LidarNode.
}

// Forme du manifeste d'une dalle.
export interface LidarManifest {
  // id : son identifiant.
  id: string;
  // name : son nom affiché.
  name: string;
  // tile : le nom de la dalle chez l'IGN.
  tile: string;
  // source : l'origine des données.
  source: string;
  // license : leur licence.
  license: string;
  // acquired : la date du relevé.
  acquired: string;
  // crs : le système de coordonnées.
  crs: string;
  // points : le nombre total de points.
  points: number;
  // bytes : la taille totale des fichiers.
  bytes: number;
  // format : la version du format.
  format: number;
  /** Pas de quantification des coordonnées (m). */
  // step : le pas des coordonnées.
  step: number;
  /** Espacement des points de la racine (m) ; divisé par deux à chaque niveau. */
  // spacing : l'espacement des points de la racine.
  spacing: number;
  /** Emprise native (m, système `crs`). */
  // bounds : l'emprise, minimum et maximum sur X, Y et Z.
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  /** Calage GPS : même convention que les nuages du catalogue (centre de l'emprise, bas du nuage). */
  // anchor : le calage GPS (latitude, longitude, altitude, cap).
  anchor: { lat: number; lon: number; alt: number; heading: number };
  // nodes : les nœuds.
  nodes: LidarNode[];
// Fin de LidarManifest.
}

// Forme d'un identifiant de dalle : 2 à 61 caractères (minuscules, chiffres, tirets), sans tiret au début.
const TILE_ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
// Forme d'une clé de nœud : quatre nombres séparés par des tirets, niveau puis x, y, z.
const NODE_KEY = /^(\d{1,2})-(\d{1,5})-(\d{1,5})-(\d{1,5})$/;

// Fonction isLidarTileId : la valeur est-elle un texte de la bonne forme ?
export const isLidarTileId = (id: unknown): id is string => typeof id === 'string' && TILE_ID.test(id);

/** Clé de nœud bien formée : niveau ≤ 12 et indices dans la grille du niveau. */
// Fonction isLidarNodeKey : la clé est-elle valable ?
export function isLidarNodeKey(key: unknown): key is string {
  // Reconnaît la clé si c'est un texte ; null sinon.
  const m = typeof key === 'string' ? NODE_KEY.exec(key) : null;
  // Forme incorrecte : non.
  if (!m) return false;
  // Niveau.
  const level = Number(m[1]);
  // Au-delà du niveau 12 : non.
  if (level > 12) return false;
  // Nombre de cases par axe à ce niveau : 2 puissance niveau.
  const size = 2 ** level;
  // Oui si x, y et z tiennent dans cette grille.
  return Number(m[2]) < size && Number(m[3]) < size && Number(m[4]) < size;
// Fin de isLidarNodeKey.
}

/** Manifeste utilisable : identifiant, emprise, calage et nœuds bien formés. Sinon la dalle est ignorée. */
// Fonction isLidarManifest : le manifeste est-il utilisable ?
export function isLidarManifest(m: unknown): m is LidarManifest {
  // Vu comme un manifeste, pour lire ses champs.
  const t = m as LidarManifest;
  // Il existe, son identifiant est valable, le format est la version 1, le pas et l'espacement sont positifs,
  return Boolean(t) && isLidarTileId(t.id) && t.format === 1 && t.step > 0 && t.spacing > 0
    // l'emprise existe et ses six valeurs sont des nombres finis,
    && Boolean(t.bounds) && [t.bounds.minX, t.bounds.minY, t.bounds.minZ, t.bounds.maxX, t.bounds.maxY, t.bounds.maxZ].every(Number.isFinite)
    // le calage existe avec une latitude et une longitude finies,
    && Boolean(t.anchor) && Number.isFinite(t.anchor.lat) && Number.isFinite(t.anchor.lon)
    // la liste des nœuds existe et n'est pas vide,
    && Array.isArray(t.nodes) && t.nodes.length > 0
    // et chaque nœud a une clé valable, des points, une taille et une empreinte en texte.
    && t.nodes.every((n) => isLidarNodeKey(n.k) && n.n > 0 && n.b > 0 && typeof n.h === 'string');
// Fin de isLidarManifest.
}

/** Adresse d'un nœud : l'empreinte dans l'adresse autorise un cache permanent. */
// Fonction lidarNodeUrl : l'adresse du fichier d'un nœud, avec son empreinte en paramètre.
export const lidarNodeUrl = (tile: string, node: LidarNode): string => `/api/v1/lidar/${tile}/${node.k}?v=${node.h}`;

/**
 * Orthophoto drapée sur les points (colorisation) : le relevé laser n'a pas de couleur, chaque point prend celle de la
 * photo aérienne de l'IGN à sa verticale. Tuiles WMTS de la Géoplateforme (Web Mercator, JPEG, sans clé), chargées
 * directement par le navigateur comme le fond de carte.
 */
// Orthophoto à draper sur les points :
export const LIDAR_IMAGERY = {
  // modèle d'adresse des tuiles de l'IGN, première moitié ;
  template: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal'
    // seconde moitié, avec les trous {z}, {y}, {x} ;
    + '&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  // niveau de zoom maximal ;
  maxZoom: 19,
  // mention à afficher.
  attribution: 'Orthophotos © IGN — Géoplateforme (Licence Ouverte 2.0)',
// Fin de LIDAR_IMAGERY.
};

/**
 * Manifeste envoyé au navigateur : le même, avec le modèle d'adresse des nœuds ({k} = clé, {h} = empreinte) et
 * l'orthophoto à draper sur les points (`imagery`).
 */
// Fonction publicLidarManifest : le manifeste envoyé au navigateur.
export function publicLidarManifest(m: LidarManifest, storage: 'postgres' | 'files') {
  // Le manifeste, plus l'origine des fichiers, le modèle d'adresse des nœuds et l'orthophoto.
  return { ...m, storage, nodeUrl: `/api/v1/lidar/${m.id}/{k}?v={h}`, imagery: LIDAR_IMAGERY };
// Fin de publicLidarManifest.
}

/** Cache mémoire borné en octets (les fichiers les plus anciennement lus sortent les premiers). */
// Classe ByteCache : cache mémoire limité en octets.
export class ByteCache {
  // Fichiers gardés, dans l'ordre de leur dernière lecture (une Map garde l'ordre d'insertion).
  private readonly items = new Map<string, Buffer>();
  // Octets occupés.
  private used = 0;

  // Constructeur : reçoit la capacité en octets ; corps vide.
  constructor(private readonly capacity: number) {}

  // Méthode get : lit un fichier du cache.
  get(key: string): Buffer | undefined {
    // Cherche le fichier.
    const hit = this.items.get(key);
    // Trouvé : on le retire et on le remet, il devient le plus récemment lu.
    if (hit) { this.items.delete(key); this.items.set(key, hit); }
    // Renvoie le fichier, ou undefined.
    return hit;
  // Fin de get.
  }

  // Méthode set : range un fichier dans le cache.
  set(key: string, body: Buffer): void {
    // Plus grand que le cache entier : on ne le garde pas.
    if (body.length > this.capacity) return;
    // Ancienne version sous la même clé ?
    const old = this.items.get(key);
    // Si oui, on retire sa taille du total et on l'enlève.
    if (old) { this.used -= old.length; this.items.delete(key); }
    // Range le fichier, en dernière position.
    this.items.set(key, body);
    // Ajoute sa taille au total.
    this.used += body.length;
    // Parcourt les fichiers du plus ancien au plus récent :
    for (const [k, v] of this.items) {
      // sous la capacité : on s'arrête ;
      if (this.used <= this.capacity) break;
      // sinon on enlève le plus ancien,
      this.items.delete(k);
      // et on retire sa taille du total.
      this.used -= v.length;
    // Fin du parcours.
    }
  // Fin de set.
  }

  // Accesseur bytes : octets occupés.
  get bytes(): number { return this.used; }
  // Accesseur size : nombre de fichiers gardés.
  get size(): number { return this.items.size; }
// Fin de ByteCache.
}
