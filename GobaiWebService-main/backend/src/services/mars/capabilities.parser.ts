// Ouvre l'import de quatre types (effacés à la compilation) :
import type {
  // une emprise ;
  BBox,
  // une couche lue dans les capacités ;
  CapabilitiesLayerSummary,
  // le résumé d'un jeu de tuiles ;
  WmtsTileMatrixSetSummary,
  // le résumé d'une matrice de tuiles.
  WmtsTileMatrixSummary,
// Fin de l'import.
} from './mars.types';

// Classe CapabilitiesParseError : l'erreur de lecture d'un document de capacités.
export class CapabilitiesParseError extends Error {
  // Constructeur : le message.
  constructor(message: string) {
    // Le passe à Error.
    super(message);
    // Fixe le nom de l'erreur.
    this.name = 'CapabilitiesParseError';
  // Fin du constructeur.
  }
// Fin de la classe.
}

// Forme des capacités lues.
export interface ParsedCapabilities {
  // version : la version du service.
  version: string | null;
  // serviceTitle : son titre.
  serviceTitle: string | null;
  // formats : les formats.
  formats: string[];
  // crs : les projections.
  crs: string[];
  // bbox : l'emprise.
  bbox: BBox | null;
  // layers : les couches.
  layers: CapabilitiesLayerSummary[];
  // tileMatrixSets : les jeux de tuiles.
  tileMatrixSets: WmtsTileMatrixSetSummary[];
  // resourceUrlTemplate : le modèle d'adresse des tuiles.
  resourceUrlTemplate: string | null;
// Fin de ParsedCapabilities.
}

// Forme d'un bloc XML.
interface XmlBlock {
  // attrs : le texte de ses attributs.
  attrs: string;
  // inner : son contenu.
  inner: string;
// Fin de XmlBlock.
}

// Les cinq entités XML de base :
const XML_ENTITIES: Record<string, string> = {
  // amp : « & » ;
  amp: '&',
  // lt : « < » ;
  lt: '<',
  // gt : « > » ;
  gt: '>',
  // quot : le guillemet double ;
  quot: '"',
  // apos : l'apostrophe.
  apos: "'",
// Fin de la table.
};

// Nombre maximal de couches listées : 500.
const MAX_LISTED_LAYERS = 500;
// Nombre maximal de projections listées : 32.
const MAX_LISTED_CRS = 32;
// Nombre maximal de formats listés : 16.
const MAX_LISTED_FORMATS = 16;
// Nombre maximal de jeux de tuiles : 12.
const MAX_TILE_MATRIX_SETS = 12;
// Nombre maximal de matrices par jeu : 30.
const MAX_TILE_MATRICES = 30;

