/**
 * Calage GPS d'un nuage LiDAR (usage interne, non exposé à l'utilisateur).
 *
 * Principe : une coordonnée GPS (WGS84) est posée sur le point d'ancrage du nuage, c'est-à-dire le centre de son
 * emprise horizontale, en bas de la projection (Z minimal) :
 *   ancrage natif = ((minX + maxX) / 2, (minY + maxY) / 2, minZ)  ⟷  (lat, lon, alt)
 * Les autres points s'en déduisent dans le repère local Est-Nord-Haut (ENU) de l'ancrage, puis en WGS84 exact
 * (ellipsoïde, pas de sphère). Les coordonnées natives sont supposées métriques (X = est, Y = nord, Z = haut,
 * comme un relevé ou un CRS projeté) ; `heading` corrige un nuage dont l'axe +Y ne pointe pas vers le nord vrai.
 *
 * Le calage est stocké à côté des nuages : POINTCLOUD_DIR/anchors/<nom>.json, écrit par
 *   npm run pointcloud:anchor -- <nom> <lat> <lon> [alt] [cap]
 * Aucune route HTTP n'écrit ce fichier.
 */
// Fonctions de fichiers asynchrones : créer un dossier, lire, supprimer, écrire.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';

// Forme de l'emprise d'un nuage : minimum et maximum sur X, Y et Z.
export interface PointCloudBounds { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
// Forme d'un point ou d'un vecteur à trois coordonnées.
export interface Vec3 { x: number; y: number; z: number }

/** Coordonnée GPS posée sur le point d'ancrage du nuage. */
// Forme d'un calage GPS.
export interface LidarAnchor {
  /** Latitude WGS84, degrés. */
  // lat : latitude.
  lat: number;
  /** Longitude WGS84, degrés. */
  // lon : longitude.
  lon: number;
  /** Altitude ellipsoïdale du bas du nuage, mètres (0 par défaut). */
  // alt : altitude du bas du nuage.
  alt: number;
  /** Angle de l'axe +Y du nuage par rapport au nord vrai, degrés, sens horaire (0 = +Y au nord). */
  // heading : cap de l'axe +Y du nuage.
  heading: number;
// Fin de LidarAnchor.
}

// Forme d'une position GPS : latitude, longitude, altitude.
export interface Geodetic { lat: number; lon: number; alt: number }

// Demi-grand axe de l'ellipsoïde WGS84 : le rayon de la Terre à l'équateur, en mètres.
const WGS84_A = 6_378_137;
// Aplatissement de l'ellipsoïde WGS84.
const WGS84_F = 1 / 298.257223563;
// Carré de l'excentricité, tiré de l'aplatissement : f × (2 − f).
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
// Facteur de conversion des degrés en radians.
const RAD = Math.PI / 180;

/** Point d'ancrage natif : centre de l'emprise horizontale, au bas du nuage (Z minimal). */
// Fonction anchorPoint : le point du nuage sur lequel la coordonnée GPS est posée.
export function anchorPoint(b: PointCloudBounds): Vec3 {
  // Milieu en X, milieu en Y, et Z le plus bas.
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: b.minZ };
// Fin de anchorPoint.
}

/** Valide et normalise un calage (lat ∈ [-90, 90], lon ramenée dans [-180, 180[, cap dans [0, 360[). */
// Fonction normalizeAnchor : vérifie un calage et le met sous forme propre.
export function normalizeAnchor(raw: Partial<LidarAnchor>): LidarAnchor {
  // Latitude et longitude converties en nombres.
  const lat = Number(raw.lat), lon = Number(raw.lon);
  // Altitude : 0 si elle est absente.
  const alt = raw.alt === undefined ? 0 : Number(raw.alt);
  // Cap : 0 s'il est absent.
  const heading = raw.heading === undefined ? 0 : Number(raw.heading);
  // Latitude non numérique ou hors de −90…90 : erreur.
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`Latitude invalide : ${raw.lat}`);
  // Longitude non numérique : erreur.
  if (!Number.isFinite(lon)) throw new Error(`Longitude invalide : ${raw.lon}`);
  // Altitude non numérique ou au-delà de 100 km : erreur.
  if (!Number.isFinite(alt) || Math.abs(alt) > 100_000) throw new Error(`Altitude invalide : ${raw.alt}`);
  // Cap non numérique : erreur.
  if (!Number.isFinite(heading)) throw new Error(`Cap invalide : ${raw.heading}`);
  // Renvoie le calage, la longitude ramenée entre −180 et 180 et le cap entre 0 et 360 ; les doubles « modulo » gèrent les valeurs négatives.
  return { lat, lon: ((((lon + 180) % 360) + 360) % 360) - 180, alt, heading: ((heading % 360) + 360) % 360 };
// Fin de normalizeAnchor.
}

