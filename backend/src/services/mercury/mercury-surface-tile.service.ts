// Buffer : le tampon d'octets de Node.
import { Buffer } from 'node:buffer';
// Ouvre l'import des outils NestJS :
import {
  // erreur 502 ;
  BadGatewayException,
  // erreur 400 ;
  BadRequestException,
  // injection par jeton ;
  Inject,
  // service injectable ;
  Injectable,
  // erreur 404.
  NotFoundException,
// Fin de l'import.
} from '@nestjs/common';
// Cache à durée de vie, et le type du résultat d'une lecture.
import { TtlCache, type CacheLookup } from './cache';
// Fonctions d'image : ETag, lecture des dimensions, empreinte SHA-256.
import { etagFromSha, inspectImage, sha256Hex } from './image';
// Jeton d'injection de la configuration de Mercure, et son type.
import { MERCURY_CONFIG, type MercuryConfig } from './mercury.config';
// Service du catalogue de Mercure.
import { MercuryCatalogService } from './mercury-catalog.service';
// Ouvre l'import de dix types (effacés à la compilation) :
import type {
  // une emprise ;
  BBox,
  // la couverture d'une emprise ;
  CoverageResult,
  // une couche du catalogue ;
  CuratedLayer,
  // les informations d'une image ;
  ImageInfo,
  // la définition d'un fournisseur ;
  ProviderDefinition,
  // l'état du cache pour une tuile ;
  TileCacheInfo,
  // une tuile téléchargée ;
  TileFetchResult,
  // la fiche d'une tuile ;
  TileModel,
  // un découpage en tuiles ;
  TileScheme,
  // la réponse d'une source.
  UpstreamInfo,
// Fin de l'import.
} from './mercury.types';
// Ouvre l'import des fonctions de calcul des tuiles :
import {
  // borner une emprise ;
  clampBBox,
  // la projeter ;
  projectBBox,
  // l'emprise d'une tuile ;
  tileBBox,
  // son centre ;
  tileCenter,
  // la tuile d'un point ;
  tileFromLonLat,
  // la grille d'un niveau ;
  tileGrid,
  // les tuiles d'une emprise ;
  tilesForBBox,
  // la vérification d'une tuile.
  validateTileCoordinates,
// Fin de l'import.
} from './tile-math';
// Fonctions qui construisent l'adresse d'une tuile sur ce serveur et chez la source.
import { buildProxyUrl, buildTileUrl } from './tile-url';
// Ouvre l'import du module des appels aux sources :
import {
  // son erreur ;
  MercuryUpstreamError,
  // son service ;
  MercuryUpstreamService,
  // le type d'une réponse.
  type UpstreamResponse,
// Fin de l'import.
} from './upstream.service';

// Forme d'une tuile gardée en cache.
interface CachedTile {
  // buffer : ses octets.
  buffer: Buffer;
  // contentType : son type de contenu.
  contentType: string;
  // upstream : la réponse de la source.
  upstream: UpstreamResponse;
  // image : les informations de l'image, ou null.
  image: ImageInfo | null;
  // sha256 : son empreinte.
  sha256: string;
  // etag : son ETag.
  etag: string;
  // fetchedAt : l'heure du téléchargement.
  fetchedAt: string;
// Fin de CachedTile.
}

// Forme des options d'une couverture.
export interface CoverageOptions {
  // bbox : l'emprise (facultatif).
  bbox?: BBox;
  // zoom : le niveau (facultatif).
  zoom?: number;
  // limit : le nombre maximal d'adresses (facultatif).
  limit?: number;
// Fin de CoverageOptions.
}