// Fonction parseCapabilities : lit un document de capacités WMS ou WMTS.
export function parseCapabilities(xml: string): ParsedCapabilities {
  // Document vide :
  if (!xml || xml.trim().length === 0) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'Le service amont a renvoyé un document vide.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Retire les commentaires XML.
  xml = xml.replace(/<!--[\s\S]*?-->/g, '');

  // Début du document, sans espaces et en minuscules.
  const head = xml.slice(0, 1024).trimStart().toLowerCase();
  // Si c'est du HTML :
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'Le service amont a renvoyé du HTML au lieu d’un document OGC XML.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Si le document porte une balise ServiceException :
  if (/<(?:(?:[\w.-]+):)?ServiceException\b/i.test(xml)) {
    // son texte ;
    const detail = firstText(xml, 'ServiceException');
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // selon qu'il y a un texte :
      detail
        // avec ce texte,
        ? `Le service amont a renvoyé une exception OGC : ${detail}`
        // ou sans.
        : 'Le service amont a renvoyé une exception OGC.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Si le document
  if (
    // n'a aucune des trois balises racines attendues
    !/<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b/i.test(
      // (cherchées dans le document) ;
      xml,
    // fin de la recherche ;
    )
  // alors :
  ) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'La réponse amont ne ressemble pas à un document GetCapabilities OGC.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Renvoie
  return {
    // la version ;
    version: parseVersion(xml),
    // le titre du service ;
    serviceTitle: parseServiceTitle(xml),
    // les formats, sans doublons, 16 au plus ;
    formats: dedupe(collectTexts(xml, 'Format')).slice(0, MAX_LISTED_FORMATS),
    // les projections ;
    crs: collectCrs(xml),
    // l'emprise ;
    bbox: parseBBox(xml),
    // les couches ;
    layers: parseLayers(xml),
    // les jeux de tuiles ;
    tileMatrixSets: parseTileMatrixSets(xml),
    // le modèle d'adresse des tuiles.
    resourceUrlTemplate: parseResourceUrlTemplate(xml),
  // Fin de l'objet.
  };
// Fin de parseCapabilities.
}

// Fonction parseVersion.
function parseVersion(xml: string): string | null {
  // Balise racine,
  const root =
    // cherchée avec ses attributs
    /<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b([^>]*)>/i.exec(
      // dans le document.
      xml,
    // Fin de la recherche.
    );
  // Renvoie son attribut « version », ou null.
  return root ? readAttr(root[1], 'version') : null;
// Fin de parseVersion.
}

// Fonction parseServiceTitle.
function parseServiceTitle(xml: string): string | null {
  // Bloc du service :
  const block =
    // ServiceIdentification (WMTS),
    findBlocks(xml, 'ServiceIdentification')[0] ??
    // sinon Service (WMS).
    findBlocks(xml, 'Service')[0];
  // Renvoie son titre, ou null.
  return block ? firstText(block.inner, 'Title') : null;
// Fin de parseServiceTitle.
}

// Fonction collectCrs.
function collectCrs(xml: string): string[] {
  // Valeurs réunies :
  const values = [
    // celles des balises CRS,
    ...collectTexts(xml, 'CRS'),
    // SRS,
    ...collectTexts(xml, 'SRS'),
    // et SupportedCRS ;
    ...collectTexts(xml, 'SupportedCRS'),
  // fin de la liste ;
  ]
    // coupées aux espaces,
    .flatMap((value) => value.split(/\s+/))
    // sans espaces aux bords,
    .map((value) => value.trim())
    // sans valeurs vides.
    .filter((value) => value.length > 0);

  // Renvoie les valeurs sans doublons, 32 au plus.
  return [...new Set(values)].slice(0, MAX_LISTED_CRS);
// Fin de collectCrs.
}

// Fonction parseBBox.
function parseBBox(xml: string): BBox | null {
  // Premier essai : le bloc EX_GeographicBoundingBox (WMS 1.3.0).
  const geographic = findBlocks(xml, 'EX_GeographicBoundingBox')[0];
  // S'il existe :
  if (geographic) {
    // bord ouest ;
    const west = readNumber(firstText(geographic.inner, 'westBoundLongitude'));
    // bord sud ;
    const south = readNumber(firstText(geographic.inner, 'southBoundLatitude'));
    // bord est ;
    const east = readNumber(firstText(geographic.inner, 'eastBoundLongitude'));
    // bord nord.
    const north = readNumber(firstText(geographic.inner, 'northBoundLatitude'));

    // Si les quatre sont lus,
    if (west !== null && south !== null && east !== null && north !== null) {
      // renvoie l'emprise.
      return { west, south, east, north };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Deuxième essai : le bloc LatLonBoundingBox (WMS 1.1.1).
  const latLon = findBlocks(xml, 'LatLonBoundingBox')[0];
  // S'il existe :
  if (latLon) {
    // bord ouest, lu dans l'attribut minx ;
    const west = readNumber(readAttr(latLon.attrs, 'minx'));
    // bord sud, dans miny ;
    const south = readNumber(readAttr(latLon.attrs, 'miny'));
    // bord est, dans maxx ;
    const east = readNumber(readAttr(latLon.attrs, 'maxx'));
    // bord nord, dans maxy.
    const north = readNumber(readAttr(latLon.attrs, 'maxy'));

    // Si les quatre sont lus,
    if (west !== null && south !== null && east !== null && north !== null) {
      // renvoie l'emprise.
      return { west, south, east, north };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Troisième essai : le bloc WGS84BoundingBox (WMTS).
  const wgs84 = findBlocks(xml, 'WGS84BoundingBox')[0];
  // S'il existe :
  if (wgs84) {
    // coin bas gauche ;
    const lower = readNumbers(firstText(wgs84.inner, 'LowerCorner'));
    // coin haut droit.
    const upper = readNumbers(firstText(wgs84.inner, 'UpperCorner'));

    // Si chacun a deux nombres,
    if (lower.length >= 2 && upper.length >= 2) {
      // renvoie
      return {
        // l'ouest ;
        west: lower[0],
        // le sud ;
        south: lower[1],
        // l'est ;
        east: upper[0],
        // le nord.
        north: upper[1],
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Aucune emprise : null.
  return null;
// Fin de parseBBox.
}

// Fonction parseLayers.
function parseLayers(xml: string): CapabilitiesLayerSummary[] {
  // Toutes les balises ouvrantes Layer ;
  const starts = [...xml.matchAll(/<(?:(?:[\w.-]+):)?Layer\b[^>]*>/gi)].map(
    // pour chacune, on garde :
    (match) => ({
      // sa position ;
      index: match.index,
      // la position de sa fin.
      end: (match.index ?? 0) + match[0].length,
    // Fin de l'objet.
    }),
  // Fin de la liste.
  );

  // Couches retenues.
  const layers: CapabilitiesLayerSummary[] = [];
  // Noms déjà vus.
  const seen = new Set<string>();

  // Pour chaque balise Layer :
  for (let index = 0; index < starts.length; index += 1) {
    // la balise ;
    const start = starts[index];
    // fin de son segment :
    const end =
      // le début de la balise Layer suivante, ou la fin du document ;
      index + 1 < starts.length ? starts[index + 1].index : xml.length;
    // le segment ;
    const segment = xml.slice(start.end, end);
    // le même, sans
    const cleaned = segment.replace(
      // ses blocs Style
      /<(?:[\w.-]+:)?Style\b[\s\S]*?<\/(?:[\w.-]+:)?Style>/gi,
      // (ils ont aussi des noms).
      '',
    // Fin du nettoyage.
    );

    // Nom de la couche : la balise Name, sinon Identifier.
    const name = firstText(cleaned, 'Name') ?? firstText(cleaned, 'Identifier');
    // Pas de nom, ou nom déjà vu :
    if (!name || seen.has(name)) {
      // couche suivante.
      continue;
    // Fin du cas.
    }

    // Note le nom.
    seen.add(name);
    // Ajoute la couche, avec son titre ou, à défaut, son nom.
    layers.push({ name, title: firstText(cleaned, 'Title') ?? name });

    // 500 couches atteintes :
    if (layers.length >= MAX_LISTED_LAYERS) {
      // on s'arrête.
      break;
    // Fin du cas.
    }
  // Fin de la boucle.
  }

  // Renvoie les couches.
  return layers;
// Fin de parseLayers.
}

// Fonction parseTileMatrixSets.
function parseTileMatrixSets(xml: string): WmtsTileMatrixSetSummary[] {
  // Jeux retenus.
  const sets: WmtsTileMatrixSetSummary[] = [];
  // Noms déjà vus.
  const seen = new Set<string>();

  // Pour chaque bloc TileMatrixSet :
  for (const block of findBlocks(xml, 'TileMatrixSet')) {
    // son nom ;
    const id = firstText(block.inner, 'Identifier');
    // pas de nom, ou nom déjà vu :
    if (!id || seen.has(id)) {
      // bloc suivant.
      continue;
    // Fin du cas.
    }

    // Ses matrices : les blocs TileMatrix,
    const matrices = findBlocks(block.inner, 'TileMatrix')
      // 30 au plus,
      .slice(0, MAX_TILE_MATRICES)
      // chacun lu,
      .map((matrix) => parseTileMatrix(matrix.inner))
      // sans ceux qui sont illisibles.
      .filter((matrix): matrix is WmtsTileMatrixSummary => matrix !== null);

    // Aucune matrice :
    if (matrices.length === 0) {
      // bloc suivant.
      continue;
    // Fin du cas.
    }

    // Note le nom.
    seen.add(id);
    // Ajoute le jeu.
    sets.push({ id, matrices });

    // 12 jeux atteints :
    if (sets.length >= MAX_TILE_MATRIX_SETS) {
      // on s'arrête.
      break;
    // Fin du cas.
    }
  // Fin de la boucle.
  }

  // Renvoie les jeux.
  return sets;
// Fin de parseTileMatrixSets.
}

// Fonction parseTileMatrix.
function parseTileMatrix(inner: string): WmtsTileMatrixSummary | null {
  // Nom de la matrice.
  const id = firstText(inner, 'Identifier');
  // Pas de nom :
  if (!id) {
    // null.
    return null;
  // Fin du cas.
  }

  // Renvoie
  return {
    // le nom ;
    id,
    // le dénominateur d'échelle ;
    scaleDenominator: readNumber(firstText(inner, 'ScaleDenominator')),
    // le coin haut gauche ;
    topLeft: readTopLeftCorner(firstText(inner, 'TopLeftCorner')),
    // la largeur, en tuiles ;
    matrixWidth: readInteger(firstText(inner, 'MatrixWidth')),
    // la hauteur, en tuiles ;
    matrixHeight: readInteger(firstText(inner, 'MatrixHeight')),
    // la largeur d'une tuile ;
    tileWidth: readInteger(firstText(inner, 'TileWidth')),
    // la hauteur d'une tuile.
    tileHeight: readInteger(firstText(inner, 'TileHeight')),
  // Fin de l'objet.
  };
// Fin de parseTileMatrix.
}

// Fonction parseResourceUrlTemplate.
function parseResourceUrlTemplate(xml: string): string | null {
  // Pour chaque bloc ResourceURL :
  for (const block of findBlocks(xml, 'ResourceURL')) {
    // son attribut « template » ;
    const template = readAttr(block.attrs, 'template');
    // s'il existe,
    if (template) {
      // le renvoie.
      return template;
    // Fin du cas.
    }
  // Fin de la boucle.
  }
  // Aucun : null.
  return null;
// Fin de parseResourceUrlTemplate.
}

// Fonction readTopLeftCorner ; son paramètre :
function readTopLeftCorner(
  // le texte du coin.
  value: string | null,
// Elle renvoie une longitude et une latitude, ou null.
): { lon: number; lat: number } | null {
  // Nombres du texte.
  const numbers = readNumbers(value);
  // Moins de deux :
  if (numbers.length < 2) {
    // null.
    return null;
  // Fin du cas.
  }

  // Les deux premiers nombres.
  let [first, second] = numbers;
  // Si le premier tient dans une latitude et pas le second,
  if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
    // les échange : le document donnait la latitude d'abord.
    [first, second] = [second, first];
  // Fin du cas.
  }

  // Renvoie la longitude puis la latitude.
  return { lon: first, lat: second };
// Fin de readTopLeftCorner.
}

// Fonction findBlocks : les blocs d'une balise, avec ou sans préfixe.
function findBlocks(xml: string, name: string): XmlBlock[] {
  // Expression régulière
  const pattern = new RegExp(
    // qui prend les attributs, puis une balise fermée sur elle-même ou un contenu jusqu'à la balise de fin ;
    `<(?:(?:[\\w.-]+):)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>)`,
    // sur tout le texte, sans tenir compte de la casse.
    'gi',
  // Fin de l'expression.
  );

  // Pour chaque bloc trouvé, renvoie
  return [...xml.matchAll(pattern)].map((match) => ({
    // ses attributs,
    attrs: match[1] ?? '',
    // et son contenu.
    inner: match[2] ?? '',
  // Fin de la liste.
  }));
// Fin de findBlocks.
}

// Fonction firstText : le texte de la première balise de ce nom.
function firstText(xml: string, name: string): string | null {
  // Premier bloc.
  const block = findBlocks(xml, name)[0];
  // Son texte, ou null.
  return block ? textOf(block.inner) : null;
// Fin de firstText.
}

// Fonction collectTexts : les textes de toutes les balises de ce nom.
function collectTexts(xml: string, name: string): string[] {
  // Tous les blocs,
  return findBlocks(xml, name)
    // leur texte,
    .map((block) => textOf(block.inner))
    // sans les vides.
    .filter((value): value is string => value !== null);
// Fin de collectTexts.
}

// Fonction textOf : le texte d'un contenu.
function textOf(inner: string): string | null {
  // Remplace les balises par des espaces et décode les entités ;
  const text = decodeXml(inner.replace(/<[^>]*>/g, ' '))
    // réduit les espaces multiples ;
    .replace(/\s+/g, ' ')
    // retire ceux des bords.
    .trim();
  // Renvoie le texte, ou null s'il est vide.
  return text.length > 0 ? text : null;
// Fin de textOf.
}

// Fonction readAttr : la valeur d'un attribut.
function readAttr(attrs: string, name: string): string | null {
  // Expression régulière
  const pattern = new RegExp(
    // qui cherche le nom, un « = », puis une valeur entre guillemets doubles ou simples ;
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    // sans tenir compte de la casse.
    'i',
  // Fin de l'expression.
  );
  // Cherche dans les attributs.
  const match = pattern.exec(attrs);
  // Rien trouvé :
  if (!match) {
    // null.
    return null;
  // Fin du cas.
  }

  // Valeur décodée, sans espaces aux bords.
  const value = decodeXml(match[1] ?? match[2] ?? '').trim();
  // La renvoie, ou null si elle est vide.
  return value.length > 0 ? value : null;
// Fin de readAttr.
}

// Fonction decodeXml : décode les entités XML.
export function decodeXml(value: string): string {
  // Remplace
  return value.replace(
    // chaque entité (numérique en hexadécimal, numérique en décimal, ou nommée)
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    // par le résultat de cette fonction :
    (match, entity: string) => {
      // essaie :
      try {
        // entité en hexadécimal :
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
          // le caractère de ce code ;
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        // fin du cas.
        }
        // Entité en décimal :
        if (entity.startsWith('#')) {
          // le caractère de ce code ;
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        // fin du cas.
        }
        // Entité nommée : sa valeur dans la table, sinon le texte tel quel.
        return XML_ENTITIES[entity] ?? match;
      // En cas d'échec (code impossible) :
      } catch {
        // le texte tel quel.
        return match;
      // Fin du cas.
      }
    // Fin de la fonction.
    },
  // Fin du remplacement.
  );
// Fin de decodeXml.
}

// Fonction readNumbers : les nombres d'un texte.
function readNumbers(value: string | null): number[] {
  // Texte absent :
  if (!value) {
    // liste vide.
    return [];
  // Fin du cas.
  }

  // Renvoie le texte,
  return value
    // coupé aux espaces et aux virgules,
    .split(/[\s,]+/)
    // chaque morceau converti en nombre,
    .map((part) => Number(part))
    // sans ceux qui ne sont pas des nombres finis.
    .filter((part) => Number.isFinite(part));
// Fin de readNumbers.
}

// Fonction readNumber : un nombre, ou null.
function readNumber(value: string | null): number | null {
  // Texte absent :
  if (value === null) {
    // null.
    return null;
  // Fin du cas.
  }
  // Le convertit.
  const parsed = Number(value);
  // Le renvoie s'il est fini, sinon null.
  return Number.isFinite(parsed) ? parsed : null;
// Fin de readNumber.
}

// Fonction readInteger : un entier, ou null.
function readInteger(value: string | null): number | null {
  // Lit le nombre.
  const parsed = readNumber(value);
  // Le renvoie s'il est entier, sinon null.
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
// Fin de readInteger.
}

// Fonction dedupe.
function dedupe(values: string[]): string[] {
  // Renvoie les valeurs sans doublons.
  return [...new Set(values)];
// Fin de dedupe.
}
