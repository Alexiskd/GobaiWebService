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

// Forme d'une chaîne de traitement sharp, limitée à ce que ce service utilise.
interface SharpPipeline {
  // toColourspace : passage en sRGB.
  toColourspace(colorSpace: 'srgb'): SharpPipeline;
  // greyscale : passage en gris.
  greyscale(): SharpPipeline;
  // removeAlpha : retrait de la transparence.
  removeAlpha(): SharpPipeline;
  // extract : découpe d'une zone, donnée par
  extract(options: {
    // son bord gauche,
    left: number;
    // son bord haut,
    top: number;
    // sa largeur,
    width: number;
    // et sa hauteur.
    height: number;
  // Fin de extract.
  }): SharpPipeline;
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
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
// Fin de SharpPipeline.
}

// Type SharpFactory : la fonction sharp, qui prend
type SharpFactory = (
  // des octets,
  input: Buffer,
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
// Taille d'une tuile Viking : 256 pixels.
const VIKING_TILE_SIZE = 256;
// Taille d'une tuile CTX : 512 pixels.
const CTX_TILE_SIZE = 512;
// Nombre de colonnes au niveau 3 : 16.
const TILE_COLUMNS = 2 ** (TILE_ZOOM + 1);
// Nombre de lignes au niveau 3 : 8.
const TILE_ROWS = 2 ** TILE_ZOOM;
// Largeur de la mosaïque Viking : 4 096 pixels.
const VIKING_WIDTH = TILE_COLUMNS * VIKING_TILE_SIZE;
// Hauteur de la mosaïque Viking : 2 048 pixels.
const VIKING_HEIGHT = TILE_ROWS * VIKING_TILE_SIZE;
// Largeur de l'image produite : 8 192 pixels.
const OUTPUT_WIDTH = TILE_COLUMNS * CTX_TILE_SIZE;
// Hauteur de l'image produite : 4 096 pixels.
const OUTPUT_HEIGHT = TILE_ROWS * CTX_TILE_SIZE;
// Niveau maximal des tuiles servies : 3.
const BLEND_MAX_ZOOM = TILE_ZOOM;
// Nombre de tuiles téléchargées en même temps : 8.
const FETCH_CONCURRENCY = 8;
// Clé du cache ; elle change avec la version du traitement.
const CACHE_KEY = 'viking-ctx-lab-detail-v2';
// Taille d'une tuile servie : 512 pixels.
const BLEND_TILE_SIZE = CTX_TILE_SIZE;
// Taille des blocs de calcul : 1 024 pixels.
const PROCESS_TILE_SIZE = 1_024;
// Point blanc D65, pour les conversions vers Lab.
const WHITE_POINT = [0.95047, 1, 1.08883] as const;
// Constante de la formule Lab : 6/29.
const LAB_DELTA = 6 / 29;
// Réglages par défaut de la fusion :
const DEFAULT_FUSION_OPTIONS: MarsFusionOptions = {
  // rayon du flou : 2 pixels ;
  radius: 2,
  // force des détails CTX : 1 ;
  detail: 1,
  // part de la luminance CTX lissée : 0,2 ;
  mix: 0.2,
  // force du rapprochement des couleurs vers la palette : 0,5 ;
  grade: 0.5,
  // force du rapprochement de la luminance vers la palette : 0,1 ;
  gradeL: 0.1,
  // douceur du choix de la couleur de palette : 12 ;
  softness: 12,
  // saturation : × 1,3 ;
  vibrance: 1.3,
  // contraste : × 1,08 ;
  contrast: 1.08,
  // luminance autour de laquelle joue le contraste : 50.
  pivot: 50,
// Fin des réglages.
};

// Palette de sept couleurs de Mars :
export const MARS_BLEND_PALETTE = [
  // noir d'espace ;
  { name: "Noir d'espace", hex: '#0B080C', rgb: [11, 8, 12] },
  // violet sombre ;
  { name: 'Violet sombre', hex: '#2D234A', rgb: [45, 35, 74] },
  // violet indigo ;
  { name: 'Violet indigo', hex: '#423769', rgb: [66, 55, 105] },
  // rouge terre ;
  { name: 'Rouge terre', hex: '#814A51', rgb: [129, 74, 81] },
  // orange cuivré ;
  { name: 'Orange cuivré', hex: '#B86B66', rgb: [184, 107, 102] },
  // pêche clair ;
  { name: 'Pêche clair', hex: '#D68C79', rgb: [214, 140, 121] },
  // blanc cassé.
  { name: 'Blanc cassé', hex: '#E8DFDD', rgb: [232, 223, 221] },
// Fin de la palette, figée.
] as const;

// Forme du résultat de la fusion.
export interface MarsBlendResult {
  // buffer : l'image PNG.
  buffer: Buffer;
  // missingCtxTiles : nombre de tuiles CTX manquantes.
  missingCtxTiles: number;
  // paletteCounts : nombre de pixels proches de chaque couleur de la palette.
  paletteCounts: number[];
// Fin de MarsBlendResult.
}

// Identifiant de la couche.
export const MARS_BLEND_LAYER_ID = 'mars-viking-ctx-blend';

// Forme des réglages de la fusion.
export interface MarsFusionOptions {
  // radius : rayon du flou.
  radius: number;
  // detail : force des détails CTX.
  detail: number;
  // mix : part de la luminance CTX lissée.
  mix: number;
  // grade : rapprochement des couleurs vers la palette.
  grade: number;
  // gradeL : rapprochement de la luminance vers la palette.
  gradeL: number;
  // softness : douceur du choix de la couleur de palette.
  softness: number;
  // vibrance : saturation.
  vibrance: number;
  // contrast : contraste.
  contrast: number;
  // pivot : luminance pivot du contraste.
  pivot: number;
// Fin de MarsFusionOptions.
}

// Forme des statistiques des deux mosaïques.
export interface MarsFusionStats {
  // vikMean : luminance moyenne de Viking.
  vikMean: number;
  // vikStd : son écart type.
  vikStd: number;
  // ctxMean : luminance moyenne de CTX.
  ctxMean: number;
  // ctxStd : son écart type.
  ctxStd: number;
  // validCount : nombre de pixels comptés.
  validCount: number;
// Fin de MarsFusionStats.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de fusion Viking + CTX en couleurs Lab.
export class MarsBlendService {
  // Journal au nom de la classe.
  private readonly logger = new Logger(MarsBlendService.name);
  // Cache de l'image complète.
  private readonly cache: TtlCache<MarsBlendResult>;
  // Cache des tuiles.
  private readonly tileCache: TtlCache<Buffer>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MARS_CONFIG) config: MarsConfig,
    // le service des tuiles.
    private readonly tiles: MarsTileService,
  // Corps du constructeur :
  ) {
    // cache d'une seule image, avec la durée de vie des capacités ;
    this.cache = new TtlCache(1, config.capabilitiesCacheTtlMs);
    // cache des tuiles :
    this.tileCache = new TtlCache(
      // 128 tuiles,
      128,
      // même durée de vie.
      config.capabilitiesCacheTtlMs,
    // Fin de la création.
    );
  // Fin du constructeur.
  }

  // Méthode getBlend : l'image complète.
  getBlend(): Promise<MarsBlendResult> {
    // Depuis le cache,
    return this.cache
      // prend l'image ou la fabrique ;
      .getOrLoad(CACHE_KEY, () => this.createBlend())
      // rend sa valeur.
      .then(({ value }) => value);
  // Fin de getBlend.
  }

  // Méthode getBlendTile : une tuile de l'image.
  getBlendTile(zoom: number, x: number, y: number): Promise<Buffer> {
    // Nombre de colonnes du niveau.
    const columns = 2 ** (zoom + 1);
    // Nombre de lignes du niveau.
    const rows = 2 ** zoom;
    // Si
    if (
      // le niveau n'est pas entier,
      !Number.isInteger(zoom) ||
      // ou négatif,
      zoom < 0 ||
      // ou au-delà de 3,
      zoom > BLEND_MAX_ZOOM ||
      // ou la colonne non entière,
      !Number.isInteger(x) ||
      // ou la ligne non entière,
      !Number.isInteger(y) ||
      // ou la colonne négative,
      x < 0 ||
      // ou hors de la grille,
      x >= columns ||
      // ou la ligne négative,
      y < 0 ||
      // ou hors de la grille :
      y >= rows
    // alors
    ) {
      // erreur 400.
      throw new HttpException('Coordonnées de tuile Mars blend invalides.', 400);
    // Fin du cas.
    }

    // Clé de la tuile.
    const key = `${CACHE_KEY}/${zoom}/${x}/${y}`;
    // Depuis le cache des tuiles,
    return this.tileCache
      // prend la tuile ou la fabrique ainsi :
      .getOrLoad(key, async () => {
        // image complète ;
        const { buffer } = await this.getBlend();
        // bord gauche de la tuile dans l'image ;
        const left = Math.floor((x * OUTPUT_WIDTH) / columns);
        // bord droit ;
        const right = Math.floor(((x + 1) * OUTPUT_WIDTH) / columns);
        // bord haut ;
        const top = Math.floor((y * OUTPUT_HEIGHT) / rows);
        // bord bas ;
        const bottom = Math.floor(((y + 1) * OUTPUT_HEIGHT) / rows);
        // reprend l'image,
        return sharp(buffer)
          // découpe la zone :
          .extract({
            // bord gauche,
            left,
            // bord haut,
            top,
            // largeur,
            width: right - left,
            // hauteur ;
            height: bottom - top,
          // fin de la découpe ;
          })
          // la ramène à 512 pixels ;
          .resize(BLEND_TILE_SIZE, BLEND_TILE_SIZE, { fit: 'fill' })
          // l'encode en PNG ;
          .png()
          // et rend les octets.
          .toBuffer();
      // Fin de la fabrication.
      })
      // Rend la valeur.
      .then(({ value }) => value);
  // Fin de getBlendTile.
  }

  // Méthode privée createBlend : fabrique l'image complète.
  private async createBlend(): Promise<MarsBlendResult> {
    // Mosaïque Viking, 3 octets par pixel.
    const vikingMosaic = Buffer.alloc(VIKING_WIDTH * VIKING_HEIGHT * 3);
    // Mosaïque CTX, un octet par pixel.
    const ctxMosaic = Buffer.alloc(OUTPUT_WIDTH * OUTPUT_HEIGHT);
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
        // plus de tuile : fin.
        if (index >= tileCount) return;

        // Sa colonne.
        const x = index % TILE_COLUMNS;
        // Sa ligne.
        const y = Math.floor(index / TILE_COLUMNS);
        // Tuile Viking.
        const viking = await this.getVikingTile(x, y);
        // Tuile CTX, ou null.
        let ctx: Buffer | null;
        // Essaie
        try {
          // de la télécharger.
          ctx = await this.getCtxTile(x, y);
        // En cas d'échec :
        } catch (error) {
          // l'erreur est relancée si ce n'est pas une tuile manquante ;
          if (!isMissingTile(error)) throw error;
          // sinon null.
          ctx = null;
        // Fin du cas.
        }

        // Copie la tuile Viking dans sa mosaïque.
        copyVikingTile(vikingMosaic, viking, x, y);
        // S'il y a une tuile CTX :
        if (ctx) {
          // la copie dans sa mosaïque.
          copyCtxTile(ctxMosaic, ctx, x, y);
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
        `${missingCtxTiles}/${tileCount} tuiles CTX indisponibles ; Viking couvre ces zones.`,
      // Fin de l'avertissement.
      );
    // Fin du cas.
    }

    // Mosaïque Viking, faite du tampon,
    const vikingHighResolution = await sharp(vikingMosaic, {
      // en pixels bruts sur 3 canaux ;
      raw: { width: VIKING_WIDTH, height: VIKING_HEIGHT, channels: 3 },
    // fin des réglages ;
    })
      // agrandie à la taille de l'image produite (filtre bicubique) ;
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'fill', kernel: 'cubic' })
      // en pixels bruts ;
      .raw()
      // ses octets.
      .toBuffer();
    // Statistiques de luminance des deux mosaïques.
    const stats = computeFusionStats(vikingMosaic, ctxMosaic);
    // Aucun pixel CTX utilisable :
    if (stats.validCount === 0) {
      // erreur 502,
      throw new BadGatewayException(
        // avec ce message.
        'La mosaïque CTX ne contient aucune donnée exploitable ; fusion annulée.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Fusion des deux mosaïques, avec
    const { pixels, counts } = processMarsFusion(
      // Viking agrandie,
      vikingHighResolution,
      // CTX,
      ctxMosaic,
      // la largeur,
      OUTPUT_WIDTH,
      // la hauteur,
      OUTPUT_HEIGHT,
      // les statistiques,
      stats,
      // et les réglages par défaut.
      DEFAULT_FUSION_OPTIONS,
    // Fin de l'appel.
    );
    // Image PNG, faite des pixels,
    const buffer = await sharp(pixels, {
      // en pixels bruts sur 3 canaux ;
      raw: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, channels: 3 },
    // fin des réglages ;
    })
      // encodée en PNG ;
      .png()
      // ses octets.
      .toBuffer();

    // Renvoie l'image, le nombre de tuiles manquantes et le compte par couleur de palette.
    return { buffer, missingCtxTiles, paletteCounts: counts };
  // Fin de createBlend.
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
      .resize(CTX_TILE_SIZE, CTX_TILE_SIZE, { fit: 'fill' })
      // sort en pixels bruts,
      .raw()
      // et renvoie les octets.
      .toBuffer();
  // Fin de getCtxTile.
  }
