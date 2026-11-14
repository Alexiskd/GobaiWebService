// Ce qui est testé : les fonctions pures des nuages LiDAR HD de l'IGN lus en direct.
import {
  COPC_HEADER_BYTES, LAZDEC_POINT_BYTES, displayClass, encodeNode, isLidarNodeKey, isLidarTileId, lidarWfsUrl, luminosity,
  parseCopcHeader, parseHierarchyPage, tileIdFromUrl, tileKmFromId, tilesFromWfs,
} from './lidar-tiles';

/** En-tête COPC synthétique : LAS 1.4, format 6, échelle 0,01, cube de Beaubourg. */
// header : fabrique les 589 premiers octets d'un fichier COPC.
function header(): Buffer {
  // Tampon nul.
  const b = Buffer.alloc(COPC_HEADER_BYTES);
  // Signature et version 1.4.
  b.write('LASF', 0, 'latin1'); b[24] = 1; b[25] = 4;
  // Format de point 6 (bit de compression posé, comme dans un LAZ).
  b[104] = 0x80 | 6;
  // Échelle 0,01 et décalage nul.
  [0.01, 0.01, 0.01, 0, 0, 0].forEach((v, i) => b.writeDoubleLE(v, 131 + 8 * i));
  // Altitudes maximale et minimale.
  b.writeDoubleLE(98.05, 211); b.writeDoubleLE(25.52, 219);
  // VLR « copc ».
  b.write('copc', 377, 'latin1');
  // Cube : centre, demi-côté, écart des points.
  [652500, 6862500, 525.52, 500, 6.8].forEach((v, i) => b.writeDoubleLE(v, 429 + 8 * i));
  // Première page de la hiérarchie.
  b.writeBigUInt64LE(123456n, 469); b.writeBigUInt64LE(64n, 477);
  // Renvoie l'en-tête.
  return b;
}

/** Décode un nœud converti (plans, écarts en zigzag) : même algorithme que le navigateur (lidarPointsMath.decodeNode). */
// decode : les octets et le nombre de points.
function decode(buf: Buffer, n: number) {
  // Positions et attributs.
  const pos: number[] = [], attr: number[] = [];
  // Pour chaque axe (début).
  for (let axis = 0; axis < 3; axis++) {
    // Valeur cumulée.
    let acc = 0;
    // Pour chaque point : écart en zigzag, cumulé.
    for (let i = 0; i < n; i++) { const v = buf[axis * 2 * n + i] | (buf[axis * 2 * n + n + i] << 8); acc += (v >>> 1) ^ -(v & 1); pos[i * 3 + axis] = acc; }
  // Fin des axes.
  }
  // Classes et luminosités.
  for (let i = 0; i < n; i++) attr.push(buf[6 * n + i], buf[7 * n + i]);
  // Renvoie les deux tableaux.
  return { pos, attr };
}

