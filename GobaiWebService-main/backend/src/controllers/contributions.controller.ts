// Outils NestJS : contrôleur, routes, corps, paramètres, en-têtes, code de réponse et cache.
import { Body, Controller, Delete, Get, Header, HttpCode, Headers, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
// Limitation de débit, plus stricte sur les routes qui écrivent.
import { Throttle } from '@nestjs/throttler';
// Documentation OpenAPI.
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse,
  ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// Forme des erreurs de l'API.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes des données échangées.
import {
  AccountDto, ContributionDto, ContributionListDto, CreateContributionDto, CredentialsDto,
  CookieSessionDto, ListContributionsQueryDto, SessionDto, VoteDto, VoteResultDto,
} from '../dto/contributions.dto';
// Lecture du jeton porté par l'en-tête Authorization.
import { bearerToken, cookieSessionToken, SESSION_TTL_SECONDS } from '../services/contributions/accounts';
// Service des contributions.
import { ContributionsService } from '../services/contributions/contributions.service';

const SESSION_COOKIE = 'gobai_session';
const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1',
  maxAge: SESSION_TTL_SECONDS * 1000,
});
const requestSessionToken = (authorization?: string, cookie?: string) =>
  bearerToken(authorization) || cookieSessionToken(cookie);


/**
 * Contributions de placement LiDAR : comptes (pseudonyme et mot de passe, sans courriel), placements calculés
 * par le serveur à partir de l'en-tête d'un fichier LAS/LAZ, et votes sur la justesse de chaque placement.
 * La session est portée par l'en-tête « Authorization: Bearer <jeton> ».
 */
@ApiTags('Contributions')
@Controller('contributions')
// Classe du contrôleur des contributions.
export class ContributionsController {
  // Constructeur : NestJS y injecte le service.
  constructor(private readonly contributions: ContributionsService) {}

