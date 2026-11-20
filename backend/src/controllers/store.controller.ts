// Outils NestJS : contrôleur, routes, corps, paramètres, en-têtes, requête, code de réponse et garde.
import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
// Requête Express, pour lire les droits posés par ScopeGuard.
import type { Request } from 'express';
// Limitation de débit.
import { Throttle } from '@nestjs/throttler';
// Documentation OpenAPI.
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
// Forme des erreurs de l'API.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes des données échangées.
import { CatalogueDto, CorsSiteDto, CreateOrderDto, LicenceDto, LicencesDto, OrderDto, OrderParamsDto, RegisterCorsSiteDto } from '../dto/store.dto';
// Service de la boutique.
import { StoreService } from '../services/store/store.service';
// Garde et déclaration du droit exigé (ici : avoir acheté l'article « cors-site »).
import { RequiresScope, ScopeGuard } from '../common/jwt.guard';
// Liste des sites externes autorisés en CORS, et droit associé.
import { AllowedOriginsService } from '../services/store/allowed-origins.service';
import { SCOPE_CORS } from '../services/store/catalogue';
// Service des comptes : le compte connecté est celui des contributions, le même pour tout le site.
import { ContributionsService } from '../services/contributions/contributions.service';
// Lecture du jeton porté par l'en-tête Authorization.
import { bearerToken, cookieSessionToken } from '../services/contributions/accounts';

const sessionToken = (authorization?: string, cookie?: string) => bearerToken(authorization) || cookieSessionToken(cookie);
// Mise en forme des prix.
import { formatPrice } from '../services/store/catalogue';
// Configuration : les sites de retour autorisés.
import { APP_CONFIG } from '../modules/config.module';
// Type de la configuration.
import type { AppConfig } from '../common/configuration';
// Injection de la configuration.
import { Inject } from '@nestjs/common';

/**
 * Boutique des exports : catalogue, page de paiement Stripe, et jeton d'accès délivré après paiement.
 *
 *   1. `GET  store/catalogue`              → ce qui est vendu et à quel prix ; route libre ;
 *   2. `POST store/orders`                 → crée la page de paiement Stripe du compte connecté ;
 *   3. `POST store/orders/{id}/claim`      → au retour de l'acheteur, vérifie le paiement et signe le jeton ;
 *   4. `GET  store/licences`               → ce que le compte connecté possède, avec un jeton frais pour chaque.
 *
 * **Un achat se fait depuis un compte connecté.** La page de paiement est créée pour ce compte (son identifiant
 * est inscrit chez Stripe et ne peut plus changer), et seul ce compte peut réclamer le jeton du paiement. Le
 * compte est celui du site, ouvert sans courriel ni validation (`/contributions/signup`), et se présente ici
 * dans l'en-tête « Authorization: Bearer <jeton de session> ».
 *
 * Le jeton d'accès obtenu s'emploie ensuite sur les routes `/export`, dans le même en-tête. Le serveur ne garde
 * pas le jeton lui-même : il garde l'achat, ce qui permet de redemander un jeton frais depuis n'importe quel
 * appareil, sans jamais prolonger la durée payée.
 */
@ApiTags('Boutique')
@Controller('store')
// Classe du contrôleur de la boutique.
export class StoreController {
  // Constructeur : NestJS y injecte la boutique, les comptes, la configuration et la liste CORS.
  constructor(
    private readonly store: StoreService,
    private readonly accounts: ContributionsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly origins: AllowedOriginsService,
  ) {}

