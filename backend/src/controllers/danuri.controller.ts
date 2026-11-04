import { Controller, Get, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBadGatewayResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Matches } from 'class-validator';
import { ApiErrorDto } from '../dto/api-error.dto';
import { ShadowCamService, type ShadowCamImageMeta, type ShadowCamMosaic } from '../services/shadowcam/shadowcam.service';

class MosaicParamsDto {
  @Matches(/^shadowcam_cmosaic_[a-z0-9_-]{4,120}$/) id: string;
  @Type(() => Number) @IsInt() @IsIn([20, 5]) res: number;
}

interface BinaryResponse { setHeader(name: string, value: string): unknown; send(body: unknown): unknown }

@ApiTags('Danuri (KPLO)')
@Controller('danuri')
export class DanuriController {
  constructor(private readonly shadowcam: ShadowCamService) {}

  @Get('shadowcam')
  @ApiOperation({
    summary: 'Mosaïques ShadowCam des pôles (Danuri)',
    description: 'Cratères en ombre permanente des pôles Nord et Sud photographiés par ShadowCam (NASA) à bord de Danuri (KARI). Source : archive PDS.',
  })
  @ApiOkResponse({ description: 'Liste des mosaïques : id, nom, pôle, centre, saison.' })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  async list(): Promise<{ source: string; items: ShadowCamMosaic[] }> {
    return { source: 'ShadowCam (NASA/KARI/ASU) · Danuri KPLO · PDS', items: await this.shadowcam.list() };
  }

  @Get('shadowcam/:id/:res/meta')
  @ApiOperation({ summary: 'Géoréférencement d’une mosaïque', description: 'Stéréographique polaire : coin, taille de pixel, paramètres.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  meta(@Param() p: MosaicParamsDto): Promise<ShadowCamImageMeta> {
    return this.shadowcam.meta(p.id, p.res);
  }

  @Get('shadowcam/:id/:res/image.png')
  @SkipThrottle()
  @ApiOperation({ summary: 'Image d’une mosaïque (PNG gris + transparence)' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async image(@Param() p: MosaicParamsDto, @Res() res: BinaryResponse): Promise<void> {
    const png = await this.shadowcam.png(p.id, p.res);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(png);
  }
}
