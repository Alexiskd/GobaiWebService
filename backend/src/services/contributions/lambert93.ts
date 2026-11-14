/**
 * Projection Lambert-93 (EPSG:2154, RGF93, ellipsoïde GRS80) : la projection légale de la France métropolitaine,
 * celle des fichiers LiDAR HD de l'IGN. Sert à placer une contribution sur le globe à partir des seules
 * coordonnées de son fichier LAS/LAZ, sans intervention de l'utilisateur.
 *
 * Formules : conique conforme de Lambert à deux parallèles (EPSG Guidance Note 7-2, § 1.3.1.1).
 * Vérification : le centre de la dalle `backend/data/lidar/paris-0652-6863` (652 500 ; 6 862 500) donne
 * 48,860782 N / 2,352570 E, soit le calage inscrit dans son manifeste à 5 mm près.
 *
 * Les altitudes LiDAR HD sont NGF-IGN69 (au-dessus du géoïde) et non ellipsoïdales : l'écart en France est
 * d'environ 44 à 50 m. Ce module ne le corrige pas, comme le reste du projet (voir lidar-anchor.ts), parce que
 * seule la position horizontale sert au placement sur la carte.
 */

/** Demi-grand axe de l'ellipsoïde GRS80 (m). */
const A = 6_378_137;
/** Aplatissement de GRS80 (celui de RGF93), très légèrement différent de WGS84. */
const F = 1 / 298.257222101;
/** Carré de la première excentricité. */
const E2 = F * (2 - F);
/** Première excentricité. */
const E = Math.sqrt(E2);
/** Degrés vers radians. */
const RAD = Math.PI / 180;

/** Latitude d'origine (46,5° N), en radians. */
const LAT0 = 46.5 * RAD;
/** Méridien central (3° E, Greenwich), en radians. */
const LON0 = 3 * RAD;
/** Premier parallèle automécoïque (44° N). */
const LAT1 = 44 * RAD;
/** Second parallèle automécoïque (49° N). */
const LAT2 = 49 * RAD;
/** Abscisse de l'origine (m). */
const X0 = 700_000;
/** Ordonnée de l'origine (m). */
const Y0 = 6_600_000;

/** Grande normale réduite : cos φ / √(1 − e² sin²φ). */
const m = (lat: number) => Math.cos(lat) / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
/** Fonction isométrique t(φ) de la conique conforme. */
const t = (lat: number) => Math.tan(Math.PI / 4 - lat / 2) / ((1 - E * Math.sin(lat)) / (1 + E * Math.sin(lat))) ** (E / 2);

/** Exposant de la conique (0,7256077650532701 pour Lambert-93). */
export const CONIC_N = Math.log(m(LAT1) / m(LAT2)) / Math.log(t(LAT1) / t(LAT2));
/** Constante de la conique. */
const CONIC_F = m(LAT1) / (CONIC_N * t(LAT1) ** CONIC_N);
/** Rayon polaire de la latitude d'origine. */
const R0 = A * CONIC_F * t(LAT0) ** CONIC_N;

/** Point en degrés WGS84 (lat, lon) ; l'altitude est traitée ailleurs. */
export interface LatLon { lat: number; lon: number }

/** Lambert-93 (m) → WGS84 (degrés). RGF93 et WGS84 sont confondus (écart centimétrique). */
export function lambert93ToWgs84(east: number, north: number): LatLon {
  // Écarts par rapport au pôle de la projection.
  const dx = east - X0;
  const dy = R0 - (north - Y0);
  // Rayon polaire du point, du signe de l'exposant.
  const r = Math.sign(CONIC_N) * Math.hypot(dx, dy);
  // Fonction isométrique du point.
  const ti = (r / (A * CONIC_F)) ** (1 / CONIC_N);
  // Longitude : l'angle polaire divisé par l'exposant, ramené au méridien central.
  const lon = Math.atan2(dx, dy) / CONIC_N + LON0;
  // Latitude : point fixe de φ = π/2 − 2·atan(t·((1 − e sinφ)/(1 + e sinφ))^(e/2)), convergent en quelques tours.
  let lat = Math.PI / 2 - 2 * Math.atan(ti);
  // Douze itérations : bien au-delà de la précision du millimètre.
  for (let i = 0; i < 12; i++) lat = Math.PI / 2 - 2 * Math.atan(ti * ((1 - E * Math.sin(lat)) / (1 + E * Math.sin(lat))) ** (E / 2));
  // Rend les degrés.
  return { lat: lat / RAD, lon: lon / RAD };
}

