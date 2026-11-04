import { LAZRsLoader } from '@loaders.gl/las';
import { buildPointChunks } from './chunks';
import type { PointChunk } from './chunks';
import type { Bounds3D } from './types';

interface ParseRequest {
  id: number;
  buffer: ArrayBuffer;
  dimensionsMeters: readonly [number, number, number];
}

self.addEventListener('message', async (event: MessageEvent<ParseRequest>) => {
  const { id, buffer } = event.data;
  try {
    const mesh = await LAZRsLoader.parse(buffer, {
      las: { fp64: true, colorDepth: 8 },
      onProgress: (progress: { progress?: number }) => {
        self.postMessage({ id, type: 'progress', progress: progress.progress ?? 0 });
      },
    });
    const position = mesh.attributes.POSITION?.value;
    if (!(position instanceof Float32Array || position instanceof Float64Array)) {
      throw new TypeError('Le fichier LAS/LAZ ne contient pas de positions exploitables.');
    }
    const color = mesh.attributes.COLOR_0?.value;
    const header = mesh.header;
    if (!header?.boundingBox || header.boundingBox.length < 2 || !Number.isSafeInteger(header.vertexCount)) {
      throw new TypeError('Le décodeur n’a pas renvoyé un en-tête LAS complet.');
    }
    const bounds = {
      minX: header.boundingBox[0][0],
      minY: header.boundingBox[0][1],
      minZ: header.boundingBox[0][2],
      maxX: header.boundingBox[1][0],
      maxY: header.boundingBox[1][1],
      maxZ: header.boundingBox[1][2],
    } satisfies Bounds3D;
    const chunks: PointChunk[] = buildPointChunks(
      position,
      color instanceof Uint8Array ? color : null,
      bounds,
      event.data.dimensionsMeters,
    );
    const transfer: Transferable[] = [];
    for (const chunk of chunks) {
      for (const level of chunk.levels) {
        transfer.push(level.positions.buffer, level.colors.buffer);
      }
    }
    self.postMessage({
      id,
      type: 'complete',
      bounds,
      pointCount: header.vertexCount,
      chunks,
    }, transfer);
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : 'Échec du décodage LAS/LAZ.',
    });
  }
});
