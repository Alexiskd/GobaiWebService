import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { BodiesDto, PlanetDto } from '../dto/bodies.dto';
import { BodiesService } from '../services/bodies/bodies.service';

@ApiTags('Astres')
@Controller('bodies')
export class BodiesController {
  constructor(private readonly bodies: BodiesService) {}

  @Get()
  @ApiOperation({ summary: 'Tous les astres', description: 'Soleil, Lune et les 8 planètes, avec leurs paramètres physiques et orbitaux.' })
  @ApiOkResponse({ type: BodiesDto })
  all(): BodiesDto {
    return this.bodies.all();
  }

  @Get('planets/:name')
  @ApiOperation({ summary: 'Une planète', description: 'Le nom est insensible à la casse et aux accents (`venus`, `TERRE`).' })
  @ApiParam({ name: 'name', example: 'venus' })
  @ApiOkResponse({ type: PlanetDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Planète inconnue.' })
  planet(@Param('name') name: string): PlanetDto {
    return this.bodies.planet(name);
  }
}
