import { Controller, Get, Header, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG } from '../modules/config.module';
import type { AppConfig } from '../common/configuration';
import { DonationConfigDto } from '../dto/donations.dto';

@ApiTags('Dons')
@Controller('donations')
export class DonationsController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('config')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Configuration du Donate SDK PayPal',
    description: 'Retourne les paramètres publics du bouton hébergé PayPal ou du compte personnel. Aucun paiement ne transite par cette API.',
  })
  @ApiOkResponse({ type: DonationConfigDto })
  configValue(): DonationConfigDto {
    const { paypalDonateEnvironment, paypalHostedButtonId, paypalBusiness } = this.config.donations;
    return {
      enabled: Boolean(paypalHostedButtonId || paypalBusiness),
      environment: paypalDonateEnvironment,
      ...(paypalHostedButtonId ? { hostedButtonId: paypalHostedButtonId } : {}),
      ...(paypalBusiness ? { business: paypalBusiness } : {}),
    };
  }
}
