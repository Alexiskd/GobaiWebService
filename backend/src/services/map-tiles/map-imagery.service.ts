import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { LocateDto, TileLayerListDto, AttributionDto } from '../../dto/tiles.dto';
import { fillTemplate, gridSize, isValidTile, lonLatToTile, tileBounds, TILE_SIZE, MAX_LATITUDE } from './tile-math';
import type { ResolvedTileLayer, TileProvider, Viewport } from './providers/tile-provider';
import { GibsTileProvider } from './providers/gibs-tile.provider';
import { NasaTrekMoonProvider } from './providers/nasa-trek-moon.provider';
import { NasaTrekMarsProvider } from './providers/nasa-trek-mars.provider';
import { NasaTrekVenusProvider } from './providers/nasa-trek-venus.provider';
import { SpaceLayersService } from './space-layers.service';
import { MARS_BLEND_LAYER_ID } from '../mars/mars-blend.service';
import {
  getMarsFusionLayerId,
  MARS_FUSION_ALGORITHM_INFO,
} from '../mars/mars-fusion.service';

export const TILE_PROVIDERS = 'TILE_PROVIDERS';

const MARS_BLEND_LAYER = {
  id: MARS_BLEND_LAYER_ID,
  label: 'Mars Viking + CTX — palette',
  description:
    'Fusion Viking MDIM21 (NASA Mars Trek) + Global CTX Mosaic (Murray Lab/Caltech), recolorée avec la palette Mars.',
  kind: 'imagery' as const,
  provider: 'murray-lab' as const,
  body: 'mars' as const,
  projection: 'equirectangular' as const,
  minZoom: 0,
  maxZoom: 3,
  tileSize: 512,
  format: 'png' as const,
  transparent: false,
  requiresKey: false,
  experimental: false,
};

const MARS_FUSION_LAYERS = MARS_FUSION_ALGORITHM_INFO.map((algorithm) => ({
  id: getMarsFusionLayerId(algorithm.slug),
  label: algorithm.label,
  description: algorithm.description,
  kind: 'imagery' as const,
  provider: 'murray-lab' as const,
  body: 'mars' as const,
  projection: 'equirectangular' as const,
  minZoom: 0,
  maxZoom: 3,
  tileSize: 512,
  format: 'png' as const,
  transparent: false,
  requiresKey: false,
  experimental: false,
}));

/**
 * La Terre utilise NASA GIBS ; la Lune, Mars et Vénus viennent de NASA Solar System Treks (Moon, Mars et Venus Trek).
 */