/** WGS84 (degrés) → Lambert-93 (m). Sert aux contrôles et à l'aller-retour des tests. */
export function wgs84ToLambert93(lat: number, lon: number): { east: number; north: number } {
  // Latitude et longitude en radians.
  const la = lat * RAD;
  const lo = lon * RAD;
  // Rayon polaire et angle polaire.
  const r = A * CONIC_F * t(la) ** CONIC_N;
  const th = CONIC_N * (lo - LON0);
  // Coordonnées projetées.
  return { east: X0 + r * Math.sin(th), north: Y0 + R0 - r * Math.cos(th) };
}

/**
 * Cap de l'axe +Y de la grille Lambert-93 par rapport au nord vrai, en degrés, sens horaire (convergence des
 * méridiens, négative à l'ouest du méridien 3° E). C'est le champ `heading` des nuages du projet.
 * Mesuré comme dans les manifestes existants : azimut vrai du point situé 100 m au nord dans la grille.
 */
export function gridNorthHeading(east: number, north: number): number {
  // Le point et son voisin 100 m au nord de la grille.
  const here = lambert93ToWgs84(east, north);
  const up = lambert93ToWgs84(east, north + 100);
  // Azimut vrai de l'un vers l'autre, longitude resserrée par le cosinus de la latitude.
  return Math.atan2((up.lon - here.lon) * RAD * Math.cos(here.lat * RAD), (up.lat - here.lat) * RAD) / RAD;
}

/** Emprise rectangulaire en coordonnées natives (m), telle qu'un en-tête LAS la déclare. */
export interface Bounds { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }

/** Côté d'une dalle du découpage LiDAR HD de l'IGN (m). */
export const IGN_TILE_METERS = 1000;

/** Une dalle du découpage LiDAR HD : ses deux numéros de kilomètre, son nom et son emprise Lambert-93. */
export interface IgnTile { x: number; y: number; id: string; bounds: { minX: number; minY: number; maxX: number; maxY: number } }

/**
 * Dalle LiDAR HD de l'IGN qui contient un point Lambert-93. Le découpage est kilométrique et une dalle porte le
 * numéro de son bord ouest et de son bord **nord** : la dalle de Beaubourg (652 000–653 000 ; 6 862 000–6 863 000)
 * s'appelle LHD_FXX_0652_6863. Le nom complet livré par l'IGN ajoute le millésime et le système altimétrique
 * (…_PTS_C_LAMB93_IGN69), qui ne se déduisent pas des coordonnées : seul le couple de numéros est rendu ici.
 */
export function ignTileAt(east: number, north: number): IgnTile {
  // Numéro de kilomètre du bord ouest.
  const x = Math.floor(east / IGN_TILE_METERS);
  // Numéro de kilomètre du bord nord.
  const y = Math.ceil(north / IGN_TILE_METERS);
  // Nom de la dalle : quatre chiffres pour chaque numéro.
  const id = `LHD_FXX_${String(x).padStart(4, '0')}_${String(y).padStart(4, '0')}`;
  // La dalle et son emprise.
  return {
    x,
    y,
    id,
    bounds: { minX: x * IGN_TILE_METERS, minY: (y - 1) * IGN_TILE_METERS, maxX: (x + 1) * IGN_TILE_METERS, maxY: y * IGN_TILE_METERS },
  };
}

/**
 * Les coordonnées tombent-elles dans l'emprise Lambert-93 de la France métropolitaine (Corse comprise) ?
 * Sert à reconnaître un fichier LiDAR HD dont l'en-tête ne déclare aucun système de coordonnées.
 */
export function inFranceLambert93(east: number, north: number): boolean {
  // Emprise large de la métropole, marge comprise.
  return east >= 60_000 && east <= 1_260_000 && north >= 6_000_000 && north <= 7_150_000;
}
