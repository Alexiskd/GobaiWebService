import type { Bounds3D } from './types';

export const CHUNK_SIZE_METERS = 64;
export const LOD_STRIDES = [1, 4, 16] as const;
export const MAX_POINTS_PER_CHUNK = 100_000;
export const MAX_CHUNKS = 4096;

export interface PointChunkLevel {
  stride: number;
  positions: Float32Array;
  colors: Uint8Array;
}

export interface PointChunk {
  key: string;
  bounds: Bounds3D;
  pointCount: number;
  levels: PointChunkLevel[];
}

interface ChunkAccumulator {
  count: number;
  bounds: Bounds3D;
  cursors: number[];
  levels: PointChunkLevel[];
}

export function buildPointChunks(
  positions: ArrayLike<number>,
  colors: ArrayLike<number> | null,
  sourceBounds: Bounds3D,
  dimensionsMeters: readonly [number, number, number],
  chunkSizeMeters = CHUNK_SIZE_METERS,
): PointChunk[] {
  if (positions.length % 3 !== 0 || !Number.isFinite(chunkSizeMeters) || chunkSizeMeters <= 0) {
    throw new TypeError('Géométrie ou taille de chunk invalide.');
  }
  const pointCount = positions.length / 3;
  if (pointCount < 1) throw new RangeError('Le nuage doit contenir au moins un point.');
  if (colors && colors.length !== pointCount * 4) {
    throw new TypeError('Le buffer de couleurs ne correspond pas au nombre de points.');
  }
  const sourceSize = [
    sourceBounds.maxX - sourceBounds.minX,
    sourceBounds.maxY - sourceBounds.minY,
    sourceBounds.maxZ - sourceBounds.minZ,
  ];
  if (sourceSize.some((size) => !Number.isFinite(size) || size < 0)
    || dimensionsMeters.some((size) => !Number.isFinite(size) || size <= 0)) {
    throw new RangeError('L’emprise source et les dimensions doivent être finies et les dimensions positives.');
  }
  const center = [
    (sourceBounds.minX + sourceBounds.maxX) / 2,
    (sourceBounds.minY + sourceBounds.maxY) / 2,
    (sourceBounds.minZ + sourceBounds.maxZ) / 2,
  ];

  let finalChunkSize = Math.max(chunkSizeMeters, Math.max(...dimensionsMeters) / 12);
  let chunks = collectChunks(positions, center, sourceSize, dimensionsMeters, finalChunkSize);
  for (let attempt = 0; chunks.size > MAX_CHUNKS; attempt++) {
    if (attempt >= 16) throw new RangeError('Impossible de limiter le nombre de chunks du nuage.');
    finalChunkSize *= 2;
    chunks = collectChunks(positions, center, sourceSize, dimensionsMeters, finalChunkSize);
  }

  for (const chunk of chunks.values()) {
    chunk.levels = chunk.levels.map((level) => ({
      stride: level.stride,
      positions: new Float32Array(Math.ceil(chunk.count / level.stride) * 3),
      colors: new Uint8Array(Math.ceil(chunk.count / level.stride) * 4),
    }));
  }

  const seen = new Map<string, number>();
  const cellsSeen = new Map<string, number>();
  const colorScale = colors instanceof Float32Array || colors instanceof Float64Array ? 255 : 1;
  for (let point = 0; point < pointCount; point++) {
    const local = localPosition(positions, point, center, sourceSize, dimensionsMeters);
    const cell = chunkKey(local, finalChunkSize);
    const cellPoint = cellsSeen.get(cell) ?? 0;
    cellsSeen.set(cell, cellPoint + 1);
    const key = `${cell}|${Math.floor(cellPoint / MAX_POINTS_PER_CHUNK)}`;
    const chunk = chunks.get(key);
    if (!chunk) throw new Error('Le découpage du nuage a produit une clé incohérente.');
    const localPoint = seen.get(key) ?? 0;
    seen.set(key, localPoint + 1);
    for (let levelIndex = 0; levelIndex < LOD_STRIDES.length; levelIndex++) {
      const { stride, positions: levelPositions, colors: levelColors } = chunk.levels[levelIndex];
      if (localPoint % stride !== 0) continue;
      const target = chunk.cursors[levelIndex]++;
      levelPositions[target * 3] = local[0];
      levelPositions[target * 3 + 1] = local[1];
      levelPositions[target * 3 + 2] = local[2];
      if (colors) {
        for (let channel = 0; channel < 4; channel++) {
          levelColors[target * 4 + channel] = Math.round(colors[point * 4 + channel] * colorScale);
        }
      } else {
        levelColors[target * 4] = 220;
        levelColors[target * 4 + 1] = 220;
        levelColors[target * 4 + 2] = 220;
        levelColors[target * 4 + 3] = 255;
      }
    }
  }

  return [...chunks.entries()].map(([key, chunk]) => ({
    key,
    bounds: chunk.bounds,
    pointCount: chunk.count,
    levels: chunk.levels,
  }));
}

function collectChunks(
  positions: ArrayLike<number>,
  center: number[],
  sourceSize: number[],
  dimensions: readonly [number, number, number],
  chunkSize: number,
): Map<string, ChunkAccumulator> {
  const chunks = new Map<string, ChunkAccumulator>();
  const cellCounts = new Map<string, number>();
  for (let point = 0; point < positions.length / 3; point++) {
    if (
      !Number.isFinite(positions[point * 3])
      || !Number.isFinite(positions[point * 3 + 1])
      || !Number.isFinite(positions[point * 3 + 2])
    ) {
      throw new TypeError('Une coordonnée du nuage n’est pas finie.');
    }
    const local = localPosition(positions, point, center, sourceSize, dimensions);
    const cell = chunkKey(local, chunkSize);
    const cellPoint = cellCounts.get(cell) ?? 0;
    cellCounts.set(cell, cellPoint + 1);
    const key = `${cell}|${Math.floor(cellPoint / MAX_POINTS_PER_CHUNK)}`;
    let chunk = chunks.get(key);
    if (!chunk) {
      chunk = {
        count: 0,
        bounds: emptyBounds(),
        cursors: [...LOD_STRIDES].map(() => 0),
        levels: LOD_STRIDES.map((stride) => ({
          stride,
          positions: new Float32Array(0),
          colors: new Uint8Array(0),
        })),
      };
      chunks.set(key, chunk);
    }
    chunk.count++;
    growBounds(chunk.bounds, local);
  }
  return chunks;
}

function localPosition(
  positions: ArrayLike<number>,
  point: number,
  center: number[],
  sourceSize: number[],
  dimensions: readonly [number, number, number],
): [number, number, number] {
  const scale = (axis: number) => sourceSize[axis] === 0
    ? 0
    : (positions[point * 3 + axis] - center[axis]) * dimensions[axis] / sourceSize[axis];
  return [
    scale(0),
    scale(1),
    scale(2),
  ];
}

function chunkKey(position: readonly number[], size: number): string {
  return position.map((value) => Math.floor((value + size / 2) / size)).join('/');
}

function emptyBounds(): Bounds3D {
  return {
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
  };
}

function growBounds(bounds: Bounds3D, position: readonly number[]): void {
  bounds.minX = Math.min(bounds.minX, position[0]);
  bounds.minY = Math.min(bounds.minY, position[1]);
  bounds.minZ = Math.min(bounds.minZ, position[2]);
  bounds.maxX = Math.max(bounds.maxX, position[0]);
  bounds.maxY = Math.max(bounds.maxY, position[1]);
  bounds.maxZ = Math.max(bounds.maxZ, position[2]);
}
