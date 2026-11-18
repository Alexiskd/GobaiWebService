// Modèle 3D du relief de Mars en glTF binaire (.glb), à partir d'une mosaïque d'altitudes en plate carrée.
// Sphère en grille longitude × latitude, rayon 3 396,19 km plus l'altitude (multipliée par l'exagération), unités en
// kilomètres, axe Y vers le pôle Nord (convention glTF). Coordonnées de texture en plate carrée (nord en haut) :
// une carte de Mars équirectangulaire s'y pose directement dans Blender, Three.js ou tout lecteur glTF.

/** Rayon de référence de Mars (sphère MOLA), en kilomètres. */
export const MARS_RADIUS_KM = 3396.19;

/** Mosaïque mondiale d'altitudes en mètres : largeur, hauteur, valeurs ligne par ligne du nord au sud (NaN : sans donnée). */
export interface Mosaic { width: number; height: number; data: Float32Array }

/** Altitude (m) au point (lon, lat) en degrés, interpolée entre les 4 pixels voisins ; 0 sans donnée. */
export function sampleMosaic(m: Mosaic, lonDeg: number, latDeg: number): number {
  // Position en pixels (centres de pixel) ; la longitude fait le tour, la latitude est bornée.
  const fx = ((((lonDeg + 180) / 360) * m.width - 0.5) % m.width + m.width) % m.width;
  const fy = Math.min(m.height - 1, Math.max(0, ((90 - latDeg) / 180) * m.height - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % m.width, y1 = Math.min(m.height - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const samples: [number, number][] = [
    [m.data[y0 * m.width + x0], (1 - tx) * (1 - ty)],
    [m.data[y0 * m.width + x1], tx * (1 - ty)],
    [m.data[y1 * m.width + x0], (1 - tx) * ty],
    [m.data[y1 * m.width + x1], tx * ty],
  ];
  let sum = 0, weight = 0;
  for (const [value, w] of samples) if (Number.isFinite(value) && w > 0) { sum += value * w; weight += w; }
  return weight > 0 ? sum / weight : 0;
}

/** Maillage : positions (km), normales, uv, indices des triangles. */
export interface Mesh { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array }

/**
 * Sphère en relief : `cols` × `rows` cellules (720 × 360 = un demi-degré, ≈ 15 km à l'équateur), une colonne de
 * sommets doublée sur l'antiméridien pour la texture. Triangles dans le sens direct vus de l'extérieur.
 */
export function buildMarsMesh(m: Mosaic, cols = 720, rows = 360, exaggeration = 1): Mesh {
  const nv = (cols + 1) * (rows + 1);
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
  for (let j = 0; j <= rows; j++) {
    const lat = 90 - (j / rows) * 180, phi = (lat * Math.PI) / 180;
    for (let i = 0; i <= cols; i++) {
      const lon = -180 + (i / cols) * 360, lam = (lon * Math.PI) / 180;
      const r = MARS_RADIUS_KM + (sampleMosaic(m, lon, lat) / 1000) * exaggeration;
      const k = j * (cols + 1) + i;
      // Y vers le nord ; longitude 0 face à +X, longitudes est vers −Z (repère direct).
      positions[k * 3] = r * Math.cos(phi) * Math.cos(lam);
      positions[k * 3 + 1] = r * Math.sin(phi);
      positions[k * 3 + 2] = -r * Math.cos(phi) * Math.sin(lam);
      uvs[k * 2] = i / cols;
      uvs[k * 2 + 1] = j / rows;
    }
  }
  const indices = new Uint32Array(cols * rows * 6);
  let t = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    // Deux triangles par cellule (a en haut à gauche, c en bas à gauche).
    indices[t++] = a; indices[t++] = c; indices[t++] = b;
    indices[t++] = b; indices[t++] = c; indices[t++] = d;
  }
  // Normales : somme des normales des faces voisines (pondérées par leur aire), puis normalisées.
  for (let f = 0; f < indices.length; f += 3) {
    const ia = indices[f] * 3, ib = indices[f + 1] * 3, ic = indices[f + 2] * 3;
    const ux = positions[ib] - positions[ia], uy = positions[ib + 1] - positions[ia + 1], uz = positions[ib + 2] - positions[ia + 2];
    const vx = positions[ic] - positions[ia], vy = positions[ic + 1] - positions[ia + 1], vz = positions[ic + 2] - positions[ia + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const p of [ia, ib, ic]) { normals[p] += nx; normals[p + 1] += ny; normals[p + 2] += nz; }
  }
  for (let k = 0; k < nv; k++) {
    const x = normals[k * 3], y = normals[k * 3 + 1], z = normals[k * 3 + 2];
    let l = Math.hypot(x, y, z);
    // Sommet de pôle (triangles dégénérés) : la direction du centre.
    if (l < 1e-12) { const px = positions[k * 3], py = positions[k * 3 + 1], pz = positions[k * 3 + 2]; l = Math.hypot(px, py, pz); normals[k * 3] = px / l; normals[k * 3 + 1] = py / l; normals[k * 3 + 2] = pz / l; continue; }
    normals[k * 3] = x / l; normals[k * 3 + 1] = y / l; normals[k * 3 + 2] = z / l;
  }
  return { positions, normals, uvs, indices };
}

/** Bornes min/max d'un attribut à 3 composantes (exigées par glTF pour les positions). */
function bounds3(a: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], a[i + c]); max[c] = Math.max(max[c], a[i + c]); }
  return { min, max };
}

