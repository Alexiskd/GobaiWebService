// Outils NestJS : Controller, Get, Param, Res (accès direct à la réponse).
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
// SkipThrottle : dispense de la limite de débit.
import { SkipThrottle } from '@nestjs/throttler';
// Décorateurs Swagger pour la documentation.
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
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

/** Nuages LiDAR HD de l'IGN en vrais points 3D, lus en direct : dalles autour d'un point et fichiers des nœuds de leur octree. */
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
    summary: 'Dalles LiDAR HD de l’IGN autour d’un point',
    // début de son texte ;
    description: 'Dalles du jeu IGNF_NUAGES-DE-POINTS-LIDAR-HD (Géoplateforme) autour du point, lues en direct : emprise, '
      // suite du texte (les chaînes sont collées par « + ») ;
      + 'calage GPS, pas des coordonnées et nœuds de l’octree COPC (clé, nombre de points). `nodeUrl` est le modèle '
      // fin du texte.
      + 'd’adresse des fichiers ; `available` est faux si le décodeur LAZ manque sur le serveur.',
  // Fin de la description.
  })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Dalles et nœuds disponibles autour du point.' })
  // Documente la longitude, avec un exemple (Beaubourg).
  @ApiQuery({ name: 'lon', example: 2.3526 })
  // Documente la latitude, avec un exemple.
  @ApiQuery({ name: 'lat', example: 48.8608 })
  // Documente le rayon de recherche, facultatif (100 à 1 500 m, 600 par défaut).
  @ApiQuery({ name: 'r', required: false, example: 900 })
  // Méthode list : reçoit la longitude, la latitude et le rayon, renvoie les dalles et leurs nœuds.
  list(@Query('lon') lon?: string, @Query('lat') lat?: string, @Query('r') r?: string) {
    // Délègue au service, avec les valeurs converties en nombres.
    return this.lidar.list(Number(lon), Number(lat), Number(r));
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
    description: 'Bloc LAZ du nœud lu chez l’IGN, décodé et converti : fichier binaire compressé (gzip, décompressé par le navigateur), 8 octets par point, voir lidar-tiles.ts.',
  // Fin de la description.
  })
  // Documente le paramètre tile, avec un exemple.
  @ApiParam({ name: 'tile', example: 'lhd-0652-6863' })
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
    // Les nuages de l'IGN ne changent pas et la version du format est dans l'adresse (?v=) : cache d'un an, immuable.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Envoie les octets.
    res.send(body);
  // Fin de node.
  }
// Fin du contrôleur.
}
