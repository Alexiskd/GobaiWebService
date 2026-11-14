// Les trois fonctions testées.
import { addressItem, addressItems, looksLikeAddress } from './address';

// Fonction feature : fabrique un faux résultat Photon à partir de ses propriétés, avec des coordonnées par défaut près de Conflans.
const feature = (properties: Record<string, string>, coordinates: [number, number] = [2.09, 48.99]) => ({ geometry: { coordinates }, properties });

// Groupe de tests de la recherche d'adresses.
describe('recherche d’adresses', () => {
  // Premier test : reconnaître une adresse.
  it('reconnaît une adresse à son numéro ou à son mot de voie', () => {
    // Un numéro suivi d'une rue : oui.
    expect(looksLikeAddress('12 rue de la Paix')).toBe(true);
    // Un mot de voie suivi d'un nom : oui.
    expect(looksLikeAddress('avenue Foch')).toBe(true);
    // Une adresse anglaise : oui.
    expect(looksLikeAddress('10 Downing Street')).toBe(true);
    // Un nom de ville : non.
    expect(looksLikeAddress('Conflans')).toBe(false);
    // Un mot de voie seul : non.
    expect(looksLikeAddress('Place')).toBe(false); // mot de voie seul : pas encore une adresse
    // Trois lettres seulement : non.
    expect(looksLikeAddress('rue')).toBe(false);
  // Fin du test.
  });

  // Deuxième test : composer une adresse.
  it('compose une maison numérotée et une voie', () => {
    // Une maison numérotée
    expect(addressItem(feature({ housenumber: '12', street: 'Rue de la Paix', postcode: '75002', city: 'Paris', country: 'France' })))
      // donne « numéro rue », avec le code postal, la ville et le pays en contexte.
      .toEqual({ name: '12 Rue de la Paix', context: '75002 Paris, France', lon: 2.09, lat: 48.99, kind: 'address' });
    // Une voie sans numéro
    expect(addressItem(feature({ osm_key: 'highway', name: 'Avenue Foch', city: 'Paris', country: 'France' })))
      // donne son nom, avec la ville et le pays.
      .toEqual({ name: 'Avenue Foch', context: 'Paris, France', lon: 2.09, lat: 48.99, kind: 'address' });
  // Fin du test.
  });

  // Troisième test : ce qui n'est pas une adresse.
  it('écarte ce qui n’est pas une adresse', () => {
    // Une ville : refusée.
    expect(addressItem(feature({ osm_key: 'place', name: 'Paris' }))).toBeNull();
    // Un commerce situé dans une rue : refusé.
    expect(addressItem(feature({ osm_key: 'amenity', name: 'Café', street: 'Rue X' }))).toBeNull();
    // Un résultat sans coordonnées : refusé.
    expect(addressItem({ properties: { housenumber: '1', street: 'Rue X' } })).toBeNull(); // sans coordonnées
  // Fin du test.
  });

  // Quatrième test : doublons et limite.
  it('retire les doublons et respecte la limite', () => {
    // Une voie.
    const f = feature({ osm_key: 'highway', name: 'Rue A', city: 'Paris' });
    // Une autre voie.
    const g = feature({ osm_key: 'highway', name: 'Rue B', city: 'Paris' });
    // La voie répétée n'apparaît qu'une fois.
    expect(addressItems([f, f, g], 5).map((i) => i.name)).toEqual(['Rue A', 'Rue B']);
    // La limite de 1 est respectée.
    expect(addressItems([f, g], 1)).toHaveLength(1);
    // Sans résultat : liste vide.
    expect(addressItems(undefined, 3)).toEqual([]);
  // Fin du test.
  });
// Fin du groupe.
});
