// Fonctions de fichiers : tester la présence, lire, lire la taille.
import { existsSync, readFileSync, statSync } from 'node:fs';
// createHash : calcule une empreinte.
import { createHash } from 'node:crypto';
// gunzipSync : décompresse du gzip.
import { gunzipSync } from 'node:zlib';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Ce qui est testé : le cache, les vérifications, le type du manifeste, l'adresse d'un nœud, le manifeste public.
import { ByteCache, isLidarManifest, isLidarNodeKey, isLidarTileId, type LidarManifest, lidarNodeUrl, publicLidarManifest } from './lidar-tiles';

// Dossier de la dalle de Paris.
const dir = join(__dirname, '..', '..', '..', 'data', 'lidar', 'paris-0652-6863');
// Son manifeste, lu une fois pour tous les tests.
const manifest: LidarManifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

// Groupe de tests des dalles LiDAR.
describe('dalles LiDAR 3D', () => {
  // Premier test : identifiants et clés.
  it('reconnaît les identifiants de dalle et les clés de nœud', () => {
    // Un identifiant normal : accepté.
    expect(isLidarTileId('paris-0652-6863')).toBe(true);
    // Une tentative de sortir du dossier : refusée.
    expect(isLidarTileId('../secret')).toBe(false);
    // Un identifiant vide : refusé.
    expect(isLidarTileId('')).toBe(false);
    // La racine : acceptée.
    expect(isLidarNodeKey('0-0-0-0')).toBe(true);
    // Un nœud de niveau 3 dans la grille : accepté.
    expect(isLidarNodeKey('3-7-7-0')).toBe(true);
    // Un nœud de niveau 3 hors de la grille : refusé.
    expect(isLidarNodeKey('3-8-0-0')).toBe(false); // hors de la grille du niveau 3 (8 × 8 × 8)
    // Un niveau 13 : refusé.
    expect(isLidarNodeKey('13-0-0-0')).toBe(false);
    // Trois nombres seulement : refusé.
    expect(isLidarNodeKey('0-0-0')).toBe(false);
    // Une clé suivie d'un chemin : refusée.
    expect(isLidarNodeKey('0-0-0-0/../x')).toBe(false);
  // Fin du test.
  });

  // Deuxième test : le manifeste de Paris.
  it('le manifeste de la dalle de Paris est valide et complet', () => {
    // Il est valide.
    expect(isLidarManifest(manifest)).toBe(true);
    // Son premier nœud est la racine.
    expect(manifest.nodes[0].k).toBe('0-0-0-0');
    // La somme des points des nœuds égale le total annoncé.
    expect(manifest.nodes.reduce((sum, n) => sum + n.n, 0)).toBe(manifest.points);
    // La somme des tailles des fichiers égale le total annoncé.
    expect(manifest.nodes.reduce((sum, n) => sum + n.b, 0)).toBe(manifest.bytes);
    // Aucune clé n'apparaît deux fois.
    expect(new Set(manifest.nodes.map((n) => n.k)).size).toBe(manifest.nodes.length);
    // Calage : centre de la dalle, à Paris (Centre Pompidou), axe Y de Lambert-93 à 0,47° à l'ouest du nord.
    // Latitude du calage, à 3 décimales près.
    expect(manifest.anchor.lat).toBeCloseTo(48.8608, 3);
    // Longitude du calage.
    expect(manifest.anchor.lon).toBeCloseTo(2.3526, 3);
    // Cap du calage, à 2 décimales près.
    expect(manifest.anchor.heading).toBeCloseTo(-0.468, 2);
  // Fin du test.
  });

  // Troisième test : les fichiers des nœuds.
  it('chaque nœud a son fichier, de la taille et de l’empreinte annoncées', () => {
    // Pour chaque nœud :
    for (const node of manifest.nodes) {
      // chemin de son fichier ;
      const file = join(dir, 'nodes', `${node.k}.bin`);
      // il existe ;
      expect(existsSync(file)).toBe(true);
      // et sa taille est celle annoncée.
      expect(statSync(file).size).toBe(node.b);
    // Fin de la boucle.
    }
    // Pour les six premiers nœuds :
    for (const node of manifest.nodes.slice(0, 6)) {
      // lit le fichier ;
      const body = readFileSync(join(dir, 'nodes', `${node.k}.bin`));
      // les 16 premiers caractères de son SHA-256 sont ceux annoncés.
      expect(createHash('sha256').update(body).digest('hex').slice(0, 16)).toBe(node.h);
    // Fin de la boucle.
    }
  // Fin du test.
  });

  // Quatrième test : le contenu d'un nœud.
  it('un nœud décompressé fait 8 octets par point, avec des points dans son cube', () => {
    // Prend le premier nœud de niveau 3.
    const node = manifest.nodes.find((n) => n.k.startsWith('3-'))!;
    // Lit et décompresse son fichier.
    const raw = gunzipSync(readFileSync(join(dir, 'nodes', `${node.k}.bin`)));
    // 8 octets par point.
    expect(raw.length).toBe(node.n * 8);
    // Côté d'un nœud de niveau 3, compté en pas : le côté de la dalle divisé par 8, puis par le pas.
    const side = (manifest.bounds.maxX - manifest.bounds.minX) / 8 / manifest.step; // côté d'un nœud de niveau 3, en pas
    // Position x courante, maximum et minimum rencontrés.
    let x = 0, max = 0, min = 0;
    // Pour chaque point :
    for (let i = 0; i < node.n; i++) {
      // son écart de x sur 16 bits : octet bas, puis octet haut rangé n octets plus loin ;
      const v = raw[i] | (raw[node.n + i] << 8);
      // décodage zigzag de l'écart, ajouté à la position ;
      x += (v >>> 1) ^ -(v & 1);
      // nouveau maximum ;
      max = Math.max(max, x);
      // nouveau minimum.
      min = Math.min(min, x);
    // Fin de la boucle.
    }
    // Aucun x négatif.
    expect(min >= 0).toBe(true);
    // Aucun x au-delà du côté du nœud.
    expect(max <= side).toBe(true);
    // Classes d'affichage 0 à 9.
    // Les octets de classe : le septième plan du fichier.
    const classes = raw.subarray(node.n * 6, node.n * 7);
    // Toutes les classes sont entre 0 et 9.
    expect(classes.every((c) => c <= 9)).toBe(true);
  // Fin du test.
  });

  // Cinquième test : les adresses.
  it('donne au navigateur l’adresse des nœuds, empreinte comprise', () => {
    // L'adresse d'un nœud contient la dalle, la clé et l'empreinte.
    expect(lidarNodeUrl('paris-0652-6863', manifest.nodes[0])).toBe(`/api/v1/lidar/paris-0652-6863/0-0-0-0?v=${manifest.nodes[0].h}`);
    // Manifeste public, pour une origine « postgres ».
    const pub = publicLidarManifest(manifest, 'postgres');
    // Son modèle d'adresse a les trous {k} et {h}.
    expect(pub.nodeUrl).toBe('/api/v1/lidar/paris-0652-6863/{k}?v={h}');
    // Il porte l'origine des fichiers.
    expect(pub.storage).toBe('postgres');
    // Orthophoto drapée sur les points : tuiles de l'IGN, adresse à trous {z} {x} {y}.
    // L'orthophoto vient de la couche d'orthophotos de l'IGN.
    expect(pub.imagery.template).toContain('ORTHOIMAGERY.ORTHOPHOTOS');
    // Son adresse a les trous {z}, {y}, {x}.
    expect(pub.imagery.template).toContain('TILEMATRIX={z}&TILEROW={y}&TILECOL={x}');
    // Les nœuds sont tous là.
    expect(pub.nodes.length).toBe(manifest.nodes.length);
  // Fin du test.
  });

  // Sixième test : le cache mémoire.
  it('le cache mémoire reste sous sa capacité et garde les derniers lus', () => {
    // Un cache de 10 octets.
    const cache = new ByteCache(10);
    // Range « a », 4 octets.
    cache.set('a', Buffer.alloc(4));
    // Range « b », 4 octets.
    cache.set('b', Buffer.alloc(4));
    // Lit « a ».
    expect(cache.get('a')?.length).toBe(4); // « a » redevient le plus récent
    // Range « c », 4 octets.
    cache.set('c', Buffer.alloc(4));        // dépasse : « b », le plus ancien, sort
    // « b » a été retiré.
    expect(cache.get('b')).toBe(undefined);
    // « a » est toujours là.
    expect(cache.get('a')?.length).toBe(4);
    // 8 octets occupés.
    expect(cache.bytes).toBe(8);
    // Range un fichier de 11 octets.
    cache.set('gros', Buffer.alloc(11));    // plus grand que le cache : jamais gardé
    // Il n'est pas gardé.
    expect(cache.get('gros')).toBe(undefined);
    // Deux fichiers dans le cache.
    expect(cache.size).toBe(2);
  // Fin du test.
  });
// Fin du groupe.
});
