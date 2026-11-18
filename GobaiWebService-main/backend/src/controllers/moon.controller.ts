/**
 * Contrôleur unique du module Moon — fusion de moon.controller.ts et
 * moon-db.controller.ts.
 *
 * Le contrôleur n'a pas de préfixe (@Controller()) : chaque route porte son
 * chemin complet ('moon/...' et 'moon-db/...'), ce qui préserve exactement
 * les URL existantes (préfixe global /api ajouté par main.ts).
 *
 *   GET  /api/moon        — passerelle tuiles & terrain (proxy amont)
 *   GET  /api/moon-db     — stockage PostgreSQL (mode tri/icosaèdre)
 */

// Ouvre la liste des outils NestJS importés :
import {
  // erreur 400 (requête invalide) ;
  BadRequestException,
  // décorateur de contrôleur ;
  Controller,
  // route GET ;
  Get,
  // route HEAD (mêmes en-têtes qu'un GET, sans le corps) ;
  Head,
  // lecture d'un en-tête de la requête ;
  Headers,
  // injection d'une dépendance par son jeton ;
  Inject,
  // paramètre de l'adresse ;
  Param,
  // route POST ;
  Post,
  // paramètre de requête (après le « ? ») ;
  Query,
  // accès à la réponse ;
  Res,
  // StreamableFile : enveloppe d'un contenu binaire que NestJS envoie tel quel.
  StreamableFile,
// Fin de l'import.
} from '@nestjs/common';
// Throttle : fixe une limite de débit propre à une route.
import { Throttle } from '@nestjs/throttler';
// Buffer : le type de Node pour des octets en mémoire (ici le contenu d'une image).
import { Buffer } from 'node:buffer';
// Type Express (effacé à la compilation) de la réponse.
import type { Response } from 'express';
// Décorateurs de documentation OpenAPI : étiquette du groupe et description des routes.
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// Ouvre la liste de ce qui est importé du fichier unique des services de la Lune :
import {
  // fonction qui télécharge une tuile chez NASA Trek ;
  fetchTrekTile,
  // jeton d'injection de la configuration de la Lune ;
  MOON_CONFIG,
  // plan du découpage en triangles de la Lune (icosaèdre) ;
  MOON_TRI_PLAN,
  // service des capacités des sources ;
  MoonCapabilitiesService,
  // service du catalogue (sources et couches) ;
  MoonCatalogService,
  // service de stockage dans PostgreSQL ;
  MoonDbService,
  // service de santé des sources amont ;
  MoonHealthService,
  // service des tuiles ;
  MoonTileService,
  // niveau de zoom maximal des tuiles Trek (8) ;
  TREK_MAX_ZOOM,
  // type d'une emprise géographique ;
  type BBox,
  // type de la configuration de la Lune ;
  type MoonConfig,
  // type du résultat d'une lecture de tuile.
  type TileFetchResult,
// Fin de l'import.
} from '../services/moon/moon.service';

// Interface minimale de la réponse HTTP, pour les routes qui ne font que poser des en-têtes :
interface MinimalResponse {
  // poser un en-tête.
  setHeader(name: string, value: string | number): unknown;
// Fin de MinimalResponse.
}

// Contrôleur sans préfixe : chaque route écrit son chemin complet (moon/… ou moon-db/…).
// Groupe de la documentation : Lune.
@ApiTags('Lune')
@Controller()
// Classe du contrôleur de la Lune.
export class MoonController {
  // Constructeur : NestJS y injecte la configuration et les services, gardés en propriétés privées non modifiables.
  constructor(
    // La configuration de la Lune, demandée par son jeton MOON_CONFIG.
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    // Le catalogue.
    private readonly catalog: MoonCatalogService,
    // Les capacités des sources.
    private readonly capabilitiesService: MoonCapabilitiesService,
    // Les tuiles.
    private readonly tileService: MoonTileService,
    // La santé des sources amont.
    private readonly healthService: MoonHealthService,
    // Le stockage PostgreSQL.
    private readonly db: MoonDbService,
  // Corps du constructeur vide.
  ) {}

  // -------------------------------------------------------------------------
  // Passerelle amont (ex moon.controller.ts)
  // -------------------------------------------------------------------------

