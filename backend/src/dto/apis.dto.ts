// Décorateur de documentation OpenAPI.
import { ApiProperty } from '@nestjs/swagger';
// Validateurs des champs reçus.
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
// Taille maximale d'une liste d'hôtes.
import { MAX_BLOCKED_HOSTS } from '../common/api-blocklist';

/** Corps de PUT /apis/blocked : la nouvelle liste d'exécution des hôtes bloqués. */
export class SetBlockedApisDto {
  // Liste complète des hôtes à bloquer (elle remplace la précédente).
  @ApiProperty({ example: ['api.open-meteo.com', 'photon.komoot.io'], description: 'Hôtes des API à déconnecter. Liste vide : tout est reconnecté.' })
  @IsArray() @ArrayMaxSize(MAX_BLOCKED_HOSTS) @IsString({ each: true }) @MaxLength(253, { each: true })
  hosts: string[];
}

/** État du blocage des API sur le serveur. */
export class BlockedApisDto {
  @ApiProperty({ example: ['api.open-meteo.com'], description: 'Tous les hôtes bloqués sur le serveur.' }) hosts: string[];
  @ApiProperty({ example: [], description: 'Hôtes bloqués par la variable BLOCKED_API_HOSTS : seul le tableau de bord de l’hébergeur les débloque.' }) permanent: string[];
  @ApiProperty({ example: ['api.open-meteo.com'], description: 'Hôtes bloqués par la route d’administration, jusqu’au redémarrage du serveur.' }) runtime: string[];
  @ApiProperty({ example: true, description: 'Vrai si une clé d’administration est configurée (API_ADMIN_TOKEN) : la liste est alors modifiable.' }) editable: boolean;
}
