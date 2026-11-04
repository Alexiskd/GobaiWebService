import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ROAD_CHAINS, ROAD_LABELS } from '../services/data/roads.data';
import { RoadsDto } from '../dto/roads.dto';

@ApiTags('Routes')
@Controller('roads')
export class RoadsController {
  @Get()
  @ApiOperation({
    summary: 'Axes routiers principaux',
    description: 'Tracé **approximatif** des grands axes : il ne reproduit pas le réseau routier réel.',
  })
  @ApiOkResponse({ type: RoadsDto })
  all(): RoadsDto {
    return { chains: ROAD_CHAINS, labels: ROAD_LABELS };
  }
}