// Forme des champs variables d'une fiche de tuile.
interface ModelExtras {
  // fetchedAt : l'heure.
  fetchedAt: string;
  // upstream : la réponse de la source, ou null.
  upstream: UpstreamInfo | null;
  // image : les informations de l'image, ou null.
  image: ImageInfo | null;
  // cache : l'état du cache, ou null.
  cache: TileCacheInfo | null;
// Fin de ModelExtras.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des tuiles de Mercure.
export class MercuryTileService {
  // Cache des tuiles.
  private readonly cache: TtlCache<CachedTile>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MERCURY_CONFIG) config: MercuryConfig,
    // le catalogue ;
    private readonly catalog: MercuryCatalogService,
    // le service des appels aux sources.
    private readonly upstream: MercuryUpstreamService,
  // Corps du constructeur :
  ) {
    // Les tuiles restent servies une semaine après le TTL pendant que la
    // version fraîche se recharge en arrière-plan (stale-while-revalidate).
    // crée le cache, avec
    this.cache = new TtlCache<CachedTile>(
      // le nombre de tuiles de la configuration,
      config.tileCacheEntries,
      // leur durée de vie,
      config.tileCacheTtlMs,
      // et sept fois cette durée pendant laquelle une tuile périmée est encore servie.
      config.tileCacheTtlMs * 7,
    // Fin de la création.
    );
  // Fin du constructeur.
  }

  // Méthode getTile ; ses paramètres :
  async getTile(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie la tuile téléchargée.
  ): Promise<TileFetchResult> {
    // Vérifie la demande ; rend le fournisseur et la couche.
    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    // Clé du cache.
    const key = this.cacheKey(provider, layer, zoom, x, y);
    // Adresse de la tuile chez la source.
    const upstreamUrl = buildTileUrl(provider, layer, zoom, x, y);

    // Résultat de la lecture du cache.
    let lookup: CacheLookup<CachedTile>;
    // Essaie :
    try {
      // prend la tuile du cache, ou la charge ainsi :
      lookup = await this.cache.getOrLoad(key, async () => {
        // la télécharge,
        const response = await this.upstream.fetchBinary(upstreamUrl, {
          // en demandant le format de la couche ;
          accept: layer.format,
        // fin du téléchargement ;
        });
        // lit les informations de l'image ;
        const image = inspectImage(response.buffer);
        // son empreinte, celle de l'image ou calculée.
        const sha256 = image?.sha256 ?? sha256Hex(response.buffer);

        // Rend
        return {
          // les octets ;
          buffer: response.buffer,
          // le type de contenu :
          contentType:
            // celui de la réponse,
            response.contentType ??
            // sinon celui de l'image, sinon le format de la couche ;
            (image ? `image/${image.format}` : layer.format),
          // la réponse de la source ;
          upstream: response,
          // les informations de l'image ;
          image,
          // l'empreinte ;
          sha256,
          // l'ETag ;
          etag: etagFromSha(sha256),
          // l'heure du téléchargement.
          fetchedAt: new Date().toISOString(),
        // Fin de l'objet.
        };
      // Fin du chargement.
      });
    // En cas d'échec :
    } catch (error) {
      // relance l'erreur, traduite en erreur HTTP.
      throw this.toHttpError(error);
    // Fin du cas.
    }

    // Tuile lue.
    const cached = lookup.value;
    // Fiche de la tuile, avec
    const model = this.buildModel(provider, layer, zoom, x, y, {
      // l'heure du téléchargement,
      fetchedAt: cached.fetchedAt,
      // la réponse de la source,
      upstream: toUpstreamInfo(cached.upstream),
      // les informations de l'image,
      image: cached.image,
      // et l'état du cache :
      cache: {
        // vient-elle du cache ?
        hit: lookup.hit,
        // est-elle périmée ?
        stale: lookup.stale,
        // sa clé ;
        key,
        // sa durée de vie ;
        ttlMs: lookup.ttlMs,
        // son âge.
        ageMs: lookup.ageMs,
      // Fin de l'état du cache.
      },
    // Fin de la fiche.
    });

    // Renvoie
    return {
      // la fiche ;
      model,
      // les octets ;
      buffer: cached.buffer,
      // le type de contenu ;
      contentType: cached.contentType,
      // l'ETag ;
      etag: cached.etag,
      // si elle vient du cache ;
      cacheHit: lookup.hit,
      // si elle est périmée ;
      cacheStale: lookup.stale,
      // sa durée de vie.
      ttlMs: lookup.ttlMs,
    // Fin de l'objet.
    };
  // Fin de getTile.
  }

  // Méthode describeTile ; ses paramètres :
  async describeTile(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne ;
    y: number,
    // télécharger la tuile ou non (non par défaut).
    fetch = false,
  // Elle renvoie la fiche de la tuile.
  ): Promise<TileModel> {
    // S'il faut la télécharger :
    if (fetch) {
      // renvoie la fiche de la tuile téléchargée.
      return (await this.getTile(providerId, layerId, zoom, x, y)).model;
    // Fin du cas.
    }

    // Vérifie la demande ; rend le fournisseur et la couche.
    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    // Renvoie la fiche, avec
    return this.buildModel(provider, layer, zoom, x, y, {
      // l'heure courante,
      fetchedAt: new Date().toISOString(),
      // pas de réponse de la source,
      upstream: null,
      // pas d'image,
      image: null,
      // pas d'état du cache.
      cache: null,
    // Fin de la fiche.
    });
  // Fin de describeTile.
  }

  // Méthode getTileAt ; ses paramètres :
  async getTileAt(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // la longitude ;
    lon: number,
    // la latitude ;
    lat: number,
    // le niveau (facultatif) ;
    zoom?: number,
    // télécharger la tuile ou non.
    fetch = false,
  // Elle renvoie la fiche de la tuile qui contient ce point.
  ): Promise<TileModel> {
    // Longitude ou latitude non finie :
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      // erreur 400,
      throw new BadRequestException(
        // avec ce message.
        'Les coordonnées lon et lat doivent être des nombres finis.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);

    // Niveau : celui demandé, sinon le plus fin de la couche.
    const targetZoom = zoom ?? layer.maxZoom;
    // Vérifie le niveau.
    assertZoom(provider.id, layer.id, targetZoom, layer.minZoom, layer.maxZoom);

    // Tuile qui contient le point.
    const index = tileFromLonLat(layer.scheme, targetZoom, lon, lat);
    // Renvoie sa fiche, pour
    return this.describeTile(
      // ce fournisseur,
      provider.id,
      // cette couche,
      layer.id,
      // ce niveau,
      targetZoom,
      // cette colonne,
      index.x,
      // cette ligne,
      index.y,
      // avec ou sans téléchargement.
      fetch,
    // Fin de l'appel.
    );
  // Fin de getTileAt.
  }

  // Méthode coverage ; ses paramètres :
  coverage(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // les options, vides par défaut.
    options: CoverageOptions = {},
  // Elle renvoie la couverture.
  ): CoverageResult {
    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);

    // Niveau : celui demandé, sinon 3, sans dépasser celui de la couche.
    const zoom = options.zoom ?? Math.min(3, layer.maxZoom);
    // Vérifie le niveau.
    assertZoom(provider.id, layer.id, zoom, layer.minZoom, layer.maxZoom);

    // Emprise bornée :
    const bbox = clampBBox(
      // celle demandée, sinon le monde entier,
      options.bbox ?? { west: -180, south: -90, east: 180, north: 90 },
      // pour le découpage de la couche.
      layer.scheme,
    // Fin du calcul.
    );
    // Plage de tuiles de l'emprise.
    const range = tilesForBBox(layer.scheme, zoom, bbox);
    // Nombre maximal d'adresses : 64 par défaut, de 1 à 512.
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 64), 1), 512);
    // Nombre total de tuiles de la plage.
    const total = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);

    // Adresses sur ce serveur.
    const urls: string[] = [];
    // Adresses chez la source.
    const upstreamUrls: string[] = [];

    // Pour chaque ligne, tant que la limite n'est pas atteinte,
    for (let y = range.minY; y <= range.maxY && urls.length < limit; y += 1) {
      // et chaque colonne :
      for (let x = range.minX; x <= range.maxX && urls.length < limit; x += 1) {
        // ajoute l'adresse sur ce serveur ;
        urls.push(buildProxyUrl(provider, layer, zoom, x, y));
        // ajoute l'adresse chez la source.
        upstreamUrls.push(buildTileUrl(provider, layer, zoom, x, y));
      // Fin des colonnes.
      }
    // Fin des lignes.
    }

    // Renvoie
    return {
      // le fournisseur ;
      provider: provider.id,
      // la couche ;
      layer: layer.id,
      // le découpage ;
      scheme: layer.scheme,
      // le niveau ;
      zoom,
      // l'emprise ;
      bbox,
      // la plage ;
      range,
      // le nombre d'adresses rendues ;
      count: urls.length,
      // le nombre total de tuiles ;
      total,
      // si la liste est coupée ;
      truncated: urls.length < total,
      // les adresses sur ce serveur ;
      urls,
      // les adresses chez la source.
      upstreamUrls,
    // Fin de l'objet.
    };
  // Fin de coverage.
  }

  // Méthode privée prepare ; ses paramètres :
  private prepare(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie
  ): {
    // le fournisseur,
    provider: ProviderDefinition;
    // et la couche.
    layer: CuratedLayer & { scheme: TileScheme };
  // Fin du type.
  } {
    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);

    // Vérifie la tuile, avec
    const problem = validateTileCoordinates(
      // le fournisseur,
      provider.id,
      // la couche,
      layer.id,
      // le découpage,
      layer.scheme,
      // le niveau,
      zoom,
      // la colonne,
      x,
      // la ligne,
      y,
      // et les niveaux de la couche.
      { minZoom: layer.minZoom, maxZoom: layer.maxZoom },
    // Fin de la vérification.
    );

    // S'il y a un problème :
    if (problem) {
      // erreur 400, avec son message.
      throw new BadRequestException(problem);
    // Fin du cas.
    }

    // Renvoie le fournisseur et la couche.
    return { provider, layer };
  // Fin de prepare.
  }

  // Méthode privée buildModel ; ses paramètres :
  private buildModel(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la couche ;
    layer: CuratedLayer & { scheme: TileScheme },
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne ;
    y: number,
    // les champs variables.
    extras: ModelExtras,
  // Elle renvoie la fiche de la tuile.
  ): TileModel {
    // Emprise de la tuile.
    const bbox = tileBBox(layer.scheme, zoom, x, y);
    // Grille du niveau.
    const grid = tileGrid(layer.scheme, zoom);

    // Renvoie
    return {
      // le fournisseur :
      provider: {
        // son identifiant,
        id: provider.id,
        // son nom,
        name: provider.name,
        // sa nature.
        kind: provider.kind,
      // Fin du fournisseur.
      },
      // La couche :
      layer: {
        // son identifiant,
        id: layer.id,
        // son titre,
        title: layer.title,
        // son nom chez la source.
        upstreamLayer: layer.upstreamLayer,
      // Fin de la couche.
      },
      // Le découpage.
      scheme: layer.scheme,
      // La projection.
      crs: layer.crs,
      // Le niveau.
      zoom,
      // La colonne.
      x,
      // La ligne.
      y,
      // La taille d'une tuile.
      tileSize: layer.tileSize,
      // Le format.
      format: layer.format,
      // L'emprise.
      bbox,
      // L'emprise projetée.
      projectedBBox: projectBBox(layer.scheme, bbox, layer.crs),
      // Le centre.
      center: tileCenter(layer.scheme, bbox),
      // La dernière colonne et la dernière ligne du niveau.
      tileRange: { maxX: grid.columns - 1, maxY: grid.rows - 1 },
      // L'adresse chez la source.
      upstreamUrl: buildTileUrl(provider, layer, zoom, x, y),
      // L'adresse sur ce serveur.
      proxyUrl: buildProxyUrl(provider, layer, zoom, x, y),
      // La mention.
      attribution: layer.attribution,
      // La licence.
      license: layer.license,
      // L'heure.
      fetchedAt: extras.fetchedAt,
      // La réponse de la source.
      upstream: extras.upstream,
      // Les informations de l'image.
      image: extras.image,
      // L'état du cache.
      cache: extras.cache,
    // Fin de l'objet.
    };
  // Fin de buildModel.
  }

  // Méthode privée cacheKey ; ses paramètres :
  private cacheKey(
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
  // Elle renvoie la clé du cache.
  ): string {
    // « fournisseur:couche:niveau:colonne:ligne ».
    return `${provider.id}:${layer.id}:${zoom}:${x}:${y}`;
  // Fin de cacheKey.
  }

  // Méthode privée toHttpError.
  private toHttpError(error: unknown): Error {
    // Erreur d'une source :
    if (error instanceof MercuryUpstreamError) {
      // code 404 :
      if (error.status === 404) {
        // erreur 404,
        return new NotFoundException(
          // avec ce message.
          'La tuile demandée n’existe pas sur le service amont (404).',
        // Fin de l'erreur.
        );
      // Fin du cas.
      }
      // Autre code : erreur 502.
      return new BadGatewayException(`Tuile indisponible : ${error.message}`);
    // Fin du cas.
    }

    // Sinon l'erreur telle quelle, ou une erreur faite de son texte.
    return error instanceof Error ? error : new Error(String(error));
  // Fin de toHttpError.
  }
