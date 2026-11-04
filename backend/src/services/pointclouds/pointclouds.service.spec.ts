import { BadRequestException } from '@nestjs/common';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../../common/configuration';
import { PointCloudsService } from './pointclouds.service';

describe('PointCloudsService', () => {
  let directory: string;
  let service: PointCloudsService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gobai-pointclouds-'));
    service = new PointCloudsService({ pointclouds: { dir: directory } } as AppConfig);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('lit l’emprise, le nombre de points et le CRS WKT de l’en-tête LAS 1.4', async () => {
    const wkt = 'PROJCS["Local survey"]';
    await writeFile(join(directory, 'survey.copc.laz'), lasFile(wkt));

    const cloud = await service.get('survey.copc.laz');

    expect(cloud.header).toEqual({
      version: '1.4',
      pointFormat: 6,
      pointCount: '1234',
      bounds: { minX: 139.7, minY: 35.6, minZ: 2, maxX: 139.9, maxY: 35.8, maxZ: 850 },
      coordinateSystemWkt: wkt,
    });
  });

  it('expose les ressources Potree converties et refuse un chemin sortant du jeu', async () => {
    const name = 'city.laz';
    await writeFile(join(directory, name), lasFile(''));
    const assetDirectory = join(directory, 'potree', name, 'data', 'r');
    await mkdir(assetDirectory, { recursive: true });
    await writeFile(join(directory, 'potree', name, 'cloud.js'), '{}');
    await writeFile(join(assetDirectory, '0-0-0-0.bin'), Buffer.from([1, 2, 3]));

    await expect(service.get(name)).resolves.toMatchObject({ potreeAvailable: true });
    await expect(service.getPotreeAsset(name, 'data/r/0-0-0-0.bin'))
      .resolves.toMatchObject({ sizeBytes: 3, name: '0-0-0-0.bin' });
    await expect(service.getPotreeAsset(name, '../secret'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('garde le flux disponible si un fichier portant une extension LAS a un en-tête illisible', async () => {
    await writeFile(join(directory, 'incomplete.las'), Buffer.from('not-las'));

    await expect(service.get('incomplete.las')).resolves.toMatchObject({
      sizeBytes: 7,
      header: null,
      potreeAvailable: false,
    });
  });
});

function lasFile(wkt: string): Buffer {
  const projection = Buffer.from(wkt);
  const vlrLength = wkt ? 54 + projection.length : 0;
  const buffer = Buffer.alloc(375 + vlrLength);
  buffer.write('LASF', 0, 'ascii');
  buffer.writeUInt8(1, 24);
  buffer.writeUInt8(4, 25);
  buffer.writeUInt16LE(375, 94);
  buffer.writeUInt32LE(375 + vlrLength, 96);
  buffer.writeUInt32LE(wkt ? 1 : 0, 100);
  buffer.writeUInt8(6, 104);
  buffer.writeBigUInt64LE(1234n, 247);
  buffer.writeDoubleLE(139.9, 179);
  buffer.writeDoubleLE(139.7, 187);
  buffer.writeDoubleLE(35.8, 195);
  buffer.writeDoubleLE(35.6, 203);
  buffer.writeDoubleLE(850, 211);
  buffer.writeDoubleLE(2, 219);
  if (wkt) {
    const record = 375;
    buffer.write('LASF_Projection', record + 2, 'ascii');
    buffer.writeUInt16LE(2112, record + 18);
    buffer.writeUInt16LE(projection.length, record + 20);
    projection.copy(buffer, record + 54);
  }
  return buffer;
}
