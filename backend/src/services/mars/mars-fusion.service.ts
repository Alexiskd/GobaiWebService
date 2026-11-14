// Ouvre l'import des outils NestJS :
import {
  // erreur 502 ;
  BadGatewayException,
  // erreur HTTP générale ;
  HttpException,
  // injection par jeton ;
  Inject,
  // service injectable ;
  Injectable,
  // journal.
  Logger,
// Fin de l'import.
} from '@nestjs/common';
// Buffer : le tampon d'octets de Node.
import { Buffer } from 'node:buffer';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Cache à durée de vie.
import { TtlCache } from './cache';
// Jeton d'injection de la configuration de Mars, et son type.
import { MARS_CONFIG, type MarsConfig } from './mars.config';
// Service des tuiles de Mars.
import { MarsTileService } from './mars-imagery-tile.service';
// Ouvre l'import du module des algorithmes de fusion :
import {
  // le calcul de la référence ;
  computeFusionReference,
  // la table des algorithmes ;
  FUSION_ALGORITHMS,
  // le type de leurs options ;
  type FusionOptions,
  // le type des trois plans de couleur.
  type FusionPlanes,
// Fin de l'import.
} from './fusion-algorithms';

// Forme d'une chaîne de traitement sharp, limitée à ce que ce service utilise.
interface SharpPipeline {
  // toColourspace : passage en sRGB.
  toColourspace(colorSpace: 'srgb'): SharpPipeline;
  // greyscale : passage en gris.
  greyscale(): SharpPipeline;
  // removeAlpha : retrait de la transparence.
  removeAlpha(): SharpPipeline;
  // extractChannel : extraction d'un canal.
  extractChannel(channel: number): SharpPipeline;
  // resize : changement de taille, avec
  resize(
    // la largeur,
    width: number,
    // la hauteur,
    height: number,
    // et les options (étirement, filtre bicubique facultatif).
    options: { fit: 'fill'; kernel?: 'cubic' },
  // Fin de resize.
  ): SharpPipeline;
  // raw : sortie en pixels bruts.
  raw(): SharpPipeline;
  // png : sortie en PNG.
  png(): SharpPipeline;
  // composite : pose d'images,
  composite(
    // chacune avec ses octets et sa position.
    images: Array<{ input: Buffer; left: number; top: number }>,
  // Fin de composite.
  ): SharpPipeline;
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
// Fin de SharpPipeline.
}

// Type SharpFactory : la fonction sharp, qui prend
type SharpFactory = (
  // en entrée
  input:
    // des octets,
    | Buffer
    // ou
    | {
        // une image à créer, avec
        create: {
          // sa largeur,
          width: number;
          // sa hauteur,
          height: number;
          // trois canaux,
          channels: 3;
          // et sa couleur de fond ;
          background: { r: number; g: number; b: number };
        // fin de l'image à créer ;
        };
      // fin de l'entrée ;
      },
  // et, en option,
  options?: {
    // les dimensions de pixels bruts ;
    raw: { width: number; height: number; channels: 3 | 4 };
  // fin de l'option ;
  },
// elle rend une chaîne de traitement.
) => SharpPipeline;

// Charge la bibliothèque d'images sharp.
const sharp = createRequire(__filename)('sharp') as SharpFactory;
// Niveau des tuiles de travail : 3.
const TILE_ZOOM = 3;
// Taille d'une tuile CTX et d'une tuile produite : 512 pixels.
const TILE_SIZE = 512;
// Taille d'une tuile Viking : 256 pixels.
const VIKING_TILE_SIZE = 256;
// Nombre de colonnes au niveau 3 : 16.
const TILE_COLUMNS = 2 ** (TILE_ZOOM + 1);
// Nombre de lignes au niveau 3 : 8.
const TILE_ROWS = 2 ** TILE_ZOOM;
// Largeur de la mosaïque : 8 192 pixels.
const WIDTH = TILE_COLUMNS * TILE_SIZE;
// Hauteur de la mosaïque : 4 096 pixels.
const HEIGHT = TILE_ROWS * TILE_SIZE;
// Largeur de la mosaïque Viking : 4 096 pixels.
const VIKING_WIDTH = TILE_COLUMNS * VIKING_TILE_SIZE;
// Hauteur de la mosaïque Viking : 2 048 pixels.
const VIKING_HEIGHT = TILE_ROWS * VIKING_TILE_SIZE;
// Nombre de tuiles téléchargées en même temps : 8.
const FETCH_CONCURRENCY = 8;
// Marge autour d'une tuile pendant le calcul : 32 pixels.
const PATCH_MARGIN = 32;

