import { Controller, Get, Header } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import { BordersDto } from '../dto/borders.dto';
import { BordersService } from '../services/borders/borders.service';

@ApiTags('Frontières')
@Controller('borders')
export class BordersController {
  constructor(private readonly borders: BordersService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({
    summary: 'Frontières des pays et littoraux',
    description: 'Frontières terrestres entre pays et littoraux (Natural Earth 1:50m), en polylignes longitude/latitude.',
  })
  @ApiOkResponse({ type: BordersDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Source des données injoignable.' })
  all(): Promise<BordersDto> {
    return this.borders.get();
  }
}
