// Ce qui est testé : le service des astres.
import { BodiesService } from './bodies.service';
// Données des astres, pour comparer le listing à la source.
import { ALL_SATELLITES, MOON, PARENT_PLANET_NAME, PLANETS } from '../data/bodies.data';

// Groupe de tests du listing d'affichage.
describe('listing d’affichage des astres', () => {
  // Le service, construit une fois pour tous les tests.
  const service = new BodiesService();

  // Premier test : les planètes.
  it('reprend toutes les planètes, naines comprises, classées par distance au Soleil', () => {
    // Le listing.
    const { planets } = service.listing();
    // Autant de planètes que dans la table.
    expect(planets).toHaveLength(PLANETS.length);
    // Les noms, dans le même ordre que la table.
    expect(planets.map((p) => p.name)).toEqual(PLANETS.map((p) => p.name));
    // Les demi-grands axes sont croissants : la liste suit la distance au Soleil.
    const axes = planets.map((p) => p.aAu);
    // Triés, ils ne changent pas d'ordre.
    expect([...axes].sort((a, b) => a - b)).toEqual(axes);
    // Chaque planète naine de la table porte la marque dans le listing.
    for (const p of PLANETS.filter((x) => x.dwarf)) {
      // sa ligne du listing,
      const line = planets.find((x) => x.name === p.name)!;
      // marquée comme naine.
      expect(line.dwarf).toBe(true);
    // Fin de la boucle.
    }
    // Une planète qui n'est pas naine ne porte pas la marque.
    expect(planets.find((p) => p.name === 'Jupiter')!.dwarf).toBeUndefined();
  // Fin du test.
  });

  // Deuxième test : les satellites, rattachés à la bonne planète.
  it('rattache chaque satellite naturel à sa planète, du plus proche au plus lointain', () => {
    // Le listing.
    const { planets } = service.listing();
    // Pour chaque satellite de la table :
    for (const sat of ALL_SATELLITES) {
      // le nom français de sa planète mère,
      const parentName = PARENT_PLANET_NAME[sat.parent];
      // la ligne de cette planète dans le listing,
      const planet = planets.find((p) => p.name === parentName);
      // qui doit exister,
      expect(planet).toBeDefined();
      // et porter ce satellite.
      expect(planet!.satellites.some((s) => s.name === sat.name)).toBe(true);
    // Fin de la boucle.
    }
    // Pour chaque planète du listing : ses satellites sont classés par demi-grand axe croissant.
    for (const planet of planets) {
      // les demi-grands axes connus de ses satellites (la Lune n'en a pas),
      const aKm = planet.satellites.map((s) => s.aKm).filter((v) => typeof v === 'number') as number[];
      // qui ne changent pas d'ordre une fois triés.
      expect([...aKm].sort((a, b) => a - b)).toEqual(aKm);
    // Fin de la boucle.
    }
    // Aucun satellite n'est rattaché à deux planètes à la fois.
    const all = planets.flatMap((p) => p.satellites.map((s) => s.name));
    // autant de noms que de noms différents.
    expect(new Set(all).size).toBe(all.length);
  // Fin du test.
  });

  // Troisième test : la Lune.
  it('rattache la Lune à la Terre, avec les seuls champs qu’elle possède', () => {
    // Le listing.
    const { planets } = service.listing();
    // La planète marquée « earth » dans la table.
    const earthName = PLANETS.find((p) => p.earth)!.name;
    // Sa ligne du listing.
    const earth = planets.find((p) => p.name === earthName)!;
    // Elle porte la Lune.
    const moon = earth.satellites.find((s) => s.name === MOON.name);
    // qui doit exister,
    expect(moon).toBeDefined();
    // avec le rayon de ses propres données,
    expect(moon!.radius).toBe(MOON.radius);
    // et sans identifiant, puisqu'elle n'est pas dans la table des satellites.
    expect(moon!.id).toBe('');
  // Fin du test.
  });

  // Quatrième test : les nombres.
  it('compte les planètes, les naines et les satellites', () => {
    // Le listing.
    const { planets, counts } = service.listing();
    // Le nombre de planètes.
    expect(counts.planets).toBe(planets.length);
    // Celui des naines, compté sur la table.
    expect(counts.dwarfPlanets).toBe(PLANETS.filter((p) => p.dwarf).length);
    // Celui des satellites : tous ceux de la table, plus la Lune.
    expect(counts.satellites).toBe(ALL_SATELLITES.length + 1);
  // Fin du test.
  });

  // Cinquième test : le listing est allégé.
  it('n’expose ni éléments képlériens ni codes Horizons', () => {
    // La première planète du listing.
    const [planet] = service.listing().planets;
    // Pas d'éléments képlériens.
    expect('elements' in planet).toBe(false);
    // Pour chacun de ses satellites, s'il y en a :
    for (const sat of planet.satellites) {
      // pas de code Horizons,
      expect('horizons' in sat).toBe(false);
      // ni celui du centre de sa planète.
      expect('parentHorizons' in sat).toBe(false);
    // Fin de la boucle.
    }
  // Fin du test.
  });
// Fin du groupe.
});