// Fin du service.
}

// Fonction assertZoom ; ses paramètres :
function assertZoom(
  // l'identifiant du fournisseur ;
  providerId: string,
  // celui de la couche ;
  layerId: string,
  // le niveau ;
  zoom: number,
  // le niveau minimal ;
  minZoom: number,
  // le niveau maximal.
  maxZoom: number,
// Elle ne renvoie rien.
): void {
  // Niveau non entier ou hors des bornes :
  if (!Number.isInteger(zoom) || zoom < minZoom || zoom > maxZoom) {
    // erreur 400,
    throw new BadRequestException(
      // avec la plage permise.
      `Zoom ${zoom} hors plage pour ${providerId}/${layerId} (${minZoom}–${maxZoom}).`,
    // Fin de l'erreur.
    );
  // Fin du cas.
  }
// Fin de assertZoom.
}

// Fonction toUpstreamInfo.
function toUpstreamInfo(response: UpstreamResponse): UpstreamInfo {
  // Renvoie
  return {
    // le code HTTP ;
    status: response.status,
    // le type de contenu ;
    contentType: response.contentType,
    // la taille annoncée ;
    contentLength: response.contentLength,
    // l'ETag ;
    etag: response.etag,
    // la date de dernière modification ;
    lastModified: response.lastModified,
    // l'en-tête Cache-Control.
    cacheControl: response.cacheControl,
  // Fin de l'objet.
  };
// Fin de toUpstreamInfo.
}
