// Outils NestJS : erreur 502, injection par jeton, service injectable.
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
// Ouvre l'import du lecteur de capacités :
import {
  // son erreur de lecture ;
  CapabilitiesParseError,
  // sa fonction de lecture.
  parseCapabilities,
// Fin de l'import.
} from './capabilities.parser';
// Cache à durée de vie.
import { TtlCache } from './cache';
// Jeton d'injection de la configuration de Mars, et son type.
import { MARS_CONFIG, type MarsConfig } from './mars.config';
// Service du catalogue de Mars.
import { MarsCatalogService } from './mars-catalog.service';
// Ouvre l'import de trois types (effacés à la compilation) :
import type {
  // le résultat rendu ;
  CapabilitiesResult,
  // le résumé des capacités ;
  CapabilitiesSummary,
  // la définition d'un fournisseur.
  ProviderDefinition,
// Fin de l'import.
} from './mars.types';
// Erreur et service des appels aux serveurs sources.
import { MarsUpstreamError, MarsUpstreamService } from './upstream.service';

// Forme d'un document de capacités gardé en cache.
interface CapabilitiesDocument {
  // summary : son résumé.
  summary: CapabilitiesSummary;
  // raw : son texte XML, ou null.
  raw: string | null;
// Fin de CapabilitiesDocument.
}

