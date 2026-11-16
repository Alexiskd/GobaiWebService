// Outils NestJS : erreur 400, Body, Controller, Get, HttpCode, Param, Post, Req (requête brute), Res (réponse brute).
import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
// SkipThrottle dispense de la limite de débit ; Throttle en fixe une propre à la route.
import { SkipThrottle, Throttle } from '@nestjs/throttler';
// Ouvre la liste des décorateurs Swagger importés :
import {
  // réponses 400, 404, 200, description de route, paramètre, rubrique.
  ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags,
// Fin de l'import.
} from '@nestjs/swagger';
// Types Express (effacés à la compilation) de la requête et de la réponse.
import type { Request, Response } from 'express';
// createReadStream : lit un fichier en flux, sans le charger en entier en mémoire.
import { createReadStream } from 'node:fs';
// extname : extension d'un nom de fichier.
import { extname } from 'node:path';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes du calage GPS reçu, d'un nuage et de la liste des nuages.
import { PointCloudAnchorDto, PointCloudDto, PointCloudListDto } from '../dto/pointclouds.dto';
// Type d'un fichier de nuage, service des nuages, et fonction qui analyse l'en-tête Range.
import { PointCloudFile, PointCloudsService, parseRange } from '../services/pointclouds/pointclouds.service';

/**
 * Nuages de points LiDAR : le serveur expose l’en-tête LAS, les flux COPC/LAS en Range et les ressources Potree converties.
 * Le rendu et la lecture de l’octree se font dans le navigateur.
 */
// Rubrique « Nuages de points » de la documentation.
@ApiTags('Nuages de points')
// Routes sous /api/v1/pointclouds.
@Controller('pointclouds')
// Classe du contrôleur des nuages de points.
export class PointCloudsController {
  // NestJS injecte le service ; corps du constructeur vide.
  constructor(private readonly pointClouds: PointCloudsService) {}

  // Route GET /api/v1/pointclouds.
  @Get()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Lister les nuages de points disponibles',
    // son texte.
    description: 'Fichiers LAS/LAZ, emprise et CRS natifs, ainsi que l’URL Potree si un jeu converti est disponible.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un PointCloudListDto.
  @ApiOkResponse({ type: PointCloudListDto })
  // Méthode list : asynchrone, renvoie la liste.
  async list(): Promise<PointCloudListDto> {
    // Attend la liste des fichiers auprès du service.
    const files = await this.pointClouds.list();
    // Convertit chaque fichier en sa forme publique (toDto) et range le tout sous « items ».
    return { items: files.map(toDto) };
  // Fin de list.
  }

