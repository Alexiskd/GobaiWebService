import type {
  BBox,
  CapabilitiesLayerSummary,
  WmtsTileMatrixSetSummary,
  WmtsTileMatrixSummary,
} from './mars.types';

export class CapabilitiesParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilitiesParseError';
  }
}

export interface ParsedCapabilities {
  version: string | null;
  serviceTitle: string | null;
  formats: string[];
  crs: string[];
  bbox: BBox | null;
  layers: CapabilitiesLayerSummary[];
  tileMatrixSets: WmtsTileMatrixSetSummary[];
  resourceUrlTemplate: string | null;
}

interface XmlBlock {
  attrs: string;
  inner: string;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const MAX_LISTED_LAYERS = 500;
const MAX_LISTED_CRS = 32;
const MAX_LISTED_FORMATS = 16;
const MAX_TILE_MATRIX_SETS = 12;
const MAX_TILE_MATRICES = 30;

export function parseCapabilities(xml: string): ParsedCapabilities {
  if (!xml || xml.trim().length === 0) {
    throw new CapabilitiesParseError(
      'Le service amont a renvoyé un document vide.',
    );
  }

  xml = xml.replace(/<!--[\s\S]*?-->/g, '');

  const head = xml.slice(0, 1024).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new CapabilitiesParseError(
      'Le service amont a renvoyé du HTML au lieu d’un document OGC XML.',
    );
  }

  if (/<(?:(?:[\w.-]+):)?ServiceException\b/i.test(xml)) {
    const detail = firstText(xml, 'ServiceException');
    throw new CapabilitiesParseError(
      detail
        ? `Le service amont a renvoyé une exception OGC : ${detail}`
        : 'Le service amont a renvoyé une exception OGC.',
    );
  }

  if (
    !/<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b/i.test(
      xml,
    )
  ) {
    throw new CapabilitiesParseError(
      'La réponse amont ne ressemble pas à un document GetCapabilities OGC.',
    );
  }

  return {
    version: parseVersion(xml),
    serviceTitle: parseServiceTitle(xml),
    formats: dedupe(collectTexts(xml, 'Format')).slice(0, MAX_LISTED_FORMATS),
    crs: collectCrs(xml),
    bbox: parseBBox(xml),
    layers: parseLayers(xml),
    tileMatrixSets: parseTileMatrixSets(xml),
    resourceUrlTemplate: parseResourceUrlTemplate(xml),
  };
}

function parseVersion(xml: string): string | null {
  const root =
    /<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b([^>]*)>/i.exec(
      xml,
    );
  return root ? readAttr(root[1], 'version') : null;
}

function parseServiceTitle(xml: string): string | null {
  const block =
    findBlocks(xml, 'ServiceIdentification')[0] ??
    findBlocks(xml, 'Service')[0];
  return block ? firstText(block.inner, 'Title') : null;
}

function collectCrs(xml: string): string[] {
  const values = [
    ...collectTexts(xml, 'CRS'),
    ...collectTexts(xml, 'SRS'),
    ...collectTexts(xml, 'SupportedCRS'),
  ]
    .flatMap((value) => value.split(/\s+/))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(values)].slice(0, MAX_LISTED_CRS);
}

function parseBBox(xml: string): BBox | null {
  const geographic = findBlocks(xml, 'EX_GeographicBoundingBox')[0];
  if (geographic) {
    const west = readNumber(firstText(geographic.inner, 'westBoundLongitude'));
    const south = readNumber(firstText(geographic.inner, 'southBoundLatitude'));
    const east = readNumber(firstText(geographic.inner, 'eastBoundLongitude'));
    const north = readNumber(firstText(geographic.inner, 'northBoundLatitude'));

    if (west !== null && south !== null && east !== null && north !== null) {
      return { west, south, east, north };
    }
  }

  const latLon = findBlocks(xml, 'LatLonBoundingBox')[0];
  if (latLon) {
    const west = readNumber(readAttr(latLon.attrs, 'minx'));
    const south = readNumber(readAttr(latLon.attrs, 'miny'));
    const east = readNumber(readAttr(latLon.attrs, 'maxx'));
    const north = readNumber(readAttr(latLon.attrs, 'maxy'));

    if (west !== null && south !== null && east !== null && north !== null) {
      return { west, south, east, north };
    }
  }

  const wgs84 = findBlocks(xml, 'WGS84BoundingBox')[0];
  if (wgs84) {
    const lower = readNumbers(firstText(wgs84.inner, 'LowerCorner'));
    const upper = readNumbers(firstText(wgs84.inner, 'UpperCorner'));

    if (lower.length >= 2 && upper.length >= 2) {
      return {
        west: lower[0],
        south: lower[1],
        east: upper[0],
        north: upper[1],
      };
    }
  }

  return null;
}

