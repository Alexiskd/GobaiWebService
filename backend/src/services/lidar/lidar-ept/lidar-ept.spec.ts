// Ce qui est testé : les fonctions pures des nuages EPT du LiDAR HD de l'IGN (dalles de la visionneuse officielle).
import {
  EPT_TILE_DEPTH, EptCell, IGN_EPT_VPC_URL, cellBounds, cellsInBox, eptBase, eptCellKey, eptDataUrl, eptDalleId, eptHierarchyUrl, eptTileId, inCell, parseEptInfo, parseEptLazHeader, parseEptHierarchy, parseEptKey, parseEptTileId, parseVpc, rekeyToEpt, rekeyToTile,
} from './lidar-ept';

/** Une entrée d'index : deux dalles avec leur ept.json, leur emprise Lambert-93 et leurs points. */
// vpc : la réponse JSON de l'index.
function vpc() {
  // Une dalle vue.
  const dalle = (code: string, url: string, bbox: number[], points: number) => ({
    // Ses attributs et son adresse.
    properties: { 'proj:bbox': bbox, 'pc:count': points }, assets: { data: { href: url } },
  // Fin de la dalle.
  });
  // Renvoie l'index.
  return {
    // Deux entités, une avec une adresse qui n'est pas un ept.json.
    features: [
      dalle('KE', 'https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/KE_EPT/ept.json', [635999, 6832999, -8, 686001, 6883001, 355], 49969377243),
      dalle('AE', 'https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/AE_EPT/ept.json', [97999, 6829001, -8, 186000, 6874763, 315], 38911347809),
      { properties: { 'proj:bbox': [0, 0, 0, 1, 1, 1] }, assets: { data: { href: 'https://data.geopf.fr/autre.json' } } },
    // Fin des entités.
    ],
  // Fin de l'index.
  };
}

/** Un ept.json de dalle : cube de 50 km, emprise réelle, schéma X, Y, Z. */
// eptJson : le fichier de la dalle.
function eptJson() {
  // Le cube racine, 50 002 m de côté.
  const bounds = [635999, 6832999, -24827, 686001, 6883001, 25175];
  // Renvoie le fichier avec ses six entrées de schéma.
  return {
    // Cube, emprise réelle, écart de la grille et points.
    bounds, boundsConforming: [635999, 6832999, -8, 686001, 6883001, 355], span: 128, points: 49969377243,
    // Les entrées du schéma.
    schema: [
      { name: 'X', scale: 0.01, offset: 661000 }, { name: 'Y', scale: 0.01, offset: 6858000 }, { name: 'Z', scale: 0.01, offset: 174 },
      { name: 'Intensity', size: 2, type: 'unsigned' }, { name: 'Classification', size: 1, type: 'unsigned' },
    // Fin des entrées.
    ],
  // Fin du fichier.
  };
}

/** Le cube racine d'une dalle, 50 002 m de côté ; côté d'une cellule de niveau 6 : 781,28 m. */
// sideOf : le ept.json et le niveau.
const cellSide = (info: ReturnType<typeof parseEptInfo>, d: number): number => (info.bounds[3] - info.bounds[0]) / 2 ** d;

// L'adresse de l'index : celle de la visionneuse de l'IGN.
test('index EPT : l’adresse de la visionneuse de l’IGN', () => {
  // Vérifie le modèle d'adresse.
  expect(IGN_EPT_VPC_URL).toBe('https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/vpc-128/index.vpc');
// Fin du test.
});

// Les dalles lues dans l'index : identifiant court, adresse de base, emprise et points.
test('index EPT : dalles lues dans la réponse', () => {
  // Les dalles.
  const dalles = parseVpc(vpc());
  // Deux dalles, la troisième adresse n'en est pas une.
  expect(dalles).toHaveLength(2);
  // La première : identifiant, code, adresses et points.
  expect(dalles[0]).toMatchObject({ id: 'ept-ke', code: 'ke', eptUrl: 'https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/KE_EPT/ept.json', base: 'https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/KE_EPT', points: 49969377243 });
  // Son emprise Lambert-93.
  expect(dalles[0].bbox).toEqual([635999, 6832999, -8, 686001, 6883001, 355]);
  // La base est l'adresse sans le ept.json final.
  expect(eptBase(dalles[0].eptUrl)).toBe(dalles[0].base);
// Fin du test.
});

// L'identifiant d'une dalle selon son adresse : les 168 dalles suivent la forme « XX_EPT ».
test('identifiant d’une dalle : la forme XX_EPT', () => {
  // Identifié.
  expect(eptDalleId('https://data.geopf.fr/lidarhd_fxx_ept/KE_EPT/ept.json')).toBe('ept-ke');
  // Autre forme : null.
  expect(eptDalleId('https://data.geopf.fr/KE/ept.json')).toBeNull();
// Fin du test.
});