  // Route GET /api/v1/pointclouds/:name.
  @Get(':name')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Décrire un nuage de points',
    // son texte.
    description: 'Taille, date de modification et URL du flux binaire.',
  // Fin de la description.
  })
  // Documente le paramètre name, avec un exemple.
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  // Réponse 200 documentée : un PointCloudDto.
  @ApiOkResponse({ type: PointCloudDto })
  // Réponse 400 documentée : nom refusé.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Nom de fichier refusé.' })
  // Réponse 404 documentée : fichier absent.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode metadata : reçoit le nom du fichier.
  async metadata(@Param('name') name: string): Promise<PointCloudDto> {
    // Attend le fichier auprès du service puis le convertit en sa forme publique.
    return toDto(await this.pointClouds.get(name));
  // Fin de metadata.
  }

  // Route POST /api/v1/pointclouds/:name/anchor.
  @Post(':name/anchor')
  // Répond 200 au lieu de 201.
  @HttpCode(200)
  // Limite propre : 20 requêtes par minute.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Positionner le nuage par une coordonnée GPS',
    // début de son texte ;
    description: 'La coordonnée WGS84 est posée au centre de l’emprise du nuage, en bas de la projection (Z minimal). '
      // suite (altitude et cap) ;
      + '`alt` : altitude du bas du nuage (m, 0 par défaut) ; `heading` : angle de l’axe +Y par rapport au nord vrai (degrés, sens horaire). '
      // fin (retirer le calage).
      + 'Corps `{ "clear": true }` pour retirer le calage.',
  // Fin de la description.
  })
  // Documente le paramètre name.
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  // Réponse 200 documentée.
  @ApiOkResponse({ type: PointCloudDto })
  // Réponse 400 documentée : coordonnées invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Coordonnées invalides.' })
  // Réponse 404 documentée.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode anchor : reçoit le nom du fichier et le corps de la requête.
  async anchor(@Param('name') name: string, @Body() body: PointCloudAnchorDto): Promise<PointCloudDto> {
    // Corps absent : on prend un objet vide, vu comme un PointCloudAnchorDto.
    const b = body ?? ({} as PointCloudAnchorDto);
    // Demande au service d'enregistrer le calage (null pour le retirer si clear est vrai, sinon latitude, longitude, altitude et cap), puis convertit le résultat.
    return toDto(await this.pointClouds.setAnchor(name, b.clear ? null : { lat: b.lat, lon: b.lon, alt: b.alt, heading: b.heading }));
  // Fin de anchor.
  }

  // Route GET /api/v1/pointclouds/:name/file.
  @Get(':name/file')
  // Pas de limite de débit : la lecture d'un nuage enchaîne de très nombreuses requêtes.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Télécharger le fichier (requêtes Range)',
    // son texte, sur la ligne suivante :
    description:
      // le texte.
      'Sert le fichier tel quel, avec support de `Range: bytes=…` et réponses 206. Indispensable au streaming COPC : le lecteur demande la hiérarchie puis chaque nœud.',
  // Fin de la description.
  })
  // Documente le paramètre name.
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Flux binaire complet.' })
  // Réponse 400 documentée : en-tête Range invalide.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'En-tête `Range` invalide.' })
  // Réponse 404 documentée.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode file : reçoit le nom, la requête et la réponse brutes.
  async file(@Param('name') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    // Attend la description du fichier (chemin, taille, date) auprès du service.
    const file = await this.pointClouds.getFile(name);
    // Envoie le fichier en flux, en respectant l'en-tête Range.
    this.stream(file, req, res);
  // Fin de file.
  }

  // Route GET /api/v1/pointclouds/:name/potree/* ; l'étoile capture tout le reste du chemin.
  @Get(':name/potree/*')
  // Pas de limite de débit.
  @SkipThrottle()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Servir les ressources d’un nuage Potree converti',
    // son texte.
    description: 'Ressources cloud.js, octree et hiérarchie depuis POINTCLOUD_DIR/potree/<nom>/. Chaque fichier accepte les requêtes Range.',
  // Fin de la description.
  })
  // Documente le paramètre name.
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Ressource Potree (cloud.js, binaire ou hiérarchie).' })
  // Réponse 400 documentée : nom ou chemin invalide.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Nom ou chemin de ressource invalide.' })
  // Réponse 404 documentée.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode potreeAsset : reçoit le nom, la requête et la réponse brutes.
  async potreeAsset(@Param('name') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    // Partie de l'adresse capturée par l'étoile : le chemin de la ressource dans le dossier Potree.
    const assetPath = req.params[0];
    // Attend la description de cette ressource ; le service refuse un chemin qui sortirait du dossier.
    const file = await this.pointClouds.getPotreeAsset(name, assetPath);
    // Envoie la ressource en flux.
    this.stream(file, req, res);
  // Fin de potreeAsset.
  }

  // Méthode privée stream : envoie un fichier, entier ou par plage, dans la réponse.
  private stream(file: PointCloudFile, req: Request, res: Response): void {
    // Analyse l'en-tête Range par rapport à la taille du fichier ; le résultat dit : invalide, impossible, partiel ou entier.
    const range = parseRange(req.headers.range, file.sizeBytes);

    // En-tête mal formé :
    if (range.kind === 'invalid') {
      // erreur 400 avec ce message.
      throw new BadRequestException('En-tête Range invalide : une seule plage « bytes=début-fin » est acceptée.');
    // Fin du cas invalide.
    }
    // Plage en dehors du fichier :
    if (range.kind === 'unsatisfiable') {
      // code 416 ;
      res.status(416);
      // avec la taille réelle du fichier ;
      res.setHeader('Content-Range', `bytes */${file.sizeBytes}`);
      // réponse terminée sans corps ;
      res.end();
      // et on s'arrête.
      return;
    // Fin du cas 416.
    }

    // Annonce que les plages d'octets sont acceptées.
    res.setHeader('Accept-Ranges', 'bytes');
    // Autorise le code du navigateur à lire ces en-têtes de réponse (sinon CORS les cache).
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Last-Modified');
    // Type du contenu d'après l'extension du fichier.
    res.setHeader('Content-Type', contentType(file.name));
    // Date de dernière modification du fichier.
    res.setHeader('Last-Modified', file.modifiedAt.toUTCString());
    // Cache public d'une heure.
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Fichier vide :
    if (file.sizeBytes === 0) {
      // réponse terminée sans corps ;
      res.end();
      // et on s'arrête.
      return;
    // Fin du cas vide.
    }

    // Premier octet à envoyer : celui de la plage, ou 0.
    const start = range.kind === 'partial' ? range.start : 0;
    // Dernier octet à envoyer : celui de la plage, ou le dernier du fichier.
    const end = range.kind === 'partial' ? range.end : file.sizeBytes - 1;
    // Si une plage est demandée :
    if (range.kind === 'partial') {
      // code 206, contenu partiel ;
      res.status(206);
      // avec la plage envoyée et la taille totale.
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.sizeBytes}`);
    // Fin du cas partiel.
    }
    // Nombre d'octets envoyés : fin − début + 1.
    res.setHeader('Content-Length', String(end - start + 1));

    // Ouvre le fichier en lecture, limitée aux octets de début à fin.
    const stream = createReadStream(file.path, { start, end });

    // Le client peut interrompre une requête Range en changeant de vue ou en fermant l'onglet.
    // Arrêter immédiatement la lecture disque évite de consommer des ressources pour un transfert abandonné.
    // Fonction qui arrête la lecture :
    const abortStream = () => {
      // détruit le flux s'il ne l'est pas déjà.
      if (!stream.destroyed) stream.destroy();
    // Fin de abortStream.
    };
    // Si le visiteur interrompt la requête : arrêt de la lecture (une seule fois).
    req.once('aborted', abortStream);
    // Quand la connexion se ferme :
    res.once('close', () => {
      // si la réponse n'était pas terminée, arrêt de la lecture.
      if (!res.writableEnded) abortStream();
    // Fin de ce gestionnaire.
    });
    // Si la lecture du fichier échoue :
    stream.once('error', () => {
      // coupe la réponse, si elle ne l'est pas déjà.
      if (!res.destroyed) res.destroy();
    // Fin de ce gestionnaire.
    });
    // Branche le flux du fichier sur la réponse : les octets partent au fur et à mesure.
    stream.pipe(res);
  // Fin de stream.
  }
// Fin du contrôleur.
}

// Fonction toDto : convertit un fichier interne en sa forme publique.
function toDto(file: PointCloudFile): PointCloudDto {
  // Adresse de base des ressources Potree, si un jeu converti existe :
  const potreeBaseUrl = file.potreeAvailable
    // adresse construite avec le nom encodé pour une URL ;
    ? `/api/v1/pointclouds/${encodeURIComponent(file.name)}/potree/`
    // sinon null.
    : null;
  // Objet renvoyé :
  return {
    // nom du fichier ;
    name: file.name,
    // taille en octets ;
    sizeBytes: file.sizeBytes,
    // date de modification en ISO 8601 ;
    modifiedAt: file.modifiedAt.toISOString(),
    // adresse de téléchargement, ou null si le fichier d'origine n'est pas disponible ;
    fileUrl: file.fileAvailable === false ? null : `/api/v1/pointclouds/${encodeURIComponent(file.name)}/file`,
    // système de coordonnées, ou null s'il est inconnu ;
    crs: file.crs ?? null,
    // version du format LAS, ou null sans en-tête ;
    version: file.header?.version ?? null,
    // format des points, ou null ;
    pointFormat: file.header?.pointFormat ?? null,
    // nombre de points, ou null ;
    pointCount: file.header?.pointCount ?? null,
    // emprise, ou null ;
    bounds: file.header?.bounds ?? null,
    // description WKT du système de coordonnées, ou null ;
    coordinateSystemWkt: file.header?.coordinateSystemWkt ?? null,
    // adresse du fichier cloud.js de Potree, ou null ;
    potreeUrl: potreeBaseUrl ? `${potreeBaseUrl}cloud.js` : null,
    // adresse de base Potree ;
    potreeBaseUrl,
    // calage GPS :
    anchor: file.anchor
      // s'il existe, on le recopie en y ajoutant le point d'origine calculé depuis l'en-tête (null sans en-tête) ;
      ? { ...file.anchor, origin: file.header ? PointCloudsService.anchorOrigin(file.header) : null }
      // sinon null.
      : null,
  // Fin de l'objet.
  };
// Fin de toDto.
}

// Fonction contentType : type de contenu d'après le nom du fichier.
function contentType(name: string): string {
  // Selon l'extension, en minuscules :
  switch (extname(name).toLowerCase()) {
    // JavaScript ;
    case '.js': return 'application/javascript; charset=utf-8';
    // JSON ;
    case '.json': return 'application/json; charset=utf-8';
    // HTML ;
    case '.html': return 'text/html; charset=utf-8';
    // image PNG ;
    case '.png': return 'image/png';
    // .jpg,
    case '.jpg':
    // comme .jpeg : image JPEG ;
    case '.jpeg': return 'image/jpeg';
    // .bin,
    case '.bin':
    // .hrc,
    case '.hrc':
    // .laz
    case '.laz':
    // et .las : données binaires ;
    case '.las': return 'application/octet-stream';
    // toute autre extension : données binaires aussi.
    default: return 'application/octet-stream';
  // Fin du switch.
  }
// Fin de contentType.
}
