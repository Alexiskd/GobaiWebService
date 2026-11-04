import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadGatewayResponse, ApiBadRequestResponse, ApiFoundResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation,
  ApiParam, ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import {
  AttributionDto, MoonPrefetchStatusDto, MoonTileParamsDto, AttributionQueryDto, LocateDto, LocateQueryDto, ResolvedTileLayerDto, TileLayerListDto, TileParamsDto,
} from '../dto/tiles.dto';
import { TilesService } from '../services/map-tiles/map-imagery.service';
import { MoonColorService } from '../services/map-tiles/moon-color.service';
import { MoonTileCacheService } from '../services/map-tiles/moon-tile-cache.service';
import { MoonModelService } from '../services/map-tiles/moon-model.service';
import { MarsBlendService, MARS_BLEND_LAYER_ID } from '../services/mars/mars-blend.service';
import {
  getMarsFusionAlgorithmBySlug,
  MarsFusionService,
} from '../services/mars/mars-fusion.service';

/** Sous-ensemble de la réponse Express dont on a besoin (évite une dépendance de types). */
interface RedirectableResponse {
  setHeader(name: string, value: string): unknown;
  redirect(status: number, url: string): unknown;
  send(body: unknown): unknown;
}

/**
 * Modèle de tuiles simplifié, identique quel que soit le fournisseur :
 *   1. `GET layers`            → quelles couches existent ;
 *   2. `GET layers/{id}`       → modèle d'URL `…/{z}/{x}/{y}…` prêt à l'emploi, avec sa date d'expiration ;
 *   3. `GET layers/{id}/attribution` → mention de sources à afficher.
 * Les images sont chargées directement chez le fournisseur : ce service ne les relaie ni ne les stocke.
 */
@ApiTags('Tuiles')
@Controller('tiles')
export class TilesController {
  constructor(
    private readonly tiles: TilesService,
    private readonly moonColor: MoonColorService,
    private readonly moonTiles: MoonTileCacheService,
    private readonly moonModel: MoonModelService,
    private readonly marsBlend: MarsBlendService,
    private readonly marsFusion: MarsFusionService,
  ) {}