/** Décalage natif par rapport à l'ancrage → Est, Nord, Haut (mètres), cap appliqué. */
// Fonction nativeToEnu : décalage d'un point par rapport à l'ancrage, en Est, Nord, Haut.
export function nativeToEnu(p: Vec3, bounds: PointCloudBounds, heading = 0): Vec3 {
  // Point d'ancrage.
  const o = anchorPoint(bounds);
  // Décalage en X et en Y.
  const dx = p.x - o.x, dy = p.y - o.y;
  // Cap en radians, son cosinus et son sinus.
  const t = heading * RAD, c = Math.cos(t), s = Math.sin(t);
  // Rotation du décalage horizontal par le cap ; le décalage vertical est gardé tel quel.
  return { x: dx * c + dy * s, y: -dx * s + dy * c, z: p.z - o.z };
// Fin de nativeToEnu.
}

// Fonction geodeticToEcef : position GPS → coordonnées cartésiennes centrées sur la Terre.
export function geodeticToEcef({ lat, lon, alt }: Geodetic): Vec3 {
  // Latitude et longitude en radians.
  const la = lat * RAD, lo = lon * RAD;
  // Sinus et cosinus de la latitude.
  const sl = Math.sin(la), cl = Math.cos(la);
  // Rayon de courbure de l'ellipsoïde à cette latitude.
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
  // Les trois coordonnées ; le terme (1 − e²) tient compte de l'aplatissement aux pôles.
  return { x: (n + alt) * cl * Math.cos(lo), y: (n + alt) * cl * Math.sin(lo), z: (n * (1 - WGS84_E2) + alt) * sl };
// Fin de geodeticToEcef.
}

/** ECEF → WGS84 (itération de Bowring, précision sub-millimétrique). */
// Fonction ecefToGeodetic : coordonnées cartésiennes → position GPS.
export function ecefToGeodetic({ x, y, z }: Vec3): Geodetic {
  // Longitude : l'angle dans le plan de l'équateur.
  const lon = Math.atan2(y, x);
  // Distance à l'axe de rotation de la Terre.
  const p = Math.hypot(x, y);
  // Première estimation de la latitude.
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  // Altitude, à zéro au départ.
  let alt = 0;
  // Huit tours d'affinage :
  for (let i = 0; i < 8; i++) {
    // sinus de la latitude estimée ;
    const sl = Math.sin(lat);
    // rayon de courbure à cette latitude ;
    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
    // altitude : calculée par le cosinus, ou par le sinus près des pôles où le cosinus est presque nul ;
    alt = Math.abs(Math.cos(lat)) > 1e-12 ? p / Math.cos(lat) - n : Math.abs(z) / Math.abs(sl) - n * (1 - WGS84_E2);
    // latitude corrigée avec cette altitude.
    lat = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + alt)));
  // Fin de la boucle.
  }
  // Renvoie la position, les angles reconvertis en degrés.
  return { lat: lat / RAD, lon: lon / RAD, alt };
// Fin de ecefToGeodetic.
}

/** ENU (mètres autour de l'ancrage GPS) → WGS84. */
// Fonction enuToGeodetic : décalage Est-Nord-Haut autour d'un point GPS → position GPS.
export function enuToGeodetic(enu: Vec3, anchor: Geodetic): Geodetic {
  // Latitude et longitude de l'ancrage en radians.
  const la = anchor.lat * RAD, lo = anchor.lon * RAD;
  // Leurs sinus et cosinus.
  const sla = Math.sin(la), cla = Math.cos(la), slo = Math.sin(lo), clo = Math.cos(lo);
  // Position cartésienne de l'ancrage.
  const o = geodeticToEcef(anchor);
  // Les trois composantes du décalage : est, nord, haut.
  const { x: e, y: n, z: u } = enu;
  // Convertit en position GPS le point cartésien obtenu :
  return ecefToGeodetic({
    // x : l'ancrage plus le décalage tourné vers le repère de la Terre ;
    x: o.x - slo * e - sla * clo * n + cla * clo * u,
    // y, de même ;
    y: o.y + clo * e - sla * slo * n + cla * slo * u,
    // z, de même (l'est ne change pas z).
    z: o.z + cla * n + sla * u,
  // Fin de l'appel.
  });
// Fin de enuToGeodetic.
}

/** Position GPS d'un point natif du nuage, une fois l'ancrage posé sur la coordonnée GPS. */
// Fonction placeLidarPoint : position GPS d'un point du nuage.
export function placeLidarPoint(p: Vec3, bounds: PointCloudBounds, anchor: LidarAnchor): Geodetic {
  // Décalage du point en Est-Nord-Haut, puis conversion en GPS autour de l'ancrage.
  return enuToGeodetic(nativeToEnu(p, bounds, anchor.heading), anchor);
// Fin de placeLidarPoint.
}

