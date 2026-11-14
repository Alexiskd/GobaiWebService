/**
 * Écriture d'un modèle 3D au format GLB (glTF 2.0 binaire), sans dépendance.
 *
 * Un GLB est un en-tête de douze octets suivi de deux morceaux : la description du modèle en JSON, puis les
 * données binaires (sommets, indices, image de la texture). Tout tient dans un seul fichier, que Blender,
 * three.js, Windows 3D Viewer ou un visualiseur en ligne ouvrent directement.
 *
 *   en-tête   « glTF », version 2, longueur totale            (3 × 4 octets, petit-boutiste)
 *   morceau 1 longueur, « JSON », la description, complétée par des espaces jusqu'à un multiple de 4
 *   morceau 2 longueur, « BIN\0 », les données, complétées par des zéros jusqu'à un multiple de 4
 *
 * Le modèle produit est un astre entier : une sphère (aplatie si on lui donne un aplatissement) dont la texture
 * est l'image fournie, en projection équirectangulaire. Les coordonnées sont en **kilomètres réels** : un
 * modèle de Mars mesure 3 390 unités de rayon, ce qui permet de mesurer dessus.
 */

/** Magie « glTF », en petit-boutiste. */
const MAGIC = 0x46546c67;
/** Version du conteneur. */
const VERSION = 2;
/** Type du morceau JSON (« JSON »). */
const CHUNK_JSON = 0x4e4f534a;
/** Type du morceau binaire (« BIN\0 »). */
const CHUNK_BIN = 0x004e4942;

/** Constantes glTF employées : types de composants et cibles de tampon. */
const FLOAT = 5126;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/** Découpage de la texture posée sur la sphère. */
export type TextureProjection = 'equirectangular' | 'mercator';

/**
 * Latitude maximale de la projection Web Mercator, en radians : celle où l'ordonnée projetée atteint π, ce qui
 * rend la carte carrée. Calculée plutôt qu'écrite en dur (85,051 129°), pour que la borne tombe exactement sur
 * le bord de l'image.
 */
const MERCATOR_MAX_LAT = 2 * Math.atan(Math.exp(Math.PI)) - Math.PI / 2;

/** Ramène une valeur dans l'intervalle [0, 1]. */
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Coordonnée verticale de texture d'une latitude, selon le découpage. Toujours dans [0, 1]. */
export function textureV(latitude: number, projection: TextureProjection): number {
  // Équirectangulaire : la latitude est proportionnelle à v, du pôle nord (0) au pôle sud (1).
  if (projection === 'equirectangular') return clamp01(0.5 - latitude / Math.PI);
  // Mercator : la latitude est bornée à ce que la projection sait représenter.
  const lat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, latitude));
  // v = 0,5 − ln(tan(π/4 + φ/2)) / 2π, le haut de la carte étant le nord.
  return clamp01(0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI));
// Fin de textureV.
}

/** Un maillage de sphère : sommets, normales, coordonnées de texture et indices des triangles. */
export interface SphereMesh {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  /** Nombre de sommets. */
  vertexCount: number;
  /** Nombre de triangles. */
  triangleCount: number;
}

/**
 * Sphère (ou sphéroïde aplati) en projection équirectangulaire, prête à recevoir une carte du monde.
 *
 * `rings` bandes de latitude et `segments` bandes de longitude ; la colonne de longitude est répétée aux deux
 * bords pour que la couture de la texture soit nette. Convention des coordonnées de texture : u = 0 au méridien
 * 180° ouest, u = 1 au méridien 180° est, v = 0 au pôle nord, v = 1 au pôle sud — celle de toutes les cartes
 * équirectangulaires. L'axe +Y est l'axe de rotation, comme l'attend glTF.
 *
 * @param radiusKm rayon équatorial, en kilomètres
 * @param rings nombre de bandes de latitude
 * @param segments nombre de bandes de longitude
 * @param flattening aplatissement (rayon polaire = équatorial × (1 − f)) ; 0 pour une sphère
 * @param projection découpage de la texture : `equirectangular` (latitude proportionnelle à v) ou `mercator`
 *   (v suit la projection Web Mercator, pour poser directement une mosaïque de tuiles XYZ sans la reprojeter ;
 *   au-delà de 85,05° la projection ne va pas, les derniers pixels sont étirés sur les calottes)
 */
