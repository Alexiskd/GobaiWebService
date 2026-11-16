/**
 * Cartes des satellites naturels (Jupiter, Saturne, Uranus, Neptune, Pluton) : sources candidates et calculs purs, testés à part.
 *
 * Ordre d'essai pour chaque satellite :
 *  1. adresse WMTS imposée par la variable d'environnement SATELLITE_TILES_<ID> (ex. SATELLITE_TILES_IO) ;
 *  2. NASA Solar System Treks (trek.nasa.gov/tiles/<Astre>/EQ/<produit>) : produits candidats vérifiés au démarrage
 *     sur leur fichier WMTSCapabilities.xml (les portails Io, Europe, Ganymède et Callisto sont absents de l'index
 *     public de l'API Trek : les noms viennent des mosaïques USGS que Trek republie) ;
 *  3. USGS Astrogeology (planetarymaps.usgs.gov, WMS « simp_cyl ») : couche choisie dans le GetCapabilities.
 * Le premier qui répond est gardé ; sans aucune source, le client affiche la sphère de couleur unie.
 *
 * Les géantes gazeuses (Jupiter, Saturne, Uranus, Neptune) n'ont pas de portail Solar System Treks :
 * seules les cartes de l'USGS sont essayées pour elles (champ `trek` vide).
 */

// Liste de tous les satellites connus de l'application.
import { ALL_SATELLITES } from '../data/bodies.data';

/** Identifiant d'un satellite ou d'une géante gazeuse (voir ALL_SATELLITES et SATELLITE_SOURCES). */
// Type SatelliteId : l'identifiant d'un astre, une chaîne.
export type SatelliteId = string;

// Forme de la fiche des sources d'un astre.
export interface SatelliteSourceSpec {
  // id : son identifiant.
  id: SatelliteId;
  // name : son nom affiché.
  name: string;
  /** Dossier de l'astre chez Trek (…/tiles/<trekBody>/EQ). */
  // trekBody : le nom de son dossier chez NASA Trek.
  trekBody: string;
  /** Produits Trek candidats, du plus probable au moins probable (vide : pas de portail Trek). */
  // trek : les produits Trek à essayer.
  trek: string[];
  /** Carte WMS de l'USGS (paramètre map=). */
  // usgsMap : sa carte chez l'USGS.
  usgsMap: string;
  /** Planète (géante gazeuse) plutôt que satellite. */
  // planet : vrai pour une géante gazeuse (facultatif).
  planet?: boolean;
  /** Système (planète mère) : regroupement dans le menu. */
  // system : la planète autour de laquelle il tourne (facultatif).
  system?: 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
// Fin de SatelliteSourceSpec.
}

/**
 * Portails Solar System Treks interrogés pour découvrir toutes les couches d'un astre (annuaire ArcGIS REST
 * trek.nasa.gov/<portail>/trekarcgis/rest/services/<dossier>?f=json). Un portail absent répond 404 : il est ignoré.
 */
// Fonction trekPortals : les portails Trek à interroger pour un astre.
export function trekPortals(spec: SatelliteSourceSpec): Array<{ portal: string; folder: string }> {
  // Nom du dossier en minuscules.
  const body = spec.trekBody.toLowerCase();
  // Deux portails toujours essayés : celui de l'astre et « icymoons ».
  const out = [{ portal: body, folder: body }, { portal: 'icymoons', folder: body }];
  // Si l'astre a un système autre que Pluton ou Mars, ajoute le portail de ce système.
  if (spec.system && spec.system !== 'pluto' && spec.system !== 'mars') out.push({ portal: spec.system, folder: body });
  // Renvoie la liste.
  return out;
// Fin de trekPortals.
}

/** Identifiant court et stable d'un produit Trek (sert dans l'id de couche et l'URL des tuiles). */
// Fonction productSlug : l'identifiant court d'un produit.
export const productSlug = (product: string) =>
  // Remplace ce qui n'est ni lettre ni chiffre par un tiret, retire les tirets du début et de la fin, passe en minuscules, coupe à 80 caractères.
  product.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);

