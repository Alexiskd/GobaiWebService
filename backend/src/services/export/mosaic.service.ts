/**
 * Assemblage des tuiles d'un astre en une seule image.
 *
 * Les tuiles d'une couche sont téléchargées une à une puis collées dans une image unique, à la résolution
 * demandée. Deux découpages existent, celui que la couche déclare :
 *  - `mercator` : 2^z × 2^z tuiles, image carrée en projection Web Mercator (bornée à 85,05° de latitude) ;
 *  - `equirectangular` : 2^(z+1) × 2^z tuiles, image deux fois plus large que haute, d'un pôle à l'autre.
 * L'image garde ce découpage : elle n'est pas reprojetée. Le modèle 3D s'en accommode en posant ses coordonnées
 * de texture dans la même projection (voir glb.ts, textureV).
 */
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';
import { TilesService } from '../map-tiles/map-imagery.service';

/** Côté d'une tuile, en pixels. */
const TILE_PX = 256;
/** Niveau de zoom maximal accepté : au-delà, l'image dépasse ce qu'un serveur peut assembler en mémoire. */
export const MAX_ZOOM = 5;
/** Nombre de tuiles téléchargées en même temps. */
const PARALLEL = 8;

/** Une image assemblée, avec ce qu'il faut pour la comprendre. */
export interface Mosaic {
  /** Les octets de l'image. */
  image: Buffer;
  /** Type de l'image. */
  mimeType: string;
  /** Dimensions, en pixels. */
  width: number;
  height: number;
  /** Découpage de l'image. */
  projection: 'mercator' | 'equirectangular';
  /** Niveau de zoom assemblé. */
  zoom: number;
  /** Nombre de tuiles attendues, et nombre réellement obtenues. */
  tiles: number;
  missing: number;
  /** Mention d'origine et de licence de la couche. */
  attribution: string;
}

// Service injecté par NestJS.
@Injectable()
// Classe du service d'assemblage.
export class MosaicService {
  // Journal du service.
  private readonly logger = new Logger(MosaicService.name);

  // Constructeur : NestJS y injecte le service des tuiles.
  constructor(private readonly tiles: TilesService) {}

  /** Nombre de tuiles d'un niveau, selon le découpage. */
  static grid(projection: string, zoom: number): { cols: number; rows: number } {
    // Équirectangulaire : deux fois plus large que haut.
    const rows = 2 ** zoom;
    // Les colonnes.
    return { cols: projection === 'equirectangular' ? rows * 2 : rows, rows };
  // Fin de grid.
  }

  /** Assemble la couche demandée au niveau de zoom demandé. */
  async build(layerId: string, zoom: number): Promise<Mosaic> {
    // Niveau de zoom plausible.
    if (!Number.isInteger(zoom) || zoom < 0 || zoom > MAX_ZOOM) {
      // Refus, en disant la borne.
      throw new BadRequestException(`Le niveau de zoom doit être un entier de 0 à ${MAX_ZOOM}.`);
    // Fin du contrôle.
    }
    // La couche, pour connaître son découpage et son attribution.
    const layer = await this.tiles.layer(layerId);
    // Son découpage.
    const projection = layer.projection === 'equirectangular' ? 'equirectangular' : 'mercator';
    // Le quadrillage et les dimensions de l'image.
    const { cols, rows } = MosaicService.grid(projection, zoom);
    const width = cols * TILE_PX;
    const height = rows * TILE_PX;
    // Les tuiles à chercher.
    const wanted: { x: number; y: number }[] = [];
    // Toutes les positions du quadrillage.
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) wanted.push({ x, y });
    // Les tuiles obtenues, prêtes à coller.
    const pieces: { input: Buffer; left: number; top: number }[] = [];
    // Tuiles manquantes.
    let missing = 0;
    // Télécharge par paquets, pour ne pas ouvrir des centaines de connexions.
    for (let i = 0; i < wanted.length; i += PARALLEL) {
      // Le paquet courant.
      const batch = wanted.slice(i, i + PARALLEL);
      // Chaque tuile du paquet.
      const got = await Promise.all(batch.map(async ({ x, y }) => {
        // Essaie de la télécharger.
        try {
          // Adresse de la tuile.
          const url = await this.tiles.tileUrl(layerId, zoom, x, y);
          // Téléchargement.
          const res = await fetch(url);
          // Réponse en échec : tuile manquante.
          if (!res.ok) return null;
          // Les octets.
          return { input: Buffer.from(await res.arrayBuffer()), left: x * TILE_PX, top: y * TILE_PX };
        // Tuile indisponible : l'assemblage continue sans elle.
        } catch {
          // Rien.
          return null;
        // Fin de l'essai.
        }
      // Fin du paquet.
      }));
      // Range ce qui est arrivé.
      for (const piece of got) {
        // Tuile obtenue, ou comptée comme manquante.
        if (piece) pieces.push(piece); else missing += 1;
      // Fin du rangement.
      }
    // Fin des paquets.
    }
    // Aucune tuile : il n'y a rien à vendre, autant le dire.
    if (!pieces.length) throw new ServiceUnavailableException(`Aucune tuile n’a pu être téléchargée pour « ${layerId} ».`);
    // Quelques tuiles manquantes : signalé dans le journal, l'image reste utilisable.
    if (missing) this.logger.warn(`Assemblage ${layerId} z${zoom} : ${missing} tuiles sur ${wanted.length} manquantes.`);
    // Colle les tuiles sur un fond noir et encode en JPEG.
    const image = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .composite(pieces)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    // L'image assemblée.
    return {
      image,
      mimeType: 'image/jpeg',
      width,
      height,
      projection,
      zoom,
      tiles: wanted.length,
      missing,
      attribution: (layer as { attribution?: string }).attribution || '',
    };
  // Fin de build.
  }
// Fin du service.
}
