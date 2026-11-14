// Erreur 400, pour vérifier qu'elle est bien levée.
import { BadRequestException } from '@nestjs/common';
// Fonctions de fichiers : créer un dossier temporaire, créer un dossier, supprimer, écrire.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
// tmpdir : le dossier temporaire du système.
import { tmpdir } from 'node:os';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Service testé.
import { PointCloudsService } from './pointclouds.service';

// Groupe de tests du service des nuages de points.
describe('PointCloudsService', () => {
  // Dossier temporaire du test en cours.
  let directory: string;
  // Service du test en cours.
  let service: PointCloudsService;

  // Avant chaque test :
  beforeEach(async () => {
    // crée un dossier temporaire au nom unique ;
    directory = await mkdtemp(join(tmpdir(), 'gobai-pointclouds-'));
    // et un service qui pointe dessus (une configuration réduite à ce seul réglage).
    service = new PointCloudsService({ pointclouds: { dir: directory } } as AppConfig);
  // Fin de la préparation.
  });

  // Après chaque test :
  afterEach(async () => {
    // supprime le dossier et tout son contenu.
    await rm(directory, { recursive: true, force: true });
  // Fin du nettoyage.
  });

  // Premier test : lecture de l'en-tête.
  it('lit l’emprise, le nombre de points et le CRS WKT de l’en-tête LAS 1.4', async () => {
    // Texte de référence spatiale d'exemple.
    const wkt = 'PROJCS["Local survey"]';
    // Écrit un faux fichier LAS qui le contient.
    await writeFile(join(directory, 'survey.copc.laz'), lasFile(wkt));

    // Demande sa description.
    const cloud = await service.get('survey.copc.laz');

    // L'en-tête lu doit être :
    expect(cloud.header).toEqual({
      // version 1.4 ;
      version: '1.4',
      // format de points 6 ;
      pointFormat: 6,
      // 1 234 points ;
      pointCount: '1234',
      // l'emprise écrite dans le fichier ;
      bounds: { minX: 139.7, minY: 35.6, minZ: 2, maxX: 139.9, maxY: 35.8, maxZ: 850 },
      // et le texte de référence spatiale.
      coordinateSystemWkt: wkt,
    // Fin de la comparaison.
    });
  // Fin du test.
  });

  // Deuxième test : les ressources Potree.
  it('expose les ressources Potree converties et refuse un chemin sortant du jeu', async () => {
    // Nom du nuage.
    const name = 'city.laz';
    // Écrit un faux fichier LAS, sans référence spatiale.
    await writeFile(join(directory, name), lasFile(''));
    // Dossier des ressources converties.
    const assetDirectory = join(directory, 'potree', name, 'data', 'r');
    // Le crée, avec ses parents.
    await mkdir(assetDirectory, { recursive: true });
    // Y écrit le fichier cloud.js.
    await writeFile(join(directory, 'potree', name, 'cloud.js'), '{}');
    // Et une ressource binaire de 3 octets.
    await writeFile(join(assetDirectory, '0-0-0-0.bin'), Buffer.from([1, 2, 3]));

    // Le nuage annonce une version Potree.
    await expect(service.get(name)).resolves.toMatchObject({ potreeAvailable: true });
    // La ressource demandée par son chemin
    await expect(service.getPotreeAsset(name, 'data/r/0-0-0-0.bin'))
      // est trouvée, avec sa taille et son nom.
      .resolves.toMatchObject({ sizeBytes: 3, name: '0-0-0-0.bin' });
    // Un chemin qui remonte hors du dossier
    await expect(service.getPotreeAsset(name, '../secret'))
      // est refusé par une erreur 400.
      .rejects.toBeInstanceOf(BadRequestException);
  // Fin du test.
  });

  // Troisième test : en-tête illisible.
  it('garde le flux disponible si un fichier portant une extension LAS a un en-tête illisible', async () => {
    // Écrit un fichier qui a l'extension .las mais pas le contenu.
    await writeFile(join(directory, 'incomplete.las'), Buffer.from('not-las'));

    // Sa description est quand même renvoyée :
    await expect(service.get('incomplete.las')).resolves.toMatchObject({
      // sa taille ;
      sizeBytes: 7,
      // pas d'en-tête ;
      header: null,
      // pas de version Potree.
      potreeAvailable: false,
    // Fin de la comparaison.
    });
  // Fin du test.
  });
// Fin du groupe.
});

// Fonction lasFile : fabrique en mémoire un fichier LAS 1.4 minimal, avec une référence spatiale facultative.
function lasFile(wkt: string): Buffer {
  // Octets du texte de référence spatiale.
  const projection = Buffer.from(wkt);
  // Taille de l'enregistrement qui le porte : 54 octets d'en-tête plus le texte, ou 0 sans texte.
  const vlrLength = wkt ? 54 + projection.length : 0;
  // Mémoire du fichier : 375 octets d'en-tête LAS 1.4, plus l'enregistrement.
  const buffer = Buffer.alloc(375 + vlrLength);
  // Signature « LASF » au début.
  buffer.write('LASF', 0, 'ascii');
  // Version majeure : 1.
  buffer.writeUInt8(1, 24);
  // Version mineure : 4.
  buffer.writeUInt8(4, 25);
  // Taille de l'en-tête : 375.
  buffer.writeUInt16LE(375, 94);
  // Position du début des points.
  buffer.writeUInt32LE(375 + vlrLength, 96);
  // Nombre d'enregistrements variables : 1 avec un texte, 0 sinon.
  buffer.writeUInt32LE(wkt ? 1 : 0, 100);
  // Format des points : 6.
  buffer.writeUInt8(6, 104);
  // Nombre de points sur 64 bits : 1 234.
  buffer.writeBigUInt64LE(1234n, 247);
  // Maximum en X.
  buffer.writeDoubleLE(139.9, 179);
  // Minimum en X.
  buffer.writeDoubleLE(139.7, 187);
  // Maximum en Y.
  buffer.writeDoubleLE(35.8, 195);
  // Minimum en Y.
  buffer.writeDoubleLE(35.6, 203);
  // Maximum en Z.
  buffer.writeDoubleLE(850, 211);
  // Minimum en Z.
  buffer.writeDoubleLE(2, 219);
  // Avec un texte :
  if (wkt) {
    // position de l'enregistrement, juste après l'en-tête ;
    const record = 375;
    // son identifiant d'utilisateur ;
    buffer.write('LASF_Projection', record + 2, 'ascii');
    // son numéro : 2112, la référence spatiale en WKT ;
    buffer.writeUInt16LE(2112, record + 18);
    // la longueur du texte ;
    buffer.writeUInt16LE(projection.length, record + 20);
    // le texte, copié après les 54 octets d'en-tête de l'enregistrement.
    projection.copy(buffer, record + 54);
  // Fin du cas.
  }
  // Renvoie le fichier.
  return buffer;
// Fin de lasFile.
}
