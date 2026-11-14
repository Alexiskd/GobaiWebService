// createHash : calcule une empreinte.
import { createHash } from 'node:crypto';
// Buffer : le tampon d'octets de Node.
import { Buffer } from 'node:buffer';
// Type (effacé à la compilation) des informations d'une image.
import type { ImageInfo } from './mercury.types';

// Les huit premiers octets de tout fichier PNG :
const PNG_SIGNATURE = Buffer.from([
  // leurs valeurs.
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
// Fin de la signature.
]);
// Marqueurs JPEG qui annoncent les dimensions de l'image :
const SOF_MARKERS = new Set([
  // leurs valeurs.
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
// Fin de la liste.
]);

// Fonction sha256Hex.
export function sha256Hex(buffer: Buffer): string {
  // Empreinte SHA-256 du tampon, en hexadécimal.
  return createHash('sha256').update(buffer).digest('hex');
// Fin de sha256Hex.
}

// Fonction etagFromSha.
export function etagFromSha(sha256: string): string {
  // L'en-tête ETag : « sha256-<empreinte> », entre guillemets.
  return `"sha256-${sha256}"`;
// Fin de etagFromSha.
}

// Fonction inspectImage.
export function inspectImage(buffer: Buffer): ImageInfo | null {
  // Essaie de lire un PNG.
  const png = readPng(buffer);
  // Si c'en est un :
  if (png) {
    // renvoie
    return {
      // le format PNG ;
      format: 'png',
      // la largeur ;
      width: png.width,
      // la hauteur ;
      height: png.height,
      // le poids en octets ;
      bytes: buffer.length,
      // l'empreinte.
      sha256: sha256Hex(buffer),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Essaie de lire un JPEG.
  const jpeg = readJpeg(buffer);
  // Si c'en est un :
  if (jpeg) {
    // renvoie
    return {
      // le format JPEG ;
      format: 'jpeg',
      // la largeur ;
      width: jpeg.width,
      // la hauteur ;
      height: jpeg.height,
      // le poids en octets ;
      bytes: buffer.length,
      // l'empreinte.
      sha256: sha256Hex(buffer),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Ni l'un ni l'autre : null.
  return null;
// Fin de inspectImage.
}

// Fonction readPng.
function readPng(buffer: Buffer): { width: number; height: number } | null {
  // Moins de 24 octets, ou mauvaise signature :
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // null.
    return null;
  // Fin du cas.
  }

  // Renvoie
  return {
    // la largeur, lue à l'octet 16 ;
    width: buffer.readUInt32BE(16),
    // la hauteur, lue à l'octet 20.
    height: buffer.readUInt32BE(20),
  // Fin de l'objet.
  };
// Fin de readPng.
}

// Fonction readJpeg.
function readJpeg(buffer: Buffer): { width: number; height: number } | null {
  // Moins de 4 octets, ou pas FF D8 au début :
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    // null.
    return null;
  // Fin du cas.
  }

  // Position de lecture, après la signature.
  let offset = 2;
  // Tant qu'il reste 4 octets :
  while (offset + 4 <= buffer.length) {
    // si l'octet n'est pas FF :
    if (buffer[offset] !== 0xff) {
      // avance d'un octet,
      offset += 1;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Marqueur : l'octet suivant.
    const marker = buffer[offset + 1];
    // Si c'est encore FF (remplissage) :
    if (marker === 0xff) {
      // avance d'un octet,
      offset += 1;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Si le marqueur est
    if (
      // le début d'image,
      marker === 0xd8 ||
      // le marqueur 01,
      marker === 0x01 ||
      // ou un marqueur de reprise
      (marker >= 0xd0 && marker <= 0xd7)
    // (ils n'ont pas de longueur) :
    ) {
      // avance de 2 octets,
      offset += 2;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Fin d'image ou début des données :
    if (marker === 0xd9 || marker === 0xda) {
      // null, les dimensions n'ont pas été trouvées.
      return null;
    // Fin du cas.
    }

    // Longueur du segment.
    const length = buffer.readUInt16BE(offset + 2);
    // Longueur impossible :
    if (length < 2) {
      // null.
      return null;
    // Fin du cas.
    }

    // Si le marqueur annonce les dimensions :
    if (SOF_MARKERS.has(marker)) {
      // segment coupé :
      if (offset + 9 > buffer.length) {
        // null.
        return null;
      // Fin du cas.
      }
      // Renvoie
      return {
        // la hauteur ;
        height: buffer.readUInt16BE(offset + 5),
        // la largeur.
        width: buffer.readUInt16BE(offset + 7),
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Passe au segment suivant.
    offset += 2 + length;
  // Fin de la boucle.
  }

  // Rien trouvé : null.
  return null;
// Fin de readJpeg.
}
