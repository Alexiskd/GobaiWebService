import { Buffer } from 'node:buffer';
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { TtlCache } from './cache';
import { parseCapabilities } from './capabilities.parser';
import { MoonCatalogService } from './moon-catalog.service';
import { MOON_CONFIG, MoonConfig } from './moon.config';
import { CapabilitiesResult, CapabilitiesSummary, ProviderDefinition } from './moon.types';
import { MoonUpstreamService } from './upstream.service';

// ===========================================================================
// capabilities.service.ts — GetCapabilities OGC, mis en cache
// (reconstruit : le fichier d'origine n'était plus disponible)
// ===========================================================================

// Forme des capacités gardées en cache.
interface CachedCapabilities {
  // summary : leur résumé.
  summary: CapabilitiesSummary;
  // raw : leur texte XML, ou null.
  raw: string | null;
// Fin de CachedCapabilities.
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
// Classe du service des capacités de la Lune.
export class MoonCapabilitiesService {
  // Cache des capacités.
  private readonly cache: TtlCache<CachedCapabilities>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    // le catalogue ;
    private readonly catalog: MoonCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MoonUpstreamService,
  // Corps du constructeur :
  ) {
    // crée le cache,
    this.cache = new TtlCache<CachedCapabilities>(
      // de 16 documents au plus,
      16,
      // avec la durée de vie de la configuration,
      config.capabilitiesCacheTtlMs,
      // et la même durée pendant laquelle un document périmé est encore servi.
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
    // Texte XML demandé ou non (non par défaut).
    const raw = options.raw ?? false;

    // Jeu 3D Tiles :
    if (provider.kind === '3d-tiles') {
      // renvoie un résumé fabriqué, avec une note, sans texte XML.
      return { summary: this.noteSummary(provider, 'Jeu 3D Tiles : pas de GetCapabilities OGC.'), raw: null };
    // Fin du cas.
    }

    // Adresse des capacités du fournisseur.
    const url = provider.capabilitiesUrl;
    // Aucune :
    if (!url) {
      // renvoie
      return {
        // un résumé fabriqué,
        summary: this.noteSummary(
          // pour ce fournisseur,
          provider,
          // avec cette note ;
          'Ce fournisseur ne publie pas de document GetCapabilities exploitable.',
        // fin du résumé ;
        ),
        // pas de texte XML.
        raw: null,
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Sans rafraîchissement demandé :
    if (!options.refresh) {
      // cherche dans le cache, sous une clé qui dépend du fournisseur et du texte XML demandé ou non ;
      const cached = this.cache.peek(`${provider.id}:${raw ? 'raw' : 'std'}`);
      // trouvé :
      if (cached) {
        // le renvoie.
        return { summary: cached.summary, raw: cached.raw };
      // Fin du cas.
      }
    // Fin du cas.
    }

    // Télécharge et lit le document.
    const fetched = await this.fetchAndParse(provider, url, raw);
    // Le range dans le cache.
    this.cache.set(`${provider.id}:${raw ? 'raw' : 'std'}`, fetched);
    // Le renvoie.
    return { summary: fetched.summary, raw: fetched.raw };
  // Fin de getCapabilities.
  }

  // Méthode privée fetchAndParse ; ses paramètres :
  private async fetchAndParse(
    // le fournisseur ;
    provider: ProviderDefinition,
    // l'adresse ;
    url: string,
    // garder le texte XML ou non.
    raw: boolean,
  // Elle renvoie les capacités.
  ): Promise<CachedCapabilities> {
    // Texte du document.
    let text: string;
    // Essaie
    try {
      // de le télécharger,
      const response = await this.upstream.fetchText(url, {
        // en demandant du XML ;
        accept: 'application/xml,text/xml,*/*',
      // fin du téléchargement ;
      });
      // garde le texte.
      text = response.text;
    // En cas d'échec :
    } catch (error) {
      // erreur 502,
      throw new BadGatewayException(
        // avec le fournisseur et
        `GetCapabilities indisponible pour ${provider.id} : ${
          // le message de l'erreur ;
          error instanceof Error ? error.message : String(error)
        // fin du message.
        }`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Résumé de base :
    const base: CapabilitiesSummary = {
      // l'identifiant du fournisseur ;
      provider: provider.id,
      // sa nature ;
      kind: provider.kind,
      // l'heure de la lecture ;
      fetchedAt: new Date().toISOString(),
      // aucun format ;
      formats: [],
      // aucune projection ;
      crs: [],
      // pas d'emprise ;
      bbox: null,
      // aucune couche ;
      layers: [],
      // aucun jeu de tuiles ;
      tileMatrixSets: [],
      // pas de version ;
      version: null,
      // pas de titre ;
      serviceTitle: null,
      // le poids du texte, en octets ;
      bytes: Buffer.byteLength(text),
      // le type de contenu XML ;
      contentType: 'application/xml',
      // pas de durée ;
      fetchMs: null,
      // pas de modèle d'adresse.
      resourceUrlTemplate: null,
    // Fin du résumé de base.
    };

    // Essaie
    try {
      // de lire le XML ;
      const parsed = parseCapabilities(text);
      // résumé complet :
      const summary: CapabilitiesSummary = {
        // le résumé de base, complété par
        ...base,
        // la version ;
        version: parsed.version,
        // le titre du service ;
        serviceTitle: parsed.serviceTitle,
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
      };
      // Le renvoie, avec le texte XML s'il est demandé.
      return { summary, raw: raw ? text : null };
    // Si le XML est illisible :
    } catch (error) {
      // renvoie
      return {
        // un résumé :
        summary: {
          // le résumé de base,
          ...base,
          // avec une note qui porte
          note: `Document non parsable : ${
            // le message de l'erreur ;
            error instanceof Error ? error.message : String(error)
          // fin de la note.
          }`,
        // Fin du résumé.
        },
        // Et le texte XML s'il est demandé.
        raw: raw ? text : null,
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin de fetchAndParse.
  }

  // Méthode privée noteSummary ; ses paramètres :
  private noteSummary(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la note.
    note: string,
  // Elle renvoie un résumé fabriqué.
  ): CapabilitiesSummary {
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
      // aucun format ;
      formats: [],
      // aucune projection ;
      crs: [],
      // pas d'emprise ;
      bbox: null,
      // les couches du catalogue, chacune avec
      layers: provider.layers.map((layer) => ({
        // son identifiant comme nom,
        name: layer.id,
        // et son titre.
        title: layer.title,
      // Fin des couches.
      })),
      // Aucun jeu de tuiles.
      tileMatrixSets: [],
      // Pas de modèle d'adresse.
      resourceUrlTemplate: null,
      // La note.
      note,
    // Fin de l'objet.
    };
  // Fin de noteSummary.
  }
// Fin du service.
}
