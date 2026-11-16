// readFileSync : lit un fichier en entier.
import { readFileSync } from 'node:fs';
// Fonction testée.
import { buildCountriesTopology } from './countries-topology';
// Chemins du GeoJSON et du TopoJSON du projet.
import { NATURAL_EARTH_COUNTRIES, WORLD_ATLAS_COUNTRIES } from './world-atlas.service';

// Fonction square : fabrique les coordonnées d'un carré dont le coin bas gauche est en (x, y).
const square = (x: number, y: number, size = 1) => [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]];

// Groupe de tests de buildCountriesTopology.
describe('buildCountriesTopology', () => {
  // Premier test : deux pays voisins.
  it('enregistre une seule fois la frontière commune de deux pays voisins', () => {
    // Fabrique la topologie de
    const { topology, stats } = buildCountriesTopology([
      // un carré à l'ouest,
      { properties: { ISO_N3: '001', NAME: 'Ouest' }, geometry: { type: 'Polygon', coordinates: square(0, 0) } },
      // et un carré collé à l'est.
      { properties: { ISO_N3: '002', NAME: 'Est' }, geometry: { type: 'Polygon', coordinates: square(1, 0) } },
    // Fin de l'appel.
    ]);
    // Deux pays, deux anneaux, trois arcs (un par pays et leur frontière commune), deux jonctions.
    expect(stats).toEqual({ countries: 2, rings: 2, arcs: 3, junctions: 2 });
    // Les deux géométries.
    const [west, east] = topology.objects.countries.geometries!;
    // Celle de l'ouest : son type, son identifiant et son nom.
    expect(west).toMatchObject({ type: 'Polygon', id: '001', properties: { name: 'Ouest' } });
    // Fonction used : numéros d'arcs d'une géométrie, ramenés à leur forme positive.
    const used = (g: { arcs?: unknown }) => (g.arcs as number[][])[0].map((i) => (i < 0 ? ~i : i));
    // Les deux pays n'ont qu'un seul arc en commun.
    expect(used(west).filter((i) => used(east).includes(i))).toHaveLength(1);
  // Fin du test.
  });

  // Deuxième test : pays sans code ISO.
  it('donne 578 à la Norvège et aucun identifiant aux autres pays sans code ISO', () => {
    // Fabrique la topologie de
    const { topology } = buildCountriesTopology([
      // la Norvège,
      { properties: { ISO_N3: '-99', SOV_A3: 'NOR', NAME: 'Norway' }, geometry: { type: 'Polygon', coordinates: square(0, 0) } },
      // et du Kosovo, tous deux avec le code « -99 ».
      { properties: { ISO_N3: '-99', SOV_A3: 'KOS', NAME: 'Kosovo' }, geometry: { type: 'Polygon', coordinates: square(5, 5) } },
    // Fin de l'appel.
    ]);
    // Les deux géométries.
    const [norway, kosovo] = topology.objects.countries.geometries!;
    // La Norvège reçoit 578.
    expect(norway.id).toBe('578');
    // Le Kosovo n'a pas d'identifiant.
    expect(kosovo).not.toHaveProperty('id');
  // Fin du test.
  });

  // Troisième test : le fichier du projet.
  it('refabrique à l’identique le fichier importé dans le projet', () => {
    // Lit les pays du GeoJSON Natural Earth.
    const { features } = JSON.parse(readFileSync(NATURAL_EARTH_COUNTRIES, 'utf8'));
    // La topologie refabriquée, en JSON, doit être identique au fichier importé.
    expect(JSON.stringify(buildCountriesTopology(features).topology)).toBe(readFileSync(WORLD_ATLAS_COUNTRIES, 'utf8'));
  // Fin du test.
  });
// Fin du groupe.
});