  @Get('moon-color.jpg')
  @ApiOperation({
    summary: 'Texture des couleurs naturelles de la Lune',
    description: 'NASA SVS CGI Moon Kit (couleurs LROC réglées pour la vision humaine), 2:1 équirectangulaire. Relayée et gardée en mémoire.',
  })
  @ApiOkResponse({ description: 'Image JPEG (ou PNG selon MOON_COLOR_URL).' })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async moonColorTexture(@Res() res: RedirectableResponse): Promise<void> {
    const t = await this.moonColor.get();
    res.setHeader('Content-Type', t.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(t.body);
  }

  @Get('layers')
  @ApiOperation({
    summary: 'Lister les couches de tuiles',
    description: 'Point de départ : donne le fournisseur actif et les couches disponibles (satellite, plan, relief…).',
  })
  @ApiOkResponse({ type: TileLayerListDto })
  layers(): TileLayerListDto {
    return this.tiles.list();
  }

  @Get('layers/:layerId')
  @ApiOperation({
    summary: 'Obtenir le modèle d’URL d’une couche',
    description: 'Renvoie `urlTemplate` avec {z}/{x}/{y}. Redemandez-le avant `expiresAt`, ou si une tuile répond 400/403.',
  })
  @ApiParam({ name: 'layerId', example: 'satellite' })
  @ApiOkResponse({ type: ResolvedTileLayerDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Couche inconnue (le message liste les couches valides).' })
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Le fournisseur a refusé ou n’a pas répondu.' })
  layer(@Param('layerId') layerId: string): Promise<ResolvedTileLayerDto> {
    return this.tiles.resolve(layerId);
  }

  @Get('layers/:layerId/attribution')
  @ApiOperation({
    summary: 'Sources de données de la zone visible',
    description: 'Mention de source de la couche active, à actualiser lorsque la zone visible change.',
  })
  @ApiParam({ name: 'layerId', example: 'satellite' })
  @ApiOkResponse({ type: AttributionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  attribution(@Param('layerId') layerId: string, @Query() q: AttributionQueryDto): Promise<AttributionDto> {
    return this.tiles.attribution(layerId, q);
  }

  @Get('locate')
  @ApiOperation({
    summary: 'Quelle tuile contient ce point ?',
    description: 'Convertit latitude/longitude/zoom en coordonnées de tuile {z}/{x}/{y} et en emprise. Pratique pour comprendre le schéma.',
  })
  @ApiOkResponse({ type: LocateDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  locate(@Query() q: LocateQueryDto): Promise<LocateDto> {
    return this.tiles.locate(q.lat, q.lon, q.zoom, q.layer);
  }

  @Get('moon-model.glb')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Modèle 3D de la Lune (NASA, glTF binaire)',
    description: 'Modèle officiel NASA (couleurs LRO et relief), relayé et gardé sur le disque du serveur. Source : `MOON_MODEL_URL`.',
  })
  @ApiOkResponse({ description: 'Fichier GLB.' })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async moonModelFile(@Res() res: RedirectableResponse): Promise<void> {
    const m = await this.moonModel.get();
    res.setHeader('Content-Type', m.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(m.body);
  }

  @Get('moon/prefetch')
  @ApiOperation({ summary: 'Avancement du préchargement de la Lune', description: 'Tuiles déjà enregistrées sur le disque du serveur.' })
  @ApiOkResponse({ type: MoonPrefetchStatusDto })
  moonPrefetch(): MoonPrefetchStatusDto {
    return this.moonTiles.status();
  }

  @Get(`${MARS_BLEND_LAYER_ID}/:z/:x/:y`)
  @ApiOperation({
    summary: 'Tuile du fond Mars Viking + CTX',
    description:
      'Extrait une tuile 512 × 512 de la fusion Viking MDIM21 et CTX recolorée.',
  })
  @ApiOkResponse({ description: 'Tuile PNG de la couche Mars blend.' })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async marsBlendTile(
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    const tile = await this.marsBlend.getBlendTile(
      parseTileCoordinate(z),
      parseTileCoordinate(x),
      parseTileCoordinate(y),
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(tile);
  }

  @Get('mars-fusion/:algorithm/:z/:x/:y')
  @ApiOperation({
    summary: 'Tuile d’une fusion Viking + CTX',
    description:
      'Calcule une tuile 512 × 512 avec l’algorithme de fusion sélectionné.',
  })
  @ApiOkResponse({ description: 'Tuile PNG de la couche de fusion Mars.' })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async marsFusionTile(
    @Param('algorithm') slug: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: RedirectableResponse,
  ): Promise<void> {
    const algorithm = getMarsFusionAlgorithmBySlug(slug);
    if (!algorithm) {
      throw new NotFoundException(`Algorithme de fusion Mars inconnu : ${slug}.`);
    }
    const tile = await this.marsFusion.getTile(
      algorithm.name,
      parseTileCoordinate(z),
      parseTileCoordinate(x),
      parseTileCoordinate(y),
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(tile);
  }

  @Get('moon/:layerId/:z/:x/:y')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Tuile de la Lune (cache disque)',
    description: 'Servie depuis le disque du serveur ; téléchargée une seule fois chez NASA Moon Trek puis enregistrée.',
  })
  @ApiOkResponse({ description: 'Image PNG de la tuile.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async moonTile(@Param() p: MoonTileParamsDto, @Res() res: RedirectableResponse): Promise<void> {
    const tile = await this.moonTiles.get(p.layerId, p.z, p.x, p.y);
    res.setHeader('Content-Type', tile.contentType);
    // Les mosaïques ne changent pas : le navigateur garde la tuile une semaine sans redemander.
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Cache', tile.cached ? 'HIT' : 'MISS');
    res.send(tile.body);
  }

  @Get(':layerId/:z/:x/:y')
  @ApiOperation({
    summary: 'Accéder à une tuile précise',
    description: 'Répond par une redirection 302 vers l’image chez le fournisseur. Aucune image ne transite par ce service.',
  })
  @ApiFoundResponse({ description: 'Redirection vers l’image de la tuile.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Zoom ou coordonnées hors limites.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async tile(@Param() p: TileParamsDto, @Res() res: RedirectableResponse): Promise<void> {
    const url = await this.tiles.tileUrl(p.layerId, p.z, p.x, p.y);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }
}

function parseTileCoordinate(value: string): number {
  if (!/^\d+$/.test(value)) {
    return Number.NaN;
  }
  return Number(value);
}