  // Route GET /api/v1/moon.
  @Get('moon')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Panorama du module Lune : fournisseurs, limites de cache et routes disponibles' })
  // Méthode overview : décrit le module.
  overview() {
    // Objet renvoyé :
    return {
      // nom du module ;
      module: 'moon',
      // description, écrite sur la ligne suivante :
      description:
        // texte de la description.
        'Passerelle backend pour les services de tuiles et de terrain lunaires.',
      // Limites de fonctionnement, lues dans la configuration :
      limits: {
        // nombre maximal de tuiles gardées en mémoire ;
        tileCacheEntries: this.config.tileCacheEntries,
        // durée de vie d'une tuile en mémoire (ms) ;
        tileCacheTtlMs: this.config.tileCacheTtlMs,
        // durée de vie des capacités d'une source en mémoire (ms) ;
        capabilitiesCacheTtlMs: this.config.capabilitiesCacheTtlMs,
        // taille maximale acceptée d'une réponse d'une source amont (octets).
        maxUpstreamBytes: this.config.maxUpstreamBytes,
      // Fin des limites.
      },
      // Sources de tuiles : chaque source du catalogue devient un objet résumé,
      providers: this.catalog.listProviders().map((provider) => ({
        // avec son identifiant,
        id: provider.id,
        // son nom,
        name: provider.name,
        // son type,
        kind: provider.kind,
        // son nombre de couches,
        layers: provider.layers.length,
        // et si elle exige un jeton d'accès.
        requiresToken: provider.requiresToken,
      // Fin de la liste des sources.
      })),
      // Adresses des routes du module :
      endpoints: {
        // liste des sources ;
        providers: '/api/v1/moon/providers',
        // une source ;
        provider: '/api/v1/moon/providers/:provider',
        // couches d'une source ;
        layers: '/api/v1/moon/providers/:provider/layers',
        // une couche ;
        layer: '/api/v1/moon/providers/:provider/layers/:layer',
        // capacités d'une source (raw=1 : document brut ; refresh=1 : sans le cache) ;
        capabilities: '/api/v1/moon/providers/:provider/capabilities?raw=1&refresh=1',
        // une tuile, par niveau z, colonne x et ligne y ;
        tile: '/api/v1/moon/providers/:provider/layers/:layer/tile/:z/:x/:y',
        // description d'une tuile, sur la ligne suivante :
        tileMetadata:
          // son adresse (fetch=1 : télécharger la tuile pour la décrire) ;
          '/api/v1/moon/providers/:provider/layers/:layer/tile/:z/:x/:y/metadata?fetch=1',
        // tuile qui contient un point, sur la ligne suivante :
        tileAt:
          // son adresse (longitude, latitude, niveau de zoom) ;
          '/api/v1/moon/providers/:provider/layers/:layer/tile-at?lon=&lat=&zoom=',
        // tuiles couvrant une emprise, sur la ligne suivante :
        coverage:
          // son adresse (emprise, niveau de zoom, nombre maximal de tuiles) ;
          '/api/v1/moon/providers/:provider/layers/:layer/coverage?bbox=&zoom=&limit=',
        // santé des sources amont.
        health: '/api/v1/moon/health',
      // Fin des adresses.
      },
    // Fin de l'objet.
    };
  // Fin de overview.
  }

  // Route GET /api/v1/moon/providers.
  @Get('moon/providers')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Lister les fournisseurs de tuiles de la Lune' })
  // Méthode listProviders.
  listProviders() {
    // Renvoie le résumé de chaque source du catalogue.
    return this.catalog.listSummaries();
  // Fin de listProviders.
  }

