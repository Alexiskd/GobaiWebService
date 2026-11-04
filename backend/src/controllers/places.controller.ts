import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { CityLabelsDto, FindPlacesQueryDto, PlacesDto } from '../dto/places.dto';
import { CityLabelsService } from '../services/places/city-labels.service';
import { PlacesService } from '../services/places/places.service';

@ApiTags('Lieux')
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService, private readonly labels: CityLabelsService) {}

  @Get('labels')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({
    summary: 'Noms des villes du monde entier',
    description: 'Natural Earth (≈ 7 300 villes, domaine public), triées par population, avec le nom dans l’écriture locale quand elle est disponible. À afficher par-dessus n’importe quel fond.',
  })
  @ApiOkResponse({ type: CityLabelsDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  cityLabels(): Promise<CityLabelsDto> {
    return this.labels.get();
  }

  @Get()
  @ApiOperation({
    summary: 'Rechercher un lieu dans le monde entier',
    description: 'Recherche et autocomplétion Uber Maps. Les coordonnées sont hydratées via Details côté serveur.',
  })
  @ApiOkResponse({ type: PlacesDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'UBER_CLIENT_ID ou UBER_CLIENT_SECRET absent.' })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  find(@Query() q: FindPlacesQueryDto): Promise<PlacesDto> {
    return this.places.find(q.q, q.limit);
  }
}
