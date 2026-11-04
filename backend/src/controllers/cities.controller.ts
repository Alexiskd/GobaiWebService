import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { CitiesPageDto, FindCitiesQueryDto } from '../dto/cities.dto';
import { CitiesService } from '../services/cities/cities.service';

@ApiTags('Villes')
@Controller('cities')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister ou rechercher des villes', description: 'Sans paramètre, renvoie toutes les villes.' })
  @ApiOkResponse({ type: CitiesPageDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  find(@Query() query: FindCitiesQueryDto): CitiesPageDto {
    return this.cities.find(query);
  }
}
