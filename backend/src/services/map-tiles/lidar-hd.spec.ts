// Ce qui est testé.
import { LIDAR_HD_ATTRIBUTION, LIDAR_HD_BOUNDS, LIDAR_HD_CITY_ALTITUDE_M, lidarHdCities, lidarHdLayers, lidarHdTemplate, resolveLidarHd } from './lidar-hd';
// Emprise de la métropole et emprises de l'outre-mer, pour vérifier la couverture.
import { FRANCE, FRANCE_OUTRE_MER } from './earth-sources';

// Groupe de tests des calques LiDAR HD.
describe('calques LiDAR HD de l’IGN', () => {
  // Premier test : la liste.
  it('propose trois calques transparents de la Terre, sans clé', () => {
    // Calques proposés.
    const layers = lidarHdLayers();
    // Trois identifiants, dans cet ordre.
    expect(layers.map((l) => l.id)).toEqual(['lidar-hd-mns', 'lidar-hd-mnt', 'lidar-hd-mnh']);
    // Pour chacun :
    for (const l of layers) {
      // c'est un calque ;
      expect(l.kind).toBe('overlay');
      // de la Terre ;
      expect(l.body).toBe('earth');
      // en Web Mercator ;
      expect(l.projection).toBe('mercator');
      // transparent ;
      expect(l.transparent).toBe(true);
      // sans clé ;
      expect(l.requiresKey).toBe(false);
      // à partir du niveau 6 ;
      expect(l.minZoom).toBe(6);
      // jusqu'au niveau 18.
      expect(l.maxZoom).toBe(18);
    // Fin de la boucle.
    }
  // Fin du test.
  });

  // Deuxième test : l'adresse.
  it('donne l’adresse WMTS de la Géoplateforme, ligne avant colonne', () => {
    // Modèle d'adresse d'une couche, avec une adresse de base donnée.
    const url = lidarHdTemplate('IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW', 'https://data.geopf.fr/wmts');
    // Il doit valoir : le début de la requête,
    expect(url).toBe('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
      // la couche et le style,
      + '&LAYER=IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW&STYLE=normal'
      // le jeu de tuiles, le format et les trous.
      + '&TILEMATRIXSET=PM_0_18&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}');
  // Fin du test.
  });

  // Troisième test : la résolution.
  it('résout un calque avec son emprise et sa mention, et ignore les autres identifiants', () => {
    // Résout le calque du terrain.
    const layer = resolveLidarHd('lidar-hd-mnt')!;
    // Son adresse vise la bonne couche.
    expect(layer.urlTemplate).toContain('LAYER=IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW');
    // Il n'expire pas.
    expect(layer.expiresAt).toBe(null);
    // Il porte la mention de l'IGN.
    expect(layer.attribution.text).toBe(LIDAR_HD_ATTRIBUTION);
    // Il porte les emprises du calque.
    expect(layer.bounds).toEqual(LIDAR_HD_BOUNDS);
    // La première est celle de la France.
    expect(layer.bounds![0]).toEqual([-5.5, 41.2, 9.8, 51.2]);
    // Un autre identifiant : null.
    expect(resolveLidarHd('earth-hd')).toBe(null);
    // Un identifiant au bon préfixe mais inconnu : null.
    expect(resolveLidarHd('lidar-hd-xyz')).toBe(null);
  // Fin du test.
  });

  // Quatrième test : la couverture.
  it('couvre la métropole et les cinq départements et régions d’outre-mer', () => {
    // Six emprises : la métropole, puis l'outre-mer.
    expect(LIDAR_HD_BOUNDS).toEqual([FRANCE, ...FRANCE_OUTRE_MER]);
    // inside : la longitude et la latitude tombent-elles dans une emprise du calque ?
    const inside = (lon: number, lat: number) => LIDAR_HD_BOUNDS.some(([w, s2, e, n]) => lon >= w && lon <= e && lat >= s2 && lat <= n);
    // Paris : couvert.
    expect(inside(2.35, 48.86)).toBe(true);
    // Ajaccio, en Corse : couvert.
    expect(inside(8.73, 41.93)).toBe(true);
    // Saint-Denis de La Réunion : couvert.
    expect(inside(55.45, -20.88)).toBe(true);
    // Fort-de-France : couvert.
    expect(inside(-61.08, 14.61)).toBe(true);
    // Cayenne : couvert.
    expect(inside(-52.33, 4.93)).toBe(true);
    // Dzaoudzi, à Mayotte : couvert.
    expect(inside(45.28, -12.79)).toBe(true);
    // Pointe-à-Pitre : couvert.
    expect(inside(-61.53, 16.24)).toBe(true);
    // Les emprises sont des rectangles, pas les frontières : elles débordent sur les pays voisins (Bruxelles, Genève).
    // Ce n'est qu'un filtre grossier, qui évite de demander des tuiles à l'autre bout du monde ; là où l'IGN n'a pas
    // de donnée, il répond par une tuile transparente et le fond reste visible.
    // Londres, loin de toute emprise : pas de requête.
    expect(inside(-0.13, 51.5)).toBe(false);
    // Madrid : pas de requête.
    expect(inside(-3.7, 40.42)).toBe(false);
    // Berlin : pas de requête.
    expect(inside(13.4, 52.52)).toBe(false);
    // New York : pas de requête.
    expect(inside(-74, 40.7)).toBe(false);
  // Fin du test.
  });

  // Cinquième test : les villes.
  it('propose des villes de métropole et d’outre-mer, toutes dans l’emprise du calque', () => {
    // Les villes proposées.
    const cities = lidarHdCities();
    // Il y en a plusieurs dizaines.
    expect(cities.length).toBeGreaterThan(50);
    // La première est Paris, la plus importante.
    expect(cities[0]).toEqual({ name: 'Paris', region: 'Île-de-France', lon: 2.353, lat: 48.858 });
    // Les noms sont tous différents : le menu peut s'y référer par le nom.
    expect(new Set(cities.map((c) => c.name)).size).toBe(cities.length);
    // Pour chaque ville :
    for (const c of cities) {
      // son nom et sa région ne sont pas vides ;
      expect(c.name.length && c.region.length).toBeTruthy();
      // ses coordonnées sont des nombres ;
      expect(Number.isFinite(c.lon) && Number.isFinite(c.lat)).toBe(true);
      // et elle tombe dans une emprise du calque, sinon elle n'aurait aucune tuile.
      expect(LIDAR_HD_BOUNDS.some(([w, s2, e, n]) => c.lon >= w && c.lon <= e && c.lat >= s2 && c.lat <= n)).toBe(true);
    // Fin de la boucle.
    }
    // Les cinq régions d'outre-mer sont représentées.
    for (const region of ['Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte']) {
      // au moins une ville dans chacune.
      expect(cities.some((c) => c.region === region)).toBe(true);
    // Fin de la boucle.
    }
    // L'altitude d'arrivée est de 2 000 mètres.
    expect(LIDAR_HD_CITY_ALTITUDE_M).toBe(2000);
  // Fin du test.
  });
// Fin du groupe.
});