export function sphereMesh(radiusKm: number, rings = 64, segments = 128, flattening = 0, projection: TextureProjection = 'equirectangular'): SphereMesh {
  // Contrôles : une sphère a besoin d'au moins deux bandes dans chaque sens.
  if (!(radiusKm > 0) || !Number.isFinite(radiusKm)) throw new RangeError('Le rayon doit être un nombre positif.');
  if (!Number.isInteger(rings) || rings < 2 || !Number.isInteger(segments) || segments < 3) throw new RangeError('Maillage trop grossier.');
  if (!(flattening >= 0) || flattening >= 1) throw new RangeError('L’aplatissement doit être compris entre 0 et 1.');
  // Rayon polaire.
  const polar = radiusKm * (1 - flattening);
  // Nombre de sommets : une colonne et une rangée de plus, pour fermer la texture.
  const cols = segments + 1;
  const rows = rings + 1;
  const vertexCount = cols * rows;
  // Les tableaux de sortie.
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(rings * segments * 6);
  // Parcourt les rangées, du pôle nord au pôle sud.
  for (let y = 0; y < rows; y++) {
    // Coordonnée de texture verticale, et angle depuis le pôle nord.
    const v = y / rings;
    const theta = v * Math.PI;
    const st = Math.sin(theta), ct = Math.cos(theta);
    // Parcourt les colonnes.
    for (let x = 0; x < cols; x++) {
      // Coordonnée de texture horizontale, et longitude.
      const u = x / segments;
      const phi = u * 2 * Math.PI;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      // Rang du sommet.
      const i = y * cols + x;
      // Direction du sommet sur la sphère unité.
      const dx = -st * cp, dy = ct, dz = st * sp;
      // Position, en kilomètres, aplatissement appliqué sur l'axe de rotation.
      positions[3 * i] = dx * radiusKm;
      positions[3 * i + 1] = dy * polar;
      positions[3 * i + 2] = dz * radiusKm;
      // Normale : perpendiculaire à la surface du sphéroïde, donc redressée par l'aplatissement.
      const nx = dx / radiusKm, ny = dy / polar, nz = dz / radiusKm;
      const n = Math.hypot(nx, ny, nz) || 1;
      normals[3 * i] = nx / n;
      normals[3 * i + 1] = ny / n;
      normals[3 * i + 2] = nz / n;
      // Coordonnées de texture : u suit la longitude, v suit le découpage demandé.
      uvs[2 * i] = u;
      uvs[2 * i + 1] = textureV(Math.PI / 2 - theta, projection);
    // Fin des colonnes.
    }
  // Fin des rangées.
  }
  // Deux triangles par case du quadrillage, sans triangle dégénéré aux pôles.
  let k = 0;
  // Parcourt les cases.
  for (let y = 0; y < rings; y++) {
    // Chaque colonne.
    for (let x = 0; x < segments; x++) {
      // Les quatre coins de la case.
      const a = y * cols + x;
      const b = a + cols;
      // Premier triangle, sauf contre le pôle nord où il serait plat.
      if (y !== 0) { indices[k++] = a; indices[k++] = b; indices[k++] = a + 1; }
      // Second triangle, sauf contre le pôle sud.
      if (y !== rings - 1) { indices[k++] = b; indices[k++] = b + 1; indices[k++] = a + 1; }
    // Fin des colonnes.
    }
  // Fin des rangées.
  }
  // Le maillage, les indices ramenés au nombre réellement écrit.
  const used = indices.subarray(0, k);
  // Le résultat.
  return { positions, normals, uvs, indices: new Uint32Array(used), vertexCount, triangleCount: k / 3 };
// Fin de sphereMesh.
}

/** Ce qu'il faut pour écrire un modèle. */
export interface GlbOptions {
  /** Nom de l'astre, inscrit dans le modèle. */
  name: string;
  /** Le maillage. */
  mesh: SphereMesh;
  /** Image de la texture, en projection équirectangulaire. */
  image?: Buffer;
  /** Type de l'image (« image/jpeg » ou « image/png »). */
  mimeType?: string;
  /** Mention d'origine et de licence, inscrite dans le fichier. */
  copyright?: string;
  /** Outil générateur, inscrit dans le fichier. */
  generator?: string;
}

/** Minimum et maximum de chaque composante : glTF les exige sur l'accesseur des positions. */
function bounds(positions: Float32Array): { min: number[]; max: number[] } {
  // Départ aux extrêmes opposés.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  // Parcourt les sommets.
  for (let i = 0; i < positions.length; i += 3) {
    // Chaque composante.
    for (let c = 0; c < 3; c++) {
      // Le plus petit et le plus grand.
      if (positions[i + c] < min[c]) min[c] = positions[i + c];
      if (positions[i + c] > max[c]) max[c] = positions[i + c];
    // Fin des composantes.
    }
  // Fin des sommets.
  }
  // Les bornes.
  return { min, max };
// Fin de bounds.
}

/** Complète une longueur jusqu'au prochain multiple de quatre. */
const pad4 = (n: number): number => (4 - (n % 4)) % 4;

