// Ouvre l'import de trois types (effacés à la compilation) :
import type {
  // une couche du catalogue ;
  CuratedLayer,
  // la définition d'un fournisseur ;
  ProviderDefinition,
  // un découpage en tuiles.
  TileScheme,
// Fin de l'import.
} from './mars.types';
// Fonctions qui donnent l'emprise d'une tuile et la grille d'un niveau.
import { tileBBox, tileGrid } from './tile-math';

// Fonction buildTileUrl ; ses paramètres :
export function buildTileUrl(
  // le fournisseur ;
  provider: ProviderDefinition,
  // la couche ;
  layer: CuratedLayer,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la tuile chez la source.
): string {
  // Couche sans tuiles 2D :
  if (layer.scheme === 'none') {
    // erreur,
    throw new Error(
      // avec ce message.
      `${provider.id}/${layer.id} est un jeu 3D Tiles : aucune tuile 2D à construire.`,
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Couche WMTS :
  if (layer.kind === 'wmts' && layer.wmts) {
    // renvoie, joints par des « / »,
    return [
      // l'adresse de base,
      layer.wmts.baseUrl,
      // le style,
      layer.wmts.style,
      // le jeu de tuiles,
      layer.wmts.matrixSet,
      // le niveau,
      zoom,
      // la ligne,
      y,
      // et la colonne avec l'extension.
      `${x}.${layer.wmts.extension}`,
    // Fin de l'adresse.
    ].join('/');
  // Fin du cas.
  }

  // Couche WMS :
  if (layer.kind === 'wms' && layer.wms) {
    // renvoie l'adresse de la requête GetMap.
    return buildWmsGetMapUrl(layer, layer.scheme, zoom, x, y);
  // Fin du cas.
  }

  // Couche XYZ :
  if (layer.kind === 'xyz' && layer.xyz) {
    // grille du niveau ;
    const grid = tileGrid(layer.scheme, zoom);
    // ligne : comptée depuis le bas si la source est en TMS, sinon telle quelle.
    const tileY = layer.xyz.tms ? grid.rows - 1 - y : y;

    // Renvoie le modèle d'adresse,
    return layer.xyz.urlTemplate
      // avec le niveau,
      .replaceAll('{z}', String(zoom))
      // la colonne,
      .replaceAll('{x}', String(x))
      // et la ligne.
      .replaceAll('{y}', String(tileY));
  // Fin du cas.
  }

  // Aucun cas : erreur,
  throw new Error(
    // avec ce message.
    `Aucune source de tuiles configurée pour ${provider.id}/${layer.id}.`,
  // Fin de l'erreur.
  );
// Fin de buildTileUrl.
}

// Fonction buildProxyUrl ; ses paramètres :
export function buildProxyUrl(
  // le fournisseur ;
  provider: ProviderDefinition,
  // la couche ;
  layer: CuratedLayer,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la tuile sur ce serveur.
): string {
  // Le chemin de l'API de Mars, avec le fournisseur, la couche et la tuile.
  return `/api/v1/mars/providers/${provider.id}/layers/${layer.id}/tile/${zoom}/${x}/${y}`;
// Fin de buildProxyUrl.
}

// Fonction buildWmsGetMapUrl ; ses paramètres :
function buildWmsGetMapUrl(
  // la couche ;
  layer: CuratedLayer,
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la requête.
): string {
  // Réglages WMS de la couche.
  const wms = layer.wms;
  // Absents :
  if (!wms) {
    // erreur.
    throw new Error(`Configuration WMS manquante pour ${layer.id}.`);
  // Fin du cas.
  }

  // Emprise de la tuile.
  const bbox = tileBBox(scheme, zoom, x, y);
  // Paramètres de la requête :
  const params = new URLSearchParams({
    // le service WMS ;
    SERVICE: 'WMS',
    // sa version ;
    VERSION: wms.version,
    // la requête GetMap ;
    REQUEST: 'GetMap',
    // la couche de la source ;
    LAYERS: layer.upstreamLayer,
    // aucun style ;
    STYLES: '',
    // la largeur ;
    WIDTH: String(layer.tileSize),
    // la hauteur ;
    HEIGHT: String(layer.tileSize),
    // le format ;
    FORMAT: layer.format,
    // le fond transparent.
    TRANSPARENT: 'TRUE',
  // Fin des paramètres.
  });

  // En version 1.3.0 :
  if (wms.version === '1.3.0') {
    // la projection s'appelle CRS ;
    params.set('CRS', wms.srs);
  // sinon
  } else {
    // elle s'appelle SRS.
    params.set('SRS', wms.srs);
  // Fin du choix.
  }

  // Ordre des bords de l'emprise :
  const axes =
    // si la source attend la latitude d'abord :
    wms.axisOrder === 'yx'
      // sud, ouest, nord, est ;
      ? [bbox.south, bbox.west, bbox.north, bbox.east]
      // sinon : ouest, sud, est, nord.
      : [bbox.west, bbox.south, bbox.east, bbox.north];
  // Ajoute l'emprise, les nombres séparés par des virgules.
  params.set('BBOX', axes.map(formatNumber).join(','));

  // Séparateur : « & » si l'adresse a déjà un « ? », sinon « ? ».
  const separator = wms.getMapUrl.includes('?') ? '&' : '?';
  // Renvoie l'adresse suivie des paramètres.
  return `${wms.getMapUrl}${separator}${params.toString()}`;
// Fin de buildWmsGetMapUrl.
}

// Fonction formatNumber.
function formatNumber(value: number): string {
  // Arrondit à 8 décimales et retire les zéros de fin.
  return String(Number(value.toFixed(8)));
// Fin de formatNumber.
}