/** Services ArcGIS qui ne sont pas des cartes (étiquettes, grilles, nomenclature) : écartés. */
// Fonction isMapService : vrai si le nom n'est pas celui d'un service d'étiquettes, de grille, de nomenclature, d'emprises ou de contours.
export const isMapService = (name: string) => !/nomen|label|grid|graticule|footprint|outline|boundar|annotation/i.test(name);

/** Libellé lisible d'un produit Trek : « Cassini_ISS_Global_Mosaic_250m » → « Cassini ISS Global Mosaic 250m ». */
// Fonction productLabel : remplace les « _ » par des espaces, réduit les espaces multiples et retire ceux des bords.
export const productLabel = (product: string) => product.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

// Fonction galilean : fabrique la fiche d'un satellite de Jupiter.
const galilean = (id: SatelliteId, name: string, trekBody: string, trek: string[]): SatelliteSourceSpec => ({
  // Les valeurs reçues, sa carte USGS dans le dossier de Jupiter, et le système « jupiter ».
  id, name, trekBody, trek, usgsMap: `/maps/jupiter/${id}_simp_cyl.map`, system: 'jupiter',
// Fin de galilean.
});
// Fonction saturnian : fabrique la fiche d'un satellite de Saturne.
const saturnian = (id: SatelliteId, name: string, trekBody: string, trek: string[]): SatelliteSourceSpec => ({
  // Les valeurs reçues, sa carte USGS dans le dossier de Saturne, et le système « saturn ».
  id, name, trekBody, trek, usgsMap: `/maps/saturn/${id}_simp_cyl.map`, system: 'saturn',
// Fin de saturnian.
});

