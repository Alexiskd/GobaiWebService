// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Règles de validation : booléen, nombre, facultatif, maximum, minimum.
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

// Forme publique d'un nuage de points.
export class PointCloudDto {
  // Documente le champ suivant : nom du fichier.
  @ApiProperty({ example: 'lion_takanawa.copc.laz', description: 'Nom du fichier, à réutiliser dans les autres routes.' })
  // name : le nom du fichier ; le « ! » dit à TypeScript que le champ sera rempli ailleurs que dans un constructeur.
  name!: string;

  // Documente le champ suivant : taille.
  @ApiProperty({ example: 123456789, description: 'Taille du fichier, en octets.' })
  // sizeBytes : la taille du fichier, en octets.
  sizeBytes!: number;

  // Documente le champ suivant : date de modification.
  @ApiProperty({ example: '2026-11-04T12:00:00.000Z', description: 'Dernière modification (ISO 8601, UTC).' })
  // modifiedAt : la date de dernière modification, en ISO 8601.
  modifiedAt!: string;

  // Ouvre la documentation du champ fileUrl :
  @ApiProperty({
    // un exemple d'adresse ;
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/file',
    // la valeur peut être null ;
    nullable: true,
    // sa description.
    description: 'Flux binaire du fichier, avec support des requêtes HTTP `Range` (COPC, LAS/LAZ). null : tuile connue par le registre du code source (backend/data/pointclouds.json), fichier absent du serveur.',
  // Fin de la documentation.
  })
  // fileUrl : l'adresse de téléchargement, ou null si le fichier n'est pas sur le serveur.
  fileUrl!: string | null;

  // Documente le champ suivant : système de coordonnées.
  @ApiProperty({ example: 'EPSG:3946 — RGF93 / CC46', nullable: true, description: 'Système de coordonnées déclaré dans le registre du code source.' })
  // crs : le système de coordonnées déclaré, ou null.
  crs!: string | null;

  // Documente le champ suivant : version du format.
  @ApiProperty({ example: '1.4', nullable: true, description: 'Version du format LAS, si l’en-tête est lisible.' })
  // version : la version du format LAS, ou null si l'en-tête est illisible.
  version!: string | null;

  // Documente le champ suivant : format des points.
  @ApiProperty({ example: '6', nullable: true, description: 'Format d’enregistrement des points LAS/LAZ.' })
  // pointFormat : le numéro du format d'enregistrement des points, ou null.
  pointFormat!: number | null;

  // Documente le champ suivant : nombre de points.
  @ApiProperty({ example: '125000000', nullable: true, description: 'Nombre de points, conservé en chaîne pour éviter toute perte de précision.' })
  // pointCount : le nombre de points, gardé en texte pour ne perdre aucun chiffre, ou null.
  pointCount!: string | null;

  // Ouvre la documentation du champ bounds :
  @ApiProperty({
    // un objet ;
    type: 'object',
    // qui peut être null ;
    nullable: true,
    // un exemple ;
    example: { minX: 139.7, minY: 35.6, minZ: 2, maxX: 139.9, maxY: 35.8, maxZ: 850 },
    // sa description.
    description: 'Emprise des coordonnées natives LAS, sans reprojection.',
  // Fin de la documentation.
  })
  // bounds : l'emprise du nuage (minimum et maximum sur X, Y et Z), ou null.
  bounds!: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null;

  // Documente le champ suivant : référence spatiale embarquée.
  @ApiProperty({ nullable: true, description: 'WKT de référence spatiale embarqué dans les VLR/EVLR LAS.' })
  // coordinateSystemWkt : la description WKT du système de coordonnées lue dans le fichier, ou null.
  coordinateSystemWkt!: string | null;

  // Ouvre la documentation du champ potreeUrl :
  @ApiProperty({
    // un exemple d'adresse ;
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/potree/cloud.js',
    // la valeur peut être null ;
    nullable: true,
    // sa description.
    description: 'URL du cloud.js PotreeConverter correspondant, si présent dans POINTCLOUD_DIR/potree/<nom>/.',
  // Fin de la documentation.
  })
  // potreeUrl : l'adresse du fichier cloud.js de la version Potree, ou null.
  potreeUrl!: string | null;