  // Route GET /api/v1/moon/health.
  @Get('moon/health')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'État des services de tuiles amont de la Lune' })
  // Méthode health.
  health() {
    // Renvoie l'état des sources amont, testées par le service de santé.
    return this.healthService.check();
  // Fin de health.
  }

  // Route GET /api/v1/moon/providers/:provider.
  @Get('moon/providers/:provider')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Décrire un fournisseur de la Lune' })
  // Méthode getProvider : reçoit l'identifiant de la source.
  getProvider(@Param('provider') provider: string) {
    // Renvoie le résumé de cette source ; le catalogue lève une erreur si elle est inconnue.
    return this.catalog.getProviderSummary(provider);
  // Fin de getProvider.
  }

  // Route GET /api/v1/moon/providers/:provider/layers.
  @Get('moon/providers/:provider/layers')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Lister les couches d’un fournisseur' })
  // Méthode listLayers : reçoit l'identifiant de la source.
  listLayers(@Param('provider') provider: string) {
    // Récupère la définition complète de la source.
    const definition = this.catalog.getProvider(provider);
    // Pour chacune de ses couches,
    return definition.layers.map((layer) =>
      // produit son résumé.
      this.catalog.summarizeLayer(definition, layer),
    // Fin de la transformation ; la liste des résumés est renvoyée.
    );
  // Fin de listLayers.
  }

  // Route GET /api/v1/moon/providers/:provider/layers/:layer.
  @Get('moon/providers/:provider/layers/:layer')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Décrire une couche' })
  // Méthode getLayer : reçoit les identifiants de la source et de la couche.
  getLayer(@Param('provider') provider: string, @Param('layer') layer: string) {
    // Renvoie la description détaillée de la couche.
    return this.catalog.describeLayer(provider, layer);
  // Fin de getLayer.
  }

  // Route GET /api/v1/moon/providers/:provider/capabilities.
  @Get('moon/providers/:provider/capabilities')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Capacités déclarées par le service amont (WMTS ou WMS)' })
  // Méthode capabilities, asynchrone ; ses paramètres :
  async capabilities(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // le paramètre de requête raw, absent ou en texte ;
    @Query('raw') raw: string | undefined,
    // le paramètre de requête refresh, absent ou en texte ;
    @Query('refresh') refresh: string | undefined,
    // la réponse ; passthrough : NestJS envoie quand même la valeur renvoyée par la méthode.
    @Res({ passthrough: true }) res: Response,
  // Fin des paramètres.
  ) {
    // Attend les capacités de la source, avec deux options :
    const result = await this.capabilitiesService.getCapabilities(provider, {
      // raw : garder aussi le document brut ;
      raw: isTruthy(raw),
      // refresh : ignorer le cache et réinterroger la source.
      refresh: isTruthy(refresh),
    // Fin de l'appel.
    });

    // Si le document brut est demandé et disponible :
    if (isTruthy(raw) && result.raw !== null) {
      // type de la réponse : XML en UTF-8 ;
      res.type('application/xml; charset=utf-8');
      // renvoie le document tel que la source l'a fourni.
      return result.raw;
    // Fin du cas « brut ».
    }

    // Sinon renvoie le résumé des capacités, en JSON.
    return result.summary;
  // Fin de capabilities.
  }

  // Route GET …/layers/:layer/tile/:z/:x/:y/metadata.
  @Get('moon/providers/:provider/layers/:layer/tile/:z/:x/:y/metadata')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Métadonnées d’une tuile, sans l’image' })
  // Méthode tileMetadata ; ses paramètres :
  tileMetadata(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // l'identifiant de la couche ;
    @Param('layer') layer: string,
    // le niveau de zoom z, en texte ;
    @Param('z') z: string,
    // la colonne x, en texte ;
    @Param('x') x: string,
    // la ligne y, en texte ;
    @Param('y') y: string,
    // le paramètre de requête fetch, absent ou en texte.
    @Query('fetch') fetch: string | undefined,
  // Fin des paramètres.
  ) {
    // Renvoie la description de la tuile, demandée au service avec :
    return this.tileService.describeTile(
      // la source ;
      provider,
      // la couche ;
      layer,
      // z converti en entier (erreur 400 sinon) ;
      parseInteger(z, 'z'),
      // x converti en entier ;
      parseInteger(x, 'x'),
      // y converti en entier ;
      parseInteger(y, 'y'),
      // vrai si la tuile doit être téléchargée pour être décrite.
      isTruthy(fetch),
    // Fin de l'appel.
    );
  // Fin de tileMetadata.
  }

  // Route GET …/layers/:layer/tile-at.
  @Get('moon/providers/:provider/layers/:layer/tile-at')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Tuile qui contient une longitude et une latitude' })
  // Méthode tileAt ; ses paramètres :
  tileAt(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // l'identifiant de la couche ;
    @Param('layer') layer: string,
    // la longitude, en texte ;
    @Query('lon') lon: string | undefined,
    // la latitude, en texte ;
    @Query('lat') lat: string | undefined,
    // le niveau de zoom, facultatif ;
    @Query('zoom') zoom: string | undefined,
    // le paramètre fetch, facultatif.
    @Query('fetch') fetch: string | undefined,
  // Fin des paramètres.
  ) {
    // Renvoie la tuile qui contient ce point, demandée au service avec :
    return this.tileService.getTileAt(
      // la source ;
      provider,
      // la couche ;
      layer,
      // la longitude, obligatoire et convertie en nombre ;
      parseRequiredNumber(lon, 'lon'),
      // la latitude, obligatoire et convertie en nombre ;
      parseRequiredNumber(lat, 'lat'),
      // le zoom, converti en entier s'il est fourni ;
      parseOptionalInteger(zoom, 'zoom'),
      // vrai si la tuile doit être téléchargée.
      isTruthy(fetch),
    // Fin de l'appel.
    );
  // Fin de tileAt.
  }

  // Route GET …/layers/:layer/coverage.
  @Get('moon/providers/:provider/layers/:layer/coverage')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Tuiles couvrant une emprise' })
  // Méthode coverage ; ses paramètres :
  coverage(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // l'identifiant de la couche ;
    @Param('layer') layer: string,
    // l'emprise « ouest,sud,est,nord », facultative ;
    @Query('bbox') bbox: string | undefined,
    // le niveau de zoom, facultatif ;
    @Query('zoom') zoom: string | undefined,
    // le nombre maximal de tuiles, facultatif.
    @Query('limit') limit: string | undefined,
  // Fin des paramètres.
  ) {
    // Renvoie les tuiles qui couvrent l'emprise, demandées au service avec ces options :
    return this.tileService.coverage(provider, layer, {
      // l'emprise convertie en objet ;
      bbox: parseBBox(bbox),
      // le zoom converti en entier ;
      zoom: parseOptionalInteger(zoom, 'zoom'),
      // la limite convertie en entier.
      limit: parseOptionalInteger(limit, 'limit'),
    // Fin de l'appel.
    });
  // Fin de coverage.
  }

  // Route GET …/layers/:layer/tile/:z/:x/:y : l'image d'une tuile.
  @Get('moon/providers/:provider/layers/:layer/tile/:z/:x/:y')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Tuile relayée et mise en cache par le serveur' })
  // Méthode tile, asynchrone ; ses paramètres :
  async tile(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // l'identifiant de la couche ;
    @Param('layer') layer: string,
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // l'en-tête If-None-Match : l'empreinte de la copie que le navigateur possède déjà, s'il en a une ;
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    // la réponse, en mode passthrough.
    @Res({ passthrough: true }) res: Response,
  // Fin des paramètres.
  ) {
    // Attend la tuile auprès du service (cache mémoire ou source amont), avec :
    const result = await this.tileService.getTile(
      // la source ;
      provider,
      // la couche ;
      layer,
      // z converti en entier ;
      parseInteger(z, 'z'),
      // x converti en entier ;
      parseInteger(x, 'x'),
      // y converti en entier.
      parseInteger(y, 'y'),
    // Fin de l'appel.
    );

    // Pose les en-têtes de cache et d'information de la tuile.
    applyTileHeaders(res, result);

    // Si le navigateur possède déjà cette version exacte de la tuile :
    if (etagMatches(ifNoneMatch, result.etag)) {
      // code 304, « non modifiée » ;
      res.status(304);
      // aucun corps n'est envoyé.
      return;
    // Fin du cas 304.
    }

    // Sinon renvoie l'image en contenu binaire, avec :
    return new StreamableFile(result.buffer, {
      // son type (PNG, JPEG…) ;
      type: result.contentType,
      // sa taille en octets.
      length: result.buffer.length,
    // Fin du contenu binaire.
    });
  // Fin de tile.
  }

  // Route HEAD sur la même adresse : les en-têtes de la tuile, sans l'image.
  @Head('moon/providers/:provider/layers/:layer/tile/:z/:x/:y')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Tester l’existence d’une tuile sans télécharger son image' })
  // Méthode headTile, asynchrone ; ses paramètres :
  async headTile(
    // l'identifiant de la source ;
    @Param('provider') provider: string,
    // l'identifiant de la couche ;
    @Param('layer') layer: string,
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // la réponse, en mode passthrough.
    @Res({ passthrough: true }) res: Response,
  // Fin des paramètres.
  ) {
    // Attend la tuile auprès du service, avec :
    const result = await this.tileService.getTile(
      // la source ;
      provider,
      // la couche ;
      layer,
      // z converti en entier ;
      parseInteger(z, 'z'),
      // x converti en entier ;
      parseInteger(x, 'x'),
      // y converti en entier.
      parseInteger(y, 'y'),
    // Fin de l'appel.
    );

    // Pose les mêmes en-têtes que pour un GET.
    applyTileHeaders(res, result);
    // Type de l'image.
    res.setHeader('Content-Type', result.contentType);
    // Taille de l'image.
    res.setHeader('Content-Length', result.buffer.length);
    // Code 200 ; rien n'est renvoyé, donc pas de corps.
    res.status(200);
  // Fin de headTile.
  }

  // -------------------------------------------------------------------------
  // Stockage PostgreSQL (ex moon-db.controller.ts)
  // -------------------------------------------------------------------------

  /** Vue d'ensemble : plan, base, endpoints. */
  // Route GET …/moon-db.
  @Get('moon-db')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Panorama du stockage PostgreSQL de la Lune (mode tri/icosaèdre)' })
  // Méthode dbOverview : décrit le stockage.
  dbOverview() {
    // Objet renvoyé :
    return {
      // nom du module ;
      module: 'moon-db',
      // description, écrite sur la ligne suivante :
      description:
        // texte de la description.
        'Stockage PostgreSQL des tuiles lunaires NASA Trek et composition à la demande des tuiles du plan géodésique (icosaèdre).',
      // vrai si une base PostgreSQL est configurée et utilisable.
      databaseConfigured: this.db.available,
      // Plan du découpage de la Lune en triangles :
      plan: {
        // mode « tri » (tuiles triangulaires) ;
        mode: 'tri',
        // forme de départ : un icosaèdre (20 faces triangulaires) ;
        base: 'icosaèdre',
        // nom de l'astre ;
        planet: MOON_TRI_PLAN.planet,
        // rayon de la Lune en mètres ;
        radiusM: MOON_TRI_PLAN.radiusM,
        // nombre de divisions de chaque face de départ ;
        rootGridN: MOON_TRI_PLAN.n,
        // nombre de triangles au niveau 0 ;
        rootCount: MOON_TRI_PLAN.rootCount,
        // niveau de subdivision le plus fin ;
        maxLevel: MOON_TRI_PLAN.maxLevel,
        // longueur d'un côté de triangle à ce niveau, en mètres ;
        finestEdgeM: MOON_TRI_PLAN.finestEdgeM,
        // niveau de zoom maximal de l'imagerie Trek utilisée.
        imageryMaxZoom: TREK_MAX_ZOOM,
      // Fin du plan.
      },
      // Adresses des routes du stockage :
      endpoints: {
        // statistiques de la base ;
        stats: '/api/moon-db/stats',
        // tuile Trek brute ;
        trekTile: '/api/moon-db/trek/:z/:x/:y',
        // géométrie d'une tuile triangulaire ;
        triGeometry: '/api/moon-db/tri/:id/geometry',
        // image d'une tuile triangulaire ;
        triTile: '/api/moon-db/tri/:id',
        // lancer le préchargement (POST) ;
        prefetchStart: 'POST /api/moon-db/prefetch',
        // suivre le préchargement.
        prefetchStatus: '/api/moon-db/prefetch',
      // Fin des adresses.
      },
    // Fin de l'objet.
    };
  // Fin de dbOverview.
  }

  /** Statistiques de la base. */
  // Route GET …/moon-db/stats.
  @Get('moon-db/stats')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Statistiques du stockage des tuiles de la Lune' })
  // Méthode stats, asynchrone.
  async stats() {
    // Lance trois requêtes à la base en même temps et attend les trois résultats, rangés dans trois variables :
    const [trekCount, triCount, sizeBytes] = await Promise.all([
      // nombre de tuiles Trek stockées ;
      this.db.countTrek(),
      // nombre de tuiles triangulaires stockées ;
      this.db.countTri(),
      // taille de la base en octets.
      this.db.dbSizeBytes(),
    // Fin des trois requêtes.
    ]);
    // Objet renvoyé :
    return {
      // tuiles Trek ;
      trekTiles: trekCount,
      // tuiles triangulaires ;
      triTiles: triCount,
      // taille en octets ;
      dbSizeBytes: sizeBytes,
      // taille en mébioctets (divisée par 1024 × 1024), arrondie.
      dbSizeMiB: Math.round(sizeBytes / (1024 * 1024)),
    // Fin de l'objet.
    };
  // Fin de stats.
  }

  /** Tuile Trek brute stockée (repli amont si absente). */
  // Route GET …/moon-db/trek/:z/:x/:y.
  @Get('moon-db/trek/:z/:x/:y')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Tuile Trek brute stockée, avec repli sur le service amont' })
  // Méthode trekTile, asynchrone ; ses paramètres :
  async trekTile(
    // le niveau de zoom z, en texte ;
    @Param('z') z: string,
    // la colonne x, en texte ;
    @Param('x') x: string,
    // la ligne y, en texte ;
    @Param('y') y: string,
    // la réponse, en mode passthrough (NestJS envoie la valeur renvoyée).
    @Res({ passthrough: true }) res: Response,
  // Elle renvoie une promesse de contenu binaire.
  ): Promise<StreamableFile> {
    // z converti en entier positif (erreur 400 sinon).
    const zi = parseZoom(z);
    // x converti en entier positif.
    const xi = parseIndex(x);
    // y converti en entier positif.
    const yi = parseIndex(y);
    // Hors grille si le zoom dépasse le maximum, ou si la colonne ou la ligne n'existe pas : la grille Trek a 2^(z+1) colonnes et 2^z lignes.
    if (zi > TREK_MAX_ZOOM || xi >= 2 ** (zi + 1) || yi >= 2 ** zi) {
      // Erreur 400.
      throw new BadRequestException('Coordonnées de tuile Trek hors grille.');
    // Fin de la vérification.
    }

    // Cherche la tuile dans la base : ses octets si elle y est, sinon null.
    let bytes: Buffer | null = (await this.db.getTrek(zi, xi, yi))?.bytes ?? null;
    // Si elle n'y est pas :
    if (!bytes) {
      // la télécharge chez NASA Trek (null si elle n'existe pas ou si le téléchargement échoue) ;
      bytes = await fetchTrekTile(zi, xi, yi);
      // si le téléchargement a réussi,
      if (bytes) {
        // l'enregistre dans la base pour la prochaine fois.
        await this.db.putTrek(zi, xi, yi, bytes);
      // Fin de l'enregistrement.
      }
    // Fin du repli sur la source amont.
    }
    // Toujours rien :
    if (!bytes) {
      // erreur 400, tuile introuvable.
      throw new BadRequestException('Tuile Trek introuvable.');
    // Fin du cas.
    }
    // Les tuiles Trek sont des ressources cartographiques stables : permettre au navigateur
    // de les réutiliser pendant 24 h sans refaire une lecture PostgreSQL ou un fetch amont.
    // Cache public d'un jour (86 400 s).
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Renvoie l'image en contenu binaire, avec :
    return new StreamableFile(bytes, {
      // son type, JPEG ;
      type: 'image/jpeg',
      // sa taille en octets.
      length: bytes.length,
    // Fin du contenu binaire.
    });
  // Fin de trekTile.
  }

  /** Géométrie d'une tuile tri (bbox, coins, centre) — sans image. */
  // Route GET …/moon-db/tri/:id/geometry, déclarée avant « tri/:id ».
  @Get('moon-db/tri/:id/geometry')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Géométrie d’une tuile tri : emprise, coins et centre' })
  // Méthode triGeometry : reçoit l'identifiant de la tuile triangulaire.
  triGeometry(@Param('id') id: string) {
    // Renvoie sa géométrie (emprise, coins, centre), calculée sans image.
    return this.db.describeTri(id);
  // Fin de triGeometry.
  }

  /** Image d'une tuile tri, composée depuis le stockage local. */
  // Route GET …/moon-db/tri/:id.
  @Get('moon-db/tri/:id')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Image d’une tuile tri, composée depuis le stockage local' })
  // Méthode triTile, asynchrone ; ses paramètres :
  async triTile(
    // l'identifiant de la tuile ;
    @Param('id') id: string,
    // l'en-tête If-None-Match : l'empreinte de la copie que le navigateur possède déjà ;
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    // la réponse, réduite à ce qui sert ici : poser un en-tête et fixer le code.
    @Res({ passthrough: true }) res: MinimalResponse & { status(code: number): unknown },
  // Elle renvoie une promesse de contenu binaire, ou de rien (cas 304).
  ): Promise<StreamableFile | void> {
    // Attend l'image de la tuile, composée à partir des tuiles Trek stockées.
    const result = await this.db.getTriTile(id);
    // Emprise de la tuile.
    const bbox = result.tile.bbox;
    // Empreinte de la réponse : le SHA-256 de l'image, entre guillemets comme le veut HTTP.
    const etag = `"${result.sha256}"`;

    // En-tête ETag.
    res.setHeader('ETag', etag);
    // Cache public d'un jour.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Si le navigateur possède déjà cette version :
    if (etagMatches(ifNoneMatch, etag)) {
      // code 304, « non modifiée » ;
      res.status(304);
      // aucun corps n'est envoyé.
      return;
    // Fin du cas 304.
    }
    // En-tête d'information : niveau de subdivision de la tuile.
    res.setHeader('X-Tri-Level', result.tile.level);
    // Pose l'en-tête
    res.setHeader(
      // X-Tri-Bbox :
      'X-Tri-Bbox',
      // les quatre bords (ouest, sud, est, nord),
      [bbox.west, bbox.south, bbox.east, bbox.north]
        // chacun arrondi à 6 décimales, sans zéros inutiles,
        .map((v) => String(Number(v.toFixed(6))))
        // séparés par des virgules.
        .join(','),
    // Fin de l'en-tête.
    );
    // En-tête d'information : niveau de zoom des tuiles Trek qui ont servi à composer l'image.
    res.setHeader('X-Tri-Source-Zoom', result.sourceZoom);
    // En-tête d'information : HIT si l'image était déjà stockée, MISS si elle vient d'être composée.
    res.setHeader('X-Tri-Cache', result.cached ? 'HIT' : 'MISS');

    // Renvoie l'image en contenu binaire, avec :
    return new StreamableFile(result.bytes, {
      // son type, JPEG ;
      type: 'image/jpeg',
      // sa taille en octets.
      length: result.bytes.length,
    // Fin du contenu binaire.
    });
  // Fin de triTile.
  }

  /** Lancement du téléchargement Trek complet (arrière-plan). */
  // Route POST …/moon-db/prefetch.
  @Post('moon-db/prefetch')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Lancer le téléchargement complet des tuiles Trek', description: 'Le téléchargement se poursuit en arrière-plan ; son avancement se lit sur GET /moon-db/prefetch.' })
  // Le préchargement peut écrire des milliers de tuiles BYTEA : limiter les lancements par IP.
  // Limite propre : un seul lancement par fenêtre de 300 000 ms (5 minutes), par visiteur.
  @Throttle({ default: { limit: 1, ttl: 300_000 } })
  // Méthode startPrefetch : reçoit tous les paramètres de requête, en texte.
  startPrefetch(@Query() query: Record<string, string>) {
    // Lance le préchargement en arrière-plan et renvoie son état, avec ces options :
    return this.db.startPrefetch({
      // niveau de départ, converti en nombre s'il est fourni ;
      minLevel: query.minLevel !== undefined ? Number(query.minLevel) : undefined,
      // niveau d'arrivée, converti en nombre s'il est fourni ;
      maxLevel: query.maxLevel !== undefined ? Number(query.maxLevel) : undefined,
      // nombre de téléchargements simultanés :
      concurrency:
        // converti en nombre s'il est fourni, sinon la valeur par défaut du service.
        query.concurrency !== undefined ? Number(query.concurrency) : undefined,
    // Fin de l'appel.
    });
  // Fin de startPrefetch.
  }

  /** État du téléchargement en cours. */
  // Route GET …/moon-db/prefetch.
  @Get('moon-db/prefetch')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'État du téléchargement Trek en cours' })
  // Méthode prefetchStatus.
  prefetchStatus() {
    // Renvoie l'état du préchargement tenu à jour par le service.
    return this.db.prefetchStatus;
  // Fin de prefetchStatus.
  }