@Injectable()
export class TilesService {
  private readonly gibs: TileProvider;
  private readonly moon: TileProvider;
  private readonly mars: TileProvider;
  private readonly venus: TileProvider;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TILE_PROVIDERS) providers: TileProvider[],
    @Optional() private readonly space?: SpaceLayersService,
  ) {
    this.gibs = providers.find((p) => p.id === 'gibs') ?? new GibsTileProvider(config.tiles.gibs);
    this.moon = providers.find((p) => p.id === 'nasa-trek') ?? new NasaTrekMoonProvider(config.tiles.moon);
    this.mars = providers.find((p) => p.id === 'mars-trek') ?? new NasaTrekMarsProvider(config.tiles.mars);
    this.venus = providers.find((p) => p.id === 'venus-trek') ?? new NasaTrekVenusProvider(config.tiles.venus);
  }

  /** Fond terrestre fixe : NASA GIBS, gratuit et sans clé. */
  active(): { provider: TileProvider; fallback: boolean } {
    return { provider: this.gibs, fallback: false };
  }

  list(): TileLayerListDto {
    const { provider, fallback } = this.active();
    return {
      provider: provider.id, fallback, tileSize: TILE_SIZE, placeSearch: Boolean(this.config.tiles.uber.clientId && this.config.tiles.uber.clientSecret),
      layers: [...provider.layers(), ...this.moon.layers(), ...this.mars.layers(), MARS_BLEND_LAYER, ...MARS_FUSION_LAYERS, ...this.venus.layers(), ...(this.space?.list() ?? [])],
    };
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    if (layerId === MARS_BLEND_LAYER_ID) {
      return {
        ...MARS_BLEND_LAYER,
        urlTemplate: `/api/v1/tiles/${MARS_BLEND_LAYER_ID}/{z}/{x}/{y}`,
        expiresAt: null,
        attribution: {
          text: 'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        },
      };
    }
    const fusionAlgorithm = MARS_FUSION_ALGORITHM_INFO.find(
      (algorithm) => getMarsFusionLayerId(algorithm.slug) === layerId,
    );
    if (fusionAlgorithm) {
      const layer = MARS_FUSION_LAYERS.find(
        (candidate) => candidate.id === layerId,
      )!;
      return {
        ...layer,
        urlTemplate: `/api/v1/tiles/mars-fusion/${fusionAlgorithm.slug}/{z}/{x}/{y}`,
        expiresAt: null,
        attribution: {
          text: 'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        },
      };
    }
    const spaceLayer = this.space?.resolve(layerId);
    if (spaceLayer) return spaceLayer;
    return this.providerFor(layerId).resolve(layerId);
  }

  async layer(layerId: string) {
    const found = this.allLayers().find((l) => l.id === layerId);
    if (!found) throw new NotFoundException(this.unknownLayer(layerId));
    return found;
  }

  async attribution(layerId: string, viewport: Viewport): Promise<AttributionDto> {
    if (viewport.north < viewport.south) throw new BadRequestException('`north` doit être supérieur ou égal à `south`.');
    if (layerId === MARS_BLEND_LAYER_ID) {
      return {
        copyright:
          'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        provider: 'murray-lab',
      };
    }
    if (
      MARS_FUSION_LAYERS.some((layer) => layer.id === layerId)
    ) {
      return {
        copyright:
          'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        provider: 'murray-lab',
      };
    }
    const spaceLayer = this.space?.resolve(layerId);
    if (spaceLayer) return { copyright: spaceLayer.attribution.text, provider: spaceLayer.provider };
    const provider = this.providerFor(layerId);
    const copyright = await provider.attribution(layerId, viewport);
    return { copyright, provider: provider.id };
  }

  async locate(lat: number, lon: number, zoom: number, layerId?: string): Promise<LocateDto> {
    if (layerId && (await this.layer(layerId)).projection !== 'mercator') {
      throw new BadRequestException(`« ${layerId} » n’est pas une couche Web Mercator de la Terre : \`locate\` ne s’applique pas.`);
    }
    const { z, x, y } = lonLatToTile(lon, lat, zoom);
    const out: LocateDto = { z, x, y, bounds: tileBounds(z, x, y), maxLatitude: MAX_LATITUDE };
    if (layerId) out.url = fillTemplate((await this.resolve(layerId)).urlTemplate, { z, x, y });
    return out;
  }

  /** URL finale d'une tuile précise (pour la redirection). */
  async tileUrl(layerId: string, z: number, x: number, y: number): Promise<string> {
    const info = await this.layer(layerId);
    if (z < info.minZoom || z > info.maxZoom) {
      throw new BadRequestException(`Zoom ${z} hors limites pour « ${layerId} » (${info.minZoom} à ${info.maxZoom}).`);
    }
    if (!isValidTile(z, x, y, info.projection)) {
      const { cols, rows } = gridSize(z, info.projection);
      throw new BadRequestException(`Tuile ${z}/${x}/${y} inexistante : x doit être entre 0 et ${cols - 1}, y entre 0 et ${rows - 1}.`);
    }
    return fillTemplate((await this.resolve(layerId)).urlTemplate, { z, x, y });
  }

  private allLayers() {
    return [...this.active().provider.layers(), ...this.moon.layers(), ...this.mars.layers(), MARS_BLEND_LAYER, ...MARS_FUSION_LAYERS, ...this.venus.layers(), ...(this.space?.list() ?? [])];
  }

  /** Fournisseur qui sert cette couche : la Lune et Mars ont le leur, le reste va au fournisseur actif de la Terre. */
  private providerFor(layerId: string): TileProvider {
    if (this.moon.layers().some((l) => l.id === layerId)) return this.moon;
    if (this.mars.layers().some((l) => l.id === layerId)) return this.mars;
    if (this.venus.layers().some((l) => l.id === layerId)) return this.venus;
    return this.active().provider;
  }

  private unknownLayer(id: string): string {
    const ids = this.allLayers().map((l) => l.id).join(', ');
    return `Couche inconnue : « ${id} ». Couches disponibles : ${ids}.`;
  }
}