// Le ept.json : cube racine, emprise réelle, écart de la grille et coordonnées.
test('ept.json : cube, emprise réelle, schéma', () => {
  // Les informations.
  const info = parseEptInfo(eptJson());
  // Le cube et l'emprise réelle.
  expect(info.bounds[3] - info.bounds[0]).toBeCloseTo(50002, 5);
  expect(info.conforming[5]).toBe(355);
  // L'écart de la grille et les points.
  expect(info.span).toBe(128); expect(info.points).toBe(49969377243);
  // L'échelle et le décalage des axes.
  expect(info.scale).toEqual([0.01, 0.01, 0.01]); expect(info.offset).toEqual([661000, 6858000, 174]);
// Fin du test.
});

// Les adresses d'une dalle : hiérarchie et nuages des nœuds.
test('adresses EPT : hiérarchie et nœuds', () => {
  // La hiérarchie d'une clé.
  expect(eptHierarchyUrl('https://x/KE_EPT', '6-0-0-31')).toBe('https://x/KE_EPT/ept-hierarchy/6-0-0-31.json');
  // Le nuage d'une clé.
  expect(eptDataUrl('https://x/KE_EPT', '6-0-0-31')).toBe('https://x/KE_EPT/ept-data/6-0-0-31.laz');
// Fin du test.
});

// Les pages de la hiérarchie : clés octree et nombres ; les clés d'une autre forme, ou des nombres non entiers, sortent.
test('hiérarchie EPT : entrées lues dans une page', () => {
  // La page : trois nœuds, une suite d'arbre, deux entrées illisibles.
  const json = { '6-0-0-31': 46994, '10-0-0-510': 39126, '11-1-1-1021': 155, '7-2-3-4': -1, 'autre': 5, '8-0-0': 3, '9-0-0-5': 1.5 };
  // Les entrées.
  const entries = parseEptHierarchy(json);
  // Quatre entrées gardées (la clé « autre », la clé sans z-index et le nombre non entier sortent).
  expect(entries).toHaveLength(4);
  // La première : clé, niveau, indices et points.
  expect(entries[0]).toMatchObject({ key: '6-0-0-31', level: 6, x: 0, y: 0, z: 31, count: 46994 });
  // La suite d'arbre : moins un point (le fichier de cette clé contient la suite).
  expect(entries.find((e) => e.key === '7-2-3-4')?.count).toBe(-1);
// Fin du test.
});

// L'identifiant d'une dalle du navigateur : une cellule de niveau 6, écrite et relue ; les identifiants COPC sortent.
test('identifiant d’une dalle du navigateur : écrit et relu', () => {
  // La cellule de niveau 6.
  const cell: EptCell = { d: EPT_TILE_DEPTH, x: 27, y: 43, z: 31 };
  // Son identifiant écrit.
  const id = eptTileId('ke', cell);
  // La forme attendue.
  expect(id).toBe('ept-ke-6-27-43-31');
  // Relu : la dalle et la cellule.
  expect(parseEptTileId(id)).toEqual({ dalle: 'ept-ke', cell });
  // Un identifiant COPC et un niveau qui n'est pas 6 : hors EPT.
  expect(parseEptTileId('lhd-0652-6863')).toBeNull();
  expect(parseEptTileId('ept-ke-5-27-43-31')).toBeNull();
// Fin du test.
});

// Les cellules de niveau 6 d'une dalle qui touchent une emprise Lambert-93.
test('cellules EPT : dans une emprise Lambert-93', () => {
  // Les informations de la dalle.
  const info = parseEptInfo(eptJson());
  // Une emprise de 2 km de côté sur Paris, en Lambert-93.
  const cells = cellsInBox(info, [651000, 6859000, 653000, 6861000]);
  // Côté des cellules et cases de l'emprise : 2000 / 781,3, une case par direction au plus.
  expect(cells.length).toBeGreaterThan(0); expect(cells.length).toBeLessThanOrEqual(27);
  // Toutes au niveau 6.
  expect(cells.every((c) => c.d === EPT_TILE_DEPTH)).toBe(true);
  // Leurs emprises touchent la zone : une cellule dont le côté est 781,28 m.
  const side = cellSide(info, EPT_TILE_DEPTH);
  // La première : son emprise est un cube du bon côté.
  const [minX, minY, minZ, maxX, maxY] = cellBounds(info, cells[0]);
  expect(maxX - minX).toBeCloseTo(side, 5); expect(maxY - minY).toBeCloseTo(side, 5);
  // En Z, la hauteur réelle des points : les cellules restent près du sol du cube.
  expect(minZ).toBeGreaterThanOrEqual(info.bounds[2]);
// Fin du test.
});