// Les dix algorithmes de fusion proposés :
export const MARS_FUSION_ALGORITHM_INFO = [
  // le premier,
  {
    // nom interne « simpleMean »,
    name: 'simpleMean',
    // identifiant court,
    slug: 'simple-mean',
    // nom affiché,
    label: 'Viking + CTX — moyenne simple',
    // description : moyenne simple.
    description: 'Moyenne pixel par pixel entre la luminance CTX et chaque bande Viking.',
  // Fin du premier.
  },
  // Le deuxième,
  {
    // nom interne « brovey »,
    name: 'brovey',
    // identifiant court,
    slug: 'brovey',
    // nom affiché,
    label: 'Viking + CTX — Brovey',
    // description : méthode de Brovey.
    description: 'Injection du contraste CTX par rapport à l’intensité Viking.',
  // Fin du deuxième.
  },
  // Le troisième,
  {
    // nom interne « ihs »,
    name: 'ihs',
    // identifiant court,
    slug: 'ihs',
    // nom affiché,
    label: 'Viking + CTX — IHS',
    // description : remplacement de l'intensité.
    description: 'Remplacement de l’intensité Viking par la luminance CTX recalée.',
  // Fin du troisième.
  },
  // Le quatrième,
  {
    // nom interne « esri »,
    name: 'esri',
    // identifiant court,
    slug: 'esri',
    // nom affiché,
    label: 'Viking + CTX — Esri',
    // description : méthode d'Esri.
    description: 'Moyenne pondérée Viking ajustée par la différence de luminance CTX.',
  // Fin du quatrième.
  },
  // Le cinquième,
  {
    // nom interne « pca »,
    name: 'pca',
    // identifiant court,
    slug: 'pca',
    // nom affiché,
    label: 'Viking + CTX — PCA',
    // description : composantes principales.
    description: 'Remplacement de la première composante principale Viking par CTX.',
  // Fin du cinquième.
  },
  // Le sixième,
  {
    // nom interne « gramSchmidt »,
    name: 'gramSchmidt',
    // identifiant court,
    slug: 'gram-schmidt',
    // nom affiché,
    label: 'Viking + CTX — Gram–Schmidt',
    // description : méthode de Gram–Schmidt.
    description: 'Injection adaptative du détail CTX avec un gain par bande Viking.',
  // Fin du sixième.
  },
  // Le septième,
  {
    // nom interne « hpf »,
    name: 'hpf',
    // identifiant court,
    slug: 'hpf',
    // nom affiché,
    label: 'Viking + CTX — passe-haut',
    // description : filtre passe-haut.
    description: 'Injection proportionnelle des détails haute fréquence CTX.',
  // Fin du septième.
  },
  // Le huitième,
  {
    // nom interne « wavelet »,
    name: 'wavelet',
    // identifiant court,
    slug: 'wavelet',
    // nom affiché,
    label: 'Viking + CTX — ondelettes',
    // description : ondelettes.
    description: 'Injection des détails CTX par ondelettes à trous B3-spline.',
  // Fin du huitième.
  },
  // Le neuvième,
  {
    // nom interne « laplacian »,
    name: 'laplacian',
    // identifiant court,
    slug: 'laplacian',
    // nom affiché,
    label: 'Viking + CTX — pyramide laplacienne',
    // description : pyramide laplacienne.
    description: 'Pyramide laplacienne CTX/Viking avec sélection des détails les plus nets.',
  // Fin du neuvième.
  },
  // Le dixième,
  {
    // nom interne « guided »,
    name: 'guided',
    // identifiant court,
    slug: 'guided',
    // nom affiché,
    label: 'Viking + CTX — filtre guidé',
    // description : filtre guidé.
    description: 'Couleurs Viking guidées par les structures locales de la mosaïque CTX.',
  // Fin du dixième.
  },
// Fin de la liste, figée.
] as const;

