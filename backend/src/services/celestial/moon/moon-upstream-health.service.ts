import { Inject, Injectable } from '@nestjs/common';
import { MoonCatalogService } from './moon-catalog.service';
import { MOON_CONFIG, MoonConfig } from './moon.config';
import { HealthProviderResult, HealthReport, ProviderDefinition } from './moon.types';
import { buildTileUrl } from './tile-url';
import { MoonUpstreamService, UpstreamProbe } from './upstream.service';

// ===========================================================================
// moon-upstream-health.service.ts — santé des services amont
// ===========================================================================

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de santé de la Lune.
export class MoonHealthService {
  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    // le catalogue ;
    private readonly catalog: MoonCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MoonUpstreamService,
  // Corps du constructeur vide.
  ) {}

  // Méthode check : le rapport de santé.
  async check(): Promise<HealthReport> {
    // Attend tous les tests, lancés en même temps :
    const providers = await Promise.all(
      // depuis le catalogue,
      this.catalog
        // la liste des fournisseurs ;
        .listProviders()
        // un test par fournisseur.
        .map((provider) => this.checkProvider(provider)),
    // Fin de l'attente.
    );

    // Compteurs par état, à zéro.
    const summary = { up: 0, degraded: 0, down: 0, notConfigured: 0 };
    // Pour chaque résultat :
    for (const provider of providers) {
      // en service :
      if (provider.status === 'up') {
        // un de plus ;
        summary.up += 1;
      // dégradé :
      } else if (provider.status === 'degraded') {
        // un de plus ;
        summary.degraded += 1;
      // en panne :
      } else if (provider.status === 'down') {
        // un de plus ;
        summary.down += 1;
      // sinon (non configuré) :
      } else {
        // un de plus.
        summary.notConfigured += 1;
      // Fin du choix.
      }
    // Fin de la boucle.
    }

    // Renvoie
    return {
      // l'heure du test, en ISO 8601 ;
      checkedAt: new Date().toISOString(),
      // les compteurs ;
      summary,
      // les résultats.
      providers,
    // Fin de l'objet.
    };
  // Fin de check.
  }

  // Méthode privée checkProvider ; son paramètre :
  private async checkProvider(
    // le fournisseur.
    provider: ProviderDefinition,
  // Elle renvoie son résultat.
  ): Promise<HealthProviderResult> {
    // Première couche qui a des tuiles 2D.
    const layer = provider.layers.find((entry) => entry.scheme !== 'none');
    // Aucune :
    if (!layer || layer.scheme === 'none') {
      // renvoie
      return {
        // l'identifiant du fournisseur ;
        provider: provider.id,
        // sa nature ;
        kind: provider.kind,
        // l'état « en panne » ;
        status: 'down',
        // pas de code HTTP ;
        httpStatus: null,
        // latence nulle ;
        latencyMs: 0,
        // pas de type de contenu ;
        contentType: null,
        // le message d'erreur.
        error: 'Aucune couche 2D configurée.',
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Adresse de la première tuile de la couche, à son niveau minimal.
    const url = buildTileUrl(provider, layer, layer.minZoom, 0, 0);
    // Teste cette adresse, en demandant le format de la couche.
    const probe = await this.upstream.probe(url, { accept: layer.format });
    // Renvoie le résultat mis en forme.
    return toHealthResult(provider.id, provider.kind, probe);
  // Fin de checkProvider.
  }
// Fin du service.
}

// Fonction toHealthResult ; ses paramètres :
function toHealthResult(
  // l'identifiant du fournisseur ;
  provider: HealthProviderResult['provider'],
  // sa nature ;
  kind: HealthProviderResult['kind'],
  // le test.
  probe: UpstreamProbe,
// Elle renvoie un résultat.
): HealthProviderResult {
  // État à déterminer.
  let status: HealthProviderResult['status'];
  // Test réussi :
  if (probe.ok) {
    // en service.
    status = 'up';
  // Sinon, si le code est
  } else if (
    // 401,
    probe.status === 401 ||
    // 403,
    probe.status === 403 ||
    // ou 429
    probe.status === 429
  // (accès refusé ou trop de demandes) :
  ) {
    // dégradé.
    status = 'degraded';
  // Sinon :
  } else {
    // en panne.
    status = 'down';
  // Fin du choix.
  }

  // Renvoie
  return {
    // le fournisseur ;
    provider,
    // sa nature ;
    kind,
    // son état ;
    status,
    // le code HTTP ;
    httpStatus: probe.status,
    // la latence ;
    latencyMs: probe.latencyMs,
    // le type de contenu ;
    contentType: probe.contentType,
    // l'erreur.
    error: probe.error,
  // Fin de l'objet.
  };
// Fin de toHealthResult.
}