// Groupe de tests.
describe('nuages LiDAR HD de l’IGN en direct', () => {
  // Identifiants et clés.
  it('reconnaît les dalles de l’IGN et les clés de nœud', () => {
    // Identifiant tiré de l'adresse du nuage.
    expect(tileIdFromUrl('https://data.geopf.fr/telechargement/download/LiDARHD/LHD_FXX_0652_6863_PTS_LAMB93_IGN69.copc.laz')).toBe('lhd-0652-6863');
    // Adresse sans nom de dalle : null.
    expect(tileIdFromUrl('https://exemple.fr/nuage.laz')).toBe(null);
    // Kilomètres de la dalle.
    expect(tileKmFromId('lhd-0652-6863')).toEqual({ x: 652, y: 6863 });
    // Identifiant et clés valables ou non.
    expect(isLidarTileId('lhd-0652-6863')).toBe(true); expect(isLidarTileId('../x')).toBe(false);
    // Clés.
    expect(isLidarNodeKey('0-0-0-0')).toBe(true); expect(isLidarNodeKey('1-2-0-0')).toBe(false);
  });

  // Requête WFS et lecture de la réponse.
  it('interroge la couche des métadonnées et garde les dalles qui ont un nuage COPC', () => {
    // Adresse autour de Beaubourg.
    const u = new URL(lidarWfsUrl(2.3526, 48.8608));
    // Couche des métadonnées LiDAR HD.
    expect(u.searchParams.get('TYPENAMES')).toBe('IGNF_LIDAR-HD_METADONNEE:metadata');
    // Emprise latitude d'abord.
    expect(u.searchParams.get('BBOX')).toMatch(/^48\.85\d+,2\.34\d+,48\.86\d+,2\.36\d+,urn:ogc:def:crs:EPSG::4326$/);
    // Réponse : une dalle valable, un doublon, une sans nuage, une en http.
    const items = tilesFromWfs({ features: [
      { properties: { url_npl: 'https://data.geopf.fr/x/LHD_FXX_0652_6863_PTS_LAMB93_IGN69.copc.laz', nombre_points: 16618577, date_fin_acquisition: '2023-03-03Z' } },
      { properties: { url_npl: 'https://data.geopf.fr/y/LHD_FXX_0652_6863_PTS_LAMB93_IGN69.copc.laz' } },
      { properties: { url_npl: null } },
      { properties: { url_npl: 'http://data.geopf.fr/z/LHD_FXX_0653_6863_PTS_LAMB93_IGN69.copc.laz' } },
    ] });
    // Une seule dalle, avec ses points et sa date.
    expect(items).toEqual([{ id: 'lhd-0652-6863', url: 'https://data.geopf.fr/x/LHD_FXX_0652_6863_PTS_LAMB93_IGN69.copc.laz', points: 16618577, acquired: '2023-03-03' }]);
    // Réponse invalide : rien.
    expect(tilesFromWfs(null)).toEqual([]);
  });

  // En-tête et hiérarchie COPC.
  it('lit l’en-tête COPC et une page de la hiérarchie', () => {
    // En-tête lu.
    const info = parseCopcHeader(header());
    // Format, échelle, cube et première page.
    expect(info.pointFormat).toBe(6); expect(info.scale).toEqual([0.01, 0.01, 0.01]);
    // Cube.
    expect([info.cx, info.cy, info.half, info.spacing]).toEqual([652500, 6862500, 500, 6.8]);
    // Page racine.
    expect([info.rootOffset, info.rootSize, info.maxZ]).toEqual([123456, 64, 98.05]);
    // Fichier qui n'est pas un LAS : erreur.
    expect(() => parseCopcHeader(Buffer.alloc(COPC_HEADER_BYTES))).toThrow();
    // Page de deux entrées : un nœud, une sous-page.
    const page = Buffer.alloc(64);
    // Nœud 1-0-1-0 : bloc de 500 octets à 1000, 42 points.
    [1, 0, 1, 0].forEach((v, i) => page.writeInt32LE(v, 4 * i)); page.writeBigUInt64LE(1000n, 16); page.writeInt32LE(500, 24); page.writeInt32LE(42, 28);
    // Sous-page 2-0-0-0 : nombre de points −1.
    [2, 0, 0, 0].forEach((v, i) => page.writeInt32LE(v, 32 + 4 * i)); page.writeBigUInt64LE(9000n, 48); page.writeInt32LE(320, 56); page.writeInt32LE(-1, 60);
    // Entrées lues.
    expect(parseHierarchyPage(page)).toEqual([
      { key: '1-0-1-0', level: 1, x: 0, y: 1, z: 0, offset: 1000, size: 500, count: 42 },
      { key: '2-0-0-0', level: 2, x: 0, y: 0, z: 0, offset: 9000, size: 320, count: -1 },
    ]);
  });

  // Classes et luminosité.
  it('classe les points et calcule leur luminosité', () => {
    // Sol, végétation, bâti, eau, pont, autre.
    expect([2, 3, 5, 6, 67, 9, 17, 1].map(displayClass)).toEqual([1, 2, 4, 5, 5, 7, 8, 0]);
    // Luminosité neutre vers 170, bornée.
    expect(luminosity(2200)).toBe(170); expect(luminosity(0)).toBe(Math.round((0.48 + 0.52 * 0.25) * 170));
  });

  // Conversion d'un nœud.
  it('convertit les points décodés au format du navigateur : bruit écarté, toit et façade séparés', () => {
    // Quatre points (16 octets chacun) : sol, bruit, toit, façade (même cellule, 10 m plus bas).
    const pts = [[652000_10, 6862000_20, 30_00, 2], [652000_50, 6862000_50, 31_00, 7], [652010_20, 6862010_20, 60_00, 6], [652010_40, 6862010_40, 50_00, 6]];
    // Tampon des points décodés.
    const raw = Buffer.alloc(pts.length * LAZDEC_POINT_BYTES);
    // Remplit chaque point : X, Y, Z, intensité, classe.
    pts.forEach(([x, y, z, c], i) => { const o = i * LAZDEC_POINT_BYTES; raw.writeInt32LE(x, o); raw.writeInt32LE(y, o + 4); raw.writeInt32LE(z, o + 8); raw.writeUInt16LE(2200, o + 12); raw[o + 14] = c; });
    // Conversion : coin du nœud (652 000 ; 6 862 000), bas du cube à 25 m, pas de 4 cm.
    const { bytes, count } = encodeNode(raw, { scale: [0.01, 0.01, 0.01], offset: [0, 0, 0], minX: 652000, minY: 6862000, z0: 25, step: 0.04 });
    // Trois points gardés, 8 octets chacun.
    expect(count).toBe(3); expect(bytes.length).toBe(24);
    // Décodé comme le fait le navigateur.
    const { pos, attr } = decode(bytes, count);
    // Sol : (10 cm, 20 cm, 5 m) en pas de 4 cm.
    expect(pos.slice(0, 3)).toEqual([2, 5, 125]);
    // Toit à 60 m : (10,2 m, 10,2 m, 35 m).
    expect(pos.slice(3, 6)).toEqual([255, 255, 875]);
    // Classes : sol, toit, façade ; luminosités neutres.
    expect(attr).toEqual([1, 170, 5, 170, 6, 170]);
  });
});
