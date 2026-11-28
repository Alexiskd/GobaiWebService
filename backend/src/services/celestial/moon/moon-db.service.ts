import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { BadRequestException, Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { nz, triPlan, type Vec3 } from '../../../geo/geodesy';
import { sha256Hex } from './image';

// ===========================================================================
// moon-db.service.ts — stockage PostgreSQL des tuiles géodésiques (tri) et Trek
// ===========================================================================
/*
 * Service moon-db — tout-en-un :
 *
 *  1. Indexation géodésique des tuiles triangulaires (icosaèdre, grille n×n
 *     puis divisions par 4), même schéma que triPlan() de geo/geodesy.
 *  2. Téléchargement et stockage PostgreSQL des tuiles NASA Trek (WMTS).
 *  3. Préchargement complet de la mosaïque Trek en arrière-plan.
 *  4. Composition à la demande des tuiles tri depuis le stockage local.
 *
 * Identifiant d'une tuile tri : f{face}-{i}-{j}-{u|d}-{digits}
 *   face   : 0..19 — face de l'icosaèdre
 *   i, j   : position dans la grille racine n×n de la face
 *   u | d  : triangle "up" ou "down" de la cellule
 *   digits : suite de 0..3, un chiffre par subdivision (niveau = length)
 *
 * Convention géodésique identique à geo/geodesy : +y = pôle Nord,
 * longitude 0 sur +z, donc lon = atan2(x, z) et lat = asin(y).
 */


// ---------------------------------------------------------------------------
// Plan géodésique de la Lune (mode tri)
// ---------------------------------------------------------------------------

// Rayon de la Lune, en mètres.
const MOON_RADIUS_M = 1_737_400;
// Plan de découpage de la Lune en triangles.
export const MOON_TRI_PLAN = triPlan(MOON_RADIUS_M, 'Lune');
// Nombre de cellules par côté de la grille de départ d'une face.
const ROOT_GRID_N = MOON_TRI_PLAN.n;

// Forme d'une emprise en longitude et latitude.
export interface BBoxLonLat {
  // west : le bord ouest.
  west: number;
  // south : le bord sud.
  south: number;
  // east : le bord est.
  east: number;
  // north : le bord nord.
  north: number;
  /** vrai si la tuile chevauche l'antiméridien (west > east en degrés bruts) */
  // antimeridian : vrai si la tuile passe par la longitude 180°.
  antimeridian: boolean;
// Fin de BBoxLonLat.
}

// Forme d'une tuile triangulaire.
export interface TriTile {
  // id : son identifiant.
  id: string;
  // face : le numéro de sa face de l'icosaèdre.
  face: number;
  // i : sa première position dans la grille de la face.
  i: number;
  // j : sa seconde position.
  j: number;
  // up : vrai pour le triangle « pointe en haut » de la cellule.
  up: boolean;
  // digits : la suite de ses divisions.
  digits: string;
  // level : son niveau (le nombre de divisions).
  level: number;
  // corners : ses trois coins, en 3D.
  corners: [Vec3, Vec3, Vec3];
  // bbox : son emprise.
  bbox: BBoxLonLat;
  // center : son centre.
  center: { lon: number; lat: number };
// Fin de TriTile.
}

// Nombre d'or.
const PHI = (1 + Math.sqrt(5)) / 2;

// Les douze sommets de l'icosaèdre, avant normalisation :
const RAW_VERTICES: ReadonlyArray<[number, number, number]> = [
  // les quatre du plan xy ;
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  // les quatre du plan yz ;
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  // les quatre du plan xz.
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
// Fin de la liste.
];

// Les mêmes sommets, ramenés sur la sphère de rayon 1.
const VERTICES: Vec3[] = RAW_VERTICES.map(([x, y, z]) => nz([x, y, z]));

/** 20 faces de l'icosaèdre (mêmes triplets que three.js IcosahedronGeometry). */
// Les vingt faces, chacune donnée par trois numéros de sommets :
const FACES: ReadonlyArray<readonly [number, number, number]> = [
  // les cinq faces autour du sommet 0 ;
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  // les cinq faces voisines ;
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  // les cinq faces autour du sommet 3 ;
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  // les cinq faces voisines.
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
// Fin de la liste.
];

// Fonction mid : le milieu de deux points,
const mid = (a: Vec3, b: Vec3): Vec3 =>
  // ramené sur la sphère.
  nz([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);

/** Coordonnées barycentriques sur une face, projetées sur la sphère. */
// Fonction bary : le point de coordonnées (u, v) sur une face.
const bary = (a: Vec3, b: Vec3, c: Vec3, u: number, v: number): Vec3 => {
  // Troisième coordonnée : ce qui reste.
  const w = 1 - u - v;
  // Renvoie, ramené sur la sphère,
  return nz([
    // le x pondéré des trois coins,
    w * a[0] + u * b[0] + v * c[0],
    // le y pondéré,
    w * a[1] + u * b[1] + v * c[1],
    // le z pondéré.
    w * a[2] + u * b[2] + v * c[2],
  // Fin du point.
  ]);
// Fin de bary.
};

// Fonction vecToLonLat : d'un point 3D vers une longitude et une latitude.
export function vecToLonLat(v: Vec3): { lon: number; lat: number } {
  // Latitude : l'arc sinus de y, en degrés.
  const lat = (Math.asin(Math.max(-1, Math.min(1, v[1]))) * 180) / Math.PI;
  // Longitude : l'angle entre x et z, en degrés.
  const lon = (Math.atan2(v[0], v[2]) * 180) / Math.PI;
  // Renvoie les deux.
  return { lon, lat };
// Fin de vecToLonLat.
}

/** Division d'un triangle en 4 (milieux normalisés sur la sphère). */
// Fonction subdivide : un des quatre petits triangles d'un triangle.
function subdivide(corners: [Vec3, Vec3, Vec3], digit: number): [Vec3, Vec3, Vec3] {
  // Les trois coins.
  const [a, b, c] = corners;
  // Milieu du premier côté.
  const ab = mid(a, b);
  // Milieu du deuxième côté.
  const bc = mid(b, c);
  // Milieu du troisième côté.
  const ca = mid(c, a);
  // Selon le chiffre :
  switch (digit) {
    // 0 :
    case 0:
      // le triangle du premier coin ;
      return [a, ab, ca];
    // 1 :
    case 1:
      // celui du deuxième coin ;
      return [ab, b, bc];
    // 2 :
    case 2:
      // celui du troisième coin ;
      return [ca, bc, c];
    // sinon :
    default:
      // le triangle du milieu.
      return [ab, bc, ca];
  // Fin du choix.
  }
// Fin de subdivide.
}

// Forme d'un identifiant : f, la face, i, j, u ou d, puis jusqu'à 16 chiffres de 0 à 3.
const ID_PATTERN = /^f(\d{1,2})-(\d{1,2})-(\d{1,2})-([ud])-([0-3]{0,16})$/;

// Forme d'un identifiant lu.
export interface ParsedTriId {
  // face : la face.
  face: number;
  // i : la première position.
  i: number;
  // j : la seconde position.
  j: number;
  // up : pointe en haut ou non.
  up: boolean;
  // digits : la suite des divisions.
  digits: string;
// Fin de ParsedTriId.
}

// Fonction parseTriId : lit un identifiant.
export function parseTriId(id: string): ParsedTriId | null {
  // Le compare à la forme attendue.
  const match = ID_PATTERN.exec(id ?? '');
  // Forme inattendue :
  if (!match) {
    // null.
    return null;
  // Fin du cas.
  }
  // Renvoie
  return {
    // la face ;
    face: Number(match[1]),
    // la première position ;
    i: Number(match[2]),
    // la seconde position ;
    j: Number(match[3]),
    // pointe en haut si la lettre est « u » ;
    up: match[4] === 'u',
    // la suite des divisions.
    digits: match[5],
  // Fin de l'objet.
  };
// Fin de parseTriId.
}

/** Géométrie complète d'une tuile tri : coins 3D, bbox lon/lat, centre. */
// Fonction buildTriTile : la géométrie d'une tuile.
export function buildTriTile(id: string, rootGridN: number): TriTile | null {
  // Lit l'identifiant.
  const parsed = parseTriId(id);
  // Illisible :
  if (!parsed) {
    // null.
    return null;
  // Fin du cas.
  }

  // Ses cinq parties.
  const { face, i, j, up, digits } = parsed;
  // Face ou position hors des bornes :
  if (face >= FACES.length || i >= rootGridN || j >= rootGridN) {
    // null.
    return null;
  // Fin du cas.
  }
  // Cellule hors du triangle de la face :
  if (up ? i + j > rootGridN - 1 : i + j > rootGridN - 2) {
    // null.
    return null;
  // Fin du cas.
  }

  // Les trois sommets de la face.
  const [A, B, C] = FACES[face].map((k) => VERTICES[k]) as [Vec3, Vec3, Vec3];
  // Fonction point : le point de la grille de la face,
  const point = (u: number, v: number) =>
    // à la position (u, v).
    bary(A, B, C, u / rootGridN, v / rootGridN);

  // Les trois coins de la tuile.
  let corners: [Vec3, Vec3, Vec3];
  // Triangle pointe en haut :
  if (up) {
    // ses trois coins.
    corners = [point(i, j), point(i + 1, j), point(i, j + 1)];
  // Sinon :
  } else {
    // les trois coins du triangle pointe en bas.
    corners = [point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
  // Fin du choix.
  }

  // Pour chaque chiffre de la suite :
  for (const digit of digits) {
    // prend le petit triangle correspondant.
    corners = subdivide(corners, Number(digit));
  // Fin de la boucle.
  }

  // bbox échantillonnée : coins, milieux d'arêtes et centroïde
  // Centre du triangle, ramené sur la sphère :
  const centroid: Vec3 = nz([
    // la moyenne des x,
    (corners[0][0] + corners[1][0] + corners[2][0]) / 3,
    // celle des y,
    (corners[0][1] + corners[1][1] + corners[2][1]) / 3,
    // celle des z.
    (corners[0][2] + corners[1][2] + corners[2][2]) / 3,
  // Fin du centre.
  ]);
  // Points qui servent à mesurer l'emprise :
  const samples: Vec3[] = [
    // le premier coin,
    corners[0],
    // le deuxième,
    corners[1],
    // le troisième,
    corners[2],
    // le milieu du premier côté,
    mid(corners[0], corners[1]),
    // du deuxième,
    mid(corners[1], corners[2]),
    // du troisième,
    mid(corners[2], corners[0]),
    // et le centre.
    centroid,
  // Fin de la liste.
  ];
  // Les mêmes points, en longitude et latitude.
  const points = samples.map(vecToLonLat);

  // Bord sud : la plus petite latitude.
  const south = Math.min(...points.map((p) => p.lat));
  // Bord nord : la plus grande.
  const north = Math.max(...points.map((p) => p.lat));

  // Bord ouest : la plus petite longitude.
  let west = Math.min(...points.map((p) => p.lon));
  // Bord est : la plus grande.
  let east = Math.max(...points.map((p) => p.lon));
  // Par défaut, la tuile ne passe pas par 180°.
  let antimeridian = false;
  // Si elle paraît large de plus de 180° :
  if (east - west > 180) {
    // la tuile chevauche l'antiméridien : on décale les longitudes négatives
    // longitudes ramenées entre 0° et 360° ;
    const shifted = points.map((p) => (p.lon < 0 ? p.lon + 360 : p.lon));
    // plus petite ;
    const westShifted = Math.min(...shifted);
    // plus grande ;
    const eastShifted = Math.max(...shifted);
    // si l'emprise est plus étroite ainsi :
    if (eastShifted - westShifted < east - west) {
      // bord ouest, ramené entre −180° et 180° ;
      west = westShifted > 180 ? westShifted - 360 : westShifted;
      // bord est, de même ;
      east = eastShifted > 180 ? eastShifted - 360 : eastShifted;
      // elle passe par 180° si l'ouest dépasse l'est.
      antimeridian = west > east;
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Renvoie
  return {
    // l'identifiant ;
    id,
    // la face ;
    face,
    // la première position ;
    i,
    // la seconde position ;
    j,
    // pointe en haut ou non ;
    up,
    // la suite des divisions ;
    digits,
    // le niveau ;
    level: digits.length,
    // les coins ;
    corners,
    // l'emprise ;
    bbox: { west, south, east, north, antimeridian },
    // le centre.
    center: vecToLonLat(centroid),
  // Fin de l'objet.
  };
// Fin de buildTriTile.
}

// ---------------------------------------------------------------------------
// Source amont NASA Trek (WMTS) — seule dépendance réseau
// ---------------------------------------------------------------------------

// Niveau maximal des tuiles de NASA Trek : 8.
export const TREK_MAX_ZOOM = 8;

// Adresse de base du produit Trek :
const TREK_BASE = `${(
  // MOON_TREK_BASE_URL, ou l'adresse officielle,
  process.env.MOON_TREK_BASE_URL ?? 'https://trek.nasa.gov/tiles/Moon/EQ'
// sans barres finales, puis MOON_TREK_PRODUCT ou la mosaïque LRO WAC, puis « 1.0.0 ».
).replace(/\/+$/, '')}/${process.env.MOON_TREK_PRODUCT ?? 'LRO_WAC_Mosaic_Global_303ppd_v02'}/1.0.0`;
// Style Trek : MOON_TREK_STYLE, ou « default ».
const TREK_STYLE = process.env.MOON_TREK_STYLE ?? 'default';
// Jeu de tuiles Trek : MOON_TREK_MATRIX_SET, ou « default028mm ».
const TREK_MATRIX_SET = process.env.MOON_TREK_MATRIX_SET ?? 'default028mm';

/** Format REST WMTS de Trek : .../{z}/{y}/{x}.jpg */
// Fonction buildTrekUrl : l'adresse d'une tuile Trek.
export function buildTrekUrl(z: number, x: number, y: number): string {
  // Base, style, jeu de tuiles, niveau, ligne, colonne, « .jpg ».
  return `${TREK_BASE}/${TREK_STYLE}/${TREK_MATRIX_SET}/${z}/${y}/${x}.jpg`;
// Fin de buildTrekUrl.
}


// Fonction sleep : attend un nombre de millisecondes.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Télécharge une tuile Trek ; null si 404 ou après 2 tentatives échouées. */
// Fonction fetchTrekTile ; ses paramètres :
export async function fetchTrekTile(
  // le niveau ;
  z: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie les octets de la tuile, ou null.
): Promise<Buffer | null> {
  // Deux essais au plus :
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // essaie
    try {
      // de télécharger la tuile,
      const response = await fetch(buildTrekUrl(z, x, y), {
        // avec abandon au bout de 20 secondes,
        signal: AbortSignal.timeout(20_000),
        // et un en-tête User-Agent.
        headers: { 'user-agent': 'moon-db/1.0 (+https://trek.nasa.gov)' },
      // Fin de l'appel.
      });
      // Code 404 :
      if (response.status === 404) {
        // null.
        return null;
      // Fin du cas.
      }
      // Autre réponse en erreur :
      if (!response.ok) {
        // erreur.
        throw new Error(`HTTP ${response.status}`);
      // Fin du cas.
      }
      // Renvoie les octets.
      return Buffer.from(await response.arrayBuffer());
    // En cas d'échec :
    } catch {
      // au second essai :
      if (attempt === 1) {
        // null.
        return null;
      // Fin du cas.
      }
      // Attend une seconde.
      await sleep(1_000);
    // Fin du cas.
    }
  // Fin de la boucle.
  }
  // Sinon : null.
  return null;
// Fin de fetchTrekTile.
}

// ---------------------------------------------------------------------------
// Schéma PostgreSQL
// ---------------------------------------------------------------------------

// Schéma de la base : la table trek_tiles (tuiles Trek, par niveau, colonne et ligne), la table tri_tiles (tuiles triangulaires, par identifiant) et un index sur le niveau des tuiles triangulaires ; chaque tuile garde ses octets, son empreinte et sa date.
// Détail du texte SQL, ligne par ligne (les lignes d'une chaîne ne peuvent pas porter de commentaire) :
// ligne 1 : crée la table trek_tiles si elle n'existe pas (début) ;
// ligne 2 : z, le niveau de la tuile, petit entier obligatoire ;
// ligne 3 : x, la colonne, entier obligatoire ;
// ligne 4 : y, la ligne, entier obligatoire ;
// ligne 5 : content_type, le type de contenu, « image/jpeg » par défaut ;
// ligne 6 : bytes, les octets de l'image, obligatoires ;
// ligne 7 : sha256, l'empreinte de 64 caractères, obligatoire ;
// ligne 8 : fetched_at, la date de téléchargement, l'instant présent par défaut ;
// ligne 9 : clé primaire sur le niveau, la colonne et la ligne ;
// ligne 10 : fin de la table trek_tiles ;
// ligne 11 : crée la table tri_tiles si elle n'existe pas (début) ;
// ligne 12 : id, l'identifiant de la tuile triangulaire, clé primaire ;
// ligne 13 : level, le niveau, petit entier obligatoire ;
// ligne 14 : bbox, l'emprise, tableau de nombres obligatoire ;
// ligne 15 : content_type, le type de contenu, « image/jpeg » par défaut ;
// ligne 16 : bytes, les octets de l'image, obligatoires ;
// ligne 17 : sha256, l'empreinte de 64 caractères, obligatoire ;
// ligne 18 : source_zoom, le niveau des tuiles d'origine, obligatoire ;
// ligne 19 : fetched_at, la date de téléchargement, l'instant présent par défaut ;
// ligne 20 : fin de la table tri_tiles ;
// ligne 21 : crée l'index tri_tiles_level_idx sur le niveau, s'il n'existe pas ;
// ligne 22 : fin du texte.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS trek_tiles (
    z            SMALLINT     NOT NULL,
    x            INTEGER      NOT NULL,
    y            INTEGER      NOT NULL,
    content_type TEXT         NOT NULL DEFAULT 'image/jpeg',
    bytes        BYTEA        NOT NULL,
    sha256       CHAR(64)     NOT NULL,
    fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (z, x, y)
  );
  CREATE TABLE IF NOT EXISTS tri_tiles (
    id           TEXT         NOT NULL PRIMARY KEY,
    level        SMALLINT     NOT NULL,
    bbox         DOUBLE PRECISION[] NOT NULL,
    content_type TEXT         NOT NULL DEFAULT 'image/jpeg',
    bytes        BYTEA        NOT NULL,
    sha256       CHAR(64)     NOT NULL,
    source_zoom  SMALLINT     NOT NULL,
    fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS tri_tiles_level_idx ON tri_tiles (level);
`;

// ---------------------------------------------------------------------------
// Composition d'images (sharp, chargé comme dans les services mars/*)
// ---------------------------------------------------------------------------

// Forme d'une zone d'image.
interface SharpRegion {
  // left : son bord gauche.
  left: number;
  // top : son bord haut.
  top: number;
  // width : sa largeur.
  width: number;
  // height : sa hauteur.
  height: number;
// Fin de SharpRegion.
}

// Forme d'une image sharp, limitée à ce que ce service utilise.
interface SharpImage {
  // extract : découpe d'une zone.
  extract(region: SharpRegion): SharpImage;
  // resize : changement de taille.
  resize(w: number, h: number, options?: { fit?: string }): SharpImage;
  // jpeg : sortie en JPEG.
  jpeg(options?: { quality?: number }): SharpImage;
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
// Fin de SharpImage.
}

// Type SharpFactory : la fonction sharp, qui prend
type SharpFactory = (
  // en entrée
  input:
    // des octets,
    | Buffer
    // ou
    | {
        // une image à créer, avec
        create: {
          // sa largeur,
          width: number;
          // sa hauteur,
          height: number;
          // son nombre de canaux,
          channels: number;
          // et sa couleur de fond ;
          background: { r: number; g: number; b: number };
        // fin de l'image à créer ;
        };
      // fin de l'entrée ;
      },
// elle rend une image, qui a en plus
) => SharpImage & {
  // composite : pose d'images,
  composite(
    // chacune avec ses octets et sa position.
    layers: Array<{ input: Buffer; left: number; top: number }>,
  // Fin de composite.
  ): SharpImage;
// Fin du type.
};

// Charge la bibliothèque d'images sharp.
const sharp = createRequire(__filename)('sharp') as SharpFactory;

// Forme du résultat d'une tuile triangulaire.
export interface TriTileResult {
  // tile : sa géométrie.
  tile: TriTile;
  // bytes : ses octets.
  bytes: Buffer;
  // sha256 : son empreinte.
  sha256: string;
  // sourceZoom : le niveau Trek dont elle est tirée.
  sourceZoom: number;
  // cached : vrai si elle vient de la base.
  cached: boolean;
// Fin de TriTileResult.
}

// Forme de l'état du préchargement.
export interface PrefetchStatus {
  // running : en cours ou non.
  running: boolean;
  // minLevel : premier niveau.
  minLevel: number;
  // maxLevel : dernier niveau.
  maxLevel: number;
  // currentLevel : niveau en cours.
  currentLevel: number;
  // concurrency : nombre de téléchargements en même temps.
  concurrency: number;
  // done : tuiles téléchargées.
  done: number;
  // failed : tuiles en échec.
  failed: number;
  // total : tuiles à télécharger.
  total: number;
  // startedAt : heure de début.
  startedAt: string | null;
  // finishedAt : heure de fin.
  finishedAt: string | null;
  // lastError : dernière erreur.
  lastError: string | null;
// Fin de PrefetchStatus.
}

// ---------------------------------------------------------------------------
// Service unique : stockage + préchargement + tuiles tri
// ---------------------------------------------------------------------------

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la base de la Lune ; elle est prévenue de l'arrêt du module.
export class MoonDbService implements OnModuleDestroy {
  // Journal au nom de la classe.
  private readonly logger = new Logger(MoonDbService.name);
  // Groupe de connexions à PostgreSQL : aucun au départ.
  private readonly pool: Pool | null = null;
  // Promesse de création du schéma : aucune au départ.
  private schemaReady: Promise<void> | null = null;

  // État du préchargement, au départ :
  prefetchStatus: PrefetchStatus = {
    // à l'arrêt ;
    running: false,
    // premier niveau 0 ;
    minLevel: 0,
    // dernier niveau 6 ;
    maxLevel: 6,
    // niveau en cours 0 ;
    currentLevel: 0,
    // 6 téléchargements en même temps ;
    concurrency: 6,
    // aucune tuile téléchargée ;
    done: 0,
    // aucun échec ;
    failed: 0,
    // aucune tuile à télécharger ;
    total: 0,
    // pas d'heure de début ;
    startedAt: null,
    // pas d'heure de fin ;
    finishedAt: null,
    // pas d'erreur.
    lastError: null,
  // Fin de l'état.
  };

  // Constructeur.
  constructor() {
    // Adresse de la base : DATABASE_URL.
    const url = process.env.DATABASE_URL?.trim();
    // Si elle est définie :
    if (url) {
      // crée le groupe de connexions, avec
      this.pool = new Pool({
        // cette adresse,
        connectionString: url,
        // Une seule instance backend : limiter le pool pour préserver le quota PostgreSQL partagé.
        // 2 connexions au plus,
        max: 2,
        // et le chiffrement : pour une base Render,
        ssl: url.includes('render.com')
          // sans vérifier le certificat ;
          ? { rejectUnauthorized: false }
          // sinon pas de réglage.
          : undefined,
      // Fin de la création.
      });
    // Sinon :
    } else {
      // un avertissement dans le journal.
      this.logger.warn('DATABASE_URL absent : stockage des tuiles désactivé.');
    // Fin du choix.
    }
  // Fin du constructeur.
  }

  // Accesseur available.
  get available(): boolean {
    // Vrai si la base est configurée.
    return this.pool !== null;
  // Fin de available.
  }

  // Méthode privée assertPool.
  private assertPool(): Pool {
    // Base non configurée :
    if (!this.pool) {
      // erreur 503,
      throw new ServiceUnavailableException(
        // avec ce message.
        'PostgreSQL non configuré : renseignez DATABASE_URL.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie le groupe de connexions.
    return this.pool;
  // Fin de assertPool.
  }

  // Méthode privée ready : la base, une fois son schéma créé.
  private async ready(): Promise<Pool> {
    // Groupe de connexions.
    const pool = this.assertPool();
    // Au premier appel :
    if (!this.schemaReady) {
      // lance la création du schéma.
      this.schemaReady = pool.query(SCHEMA).then(() => undefined);
    // Fin du cas.
    }
    // Attend qu'il soit créé.
    await this.schemaReady;
    // Renvoie le groupe de connexions.
    return pool;
  // Fin de ready.
  }

  // Méthode onModuleDestroy, appelée à l'arrêt du module.
  async onModuleDestroy(): Promise<void> {
    // Ferme les connexions.
    await this.pool?.end();
  // Fin de onModuleDestroy.
  }

  // ------------------------------------------------------- tuiles tri (géométrie)

  /** Géométrie d'une tuile (bbox, coins, centre) sans télécharger l'image. */
  // Méthode describeTri : la géométrie d'une tuile.
  describeTri(id: string): TriTile {
    // La calcule.
    const tile = buildTriTile(id, ROOT_GRID_N);
    // Identifiant illisible :
    if (!tile) {
      // erreur 400,
      throw new BadRequestException(
        // qui rappelle la forme attendue.
        `Identifiant de tuile invalide : ${id}. Format : f{face}-{i}-{j}-{u|d}-{digits}.`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Niveau au-delà du plan :
    if (tile.level > MOON_TRI_PLAN.maxLevel) {
      // erreur 400,
      throw new BadRequestException(
        // avec le niveau maximal.
        `Niveau ${tile.level} hors plan (maximum ${MOON_TRI_PLAN.maxLevel}).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie la tuile.
    return tile;
  // Fin de describeTri.
  }

  /** Image d'une tuile tri : cache PostgreSQL → composition locale. */
  // Méthode getTriTile : l'image d'une tuile.
  async getTriTile(id: string): Promise<TriTileResult> {
    // Sa géométrie.
    const tile = this.describeTri(id);

    // La cherche dans la base.
    const stored = await this.getTri(id);
    // Trouvée :
    if (stored) {
      // renvoie
      return {
        // sa géométrie ;
        tile,
        // ses octets ;
        bytes: stored.bytes,
        // son empreinte ;
        sha256: stored.sha256,
        // son niveau Trek ;
        sourceZoom: stored.sourceZoom,
        // « vient de la base ».
        cached: true,
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Niveau Trek adapté à son emprise.
    const sourceZoom = this.chooseZoom(tile.bbox);
    // Compose l'image.
    const bytes = await this.compose(tile, sourceZoom);
    // Rien à composer :
    if (!bytes) {
      // erreur 400,
      throw new BadRequestException(
        // avec ce message.
        `Impossible de composer la tuile ${id} (aucune donnée Trek disponible).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // La range dans la base, avec
    const sha256 = await this.putTri(
      // son identifiant,
      id,
      // son niveau,
      tile.level,
      // son emprise,
      [tile.bbox.west, tile.bbox.south, tile.bbox.east, tile.bbox.north],
      // ses octets,
      bytes,
      // et son niveau Trek.
      sourceZoom,
    // Fin du rangement.
    );
    // Renvoie la tuile, marquée « pas de la base ».
    return { tile, bytes, sha256, sourceZoom, cached: false };
  // Fin de getTriTile.
  }

  /** Niveau Trek dont la résolution couvre la bbox de la tuile. */
  // Méthode privée chooseZoom.
  private chooseZoom(bbox: BBoxLonLat): number {
    // Largeur de l'emprise en longitude : si elle passe par 180°,
    const spanLon = bbox.antimeridian
      // 360° moins l'écart ;
      ? 360 - (bbox.west - bbox.east)
      // sinon l'est moins l'ouest.
      : bbox.east - bbox.west;
    // Niveau où une tuile Trek a à peu près cette largeur.
    const zoom = Math.ceil(Math.log2(360 / Math.max(spanLon, 1e-9))) - 1;
    // Le renvoie, gardé entre 0 et 8.
    return Math.min(Math.max(zoom, 0), TREK_MAX_ZOOM);
  // Fin de chooseZoom.
  }

  // Méthode privée compose ; ses paramètres :
  private async compose(
    // la tuile ;
    tile: TriTile,
    // le niveau Trek.
    z: number,
  // Elle renvoie une image JPEG, ou null.
  ): Promise<Buffer | null> {
    // Largeur de la mosaïque Trek à ce niveau, en pixels.
    const fullW = 2 ** (z + 1) * 256;
    // Sa hauteur.
    const fullH = 2 ** z * 256;
    // Fonction px : la colonne d'une longitude dans la mosaïque.
    const px = (lon: number) => Math.round(((lon + 180) / 360) * fullW);
    // Fonction py : la ligne d'une latitude.
    const py = (lat: number) => Math.round(((90 - lat) / 180) * fullH);

    // Haut de la zone, gardé dans la mosaïque.
    const top = Math.min(Math.max(py(Math.min(tile.bbox.north, 90)), 0), fullH);
    // Bas de la zone :
    const bottom = Math.min(
      // la ligne du bord sud, pas avant 0,
      Math.max(py(Math.max(tile.bbox.south, -90)), 0),
      // pas après la hauteur.
      fullH,
    // Fin du calcul.
    );
    // Hauteur de la zone, au moins 1 pixel.
    const height = Math.max(bottom - top, 1);

    // une ou deux bandes verticales (deux si chevauchement de l'antiméridien)
    // Bandes à prendre :
    const rects =
      // si la tuile passe par 180°,
      tile.bbox.antimeridian
        // deux bandes :
        ? [
            // de son bord ouest au bord droit de la mosaïque ;
            { x0: px(tile.bbox.west), w: Math.max(fullW - px(tile.bbox.west), 1) },
            // du bord gauche de la mosaïque à son bord est.
            { x0: 0, w: Math.max(px(tile.bbox.east), 1) },
          // Fin des deux bandes.
          ]
        // Sinon une seule bande :
        : [
            // la bande
            {
              // qui commence à son bord ouest, gardé dans la mosaïque,
              x0: Math.min(Math.max(px(tile.bbox.west), 0), fullW - 1),
              // et large de l'écart entre ses bords, au moins 1 pixel.
              w: Math.max(px(tile.bbox.east) - px(tile.bbox.west), 1),
            // Fin de la bande.
            },
          // Fin de la liste.
          ];

    // Largeur totale de la toile.
    const canvasWidth = rects.reduce((sum, rect) => sum + rect.w, 0);
    // Morceaux à poser.
    const layers: Array<{ input: Buffer; left: number; top: number }> = [];

    // Position horizontale de la bande en cours dans la toile.
    let rectOffset = 0;
    // Pour chaque bande :
    for (const rect of rects) {
      // première colonne de tuiles Trek ;
      const txMin = Math.max(Math.floor(rect.x0 / 256), 0);
      // dernière colonne :
      const txMax = Math.min(
        // celle du dernier pixel de la bande,
        Math.floor((rect.x0 + rect.w - 1) / 256),
        // sans dépasser la grille.
        2 ** (z + 1) - 1,
      // Fin du calcul.
      );
      // Première ligne de tuiles Trek.
      const tyMin = Math.max(Math.floor(top / 256), 0);
      // Dernière ligne, sans dépasser la grille.
      const tyMax = Math.min(Math.floor((top + height - 1) / 256), 2 ** z - 1);

      // Pour chaque ligne de tuiles,
      for (let ty = tyMin; ty <= tyMax; ty += 1) {
        // et chaque colonne :
        for (let tx = txMin; tx <= txMax; tx += 1) {
          // tuile Trek, de la base ou téléchargée ;
          const source = await this.localTrekTile(z, tx, ty);
          // absente :
          if (!source) {
            // tuile suivante.
            continue;
          // Fin du cas.
          }

          // Bord gauche de la partie commune à la tuile et à la bande.
          const overlapX0 = Math.max(tx * 256, rect.x0);
          // Son bord droit.
          const overlapX1 = Math.min(tx * 256 + 256, rect.x0 + rect.w);
          // Son bord haut.
          const overlapY0 = Math.max(ty * 256, top);
          // Son bord bas.
          const overlapY1 = Math.min(ty * 256 + 256, top + height);
          // Sa largeur.
          const width = overlapX1 - overlapX0;
          // Sa hauteur.
          const h = overlapY1 - overlapY0;
          // Partie vide :
          if (width <= 0 || h <= 0) {
            // tuile suivante.
            continue;
          // Fin du cas.
          }

          // Morceau : la tuile Trek,
          const cropped = await sharp(source)
            // dont on découpe
            .extract({
              // à partir de ce bord gauche,
              left: overlapX0 - tx * 256,
              // et de ce bord haut,
              top: overlapY0 - ty * 256,
              // cette largeur,
              width,
              // et cette hauteur ;
              height: h,
            // fin de la découpe ;
            })
            // en JPEG, qualité 95 ;
            .jpeg({ quality: 95 })
            // ses octets.
            .toBuffer();

          // Ajoute le morceau, avec
          layers.push({
            // ses octets,
            input: cropped,
            // sa position horizontale dans la toile,
            left: rectOffset + (overlapX0 - rect.x0),
            // et sa position verticale.
            top: overlapY0 - top,
          // Fin de l'ajout.
          });
        // Fin des colonnes.
        }
      // Fin des lignes.
      }
      // Passe à la bande suivante.
      rectOffset += rect.w;
    // Fin des bandes.
    }

    // Aucun morceau :
    if (layers.length === 0) {
      // null.
      return null;
    // Fin du cas.
    }

    // Mosaïque : crée une image,
    const mosaic = await sharp({
      // avec
      create: {
        // la largeur de la toile,
        width: canvasWidth,
        // la hauteur de la zone,
        height,
        // trois canaux,
        channels: 3,
        // et un fond noir ;
        background: { r: 0, g: 0, b: 0 },
      // fin des réglages ;
      },
    // fin de la création ;
    })
      // y pose les morceaux ;
      .composite(layers)
      // l'encode en JPEG, qualité 95 ;
      .jpeg({ quality: 95 })
      // ses octets.
      .toBuffer();

    // Reprend la mosaïque,
    return sharp(mosaic)
      // la ramène à 256 × 256 pixels,
      .resize(256, 256, { fit: 'fill' })
      // l'encode en JPEG, qualité 85,
      .jpeg({ quality: 85 })
      // et renvoie les octets.
      .toBuffer();
  // Fin de compose.
  }

  /** Tuile Trek depuis PostgreSQL, avec repli amont (et stockage) si absente. */
  // Méthode privée localTrekTile ; ses paramètres :
  private async localTrekTile(
    // le niveau ;
    z: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie les octets de la tuile, ou null.
  ): Promise<Buffer | null> {
    // La cherche dans la base.
    const stored = await this.getTrek(z, x, y);
    // Trouvée :
    if (stored) {
      // renvoie ses octets.
      return stored.bytes;
    // Fin du cas.
    }
    // Sinon la télécharge.
    const fetched = await fetchTrekTile(z, x, y);
    // Si elle existe,
    if (fetched) {
      // la range dans la base.
      await this.putTrek(z, x, y, fetched);
    // Fin du cas.
    }
    // Renvoie les octets, ou null.
    return fetched;
  // Fin de localTrekTile.
  }

  // ------------------------------------------------------- stockage PostgreSQL

  // Méthode getTrek ; ses paramètres :
  async getTrek(
    // le niveau ;
    z: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie les octets et la date de la tuile, ou null.
  ): Promise<{ bytes: Buffer; fetchedAt: Date } | null> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // les octets et la date de la tuile Trek à ces coordonnées ;
      'SELECT bytes, fetched_at FROM trek_tiles WHERE z = $1 AND x = $2 AND y = $3',
      // ses trois valeurs.
      [z, x, y],
    // Fin de la requête.
    );
    // Aucune ligne :
    if (result.rowCount === 0) {
      // null.
      return null;
    // Fin du cas.
    }
    // Renvoie
    return {
      // les octets ;
      bytes: result.rows[0].bytes as Buffer,
      // la date.
      fetchedAt: new Date(result.rows[0].fetched_at),
    // Fin de l'objet.
    };
  // Fin de getTrek.
  }

  // Méthode putTrek : range une tuile Trek.
  async putTrek(z: number, x: number, y: number, bytes: Buffer): Promise<void> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    await pool.query(
      // ajoute la tuile avec ses coordonnées, ses octets et son empreinte ; si elle existe déjà, ne fait rien ;
      // ligne 2 du texte : les cinq valeurs, passées en paramètres ;
      // ligne 3 du texte : en cas de conflit sur le niveau, la colonne et la ligne, ne rien faire ;
      `INSERT INTO trek_tiles (z, x, y, bytes, sha256)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (z, x, y) DO NOTHING`,
      // ses cinq valeurs.
      [z, x, y, bytes, sha256Hex(bytes)],
    // Fin de la requête.
    );
  // Fin de putTrek.
  }

  // Méthode existingTrekKeys : les tuiles Trek déjà dans la base à un niveau.
  async existingTrekKeys(z: number): Promise<Set<string>> {
    // Base prête.
    const pool = await this.ready();
    // Requête : les colonnes et les lignes des tuiles de ce niveau.
    const result = await pool.query('SELECT x, y FROM trek_tiles WHERE z = $1', [z]);
    // Renvoie l'ensemble des clés « colonne:ligne ».
    return new Set(result.rows.map((row) => `${row.x}:${row.y}`));
  // Fin de existingTrekKeys.
  }

  // Méthode getTri ; son paramètre :
  async getTri(
    // l'identifiant.
    id: string,
  // Elle renvoie, ou null :
  ): Promise<{
    // le niveau ;
    level: number;
    // l'emprise ;
    bbox: number[];
    // les octets ;
    bytes: Buffer;
    // l'empreinte ;
    sha256: string;
    // le niveau Trek.
    sourceZoom: number;
  // Fin du type.
  } | null> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // ces cinq colonnes de la tuile triangulaire qui porte cet identifiant ;
      'SELECT level, bbox, bytes, sha256, source_zoom FROM tri_tiles WHERE id = $1',
      // sa valeur.
      [id],
    // Fin de la requête.
    );
    // Aucune ligne :
    if (result.rowCount === 0) {
      // null.
      return null;
    // Fin du cas.
    }
    // Première ligne du résultat.
    const row = result.rows[0];
    // Renvoie
    return {
      // le niveau ;
      level: row.level as number,
      // l'emprise ;
      bbox: row.bbox as number[],
      // les octets ;
      bytes: row.bytes as Buffer,
      // l'empreinte ;
      sha256: row.sha256 as string,
      // le niveau Trek.
      sourceZoom: row.source_zoom as number,
    // Fin de l'objet.
    };
  // Fin de getTri.
  }

  // Méthode putTri ; ses paramètres :
  async putTri(
    // l'identifiant ;
    id: string,
    // le niveau ;
    level: number,
    // l'emprise ;
    bbox: number[],
    // les octets ;
    bytes: Buffer,
    // le niveau Trek.
    sourceZoom: number,
  // Elle renvoie l'empreinte.
  ): Promise<string> {
    // Base prête.
    const pool = await this.ready();
    // Empreinte des octets.
    const sha = sha256Hex(bytes);
    // Requête :
    await pool.query(
      // ajoute la tuile triangulaire avec ses six valeurs ; si elle existe déjà, ne fait rien ;
      // ligne 2 du texte : les six valeurs, passées en paramètres ;
      // ligne 3 du texte : en cas de conflit sur l'identifiant, ne rien faire ;
      `INSERT INTO tri_tiles (id, level, bbox, bytes, sha256, source_zoom)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      // ses six valeurs.
      [id, level, bbox, bytes, sha, sourceZoom],
    // Fin de la requête.
    );
    // Renvoie l'empreinte.
    return sha;
  // Fin de putTri.
  }

  // Méthode countTrek : le nombre de tuiles Trek, à un niveau ou en tout.
  async countTrek(level?: number): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Résultat :
    const result =
      // sans niveau,
      level === undefined
        // le nombre de toutes les tuiles ;
        ? await pool.query('SELECT COUNT(*)::int AS n FROM trek_tiles')
        // sinon la requête
        : await pool.query(
            // qui compte celles de ce niveau,
            'SELECT COUNT(*)::int AS n FROM trek_tiles WHERE z = $1',
            // avec sa valeur.
            [level],
          // Fin de la requête.
          );
    // Renvoie le nombre.
    return result.rows[0].n as number;
  // Fin de countTrek.
  }

  // Méthode countTri : le nombre de tuiles triangulaires.
  async countTri(): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Requête : leur nombre.
    const result = await pool.query('SELECT COUNT(*)::int AS n FROM tri_tiles');
    // Le renvoie.
    return result.rows[0].n as number;
  // Fin de countTri.
  }

  // Méthode dbSizeBytes : la taille de la base, en octets.
  async dbSizeBytes(): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // la taille de la base courante.
      'SELECT pg_database_size(current_database())::bigint AS size',
    // Fin de la requête.
    );
    // La renvoie, en nombre.
    return Number(result.rows[0].size);
  // Fin de dbSizeBytes.
  }

  // ------------------------------------------------------- préchargement Trek

  /** Lance le téléchargement complet de la mosaïque Trek en arrière-plan. */
  // Méthode startPrefetch ; son paramètre, facultatif :
  startPrefetch(request: {
    // le premier niveau ;
    minLevel?: number;
    // le dernier niveau ;
    maxLevel?: number;
    // le nombre de téléchargements en même temps.
    concurrency?: number;
  // Elle renvoie l'état du préchargement.
  } = {}): PrefetchStatus {
    // Déjà en cours :
    if (this.prefetchStatus.running) {
      // erreur 400.
      throw new BadRequestException('Un téléchargement est déjà en cours.');
    // Fin du cas.
    }

    // Premier niveau : 0 par défaut.
    const minLevel = Math.trunc(request.minLevel ?? 0);
    // Dernier niveau : 6 par défaut.
    const maxLevel = Math.trunc(request.maxLevel ?? 6);
    // Téléchargements en même temps :
    const concurrency = Math.min(
      // 6 par défaut, au moins 1,
      Math.max(Math.trunc(request.concurrency ?? 6), 1),
      // 16 au plus.
      16,
    // Fin du calcul.
    );

    // Niveaux hors des bornes ou inversés :
    if (minLevel < 0 || maxLevel > TREK_MAX_ZOOM || minLevel > maxLevel) {
      // erreur 400,
      throw new BadRequestException(
        // avec les bornes.
        `Niveaux invalides : 0 à ${TREK_MAX_ZOOM}, minLevel <= maxLevel.`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Nouvel état :
    this.prefetchStatus = {
      // en cours ;
      running: true,
      // premier niveau ;
      minLevel,
      // dernier niveau ;
      maxLevel,
      // niveau en cours : le premier ;
      currentLevel: minLevel,
      // téléchargements en même temps ;
      concurrency,
      // aucune tuile téléchargée ;
      done: 0,
      // aucun échec ;
      failed: 0,
      // aucune tuile à télécharger pour l'instant ;
      total: 0,
      // heure de début ;
      startedAt: new Date().toISOString(),
      // pas d'heure de fin ;
      finishedAt: null,
      // pas d'erreur.
      lastError: null,
    // Fin de l'état.
    };

    // Lance le préchargement sans l'attendre ; s'il échoue :
    void this.runPrefetch().catch((error: unknown) => {
      // garde l'erreur,
      this.prefetchStatus.lastError =
        // son message ou son texte ;
        error instanceof Error ? error.message : String(error);
      // marque l'arrêt ;
      this.prefetchStatus.running = false;
      // l'écrit dans le journal,
      this.logger.error(
        // avec l'erreur.
        `Préchargement interrompu : ${this.prefetchStatus.lastError}`,
      // Fin de l'écriture.
      );
    // Fin du cas.
    });

    // Renvoie l'état.
    return this.prefetchStatus;
  // Fin de startPrefetch.
  }

  // Méthode privée runPrefetch.
  private async runPrefetch(): Promise<void> {
    // État du préchargement.
    const status = this.prefetchStatus;

    // Pour chaque niveau, tant que le préchargement tourne :
    for (let z = status.minLevel; z <= status.maxLevel && status.running; z += 1) {
      // note le niveau en cours ;
      status.currentLevel = z;
      // nombre de colonnes ;
      const columns = 2 ** (z + 1);
      // nombre de lignes.
      const rows = 2 ** z;

      // Tuiles déjà dans la base.
      const existing = await this.existingTrekKeys(z);
      // File des tuiles à télécharger.
      const queue: Array<[number, number]> = [];
      // Pour chaque ligne,
      for (let y = 0; y < rows; y += 1) {
        // et chaque colonne :
        for (let x = 0; x < columns; x += 1) {
          // si la tuile n'est pas dans la base,
          if (!existing.has(`${x}:${y}`)) {
            // l'ajoute à la file.
            queue.push([x, y]);
          // Fin du cas.
          }
        // Fin des colonnes.
        }
      // Fin des lignes.
      }

      // Nombre de tuiles à télécharger.
      status.total = queue.length;
      // Remet à zéro les tuiles téléchargées,
      status.done = 0;
      // et les échecs.
      status.failed = 0;
      // Écrit dans le journal
      this.logger.log(
        // le niveau et le nombre de tuiles.
        `Niveau ${z}/${TREK_MAX_ZOOM} : ${queue.length} tuile(s) à télécharger.`,
      // Fin de l'écriture.
      );

      // Rang de la prochaine tuile.
      let cursor = 0;
      // Fonction worker : un ouvrier.
      const worker = async (): Promise<void> => {
        // Tant que le préchargement tourne :
        while (status.running) {
          // prend le rang suivant ;
          const index = cursor;
          // avance le rang ;
          cursor += 1;
          // plus de tuile :
          if (index >= queue.length) {
            // fin.
            return;
          // Fin du cas.
          }
          // Colonne et ligne de la tuile.
          const [x, y] = queue[index];
          // La télécharge.
          const bytes = await fetchTrekTile(z, x, y);
          // Si elle existe :
          if (bytes) {
            // la range dans la base ;
            await this.putTrek(z, x, y, bytes);
            // une tuile de plus.
            status.done += 1;
          // Sinon :
          } else {
            // un échec de plus.
            status.failed += 1;
          // Fin du choix.
          }
        // Fin de la boucle.
        }
      // Fin de worker.
      };

      // Lance les ouvriers et attend leur fin.
      await Promise.all(Array.from({ length: status.concurrency }, worker));
    // Fin des niveaux.
    }

    // Marque l'arrêt.
    status.running = false;
    // Note l'heure de fin.
    status.finishedAt = new Date().toISOString();
    // Écrit dans le journal
    this.logger.log(
      // le bilan.
      `Préchargement terminé : ${status.done} tuile(s), ${status.failed} échec(s).`,
    // Fin de l'écriture.
    );
  // Fin de runPrefetch.
  }
// Fin du service.
}