// Le renumérotage des clés : un nœud de la dalle devient une clé du LidarEngine, et réciproquement.
test('clés : renumérotées depuis la cellule, dans les deux sens', () => {
  // Une cellule de niveau 6.
  const cell: EptCell = { d: 6, x: 27, y: 43, z: 31 };
  // La racine de la dalle : le nœud de la cellule.
  expect(rekeyToTile('6-27-43-31', cell)).toBe('0-0-0-0');
  // Un nœud de niveau 10, descendant direct.
  expect(rekeyToTile('10-109-174-127', cell)).toBe('4-1-2-3');
  // Un nœud hors de la cellule : null.
  expect(rekeyToTile('10-108-174-127', cell)).toBeNull();
  // Le retour : la clé d'origine.
  expect(rekeyToEpt('4-1-2-3', cell)).toBe('10-109-174-127');
  // La racine : la clé de la cellule.
  expect(rekeyToEpt('0-0-0-0', cell)).toBe('6-27-43-31');
// Fin du test.
});

// Un nœud est-il dans une cellule : elle-même ou un de ses descendants.
test('appartenance : la cellule et ses descendants', () => {
  // La cellule et un nœud descendant.
  expect(inCell({ d: 6, x: 27, y: 43, z: 31 }, parseEptKey('10-109-174-127')!)).toBe(true);
  // Un nœud du même niveau mais d'une autre colonne : non.
  expect(inCell({ d: 6, x: 27, y: 43, z: 31 }, parseEptKey('10-108-174-127')!)).toBe(false);
  // Un nœud au-dessus de la cellule : non.
  expect(inCell({ d: 6, x: 27, y: 43, z: 31 }, parseEptKey('5-13-21-15')!)).toBe(false);
// Fin du test.
});

/** Un fichier de nœud EPT : en-tête LAS 1.4, format de point 6, adresse des points écrite avec 4 Go de trop. */
// laz : la fin réelle des VLR, le nombre de points et le supplément écrit dans l'adresse (4 Go de trop).
function laz(start: number, count: number, extra = 4294967296): Buffer {
  // Le tampon : 4096 octets.
  const b = Buffer.alloc(4096);
  // Signature et version 1.4.
  b.write('LASF', 0, 'latin1'); b[24] = 1; b[25] = 4;
  // Format de point 6, bit de compression posé.
  b[104] = 0x80 | 6;
  // Deux VLR de 70 octets chacune : la fin des VLR est 375 + 2 × (54 + 70) = 623.
  b.writeUInt32LE(2, 100); b.writeUInt16LE(70, 375 + 20); b.writeUInt16LE(70, 449 + 20);
  // L'adresse des points et le nombre.
  b.writeBigUInt64LE(BigInt(start + extra), 96); b.writeBigUInt64LE(BigInt(count), 247);
  // Renvoie le tampon.
  return b;
// Fin de laz.
}

// L'en-tête d'un nœud EPT : LAS 1.4, format 6, l'adresse des points privée de ses 4 Go de trop (particularité d'Entwine).
test('nœud EPT : en-tête du fichier laszip', () => {
  // L'en-tête : l'adresse des points est écrite avec 4 Go de trop, la partie basse est gardée.
  const h = parseEptLazHeader(laz(515, 46994));
  // L'adresse des points et le nombre.
  expect(h.dataStart).toBe(515); expect(h.count).toBe(46994); expect(h.pointFormat).toBe(6);
  // Une adresse écrite qui sort du fichier : la fin réelle des VLR est prise.
  expect(parseEptLazHeader(laz(623, 100, 65536)).dataStart).toBe(623);
// Fin du test.
});

// Les en-têtes illisibles : signature, version ou format de point non supportés.
test('nœud EPT : en-tête refusé', () => {
  // Un fichier de trois octets.
  expect(() => parseEptLazHeader(Buffer.alloc(3))).toThrow();
  // Signature LAS détériorée.
  const b = laz(515, 1); b[0] = 0x58;
  expect(() => parseEptLazHeader(b)).toThrow();
  // Format de point 7 (celui du LiDAR HD est le 6).
  const c = laz(515, 1); c[104] = 0x87;
  expect(() => parseEptLazHeader(c)).toThrow();
// Fin du test.
});

// La clé d'une cellule, écrite : la forme « niveau-x-y-z ».
test('clé de cellule : écrite', () => {
  // La clé.
  expect(eptCellKey({ d: 6, x: 27, y: 43, z: 31 })).toBe('6-27-43-31');
// Fin du test.
});
