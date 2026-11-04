import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthDto } from '../dto/health.dto';

@ApiTags('Service')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'État du service',
    description: 'À utiliser pour la supervision. Disponible sans version : `/api/health`.',
  })
  @ApiOkResponse({ type: HealthDto })
  check(): HealthDto {
    return { status: 'ok', time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) };
  }
}
