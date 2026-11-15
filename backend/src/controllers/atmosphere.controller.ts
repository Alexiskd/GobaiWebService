// Outils NestJS : contrôleur, routes GET, en-têtes, paramètres, requête et erreurs 400 et 404.
import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
// Décorateurs de documentation OpenAPI : étiquette du groupe et description des routes.
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// Service du moteur atmosphérique.
import { AtmosphereService } from '../services/atmosphere/atmosphere.service';
// Familles d'événements du format commun.
import { AtmosphericEventType } from '../services/atmosphere/atmospheric-event';

// Familles acceptées dans le filtre « types ».
const TYPES: AtmosphericEventType[] = ['hotspot', 'wildfire', 'cyclone', 'lightning', 'storm', 'precipitation', 'aerosol', 'smoke', 'wind', 'jet-stream', 'fog'];

/** Lit le filtre des familles : « wildfire,cyclone » ; erreur 400 si une famille est inconnue. */
// Fonction parseTypes : le texte de la requête.
export function parseTypes(raw: string | undefined): AtmosphericEventType[] | undefined {
  // Absent : toutes les familles.
  if (!raw?.trim()) return undefined;
  // Familles demandées.
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  // Familles inconnues.
  const bad = list.filter((t) => !TYPES.includes(t as AtmosphericEventType));
  // Inconnue : erreur 400.
  if (bad.length) throw new BadRequestException(`Familles inconnues : ${bad.join(', ')} (permises : ${TYPES.join(', ')})`);
  // Familles reconnues.
  return list as AtmosphericEventType[];
// Fin de parseTypes.
}

/** Lit l'emprise « ouest,sud,est,nord » (degrés) ; erreur 400 si elle est illisible. */
// Fonction parseBbox : le texte de la requête.
export function parseBbox(raw: string | undefined): [number, number, number, number] | undefined {
  // Absente : tout le globe.
  if (!raw?.trim()) return undefined;
  // Quatre nombres.
  const v = raw.split(',').map(Number);
  // Illisible, ou hors du globe, ou sud au-dessus du nord : erreur 400.
  if (v.length !== 4 || !v.every(Number.isFinite) || Math.abs(v[0]) > 180 || Math.abs(v[2]) > 180 || Math.abs(v[1]) > 90 || Math.abs(v[3]) > 90 || v[1] > v[3]) throw new BadRequestException('bbox attendue : ouest,sud,est,nord en degrés');
  // Emprise.
  return v as [number, number, number, number];
// Fin de parseBbox.
}

// Groupe de la documentation : Atmosphère.
@ApiTags('Atmosphère')
// Routes sous /api/v1/atmosphere.
@Controller('atmosphere')
// Classe du contrôleur atmosphérique.
export class AtmosphereController {
  // Constructeur : NestJS y injecte le service atmosphérique.
  constructor(private readonly atmosphere: AtmosphereService) {}

  // Route GET /api/v1/atmosphere/providers.
  @Get('providers')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Registre des fournisseurs atmosphériques', description: 'Phénomènes couverts, rythme de rafraîchissement, licence, quota, présence des clés (jamais leur valeur), fournisseurs branchés ou prévus.' })
  // Jamais gardé en cache : l'état change.
  @Header('Cache-Control', 'no-store')
  // Méthode providers.
  providers() {
    // Délègue au service.
    return this.atmosphere.providers();
  // Fin de providers.
  }

  // Route GET /api/v1/atmosphere/health.
  @Get('health')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Contrôle des calques atmosphériques', description: 'Par calque : événements affichés, écartés (et pourquoi), contradictions entre fournisseurs, données périmées, pannes.' })
  // Jamais gardé en cache.
  @Header('Cache-Control', 'no-store')
  // Méthode health.
  health() {
    // Délègue au service.
    return this.atmosphere.health();
  // Fin de health.
  }

  // Route GET /api/v1/atmosphere/fires.
  @Get('fires')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Incendies : points chauds satellite (24 h, agrégés) et incendies confirmés', description: 'Sources : NASA FIRMS (VIIRS, MODIS) et NASA EONET. Points chauds en colonnes par cellule de 0,5° ; un point chaud est une détection, pas un incendie confirmé.' })
  // Cache public de 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  // Méthode fires.
  fires() {
    // Délègue au service.
    return this.atmosphere.fires();
  // Fin de fires.
  }

  // Route GET /api/v1/atmosphere/fires/tiles/:tx/:ty.
  @Get('fires/tiles/:tx/:ty')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Points chauds d’une tuile de 10°, un par un', description: 'tx : colonne depuis −180° ; ty : ligne depuis −90°. Pour la vue rapprochée.' })
  // Cache public de 10 minutes.
  @Header('Cache-Control', 'public, max-age=600')
  // Méthode fireTile : colonne et ligne.
  async fireTile(@Param('tx') tx: string, @Param('ty') ty: string) {
    // Tuile lue par le service.
    const tile = await this.atmosphere.fireTile(Number(tx), Number(ty));
    // Hors de la grille : 404.
    if (!tile) throw new NotFoundException('Tuile hors de la grille (tx 0–35, ty 0–17)');
    // Renvoie la tuile.
    return tile;
  // Fin de fireTile.
  }

  // Route GET /api/v1/atmosphere/cyclones.
  @Get('cyclones')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Cyclones actifs confirmés', description: 'Sources : NOAA NHC, NASA EONET (JTWC), GDACS. Position, vent, pression, catégorie, trajectoire observée, déplacement estimé, contradictions entre sources ; les cyclones sans position récente sont écartés et listés.' })
  // Cache public de 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  // Méthode cyclones.
  cyclones() {
    // Délègue au service.
    return this.atmosphere.cyclones();
  // Fin de cyclones.
  }

  // Route GET /api/v1/atmosphere/events.
  @Get('events')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Événements atmosphériques au format commun', description: 'Filtres : types=wildfire,cyclone,hotspot · bbox=ouest,sud,est,nord · limit (2 000 au plus). Les points chauds demandent une emprise.' })
  // Cache public de 5 minutes.
  @Header('Cache-Control', 'public, max-age=300')
  // Méthode events : familles, emprise et limite.
  events(@Query('types') types?: string, @Query('bbox') bbox?: string, @Query('limit') limit?: string) {
    // Limite lue, entre 1 et 2 000 (2 000 par défaut).
    const n = Math.min(2_000, Math.max(1, Math.floor(Number(limit)) || 2_000));
    // Délègue au service, filtres contrôlés.
    return this.atmosphere.events(parseTypes(types), parseBbox(bbox), n);
  // Fin de events.
  }
// Fin du contrôleur.
}
