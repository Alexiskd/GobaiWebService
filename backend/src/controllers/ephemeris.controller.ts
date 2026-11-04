import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { EphemerisDto, EphemerisQueryDto, MoonEphemerisDto, MoonOrbitersDto, MoonPhasesDto } from '../dto/ephemeris.dto';
import { UsnoService } from '../services/ephemeris/usno.service';
import { OrbitersService } from '../services/ephemeris/orbiters.service';
import { HorizonsService } from '../services/ephemeris/horizons.service';
import { EphemerisService } from '../services/ephemeris/planetary-positions.service';

@ApiTags('Éphémérides')
@Controller('ephemeris')
export class EphemerisController {
  constructor(
    private readonly ephemeris: EphemerisService,
    private readonly horizons: HorizonsService,
    private readonly orbitersService: OrbitersService,
    private readonly usno: UsnoService,
  ) {}

  @Get('moon')
  @ApiOperation({
    summary: 'Position exacte de la Lune (JPL Horizons)',
    description: 'Vecteurs Terre → Lune en km, écliptique J2000, toutes les 30 min sur ≈ 50 h autour de maintenant.',
  })
  @ApiOkResponse({ type: MoonEphemerisDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'JPL Horizons injoignable ou en erreur.' })
  moon(): Promise<MoonEphemerisDto> {
    return this.horizons.moon();
  }

  @Get('moon/phases')
  @ApiOperation({ summary: 'Prochaines phases de la Lune (USNO)', description: 'Nouvelle lune, quartiers, pleine lune : dates et heures UTC.' })
  @ApiOkResponse({ type: MoonPhasesDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  phases(): Promise<MoonPhasesDto> {
    return this.usno.phases();
  }

  @Get('moon/orbiters')
  @ApiOperation({
    summary: 'Sondes en orbite lunaire (JPL Horizons)',
    description: 'LRO, Chandrayaan-2, Danuri, CAPSTONE : positions Lune → sonde en km, écliptique J2000, toutes les 2 min sur 6 h 30.',
  })
  @ApiOkResponse({ type: MoonOrbitersDto })
  orbiters(): Promise<MoonOrbitersDto> {
    return this.orbitersService.orbiters();
  }

  @Get()
  @ApiOperation({ summary: 'Positions des planètes', description: 'À l’instant donné (`time`, ISO 8601) ou maintenant.' })
  @ApiOkResponse({ type: EphemerisDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: '`time` n’est pas une date ISO 8601 valide.' })
  snapshot(@Query() query: EphemerisQueryDto): EphemerisDto {
    return this.ephemeris.snapshot(query.time ? Date.parse(query.time) : Date.now());
  }
}