// Fin du contrôleur.
}

// ---------------------------------------------------------------------------
// Helpers — proxy amont (moon)
// ---------------------------------------------------------------------------

// Fonction applyTileHeaders : pose sur la réponse les en-têtes d'une tuile.
function applyTileHeaders(res: Response, result: TileFetchResult): void {
  // Sort du résultat le « modèle » de la tuile (source, couche, emprise, état du cache).
  const { model } = result;
  // Temps de validité restant, en millisecondes :
  const remainingMs =
    // si la tuile vient du cache et n'est pas périmée,
    model.cache && !model.cache.stale
      // sa durée de vie moins son âge, jamais en dessous de 0 ;
      ? Math.max(0, result.ttlMs - model.cache.ageMs)
      // sinon 0.
      : 0;

  // ETag : empreinte de la tuile, que le navigateur renverra dans If-None-Match.
  res.setHeader('ETag', result.etag);
  // Pose l'en-tête
  res.setHeader(
    // Cache-Control :
    'Cache-Control',
    // validité restante en secondes entières, puis sept jours (604 800 s) pendant lesquels une copie périmée reste utilisable le temps d'en redemander une.
    `public, max-age=${Math.floor(remainingMs / 1_000)}, stale-while-revalidate=604800`,
  // Fin de l'en-tête Cache-Control.
  );
  // Pose l'en-tête
  res.setHeader(
    // X-Moon-Cache :
    'X-Moon-Cache',
    // STALE si la copie servie est périmée, HIT si elle vient du cache, MISS si elle vient d'être téléchargée.
    result.cacheStale ? 'STALE' : result.cacheHit ? 'HIT' : 'MISS',
  // Fin de l'en-tête.
  );
  // Identifiant de la source.
  res.setHeader('X-Moon-Provider', model.provider.id);
  // Identifiant de la couche.
  res.setHeader('X-Moon-Layer', model.layer.id);
  // Système de coordonnées de la tuile.
  res.setHeader('X-Moon-Crs', model.crs);
  // Pose l'en-tête
  res.setHeader(
    // X-Moon-Bbox :
    'X-Moon-Bbox',
    // les quatre bords de la tuile (ouest, sud, est, nord),
    [model.bbox.west, model.bbox.south, model.bbox.east, model.bbox.north]
      // chacun arrondi à 6 décimales, sans zéros inutiles,
      .map((value) => String(Number(value.toFixed(6))))
      // séparés par des virgules.
      .join(','),
  // Fin de l'en-tête.
  );
  // Date à laquelle la tuile a été obtenue de la source, au format HTTP.
  res.setHeader('Last-Modified', new Date(model.fetchedAt).toUTCString());

  // Si les dimensions de l'image sont connues :
  if (model.image) {
    // largeur × hauteur en pixels ;
    res.setHeader('X-Moon-Image', `${model.image.width}x${model.image.height}`);
    // empreinte SHA-256 de l'image.
    res.setHeader('X-Moon-Sha256', model.image.sha256);
  // Fin du cas « image connue ».
  }
// Fin de applyTileHeaders.
}