/** Écrit le modèle complet d'un astre au format GLB. */
export function buildGlb({ name, mesh, image, mimeType = 'image/jpeg', copyright, generator = 'Gobai Space' }: GlbOptions): Buffer {
  // Les morceaux binaires, dans l'ordre où ils seront rangés.
  const parts: Buffer[] = [];
  // Les vues sur le tampon, décrites au fur et à mesure.
  const bufferViews: Record<string, number>[] = [];
  // Position d'écriture dans le tampon.
  let offset = 0;
  // Range un bloc d'octets et décrit sa vue ; `target` n'est donné que pour les attributs et les indices.
  const push = (data: Buffer, target?: number): number => {
    // Complément d'alignement sur quatre octets, exigé par glTF.
    const padding = pad4(offset);
    // Ajoute ce complément.
    if (padding) { parts.push(Buffer.alloc(padding)); offset += padding; }
    // La vue.
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) });
    // Les octets.
    parts.push(data);
    offset += data.length;
    // Le rang de la vue.
    return bufferViews.length - 1;
  // Fin de push.
  };
  // Les quatre jeux de données du maillage.
  const vPos = push(Buffer.from(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength), ARRAY_BUFFER);
  const vNrm = push(Buffer.from(mesh.normals.buffer, mesh.normals.byteOffset, mesh.normals.byteLength), ARRAY_BUFFER);
  const vUv = push(Buffer.from(mesh.uvs.buffer, mesh.uvs.byteOffset, mesh.uvs.byteLength), ARRAY_BUFFER);
  const vIdx = push(Buffer.from(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength), ELEMENT_ARRAY_BUFFER);
  // L'image de la texture, s'il y en a une.
  const vImg = image && image.length ? push(image) : null;
  // Bornes des positions.
  const { min, max } = bounds(mesh.positions);
  // La description du modèle.
  const gltf: Record<string, unknown> = {
    asset: { version: '2.0', generator, ...(copyright ? { copyright } : {}) },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{
      name,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      }],
    }],
    materials: [{
      name: `${name} — surface`,
      // Surface mate : une carte planétaire n'est ni métallique ni brillante.
      pbrMetallicRoughness: {
        metallicFactor: 0,
        roughnessFactor: 1,
        ...(vImg !== null ? { baseColorTexture: { index: 0 } } : { baseColorFactor: [0.6, 0.6, 0.6, 1] }),
      },
    }],
    accessors: [
      { bufferView: vPos, componentType: FLOAT, count: mesh.vertexCount, type: 'VEC3', min, max },
      { bufferView: vNrm, componentType: FLOAT, count: mesh.vertexCount, type: 'VEC3' },
      { bufferView: vUv, componentType: FLOAT, count: mesh.vertexCount, type: 'VEC2' },
      { bufferView: vIdx, componentType: UNSIGNED_INT, count: mesh.indices.length, type: 'SCALAR' },
    ],
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  // La texture, quand l'image existe.
  if (vImg !== null) {
    // L'image, son échantillonnage et la texture qui les réunit.
    gltf.images = [{ bufferView: vImg, mimeType, name: `${name} — texture` }];
    // Filtrage linéaire, répétition en longitude, bord tenu en latitude.
    gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 }];
    gltf.textures = [{ sampler: 0, source: 0 }];
  // Fin de la texture.
  }
  // Le morceau JSON, complété par des espaces.
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = Buffer.alloc(pad4(json.length), 0x20);
  // Le morceau binaire, complété par des zéros.
  const bin = Buffer.concat(parts);
  const binPad = Buffer.alloc(pad4(bin.length), 0);
  // Longueur totale : en-tête, puis chaque morceau avec ses huit octets de description.
  const total = 12 + 8 + json.length + jsonPad.length + 8 + bin.length + binPad.length;
  // L'en-tête.
  const header = Buffer.alloc(12);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(VERSION, 4);
  header.writeUInt32LE(total, 8);
  // La description de chaque morceau.
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(json.length + jsonPad.length, 0);
  jsonHead.writeUInt32LE(CHUNK_JSON, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length + binPad.length, 0);
  binHead.writeUInt32LE(CHUNK_BIN, 4);
  // Le fichier complet.
  return Buffer.concat([header, jsonHead, json, jsonPad, binHead, bin, binPad]);
// Fin de buildGlb.
}

/** Relit l'en-tête et les morceaux d'un GLB : sert aux tests et à la vérification d'un fichier produit. */
export function readGlb(file: Buffer): { version: number; length: number; json: Record<string, unknown>; bin: Buffer } {
  // Taille minimale : l'en-tête et la description du premier morceau.
  if (file.length < 20) throw new Error('Fichier GLB tronqué.');
  // Magie et version.
  if (file.readUInt32LE(0) !== MAGIC) throw new Error('Ce n’est pas un fichier GLB.');
  const version = file.readUInt32LE(4);
  const length = file.readUInt32LE(8);
  // Longueur annoncée conforme.
  if (length !== file.length) throw new Error('Longueur annoncée différente de la taille du fichier.');
  // Le morceau JSON.
  const jsonLength = file.readUInt32LE(12);
  if (file.readUInt32LE(16) !== CHUNK_JSON) throw new Error('Premier morceau : JSON attendu.');
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
  // Le morceau binaire, s'il existe.
  const binStart = 20 + jsonLength;
  // Pas de second morceau.
  if (binStart >= file.length) return { version, length, json, bin: Buffer.alloc(0) };
  // Sa longueur et son type.
  const binLength = file.readUInt32LE(binStart);
  if (file.readUInt32LE(binStart + 4) !== CHUNK_BIN) throw new Error('Second morceau : binaire attendu.');
  // Le tout.
  return { version, length, json, bin: file.subarray(binStart + 8, binStart + 8 + binLength) };
// Fin de readGlb.
}
