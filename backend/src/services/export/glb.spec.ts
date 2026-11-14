// Fonctions testées : l'écriture d'un modèle 3D au format GLB.
import { buildGlb, readGlb, sphereMesh, textureV } from './glb';

// Groupe de tests.
describe('glb', () => {
  /** Rayon moyen de Mars, en kilomètres. */
  const MARS_KM = 3389.5;

  // Test : le maillage.
  it('construit une sphère aux bonnes dimensions, fermée en longitude', () => {
    // Un maillage grossier, facile à compter.
    const mesh = sphereMesh(MARS_KM, 4, 8);
    // Une colonne et une rangée de plus, pour que la texture se referme proprement.
    expect(mesh.vertexCount).toBe(9 * 5);
    expect(mesh.positions).toHaveLength(mesh.vertexCount * 3);
    expect(mesh.uvs).toHaveLength(mesh.vertexCount * 2);
    // Les triangles dégénérés des pôles ne sont pas écrits.
    expect(mesh.triangleCount).toBe(4 * 8 * 2 - 8 * 2);
    expect(mesh.indices).toHaveLength(mesh.triangleCount * 3);
    // Chaque sommet est à la bonne distance du centre, et sa normale est unitaire.
    for (let i = 0; i < mesh.vertexCount; i++) {
      const r = Math.hypot(mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2]);
      expect(r).toBeCloseTo(MARS_KM, 3);
      expect(Math.hypot(mesh.normals[3 * i], mesh.normals[3 * i + 1], mesh.normals[3 * i + 2])).toBeCloseTo(1, 6);
    }
    // Aucun indice ne sort du tableau des sommets.
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.vertexCount);
  // Fin du test.
  });

  // Test : les coordonnées de texture.
  it('pose la texture en projection équirectangulaire, pôle nord en haut', () => {
    // Un maillage.
    const mesh = sphereMesh(1, 4, 8);
    // Le premier sommet est au pôle nord : v = 0 et y maximal.
    expect(mesh.uvs[1]).toBe(0);
    expect(mesh.positions[1]).toBeCloseTo(1, 6);
    // Le dernier est au pôle sud : v = 1 et y minimal.
    const last = mesh.vertexCount - 1;
    expect(mesh.uvs[2 * last + 1]).toBe(1);
    expect(mesh.positions[3 * last + 1]).toBeCloseTo(-1, 6);
    // Les deux bords en longitude se superposent : u = 0 et u = 1 au même endroit de la sphère.
    const cols = 9;
    for (let y = 0; y <= 4; y++) {
      const a = y * cols, b = y * cols + 8;
      expect(mesh.uvs[2 * a]).toBe(0);
      expect(mesh.uvs[2 * b]).toBe(1);
      for (let c = 0; c < 3; c++) expect(mesh.positions[3 * b + c]).toBeCloseTo(mesh.positions[3 * a + c], 5);
    }
  // Fin du test.
  });

  // Test : le découpage Mercator de la texture.
  it('pose une mosaïque Web Mercator sans la reprojeter', () => {
    // À l'équateur, les deux découpages donnent le milieu de l'image.
    expect(textureV(0, 'mercator')).toBeCloseTo(0.5, 12);
    expect(textureV(0, 'equirectangular')).toBeCloseTo(0.5, 12);
    // À 45° nord, Mercator place le parallèle plus bas sur l'image (v plus grand) que l'équirectangulaire :
    // la feuille Mercator s'arrête à 85° et gonfle les hautes latitudes, qui occupent le haut de l'image.
    const lat45 = Math.PI / 4;
    expect(textureV(lat45, 'mercator')).toBeCloseTo(0.3597, 4);
    expect(textureV(lat45, 'equirectangular')).toBeCloseTo(0.25, 12);
    expect(textureV(lat45, 'mercator')).toBeGreaterThan(textureV(lat45, 'equirectangular'));
    // Les pôles sortent de la projection Mercator : v est borné à l'image, pas renvoyé à l'infini.
    expect(textureV(Math.PI / 2, 'mercator')).toBeGreaterThanOrEqual(0);
    expect(textureV(-Math.PI / 2, 'mercator')).toBeLessThanOrEqual(1);
    // Et le maillage produit reste dans l'image.
    const mesh = sphereMesh(1, 16, 32, 0, 'mercator');
    for (let i = 1; i < mesh.uvs.length; i += 2) {
      expect(mesh.uvs[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.uvs[i]).toBeLessThanOrEqual(1);
    }
  // Fin du test.
  });

  // Test : l'aplatissement.
  it('aplatit le sphéroïde quand on le demande', () => {
    // Saturne est aplatie d'environ 10 %.
    const mesh = sphereMesh(60_268, 8, 16, 0.098);
    // Le pôle est plus près du centre que l'équateur.
    expect(mesh.positions[1]).toBeCloseTo(60_268 * (1 - 0.098), 0);
    // Un aplatissement impossible est refusé.
    expect(() => sphereMesh(1, 8, 16, 1)).toThrow(RangeError);
    expect(() => sphereMesh(-1, 8, 16)).toThrow(RangeError);
    expect(() => sphereMesh(1, 1, 16)).toThrow(RangeError);
  // Fin du test.
  });

  // Test : le conteneur.
  it('écrit un conteneur GLB relisible, aligné sur quatre octets', () => {
    // Un modèle avec une fausse image de texture.
    const image = Buffer.from('une-image-de-test-dont-la-longueur-n-est-pas-un-multiple-de-quatre');
    const file = buildGlb({ name: 'Mars', mesh: sphereMesh(MARS_KM, 16, 32), image, copyright: 'IGN, NASA' });
    // Relu : version 2, longueur annoncée exacte.
    const { version, length, json, bin } = readGlb(file);
    expect(version).toBe(2);
    expect(length).toBe(file.length);
    // La longueur totale est un multiple de quatre, comme l'exige la norme.
    expect(file.length % 4).toBe(0);
    // La description porte la version de glTF et la mention d'origine.
    expect((json.asset as Record<string, string>).version).toBe('2.0');
    expect((json.asset as Record<string, string>).copyright).toBe('IGN, NASA');
    // Une scène, un nœud, un maillage, un matériau.
    expect(json.scene).toBe(0);
    expect(json.nodes).toHaveLength(1);
    expect(json.meshes).toHaveLength(1);
    expect(json.materials).toHaveLength(1);
  // Fin du test.
  });

  // Test : les accesseurs et les vues.
  it('décrit des accesseurs cohérents avec les données binaires', () => {
    // Un modèle.
    const mesh = sphereMesh(MARS_KM, 16, 32);
    const file = buildGlb({ name: 'Mars', mesh, image: Buffer.from([1, 2, 3]) });
    const { json, bin } = readGlb(file);
    // Les accesseurs et les vues.
    const accessors = json.accessors as Record<string, number>[];
    const views = json.bufferViews as Record<string, number>[];
    // Positions, normales, coordonnées de texture : autant d'éléments que de sommets.
    expect(accessors[0].count).toBe(mesh.vertexCount);
    expect(accessors[1].count).toBe(mesh.vertexCount);
    expect(accessors[2].count).toBe(mesh.vertexCount);
    // Indices : autant que d'entrées du tableau.
    expect(accessors[3].count).toBe(mesh.indices.length);
    // Chaque vue est alignée sur quatre octets et tient dans le tampon.
    for (const v of views) {
      expect(v.byteOffset % 4).toBe(0);
      expect(v.byteOffset + v.byteLength).toBeLessThan(bin.length + 1);
    }
    // Le tampon déclaré correspond au binaire écrit, au complément d'alignement près.
    const declared = (json.buffers as Record<string, number>[])[0].byteLength;
    expect(bin.length - declared).toBeLessThan(4);
    // Les bornes des positions encadrent la sphère.
    const min = accessors[0].min as unknown as number[];
    const max = accessors[0].max as unknown as number[];
    for (let c = 0; c < 3; c++) {
      expect(min[c]).toBeCloseTo(-MARS_KM, 0);
      expect(max[c]).toBeCloseTo(MARS_KM, 0);
    }
  // Fin du test.
  });

  // Test : la texture.
  it('range l’image de la texture telle quelle, et s’en passe sans elle', () => {
    // Une image reconnaissable.
    const image = Buffer.from('IMAGE-JPEG-DE-TEST');
    const mesh = sphereMesh(1, 8, 16);
    // Avec image.
    const { json, bin } = readGlb(buildGlb({ name: 'Terre', mesh, image, mimeType: 'image/jpeg' }));
    // L'image est déclarée avec son type.
    expect((json.images as Record<string, string>[])[0].mimeType).toBe('image/jpeg');
    expect(json.textures).toHaveLength(1);
    expect(json.samplers).toHaveLength(1);
    // Et ses octets se retrouvent intacts dans le binaire.
    const view = (json.bufferViews as Record<string, number>[])[(json.images as Record<string, number>[])[0].bufferView];
    expect(bin.subarray(view.byteOffset, view.byteOffset + view.byteLength).toString()).toBe('IMAGE-JPEG-DE-TEST');
    // Sans image : pas de texture déclarée, mais une couleur de base.
    const sans = readGlb(buildGlb({ name: 'Terre', mesh })).json;
    expect(sans.images).toBeUndefined();
    expect(sans.textures).toBeUndefined();
    const material = (sans.materials as Record<string, Record<string, unknown>>[])[0];
    expect(material.pbrMetallicRoughness.baseColorFactor).toBeTruthy();
  // Fin du test.
  });

  // Test : les fichiers refusés.
  it('refuse de relire ce qui n’est pas un GLB', () => {
    // Trop court, mauvaise magie, longueur fausse.
    expect(() => readGlb(Buffer.alloc(8))).toThrow(/tronqué/);
    expect(() => readGlb(Buffer.alloc(40))).toThrow(/pas un fichier GLB/);
    const file = buildGlb({ name: 'Mars', mesh: sphereMesh(1, 4, 8) });
    const abimé = Buffer.from(file);
    abimé.writeUInt32LE(file.length + 4, 8);
    expect(() => readGlb(abimé)).toThrow(/Longueur annoncée/);
  // Fin du test.
  });
// Fin du groupe.
});