/**
 * Fichier glTF binaire (.glb, version 2) du maillage. Sans `textureJpeg` : matériau gris martien. Avec : l'image
 * JPEG (plate carrée, nord en haut) est intégrée au fichier et posée comme couleur de base du matériau.
 */
export function meshToGlb(mesh: Mesh, name = 'Mars — relief MOLA', extras: Record<string, unknown> = {}, textureJpeg?: Buffer): Buffer {
  // Blocs binaires, chacun aligné sur 4 octets (l'image, si elle existe, en dernier).
  const pad4 = (b: Buffer) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);
  const parts: Buffer[] = [mesh.positions, mesh.normals, mesh.uvs, mesh.indices].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  if (textureJpeg) parts.push(pad4(textureJpeg));
  let offset = 0;
  const views = parts.map((p, i) => {
    // Vue de l'image : sa longueur exacte, sans cible (ce n'est pas un attribut de sommet).
    const v: { buffer: number; byteOffset: number; byteLength: number; target?: number } = i === 4
      ? { buffer: 0, byteOffset: offset, byteLength: textureJpeg!.length }
      : { buffer: 0, byteOffset: offset, byteLength: p.length, target: i === 3 ? 34963 : 34962 };
    offset += p.length;
    return v;
  });
  const bin = Buffer.concat(parts);
  const nv = mesh.positions.length / 3;
  const { min, max } = bounds3(mesh.positions);
  const json = {
    asset: { version: '2.0', generator: 'Gobai — relief de Mars (MOLA, NASA/USGS)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }], extras }],
    materials: [textureJpeg
      ? { name: 'Mars réelle', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.95 } }
      : { name: 'Régolithe', pbrMetallicRoughness: { baseColorFactor: [0.55, 0.54, 0.52, 1], metallicFactor: 0, roughnessFactor: 0.95 } }],
    // Texture intégrée : image JPEG de la 5e vue, filtrage linéaire, répétition en longitude seulement.
    ...(textureJpeg ? {
      images: [{ bufferView: 4, mimeType: 'image/jpeg', name: 'mars-basecolor' }],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 }],
      textures: [{ sampler: 0, source: 0 }],
    } : {}),
    buffers: [{ byteLength: bin.length }],
    bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: nv, type: 'VEC2' },
      { bufferView: 3, componentType: 5125, count: mesh.indices.length, type: 'SCALAR' },
    ],
  };
  // Bloc JSON complété d'espaces jusqu'à un multiple de 4.
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);
  const binPad = bin.length % 4 ? Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]) : bin;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // « glTF »
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPad.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); // « JSON »
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binPad.length, 0); bh.writeUInt32LE(0x004e4942, 4); // « BIN »
  return Buffer.concat([header, jh, jsonBuf, bh, binPad]);
}
