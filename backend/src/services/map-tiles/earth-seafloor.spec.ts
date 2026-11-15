// Importe ce qui est testé : les fonds marins, leur table, la couche GEBCO, la fonction de rendu, l'adresse NOAA et la fusion.
import { GEBCO_FLAT_LAYER, GEBCO_LAYER, ISOBATHS, MARINE_FADE_MS, NCEI_RENDERING, SEAFLOOR_BY_ID, SEAFLOOR_FUSION_MAX_ZOOM, SEAFLOOR_LAYERS, earthMarine, nceiTileUrl, seafloorFusion } from './earth-seafloor';
// Importe l'emprise Web Mercator d'une tuile.
import { mercatorBbox } from './earth-sources';

// Groupe de tests des fonds marins.
describe('fonds marins de la Terre', () => {
  // Test : trois relais, chacun avec sa source unique, mondiale.
  it('relaie GEBCO (relief ombré et carte plate) et la NOAA, chacune avec une source mondiale sans clé', () => {
    // Les trois identifiants, dans l'ordre.
    expect(SEAFLOOR_LAYERS.map((l) => l.id)).toEqual(['earth-gebco', 'earth-gebco-flat', 'earth-ncei']);
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

  // Test : la carte plate de GEBCO est demandée en PNG sur sa couche colorée.
  it('demande la carte plate de GEBCO en PNG, sur la couche colorée selon l’altitude', () => {
    // Adresse de la tuile 6/33/22.
    const [url] = SEAFLOOR_BY_ID.get('earth-gebco-flat')!.source.urls(6, 33, 22, '');
    // La couche plate.
    expect(url).toContain(`LAYERS=${GEBCO_FLAT_LAYER}&`);
    // En PNG.
    expect(url.endsWith('&FORMAT=image/png')).toBe(true);
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
    // Jusqu'au niveau 10.
    expect(fusion?.maxZoom).toBe(SEAFLOOR_FUSION_MAX_ZOOM);
    // Les altitudes viennent des tuiles Terrarium.
    expect(fusion?.mask.template).toContain('terrarium/{z}/{x}/{y}.png');
    // Coupée : null.
    expect(seafloorFusion({ EARTH_SEAFLOOR: '0' })).toBe(null);
  // Fin du test.
  });

  // Test : la carte marine donne la NOAA, GEBCO, la carte plate, le masque, le fondu, les isobathes et les mentions.
  it('décrit la carte marine NOAA / GEBCO, et EARTH_SEAFLOOR=0 la coupe', () => {
    // Réglage par défaut.
    const marine = earthMarine({});
    // La NOAA, GEBCO et sa carte plate passent par les relais de ce serveur.
    expect([marine?.noaa.template, marine?.gebco.template, marine?.flat.template]).toEqual(['/api/v1/tiles/earth/earth-ncei/{z}/{x}/{y}', '/api/v1/tiles/earth/earth-gebco/{z}/{x}/{y}', '/api/v1/tiles/earth/earth-gebco-flat/{z}/{x}/{y}']);
    // Le masque de la mer reste celui des altitudes Terrarium.
    expect(marine?.mask.template).toContain('terrarium/{z}/{x}/{y}.png');
    // La durée du fondu et les isobathes viennent du serveur.
    expect(marine?.fadeMs).toBe(MARINE_FADE_MS);
    // Isobathes.
    expect(marine?.isobaths).toEqual(ISOBATHS);
    // Deux mentions : la NOAA (ETOPO 2022), puis GEBCO, qui rappelle « pas pour la navigation ».
    expect(marine?.credits[0]).toContain('ETOPO 2022');
    // GEBCO.
    expect(marine?.credits[1]).toContain('pas pour la navigation');
    // Coupée : null.
    expect(earthMarine({ EARTH_SEAFLOOR: 'off' })).toBe(null);
  // Fin du test.
  });
// Fin du groupe.
});
