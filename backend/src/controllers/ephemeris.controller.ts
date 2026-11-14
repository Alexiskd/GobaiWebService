// Outils NestJS : Controller, Get (route), Query (paramètres de requête).
import { Controller, Get, Param, Query } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes des réponses (planètes, Lune, phases, satellites) et des paramètres de requête.
import { EphemerisDto, EphemerisQueryDto, KeplerBodyStateDto, MoonEphemerisDto, MoonPhasesDto, SatellitesEphemerisDto } from '../dto/ephemeris.dto';
// Service des phases de la Lune (U.S. Naval Observatory).
import { UsnoService } from '../services/ephemeris/usno.service';
// Service des orbites de Kepler (Lune et satellites).
import { KeplerEphemerisService } from '../services/ephemeris/kepler-ephemeris.service';
// Service des positions des planètes.
import { EphemerisService } from '../services/ephemeris/planetary-positions.service';

// Rubrique « Éphémérides » de la documentation.
@ApiTags('Éphémérides')
// Routes sous /api/v1/ephemeris.
@Controller('ephemeris')
// Classe du contrôleur des éphémérides.
export class EphemerisController {
  // Constructeur : NestJS y injecte trois services, gardés en propriétés privées non modifiables.
  constructor(
    // Positions des planètes.
    private readonly ephemeris: EphemerisService,
    // Orbites de Kepler.
    private readonly kepler: KeplerEphemerisService,
    // Phases de la Lune.
    private readonly usno: UsnoService,
  // Corps du constructeur vide.
  ) {}

  // Route GET /api/v1/ephemeris/moon.
  @Get('moon')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Position de la Lune (orbite de Kepler, calcul local)',
    // son texte (unités, repère, pas de temps).
    description: 'Vecteurs Terre → Lune en km, écliptique J2000, toutes les 30 min sur ≈ 50 h autour de maintenant.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un MoonEphemerisDto.
  @ApiOkResponse({ type: MoonEphemerisDto })
  // Méthode moon : renvoie une promesse de la table de positions de la Lune.
  moon(): Promise<MoonEphemerisDto> {
    // Délègue au service de Kepler.
    return this.kepler.moon();
  // Fin de moon.
  }

  // Route GET /api/v1/ephemeris/satellites.
  @Get('satellites')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Position des satellites (orbites de Kepler, calcul local)',
    // son texte.
    description: 'Vecteurs planète → satellite en km, écliptique J2000, toutes les 20 min sur ≈ 50 h autour de maintenant.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un SatellitesEphemerisDto.
  @ApiOkResponse({ type: SatellitesEphemerisDto })
  // Méthode satellites : renvoie une promesse des tables de positions des satellites.
  satellites(): Promise<SatellitesEphemerisDto> {
    // Délègue au service de Kepler.
    return this.kepler.satellites();
  // Fin de satellites.
  }

  // Route GET /api/v1/ephemeris/moon/phases.
  @Get('moon/phases')
  // Titre et description de la route.
  @ApiOperation({ summary: 'Prochaines phases de la Lune (USNO)', description: 'Nouvelle lune, quartiers, pleine lune : dates et heures UTC.' })
  // Réponse 200 documentée : un MoonPhasesDto.
  @ApiOkResponse({ type: MoonPhasesDto })
  // Réponse 502 documentée : l'observatoire n'a pas répondu.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode phases : renvoie une promesse des prochaines phases.
  phases(): Promise<MoonPhasesDto> {
    // Délègue au service USNO.
    return this.usno.phases();
  // Fin de phases.
  }

  // Route GET /api/v1/ephemeris/kepler/:id?time=...
  @Get('kepler/:id')
  @ApiOperation({
    summary: 'État orbital képlérien d’un corps',
    description: 'Calcule localement position, vitesse, distance, anomalies et période. Planètes héliocentriques ; satellites relatifs à leur planète mère.',
  })
  @ApiOkResponse({ type: KeplerBodyStateDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Date ISO 8601 invalide.' })
  keplerBody(@Param('id') id: string, @Query() query: EphemerisQueryDto): KeplerBodyStateDto {
    return this.kepler.body(id, query.time ? Date.parse(query.time) : Date.now());
  }

  // Route GET /api/v1/ephemeris.
  @Get()
  // Titre et description de la route.
  @ApiOperation({ summary: 'Positions des planètes', description: 'À l’instant donné (`time`, ISO 8601) ou maintenant.' })
  // Réponse 200 documentée : un EphemerisDto.
  @ApiOkResponse({ type: EphemerisDto })
  // Réponse 400 documentée : date invalide.
  @ApiBadRequestResponse({ type: ApiErrorDto, description: '`time` n’est pas une date ISO 8601 valide.' })
  // Méthode snapshot : reçoit les paramètres de requête validés.
  snapshot(@Query() query: EphemerisQueryDto): EphemerisDto {
    // Instant demandé en millisecondes : la date « time » convertie si elle est fournie, sinon maintenant ; le service calcule les positions à cet instant.
    return this.ephemeris.snapshot(query.time ? Date.parse(query.time) : Date.now());
  // Fin de snapshot.
  }
// Fin du contrôleur.
}