// Liste des fiches de sources :
export const SATELLITE_SOURCES: SatelliteSourceSpec[] = [
  // Io, et ses produits Trek candidats :
  galilean('io', 'Io', 'Io', [
    // deux mosaïques Galileo et Voyager, à 1 km par pixel ;
    'Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km', 'Io_GalileoSSI_Voyager_Global_Mosaic_1km',
    // deux autres noms possibles de la même mosaïque.
    'Io_Voyager_GalileoSSI_Global_Mosaic_1km', 'Io_SSI_VGR_Mosaic_Global_1km',
  // Fin de Io.
  ]),
  // Europe, et ses produits :
  galilean('europa', 'Europe', 'Europa', [
    // deux écritures de la mosaïque à 500 m par pixel ;
    'Europa_Voyager_GalileoSSI_global_mosaic_500m', 'Europa_Voyager_GalileoSSI_Global_Mosaic_500m',
    // le même nom sans celui de l'astre.
    'Voyager_GalileoSSI_global_mosaic_500m',
  // Fin d'Europe.
  ]),
  // Ganymède, et ses produits :
  galilean('ganymede', 'Ganymède', 'Ganymede', [
    // la mosaïque en couleurs à 1 435 m, et une mosaïque à 1 km ;
    'Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m', 'Ganymede_Voyager_GalileoSSI_global_mosaic_1km',
    // une autre écriture de la mosaïque à 1 km.
    'Ganymede_Voyager_GalileoSSI_Global_Mosaic_1km',
  // Fin de Ganymède.
  ]),
  // Callisto, et ses produits :
  galilean('callisto', 'Callisto', 'Callisto', [
    // deux écritures de la mosaïque à 1 km.
    'Callisto_Voyager_GalileoSSI_global_mosaic_1km', 'Callisto_Voyager_GalileoSSI_Global_Mosaic_1km',
  // Fin de Callisto.
  ]),
  // Mimas : mosaïque Cassini à 250 m, sous deux noms.
  saturnian('mimas', 'Mimas', 'Mimas', ['Mimas_Cassini_ISS_Global_Mosaic_250m', 'Mimas_ISS_Global_Mosaic_250m']),
  // Encelade, et ses produits :
  saturnian('enceladus', 'Encelade', 'Enceladus', [
    // la mosaïque Cassini à 100 m, avec et sans le nom de l'astre.
    'Enceladus_Cassini_ISS_Global_Mosaic_100m_HPF', 'Cassini_ISS_Global_Mosaic_100m_HPF',
  // Fin d'Encelade.
  ]),
  // Téthys : mosaïque Cassini à 250 m, sous deux noms.
  saturnian('tethys', 'Téthys', 'Tethys', ['Tethys_Cassini_ISS_Global_Mosaic_250m', 'Tethys_ISS_Global_Mosaic_250m']),
  // Dioné : mosaïques Cassini à 154 m et à 250 m.
  saturnian('dione', 'Dioné', 'Dione', ['Dione_Cassini_ISS_Global_Mosaic_154m', 'Dione_Cassini_ISS_Global_Mosaic_250m']),
  // Rhéa : mosaïques Cassini à 417 m et à 250 m.
  saturnian('rhea', 'Rhéa', 'Rhea', ['Rhea_Cassini_ISS_Global_Mosaic_417m', 'Rhea_Cassini_ISS_Global_Mosaic_250m']),
  // Titan, et ses produits :
  saturnian('titan', 'Titan', 'Titan', [
    // la mosaïque ISS à 4 km sous deux noms, et la mosaïque radar à 351 m.
    'Titan_ISS_P19658_Mosaic_Global_4km', 'ISS_P19658_Mosaic_Global_4km', 'Titan_HiSAR_Global_Mosaic_351m',
  // Fin de Titan.
  ]),
  // Japet : mosaïques Cassini à 783 m et à 800 m.
  saturnian('iapetus', 'Japet', 'Iapetus', ['Iapetus_Cassini_ISS_Global_Mosaic_783m', 'Iapetus_Cassini_ISS_Global_Mosaic_800m']),
  // Uranus, Neptune, Pluton : pas de portail Trek ; mosaïques USGS (Voyager 2, New Horizons), partielles.
  // Les cinq satellites d'Uranus ; pour chacun :
  ...(['miranda', 'ariel', 'umbriel', 'titania', 'oberon'] as const).map((id) => ({
    // son identifiant, et son nom français pris dans une table ;
    id, name: { miranda: 'Miranda', ariel: 'Ariel', umbriel: 'Umbriel', titania: 'Titania', oberon: 'Obéron' }[id],
    // son dossier Trek (l'identifiant avec une majuscule), aucun produit Trek, sa carte USGS dans le dossier d'Uranus, le système « uranus ».
    trekBody: id[0].toUpperCase() + id.slice(1), trek: [], usgsMap: `/maps/uranus/${id}_simp_cyl.map`, system: 'uranus' as const,
  // Fin des satellites d'Uranus.
  })),
  // Triton : aucun produit Trek, carte USGS dans le dossier de Neptune.
  { id: 'triton', name: 'Triton', trekBody: 'Triton', trek: [], usgsMap: '/maps/neptune/triton_simp_cyl.map', system: 'neptune' },
  // Charon : aucun produit Trek, carte USGS dans le dossier de Pluton.
  { id: 'charon', name: 'Charon', trekBody: 'Charon', trek: [], usgsMap: '/maps/pluto/charon_simp_cyl.map', system: 'pluto' },
  // Géantes gazeuses : cartes globales de l'USGS (pas de portail Trek).
  // Jupiter : planète, carte USGS seulement.
  { id: 'jupiter', name: 'Jupiter', trekBody: 'Jupiter', trek: [], usgsMap: '/maps/jupiter/jupiter_simp_cyl.map', planet: true, system: 'jupiter' },
  // Saturne : planète, carte USGS seulement.
  { id: 'saturn', name: 'Saturne', trekBody: 'Saturn', trek: [], usgsMap: '/maps/saturn/saturn_simp_cyl.map', planet: true, system: 'saturn' },
  // Uranus : planète, carte USGS seulement.
  { id: 'uranus', name: 'Uranus', trekBody: 'Uranus', trek: [], usgsMap: '/maps/uranus/uranus_simp_cyl.map', planet: true, system: 'uranus' },
  // Neptune : planète, carte USGS seulement.
  { id: 'neptune', name: 'Neptune', trekBody: 'Neptune', trek: [], usgsMap: '/maps/neptune/neptune_simp_cyl.map', planet: true, system: 'neptune' },
// Fin de la liste.
];