// Type MarsFusionAlgorithmName :
export type MarsFusionAlgorithmName =
  // le nom interne d'un des dix algorithmes.
  (typeof MARS_FUSION_ALGORITHM_INFO)[number]['name'];

// Fonction getMarsFusionLayerId.
export function getMarsFusionLayerId(slug: string): string {
  // L'identifiant de couche : « mars-viking-ctx- » suivi de l'identifiant court.
  return `mars-viking-ctx-${slug}`;
// Fin de getMarsFusionLayerId.
}

// Fonction getMarsFusionAlgorithmByLayerId ; son paramètre :
export function getMarsFusionAlgorithmByLayerId(
  // l'identifiant de couche.
  layerId: string,
// Elle renvoie l'algorithme, ou undefined.
): (typeof MARS_FUSION_ALGORITHM_INFO)[number] | undefined {
  // Cherche dans la liste
  return MARS_FUSION_ALGORITHM_INFO.find(
    // celui dont l'identifiant de couche est celui demandé.
    ({ slug }) => getMarsFusionLayerId(slug) === layerId,
  // Fin de la recherche.
  );
// Fin de getMarsFusionAlgorithmByLayerId.
}

// Fonction getMarsFusionAlgorithmBySlug ; son paramètre :
export function getMarsFusionAlgorithmBySlug(
  // l'identifiant court.
  slug: string,
// Elle renvoie l'algorithme, ou undefined.
): (typeof MARS_FUSION_ALGORITHM_INFO)[number] | undefined {
  // Cherche dans la liste
  return MARS_FUSION_ALGORITHM_INFO.find(
    // celui qui porte cet identifiant court.
    (algorithm) => algorithm.slug === slug,
  // Fin de la recherche.
  );
// Fin de getMarsFusionAlgorithmBySlug.
}