// Fin du service.
}

// Fonction processMarsFusion ; ses paramètres :
export function processMarsFusion(
  // Viking en couleurs, 3 octets par pixel ;
  vikingRgb: Uint8Array,
  // CTX en gris, un octet par pixel ;
  ctxGray: Uint8Array,
  // la largeur ;
  width: number,
  // la hauteur ;
  height: number,
  // les statistiques ;
  stats: MarsFusionStats,
  // les réglages, ceux par défaut si absents.
  options: MarsFusionOptions = DEFAULT_FUSION_OPTIONS,
// Elle renvoie les pixels fusionnés et le compte par couleur de palette.
): { pixels: Buffer; counts: number[] } {
  // Si
  if (
    // la largeur n'est pas entière,
    !Number.isInteger(width) ||
    // ou inférieure à 1,
    width < 1 ||
    // ou la hauteur non entière,
    !Number.isInteger(height) ||
    // ou inférieure à 1,
    height < 1 ||
    // ou si Viking n'a pas la bonne taille,
    vikingRgb.length !== width * height * 3 ||
    // ou CTX non plus :
    ctxGray.length !== width * height
  // alors
  ) {
    // erreur.
    throw new Error('Dimensions ou données invalides pour la fusion Mars.');
  // Fin du cas.
  }
  // Vérifie les réglages.
  validateOptions(options);

  // Pixels de sortie.
  const pixels = Buffer.alloc(width * height * 3);
  // Compte par couleur de palette, à zéro.
  const counts = Array<number>(MARS_BLEND_PALETTE.length).fill(0);
  // Marge autour d'un bloc : deux fois le rayon, plus 2.
  const margin = 2 * options.radius + 2;

  // Pour chaque bloc, ligne par ligne,
  for (let y = 0; y < height; y += PROCESS_TILE_SIZE) {
    // et colonne par colonne :
    for (let x = 0; x < width; x += PROCESS_TILE_SIZE) {
      // largeur utile du bloc ;
      const coreWidth = Math.min(PROCESS_TILE_SIZE, width - x);
      // hauteur utile ;
      const coreHeight = Math.min(PROCESS_TILE_SIZE, height - y);
      // bord gauche, marge comprise ;
      const x0 = Math.max(0, x - margin);
      // bord haut ;
      const y0 = Math.max(0, y - margin);
      // bord droit ;
      const x1 = Math.min(width, x + coreWidth + margin);
      // bord bas ;
      const y1 = Math.min(height, y + coreHeight + margin);
      // largeur de la zone, marges comprises ;
      const patchWidth = x1 - x0;
      // sa hauteur ;
      const patchHeight = y1 - y0;
      // couleurs Viking de la zone ;
      const patchRgb = Buffer.alloc(patchWidth * patchHeight * 3);
      // gris CTX de la zone.
      const patchCtx = Buffer.alloc(patchWidth * patchHeight);

      // Pour chaque ligne de la zone :
      for (let row = 0; row < patchHeight; row += 1) {
        // position de son début dans l'image ;
        const sourcePixel = (y0 + row) * width + x0;
        // position de son début dans la zone ;
        const targetPixel = row * patchWidth;
        // copie les couleurs Viking :
        patchRgb.set(
          // la ligne,
          vikingRgb.subarray(
            // du premier octet
            sourcePixel * 3,
            // au dernier ;
            (sourcePixel + patchWidth) * 3,
          // fin de la ligne ;
          ),
          // à sa place dans la zone ;
          targetPixel * 3,
        // fin de la copie.
        );
        // copie le gris CTX :
        patchCtx.set(
          // la ligne,
          ctxGray.subarray(sourcePixel, sourcePixel + patchWidth),
          // à sa place dans la zone ;
          targetPixel,
        // fin de la copie.
        );
      // Fin de la boucle.
      }

      // Fusionne la zone, avec
      const patch = processFusionPatch(
        // ses couleurs Viking,
        patchRgb,
        // son gris CTX,
        patchCtx,
        // sa largeur,
        patchWidth,
        // sa hauteur,
        patchHeight,
        // les statistiques,
        stats,
        // et les réglages.
        options,
      // Fin de l'appel.
      );
      // Décalage horizontal du bloc utile dans la zone.
      const cropX = x - x0;
      // Décalage vertical.
      const cropY = y - y0;
      // Pour chaque ligne du bloc utile :
      for (let row = 0; row < coreHeight; row += 1) {
        // position de son début dans la zone ;
        const sourceStart = ((cropY + row) * patchWidth + cropX) * 3;
        // position de son début dans l'image ;
        const targetStart = ((y + row) * width + x) * 3;
        // nombre d'octets de la ligne ;
        const byteLength = coreWidth * 3;
        // copie la ligne dans l'image.
        patch.pixels.copy(pixels, targetStart, sourceStart, sourceStart + byteLength);
      // Fin de la boucle.
      }

      // Pour chaque ligne du bloc utile,
      for (let row = cropY; row < cropY + coreHeight; row += 1) {
        // et chaque colonne :
        for (let column = cropX; column < cropX + coreWidth; column += 1) {
          // position du pixel ;
          const pixel = (row * patchWidth + column) * 3;
          // couleur de palette la plus proche ;
          let nearest = 0;
          // sa distance, infinie au départ ;
          let nearestDistance = Number.POSITIVE_INFINITY;
          // pour chaque couleur de la palette :
          for (let color = 0; color < MARS_BLEND_PALETTE.length; color += 1) {
            // ses trois composantes ;
            const [red, green, blue] = MARS_BLEND_PALETTE[color].rgb;
            // écart en rouge ;
            const dr = patch.pixels[pixel] - red;
            // écart en vert ;
            const dg = patch.pixels[pixel + 1] - green;
            // écart en bleu ;
            const db = patch.pixels[pixel + 2] - blue;
            // distance au carré ;
            const distance = dr * dr + dg * dg + db * db;
            // si elle est plus petite :
            if (distance < nearestDistance) {
              // retient la couleur,
              nearest = color;
              // et sa distance.
              nearestDistance = distance;
            // Fin du cas.
            }
          // Fin de la boucle des couleurs.
          }
          // Compte le pixel pour cette couleur.
          counts[nearest] += 1;
        // Fin des colonnes.
        }
      // Fin des lignes.
      }
    // Fin des colonnes de blocs.
    }
  // Fin des lignes de blocs.
  }

  // Renvoie les pixels et les comptes.
  return { pixels, counts };
// Fin de processMarsFusion.
}

