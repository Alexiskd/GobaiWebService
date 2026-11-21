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

/**
 * Une pièce de plus dans le modèle, après l'astre : un maillage avec sa texture et sa matière (la surface des océans
 * de la Terre, par exemple). Dans Blender, chaque pièce devient un objet à part.
 */
export interface GlbPart {
  // name : son nom, celui de l'objet dans Blender.
  name: string;
  // mesh : son maillage.
  mesh: SphereMesh;
  // image : sa texture (facultative).
  image?: Buffer;
  // mimeType : le type de la texture (« image/jpeg » par défaut).
  mimeType?: string;
  // transparent : vrai si la transparence de la texture doit être gardée (mélange glTF « BLEND »).
  transparent?: boolean;
  // roughness : rugosité de la matière, de 0 (miroir) à 1 (mat, par défaut).
  roughness?: number;
  // color : couleur de base [r, g, b, a] (0 … 1) d'une pièce sans texture (gris par défaut).
  color?: [number, number, number, number];
  // emissive : lumière propre de la pièce : true = sa texture éclaire, ou une couleur [r, g, b] (0 … 1).
  emissive?: boolean | [number, number, number];
  // emissiveStrength : intensité de cette lumière (extension KHR_materials_emissive_strength, lue par Blender).
  emissiveStrength?: number;
// Fin de GlbPart.
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
  /** Pièces ajoutées après l'astre (objets à part dans Blender). */
  parts?: GlbPart[];
  /** Lumière propre de l'astre (le Soleil) : true = sa texture éclaire. */
  emissive?: boolean;
  /** Intensité de cette lumière. */
  emissiveStrength?: number;
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

/** Écrit le modèle complet d'un astre au format GLB, avec ses pièces supplémentaires. */
export function buildGlb({ name, mesh, image, mimeType = 'image/jpeg', copyright, generator = 'Gobai Space', parts = [], emissive, emissiveStrength }: GlbOptions): Buffer {
  // Les morceaux binaires, dans l'ordre où ils seront rangés.
  const chunks: Buffer[] = [];
  // Les vues sur le tampon, décrites au fur et à mesure.
  const bufferViews: Record<string, number>[] = [];
  // Position d'écriture dans le tampon.
  let offset = 0;
  // Range un bloc d'octets et décrit sa vue ; `target` n'est donné que pour les attributs et les indices.
  const push = (data: Buffer, target?: number): number => {
    // Complément d'alignement sur quatre octets, exigé par glTF.
    const padding = pad4(offset);
    // Ajoute ce complément.
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    // La vue.
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) });
    // Les octets.
    chunks.push(data);
    // Avance la position d'écriture.
    offset += data.length;
    // Le rang de la vue.
    return bufferViews.length - 1;
  // Fin de push.
  };
  // bytes : les octets d'un tableau typé, sans copie.
  const bytes = (a: Float32Array | Uint32Array): Buffer => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  // Toutes les pièces : l'astre d'abord (matière mate, sous le nom « … — surface »), puis les pièces ajoutées.
  const all: Array<GlbPart & { material: string }> = [{ name, mesh, image, mimeType, emissive, emissiveStrength, material: `${name} — surface` }, ...parts.map((p) => ({ ...p, material: p.name }))];
  // Vrai dès qu'une matière emploie l'intensité de lumière propre (extension à déclarer).
  let strength = false;
  // Les listes de la description, remplies pièce par pièce.
  const accessors: Record<string, unknown>[] = [], meshes: Record<string, unknown>[] = [], materials: Record<string, unknown>[] = [];
  // Les nœuds, les images et les textures.
  const nodes: Record<string, unknown>[] = [], images: Record<string, unknown>[] = [], textures: Record<string, unknown>[] = [];
  // Pour chaque pièce (début).
  all.forEach((part, i) => {
    // Les quatre jeux de données du maillage : positions, normales, coordonnées de texture et indices.
    const vPos = push(bytes(part.mesh.positions), ARRAY_BUFFER), vNrm = push(bytes(part.mesh.normals), ARRAY_BUFFER);
    // Coordonnées de texture et indices.
    const vUv = push(bytes(part.mesh.uvs), ARRAY_BUFFER), vIdx = push(bytes(part.mesh.indices), ELEMENT_ARRAY_BUFFER);
    // Bornes des positions.
    const { min, max } = bounds(part.mesh.positions);
    // Rang du premier accesseur de la pièce.
    const a = accessors.length;
    // Ses quatre accesseurs.
    accessors.push(
      // Positions, avec leurs bornes.
      { bufferView: vPos, componentType: FLOAT, count: part.mesh.vertexCount, type: 'VEC3', min, max },
      // Normales.
      { bufferView: vNrm, componentType: FLOAT, count: part.mesh.vertexCount, type: 'VEC3' },
      // Coordonnées de texture.
      { bufferView: vUv, componentType: FLOAT, count: part.mesh.vertexCount, type: 'VEC2' },
      // Indices des triangles.
      { bufferView: vIdx, componentType: UNSIGNED_INT, count: part.mesh.indices.length, type: 'SCALAR' },
    // Fin des accesseurs.
    );
    // Sa texture, si elle a une image : l'image, puis la texture qui l'échantillonne.
    const tex = part.image && part.image.length ? (images.push({ bufferView: push(part.image), mimeType: part.mimeType ?? 'image/jpeg', name: `${part.name} — texture` }), textures.push({ sampler: 0, source: images.length - 1 }) - 1) : null;
    // Sa matière : ni métallique, rugosité donnée (mate par défaut), texture ou gris.
    materials.push({
      // Son nom.
      name: part.material,
      // Couleur, métal et rugosité.
      pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: part.roughness ?? 1, ...(tex !== null ? { baseColorTexture: { index: tex } } : { baseColorFactor: part.color ?? [0.6, 0.6, 0.6, 1] }) },
      // Transparence gardée si demandé.
      ...(part.transparent ? { alphaMode: 'BLEND' } : {}),
      // Lumière propre : la texture éclaire (facteur blanc), ou une couleur donnée.
      ...(part.emissive === true && tex !== null ? { emissiveTexture: { index: tex }, emissiveFactor: [1, 1, 1] } : Array.isArray(part.emissive) ? { emissiveFactor: part.emissive } : {}),
      // Intensité de cette lumière, par l'extension KHR_materials_emissive_strength (notée pour la déclarer).
      ...(part.emissive && part.emissiveStrength ? ((strength = true), { extensions: { KHR_materials_emissive_strength: { emissiveStrength: part.emissiveStrength } } }) : {}),
    // Fin de la matière.
    });
    // Son maillage : un seul morceau, avec ses attributs, ses indices et sa matière.
    meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1, TEXCOORD_0: a + 2 }, indices: a + 3, material: i }] });
    // Son nœud, qui porte son nom.
    nodes.push({ mesh: i, name: part.name });
  // Fin des pièces.
  });
  // La description du modèle.
  const gltf: Record<string, unknown> = {
    // Version, outil et mention d'origine.
    asset: { version: '2.0', generator, ...(copyright ? { copyright } : {}) },
    // Une scène, avec tous les nœuds.
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }],
    // Les nœuds, les maillages, les matières et les accesseurs.
    nodes, meshes, materials, accessors,
    // Les vues et le tampon unique.
    bufferViews, buffers: [{ byteLength: offset }],
  // Fin de la description.
  };
  // Extension d'intensité de lumière propre employée : déclarée.
  if (strength) gltf.extensionsUsed = ['KHR_materials_emissive_strength'];
  // Les textures, quand il y a des images (début).
  if (images.length) {
    // Les images et les textures.
    gltf.images = images; gltf.textures = textures;
    // Filtrage linéaire, répétition en longitude, bord tenu en latitude.
    gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 }];
  // Fin des textures.
  }
  // Le morceau JSON, complété par des espaces.
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = Buffer.alloc(pad4(json.length), 0x20);
  // Le morceau binaire, complété par des zéros.
  const bin = Buffer.concat(chunks);
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
