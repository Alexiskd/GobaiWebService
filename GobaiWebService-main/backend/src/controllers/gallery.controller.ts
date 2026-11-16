// Outils NestJS : Controller, Get, Headers (lire un en-tête de la requête), Param, Res (accès direct à la réponse).
import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
// SkipThrottle : dispense une route de la limite de débit.
import { SkipThrottle } from '@nestjs/throttler';
// Décorateurs Swagger pour la documentation.
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Matches : règle de validation, le texte doit correspondre à une expression régulière.
import { Matches } from 'class-validator';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Service de la galerie.
import { GalleryService } from '../services/gallery/gallery.service';

// Classe des paramètres d'adresse d'un média.
class MediaParamsDto {
  // id : 3 à 120 caractères parmi les minuscules, les chiffres et le tiret ; toute autre valeur donne une erreur 400.
  @Matches(/^[a-z0-9-]{3,120}$/) id: string;
// Fin de MediaParamsDto.
}

// Interface minimale de la réponse HTTP dont ces routes ont besoin (évite de dépendre du type complet d'Express) :
interface BinaryResponse {
  // fixer le code de réponse, en renvoyant l'objet pour enchaîner ;
  status(code: number): BinaryResponse;
  // poser un en-tête ;
  setHeader(name: string, value: string | number): unknown;
  // envoyer le corps.
  send(body: unknown): unknown;
// Fin de BinaryResponse.
}

/** Taille maximale d'une réponse partielle (vidéo) : le navigateur redemande la suite. */
// 2 Mo (2 × 1024 × 1024 octets) : taille maximale d'un morceau de vidéo par réponse.
const MAX_RANGE = 2 * 1024 * 1024;

// Rubrique « Galerie » de la documentation.
@ApiTags('Galerie')
// Routes sous /api/v1/galerie.
@Controller('galerie')
// Classe du contrôleur de la galerie.
export class GalleryController {
  // NestJS injecte le service de la galerie ; corps du constructeur vide.
  constructor(private readonly gallery: GalleryService) {}

  // Route GET /api/v1/galerie.
  @Get()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Collection personnelle de la galerie',
    // son texte.
    description: 'Photos et vidéos classées par dossier (Jupiter, Saturne, satellites sphériques), stockées dans PostgreSQL.',
  // Fin de la description.
  })
  // Réponse 200 documentée.
  @ApiOkResponse({ description: 'Dossiers et médias : id, titre, type, dimensions, adresses du média et de sa vignette.' })
  // Méthode list : renvoie la collection.
  list() {
    // Délègue au service.
    return this.gallery.list();
  // Fin de list.
  }

  // Route GET /api/v1/galerie/media/:id/vignette.
  @Get('media/:id/vignette')
  // Pas de limite de débit : une page de galerie demande beaucoup de vignettes d'un coup.
  @SkipThrottle()
  // Titre de la route.
  @ApiOperation({ summary: 'Vignette JPEG d’un média (640 px)' })
  // Réponse 404 documentée : média inconnu.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode thumb : reçoit les paramètres validés et la réponse, qu'elle remplit elle-même.
  async thumb(@Param() p: MediaParamsDto, @Res() res: BinaryResponse): Promise<void> {
    // Attend la vignette JPEG auprès du service.
    const body = await this.gallery.thumb(p.id);
    // Type du contenu : image JPEG.
    res.setHeader('Content-Type', 'image/jpeg');
    // Cache d'un an, immuable : une vignette ne change jamais pour un identifiant donné.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Envoie les octets.
    res.send(body);
  // Fin de thumb.
  }

  // Route GET /api/v1/galerie/media/:id.
  @Get('media/:id')
  // Pas de limite de débit : une vidéo est lue par de nombreuses requêtes successives.
  @SkipThrottle()
  // Titre et description de la route.
  @ApiOperation({ summary: 'Fichier d’un média', description: 'Image entière, ou vidéo par plages (en-tête Range).' })
  // Réponse 404 documentée.
  @ApiNotFoundResponse({ type: ApiErrorDto })
  // Méthode media : reçoit les paramètres, l'en-tête Range (absent si le navigateur veut tout le fichier) et la réponse.
  async media(@Param() p: MediaParamsDto, @Headers('range') range: string | undefined, @Res() res: BinaryResponse): Promise<void> {
    // Analyse l'en-tête Range, de la forme « bytes=début-fin » ; m[1] est le début, m[2] la fin, chacun pouvant être vide.
    const m = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
    // Annonce au navigateur que les requêtes par plages d'octets sont acceptées.
    res.setHeader('Accept-Ranges', 'bytes');
    // Cache d'un an, immuable.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Si l'en-tête est bien formé et donne au moins une borne :
    if (m && (m[1] || m[2])) {
      // demande au service un seul octet (de 0 à 0), uniquement pour connaître la taille totale du fichier ;
      const whole = await this.gallery.chunk(p.id, 0, 0);
      // taille totale du fichier, en octets ;
      const total = whole.total;
      // premier octet demandé : le début donné, ou bien, pour « bytes=-N », les N derniers octets (jamais avant 0) ;
      let start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
      // dernier octet demandé : la fin donnée si le début l'est aussi, sinon le dernier octet du fichier ;
      let end = m[1] && m[2] ? Number(m[2]) : total - 1;
      // si le début est au-delà du fichier :
      if (start >= total) {
        // réponse 416 (plage impossible), avec la taille réelle du fichier ;
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        // corps vide ;
        res.send('');
        // et on s'arrête.
        return;
      // Fin du cas 416.
      }
      // Borne la fin : au plus 2 Mo après le début, et jamais après le dernier octet du fichier.
      end = Math.min(end, start + MAX_RANGE - 1, total - 1);
      // Garantit que le début ne dépasse pas la fin.
      start = Math.min(start, end);
      // Lit ce morceau auprès du service.
      const part = await this.gallery.chunk(p.id, start, end);
      // Code 206 : contenu partiel.
      res.status(206);
      // Type du média (image ou vidéo).
      res.setHeader('Content-Type', part.mime);
      // Plage réellement envoyée et taille totale : le navigateur sait où il en est.
      res.setHeader('Content-Range', `bytes ${part.start}-${part.end}/${part.total}`);
      // Nombre d'octets de ce morceau.
      res.setHeader('Content-Length', part.body.length);
      // Envoie le morceau.
      res.send(part.body);
      // Requête traitée.
      return;
    // Fin du cas « plage d'octets ».
    }
    // Sans en-tête Range : lit le fichier entier.
    const all = await this.gallery.chunk(p.id);
    // Type du média.
    res.setHeader('Content-Type', all.mime);
    // Taille du fichier.
    res.setHeader('Content-Length', all.body.length);
    // Envoie le fichier entier.
    res.send(all.body);
  // Fin de media.
  }
// Fin du contrôleur.
}
