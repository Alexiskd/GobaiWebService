// Ouvre la liste des outils NestJS importés :
import {
  // décorateur de contrôleur ;
  Controller,
  // route GET ;
  Get,
  // en-tête de réponse fixe ;
  Header,
  // erreur 404 ;
  NotFoundException,
  // paramètre de l'adresse ;
  Param,
  // paramètre de requête (après le « ? ») ;
  Query,
  // accès à la requête brute ;
  Req,
  // accès à la réponse brute.
  Res,
// Fin de l'import.
} from '@nestjs/common';
// SkipThrottle : dispense une route de la limite de débit.
import { SkipThrottle } from '@nestjs/throttler';
// Ouvre la liste des décorateurs Swagger importés :
import {
  // réponses 502, 400, 302, 204, 404 et 200, et description d'une route ;
  ApiBadGatewayResponse, ApiBadRequestResponse, ApiFoundResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation,
  // paramètre documenté et rubrique.
  ApiParam, ApiTags,
// Fin de l'import.
} from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Ouvre l'import de l'envoi de tuiles partagé :
import {
  // les règles de cache de chaque famille de tuiles (nuages, Terre, Terre de repli, Mars, Lune, satellites), la fonction sendTile et les types de requête et de réponse.
  CLOUD_TILE, EARTH_FALLBACK_TILE, EARTH_TILE, MARS_TILE, MOON_TILE, SATELLITE_TILE, sendTile, type TileRequest, type TileResponse,
// Fin de l'import.
} from '../common/tile-http';
// Ouvre l'import des formes de données des tuiles :
import {
  // sources, villes du LiDAR HD, préchargement de la Lune, paramètres d'une tuile de la Lune, requête de sources, localisation et sa requête, couche résolue, liste des couches, paramètres d'une tuile.
  AttributionDto, LidarHdCitiesDto, MoonPrefetchStatusDto, MoonTileParamsDto, AttributionQueryDto, LocateDto, LocateQueryDto, ResolvedTileLayerDto, TileLayerListDto, TileParamsDto,
// Fin de l'import.
} from '../dto/tiles.dto';
// Service principal des tuiles : couches, modèles d'adresse, sources.
import { TilesService } from '../services/map-tiles/map-imagery.service';
// Service de la texture en couleurs naturelles de la Lune.
import { MoonColorService } from '../services/map-tiles/moon-color.service';
// Service du cache disque des tuiles de la Lune.
import { MoonTileCacheService } from '../services/map-tiles/moon-tile-cache.service';
// Service du modèle 3D de la Lune.
import { MoonModelService } from '../services/map-tiles/moon-model.service';
// Service des modèles 3D des autres astres.
import { BodyModelService } from '../services/map-tiles/body-model.service';
// Service des cartes des satellites naturels et des géantes gazeuses.
import { SatelliteTilesService } from '../services/map-tiles/satellite-tiles.service';
// Service qui teste si un astre a une carte NASA Trek.
import { BodyAvailabilityService } from '../services/map-tiles/body-availability.service';
// Service de l'imagerie de la Terre (couche unique, plusieurs sources).
import { EarthImageryService } from '../services/map-tiles/earth-imagery.service';
// Service des nuages réels (Xweather).
import { XweatherCloudsService } from '../services/map-tiles/xweather-clouds.service';
// Service des vents réels (Open-Meteo).
import { EarthWindService } from '../services/map-tiles/earth-wind.service';
// Service de la couverture nuageuse (Open-Meteo).
import { EarthCloudCoverService } from '../services/map-tiles/earth-cloud-cover.service';
// Service de l'image mélangée de Mars et identifiant de sa couche.
import { MarsBlendService, MARS_BLEND_LAYER_ID } from '../services/mars/mars-blend.service';
// Ouvre l'import de la fusion de Mars :
import {
  // fonction qui retrouve un algorithme de fusion d'après son nom court dans l'adresse ;
  getMarsFusionAlgorithmBySlug,
  // service qui calcule les tuiles de fusion.
  MarsFusionService,
// Fin de l'import.
} from '../services/mars/mars-fusion.service';

/** Sous-ensemble de la réponse Express dont on a besoin (évite une dépendance de types). */
// Interface minimale de la réponse pour une route qui ne fait que poser un en-tête et un code :
interface StatusResponse {
  // poser un en-tête ;
  setHeader(name: string, value: string): unknown;
  // fixer le code de réponse.
  status(code: number): unknown;
// Fin de StatusResponse.
}

