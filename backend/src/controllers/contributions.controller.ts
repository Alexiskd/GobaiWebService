import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG } from '../modules/config.module';
import type { AppConfig } from '../common/configuration';

@ApiTags('Contributions')
@Controller('contributions')
export class ContributionsController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('p2p-config')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Configuration publique de la signalisation WebRTC',
    description: 'Retourne les serveurs ICE configurés. La signalisation relaie uniquement les offres SDP et candidats ICE, jamais les blocs de contribution.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        maxPeers: { type: 'number' },
        iceServers: { type: 'array', items: { type: 'object' } },
        signalPath: { type: 'string' },
      },
    },
  })
  p2pConfig() {
    return {
      maxPeers: this.config.p2p.maxPeers,
      iceServers: this.config.p2p.iceServers,
      signalPath: '/api/p2p/signal',
    };
  }
}