// Forme des deux mosaïques sources.
interface FusionSources {
  // vikingRgb : la mosaïque Viking en couleurs, 3 octets par pixel.
  vikingRgb: Buffer;
  // ctxGray : la mosaïque CTX en gris, un octet par pixel.
  ctxGray: Buffer;
  // ctxTileValid : pour chaque tuile CTX, 1 si elle a été obtenue.
  ctxTileValid: Uint8Array;
  // reference : la référence calculée sur les deux mosaïques.
  reference: ReturnType<typeof computeFusionReference>;
  // missingCtxTiles : nombre de tuiles CTX manquantes.
  missingCtxTiles: number;
// Fin de FusionSources.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de fusion Viking + CTX.
export class MarsFusionService {
  // Journal au nom de la classe.
  private readonly logger = new Logger(MarsFusionService.name);
  // Cache des tuiles produites.
  private readonly tileCache: TtlCache<Buffer>;
  // Promesse des mosaïques sources : aucune au départ.
  private sourcePromise: Promise<FusionSources> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MARS_CONFIG) config: MarsConfig,
    // le service des tuiles.
    private readonly tiles: MarsTileService,
  // Corps du constructeur :
  ) {
    // crée le cache : 128 tuiles, avec la durée de vie des capacités.
    this.tileCache = new TtlCache(128, config.capabilitiesCacheTtlMs);
  // Fin du constructeur.
  }

  // Méthode getTile ; ses paramètres :
  async getTile(
    // l'algorithme ;
    algorithm: MarsFusionAlgorithmName,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie une tuile PNG.
  ): Promise<Buffer> {
    // Si
    if (
      // l'algorithme est inconnu,
      !FUSION_ALGORITHMS[algorithm] ||
      // ou le niveau non entier,
      !Number.isInteger(zoom) ||
      // ou négatif,
      zoom < 0 ||
      // ou au-delà de 3,
      zoom > TILE_ZOOM ||
      // ou la colonne non entière,
      !Number.isInteger(x) ||
      // ou la ligne non entière,
      !Number.isInteger(y) ||
      // ou la colonne négative,
      x < 0 ||
      // ou hors de la grille,
      x >= 2 ** (zoom + 1) ||
      // ou la ligne négative,
      y < 0 ||
      // ou hors de la grille :
      y >= 2 ** zoom
    // alors
    ) {
      // erreur 400.
      throw new HttpException('Coordonnées de tuile Mars fusion invalides.', 400);
    // Fin du cas.
    }

    // Au niveau 3 :
    if (zoom === TILE_ZOOM) {
      // renvoie la tuile de base.
      return this.getBaseTile(algorithm, x, y);
    // Fin du cas.
    }

    // Sinon : nombre de tuiles de base par côté.
    const factor = 2 ** (TILE_ZOOM - zoom);
    // Tuiles de base à assembler.
    const children: Array<{ input: Buffer; left: number; top: number }> = [];
    // Pour chaque ligne,
    for (let dy = 0; dy < factor; dy += 1) {
      // et chaque colonne :
      for (let dx = 0; dx < factor; dx += 1) {
        // ajoute
        children.push({
          // la tuile de base,
          input: await this.getBaseTile(
            // pour cet algorithme,
            algorithm,
            // à cette colonne,
            x * factor + dx,
            // et cette ligne ;
            y * factor + dy,
          // fin de la demande ;
          ),
          // sa position horizontale ;
          left: dx * TILE_SIZE,
          // sa position verticale.
          top: dy * TILE_SIZE,
        // Fin de l'ajout.
        });
      // Fin des colonnes.
      }
    // Fin des lignes.
    }

    // Crée une image,
    return sharp({
      // avec
      create: {
        // sa largeur,
        width: factor * TILE_SIZE,
        // sa hauteur,
        height: factor * TILE_SIZE,
        // trois canaux,
        channels: 3,
        // et un fond noir ;
        background: { r: 0, g: 0, b: 0 },
      // fin des réglages ;
      },
    // fin de la création ;
    })
      // y pose les tuiles de base ;
      .composite(children)
      // la réduit à 512 pixels (filtre bicubique) ;
      .resize(TILE_SIZE, TILE_SIZE, { fit: 'fill', kernel: 'cubic' })
      // l'encode en PNG ;
      .png()
      // et renvoie les octets.
      .toBuffer();
  // Fin de getTile.
  }

  // Méthode privée getBaseTile ; ses paramètres :
  private getBaseTile(
    // l'algorithme ;
    algorithm: MarsFusionAlgorithmName,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie la tuile.
  ): Promise<Buffer> {
    // Depuis le cache,
    return this.tileCache
      // prend la tuile ou
      .getOrLoad(`${algorithm}/${TILE_ZOOM}/${x}/${y}`, () =>
        // la fabrique ;
        this.createBaseTile(algorithm, x, y),
      // fin de la demande ;
      )
      // rend ses octets.
      .then(({ value }) => value);
  // Fin de getBaseTile.
  }

  // Méthode privée createBaseTile ; ses paramètres :
  private async createBaseTile(
    // l'algorithme ;
    algorithm: MarsFusionAlgorithmName,
    // la colonne ;
    tileX: number,
    // la ligne.
    tileY: number,
  // Elle renvoie la tuile PNG.
  ): Promise<Buffer> {
    // Mosaïques sources.
    const sources = await this.getSources();
    // Largeur de la zone de calcul : la tuile plus ses deux marges.
    const width = TILE_SIZE + PATCH_MARGIN * 2;
    // Même hauteur.
    const height = width;
    // Plan de la luminance CTX.
    const pan = new Float32Array(width * height);
    // Les trois plans de couleur Viking :
    const ms: FusionPlanes = [
      // rouge,
      new Float32Array(width * height),
      // vert,
      new Float32Array(width * height),
      // bleu.
      new Float32Array(width * height),
    // Fin des plans.
    ];
    // Colonne de départ dans la mosaïque.
    const startX = tileX * TILE_SIZE - PATCH_MARGIN;
    // Ligne de départ dans la mosaïque.
    const startY = tileY * TILE_SIZE - PATCH_MARGIN;

    // Pour chaque ligne de la zone :
    for (let py = 0; py < height; py += 1) {
      // ligne dans la mosaïque, sans sortir par le haut ni par le bas ;
      const sourceY = Math.max(0, Math.min(HEIGHT - 1, startY + py));
      // pour chaque colonne :
      for (let px = 0; px < width; px += 1) {
        // colonne dans la mosaïque, qui fait le tour du globe ;
        const sourceX = (startX + px + WIDTH) % WIDTH;
        // position du pixel dans la mosaïque ;
        const sourcePixel = sourceY * WIDTH + sourceX;
        // position de ses trois couleurs ;
        const sourceRgb = sourcePixel * 3;
        // position du pixel dans la zone ;
        const pixel = py * width + px;
        // rouge, de 0 à 1 ;
        const red = sources.vikingRgb[sourceRgb] / 255;
        // vert ;
        const green = sources.vikingRgb[sourceRgb + 1] / 255;
        // bleu ;
        const blue = sources.vikingRgb[sourceRgb + 2] / 255;
        // range le rouge,
        ms[0][pixel] = red;
        // le vert,
        ms[1][pixel] = green;
        // et le bleu.
        ms[2][pixel] = blue;

        // Tuile CTX du pixel :
        const ctxTile =
          // sa ligne,
          Math.floor(sourceY / TILE_SIZE) * TILE_COLUMNS +
          // et sa colonne.
          Math.floor(sourceX / TILE_SIZE);
        // Valeur CTX du pixel.
        const ctxValue = sources.ctxGray[sourcePixel];
        // Y a-t-il une image CTX ici ? (tuile obtenue et pixel non noir)
        const hasCtx = sources.ctxTileValid[ctxTile] === 1 && ctxValue !== 0;
        // Luminance : celle de CTX, sinon la moyenne des couleurs Viking.
        pan[pixel] = hasCtx ? ctxValue / 255 : (red + green + blue) / 3;
      // Fin des colonnes.
      }
    // Fin des lignes.
    }

    // Options de l'algorithme.
    const options = this.algorithmOptions(algorithm, sources.reference);
    // Lance l'algorithme, avec
    const fused = FUSION_ALGORITHMS[algorithm](
      // la luminance,
      pan,
      // les couleurs,
      ms,
      // la largeur,
      width,
      // la hauteur,
      height,
      // et les options.
      options,
    // Fin de l'appel.
    );
    // Tampon de sortie : 3 octets par pixel.
    const output = Buffer.alloc(TILE_SIZE * TILE_SIZE * 3);
    // Pour chaque ligne de la tuile :
    for (let y = 0; y < TILE_SIZE; y += 1) {
      // ligne dans la mosaïque ;
      const sourceY = tileY * TILE_SIZE + y;
      // position du début de la ligne dans la mosaïque Viking ;
      const sourceOffset = (sourceY * WIDTH + tileX * TILE_SIZE) * 3;
      // pour chaque colonne :
      for (let x = 0; x < TILE_SIZE; x += 1) {
        // colonne dans la mosaïque ;
        const sourceX = tileX * TILE_SIZE + x;
        // position du pixel dans la mosaïque ;
        const sourcePixel = sourceY * WIDTH + sourceX;
        // position du pixel dans la zone de calcul,
        const patchPixel =
          // décalée des marges ;
          (y + PATCH_MARGIN) * width + x + PATCH_MARGIN;
        // position de sortie.
        const target = (y * TILE_SIZE + x) * 3;
        // Si la tuile CTX du pixel,
        if (sources.ctxTileValid[
          // celle de sa ligne
          Math.floor(sourceY / TILE_SIZE) * TILE_COLUMNS +
            // et de sa colonne,
            Math.floor(sourceX / TILE_SIZE)
        // manque, ou si le pixel CTX est noir :
        ] !== 1 || sources.ctxGray[sourcePixel] === 0) {
          // garde le rouge de Viking,
          output[target] = sources.vikingRgb[sourceOffset + x * 3];
          // le vert,
          output[target + 1] = sources.vikingRgb[sourceOffset + x * 3 + 1];
          // et le bleu ;
          output[target + 2] = sources.vikingRgb[sourceOffset + x * 3 + 2];
          // pixel suivant.
          continue;
        // Fin du cas.
        }
        // Pour chacune des trois couleurs :
        for (let channel = 0; channel < 3; channel += 1) {
          // valeur fusionnée ;
          const value = fused[channel][patchPixel];
          // l'écrit,
          output[target + channel] = Math.round(
            // bornée de 0 à 1 puis ramenée de 0 à 255.
            Math.max(0, Math.min(1, value)) * 255,
          // Fin de l'écriture.
          );
        // Fin des couleurs.
        }
      // Fin des colonnes.
      }
    // Fin des lignes.
    }

    // Fait une image du tampon,
    return sharp(output, {
      // en pixels bruts de 512 × 512 sur 3 canaux ;
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 },
    // fin des réglages ;
    })
      // l'encode en PNG ;
      .png()
      // et renvoie les octets.
      .toBuffer();
  // Fin de createBaseTile.
  }

  // Méthode privée algorithmOptions ; ses paramètres :
  private algorithmOptions(
    // l'algorithme ;
    algorithm: MarsFusionAlgorithmName,
    // la référence.
    reference: FusionSources['reference'],
  // Elle renvoie les options.
  ): FusionOptions {
    // Options : la référence.
    const options: FusionOptions = { reference };
    // Passe-haut : rayon 1.
    if (algorithm === 'hpf') options.radius = 1;
    // Ondelettes : 1 niveau.
    if (algorithm === 'wavelet') options.levels = 1;
    // Pyramide laplacienne : 2 niveaux.
    if (algorithm === 'laplacian') options.levels = 2;
    // Filtre guidé : rayon 2.
    if (algorithm === 'guided') options.radius = 2;
    // Renvoie les options.
    return options;
  // Fin de algorithmOptions.
  }

  // Méthode privée getSources.
  private getSources(): Promise<FusionSources> {
    // Au premier appel :
    if (!this.sourcePromise) {
      // lance la création des mosaïques ; en cas d'échec :
      this.sourcePromise = this.createSources().catch((error: unknown) => {
        // oublie la promesse, pour réessayer la fois suivante ;
        this.sourcePromise = null;
        // relance l'erreur.
        throw error;
      // Fin du cas.
      });
    // Fin du cas.
    }
    // Renvoie la promesse.
    return this.sourcePromise;
  // Fin de getSources.
  }

  // Méthode privée createSources.
  private async createSources(): Promise<FusionSources> {
    // Mosaïque Viking, 3 octets par pixel.
    const vikingMosaic = Buffer.alloc(VIKING_WIDTH * VIKING_HEIGHT * 3);
    // Mosaïque CTX, un octet par pixel.
    const ctxMosaic = Buffer.alloc(WIDTH * HEIGHT);
    // Tuiles CTX obtenues.
    const ctxTileValid = new Uint8Array(TILE_COLUMNS * TILE_ROWS);
    // Rang de la prochaine tuile.
    let nextTile = 0;
    // Nombre de tuiles CTX manquantes.
    let missingCtxTiles = 0;
    // Nombre de tuiles : 128.
    const tileCount = TILE_COLUMNS * TILE_ROWS;

    // Fonction worker : un ouvrier.
    const worker = async (): Promise<void> => {
      // En boucle :
      while (true) {
        // prend le rang suivant ;
        const index = nextTile++;
        // plus de tuile : fin ;
        if (index >= tileCount) return;
        // sa colonne ;
        const x = index % TILE_COLUMNS;
        // sa ligne ;
        const y = Math.floor(index / TILE_COLUMNS);
        // demande en même temps
        const [viking, ctx] = await Promise.all([
          // la tuile Viking,
          this.getVikingTile(x, y),
          // et la tuile CTX ; si elle échoue :
          this.getCtxTile(x, y).catch((error: unknown) => {
            // l'erreur est relancée si ce n'est pas une tuile manquante ;
            if (!isMissingTile(error)) throw error;
            // sinon null.
            return null;
          // Fin du cas.
          }),
        // Fin des demandes.
        ]);
        // Copie la tuile Viking dans sa mosaïque.
        copyVikingTile(vikingMosaic, viking, x, y);
        // S'il y a une tuile CTX :
        if (ctx) {
          // la copie dans sa mosaïque ;
          copyCtxTile(ctxMosaic, ctx, x, y);
          // la note comme obtenue.
          ctxTileValid[index] = 1;
        // Sinon :
        } else {
          // une tuile manquante de plus.
          missingCtxTiles += 1;
        // Fin du choix.
        }
      // Fin de la boucle.
      }
    // Fin de worker.
    };

    // Attend
    await Promise.all(
      // les 8 ouvriers.
      Array.from({ length: FETCH_CONCURRENCY }, () => worker()),
    // Fin de l'attente.
    );
    // Si toutes les tuiles CTX manquent :
    if (missingCtxTiles === tileCount) {
      // erreur 502,
      throw new BadGatewayException(
        // avec ce message.
        'La mosaïque CTX du Murray Lab est indisponible ; fusion annulée.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // S'il en manque quelques-unes :
    if (missingCtxTiles > 0) {
      // un avertissement dans le journal,
      this.logger.warn(
        // avec leur nombre.
        `${missingCtxTiles}/${tileCount} tuiles CTX indisponibles ; ces zones gardent Viking.`,
      // Fin de l'avertissement.
      );
    // Fin du cas.
    }

    // Mosaïque Viking, faite du tampon,
    const vikingRgb = await sharp(vikingMosaic, {
      // en pixels bruts sur 3 canaux ;
      raw: { width: VIKING_WIDTH, height: VIKING_HEIGHT, channels: 3 },
    // fin des réglages ;
    })
      // agrandie à la taille de la mosaïque CTX (filtre bicubique) ;
      .resize(WIDTH, HEIGHT, { fit: 'fill', kernel: 'cubic' })
      // en pixels bruts ;
      .raw()
      // ses octets.
      .toBuffer();
    // Référence de fusion, calculée avec
    const reference = computeFusionReference(
      // la mosaïque CTX,
      ctxMosaic,
      // la mosaïque Viking,
      vikingRgb,
      // la largeur,
      WIDTH,
      // la hauteur,
      HEIGHT,
      // un pas d’échantillonnage de 4 pixels,
      4,
      // et le test « ce pixel a-t-il une image CTX ? » :
      (x, y) => {
        // tuile du pixel :
        const index =
          // sa ligne,
          Math.floor(y / TILE_SIZE) * TILE_COLUMNS +
          // et sa colonne ;
          Math.floor(x / TILE_SIZE);
        // vrai si la tuile est obtenue et le pixel non noir.
        return ctxTileValid[index] === 1 && ctxMosaic[y * WIDTH + x] !== 0;
      // Fin du test.
      },
    // Fin du calcul.
    );

    // Renvoie les deux mosaïques, les tuiles obtenues, la référence et le nombre de tuiles manquantes.
    return { vikingRgb, ctxGray: ctxMosaic, ctxTileValid, reference, missingCtxTiles };
  // Fin de createSources.
  }

  // Méthode privée getVikingTile.
  private async getVikingTile(x: number, y: number): Promise<Buffer> {
    // Demande la tuile
    const tile = await this.tiles.getTile(
      // au fournisseur NASA Trek,
      'mars-trek',
      // couche Viking,
      'viking-mdim21',
      // au niveau 3,
      TILE_ZOOM,
      // à cette colonne,
      x,
      // et cette ligne.
      y,
    // Fin de la demande.
    );
    // Prend ses octets,
    return sharp(tile.buffer)
      // passe en sRGB,
      .toColourspace('srgb')
      // retire la transparence,
      .removeAlpha()
      // ramène à 256 pixels,
      .resize(VIKING_TILE_SIZE, VIKING_TILE_SIZE, { fit: 'fill' })
      // sort en pixels bruts,
      .raw()
      // et renvoie les octets.
      .toBuffer();
  // Fin de getVikingTile.
  }

  // Méthode privée getCtxTile.
  private async getCtxTile(x: number, y: number): Promise<Buffer> {
    // Demande la tuile
    const tile = await this.tiles.getTile(
      // au fournisseur Murray Lab,
      'murray-lab',
      // couche CTX,
      'ctx-mosaic-v01',
      // au niveau 3,
      TILE_ZOOM,
      // à cette colonne,
      x,
      // et cette ligne.
      y,
    // Fin de la demande.
    );
    // Prend ses octets,
    return sharp(tile.buffer)
      // passe en sRGB,
      .toColourspace('srgb')
      // passe en gris,
      .greyscale()
      // retire la transparence,
      .removeAlpha()
      // ramène à 512 pixels,
      .resize(TILE_SIZE, TILE_SIZE, { fit: 'fill' })
      // sort en pixels bruts,
      .raw()
      // et renvoie les octets.
      .toBuffer();
  // Fin de getCtxTile.
  }
// Fin du service.
}

// Fonction copyVikingTile ; ses paramètres :
function copyVikingTile(
  // la mosaïque ;
  mosaic: Buffer,
  // la tuile ;
  tile: Buffer,
  // sa colonne ;
  tileX: number,
  // sa ligne.
  tileY: number,
// Elle ne renvoie rien.
): void {
  // Nombre d'octets d'une ligne de tuile.
  const rowBytes = VIKING_TILE_SIZE * 3;
  // Pour chaque ligne de la tuile :
  for (let row = 0; row < VIKING_TILE_SIZE; row += 1) {
    // position de la ligne dans la tuile ;
    const source = row * rowBytes;
    // position de la ligne dans la mosaïque :
    const target =
      // la ligne,
      ((tileY * VIKING_TILE_SIZE + row) * VIKING_WIDTH +
        // la colonne,
        tileX * VIKING_TILE_SIZE) *
      // fois 3 octets.
      3;
    // Copie la ligne.
    tile.copy(mosaic, target, source, source + rowBytes);
  // Fin de la boucle.
  }
// Fin de copyVikingTile.
}

// Fonction copyCtxTile ; ses paramètres :
function copyCtxTile(
  // la mosaïque ;
  mosaic: Buffer,
  // la tuile ;
  tile: Buffer,
  // sa colonne ;
  tileX: number,
  // sa ligne.
  tileY: number,
// Elle ne renvoie rien.
): void {
  // Pour chaque ligne de la tuile :
  for (let row = 0; row < TILE_SIZE; row += 1) {
    // position de la ligne dans la tuile ;
    const source = row * TILE_SIZE;
    // position de la ligne dans la mosaïque ;
    const target = (tileY * TILE_SIZE + row) * WIDTH + tileX * TILE_SIZE;
    // copie la ligne.
    tile.copy(mosaic, target, source, source + TILE_SIZE);
  // Fin de la boucle.
  }
// Fin de copyCtxTile.
}

// Fonction isMissingTile.
function isMissingTile(error: unknown): boolean {
  // Vrai si
  return (
    // c'est une erreur HTTP,
    error instanceof HttpException &&
    // de code 404 ou 502.
    (error.getStatus() === 404 || error.getStatus() === 502)
  // Fin du test.
  );
// Fin de isMissingTile.
}
