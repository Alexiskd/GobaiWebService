// Worker de chargement : lit un fichier LAS ou LAZ, décompresse les points, calcule les statistiques et construit
// l'octree, sans bloquer l'interface. Les tableaux des nœuds sont transférés (pas copiés) au fil principal.
import { crsLabel, createPointReader, readLasHeader } from './lasFormat.js';
import { buildOctree } from './octree.js';
import { geoFrame } from './georef.js';

const LAZ_PERF_VERSION = '0.0.6';
const LAZ_PERF_CDN = `https://cdn.jsdelivr.net/npm/laz-perf@${LAZ_PERF_VERSION}/lib/web/`;

let lazPerfPromise = null;

/**
 * Décodeur LAZ (laz-perf, WebAssembly). Chargé seulement à la première ouverture d'un .laz.
 * Si le fichier .wasm n'est pas trouvé à côté du module (selon le bundler), on essaie l'URL fournie puis un CDN.
 */
function loadLazPerf(wasmBase) {
  if (!lazPerfPromise) {
    lazPerfPromise = (async () => {
      let mod;
      try {
        mod = await import('laz-perf');
      } catch {
        throw new Error('Décodeur LAZ absent : installez-le avec « npm i laz-perf ».');
      }
      const create = mod.createLazPerf || mod.default?.createLazPerf || mod.default;
      if (typeof create !== 'function') throw new Error('laz-perf : fonction createLazPerf introuvable.');
      const attempts = [undefined];
      if (wasmBase) attempts.push({ locateFile: (file) => wasmBase + file });
      attempts.push({ locateFile: (file) => LAZ_PERF_CDN + file });
      let lastError = null;
      for (const options of attempts) {
        try {
          return await create(options);
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`Décodeur LAZ (WebAssembly) impossible à charger : ${lastError?.message || lastError}`);
    })().catch((error) => {
      lazPerfPromise = null; // nouvel essai possible au prochain fichier
      throw error;
    });
  }
  return lazPerfPromise;
}

const post = (message, transfer) => self.postMessage(message, transfer || []);
const progress = (id, phase, ratio) => post({ type: 'progress', id, phase, ratio });

/** Lit tous les points (ou un sur `stride` au-delà de `maxPoints`) dans des colonnes compactes. */
async function decode(id, buffer, header, maxPoints, lazWasmBase, georeference = false) {
  const total = header.pointCount;
  if (!total) throw new Error('Le fichier ne contient aucun point.');
  const stride = Math.max(1, Math.ceil(total / maxPoints));
  const capacity = Math.floor((total - 1) / stride) + 1;

  // Centre du nuage : les coordonnées (souvent ~10⁶ m en Lambert-93) sont stockées relativement à lui en float32.
  const validBox = header.min.every((v, i) => Number.isFinite(v) && Number.isFinite(header.max[i]) && header.max[i] >= v);
  const center = validBox ? header.min.map((v, i) => (v + header.max[i]) / 2) : header.offset.slice();
  // Option globe : points exprimés directement en mètres Est-Nord-Haut autour du centre (convergence et échelle
  // de la projection incluses). Sans système de coordonnées reconnu, la grille reste telle quelle (placement manuel).
  const frame = georeference ? geoFrame(header.crs, center) : null;
  const [ex, nx, ey, ny] = frame ? frame.matrix : [1, 0, 0, 1];

  const positions = new Float32Array(capacity * 3);
  const colors = header.hasRgb ? new Uint16Array(capacity * 3) : null;
  const intensity = new Uint16Array(capacity);
  const classification = new Uint8Array(capacity);
  const returns = new Uint8Array(capacity);
  const classCounts = new Uint32Array(256);
  const histogram = new Uint32Array(65536);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let maxColor = 0;
  let k = 0;

  const read = createPointReader(header);
  const p = {};
  const store = () => {
    const gx = p.x - center[0], gy = p.y - center[1], z = p.z - center[2];
    const x = ex * gx + ey * gy, y = nx * gx + ny * gy;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    positions[k * 3] = x; positions[k * 3 + 1] = y; positions[k * 3 + 2] = z;
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
    intensity[k] = p.intensity;
    histogram[p.intensity]++;
    classification[k] = p.classification;
    classCounts[p.classification]++;
    returns[k] = (p.returnNumber & 15) | ((p.numberOfReturns & 15) << 4);
    if (colors) {
      colors[k * 3] = p.r; colors[k * 3 + 1] = p.g; colors[k * 3 + 2] = p.b;
      if (p.r > maxColor) maxColor = p.r;
      if (p.g > maxColor) maxColor = p.g;
      if (p.b > maxColor) maxColor = p.b;
    }
    k++;
  };
  const tick = Math.max(1, Math.floor(total / 100));

  if (!header.compressed) {
    const view = new DataView(buffer);
    const length = header.pointRecordLength;
    const available = Math.floor((buffer.byteLength - header.offsetToPointData) / length);
    const count = Math.min(total, available); // fichier tronqué : on lit ce qui est là
    for (let i = 0; i < count; i++) {
      if (i % stride === 0) { read(view, header.offsetToPointData + i * length, p); store(); }
      if (i % tick === 0) progress(id, 'Lecture des points', i / count);
    }
  } else {
    progress(id, 'Chargement du décodeur LAZ', 0);
    const LazPerf = await loadLazPerf(lazWasmBase);
    const bytes = new Uint8Array(buffer);
    const length = header.pointRecordLength;
    const filePtr = LazPerf._malloc(bytes.byteLength);
    const dataPtr = LazPerf._malloc(length);
    const laszip = new LazPerf.LASZip();
    try {
      LazPerf.HEAPU8.set(bytes, filePtr);
      laszip.open(filePtr, bytes.byteLength);
      const count = Math.min(total, typeof laszip.getCount === 'function' ? Number(laszip.getCount()) : total);
      let view = new DataView(LazPerf.HEAPU8.buffer);
      for (let i = 0; i < count; i++) {
        laszip.getPoint(dataPtr);
        if (i % tick === 0) progress(id, 'Décompression LAZ', i / count);
        if (i % stride !== 0) continue;
        if (view.buffer !== LazPerf.HEAPU8.buffer) view = new DataView(LazPerf.HEAPU8.buffer); // mémoire agrandie
        read(view, dataPtr, p);
        store();
      }
    } finally {
      laszip.delete?.();
      LazPerf._free(dataPtr);
      LazPerf._free(filePtr);
    }
  }
  if (!k) throw new Error('Aucun point lisible dans le fichier.');

  // Intensité : bornes aux centiles 1 % et 99 % pour un contraste lisible malgré les valeurs extrêmes.
  const percentile = (q) => {
    const target = q * k;
    let acc = 0;
    for (let v = 0; v < 65536; v++) { acc += histogram[v]; if (acc >= target) return v; }
    return 65535;
  };
  let intensityRange = [percentile(0.01), percentile(0.99)];
  if (intensityRange[1] <= intensityRange[0]) intensityRange = [0, Math.max(1, percentile(1))];

  return {
    count: k, stride, center, frame, min, max, positions, colors, intensity, classification, returns, classCounts,
    intensityRange,
    maxColor,
    colorShift: maxColor > 255 ? 8 : 0, // couleurs 16 bits ou 8 bits selon le logiciel producteur
  };
}

/** Découpe les colonnes par nœud d'octree en tampons prêts pour le GPU. */
function packNodes(data, tree) {
  const { positions, colors, intensity, classification, returns, colorShift } = data;
  const transfer = [];
  const nodes = tree.nodes.map((node) => {
    const n = node.count;
    const pos = new Float32Array(n * 3);
    const rgbc = new Uint8Array(n * 4);
    const iret = new Uint16Array(n * 2);
    for (let j = 0; j < n; j++) {
      const i = tree.order[node.start + j];
      pos[j * 3] = positions[i * 3]; pos[j * 3 + 1] = positions[i * 3 + 1]; pos[j * 3 + 2] = positions[i * 3 + 2];
      if (colors) {
        rgbc[j * 4] = colors[i * 3] >> colorShift;
        rgbc[j * 4 + 1] = colors[i * 3 + 1] >> colorShift;
        rgbc[j * 4 + 2] = colors[i * 3 + 2] >> colorShift;
      } else {
        rgbc[j * 4] = rgbc[j * 4 + 1] = rgbc[j * 4 + 2] = 200;
      }
      rgbc[j * 4 + 3] = classification[i];
      iret[j * 2] = intensity[i];
      iret[j * 2 + 1] = returns[i];
    }
    transfer.push(pos.buffer, rgbc.buffer, iret.buffer);
    return {
      key: node.key, level: node.level, parent: node.parent, children: node.children,
      min: node.min, size: node.size, spacing: node.spacing, count: n, pos, rgbc, iret,
    };
  });
  return { nodes, transfer };
}

self.onmessage = async (event) => {
  const { type, id, buffer, name, maxPoints = 25_000_000, lazWasmBase = '', georeference = false } = event.data || {};
  if (type !== 'load') return;
  const started = performance.now();
  try {
    const header = readLasHeader(buffer);
    post({ type: 'header', id, header: { ...header, crsLabel: crsLabel(header.crs) } });
    const data = await decode(id, buffer, header, maxPoints, lazWasmBase, georeference);
    const decoded = performance.now();

    const tree = buildOctree(data.positions, data.count, { min: data.min, max: data.max }, {
      onProgress: (r) => progress(id, 'Indexation spatiale', r),
    });
    progress(id, 'Préparation de l’affichage', 1);
    const { nodes, transfer } = packNodes(data, tree);

    const classCounts = {};
    data.classCounts.forEach((c, cls) => { if (c) classCounts[cls] = c; });
    post({
      type: 'done',
      id,
      result: {
        name,
        header: { ...header, crsLabel: crsLabel(header.crs) },
        center: data.center,
        geo: data.frame, // { lon, lat, height, epsg, label } ou null (option georeference)
        bounds: { min: data.min, max: data.max },
        pointCount: data.count,
        filePointCount: header.pointCount,
        stride: data.stride,
        hasRgb: header.hasRgb && data.maxColor > 0, // champ couleur présent mais vide : pas de vraies couleurs
        intensityRange: data.intensityRange,
        classCounts,
        root: tree.root,
        maxDepth: tree.maxDepth,
        nodes,
        timings: { decodeMs: Math.round(decoded - started), indexMs: Math.round(performance.now() - decoded) },
      },
    }, transfer);
  } catch (error) {
    post({ type: 'error', id, message: error?.message || String(error) });
  }
};
