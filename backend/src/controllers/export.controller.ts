// Outils NestJS : contrôleur, routes, paramètres, en-têtes, flux et garde.
import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
// Limitation de débit : un export coûte cher au serveur.
import { Throttle } from '@nestjs/throttler';
// Réponse Express, pour servir un fichier binaire.
import type { Response } from 'express';
// Documentation OpenAPI.
import {
  ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// Forme des erreurs de l'API.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes des données échangées.
import { BodyParamsDto, ExportableBodiesDto, ModelQueryDto, ExportQueryDto, OrbitDto, OrbitQueryDto } from '../dto/export.dto';
// Garde des routes payantes et déclaration du droit exigé.
import { RequiresScope, ScopeGuard } from '../common/jwt.guard';
// Service d'export.
import { ExportService } from '../services/export/export.service';
// Clé d'un astre dans les droits.
import { bodyKey } from '../services/store/catalogue';

/** Niveau de zoom par défaut des tuiles assemblées. */
const DEFAULT_ZOOM = 4;
/** Durée par défaut du calcul d'orbite : un an. */
const DEFAULT_SPAN_MS = 365 * 86_400_000;

/**
 * Exports payants : modèle 3D complet d'un astre, tuiles assemblées, et calcul d'orbite.
 *
 * Chaque route exige un jeton JWT acheté sur `/api/v1/store`, présenté dans l'en-tête
 * `Authorization: Bearer <jeton>`. La liste des astres exportables, elle, est libre : il faut bien savoir ce
 * qu'on achète. Les routes que le site emploie pour afficher la carte ne sont pas touchées.
 */
@ApiTags('Exports')
@Controller('export')
@UseGuards(ScopeGuard)
// Classe du contrôleur des exports.
export class ExportController {
  // Constructeur : NestJS y injecte le service d'export.
  constructor(private readonly exports: ExportService) {}

  /** Les astres exportables, avec leurs dimensions réelles. Route libre. */
  @Get('bodies')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Astres exportables',
    description: 'Clé, nom, rayon réel et aplatissement de chaque astre vendu, le Soleil compris, avec ce que '
      + 'chacun a réellement à vendre : `hasTiles` dit si un fond de carte existe, `hasOrbit` si l’astre a une '
      + 'orbite héliocentrique (faux pour le Soleil). Route libre.',
  })
  @ApiOkResponse({ type: ExportableBodiesDto })
  // Méthode bodies.
  bodies(): ExportableBodiesDto {
    // La liste, avec ce que chaque astre a réellement à vendre.
    return { items: this.exports.catalogueBodies() };
  // Fin de bodies.
  }

  /** Modèle 3D complet d'un astre, au format GLB. */
  @Get('bodies/:body/model.glb')
  @RequiresScope((req) => `body:${bodyKey(String(req.params.body))}`)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiBearerAuth('cle-api')
  @ApiProduces('model/gltf-binary')
  @ApiOperation({
    summary: 'Modèle 3D complet d’un astre (GLB)',
    description: 'Sphéroïde aux dimensions réelles, en kilomètres, texturé par les tuiles de l’astre assemblées. '
      + 'Un seul fichier, que Blender, three.js ou un visualiseur en ligne ouvrent directement. La mention '
      + 'd’origine des images est inscrite dedans.',
  })
  @ApiOkResponse({ description: 'Le fichier GLB.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Jeton absent, expiré ou refusé.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Le jeton ne donne pas accès à cet astre.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Astre inconnu.' })
  // Méthode model.
  async model(@Param() p: BodyParamsDto, @Query() q: ModelQueryDto, @Res() res: Response): Promise<void> {
    // Le modèle.
    const { body, file, texture, mesh } = await this.exports.model(p.body, {
      zoom: q.zoom ?? DEFAULT_ZOOM,
      quality: q.quality ?? 'normale',
      layerId: q.layer,
    });
    // En-têtes : type du fichier, nom proposé, et ce qui décrit le modèle.
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="${body.key}.glb"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Model-Radius-Km', String(body.radiusKm));
    res.setHeader('X-Model-Vertices', String(mesh.vertices));
    res.setHeader('X-Model-Triangles', String(mesh.triangles));
    // La projection de la texture et son origine, quand il y en a une.
    if (texture) {
      // Projection et dimensions.
      res.setHeader('X-Texture-Projection', texture.projection);
      res.setHeader('X-Texture-Size', `${texture.width}x${texture.height}`);
      // Mention d'origine, sur une seule ligne.
      if (texture.attribution) res.setHeader('X-Attribution', texture.attribution.replace(/\s+/g, ' ').slice(0, 500));
    // Fin de la texture.
    }
    // Le fichier.
    res.end(file);
  // Fin de model.
  }

  /** Tuiles d'un astre assemblées en une seule image. */
  @Get('bodies/:body/tiles.jpg')
  @RequiresScope((req) => `tiles:${bodyKey(String(req.params.body))}`)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiBearerAuth('cle-api')
  @ApiProduces('image/jpeg')
  @ApiOperation({
    summary: 'Tuiles d’un astre assemblées en une image',
    description: 'Toutes les tuiles du niveau demandé, collées en une seule image, dans le découpage de la couche '
      + '(`mercator` ou `equirectangular`) : elle n’est pas reprojetée. L’en-tête `X-Attribution` porte l’origine.',
  })
  @ApiOkResponse({ description: 'L’image assemblée.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Jeton absent, expiré ou refusé.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Le jeton ne donne pas accès aux tuiles de cet astre.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Astre inconnu, ou sans couche de tuiles.' })
  // Méthode tiles.
  async tiles(@Param() p: BodyParamsDto, @Query() q: ExportQueryDto, @Res() res: Response): Promise<void> {
    // L'image assemblée.
    const mosaic = await this.exports.mosaicOf(p.body, q.zoom ?? DEFAULT_ZOOM, q.layer);
    // En-têtes : type, nom proposé, et ce qui décrit l'image.
    res.setHeader('Content-Type', mosaic.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${bodyKey(p.body)}-z${mosaic.zoom}.jpg"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Texture-Projection', mosaic.projection);
    res.setHeader('X-Texture-Size', `${mosaic.width}x${mosaic.height}`);
    res.setHeader('X-Tiles-Missing', String(mosaic.missing));
    // Mention d'origine, sur une seule ligne.
    if (mosaic.attribution) res.setHeader('X-Attribution', mosaic.attribution.replace(/\s+/g, ' ').slice(0, 500));
    // L'image.
    res.end(mosaic.image);
  // Fin de tiles.
  }

  /** Calcul d'orbite : positions et vitesses d'un astre sur la période demandée. */
  @Get('orbits')
  @RequiresScope((req) => `orbit:${bodyKey(String((req.query as Record<string, unknown>).body ?? ''))}`)
  @Header('Cache-Control', 'private, max-age=600')
  @Throttle({ default: { limit: 60, ttl: 600_000 } })
  @ApiBearerAuth('cle-api')
  @ApiOperation({
    summary: 'Calcul d’orbite',
    description: 'Positions et vitesses héliocentriques d’un astre, pas à pas, dans l’écliptique J2000, avec ses '
      + 'éléments orbitaux. Calcul local : aucun service d’éphémérides n’est interrogé. Le droit est propre à '
      + 'chaque astre et se loue à l’heure : le jeton expire au bout des heures achetées. Cas particulier du '
      + 'Soleil (`body=soleil`) : il est au centre du repère et n’a donc pas d’orbite — le relevé donne sa '
      + 'position vue de la Terre (coordonnées écliptiques et équatoriales, distance) et le point de la Terre '
      + 'où il est au zénith.',
  })
  @ApiOkResponse({ type: OrbitDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Jeton absent, expiré ou refusé.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Le jeton ne donne pas accès au calcul d’orbite de cet astre, ou sa durée est écoulée.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Astre inconnu.' })
  // Méthode orbits.
  orbits(@Query() q: OrbitQueryDto): OrbitDto {
    // Début de la période : celui demandé, sinon maintenant.
    const from = q.from ? Date.parse(q.from) : Date.now();
    // Fin : celle demandée, sinon un an plus tard.
    const to = q.to ? Date.parse(q.to) : from + DEFAULT_SPAN_MS;
    // Le calcul.
    return this.exports.orbit(q.body, from, to, q.steps ?? 365) as OrbitDto;
  // Fin de orbits.
  }
// Fin du contrôleur.
}