  // Ouvre la documentation du champ potreeBaseUrl :
  @ApiProperty({
    // un exemple d'adresse ;
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/potree/',
    // la valeur peut être null ;
    nullable: true,
    // sa description.
    description: 'Répertoire de base des ressources du nuage Potree.',
  // Fin de la documentation.
  })
  // potreeBaseUrl : le dossier des ressources Potree, ou null.
  potreeBaseUrl!: string | null;

  // Ouvre la documentation du champ anchor :
  @ApiProperty({
    // un objet ;
    type: 'object',
    // qui peut être null ;
    nullable: true,
    // un exemple ;
    example: { lat: 48.9937, lon: 2.0939, alt: 32, heading: 0, origin: { x: 512.4, y: 803.1, z: 0.12 } },
    // début de sa description ;
    description: 'Calage GPS interne : la coordonnée WGS84 posée sur `origin`, centre de l’emprise au bas du nuage (Z minimal). '
      // fin de sa description.
      + 'Écrit uniquement par le script serveur `npm run pointcloud:anchor`. `heading` : angle de l’axe +Y par rapport au nord vrai (degrés, sens horaire).',
  // Fin de la documentation.
  })
  // anchor : le calage GPS (latitude, longitude, altitude, cap, point d'origine), ou null.
  anchor!: { lat: number; lon: number; alt: number; heading: number; origin: { x: number; y: number; z: number } | null } | null;
// Fin de PointCloudDto.
}

// Forme de la réponse de GET /pointclouds.
export class PointCloudListDto {
  // Documente le champ suivant : la liste des fichiers.
  @ApiProperty({ type: [PointCloudDto], description: 'Fichiers présents dans le répertoire configuré (`POINTCLOUD_DIR`).' })
  // items : les nuages de points disponibles.
  items!: PointCloudDto[];
// Fin de PointCloudListDto.
}

/** Corps de POST /pointclouds/:nom/anchor : coordonnée GPS posée au centre du nuage, en bas de la projection. */
// Forme du corps de POST /pointclouds/:nom/anchor.
export class PointCloudAnchorDto {
  // Documente le champ suivant : latitude.
  @ApiPropertyOptional({ example: 48.9937, description: 'Latitude WGS84 (degrés).' })
  // Validation : facultatif, un nombre, entre −90 et 90.
  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  // lat : la latitude du point de calage.
  lat?: number;

  // Documente le champ suivant : longitude.
  @ApiPropertyOptional({ example: 2.0939, description: 'Longitude WGS84 (degrés).' })
  // Validation : facultatif, un nombre, entre −180 et 180.
  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  // lon : la longitude du point de calage.
  lon?: number;

  // Documente le champ suivant : altitude.
  @ApiPropertyOptional({ example: 32, description: 'Altitude du bas du nuage (mètres). 0 par défaut.' })
  // Validation : facultatif, un nombre, entre −100 000 et 100 000 mètres.
  @IsOptional() @IsNumber() @Min(-100_000) @Max(100_000)
  // alt : l'altitude du bas du nuage.
  alt?: number;

  // Documente le champ suivant : cap.
  @ApiPropertyOptional({ example: 0, description: 'Angle de l’axe +Y du nuage par rapport au nord vrai (degrés, sens horaire). 0 par défaut.' })
  // Validation : facultatif, un nombre.
  @IsOptional() @IsNumber()
  // heading : l'angle de l'axe +Y du nuage par rapport au nord.
  heading?: number;

  // Documente le champ suivant : retrait du calage.
  @ApiPropertyOptional({ example: false, description: 'true : retire le calage.' })
  // Validation : facultatif, un booléen.
  @IsOptional() @IsBoolean()
  // clear : vrai pour retirer le calage.
  clear?: boolean;
// Fin de PointCloudAnchorDto.
}