// Fonction etagMatches : l'en-tête If-None-Match désigne-t-il cette empreinte ?
function etagMatches(header: string | undefined, etag: string): boolean {
  // Sans en-tête :
  if (!header) {
    // non.
    return false;
  // Fin du cas.
  }

  // Sinon, prend l'en-tête,
  return header
    // le coupe aux virgules (il peut citer plusieurs empreintes),
    .split(',')
    // retire les espaces autour de chacune,
    .map((value) => value.trim())
    // et répond oui si l'une d'elles
    .some(
      // convient, c'est-à-dire :
      (candidate) =>
        // vaut « * » (n'importe quelle version), l'empreinte exacte, ou sa forme faible « W/… ».
        candidate === '*' || candidate === etag || candidate === `W/${etag}`,
    // Fin du test.
    );
// Fin de etagMatches.
}

// Fonction isTruthy : un paramètre de requête vaut-il « oui » ?
function isTruthy(value: string | undefined): boolean {
  // Vrai seulement pour « 1 », « true » ou « yes » ; absent ou autre valeur : faux.
  return value === '1' || value === 'true' || value === 'yes';
// Fin de isTruthy.
}

// Fonction parseInteger : convertit un texte en entier, ou refuse.
function parseInteger(value: string, name: string): number {
  // Si le texte n'est pas fait uniquement de chiffres, avec un signe moins facultatif :
  if (!/^-?\d+$/.test(value)) {
    // erreur 400,
    throw new BadRequestException(
      // avec le nom du paramètre fautif.
      `Paramètre ${name} invalide : entier attendu.`,
    // Fin de l'erreur.
    );
  // Fin de la vérification.
  }
  // Convertit le texte en nombre.
  return Number(value);
// Fin de parseInteger.
}

