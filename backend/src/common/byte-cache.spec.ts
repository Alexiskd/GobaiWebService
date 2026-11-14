// Ce qui est testé : le cache mémoire borné en octets.
import { ByteCache } from './byte-cache';

// Groupe de tests du cache.
describe('cache mémoire en octets', () => {
  // Test : le cache reste sous sa capacité.
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
