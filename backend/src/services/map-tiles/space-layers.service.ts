import { Injectable } from '@nestjs/common';
import { MarsCatalogService } from '../mars/mars-catalog.service';
import { MercuryCatalogService } from '../mercury/mercury-catalog.service';
import { MoonCatalogService } from '../moon/moon-catalog.service';
import type { TileBody, TileLayerInfo, ResolvedTileLayer } from './providers/tile-provider';

const PROVIDER_LABEL: Record<string, string> = {
  'moon-trek': 'NASA Moon Trek',
  'usgs-astro': 'USGS Astrogeology',
  'lroc-lunaserv': 'LROC Lunarserv',
  'usgs-astro-mars': 'USGS Astrogeology',
  'opm-mars': 'OpenPlanetaryMap',
  'murray-lab': 'Caltech Murray Lab',
  'mercury-lunaserv': 'ASU Lunaserv',
  'usgs-astro-mercury': 'USGS Astrogeology',
  'mercury-trek': 'NASA Mercury Trek',
  'mercury-trek-wmts': 'NASA Mercury Trek',
  'mercury-quickmap': 'Mercury QuickMap',
  'opm-mercury': 'OpenPlanetaryMap',
};

interface Adaptee {
  info: TileLayerInfo;
  urlTemplate: string;
  attribution: string;
}

/**
 * Expose les catalogues Lune/Mars/Mercure de l'app Space (modules moon/mars/mercury) dans l'API de tuiles de Gobai.
 * Seules les couches en projection géographique sont reprises : mêmes grilles 2^(z+1) × 2^z que le moteur,
 * et tuiles servies par le proxy `/api/v1/<astre>/providers/...` (aucune clé, CORS inutile côté navigateur).
 */
@Injectable()
export class SpaceLayersService {
  private adapted: Map<string, Adaptee> | null = null;

  constructor(
    private readonly moon: MoonCatalogService,
    private readonly mars: MarsCatalogService,
    private readonly mercury: MercuryCatalogService,
  ) {}

  list(): TileLayerInfo[] {
    return [...this.getAdapted().values()].map((entry) => entry.info);
  }

  resolve(layerId: string): ResolvedTileLayer | null {
    const entry = this.getAdapted().get(layerId);
    if (!entry) return null;
    return { ...entry.info, urlTemplate: entry.urlTemplate, expiresAt: null, attribution: { text: entry.attribution } };
  }

  private getAdapted(): Map<string, Adaptee> {
    if (this.adapted) return this.adapted;
    const out = new Map<string, Adaptee>();
    const catalogs: Array<
      [TileBody, MoonCatalogService | MarsCatalogService | MercuryCatalogService]
    > = [
      ['moon', this.moon],
      ['mars', this.mars],
      ['mercury', this.mercury],
    ];
    for (const [body, catalog] of catalogs) {
      for (const provider of catalog.listProviders()) {
        if (provider.requiresToken) continue;
        for (const layer of provider.layers) {
          // 3D Tiles et Web Mercator : incompatibles avec les grilles du moteur (trous polaires).
          if (layer.scheme !== 'equirectangular') continue;
          // Déjà fourni par la couche `mars-viking` de Gobai (même produit NASA).
          if (body === 'mars' && provider.id === 'mars-trek' && layer.id === 'viking-mdim21') continue;
          const id = `space-${body}-${provider.id}-${layer.id}`;
          const overlay = layer.id.includes('nomenclature');
          const relief = /hillshade|shade|bw|dem/.test(layer.id);
          const info: TileLayerInfo = {
            id,
            label: `${layer.title} · ${PROVIDER_LABEL[provider.id] ?? provider.name}`,
            description: layer.description,
            kind: overlay ? 'overlay' : relief ? 'relief' : 'imagery',
            provider: provider.id as TileLayerInfo['provider'],
            body,
            projection: 'equirectangular',
            minZoom: layer.minZoom,
            maxZoom: layer.maxZoom,
            tileSize: layer.tileSize,
            format: layer.format === 'image/png' ? 'png' : 'jpeg',
            transparent: overlay,
            requiresKey: false,
            experimental: false,
          };
          out.set(id, {
            info,
            urlTemplate: `/api/v1/${body}/providers/${provider.id}/layers/${layer.id}/tile/{z}/{x}/{y}`,
            attribution: layer.attribution,
          });
        }
      }
    }
    this.adapted = out;
    return out;
  }
}