// Fonction parseOptionalInteger ; ses paramètres :
function parseOptionalInteger(
  // la valeur, peut-être absente ;
  value: string | undefined,
  // le nom du paramètre, pour le message d'erreur.
  name: string,
// Elle renvoie un entier, ou undefined.
): number | undefined {
  // Valeur absente ou vide :
  if (value === undefined || value === '') {
    // undefined, le service prendra sa valeur par défaut.
    return undefined;
  // Fin du cas.
  }
  // Sinon conversion stricte en entier.
  return parseInteger(value, name);
// Fin de parseOptionalInteger.
}

// Fonction parseRequiredNumber : nombre obligatoire.
function parseRequiredNumber(value: string | undefined, name: string): number {
  // Convertit la valeur si elle est présente.
  const parsed = parseOptionalNumber(value, name);
  // Si elle est absente :
  if (parsed === undefined) {
    // erreur 400, paramètre requis.
    throw new BadRequestException(`Paramètre ${name} requis.`);
  // Fin du cas.
  }
  // Renvoie le nombre.
  return parsed;
// Fin de parseRequiredNumber.
}

// Fonction parseOptionalNumber ; ses paramètres :
function parseOptionalNumber(
  // la valeur, peut-être absente ;
  value: string | undefined,
  // le nom du paramètre.
  name: string,
// Elle renvoie un nombre, ou undefined.
): number | undefined {
  // Valeur absente ou vide :
  if (value === undefined || value === '') {
    // undefined.
    return undefined;
  // Fin du cas.
  }

  // Convertit le texte en nombre (décimales acceptées).
  const parsed = Number(value);
  // Si le résultat n'est pas un nombre fini (texte illisible, infini) :
  if (!Number.isFinite(parsed)) {
    // erreur 400,
    throw new BadRequestException(
      // avec le nom du paramètre fautif.
      `Paramètre ${name} invalide : nombre attendu.`,
    // Fin de l'erreur.
    );
  // Fin de la vérification.
  }

  // Renvoie le nombre.
  return parsed;
// Fin de parseOptionalNumber.
}

