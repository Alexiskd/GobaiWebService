// Ouvre la liste des outils NestJS importés :
import {
  // erreur 400 ;
  BadRequestException,
  // décorateur de contrôleur ;
  Controller,
  // route GET ;
  Get,
  // en-tête de réponse ;
  Header,
  // paramètre de l'adresse.
  Param,
// Fin de l'import.
} from '@nestjs/common';
// Service du point sous-solaire.
import { SunService } from '../services/sun/sun.service';
// Liste des astres acceptés, et fonction qui vérifie qu'un texte en fait partie.
import { SUN_BODIES, isSunBody } from '../services/sun/sun.types';
// Service de l'activité solaire (NOAA).
import { SolarActivityService } from '../services/sun/solar-activity.service';
// Service des régions actives et des éruptions localisées (NOAA SWPC et NASA DONKI).
import { SolarRegionsService } from '../services/sun/solar-regions.service';
// Décorateurs de documentation OpenAPI : étiquette du groupe et description des routes.
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// Routes sous /api/v1/sun.
// Groupe de la documentation : Soleil.
@ApiTags('Soleil')
@Controller('sun')
// Classe du contrôleur du Soleil.
export class SunController {
  // Constructeur : NestJS y injecte deux services.
  constructor(
    // Le service du point sous-solaire.
    private readonly sunService: SunService,
    // Le service de l'activité solaire.
    private readonly activityService: SolarActivityService,
    // Le service des régions actives.
    private readonly regionsService: SolarRegionsService,
  // Corps du constructeur vide.
  ) {}

  // Route GET /api/v1/sun.
  @Get()
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Panorama du module Soleil : astres couverts et routes disponibles' })
  // Méthode overview : décrit le module.
  overview() {
    // Objet renvoyé :
    return {
      // nom du module ;
      module: 'sun',
      // description, écrite sur la ligne suivante :
      description:
        // texte de la description.
        'Point sous-solaire en direct pour les globes, calculé sur ce serveur.',
      // source, écrite sur la ligne suivante :
      source:
        // texte de la source (même remarque).
        'Éléments orbitaux et modèles de rotation (UAI pour Mars, lois de Cassini pour la Lune) : calcul local, aucun service d’éphémérides n’est interrogé.',
      // astres acceptés : chaque entrée de SUN_BODIES devient un objet,
      bodies: Object.entries(SUN_BODIES).map(([id, definition]) => ({
        // avec son identifiant,
        id,
        // son nom,
        name: definition.name,
        // et son repère de coordonnées.
        frame: definition.frame,
      // Fin de la liste des astres.
      })),
      // Adresses des routes du module :
      endpoints: {
        // point sous-solaire d'un astre ;
        ephemeris: '/api/v1/sun/:body',
        // exemple pour la Lune ;
        moon: '/api/v1/sun/moon',
        // exemple pour Mars ;
        mars: '/api/v1/sun/mars',
        // activité solaire ;
        activity: '/api/v1/sun/activity',
        // régions actives et éruptions localisées.
        regions: '/api/v1/sun/regions',
      // Fin des adresses.
      },
    // Fin de l'objet.
    };
  // Fin de overview.
  }

  /** Activité solaire en direct (NOAA SWPC) : Kp, taches, vent solaire, éruptions des 7 derniers jours. */
  // Route GET /api/v1/sun/activity, déclarée avant « :body » pour ne pas être prise pour un nom d'astre.
  @Get('activity')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Activité solaire en direct', description: 'Indice Kp, taches, vent solaire et éruptions des sept derniers jours (NOAA SWPC).' })
  // Cache public de 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  // Méthode activity.
  activity() {
    // Délègue au service de l'activité solaire.
    return this.activityService.activity();
  // Fin de activity.
  }

  /** Régions actives et éruptions localisées (NOAA SWPC et NASA DONKI) : de quoi placer les éruptions sur le Soleil. */
  // Route GET /api/v1/sun/regions, déclarée avant « :body » pour ne pas être prise pour un nom d'astre.
  @Get('regions')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Régions actives du Soleil, en direct', description: 'Groupes de taches avec leur position héliographique, leur surface et leurs probabilités d’éruption (NOAA SWPC), et éruptions des trois derniers jours avec le lieu d’où elles sont parties (NASA DONKI).' })
  // Cache public de 10 minutes : les deux flux amont ne bougent pas plus vite.
  @Header('Cache-Control', 'public, max-age=600')
  // Méthode regions.
  regions() {
    // Délègue au service des régions actives.
    return this.regionsService.regions();
  // Fin de regions.
  }

  // Route GET /api/v1/sun/:body.
  @Get(':body')
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Point sous-solaire d’un astre', description: 'Position du Soleil à la verticale de l’astre, pour éclairer le globe, et les vingt-quatre heures qui suivent. Calcul local.' })
  // Cache public de 30 secondes.
  @Header('Cache-Control', 'public, max-age=30')
  // Méthode ephemeris : reçoit le nom de l'astre.
  ephemeris(@Param('body') body: string) {
    // Si ce nom n'est pas un astre accepté :
    if (!isSunBody(body)) {
      // erreur 400,
      throw new BadRequestException(
        // avec un message qui cite la valeur reçue et la liste des valeurs acceptées.
        `Corps inconnu : ${body}. Valeurs acceptées : ${Object.keys(SUN_BODIES).join(', ')}.`,
      // Fin de la création de l'erreur.
      );
    // Fin de la vérification.
    }
    // Délègue au service pour cet astre.
    return this.sunService.get(body);
  // Fin de ephemeris.
  }
// Fin du contrôleur.
}