// Candidats (Phobos, Hypérion, Nix…) : aucune carte connue d'avance, découverte Trek seule puis USGS.
// Pour chaque satellite connu de l'application :
for (const sat of ALL_SATELLITES) {
  // s'il a déjà une fiche, passe au suivant ;
  if (SATELLITE_SOURCES.some((s) => s.id === sat.id)) continue;
  // son dossier Trek : l'identifiant avec une majuscule ;
  const trekBody = sat.id[0].toUpperCase() + sat.id.slice(1);
  // ajoute sa fiche : aucun produit Trek, carte USGS dans le dossier de sa planète.
  SATELLITE_SOURCES.push({ id: sat.id, name: sat.name, trekBody, trek: [], usgsMap: `/maps/${sat.parent}/${sat.id}_simp_cyl.map`, system: sat.parent });
// Fin de la boucle.
}

// Table qui donne la fiche d'un astre à partir de son identifiant.
export const SATELLITE_SOURCE_BY_ID = new Map(SATELLITE_SOURCES.map((s) => [s.id, s]));

/** Découpage commun à tous les astres en plate carrée : 2^(z+1) colonnes × 2^z lignes. */
// Fonction satCols : nombre de colonnes de tuiles au niveau z, soit 2^(z+1).
export const satCols = (z: number) => 2 ** (z + 1);
// Fonction satRows : nombre de lignes de tuiles au niveau z, soit 2^z.
export const satRows = (z: number) => 2 ** z;
// Fonction isSatTile : la tuile existe-t-elle ?
export const isSatTile = (z: number, x: number, y: number) =>
  // Oui si les trois valeurs sont entières, le niveau entre 0 et 12,
  Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 0 && z <= 12
  // et la colonne et la ligne dans la grille.
  && x >= 0 && y >= 0 && x < satCols(z) && y < satRows(z);

/** Emprise d'une tuile (degrés) : ouest, sud, est, nord. */
// Fonction satTileBounds : l'emprise d'une tuile, en degrés.
export function satTileBounds(z: number, x: number, y: number) {
  // Côté d'une tuile, en degrés.
  const deg = 180 / 2 ** z;
  // Bord ouest.
  const west = -180 + x * deg;
  // Bord nord.
  const north = 90 - y * deg;
  // Renvoie l'ouest, le sud, l'est et le nord.
  return { west, south: north - deg, east: west + deg, north };
// Fin de satTileBounds.
}

// Forme des niveaux d'un jeu de tuiles WMTS.
export interface TrekMatrixInfo {
  // matrixSet : le nom du jeu de tuiles.
  matrixSet: string;
  /** Niveau z (découpage commun) → identifiant de matrice WMTS. */
  // levels : pour chaque niveau z, le nom de sa matrice.
  levels: Map<number, string>;
  // maxZoom : le niveau le plus fin.
  maxZoom: number;
  // extension : jpg ou png.
  extension: 'jpg' | 'png';
// Fin de TrekMatrixInfo.
}

/**
 * Lit les niveaux d'un jeu de tuiles WMTS plate carrée : garde les matrices dont la taille correspond au découpage
 * commun (2^(z+1) × 2^z tuiles), quel que soit leur nom ou leur numéro.
 */
