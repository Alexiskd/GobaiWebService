// Outils NestJS : contrôleur, routes GET, en-têtes, paramètres, requête, réponse brute et erreurs 400 et 404.
import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query, Res } from '@nestjs/common';
// Type de la réponse d'Express, pour renvoyer une image.
import type { Response } from 'express';
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

  // Route GET /api/v1/atmosphere/lightning.
  @Get('lightning')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Foudre autour d’un point', description: 'Source : Xweather Lightning (accès standard : 5 dernières minutes, 100 km, 1 000 impacts). Paramètres lon, lat. Impacts en colonnes (âge, nature, courant signé, confiance), fréquence, densité, zones actives.' })
  // Cache public de 30 secondes.
  @Header('Cache-Control', 'public, max-age=30')
  // Méthode lightning : longitude et latitude.
  lightning(@Query('lon') lon?: string, @Query('lat') lat?: string) {
    // Nombres lus.
    const lo = Number(lon), la = Number(lat);
    // Absents ou hors du globe : erreur 400.
    if (lon === undefined || lat === undefined || !Number.isFinite(lo) || !Number.isFinite(la) || Math.abs(lo) > 180 || Math.abs(la) > 90) throw new BadRequestException('lon et lat attendus, en degrés');
    // Délègue au service.
    return this.atmosphere.lightning(lo, la);
  // Fin de lightning.
  }

  // Route GET /api/v1/atmosphere/lightning/tiles/:z/:x/:y.
  @Get('lightning/tiles/:z/:x/:y')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Tuile de la couche mondiale des impacts de foudre', description: 'Relais de Xweather Raster Maps (couche lightning-strikes), niveaux 0 à 3, gardée 2 minutes. 404 hors des niveaux ou sans accès.' })
  // Méthode lightningTile : niveau, colonne, ligne et réponse brute.
  async lightningTile(@Param('z') z: string, @Param('x') x: string, @Param('y') y: string, @Res() res: Response) {
    // Tuile lue par le service.
    const tile = await this.atmosphere.lightningTile(Number(z), Number(x), Number(y));
    // Indisponible : 404.
    if (!tile) throw new NotFoundException('Tuile de foudre indisponible (niveaux 0 à 3, identifiants et option foudre Xweather requis)');
    // Image, gardée 2 minutes par les navigateurs.
    res.set({ 'Content-Type': tile.type, 'Cache-Control': 'public, max-age=120' }).send(tile.body);
  // Fin de lightningTile.
  }

  // Route GET /api/v1/atmosphere/radar.
  @Get('radar')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Images radar des précipitations disponibles', description: 'Source : Rain Viewer (composite des radars au sol, 2 dernières heures, toutes les 10 minutes). Identifiants et heures des images, âge de la dernière, codage des tuiles servies par /atmosphere/radar/{id}/{z}/{x}/{y}.' })
  // Cache public d'une minute.
  @Header('Cache-Control', 'public, max-age=60')
  // Méthode radar.
  radar() {
    // Délègue au service.
    return this.atmosphere.radar();
  // Fin de radar.
  }

  // Route GET /api/v1/atmosphere/radar/:id/:z/:x/:y.
  @Get('radar/:id/:z/:x/:y')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Tuile radar décodée', description: 'Tuile Web Mercator de 512 px (niveaux 0 à 7) d’une image de l’index : PNG RVB, rouge = pluie, vert = neige (code = dBZ + 11, 0 = aucun écho), bleu = couverture radar (255 couverte, 0 aucun radar, 128 inconnue). 404 si l’image n’est plus dans l’index ou si la source ne répond pas.' })
  // Méthode radarTile : image, niveau, colonne, ligne et réponse brute.
  async radarTile(@Param('id') id: string, @Param('z') z: string, @Param('x') x: string, @Param('y') y: string, @Res() res: Response) {
    // Tuile lue par le service (extension « .png » tolérée).
    const body = await this.atmosphere.radarTile(id, Number(z), Number(x), Number(String(y).replace(/\.png$/, '')));
    // Indisponible : 404.
    if (!body) throw new NotFoundException('Tuile radar indisponible (image hors de l’index, niveau au-delà de 7 ou source sans réponse)');
    // Image, gardée une heure par les navigateurs (une image radar ne change plus).
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' }).send(body);
  // Fin de radarTile.
  }

  // Route GET /api/v1/atmosphere/storms.
  @Get('storms')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Orages : cellules estimées et avertissements officiels', description: 'Cellules convectives estimées d’après le radar Rain Viewer (≥ 40 dBZ avec noyau ≥ 45 dBZ, suivies sur 20 minutes : persistance, déplacement) et avertissements officiels d’orages violents et de tornades du NWS (États-Unis). Format commun.' })
  // Cache public de 2 minutes.
  @Header('Cache-Control', 'public, max-age=120')
  // Méthode storms.
  storms() {
    // Délègue au service.
    return this.atmosphere.storms();
  // Fin de storms.
  }

  // Route GET /api/v1/atmosphere/aerosols.
  @Get('aerosols')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Aérosols : produits observés, zones de forte charge, prévision CAMS', description: 'Épaisseur optique VIIRS Deep Blue et indice d’aérosols absorbants OMPS (NASA GIBS, jour et veille), reconvertis en valeurs par leur table de couleurs ; zones de forte charge au format commun ; heures de la prévision CAMS des poussières (48 h).' })
  // Cache public de 10 minutes.
  @Header('Cache-Control', 'public, max-age=600')
  // Méthode aerosols.
  aerosols() {
    // Délègue au service.
    return this.atmosphere.aerosols();
  // Fin de aerosols.
  }

  // Route GET /api/v1/atmosphere/aerosols/observed/:product.
  @Get('aerosols/observed/:product')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Image d’un produit d’aérosols observé', description: 'product = aod (épaisseur optique) ou ai (indice absorbant). PNG RVB 2 048 × 1 024 équirectangulaire : rouge = jour, vert = veille ; code = 1 + valeur × 50, 0 = aucune mesure.' })
  // Méthode aerosolImage : le produit et la réponse brute.
  async aerosolImage(@Param('product') product: string, @Res() res: Response) {
    // Image lue par le service.
    const body = await this.atmosphere.aerosolImage(product);
    // Indisponible : 404.
    if (!body) throw new NotFoundException('Produit d’aérosols inconnu ou indisponible (aod, ai)');
    // Image, gardée 30 minutes.
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=1800' }).send(body);
  // Fin de aerosolImage.
  }

  // Route GET /api/v1/atmosphere/aerosols/forecast/legend (déclarée avant la route des heures).
  @Get('aerosols/forecast/legend')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Légende de la prévision CAMS des poussières', description: 'Image de la légende publiée par l’ECMWF.' })
  // Méthode camsLegend : la réponse brute.
  async camsLegend(@Res() res: Response) {
    // Légende lue par le service.
    const body = await this.atmosphere.camsLegend();
    // Indisponible : 404.
    if (!body) throw new NotFoundException('Légende CAMS indisponible');
    // Image, gardée un jour.
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }).send(body);
  // Fin de camsLegend.
  }

  // Route GET /api/v1/atmosphere/aerosols/forecast/:time.
  @Get('aerosols/forecast/:time')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Prévision CAMS des poussières à une heure de validité', description: 'time = une heure de la liste rendue par /atmosphere/aerosols (ISO, par exemple 2026-11-15T12:00:00Z). PNG équirectangulaire 1 024 × 512, transparent, tel que publié par l’ECMWF.' })
  // Méthode camsFrame : l'heure et la réponse brute.
  async camsFrame(@Param('time') time: string, @Res() res: Response) {
    // Image lue par le service.
    const body = await this.atmosphere.camsFrame(String(time));
    // Indisponible : 404.
    if (!body) throw new NotFoundException('Heure de prévision hors de la liste en cours, ou image CAMS indisponible');
    // Image, gardée 3 heures.
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=10800' }).send(body);
  // Fin de camsFrame.
  }

  // Route GET /api/v1/atmosphere/events.
  @Get('events')
  // Ce que fait la route.
  @ApiOperation({ summary: 'Événements atmosphériques au format commun', description: 'Filtres : types=wildfire,cyclone,hotspot,storm,aerosol (storm et aerosol lancent leur lecture) · bbox=ouest,sud,est,nord · limit (2 000 au plus). Les points chauds demandent une emprise.' })
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
