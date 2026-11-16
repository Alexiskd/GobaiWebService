// Ouvre l'import de ce qui est testé :
import {
  // la liste des sources et les fonctions du module.
  SATELLITE_SOURCES, isSatTile, pickUsgsLayer, satTileBounds, trekMatrixInfo, usgsGetMapQuery,
// Fin de l'import.
} from './satellite-sources';
// Liste des satellites affichés.
import { SATELLITES } from '../data/bodies.data';

// Groupe de tests des sources des satellites.
describe('sources des satellites', () => {
  // Premier test : la liste.
  it('couvre exactement les satellites affichés', () => {
    // Fiches qui ne sont pas des planètes.
    const moons = SATELLITE_SOURCES.filter((s) => !s.planet);
    // Leurs identifiants doivent être ceux des satellites affichés.
    expect(moons.map((s) => s.id).sort()).toEqual(SATELLITES.map((s) => s.id).sort());
    // Chacune doit avoir au moins un produit Trek.
    for (const s of moons) expect(s.trek.length).toBeGreaterThan(0);
    // Géantes gazeuses : pas de portail Trek, carte USGS seulement.
    // Les planètes : Jupiter, Saturne, Uranus, Neptune, dans cet ordre.
    expect(SATELLITE_SOURCES.filter((s) => s.planet).map((s) => s.id)).toEqual(['jupiter', 'saturn', 'uranus', 'neptune']);
  // Fin du test.
  });

  // Deuxième test : l'emprise des tuiles.
  it('découpe plate carrée : emprise des tuiles', () => {
    // Au niveau 0, la première tuile couvre l'hémisphère ouest.
    expect(satTileBounds(0, 0, 0)).toEqual({ west: -180, south: -90, east: 0, north: 90 });
    // Au niveau 1, la tuile (3, 1) va de 90° à 180° Est, et du pôle Sud à l'équateur.
    expect(satTileBounds(1, 3, 1)).toEqual({ west: 90, south: -90, east: 180, north: 0 });
    // Niveau 0, colonne 1 : existe.
    expect(isSatTile(0, 1, 0)).toBe(true);
    // Niveau 0, colonne 2 : n'existe pas.
    expect(isSatTile(0, 2, 0)).toBe(false);
    // Niveau 2, dernière colonne et dernière ligne : existe.
    expect(isSatTile(2, 7, 3)).toBe(true);
    // Niveau 2, ligne 4 : n'existe pas.
    expect(isSatTile(2, 7, 4)).toBe(false);
  // Fin du test.
  });

  // Troisième test : les niveaux WMTS.
  it('lit les niveaux WMTS dont la grille correspond (2^(z+1) × 2^z)', () => {
    // Lit deux jeux de tuiles :
    const info = trekMatrixInfo([
      // un jeu d'une seule tuile carrée, qui ne convient pas ;
      { id: 'other', matrices: [{ id: 'a', matrixWidth: 1, matrixHeight: 1 }] },
      // un second jeu,
      {
        // nommé « default028mm »,
        id: 'default028mm',
        // avec ces matrices :
        matrices: [
          // niveau 0 : 2 × 1 tuiles ;
          { id: '0', matrixWidth: 2, matrixHeight: 1 },
          // niveau 1 : 4 × 2 ;
          { id: '1', matrixWidth: 4, matrixHeight: 2 },
          // niveau 2 : 8 × 4 ;
          { id: '2', matrixWidth: 8, matrixHeight: 4 },
          // niveau 4 : 32 × 16.
          { id: '4', matrixWidth: 32, matrixHeight: 16 }, // trou au niveau 3 : on s'arrête à 2
        // Fin des matrices.
        ],
      // Fin du second jeu.
      },
    // Fin des jeux ; le modèle d'adresse finit par « .png ».
    ], 'https://x/{TileMatrix}/{TileRow}/{TileCol}.png');
    // Le second jeu est retenu.
    expect(info?.matrixSet).toBe('default028mm');
    // Le niveau le plus fin est 2.
    expect(info?.maxZoom).toBe(2);
    // Le niveau 1 porte le nom « 1 ».
    expect(info?.levels.get(1)).toBe('1');
    // L'extension est png.
    expect(info?.extension).toBe('png');
    // Un jeu sans matrice 2 × 1 : null.
    expect(trekMatrixInfo([{ id: 'x', matrices: [{ id: '0', matrixWidth: 1, matrixHeight: 1 }] }], null)).toBeNull();
  // Fin du test.
  });

  // Quatrième test : le choix de la couche USGS.
  it('choisit une mosaïque USGS, pas une grille ni une nomenclature', () => {
    // Parmi trois couches,
    expect(pickUsgsLayer([
      // une grille,
      { name: 'GRID', title: 'Grille' },
      // une nomenclature,
      { name: 'NOMENCLATURE', title: 'Noms' },
      // et une mosaïque,
      { name: 'GALILEO_VOYAGER', title: 'Io Galileo Voyager Global Mosaic' },
    // la mosaïque est choisie.
    ])).toBe('GALILEO_VOYAGER');
    // Une seule couche d'images : elle est choisie.
    expect(pickUsgsLayer([{ name: 'CASSINI', title: 'Titan ISS' }])).toBe('CASSINI');
    // Une seule couche de grille : null.
    expect(pickUsgsLayer([{ name: 'GRID', title: 'Grid' }])).toBeNull();
  // Fin du test.
  });

  // Cinquième test : la requête WMS.
  it('GetMap WMS : emprise de la tuile, décalage 0..360 pour l’hémisphère ouest', () => {
    // Requête de la tuile nord-ouest du niveau 1, carte en 0..360.
    const q = new URLSearchParams(usgsGetMapQuery('/maps/jupiter/io_simp_cyl.map', 'L', 'EPSG:4326', 1, 0, 0, true));
    // Son emprise est décalée de 360°.
    expect(q.get('BBOX')).toBe('180,0,270,90');
    // La couche est la bonne.
    expect(q.get('LAYERS')).toBe('L');
    // Requête d'une tuile de l'est.
    const east = new URLSearchParams(usgsGetMapQuery('/m', 'L', 'EPSG:4326', 1, 2, 1, true));
    // Son emprise n'est pas décalée.
    expect(east.get('BBOX')).toBe('0,-90,90,0');
    // Requête de la tuile nord-ouest, carte en −180..180.
    const plain = new URLSearchParams(usgsGetMapQuery('/m', 'L', 'EPSG:4326', 1, 0, 0, false));
    // Son emprise n'est pas décalée.
    expect(plain.get('BBOX')).toBe('-180,0,-90,90');
  // Fin du test.
  });
// Fin du groupe.
});