// Fonction trekMatrixInfo ; ses paramètres :
export function trekMatrixInfo(
  // les jeux de tuiles, chacun avec ses matrices (nom, largeur et hauteur en tuiles) ;
  sets: Array<{ id: string; matrices: Array<{ id: string; matrixWidth: number | null; matrixHeight: number | null }> }>,
  // le modèle d'adresse des tuiles, ou null.
  resourceUrlTemplate: string | null,
// Elle renvoie les niveaux retenus, ou null.
): TrekMatrixInfo | null {
  // Meilleur jeu trouvé : aucun au départ.
  let best: TrekMatrixInfo | null = null;
  // Pour chaque jeu de tuiles :
  for (const set of sets) {
    // ses niveaux retenus ;
    const levels = new Map<number, string>();
    // pour chaque matrice :
    for (const m of set.matrices) {
      // passe celles sans taille, ou dont la largeur n'est pas le double de la hauteur ;
      if (!m.matrixWidth || !m.matrixHeight || m.matrixWidth !== 2 * m.matrixHeight) continue;
      // son niveau : le logarithme en base 2 de sa hauteur ;
      const z = Math.log2(m.matrixHeight);
      // s'il est entier et pas encore pris, le retient.
      if (Number.isInteger(z) && !levels.has(z)) levels.set(z, m.id);
    // Fin de la boucle des matrices.
    }
    // Pas de niveau 0 : jeu écarté.
    if (!levels.has(0)) continue;
    // Niveau le plus fin : part de 0,
    let maxZoom = 0;
    // et monte tant que le niveau suivant existe (on s'arrête au premier trou).
    while (levels.has(maxZoom + 1)) maxZoom++;
    // Si c'est le premier jeu, ou s'il va plus loin que le meilleur :
    if (!best || maxZoom > best.maxZoom) {
      // il devient le meilleur ; l'extension est png si le modèle d'adresse contient « .png », sinon jpg.
      best = { matrixSet: set.id, levels, maxZoom, extension: /\.png\b/i.test(resourceUrlTemplate ?? '') ? 'png' : 'jpg' };
    // Fin du cas.
    }
  // Fin de la boucle des jeux.
  }
  // Sans modèle d'adresse : extension jpg.
  if (best && !resourceUrlTemplate) best.extension = 'jpg';
  // Renvoie le meilleur jeu, ou null.
  return best;
// Fin de trekMatrixInfo.
}

/** Couche WMS de l'USGS à afficher : une mosaïque d'images, pas une grille ni une nomenclature. */
// Fonction pickUsgsLayer : le nom de la couche à afficher, ou null.
export function pickUsgsLayer(layers: Array<{ name: string; title: string }>): string | null {
  // Garde les couches nommées qui ne sont ni grille, ni nomenclature, ni étiquettes, ni contours.
  const usable = layers.filter((l) => l.name && !/grid|nomen|label|feature|outline|boundar|graticule/i.test(`${l.name} ${l.title}`));
  // Parmi elles, cherche une mosaïque, une carte globale, un fond ou une carte en couleurs.
  const preferred = usable.find((l) => /mosaic|global|basemap|clr|color/i.test(`${l.name} ${l.title}`));
  // Renvoie son nom, sinon celui de la première couche gardée, sinon null.
  return (preferred ?? usable[0])?.name ?? null;
// Fin de pickUsgsLayer.
}

/**
 * Paramètres GetMap WMS 1.1.1 d'une tuile. `lon360` : la carte est en longitudes 0..360 (ouest de la tuile
 * décalé de +360 pour l'hémisphère ouest ; une tuile ne chevauche jamais le méridien 0).
 */
// Fonction usgsGetMapQuery : les paramètres de la requête d'une tuile ; taille de 256 pixels par défaut.
export function usgsGetMapQuery(map: string, layer: string, srs: string, z: number, x: number, y: number, lon360: boolean, size = 256): string {
  // Emprise de la tuile.
  const b = satTileBounds(z, x, y);
  // Décalage : 360° si la carte est en 0..360 et que la tuile est à l'ouest, sinon 0.
  const shift = lon360 && b.west < 0 ? 360 : 0;
  // Construit les paramètres :
  const params = new URLSearchParams({
    // la carte, le service WMS, sa version, la requête GetMap, la couche, aucun style ;
    map, SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: layer, STYLES: '',
    // la projection, et l'emprise décalée : ouest, sud, est, nord ;
    SRS: srs, BBOX: [b.west + shift, b.south, b.east + shift, b.north].join(','),
    // la largeur, la hauteur, et le format JPEG.
    WIDTH: String(size), HEIGHT: String(size), FORMAT: 'image/jpeg',
  // Fin des paramètres.
  });
  // Les renvoie sous forme de texte.
  return params.toString();
// Fin de usgsGetMapQuery.
}