/** Les quatre coins du bas de l'emprise, en WGS84 (contrôle visuel du calage). */
// Fonction placedFootprint : les quatre coins du bas de l'emprise, en GPS.
export function placedFootprint(bounds: PointCloudBounds, anchor: LidarAnchor): Geodetic[] {
  // Les bornes utiles de l'emprise.
  const { minX, minY, maxX, maxY, minZ } = bounds;
  // Les quatre coins, dans l'ordre du tour de l'emprise,
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
    // chacun placé à l'altitude la plus basse.
    .map(([x, y]) => placeLidarPoint({ x, y, z: minZ }, bounds, anchor));
// Fin de placedFootprint.
}

// --- Stockage : POINTCLOUD_DIR/anchors/<nom>.json -------------------------------------------------------------

// Fonction anchorsDir : le dossier des calages, « anchors » dans le dossier des nuages.
export const anchorsDir = (cloudDir: string) => join(cloudDir, 'anchors');
// Fonction anchorFile : le fichier de calage d'un nuage, <nom>.json.
const anchorFile = (cloudDir: string, name: string) => join(anchorsDir(cloudDir), `${name}.json`);

/** Calage écrit à l'exécution pour ce nuage, ou null (absent ou illisible). `name` doit déjà être validé. */
// Fonction readAnchor : lit le calage d'un nuage.
export async function readAnchor(cloudDir: string, name: string): Promise<LidarAnchor | null> {
  // Essaie
  try {
    // de lire le fichier, de l'analyser et de le vérifier ;
    return normalizeAnchor(JSON.parse(await readFile(anchorFile(cloudDir, name), 'utf8')));
  // fichier absent ou illisible :
  } catch {
    // null.
    return null;
  // Fin du cas.
  }
// Fin de readAnchor.
}

// --- Tuiles enregistrées dans le code source : backend/data/pointclouds.json ---------------------------------

// Forme d'une tuile enregistrée dans le code source.
export interface RegisteredTile {
  // name : son nom de fichier.
  name: string;
  // crs : son système de coordonnées.
  crs?: string;
  // version : la version du format LAS.
  version?: string;
  // pointFormat : le format des points.
  pointFormat?: number;
  // pointCount : le nombre de points.
  pointCount?: string;
  // bounds : son emprise.
  bounds: PointCloudBounds;
  // anchor : son calage GPS.
  anchor?: LidarAnchor;
// Fin de RegisteredTile.
}

/** backend/data/pointclouds.json (même chemin depuis src/ et dist/). */
// Chemin de backend/data/pointclouds.json, calculé depuis l'emplacement de ce fichier.
export const REGISTRY_FILE = join(__dirname, '..', '..', '..', 'data', 'pointclouds.json');

/** Tuiles versionnées avec le code : emprise native et calage GPS, même sans le fichier LAS/LAZ sur le serveur. */
// Fonction readRegistry : lit les tuiles enregistrées ; fichier par défaut : celui du projet.
export async function readRegistry(file = REGISTRY_FILE): Promise<RegisteredTile[]> {
  // Essaie
  try {
    // de lire et d'analyser le fichier ;
    const data = JSON.parse(await readFile(file, 'utf8')) as { tiles?: RegisteredTile[] };
    // garde les tuiles qui ont un nom et une emprise,
    return (data.tiles ?? []).filter((t) => t && typeof t.name === 'string' && t.bounds)
      // et vérifie le calage de chacune, s'il existe.
      .map((t) => ({ ...t, anchor: t.anchor ? normalizeAnchor(t.anchor) : undefined }));
  // Fichier absent ou illisible :
  } catch {
    // aucune tuile.
    return [];
  // Fin du cas.
  }
// Fin de readRegistry.
}

// Fonction writeAnchor : écrit le calage d'un nuage et renvoie le chemin du fichier.
export async function writeAnchor(cloudDir: string, name: string, anchor: LidarAnchor): Promise<string> {
  // Crée le dossier des calages s'il n'existe pas.
  await mkdir(anchorsDir(cloudDir), { recursive: true });
  // Chemin du fichier.
  const path = anchorFile(cloudDir, name);
  // Écrit le calage vérifié, en JSON indenté, terminé par un retour à la ligne.
  await writeFile(path, `${JSON.stringify(normalizeAnchor(anchor), null, 2)}\n`, 'utf8');
  // Renvoie le chemin.
  return path;
// Fin de writeAnchor.
}

// Fonction removeAnchor : supprime le calage d'un nuage.
export async function removeAnchor(cloudDir: string, name: string): Promise<void> {
  // Supprime le fichier ; force : pas d'erreur s'il n'existe pas.
  await rm(anchorFile(cloudDir, name), { force: true });
// Fin de removeAnchor.
}