// Interface minimale de la réponse pour une route qui envoie un contenu ou redirige :
interface RedirectableResponse {
  // poser un en-tête ;
  setHeader(name: string, value: string): unknown;
  // rediriger vers une autre adresse avec un code donné ;
  redirect(status: number, url: string): unknown;
  // envoyer le corps.
  send(body: unknown): unknown;
// Fin de RedirectableResponse.
}

/**
 * Modèle de tuiles simplifié, identique quel que soit le fournisseur :
 *   1. `GET layers`            → quelles couches existent ;
 *   2. `GET layers/{id}`       → modèle d'URL `…/{z}/{x}/{y}…` prêt à l'emploi, avec sa date d'expiration ;
 *   3. `GET layers/{id}/attribution` → mention de sources à afficher.
 * Les images sont chargées directement chez le fournisseur : ce service ne les relaie ni ne les stocke.
 */
// Rubrique « Tuiles » de la documentation.
@ApiTags('Tuiles')
// Routes sous /api/v1/tiles.
@Controller('tiles')
// Classe du contrôleur des tuiles.
export class TilesController {
  // Constructeur : NestJS y injecte treize services, gardés en propriétés privées non modifiables.
  constructor(
    // Le service principal des tuiles.
    private readonly tiles: TilesService,
    // Les couleurs de la Lune.
    private readonly moonColor: MoonColorService,
    // Le cache des tuiles de la Lune.
    private readonly moonTiles: MoonTileCacheService,
    // Le modèle 3D de la Lune.
    private readonly moonModel: MoonModelService,
    // Les modèles 3D des autres astres.
    private readonly bodyModels: BodyModelService,
    // L'image mélangée de Mars.
    private readonly marsBlend: MarsBlendService,
    // Les fusions de Mars.
    private readonly marsFusion: MarsFusionService,
    // Les cartes des satellites.
    private readonly satellites: SatelliteTilesService,
    // Le test de disponibilité des astres.
    private readonly availability: BodyAvailabilityService,
    // L'imagerie de la Terre.
    private readonly earth: EarthImageryService,
    // Les nuages Xweather.
    private readonly xweatherClouds: XweatherCloudsService,
    // Les vents.
    private readonly earthWind: EarthWindService,
    // La couverture nuageuse.
    private readonly earthCloudCover: EarthCloudCoverService,
  // Corps du constructeur vide.
  ) {}

  // Route GET /api/v1/tiles/moon-color.jpg.
  @Get('moon-color.jpg')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Texture des couleurs naturelles de la Lune',
    // son texte.
    description: 'NASA SVS CGI Moon Kit (couleurs LROC réglées pour la vision humaine), 2:1 équirectangulaire. Relayée et gardée en mémoire.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une image.
  @ApiOkResponse({ description: 'Image JPEG (ou PNG selon MOON_COLOR_URL).' })
  // Réponse 502 documentée : image introuvable chez la NASA et dans les secours.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode moonColorTexture, asynchrone : remplit elle-même la réponse.
  async moonColorTexture(@Res() res: RedirectableResponse): Promise<void> {
    // Attend la texture (octets et type) auprès du service, qui la garde sur le disque.
    const t = await this.moonColor.get();
    // Type de l'image (JPEG ou PNG).
    res.setHeader('Content-Type', t.contentType);
    // Cache public d'une semaine (604 800 s).
    res.setHeader('Cache-Control', 'public, max-age=604800');
    // Envoie l'image.
    res.send(t.body);
  // Fin de moonColorTexture.
  }