// Fonction computeFusionStats ; ses paramètres :
function computeFusionStats(
  // Viking à sa taille d'origine ;
  vikingRgb: Uint8Array,
  // CTX, deux fois plus grande.
  ctxGray: Uint8Array,
// Elle renvoie les statistiques.
): MarsFusionStats {
  // Somme des luminances Viking.
  let vikSum = 0;
  // Somme de leurs carrés.
  let vikSquaredSum = 0;
  // Somme des luminances CTX.
  let ctxSum = 0;
  // Somme de leurs carrés.
  let ctxSquaredSum = 0;
  // Nombre de pixels comptés.
  let validCount = 0;

  // Pour chaque ligne de Viking,
  for (let y = 0; y < VIKING_HEIGHT; y += 1) {
    // et chaque colonne :
    for (let x = 0; x < VIKING_WIDTH; x += 1) {
      // position des quatre pixels CTX qui correspondent ;
      const ctxOffset = (y * 2) * OUTPUT_WIDTH + x * 2;
      // leur moyenne :
      const ctxAverage = Math.round(
        // le premier,
        (ctxGray[ctxOffset] +
          // son voisin de droite,
          ctxGray[ctxOffset + 1] +
          // celui du dessous,
          ctxGray[ctxOffset + OUTPUT_WIDTH] +
          // et le dernier, divisés par
          ctxGray[ctxOffset + OUTPUT_WIDTH + 1]) /
          // 4.
          4,
      // Fin de la moyenne.
      );
      // Moyenne nulle (pas d'image CTX) : pixel suivant.
      if (ctxAverage === 0) continue;

      // Position du pixel Viking.
      const vikingOffset = (y * VIKING_WIDTH + x) * 3;
      // Sa luminance Lab, à partir de
      const vikingL = rgbToLab(
        // son rouge,
        vikingRgb[vikingOffset],
        // son vert,
        vikingRgb[vikingOffset + 1],
        // et son bleu.
        vikingRgb[vikingOffset + 2],
      // Fin du calcul.
      )[0];
      // Luminance Lab du gris CTX.
      const ctxL = grayToLabL(ctxAverage);
      // Ajoute la luminance Viking.
      vikSum += vikingL;
      // Ajoute son carré.
      vikSquaredSum += vikingL * vikingL;
      // Ajoute la luminance CTX.
      ctxSum += ctxL;
      // Ajoute son carré.
      ctxSquaredSum += ctxL * ctxL;
      // Un pixel de plus.
      validCount += 1;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }

  // Moyenne de Viking.
  const vikMean = vikSum / Math.max(validCount, 1);
  // Moyenne de CTX.
  const ctxMean = ctxSum / Math.max(validCount, 1);
  // Renvoie
  return {
    // la moyenne de Viking ;
    vikMean,
    // son écart type ;
    vikStd: Math.sqrt(Math.max(0, vikSquaredSum / Math.max(validCount, 1) - vikMean ** 2)),
    // la moyenne de CTX ;
    ctxMean,
    // son écart type ;
    ctxStd: Math.sqrt(Math.max(0, ctxSquaredSum / Math.max(validCount, 1) - ctxMean ** 2)),
    // le nombre de pixels.
    validCount,
  // Fin de l'objet.
  };
// Fin de computeFusionStats.
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
  for (let row = 0; row < CTX_TILE_SIZE; row += 1) {
    // position de la ligne dans la tuile ;
    const source = row * CTX_TILE_SIZE;
    // position de la ligne dans la mosaïque :
    const target =
      // la ligne,
      (tileY * CTX_TILE_SIZE + row) * OUTPUT_WIDTH +
      // et la colonne.
      tileX * CTX_TILE_SIZE;
    // Copie la ligne.
    tile.copy(mosaic, target, source, source + CTX_TILE_SIZE);
  // Fin de la boucle.
  }
// Fin de copyCtxTile.
}

// Fonction processFusionPatch : fusionne une zone ; ses paramètres :
function processFusionPatch(
  // ses couleurs Viking ;
  vikingRgb: Uint8Array,
  // son gris CTX ;
  ctxGray: Uint8Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // les statistiques ;
  stats: MarsFusionStats,
  // les réglages.
  options: MarsFusionOptions,
// Elle renvoie les pixels fusionnés.
): { pixels: Buffer } {
  // Nombre de pixels.
  const length = width * height;
  // Viking en Lab, 3 valeurs par pixel.
  const vikingLab = new Float32Array(length * 3);
  // Luminance CTX.
  const ctxL = new Float32Array(length);
  // Luminance CTX ramenée à celle de Viking.
  const correctedL = new Float32Array(length);
  // Pixels qui ont une image CTX.
  const valid = new Uint8Array(length);
  // Pour chaque pixel :
  for (let pixel = 0; pixel < length; pixel += 1) {
    // position de ses couleurs ;
    const rgb = pixel * 3;
    // sa couleur Viking en Lab, à partir de
    const [l, a, b] = rgbToLab(
      // son rouge,
      vikingRgb[rgb],
      // son vert,
      vikingRgb[rgb + 1],
      // et son bleu.
      vikingRgb[rgb + 2],
    // Fin du calcul.
    );
    // Range la luminance,
    vikingLab[rgb] = l;
    // la composante a,
    vikingLab[rgb + 1] = a;
    // et la composante b.
    vikingLab[rgb + 2] = b;
    // Valide si le gris CTX n'est pas nul.
    valid[pixel] = ctxGray[pixel] === 0 ? 0 : 1;
    // Luminance CTX.
    ctxL[pixel] = grayToLabL(ctxGray[pixel]);
    // Luminance corrigée : si le pixel est valide,
    correctedL[pixel] = valid[pixel]
      // l'écart à la moyenne CTX,
      ? (ctxL[pixel] - stats.ctxMean) *
          // mis à l'échelle de l'écart type de Viking,
          (stats.vikStd / Math.max(stats.ctxStd, 1e-6)) +
        // plus la moyenne de Viking ;
        stats.vikMean
      // sinon la luminance de Viking.
      : l;
  // Fin de la boucle.
  }

  // Luminance lissée : deux flous en boîte de suite,
  const low = boxBlur(
    // le premier,
    boxBlur(correctedL, width, height, options.radius),
    // sur la largeur,
    width,
    // la hauteur,
    height,
    // et le rayon des réglages.
    options.radius,
  // Fin du lissage.
  );
  // Pixels de sortie.
  const pixels = Buffer.alloc(length * 3);
  // Palette en Lab, sans le noir d'espace :
  const paletteLab = MARS_BLEND_PALETTE.slice(1).map(({ rgb }) =>
    // chaque couleur convertie.
    rgbToLab(rgb[0], rgb[1], rgb[2]),
  // Fin de la conversion.
  );
  // Dénominateur de la douceur : deux fois son carré.
  const softnessDenominator = 2 * options.softness ** 2;

  // Pour chaque pixel :
  for (let pixel = 0; pixel < length; pixel += 1) {
    // position de ses valeurs ;
    const offset = pixel * 3;
    // luminance fusionnée :
    const fusedLuminance =
      // la part Viking,
      (1 - options.mix) * vikingLab[offset] +
      // plus la part CTX lissée,
      options.mix * low[pixel] +
      // plus les détails CTX (seulement où CTX existe).
      options.detail * (correctedL[pixel] - low[pixel]) * valid[pixel];
    // Composante a de Viking.
    let a = vikingLab[offset + 1];
    // Composante b de Viking.
    let b = vikingLab[offset + 2];
    // Plus petite distance à la palette, infinie au départ.
    let minimumDistance = Number.POSITIVE_INFINITY;
    // Pour chaque couleur de la palette :
    for (const [targetL, targetA, targetB] of paletteLab) {
      // écart en luminance ;
      const dL = fusedLuminance - targetL;
      // écart en a ;
      const dA = a - targetA;
      // écart en b ;
      const dB = b - targetB;
      // garde la plus petite
      minimumDistance = Math.min(
        // des distances,
        minimumDistance,
        // au carré.
        dL * dL + dA * dA + dB * dB,
      // Fin du calcul.
      );
    // Fin de la boucle.
    }

    // Somme des poids.
    let weightSum = 0;
    // Luminance cible.
    let targetL = 0;
    // Composante a cible.
    let targetA = 0;
    // Composante b cible.
    let targetB = 0;
    // Pour chaque couleur de la palette :
    for (const [paletteL, paletteA, paletteB] of paletteLab) {
      // écart en luminance ;
      const dL = fusedLuminance - paletteL;
      // écart en a ;
      const dA = a - paletteA;
      // écart en b ;
      const dB = b - paletteB;
      // poids : fort pour la couleur la plus proche,
      const weight = Math.exp(
        // il décroît avec la distance en plus,
        -((dL * dL + dA * dA + dB * dB - minimumDistance) /
          // selon la douceur.
          softnessDenominator),
      // Fin du calcul.
      );
      // Ajoute le poids.
      weightSum += weight;
      // Ajoute la luminance pondérée.
      targetL += weight * paletteL;
      // Ajoute a pondéré.
      targetA += weight * paletteA;
      // Ajoute b pondéré.
      targetB += weight * paletteB;
    // Fin de la boucle.
    }
    // Luminance cible : la moyenne pondérée.
    targetL /= weightSum;
    // a cible.
    targetA /= weightSum;
    // b cible.
    targetB /= weightSum;
    // Rapproche a de la cible.
    a += options.grade * (targetA - a);
    // Rapproche b de la cible.
    b += options.grade * (targetB - b);
    // Rapproche la luminance de la cible.
    let gradedL = fusedLuminance + options.gradeL * (targetL - fusedLuminance);
    // Sature a.
    a *= options.vibrance;
    // Sature b.
    b *= options.vibrance;
    // Applique le contraste autour du pivot,
    gradedL = Math.max(
      // sans descendre sous 0,
      0,
      // ni dépasser 100.
      Math.min(100, options.pivot + (gradedL - options.pivot) * options.contrast),
    // Fin du calcul.
    );
    // Convertit en rouge, vert, bleu.
    const [red, green, blue] = labToRgb(gradedL, a, b);
    // Écrit le rouge.
    pixels[offset] = clampByte(red);
    // Écrit le vert.
    pixels[offset + 1] = clampByte(green);
    // Écrit le bleu.
    pixels[offset + 2] = clampByte(blue);
  // Fin de la boucle.
  }

  // Renvoie les pixels.
  return { pixels };
// Fin de processFusionPatch.
}

// Fonction boxBlur : moyenne en boîte, par image intégrale ; ses paramètres :
function boxBlur(
  // l'image ;
  image: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // le rayon.
  radius: number,
// Elle renvoie l'image lissée.
): Float32Array {
  // Rayon nul : l'image telle quelle.
  if (radius === 0) return image;
  // Largeur avec les bords prolongés.
  const paddedWidth = width + radius * 2;
  // Hauteur avec les bords prolongés.
  const paddedHeight = height + radius * 2;
  // Largeur d'une ligne de l'image intégrale.
  const stride = paddedWidth + 1;
  // Image intégrale : chaque case vaut la somme de tout ce qui est au-dessus et à gauche.
  const integral = new Float64Array((paddedHeight + 1) * stride);

  // Pour chaque ligne prolongée :
  for (let paddedY = 0; paddedY < paddedHeight; paddedY += 1) {
    // ligne source, sans sortir de l'image ;
    const sourceY = Math.max(0, Math.min(height - 1, paddedY - radius));
    // somme de la ligne, à zéro ;
    let rowSum = 0;
    // pour chaque colonne prolongée :
    for (let paddedX = 0; paddedX < paddedWidth; paddedX += 1) {
      // colonne source, sans sortir de l'image ;
      const sourceX = Math.max(0, Math.min(width - 1, paddedX - radius));
      // ajoute le pixel à la somme de la ligne ;
      rowSum += image[sourceY * width + sourceX];
      // case de l'image intégrale :
      integral[(paddedY + 1) * stride + paddedX + 1] =
        // celle du dessus, plus la somme de la ligne.
        integral[paddedY * stride + paddedX + 1] + rowSum;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }

  // Image lissée.
  const result = new Float32Array(width * height);
  // Côté de la fenêtre.
  const windowSize = radius * 2 + 1;
  // Nombre de pixels de la fenêtre.
  const divisor = windowSize * windowSize;
  // Pour chaque ligne,
  for (let y = 0; y < height; y += 1) {
    // et chaque colonne :
    for (let x = 0; x < width; x += 1) {
      // coin haut gauche de la fenêtre ;
      const topLeft = y * stride + x;
      // coin bas droit ;
      const bottomRight = (y + windowSize) * stride + x + windowSize;
      // moyenne de la fenêtre :
      result[y * width + x] =
        // le coin bas droit,
        (integral[bottomRight] -
          // moins le coin haut droit,
          integral[topLeft + windowSize] -
          // moins le coin bas gauche,
          integral[topLeft + windowSize * stride] +
          // plus le coin haut gauche,
          integral[topLeft]) /
        // divisé par le nombre de pixels.
        divisor;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie l'image lissée.
  return result;
// Fin de boxBlur.
}

// Fonction rgbToLab : de sRGB vers Lab.
function rgbToLab(red: number, green: number, blue: number): [number, number, number] {
  // Rouge linéaire.
  const r = srgbToLinear(red);
  // Vert linéaire.
  const g = srgbToLinear(green);
  // Bleu linéaire.
  const b = srgbToLinear(blue);
  // X, rapporté au point blanc.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_POINT[0];
  // Y, rapporté au point blanc.
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE_POINT[1];
  // Z, rapporté au point blanc.
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE_POINT[2];
  // Fonction Lab de X.
  const fx = labF(x);
  // Fonction Lab de Y.
  const fy = labF(y);
  // Fonction Lab de Z.
  const fz = labF(z);
  // Renvoie L, a et b.
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
// Fin de rgbToLab.
}

// Fonction labToRgb : de Lab vers sRGB.
function labToRgb(l: number, a: number, b: number): [number, number, number] {
  // Fonction Lab de Y.
  const fy = (l + 16) / 116;
  // Fonction Lab de X.
  const fx = fy + a / 500;
  // Fonction Lab de Z.
  const fz = fy - b / 200;
  // X.
  const x = WHITE_POINT[0] * labFInverse(fx);
  // Y.
  const y = WHITE_POINT[1] * labFInverse(fy);
  // Z.
  const z = WHITE_POINT[2] * labFInverse(fz);
  // Renvoie
  return [
    // le rouge,
    linearToSrgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    // le vert,
    linearToSrgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    // et le bleu.
    linearToSrgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  // Fin de la liste.
  ];
// Fin de labToRgb.
}

// Fonction grayToLabL : la luminance Lab d'un gris.
function grayToLabL(gray: number): number {
  // Gris linéaire.
  const linear = srgbToLinear(gray);
  // Sa luminance.
  return 116 * labF(linear) - 16;
// Fin de grayToLabL.
}

// Fonction srgbToLinear : retire la courbe gamma du sRGB.
function srgbToLinear(value: number): number {
  // Valeur de 0 à 1.
  const normalized = value / 255;
  // Renvoie, pour les valeurs sombres,
  return normalized <= 0.04045
    // la partie droite de la courbe ;
    ? normalized / 12.92
    // sinon la partie en puissance 2,4.
    : ((normalized + 0.055) / 1.055) ** 2.4;
// Fin de srgbToLinear.
}

// Fonction linearToSrgb : applique la courbe gamma du sRGB.
function linearToSrgb(value: number): number {
  // Valeur bornée de 0 à 1.
  const clamped = Math.max(0, Math.min(1, value));
  // Renvoie
  return (
    // 255 fois,
    255 *
    // pour les valeurs sombres,
    (clamped <= 0.0031308
      // la partie droite de la courbe ;
      ? 12.92 * clamped
      // sinon la partie en puissance 1/2,4.
      : 1.055 * clamped ** (1 / 2.4) - 0.055)
  // Fin du calcul.
  );
// Fin de linearToSrgb.
}

// Fonction labF : la fonction de la formule Lab.
function labF(value: number): number {
  // Au-dessus du seuil :
  return value > LAB_DELTA ** 3
    // la racine cubique ;
    ? Math.cbrt(value)
    // sinon la partie droite.
    : value / (3 * LAB_DELTA ** 2) + 4 / 29;
// Fin de labF.
}

// Fonction labFInverse : son inverse.
function labFInverse(value: number): number {
  // Au-dessus du seuil :
  return value > LAB_DELTA
    // le cube ;
    ? value ** 3
    // sinon la partie droite.
    : 3 * LAB_DELTA ** 2 * (value - 4 / 29);
// Fin de labFInverse.
}

// Fonction validateOptions : vérifie les réglages.
function validateOptions(options: MarsFusionOptions): void {
  // Si
  if (
    // le rayon n'est pas entier,
    !Number.isInteger(options.radius) ||
    // ou négatif,
    options.radius < 0 ||
    // ou au-delà de 8,
    options.radius > 8 ||
    // ou la force des détails non finie,
    !Number.isFinite(options.detail) ||
    // ou la part CTX non finie,
    !Number.isFinite(options.mix) ||
    // ou négative,
    options.mix < 0 ||
    // ou au-delà de 1,
    options.mix > 1 ||
    // ou le rapprochement des couleurs non fini,
    !Number.isFinite(options.grade) ||
    // ou négatif,
    options.grade < 0 ||
    // ou au-delà de 1,
    options.grade > 1 ||
    // ou le rapprochement de la luminance non fini,
    !Number.isFinite(options.gradeL) ||
    // ou négatif,
    options.gradeL < 0 ||
    // ou au-delà de 1,
    options.gradeL > 1 ||
    // ou la douceur non finie,
    !Number.isFinite(options.softness) ||
    // ou nulle ou négative,
    options.softness <= 0 ||
    // ou la saturation non finie,
    !Number.isFinite(options.vibrance) ||
    // ou négative,
    options.vibrance < 0 ||
    // ou le contraste non fini,
    !Number.isFinite(options.contrast) ||
    // ou négatif,
    options.contrast < 0 ||
    // ou le pivot non fini,
    !Number.isFinite(options.pivot) ||
    // ou négatif,
    options.pivot < 0 ||
    // ou au-delà de 100 :
    options.pivot > 100
  // alors
  ) {
    // erreur.
    throw new Error('Paramètres de fusion Lab Mars invalides.');
  // Fin du cas.
  }
// Fin de validateOptions.
}

// Fonction clampByte.
function clampByte(value: number): number {
  // Arrondit et borne de 0 à 255.
  return Math.max(0, Math.min(255, Math.round(value)));
// Fin de clampByte.
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
