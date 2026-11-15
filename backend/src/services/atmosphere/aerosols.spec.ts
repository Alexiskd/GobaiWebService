// Fonctions testées.
import { AEROSOL_CODE_SCALE, camsMapUrl, camsTimes, colormapDecoder, decodeAerosol, decodeAerosolImage, detectPlumes, encodeAerosol, findColormapHref, gibsWmsUrl, mergeCodes, parseGibsColormap, plumeNature, plumeToEvent, rangeValue, utcDay } from './aerosols';

// Table de couleurs d'essai au format GIBS 1.3 : un bloc « sans donnée », puis les valeurs (dont une borne infinie) (début).
const XML = [
  // En-tête XML.
  '<?xml version="1.0" encoding="UTF-8"?>',
  // Ouverture des tables.
  '<ColorMaps xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
  // Bloc « sans donnée » : écarté.
  '<ColorMap title="No Data"><Entries><ColorMapEntry rgb="0,0,0" transparent="true" sourceValue="0" nodata="true" ref="0"/></Entries></ColorMap>',
  // Ouverture du bloc des valeurs.
  '<ColorMap title="Aerosol Optical Depth" units=""><Entries>',
  // De 0 à 0,1 : valeur 0,05.
  '<ColorMapEntry rgb="255,255,229" transparent="false" sourceValue="[1,2)" value="[0.000,0.100)" ref="1"/>',
  // De 0,9 à 1,1 : valeur 1.
  '<ColorMapEntry rgb="254,153,41" transparent="false" sourceValue="[2,3)" value="[0.900,1.100)" ref="2"/>',
  // 3 et plus : valeur 3.
  '<ColorMapEntry rgb="102,37,6" transparent="false" sourceValue="[3,+INF)" value="[3.000,+INF)" ref="3"/>',
  // Entrée transparente : écartée.
  '<ColorMapEntry rgb="9,9,9" transparent="true" sourceValue="[4,5)" value="[9,10)" ref="4"/>',
  // Fermetures.
  '</Entries></ColorMap></ColorMaps>',
// Fin : lignes jointes.
].join('\n');