  // Route GET /api/v1/tiles/satellites/status.
  @Get('satellites/status')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Satellites dont la carte NASA Trek est prête',
    // son texte.
    description: 'Pour chaque satellite : source de la carte (trek, usgs ou null). Le client n’affiche que ceux en trek.',
  // Fin de la description.
  })
  // Cache public d'une minute.
  @Header('Cache-Control', 'public, max-age=60')
  // Méthode satellitesStatus.
  satellitesStatus() {
    // Renvoie, pour chaque satellite, la source de sa carte.
    return this.satellites.status();
  // Fin de satellitesStatus.
  }

  // Route GET /api/v1/tiles/bodies/availability.
  @Get('bodies/availability')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Test avant affichage : carte NASA Trek de chaque planète et satellite (orbites par Kepler)',
    // début de son texte ;
    description: '`ready` = `trek`. Le client n’ajoute au moteur que les satellites `ready`. '
      // suite du texte.
      + '`null` = test pas encore terminé (au démarrage du serveur).',
  // Fin de la description.
  })
  // Cache public d'une minute.
  @Header('Cache-Control', 'public, max-age=60')
  // Méthode bodiesAvailability.
  bodiesAvailability() {
    // Renvoie le résultat du test de chaque planète et satellite.
    return this.availability.all();
  // Fin de bodiesAvailability.
  }

  // Route GET /api/v1/tiles/satellites/:body/layers.
  @Get('satellites/:body/layers')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Toutes les couches NASA Trek d’un satellite ou d’une géante gazeuse',
    // son texte.
    description: 'Couches découvertes dans NASA Solar System Treks (WMTS et annuaire ArcGIS des portails), puis USGS en secours.',
  // Fin de la description.
  })
  // Documente le paramètre body, avec un exemple.
  @ApiParam({ name: 'body', example: 'titan' })
  // Cache public de 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  // Méthode satelliteLayers : reçoit le nom de l'astre.
  satelliteLayers(@Param('body') body: string) {
    // Renvoie toutes les couches trouvées pour cet astre.
    return this.satellites.bodyLayers(body);
  // Fin de satelliteLayers.
  }

  // Route GET /api/v1/tiles/layers.
  @Get('layers')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Lister les couches de tuiles',
    // son texte.
    description: 'Point de départ : donne le fournisseur actif et les couches disponibles (satellite, plan, relief…).',
  // Fin de la description.
  })
  // Réponse 200 documentée : un TileLayerListDto.
  @ApiOkResponse({ type: TileLayerListDto })
  // Méthode layers.
  layers(): TileLayerListDto {
    // Renvoie le fournisseur actif et la liste des couches.
    return this.tiles.list();
  // Fin de layers.
  }

  // Route GET /api/v1/tiles/layers/:layerId.
  @Get('layers/:layerId')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Obtenir le modèle d’URL d’une couche',
    // son texte.
    description: 'Renvoie `urlTemplate` avec {z}/{x}/{y}. Redemandez-le avant `expiresAt`, ou si une tuile répond 400/403.',
  // Fin de la description.
  })
  // Documente le paramètre layerId, avec un exemple.
  @ApiParam({ name: 'layerId', example: 'satellite' })
  // Réponse 200 documentée : un ResolvedTileLayerDto.
  @ApiOkResponse({ type: ResolvedTileLayerDto })
  // Réponse 404 documentée : couche inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Couche inconnue (le message liste les couches valides).' })
  // Réponse 502 documentée : fournisseur en échec.
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Le fournisseur a refusé ou n’a pas répondu.' })
  // Méthode layer : reçoit l'identifiant de la couche.
  layer(@Param('layerId') layerId: string): Promise<ResolvedTileLayerDto> {
    // Renvoie le modèle d'adresse {z}/{x}/{y} de la couche et sa date d'expiration.
    return this.tiles.resolve(layerId);
  // Fin de layer.
  }

  // Route GET /api/v1/tiles/layers/:layerId/attribution.
  @Get('layers/:layerId/attribution')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Sources de données de la zone visible',
    // son texte.
    description: 'Mention de source de la couche active, à actualiser lorsque la zone visible change.',
  // Fin de la description.
  })
  // Documente le paramètre layerId.
  @ApiParam({ name: 'layerId', example: 'satellite' })
  // Réponse 200 documentée : un AttributionDto.
  @ApiOkResponse({ type: AttributionDto })
  // Réponse 400 documentée : paramètres invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Réponse 404 documentée : couche inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode attribution : reçoit l'identifiant de la couche et les paramètres de requête validés (zone visible).
  attribution(@Param('layerId') layerId: string, @Query() q: AttributionQueryDto): Promise<AttributionDto> {
    // Renvoie la mention de sources à afficher pour cette zone.
    return this.tiles.attribution(layerId, q);
  // Fin de attribution.
  }

  // Route GET /api/v1/tiles/locate.
  @Get('locate')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Quelle tuile contient ce point ?',
    // son texte.
    description: 'Convertit latitude/longitude/zoom en coordonnées de tuile {z}/{x}/{y} et en emprise. Pratique pour comprendre le schéma.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un LocateDto.
  @ApiOkResponse({ type: LocateDto })
  // Réponse 400 documentée : coordonnées invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Méthode locate : reçoit les paramètres de requête validés.
  locate(@Query() q: LocateQueryDto): Promise<LocateDto> {
    // Renvoie la tuile qui contient le point (latitude, longitude, zoom) dans la couche demandée.
    return this.tiles.locate(q.lat, q.lon, q.zoom, q.layer);
  // Fin de locate.
  }

  // Route GET /api/v1/tiles/moon-model.glb.
  @Get('moon-model.glb')
  // Pas de limite de débit.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Modèle 3D de la Lune (NASA, glTF binaire)',
    // son texte.
    description: 'Modèle officiel NASA (couleurs LRO et relief), relayé et gardé sur le disque du serveur. Source : `MOON_MODEL_URL`.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un fichier GLB.
  @ApiOkResponse({ description: 'Fichier GLB.' })
  // Réponse 502 documentée : modèle introuvable chez la NASA.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode moonModelFile, asynchrone : remplit elle-même la réponse.
  async moonModelFile(@Res() res: RedirectableResponse): Promise<void> {
    // Attend le modèle (octets et type) auprès du service, qui le garde sur le disque.
    const m = await this.moonModel.get();
    // Type du fichier.
    res.setHeader('Content-Type', m.contentType);
    // Cache public d'une semaine.
    res.setHeader('Cache-Control', 'public, max-age=604800');
    // Envoie le fichier.
    res.send(m.body);
  // Fin de moonModelFile.
  }

  // Route GET /api/v1/tiles/models/:file.
  @Get('models/:file')
  // Pas de limite de débit.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Modèle 3D d’un astre irrégulier (NASA, glTF binaire)',
    // son texte.
    description: 'Modèle officiel NASA relayé et gardé sur le disque du serveur. Aujourd’hui : `phobos.glb` et `deimos.glb`.',
  // Fin de la description.
  })
  // Documente le paramètre file, avec un exemple.
  @ApiParam({ name: 'file', example: 'phobos.glb' })
  // Réponse 200 documentée : un fichier GLB.
  @ApiOkResponse({ description: 'Fichier GLB.' })
  // Réponse 404 documentée : astre sans modèle.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : modèle introuvable chez la NASA.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode bodyModelFile : reçoit le nom du fichier et la réponse.
  async bodyModelFile(@Param('file') file: string, @Res() res: RedirectableResponse): Promise<void> {
    // Retire l'extension .glb (majuscules ou minuscules), met le nom en minuscules, et attend le modèle de cet astre.
    const m = await this.bodyModels.get(file.replace(/\.glb$/i, '').toLowerCase());
    // Type du fichier.
    res.setHeader('Content-Type', m.contentType);
    // Cache public d'une semaine.
    res.setHeader('Cache-Control', 'public, max-age=604800');
    // Envoie le fichier.
    res.send(m.body);
  // Fin de bodyModelFile.
  }

  // Route GET /api/v1/tiles/moon/prefetch, déclarée avant « moon/:layerId/… ».
  @Get('moon/prefetch')
  // Titre et description de la route.
  @ApiOperation({ summary: 'Avancement du préchargement de la Lune', description: 'Tuiles déjà enregistrées sur le disque du serveur.' })
  // Réponse 200 documentée : un MoonPrefetchStatusDto.
  @ApiOkResponse({ type: MoonPrefetchStatusDto })
  // Méthode moonPrefetch.
  moonPrefetch(): MoonPrefetchStatusDto {
    // Renvoie l'avancement du préchargement des tuiles de la Lune.
    return this.moonTiles.status();
  // Fin de moonPrefetch.
  }

  // Route GET /api/v1/tiles/<identifiant de la couche Mars blend>/:z/:x/:y ; l'identifiant vient de la constante importée.
  @Get(`${MARS_BLEND_LAYER_ID}/:z/:x/:y`)
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile du fond Mars Viking + CTX',
    // son texte, sur la ligne suivante :
    description:
      // le texte.
      'Extrait une tuile 512 × 512 de la fusion Viking MDIM21 et CTX recolorée.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une tuile PNG.
  @ApiOkResponse({ description: 'Tuile PNG de la couche Mars blend.' })
  // Réponse 400 documentée : coordonnées invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : sources de Mars injoignables.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode marsBlendTile, asynchrone ; ses paramètres :
  async marsBlendTile(
    // le niveau de zoom z, en texte ;
    @Param('z') z: string,
    // la colonne x, en texte ;
    @Param('x') x: string,
    // la ligne y, en texte ;
    @Param('y') y: string,
    // la requête (pour lire If-None-Match) ;
    @Req() req: TileRequest,
    // la réponse.
    @Res() res: TileResponse,
  // Elle ne renvoie rien : la réponse est remplie par sendTile.
  ): Promise<void> {
    // Attend la tuile découpée dans l'image mélangée, avec :
    const tile = await this.marsBlend.getBlendTile(
      // z converti en nombre ;
      parseTileCoordinate(z),
      // x converti en nombre ;
      parseTileCoordinate(x),
      // y converti en nombre.
      parseTileCoordinate(y),
    // Fin de l'appel.
    );
    // Envoie la tuile en PNG avec la règle de cache des tuiles de Mars (ou un 304 si le navigateur l'a déjà).
    sendTile(req, res, { body: tile, contentType: 'image/png' }, MARS_TILE);
  // Fin de marsBlendTile.
  }

  // Route GET /api/v1/tiles/mars-fusion/:algorithm/:z/:x/:y.
  @Get('mars-fusion/:algorithm/:z/:x/:y')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile d’une fusion Viking + CTX',
    // son texte, sur la ligne suivante :
    description:
      // le texte.
      'Calcule une tuile 512 × 512 avec l’algorithme de fusion sélectionné.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une tuile PNG.
  @ApiOkResponse({ description: 'Tuile PNG de la couche de fusion Mars.' })
  // Réponse 400 documentée : coordonnées invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : sources de Mars injoignables.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode marsFusionTile, asynchrone ; ses paramètres :
  async marsFusionTile(
    // le nom court de l'algorithme, rangé dans slug ;
    @Param('algorithm') slug: string,
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // la requête ;
    @Req() req: TileRequest,
    // la réponse.
    @Res() res: TileResponse,
  // Elle ne renvoie rien.
  ): Promise<void> {
    // Cherche l'algorithme de fusion qui porte ce nom court.
    const algorithm = getMarsFusionAlgorithmBySlug(slug);
    // S'il n'existe pas :
    if (!algorithm) {
      // erreur 404 qui cite le nom reçu.
      throw new NotFoundException(`Algorithme de fusion Mars inconnu : ${slug}.`);
    // Fin du cas.
    }
    // Attend la tuile calculée par le service de fusion, avec :
    const tile = await this.marsFusion.getTile(
      // le nom complet de l'algorithme ;
      algorithm.name,
      // z converti en nombre ;
      parseTileCoordinate(z),
      // x converti en nombre ;
      parseTileCoordinate(x),
      // y converti en nombre.
      parseTileCoordinate(y),
    // Fin de l'appel.
    );
    // Envoie la tuile en PNG avec la règle de cache des tuiles de Mars.
    sendTile(req, res, { body: tile, contentType: 'image/png' }, MARS_TILE);
  // Fin de marsFusionTile.
  }

  // Route GET /api/v1/tiles/satellite/:body/:z/:x/:y.
  @Get('satellite/:body/:z/:x/:y')
  // Pas de limite de débit : une vue demande beaucoup de tuiles à la suite.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile d’un satellite ou d’une géante gazeuse (paramètre `layer` : couche Trek choisie)',
    // son texte.
    description: 'Relayée depuis NASA Solar System Treks (ou USGS Astrogeology en secours) et gardée en mémoire.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une image.
  @ApiOkResponse({ description: 'Image JPEG ou PNG de la tuile.' })
  // Réponse 404 documentée : astre ou couche inconnus.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : source injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode satelliteTile, asynchrone ; ses paramètres :
  async satelliteTile(
    // le nom de l'astre ;
    @Param('body') body: string,
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // le paramètre de requête layer : la couche choisie, facultative ;
    @Query('layer') layer: string | undefined,
    // la requête ;
    @Req() req: TileRequest,
    // la réponse.
    @Res() res: TileResponse,
  // Elle ne renvoie rien.
  ): Promise<void> {
    // Attend la tuile auprès du service (cache mémoire, puis NASA Trek ou USGS), coordonnées converties en nombres.
    const tile = await this.satellites.tile(body, parseTileCoordinate(z), parseTileCoordinate(x), parseTileCoordinate(y), layer);
    // Envoie la tuile avec la règle de cache des satellites (une semaine, immuable).
    sendTile(req, res, tile, SATELLITE_TILE);
  // Fin de satelliteTile.
  }

  // Route GET /api/v1/tiles/earth-wind.
  @Get('earth-wind')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Vents réels du moment sur la Terre (Open-Meteo)',
    // début de son texte (la grille et ses unités) ;
    description: 'Grille mondiale tous les 20° (18 × 9 points, lignes du sud au nord) : vitesse vers l’est `u` et vers le nord '
      // suite (altitude de la mesure, rafraîchissement) ;
      + '`v` en m/s, à 700 hPa si disponible, sinon à 10 m. Rafraîchie toutes les 3 heures. Le site s’en sert pour '
      // suite (réponse 204 si la source est injoignable) ;
      + 'entraîner les nuages ; 204 sans contenu si la source est injoignable ou son quota épuisé (le site garde alors '
      // fin du texte.
      + 'son modèle de vents).',
  // Fin de la description.
  })
  // Réponse 204 documentée : vents indisponibles.
  @ApiNoContentResponse({ description: 'Vents indisponibles pour le moment.' })
  // Méthode earthWindGrid, asynchrone ; la réponse est en mode passthrough (NestJS envoie la valeur renvoyée).
  async earthWindGrid(@Res({ passthrough: true }) res: StatusResponse) {
    // Essaie :
    try {
      // d'obtenir la grille des vents (gardée 3 heures en mémoire par le service) ;
      const grid = await this.earthWind.get();
      // cache public de 30 minutes (1 800 s) ;
      res.setHeader('Cache-Control', 'public, max-age=1800');
      // et renvoie la grille, en JSON.
      return grid;
    // En cas d'échec, quelle qu'en soit la cause :
    } catch {
      // Donnée facultative : pas d'erreur dans la console du navigateur, le site garde son modèle de vents.
      // cache public de 5 minutes, pour ne pas réinterroger la source à chaque visiteur ;
      res.setHeader('Cache-Control', 'public, max-age=300');
      // code 204, « pas de contenu », plutôt qu'une erreur ;
      res.status(204);
      // rien n'est renvoyé.
      return undefined;
    // Fin du cas d'échec.
    }
  // Fin de earthWindGrid.
  }

  // Route GET /api/v1/tiles/earth-clouds/cover.
  @Get('earth-clouds/cover')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Couverture nuageuse du moment sur la Terre (Open-Meteo)',
    // début de son texte (la grille) ;
    description: 'Grille mondiale de 24 × 12 cases de 15° : couverture totale calculée par les modèles météo pour l’heure '
      // suite (format : un octet par case, en base64) ;
      + 'en cours, un octet par case en base64 (0 = ciel clair, 255 = couvert), lignes du sud au nord depuis 180° Ouest. '
      // suite (rafraîchissement, rôle de seconde source) ;
      + 'Sans clé, rafraîchie toutes les heures. Seconde source de nuages réels du site, quand l’image satellite '
      // fin du texte.
      + 'Xweather n’est pas disponible ; 502 si Open-Meteo est injoignable.',
  // Fin de la description.
  })
  // Réponse 502 documentée : Open-Meteo injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Cache public de 15 minutes (900 s).
  @Header('Cache-Control', 'public, max-age=900')
  // Méthode earthCloudCoverGrid.
  earthCloudCoverGrid() {
    // Renvoie la grille de couverture nuageuse (gardée une heure en mémoire par le service).
    return this.earthCloudCover.get();
  // Fin de earthCloudCoverGrid.
  }

  // Route GET /api/v1/tiles/earth-clouds/xweather/:z/:x/:y.
  @Get('earth-clouds/xweather/:z/:x/:y')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile des nuages de la Terre vus par satellite (Xweather)',
    // début de son texte ;
    description: 'Relaie une tuile Web Mercator de la couche satellite de Xweather Raster Maps (niveaux 0 à 3), gardée '
      // fin du texte.
      + '30 minutes en mémoire. Les identifiants restent sur le serveur. 503 sans identifiants Xweather.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une tuile PNG.
  @ApiOkResponse({ description: 'Tuile PNG.' })
  // Réponse 400 documentée : coordonnées invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : Xweather injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode xweatherCloudTile, asynchrone ; ses paramètres :
  async xweatherCloudTile(
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // la requête ;
    @Req() req: TileRequest,
    // la réponse.
    @Res() res: TileResponse,
  // Elle ne renvoie rien.
  ): Promise<void> {
    // Attend la tuile de nuages auprès du service (qui garde les identifiants et un cache de 30 minutes), coordonnées converties en nombres.
    const tile = await this.xweatherClouds.tile(parseTileCoordinate(z), parseTileCoordinate(x), parseTileCoordinate(y));
    // Envoie la tuile avec la règle de cache des nuages (un quart d'heure).
    sendTile(req, res, tile, CLOUD_TILE);
  // Fin de xweatherCloudTile.
  }

  // Route GET /api/v1/tiles/lidar-hd/cities, déclarée avant la route attrape-tout « :layerId/:z/:x/:y ».
  @Get('lidar-hd/cities')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Villes de France où le LiDAR HD de l’IGN est proposé',
    // début de son texte ;
    description: 'Villes de la métropole, de la Corse et des cinq départements et régions d’outre-mer, dans l’ordre '
      // suite du texte ;
      + 'd’importance, avec l’altitude d’arrivée conseillée. Choisir une ville allume le calque LiDAR HD et s’y rend : '
      // fin du texte.
      + 'les tuiles sont alors chargées en direct chez l’IGN, sans téléchargement de dalle.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un LidarHdCitiesDto.
  @ApiOkResponse({ type: LidarHdCitiesDto })
  // Données fixes : gardées une journée par le navigateur et les relais.
  @Header('Cache-Control', 'public, max-age=86400')
  // Méthode lidarHdCities.
  lidarHdCities(): LidarHdCitiesDto {
    // Renvoie les villes et l'altitude d'arrivée.
    return this.tiles.lidarCities();
  // Fin de lidarHdCities.
  }

  // Route GET /api/v1/tiles/earth/sources, déclarée avant « earth/:layerId/… ».
  @Get('earth/sources')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Sources d’imagerie de la couche unique de la Terre',
    // début de son texte ;
    description: 'Sources actives (sans clé, ou dont la clé est configurée), niveaux servis, source écartée ou non, '
      // fin du texte.
      + 'réussites, échecs et latence moyenne depuis le démarrage. Les clés ne sont jamais renvoyées.',
  // Fin de la description.
  })
  // no-store : jamais mis en cache, ce sont des compteurs en direct.
  @Header('Cache-Control', 'no-store')
  // Méthode earthSources.
  earthSources() {
    // Renvoie l'état de chaque source d'imagerie de la Terre.
    return this.earth.status();
  // Fin de earthSources.
  }

  // Route GET /api/v1/tiles/earth/:layerId/:z/:x/:y.
  @Get('earth/:layerId/:z/:x/:y')
  // Pas de limite de débit.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile satellite HD de la Terre (couche unique)',
    // début de son texte (les sources) ;
    description: 'earth-hd : la meilleure source pour chaque tuile parmi toutes celles actives (orthophotos nationales de quatorze pays, Sentinel-2, NASA GIBS), '
      // suite (cascade, niveau maximal) ;
      + 'interrogées en cascade rapprochée, jusqu’au niveau 19 (au-delà du niveau natif, la tuile est '
      // fin (en-tête X-Tile-Source).
      + 'découpée dans son ancêtre et agrandie). En-tête X-Tile-Source : source qui a servi la tuile.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une image JPEG.
  @ApiOkResponse({ description: 'Image JPEG de la tuile.' })
  // Réponse 404 documentée : couche inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : aucune source n'a répondu.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode earthTile, asynchrone ; ses paramètres :
  async earthTile(
    // l'identifiant de la couche ;
    @Param('layerId') layerId: string,
    // le niveau de zoom z ;
    @Param('z') z: string,
    // la colonne x ;
    @Param('x') x: string,
    // la ligne y ;
    @Param('y') y: string,
    // la requête ;
    @Req() req: TileRequest,
    // la réponse.
    @Res() res: TileResponse,
  // Elle ne renvoie rien.
  ): Promise<void> {
    // Attend la tuile auprès du service, qui choisit la meilleure source pour cet endroit ; coordonnées converties en nombres.
    const tile = await this.earth.tile(layerId, parseTileCoordinate(z), parseTileCoordinate(x), parseTileCoordinate(y));
    // Source de repli (cascade, panne) : cache court, pour que la meilleure image revienne ensuite.
    // Envoie la tuile : cache long (une semaine) si elle vient de la source préférée, cache court (dix minutes) si elle vient d'une source de repli ; l'en-tête X-Tile-Source nomme la source.
    sendTile(req, res, tile, tile.preferred ? EARTH_TILE : EARTH_FALLBACK_TILE, { 'X-Tile-Source': tile.source });
  // Fin de earthTile.
  }

  // Route GET /api/v1/tiles/moon/:layerId/:z/:x/:y.
  @Get('moon/:layerId/:z/:x/:y')
  // Pas de limite de débit.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Tuile de la Lune (cache disque)',
    // son texte.
    description: 'Servie depuis la mémoire ou le disque du serveur, en WebP ; téléchargée une seule fois chez NASA Moon Trek, reconstruite puis enregistrée.',
  // Fin de la description.
  })
  // Réponse 200 documentée : une image WebP.
  @ApiOkResponse({ description: 'Image WebP de la tuile (PNG si la recompression est indisponible).' })
  // Réponse 404 documentée : couche inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Réponse 502 documentée : NASA Moon Trek injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode moonTile : reçoit les paramètres validés et convertis (couche, z, x, y), la requête et la réponse.
  async moonTile(@Param() p: MoonTileParamsDto, @Req() req: TileRequest, @Res() res: TileResponse): Promise<void> {
    // Attend la tuile auprès du cache ; ahead : les quatre tuiles du niveau suivant sont préparées d'avance.
    const tile = await this.moonTiles.get(p.layerId, p.z, p.x, p.y, { ahead: true });
    // Les mosaïques ne changent pas (l'adresse porte un numéro de version) : le navigateur garde la tuile un an sans redemander.
    // Envoie la tuile avec la règle de cache de la Lune (un an, immuable) ; X-Cache dit si elle était déjà en cache (HIT) ou non (MISS).
    sendTile(req, res, tile, MOON_TILE, { 'X-Cache': tile.cached ? 'HIT' : 'MISS' });
  // Fin de moonTile.
  }

  // Route GET /api/v1/tiles/:layerId/:z/:x/:y, déclarée en dernier : elle attrape tout ce que les routes précédentes n'ont pas pris.
  @Get(':layerId/:z/:x/:y')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Accéder à une tuile précise',
    // son texte.
    description: 'Répond par une redirection 302 vers l’image chez le fournisseur. Aucune image ne transite par ce service.',
  // Fin de la description.
  })
  // Réponse 302 documentée : redirection.
  @ApiFoundResponse({ description: 'Redirection vers l’image de la tuile.' })
  // Réponse 400 documentée : zoom ou coordonnées hors limites.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Zoom ou coordonnées hors limites.' })
  // Réponse 404 documentée : couche inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode tile : reçoit les paramètres validés et la réponse.
  async tile(@Param() p: TileParamsDto, @Res() res: RedirectableResponse): Promise<void> {
    // Attend l'adresse de l'image chez le fournisseur.
    const url = await this.tiles.tileUrl(p.layerId, p.z, p.x, p.y);
    // no-store : la redirection n'est pas mise en cache, l'adresse peut expirer.
    res.setHeader('Cache-Control', 'no-store');
    // Redirige le navigateur (code 302) vers cette adresse.
    res.redirect(302, url);
  // Fin de tile.
  }
// Fin du contrôleur.
}

// Fonction parseTileCoordinate : convertit une coordonnée de tuile reçue en texte.
function parseTileCoordinate(value: string): number {
  // Si le texte n'est pas fait uniquement de chiffres :
  if (!/^\d+$/.test(value)) {
    // renvoie NaN (« pas un nombre ») ; c'est le service qui refusera la coordonnée.
    return Number.NaN;
  // Fin du cas.
  }
  // Sinon convertit le texte en nombre.
  return Number(value);
// Fin de parseTileCoordinate.
}