  /** Inscription : ouvre un compte et une session, sans courriel ni validation. */
  @Post('signup')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiOperation({ summary: 'Créer un compte de contributeur', description: 'Pseudonyme et mot de passe seulement : aucune adresse de courriel n’est demandée, aucune validation n’est attendue. La session est ouverte aussitôt.' })
  @ApiCreatedResponse({ type: SessionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Pseudonyme ou mot de passe refusé.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Pseudonyme déjà pris.' })
  // Méthode signup.
  async signup(@Body() body: CredentialsDto): Promise<SessionDto> {
    // Crée le compte et ouvre la session.
    const { token, account } = await this.contributions.signup(body.name, body.password);
    // La session.
    return { token, account, persistent: this.contributions.persistent };
  // Fin de signup.
  }

  /** Connexion : ouvre une session pour un compte existant. */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({ summary: 'Se connecter' })
  @ApiOkResponse({ type: SessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Pseudonyme ou mot de passe incorrect.' })
  // Méthode login.
  async login(@Body() body: CredentialsDto): Promise<SessionDto> {
    // Vérifie les identifiants et ouvre la session.
    const { token, account } = await this.contributions.login(body.name, body.password);
    // La session.
    return { token, account, persistent: this.contributions.persistent };
  // Fin de login.
  }

  /**
   * Connexion web : dépose le JWT dans un cookie HttpOnly ; contrairement à l'API Bearer historique,
   * aucun jeton n'est exposé au JavaScript de la page.
   */
  @Post('session/signup')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  @ApiOperation({ summary: 'Créer un compte web avec cookie de session HttpOnly' })
  @ApiCreatedResponse({ type: CookieSessionDto })
  async signupWeb(
    @Body() body: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CookieSessionDto> {
    const { token, account } = await this.contributions.signup(body.name, body.password);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { account, persistent: this.contributions.persistent };
  // Fin de signupWeb.
  }

  /** Connexion web : la session est conservée dans un cookie non lisible par JavaScript. */
  @Post('session/login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Ouvrir une session web sécurisée par cookie HttpOnly' })
  @ApiOkResponse({ type: CookieSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Pseudonyme ou mot de passe incorrect.' })
  async loginWeb(
    @Body() body: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CookieSessionDto> {
    const { token, account } = await this.contributions.login(body.name, body.password);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { account, persistent: this.contributions.persistent };
  // Fin de loginWeb.
  }

  /** Déconnexion serveur : révoque toutes les sessions de ce compte et supprime le cookie de ce navigateur. */
  @Post('session/logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Révoquer les sessions du compte et fermer la session web' })
  @ApiNoContentResponse({ description: 'Sessions révoquées ; le cookie HttpOnly est supprimé.' })
  async logoutWeb(
    @Headers('authorization') authorization: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const account = await this.contributions.requireAccount(requestSessionToken(authorization, cookie));
    await this.contributions.revokeSessions(account.id);
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
    response.clearCookie(SESSION_COOKIE, clearOptions);
  // Fin de logoutWeb.
  }

  /** Compte de la session en cours. */
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Compte de la session en cours' })
  @ApiBearerAuth('session')
  @ApiOkResponse({ type: AccountDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session absente, expirée ou refusée.' })
  // Méthode me.
  async me(@Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<AccountDto> {
    // Compte exigé.
    return this.contributions.requireAccount(requestSessionToken(authorization, cookie));
  // Fin de me.
  }

  /** Liste des placements publiés, avec les voix et celle du visiteur. */
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lister les placements', description: 'Tri « populaire » (score pondéré par l’âge), « recent » ou « meilleur ». Avec une session, chaque entrée porte la voix du visiteur.' })
  @ApiBearerAuth('session')
  @ApiOkResponse({ type: ContributionListDto })
  // Méthode list.
  async list(@Query() query: ListContributionsQueryDto, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<ContributionListDto> {
    // Compte du visiteur, s'il est connecté (la liste reste lisible sans compte).
    const account = await this.contributions.accountOf(requestSessionToken(authorization, cookie));
    // Les placements triés.
    const items = await this.contributions.list(query.sort ?? 'populaire', account?.id ?? null);
    // La liste.
    return { items, persistent: this.contributions.persistent };
  // Fin de list.
  }

  /** Publie un placement : le serveur recalcule la position à partir de l'en-tête reçu. */
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Publier un placement',
    description: 'Le navigateur envoie l’en-tête du fichier LAS/LAZ (emprise, nombre de points, système de coordonnées) ; '
      + 'le serveur en calcule seul la position WGS84 et la dalle LiDAR HD de l’IGN. Le fichier n’est pas envoyé.',
  })
  @ApiBearerAuth('session')
  @ApiCreatedResponse({ type: ContributionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'En-tête illisible, ou système de coordonnées non pris en charge.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session absente ou refusée.' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Nombre maximal de contributions atteint.' })
  // Méthode create.
  async create(@Body() body: CreateContributionDto, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<ContributionDto> {
    // Compte exigé.
    const account = await this.contributions.requireAccount(requestSessionToken(authorization, cookie));
    // Publie le placement.
    return this.contributions.create(account, body);
  // Fin de create.
  }

  /** Vote sur la justesse d'un placement. */
  @Post(':id/vote')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 600_000 } })
  @ApiOperation({ summary: 'Voter sur un placement', description: 'Une seule voix par compte et par placement ; renvoyer la même valeur ou 0 la retire.' })
  @ApiBearerAuth('session')
  @ApiOkResponse({ type: VoteResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session absente ou refusée.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Placement inconnu.' })
  // Méthode vote.
  async vote(@Param('id', ParseUUIDPipe) id: string, @Body() body: VoteDto, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<VoteResultDto> {
    // Compte exigé.
    const account = await this.contributions.requireAccount(requestSessionToken(authorization, cookie));
    // Enregistre la voix.
    return this.contributions.vote(account, id, body.value);
  // Fin de vote.
  }

  /** Retire un placement : réservé à son auteur. */
  @Delete(':id')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiOperation({ summary: 'Retirer son placement' })
  @ApiBearerAuth('session')
  @ApiNoContentResponse({ description: 'Placement retiré.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Session absente ou refusée.' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Placement inconnu, ou publié par quelqu’un d’autre.' })
  // Méthode remove.
  async remove(@Param('id', ParseUUIDPipe) id: string, @Headers('authorization') authorization?: string, @Headers('cookie') cookie?: string): Promise<void> {
    // Compte exigé.
    const account = await this.contributions.requireAccount(requestSessionToken(authorization, cookie));
    // Retire le placement.
    await this.contributions.remove(account, id);
  // Fin de remove.
  }
// Fin du contrôleur.
}