function parseLayers(xml: string): CapabilitiesLayerSummary[] {
  const starts = [...xml.matchAll(/<(?:(?:[\w.-]+):)?Layer\b[^>]*>/gi)].map(
    (match) => ({
      index: match.index,
      end: (match.index ?? 0) + match[0].length,
    }),
  );

  const layers: CapabilitiesLayerSummary[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end =
      index + 1 < starts.length ? starts[index + 1].index : xml.length;
    const segment = xml.slice(start.end, end);
    const cleaned = segment.replace(
      /<(?:[\w.-]+:)?Style\b[\s\S]*?<\/(?:[\w.-]+:)?Style>/gi,
      '',
    );

    const name = firstText(cleaned, 'Name') ?? firstText(cleaned, 'Identifier');
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    layers.push({ name, title: firstText(cleaned, 'Title') ?? name });

    if (layers.length >= MAX_LISTED_LAYERS) {
      break;
    }
  }

  return layers;
}

function parseTileMatrixSets(xml: string): WmtsTileMatrixSetSummary[] {
  const sets: WmtsTileMatrixSetSummary[] = [];
  const seen = new Set<string>();

  for (const block of findBlocks(xml, 'TileMatrixSet')) {
    const id = firstText(block.inner, 'Identifier');
    if (!id || seen.has(id)) {
      continue;
    }

    const matrices = findBlocks(block.inner, 'TileMatrix')
      .slice(0, MAX_TILE_MATRICES)
      .map((matrix) => parseTileMatrix(matrix.inner))
      .filter((matrix): matrix is WmtsTileMatrixSummary => matrix !== null);

    if (matrices.length === 0) {
      continue;
    }

    seen.add(id);
    sets.push({ id, matrices });

    if (sets.length >= MAX_TILE_MATRIX_SETS) {
      break;
    }
  }

  return sets;
}

function parseTileMatrix(inner: string): WmtsTileMatrixSummary | null {
  const id = firstText(inner, 'Identifier');
  if (!id) {
    return null;
  }

  return {
    id,
    scaleDenominator: readNumber(firstText(inner, 'ScaleDenominator')),
    topLeft: readTopLeftCorner(firstText(inner, 'TopLeftCorner')),
    matrixWidth: readInteger(firstText(inner, 'MatrixWidth')),
    matrixHeight: readInteger(firstText(inner, 'MatrixHeight')),
    tileWidth: readInteger(firstText(inner, 'TileWidth')),
    tileHeight: readInteger(firstText(inner, 'TileHeight')),
  };
}

function parseResourceUrlTemplate(xml: string): string | null {
  for (const block of findBlocks(xml, 'ResourceURL')) {
    const template = readAttr(block.attrs, 'template');
    if (template) {
      return template;
    }
  }
  return null;
}

function readTopLeftCorner(
  value: string | null,
): { lon: number; lat: number } | null {
  const numbers = readNumbers(value);
  if (numbers.length < 2) {
    return null;
  }

  let [first, second] = numbers;
  if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
    [first, second] = [second, first];
  }

  return { lon: first, lat: second };
}

function findBlocks(xml: string, name: string): XmlBlock[] {
  const pattern = new RegExp(
    `<(?:(?:[\\w.-]+):)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>)`,
    'gi',
  );

  return [...xml.matchAll(pattern)].map((match) => ({
    attrs: match[1] ?? '',
    inner: match[2] ?? '',
  }));
}

function firstText(xml: string, name: string): string | null {
  const block = findBlocks(xml, name)[0];
  return block ? textOf(block.inner) : null;
}

function collectTexts(xml: string, name: string): string[] {
  return findBlocks(xml, name)
    .map((block) => textOf(block.inner))
    .filter((value): value is string => value !== null);
}

function textOf(inner: string): string | null {
  const text = decodeXml(inner.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text : null;
}

function readAttr(attrs: string, name: string): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'i',
  );
  const match = pattern.exec(attrs);
  if (!match) {
    return null;
  }

  const value = decodeXml(match[1] ?? match[2] ?? '').trim();
  return value.length > 0 ? value : null;
}

export function decodeXml(value: string): string {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, entity: string) => {
      try {
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith('#')) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return XML_ENTITIES[entity] ?? match;
      } catch {
        return match;
      }
    },
  );
}

function readNumbers(value: string | null): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\s,]+/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function readNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readInteger(value: string | null): number | null {
  const parsed = readNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