// Groupe de tests : les aérosols.
describe('aérosols : tables de couleurs GIBS, mesures, zones, prévision CAMS', () => {
  // Test : les intervalles et la table.
  it('lit une table GIBS 1.3 : bloc « sans donnée » et entrées transparentes écartés, valeur représentative de chaque intervalle', () => {
    // Intervalles.
    expect([rangeValue('[0.000,0.100)'), rangeValue('[3.000,+INF)'), rangeValue('(-INF,2)'), rangeValue('[7]'), rangeValue(null)]).toEqual([0.05, 3, 2, 7, null]);
    // Table.
    const cm = parseGibsColormap(XML)!;
    // Titre, nombre d'entrées, bornes.
    expect([cm.title, cm.entries.length, cm.min, cm.max]).toEqual(['Aerosol Optical Depth', 3, 0.05, 3]);
    // Table de classes sans valeurs : null.
    expect(parseGibsColormap('<ColorMaps><ColorMap title="x"><Entries><ColorMapEntry rgb="1,2,3" sourceValue="1" ref="1"/></Entries></ColorMap></ColorMaps>')).toBeNull();
  // Fin du test.
  });

  // Test : le décodage des couleurs.
  it('reconvertit une couleur exacte, rapproche une couleur voisine, refuse une couleur étrangère', () => {
    // Décodeur.
    const dec = colormapDecoder(parseGibsColormap(XML)!);
    // Exacte, voisine (écart 3), étrangère.
    expect([dec(254, 153, 41), dec(254, 155, 42), dec(0, 0, 255)]).toEqual([1, 1, null]);
  // Fin du test.
  });

  // Test : le codage et l'image.
  it('code les valeurs sur un octet, décode une image (transparent : aucune mesure) et réunit deux satellites', () => {
    // Codage et décodage.
    expect([encodeAerosol(0), encodeAerosol(1), encodeAerosol(-0.4), encodeAerosol(9), decodeAerosol(51), decodeAerosol(0)]).toEqual([1, 51, 1, 255, 1, null]);
    // Image de 3 pixels : AOD ≈ 1, transparent, couleur étrangère.
    const img = { width: 3, height: 1, rgba: new Uint8Array([254, 153, 41, 255, 0, 0, 0, 0, 0, 0, 255, 255]) };
    // Décodage.
    const d = decodeAerosolImage(img, colormapDecoder(parseGibsColormap(XML)!));
    // Codes, mesurés, inconnus.
    expect([Array.from(d.codes), d.measured, d.unknown]).toEqual([[1 + AEROSOL_CODE_SCALE, 0, 0], 1, 1]);
    // Réunion : le premier satellite prioritaire, le second comble.
    expect(Array.from(mergeCodes([new Uint8Array([5, 0, 0]), new Uint8Array([9, 7, 0])]))).toEqual([5, 7, 0]);
  // Fin du test.
  });

  // Test : la table dans la description WMTS.
  it('trouve l’adresse de la table de couleurs d’une couche dans la description WMTS', () => {
    // Description d'essai : deux couches.
    const caps = '<Contents><Layer><ows:Title>A</ows:Title><ows:Identifier>COUCHE_A</ows:Identifier><ows:Metadata xlink:href="https://gibs.earthdata.nasa.gov/colormaps/v1.3/A.xml" /></Layer><Layer><ows:Identifier>COUCHE_B</ows:Identifier><ows:Metadata xlink:href="https://gibs.earthdata.nasa.gov/colormaps/v1.3/B_cm.xml" /></Layer></Contents>';
    // Couche B : sa table ; couche absente : null.
    expect([findColormapHref(caps, 'COUCHE_B'), findColormapHref(caps, 'COUCHE_C')]).toEqual(['https://gibs.earthdata.nasa.gov/colormaps/v1.3/B_cm.xml', null]);
  // Fin du test.
  });

  // Test : les zones.
  it('trouve une zone de forte charge (refermée à l’antiméridien), sa part de la veille et sa nature estimée', () => {
    // Grille d'essai 64 × 32.
    const w = 64, h = 32, t = new Uint8Array(w * h), y = new Uint8Array(w * h), ai = new Uint8Array(w * h);
    // Zone de 4 × 3 pixels à AOD 1,2, à cheval sur l'antiméridien (colonnes 62, 63, 0, 1), mesurée la veille pour moitié.
    for (let r = 14; r < 17; r++) for (const c of [62, 63, 0, 1]) { (c < 32 ? t : y)[r * w + c] = encodeAerosol(1.2); ai[r * w + c] = encodeAerosol(2.4); }
    // Zone faible (AOD 0,7, sans noyau) : écartée.
    for (let r = 5; r < 9; r++) for (let c = 20; c < 26; c++) t[r * w + c] = encodeAerosol(0.7);
    // Détection.
    const plumes = detectPlumes(t, y, ai, w, h);
    // Une zone de 12 pixels, près de ±180°, moitié de la veille, indice absorbant 2,4.
    expect([plumes.length, plumes[0].pixels, Math.abs(Math.abs(plumes[0].lon) - 180) < 3, plumes[0].fromYesterday, plumes[0].aiMax, plumes[0].max]).toEqual([1, 12, true, 0.5, 2.4, 1.2]);
    // Nature estimée : absorbante.
    expect(plumeNature(plumes[0])).toBe('aérosols absorbants : poussières ou fumées');
    // Événement : observé, nature en drapeau, heure de référence à midi du jour observé.
    const e = plumeToEvent(plumes[0], '2026-11-15', '2026-11-15T13:00:00.000Z');
    // Contrôles.
    expect([e.type, e.status, e.detectedAt, e.details.natureStatus, e.flags[0].startsWith('nature estimée')]).toEqual(['aerosol', 'observé', '2026-11-15T12:00:00.000Z', 'estimé', true]);
  // Fin du test.
  });

  // Test : adresses et heures.
  it('forme les adresses GIBS et CAMS et les heures de la prévision (toutes les 6 h sur 48 h)', () => {
    // Jour UTC et veille.
    expect([utcDay(Date.UTC(2026, 10, 15, 23, 59)), utcDay(Date.UTC(2026, 10, 15, 1), -1)]).toEqual(['2026-11-15', '2026-11-14']);
    // Adresse GIBS : couche, jour, monde entier en coordonnées géographiques.
    expect(gibsWmsUrl('L', '2026-11-15')).toMatch(/LAYERS=L&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image\/png&TRANSPARENT=TRUE&TIME=2026-11-15$/);
    // Heures : 9, la première au créneau de 6 h en cours.
    const times = camsTimes(Date.UTC(2026, 10, 15, 14, 30));
    // Contrôles.
    expect([times.length, times[0], times[8]]).toEqual([9, '2026-11-15T12:00:00Z', '2026-11-17T12:00:00Z']);
    // Adresse CAMS : jeton public, couche des poussières, heure encodée.
    expect(camsMapUrl(times[0])).toMatch(/token=public&service=WMS&version=1\.3\.0&request=GetMap&layers=composition_duaod550&.*time=2026-11-15T12%3A00%3A00Z$/);
  // Fin du test.
  });
// Fin du groupe.
});
