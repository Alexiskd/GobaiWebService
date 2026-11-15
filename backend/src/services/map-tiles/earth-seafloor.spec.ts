// Importe ce qui est testé : les fonds marins, leur table, la couche GEBCO, la fonction de rendu, l'adresse NOAA et la fusion.
import { GEBCO_LAYER, NCEI_RENDERING, SEAFLOOR_BY_ID, SEAFLOOR_FUSION_MAX_ZOOM, SEAFLOOR_LAYERS, nceiTileUrl, seafloorFusion } from './earth-seafloor';
// Importe l'emprise Web Mercator d'une tuile.
import { mercatorBbox } from './earth-sources';

// Groupe de tests des fonds marins.
describe('fonds marins de la Terre', () => {
  // Test : deux couches, chacune avec sa source unique, mondiale.
  it('propose GEBCO et la NOAA, chacune avec une source mondiale sans clé', () => {
    // Les deux identifiants, dans l'ordre.
    expect(SEAFLOOR_LAYERS.map((l) => l.id)).toEqual(['earth-gebco', 'earth-ncei']);
    // Chaque source : monde entier, sans clé, dès le niveau 0, avec une mention.
    for (const { source } of SEAFLOOR_LAYERS) {
      // Pas d'emprise : monde entier.
      expect(source.bboxes).toBeUndefined();
      // Pas de clé.
      expect(source.keyEnv).toBeUndefined();
      // Dès le niveau 0.
      expect(source.minZoom).toBe(0);
      // Une mention.
      expect(source.attribution.length).toBeGreaterThan(10);
    // Fin du parcours.
    }
    // La table retrouve chaque couche.
    expect(SEAFLOOR_BY_ID.get('earth-ncei')?.source.id).toBe('ncei');
  // Fin du test.
  });

  // Test : la tuile GEBCO est une requête WMS 1.3.0 sur son emprise.
  it('demande la tuile GEBCO au WMS, en Web Mercator, sur l’emprise de la tuile', () => {
    // Adresse de la tuile 3/4/2.
    const [url] = SEAFLOOR_BY_ID.get('earth-gebco')!.source.urls(3, 4, 2, '');
    // Service, version, couche, projection, emprise et taille.
    expect(url).toContain('https://wms.gebco.net/mapserv?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap');
    // La couche.
    expect(url).toContain(`LAYERS=${GEBCO_LAYER}`);
    // La projection et l'emprise.
    expect(url).toContain(`CRS=EPSG:3857&BBOX=${mercatorBbox(3, 4, 2)}&WIDTH=256&HEIGHT=256`);
  // Fin du test.
  });

  // Test : la tuile NOAA est une image exportée avec la fonction de rendu en couleurs.
  it('exporte la tuile NOAA en Web Mercator avec le relief en couleurs', () => {
    // Adresse de la tuile 5/10/12 sur une base d'essai.
    const url = nceiTileUrl(5, 10, 12, 'https://exemple.test/ImageServer');
    // Export sur l'emprise de la tuile, en 3857.
    expect(url.startsWith(`https://exemple.test/ImageServer/exportImage?bbox=${mercatorBbox(5, 10, 12)}&bboxSR=3857&imageSR=3857`)).toBe(true);
    // 256 px, JPEG, image directe.
    expect(url).toContain('&size=256,256&format=jpg&');
    // Fonction de rendu, encodée.
    expect(decodeURIComponent(url)).toContain(`{"rasterFunction":"${NCEI_RENDERING}"}`);
    // Renvoyée comme image.
    expect(url.endsWith('&f=image')).toBe(true);
  // Fin du test.
  });

  // Test : la fusion dans la couche unique donne les tuiles GEBCO relayées et les altitudes Terrarium, et se coupe.
  it('décrit la fusion des fonds marins, et EARTH_SEAFLOOR=0 la coupe', () => {
    // Réglage par défaut.
    const fusion = seafloorFusion({});
    // Les tuiles GEBCO passent par le relais de ce serveur.
    expect(fusion?.template).toBe('/api/v1/tiles/earth/earth-gebco/{z}/{x}/{y}');
    // La NOAA en secours.
    expect(fusion?.fallbackTemplate).toBe('/api/v1/tiles/earth/earth-ncei/{z}/{x}/{y}');
    // Jusqu'au niveau 10.
    expect(fusion?.maxZoom).toBe(SEAFLOOR_FUSION_MAX_ZOOM);
    // Les altitudes viennent des tuiles Terrarium.
    expect(fusion?.mask.template).toContain('terrarium/{z}/{x}/{y}.png');
    // La chlorophylle, pour la couleur réelle de l'eau.
    expect(fusion?.chlorophyll?.url).toBe('/api/v1/tiles/earth-chlorophyll.png');
    // EARTH_OCEAN_COLOUR=0 retire seulement la chlorophylle.
    expect(seafloorFusion({ EARTH_OCEAN_COLOUR: '0' })?.chlorophyll).toBeUndefined();
    // Coupée : null.
    expect(seafloorFusion({ EARTH_SEAFLOOR: '0' })).toBe(null);
  // Fin du test.
  });
// Fin du groupe.
});
