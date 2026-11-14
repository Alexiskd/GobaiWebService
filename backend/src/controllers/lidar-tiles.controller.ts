// Outils NestJS : Controller, Get, Param, Res (accès direct à la réponse).
import { Controller, Get, Param, Res } from '@nestjs/common';
// SkipThrottle : dispense de la limite de débit.
import { SkipThrottle } from '@nestjs/throttler';
// Décorateurs Swagger pour la documentation.
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
// Matches : validation par expression régulière.
import { Matches } from 'class-validator';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Service des dalles LiDAR.
import { LidarTilesService } from '../services/lidar-tiles/lidar-tiles.service';

// Classe des paramètres d'adresse d'un nœud.
class LidarNodeParamsDto {
  // tile : identifiant de la dalle, 2 à 61 caractères (minuscules, chiffres, tirets), commençant par une lettre ou un chiffre.
  @Matches(/^[a-z0-9][a-z0-9-]{1,60}$/) tile: string;
  // node : clé du nœud « niveau-x-y-z », le niveau sur 1 ou 2 chiffres, chaque coordonnée sur 1 à 5 chiffres.
  @Matches(/^\d{1,2}-\d{1,5}-\d{1,5}-\d{1,5}$/) node: string;
// Fin de LidarNodeParamsDto.
}

// Interface minimale de la réponse HTTP utilisée ici :
interface BinaryResponse {
  // poser un en-tête ;
  setHeader(name: string, value: string | number): unknown;
  // envoyer le corps.
  send(body: unknown): unknown;
// Fin de BinaryResponse.
}

/** Dalles LiDAR en vrais points 3D : manifeste des dalles et fichiers des nœuds de leur octree. */
// Rubrique « LiDAR 3D » de la documentation.
@ApiTags('LiDAR 3D')
// Routes sous /api/v1/lidar.
@Controller('lidar')
// Classe du contrôleur des dalles LiDAR.
export class LidarTilesController {
  // NestJS injecte le service des dalles ; corps du constructeur vide.
  constructor(private readonly lidar: LidarTilesService) {}

  // Route GET /api/v1/lidar.
  @Get()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Dalles LiDAR affichées en points 3D',
    // début de son texte ;
    description: 'Pour chaque dalle : emprise, calage GPS, pas des coordonnées et nœuds de l’octree (clé, nombre de points, '
      // suite du texte (les deux chaînes sont collées par « + »).
      + 'empreinte). `nodeUrl` est le modèle d’adresse des fichiers ; `storage` indique s’ils viennent de PostgreSQL.',
  // Fin de la description.
  })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Dalles et nœuds disponibles.' })
  // Méthode list : renvoie les dalles et leurs nœuds.
  list() {
    // Délègue au service.
    return this.lidar.list();
  // Fin de list.
  }

  // Route GET /api/v1/lidar/:tile/:node.
  @Get(':tile/:node')
  // Pas de limite de débit : l'affichage d'une dalle demande des dizaines de nœuds à la suite.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Points d’un nœud de l’octree',
    // son texte (format du fichier).
    description: 'Fichier binaire compressé (gzip, décompressé par le navigateur) : 8 octets par point, voir lidar-tiles.ts.',
  // Fin de la description.
  })
  // Documente le paramètre tile, avec un exemple.
  @ApiParam({ name: 'tile', example: 'paris-0652-6863' })
  // Documente le paramètre node, avec un exemple (la racine).
  @ApiParam({ name: 'node', example: '0-0-0-0' })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Points du nœud.' })
  // Réponse 404 documentée : dalle ou nœud inconnu.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode node : reçoit les deux paramètres validés et la réponse, qu'elle remplit elle-même.
  async node(@Param() p: LidarNodeParamsDto, @Res() res: BinaryResponse): Promise<void> {
    // Attend le fichier du nœud (déjà compressé en gzip) auprès du service.
    const body = await this.lidar.node(p.tile, p.node);
    // Type : données binaires.
    res.setHeader('Content-Type', 'application/octet-stream');
    // Indique que le corps est en gzip : le navigateur le décompresse tout seul.
    res.setHeader('Content-Encoding', 'gzip');
    // Taille du corps compressé.
    res.setHeader('Content-Length', body.length);
    // L'empreinte du fichier est dans l'adresse (?v=) : le navigateur le garde sans jamais le redemander.
    // Cache d'un an, immuable.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Envoie les octets.
    res.send(body);
  // Fin de node.
  }
// Fin du contrôleur.
}