// Forme des options d'une demande.
export interface CapabilitiesOptions {
  // raw : rendre aussi le texte XML (facultatif).
  raw?: boolean;
  // refresh : relire la source sans passer par le cache (facultatif).
  refresh?: boolean;
// Fin de CapabilitiesOptions.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des capacités de Mars.
export class MarsCapabilitiesService {
  // Cache des documents, par fournisseur.
  private readonly cache: TtlCache<CapabilitiesDocument>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MARS_CONFIG) config: MarsConfig,
    // le catalogue ;
    private readonly catalog: MarsCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MarsUpstreamService,
  // Corps du constructeur :
  ) {
    // crée le cache,
    this.cache = new TtlCache<CapabilitiesDocument>(
      // de 8 documents au plus,
      8,
      // avec la durée de vie de la configuration.
      config.capabilitiesCacheTtlMs,
    // Fin de la création.
    );
  // Fin du constructeur.
  }

  // Méthode getCapabilities ; ses paramètres :
  async getCapabilities(
    // l'identifiant du fournisseur ;
    providerId: string,
    // les options, vides par défaut.
    options: CapabilitiesOptions = {},
  // Elle renvoie le résumé et, si demandé, le texte XML.
  ): Promise<CapabilitiesResult> {
    // Fournisseur demandé, pris dans le catalogue.
    const provider = this.catalog.getProvider(providerId);

    // Fournisseur XYZ ou 3D Tiles (sans document de capacités) :
    if (provider.kind === 'xyz' || provider.kind === '3d-tiles') {
      // renvoie un résumé fabriqué, sans texte XML.
      return { summary: this.syntheticSummary(provider), raw: null };
    // Fin du cas.
    }

    // Pas d'adresse de capacités :
    if (!provider.capabilitiesUrl) {
      // erreur 502,
      throw new BadGatewayException(
        // avec ce message.
        `Aucune URL GetCapabilities n’est configurée pour ${provider.id}.`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Essaie :
    try {
      // si un rafraîchissement est demandé,
      const lookup = options.refresh
        // relit la source et range le document ;
        ? await this.loadAndStore(provider)
        // sinon prend le document du cache, ou le charge
        : await this.cache.getOrLoad(provider.id, () =>
            // depuis l'adresse de capacités.
            this.load(provider, provider.capabilitiesUrl as string),
          // Fin de la lecture.
          );

      // Renvoie
      return {
        // le résumé ;
        summary: lookup.value.summary,
        // le texte XML s'il est demandé, sinon null.
        raw: options.raw ? lookup.value.raw : null,
      // Fin de l'objet.
      };
    // En cas d'échec :
    } catch (error) {
      // relance l'erreur, traduite en erreur HTTP.
      throw this.toHttpError(error);
    // Fin du cas.
    }
  // Fin de getCapabilities.
  }

  // Méthode privée loadAndStore.
  private async loadAndStore(provider: ProviderDefinition) {
    // Charge le document,
    const document = await this.load(
      // pour ce fournisseur,
      provider,
      // depuis son adresse de capacités.
      provider.capabilitiesUrl as string,
    // Fin du chargement.
    );
    // Le range dans le cache.
    this.cache.set(provider.id, document);
    // Renvoie
    return {
      // le document ;
      value: document,
      // « pas du cache » ;
      hit: false,
      // âge nul ;
      ageMs: 0,
      // la durée de vie du cache.
      ttlMs: this.cache.ttl,
    // Fin de l'objet.
    };
  // Fin de loadAndStore.
  }

  // Méthode privée load ; ses paramètres :
  private async load(
    // le fournisseur ;
    provider: ProviderDefinition,
    // l'adresse de capacités.
    capabilitiesUrl: string,
  // Elle renvoie le document.
  ): Promise<CapabilitiesDocument> {
    // Heure de départ.
    const startedAt = Date.now();
    // Télécharge le texte,
    const response = await this.upstream.fetchText(capabilitiesUrl, {
      // en demandant du XML.
      accept: 'application/xml, text/xml, */*',
    // Fin du téléchargement.
    });
    // Durée du téléchargement.
    const fetchMs = Date.now() - startedAt;
    // Lit le XML.
    const parsed = parseCapabilities(response.text);

    // Renvoie
    return {
      // le résumé :
      summary: {
        // l'identifiant du fournisseur ;
        provider: provider.id,
        // sa nature ;
        kind: provider.kind,
        // la version du service ;
        version: parsed.version,
        // son titre, ou le nom du fournisseur ;
        serviceTitle: parsed.serviceTitle ?? provider.name,
        // l'heure de la lecture ;
        fetchedAt: new Date().toISOString(),
        // le poids de la réponse ;
        bytes: response.bytes,
        // son type de contenu ;
        contentType: response.contentType,
        // la durée du téléchargement ;
        fetchMs,
        // les formats ;
        formats: parsed.formats,
        // les projections ;
        crs: parsed.crs,
        // l'emprise ;
        bbox: parsed.bbox,
        // les couches ;
        layers: parsed.layers,
        // les jeux de tuiles ;
        tileMatrixSets: parsed.tileMatrixSets,
        // le modèle d'adresse des tuiles.
        resourceUrlTemplate: parsed.resourceUrlTemplate,
      // Fin du résumé.
      },
      // Et le texte XML.
      raw: response.text,
    // Fin de l'objet.
    };
  // Fin de load.
  }

  // Méthode privée syntheticSummary.
  private syntheticSummary(provider: ProviderDefinition): CapabilitiesSummary {
    // Première couche du fournisseur.
    const layer = provider.layers[0];
    // Est-ce un jeu 3D Tiles ?
    const is3d = provider.kind === '3d-tiles';

    // Renvoie
    return {
      // l'identifiant du fournisseur ;
      provider: provider.id,
      // sa nature ;
      kind: provider.kind,
      // pas de version ;
      version: null,
      // son nom comme titre ;
      serviceTitle: provider.name,
      // l'heure courante ;
      fetchedAt: new Date().toISOString(),
      // pas de poids ;
      bytes: null,
      // pas de type de contenu ;
      contentType: null,
      // pas de durée ;
      fetchMs: null,
      // le format de la première couche, s'il y en a une ;
      formats: layer ? [layer.format] : [],
      // sa projection, s'il y en a une ;
      crs: layer ? [layer.crs] : [],
      // l'emprise du monde entier ;
      bbox: { west: -180, south: -90, east: 180, north: 90 },
      // les couches, chacune avec
      layers: provider.layers.map((entry) => ({
        // son nom chez la source,
        name: entry.upstreamLayer,
        // et son titre.
        title: entry.title,
      // Fin des couches.
      })),
      // Aucun jeu de tuiles.
      tileMatrixSets: [],
      // Le modèle d'adresse XYZ de la première couche, ou null.
      resourceUrlTemplate: layer?.xyz?.urlTemplate ?? null,
      // Une note qui explique l'absence de document :
      note: is3d
        // pour un jeu 3D,
        ? `${provider.name} est un jeu de tuiles 3D : aucun document GetCapabilities OGC n’est exposé.`
        // ou pour des tuiles XYZ.
        : `${provider.name} est servi en tuiles XYZ : aucun document GetCapabilities OGC n’est exposé.`,
    // Fin de l'objet.
    };
  // Fin de syntheticSummary.
  }

  // Méthode privée toHttpError.
  private toHttpError(error: unknown): Error {
    // Erreur de lecture du XML :
    if (error instanceof CapabilitiesParseError) {
      // erreur 502,
      return new BadGatewayException(
        // « Capacités OGC illisibles ».
        `Capacités OGC illisibles : ${error.message}`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Erreur d'un serveur source :
    if (error instanceof MarsUpstreamError) {
      // erreur 502,
      return new BadGatewayException(
        // « Capacités OGC indisponibles ».
        `Capacités OGC indisponibles : ${error.message}`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Sinon l'erreur telle quelle, ou une erreur faite de son texte.
    return error instanceof Error ? error : new Error(String(error));
  // Fin de toHttpError.
  }
// Fin du service.
}