// Fonction parseBBox : convertit « ouest,sud,est,nord » en emprise.
function parseBBox(value: string | undefined): BBox | undefined {
  // Valeur absente ou vide :
  if (value === undefined || value === '') {
    // undefined, pas d'emprise.
    return undefined;
  // Fin du cas.
  }

  // Coupe aux virgules et convertit chaque morceau en nombre, espaces retirés.
  const parts = value.split(',').map((part) => Number(part.trim()));
  // S'il n'y a pas exactement quatre nombres finis :
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    // erreur 400,
    throw new BadRequestException(
      // avec le format attendu.
      'Paramètre bbox invalide : format attendu west,south,east,north.',
    // Fin de l'erreur.
    );
  // Fin de la vérification.
  }

  // Renvoie l'emprise, les quatre nombres nommés dans l'ordre.
  return { west: parts[0], south: parts[1], east: parts[2], north: parts[3] };
// Fin de parseBBox.
}

// ---------------------------------------------------------------------------
// Helpers — stockage Trek (moon-db)
// ---------------------------------------------------------------------------

// Fonction parseZoom : convertit un niveau de zoom en entier positif.
function parseZoom(value: string): number {
  // Si le texte n'est pas fait uniquement de chiffres :
  if (!/^\d+$/.test(value)) {
    // erreur 400.
    throw new BadRequestException('Zoom invalide.');
  // Fin de la vérification.
  }
  // Convertit le texte en nombre.
  return Number(value);
// Fin de parseZoom.
}

// Fonction parseIndex : convertit un numéro de colonne ou de ligne en entier positif.
function parseIndex(value: string): number {
  // Si le texte n'est pas fait uniquement de chiffres :
  if (!/^\d+$/.test(value)) {
    // erreur 400.
    throw new BadRequestException('Indice invalide.');
  // Fin de la vérification.
  }
  // Convertit le texte en nombre.
  return Number(value);
// Fin de parseIndex.
}
