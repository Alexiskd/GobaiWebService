import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
} from '@nestjs/common';
import { SunService } from '../services/sun/sun.service';
import { SUN_BODIES, isSunBody } from '../services/sun/sun.types';

@Controller('sun')
export class SunController {
  constructor(private readonly sunService: SunService) {}

  @Get()
  overview() {
    return {
      module: 'sun',
      description:
        'Point sous-solaire en direct pour les globes, calculé par JPL Horizons (éphéméride DE441).',
      source:
        'JPL Horizons API — même service d’éphémérides que NASA Eyes on the Solar System.',
      bodies: Object.entries(SUN_BODIES).map(([id, definition]) => ({
        id,
        name: definition.name,
        frame: definition.frame,
      })),
      endpoints: {
        ephemeris: '/api/v1/sun/:body',
        moon: '/api/v1/sun/moon',
        mars: '/api/v1/sun/mars',
      },
    };
  }

  @Get(':body')
  @Header('Cache-Control', 'public, max-age=30')
  ephemeris(@Param('body') body: string) {
    if (!isSunBody(body)) {
      throw new BadRequestException(
        `Corps inconnu : ${body}. Valeurs acceptées : ${Object.keys(SUN_BODIES).join(', ')}.`,
      );
    }
    return this.sunService.get(body);
  }
}
