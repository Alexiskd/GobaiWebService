import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: '2026-10-23T09:30:00.000Z', description: 'Heure du serveur (ISO 8601, UTC).' })
  time: string;

  @ApiProperty({ example: 3600, description: 'Durée depuis le démarrage, en secondes.' })
  uptimeSeconds: number;
}