  /** Ce qui est vendu, à quel prix, et si le paiement est ouvert. */
  @Get('catalogue')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Catalogue des exports payants',
    description: 'Modèles 3D et fonds de carte de chaque astre — le Soleil compris —, position apparente du '
      + 'Soleil, calcul d’orbite, et l’ensemble. Prix réglés par le serveur. `missing` nomme les variables '
      + 'd’environnement qui manquent quand le paiement est fermé.',
  })
  @ApiOkResponse({ type: CatalogueDto })
  // Méthode catalogue.
  catalogue(): CatalogueDto {
    // Le catalogue, avec les sites de retour autorisés.
    return this.store.catalogue(this.config.donations.siteUrls);
  // Fin de catalogue.
  }

  /** Crée la page de paiement d'un article. */
  @Post('orders')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth('session')
  @ApiOperation({
    summary: 'Acheter un export',
    description: 'Crée la page de paiement Stripe de l’article **pour le compte connecté** et renvoie son '
      + 'adresse. L’identifiant du compte est inscrit chez Stripe : seul ce compte pourra réclamer le jeton. '
      + 'Pour un article loué à l’heure, le montant et la durée du jeton suivent le champ `hours`.',
  })
  @ApiCreatedResponse({ type: OrderDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Aucune session : connectez-vous avant d’acheter.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Article inconnu.' })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'Paiement non configuré sur ce serveur.' })
  // Méthode createOrder.
  async createOrder(@Body() body: CreateOrderDto, @Headers('authorization') authorization?: string, @Headers('origin') origin?: string, @Headers('cookie') cookie?: string): Promise<OrderDto> {
    // Le compte connecté : un achat anonyme n'est pas accepté, sinon personne ne pourrait retrouver ses droits.
    const account = await this.accounts.requireAccount(sessionToken(authorization, cookie));
    // Site de retour : celui d'où vient l'acheteur s'il est autorisé, sinon le premier site configuré.
    const site = this.returnSite(origin);
    // La commande, pour le nombre d'heures demandé s'il s'agit d'une location.
    const { id, url, product, hours, cents } = await this.store.createOrder(body.productId, site, body.hours ?? 1, { id: account.id, name: account.name });
    // La page de paiement, l'article accompagné du prix réellement demandé.
    return { id, url, hours, cents, product: { ...product, price: formatPrice(cents) } };
  // Fin de createOrder.
  }

  /** Au retour de l'acheteur : vérifie le paiement et délivre le jeton d'accès. */
  @Post('orders/:id/claim')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiBearerAuth('session')
  @ApiOperation({
    summary: 'Récupérer le jeton d’accès après paiement',
    description: 'Le paiement est vérifié auprès de Stripe, puis l’achat est enregistré pour le compte '
      + 'connecté — celui qui a créé la page de paiement, et lui seul. Le jeton porte les droits achetés et '
      + 'vaut un an (les heures payées pour une location) ; il n’est pas conservé sur le serveur, mais se '
      + 'redemande ici ou par `GET store/licences`, sans jamais prolonger la durée payée.',
  })
  @ApiOkResponse({ type: LicenceDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Aucune session : connectez-vous pour récupérer votre jeton.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Ce paiement a été fait par un autre compte.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Paiement non abouti : aucun accès n’est délivré.' })
  // Méthode claim.
  async claim(@Param() p: OrderParamsDto, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<LicenceDto> {
    // Le compte connecté.
    const account = await this.accounts.requireAccount(sessionToken(authorization, cookie));
    // Vérifie, enregistre et signe.
    return this.store.claim(p.id, { id: account.id, name: account.name });
  // Fin de claim.
  }

  /** Ce que le compte connecté possède, avec un jeton frais pour chaque achat encore valable. */
  @Get('licences')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiBearerAuth('session')
  @ApiOperation({
    summary: 'Mes achats',
    description: 'Les achats du compte connecté encore valables, chacun avec un jeton frais : de quoi retrouver '
      + 'ses droits sur un autre appareil sans conserver le jeton. La durée payée n’est jamais prolongée — un '
      + 'jeton redemandé expire à la date de l’achat.',
  })
  @ApiOkResponse({ type: LicencesDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Aucune session : connectez-vous.' })
  // Méthode licences.
  async licences(@Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<LicencesDto> {
    // Le compte connecté.
    const account = await this.accounts.requireAccount(sessionToken(authorization, cookie));
    // Ses achats.
    const items = await this.store.licencesOf({ id: account.id, name: account.name });
    // La liste, et la durabilité du stockage.
    return { items, persistent: this.store.persistent };
  // Fin de licences.
  }

  /**
   * Ajoute le site de l'acheteur à la liste CORS, avec le jeton obtenu pour l'article « cors-site ». Après cet
   * appel, le site appelle l'API directement depuis un navigateur, sans plus présenter aucun jeton : c'est la
   * seule protection de l'API pour un usage externe (voir common/cors.ts). Un même jeton ne peut ajouter qu'un
   * site à la fois ; acheter un deuxième article « cors-site » permet d'en ajouter un second.
   */
  @Post('cors-sites')
  @HttpCode(201)
  @UseGuards(ScopeGuard)
  @RequiresScope(SCOPE_CORS)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth('cle-api')
  @ApiOperation({
    summary: 'Autoriser un site externe (CORS)',
    description: 'Ajoute l’adresse donnée à la liste CORS du serveur (table `allowed_origins`) : ce site pourra '
      + 'ensuite appeler l’API comme gobaispace.com lui-même, sans en-tête `Authorization`. Exige le jeton de '
      + 'l’article « cors-site », acheté sur `/store/orders`.',
  })
  @ApiCreatedResponse({ type: CorsSiteDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Jeton absent, expiré ou refusé.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Ce jeton ne donne pas le droit d’ajouter un site (achetez l’article « cors-site »).' })
  // Méthode registerCorsSite.
  async registerCorsSite(@Body() body: RegisterCorsSiteDto, @Req() req: Request): Promise<CorsSiteDto> {
    // Le compte porté par le jeton (posé sur la requête par ScopeGuard) ; « ? » car un site partenaire libre n'a pas de sujet.
    const accountId = String((req as Request & { jwt?: { sub?: unknown } }).jwt?.sub ?? 'inconnu');
    // Enregistre l'origine ; en mémoire aussitôt, en base si elle est configurée.
    const origin = await this.origins.add(body.origin, accountId);
    // Confirmation.
    return { origin, added: true };
  // Fin de registerCorsSite.
  }

  // Site de retour : celui de l'en-tête Origin s'il fait partie des sites autorisés, sinon le premier d'entre eux.
  private returnSite(origin?: string): string {
    // Les sites autorisés.
    const sites = this.config.donations.siteUrls;
    // Celui d'où vient l'acheteur, s'il est autorisé.
    const from = origin && sites.find((s) => s === origin.replace(/\/$/, ''));
    // Le site retenu.
    return from || sites[0] || '';
  // Fin de returnSite.
  }
// Fin du contrôleur.
}
