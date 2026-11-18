// Outils NestJS : injection par jeton, service injectable.
import { Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration de Mars, et son type.
import { MARS_CONFIG, type MarsConfig } from './mars.config';
// Service du catalogue de Mars.
import { MarsCatalogService } from './mars-catalog.service';
// Ouvre l'import de trois types (effacés à la compilation) :
import type {
  // le résultat d'un fournisseur ;
  HealthProviderResult,
  // le rapport complet ;
  HealthReport,
  // la définition d'un fournisseur.
  ProviderDefinition,
// Fin de l'import.
} from './mars.types';
// Fonction qui construit l'adresse d'une tuile.
import { buildTileUrl } from './tile-url';
// Service des appels aux serveurs sources, et le type d'un test.
import { MarsUpstreamService, type UpstreamProbe } from './upstream.service';

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de santé de Mars.
export class MarsHealthService {
  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MARS_CONFIG) private readonly config: MarsConfig,
    // le catalogue ;
    private readonly catalog: MarsCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MarsUpstreamService,
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
