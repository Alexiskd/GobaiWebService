/**
 * Lecture des régions actives du Soleil et des éruptions localisées. Les contrôles portent sur la forme réelle des
 * deux flux : « solar_regions.json » de la NOAA (une ligne par région et par jour d'observation) et « FLR » de
 * DONKI (une ligne par éruption, avec le lieu de départ écrit « N16E35 »). Aucun appel réseau n'est fait ici : les
 * fonctions testées ne font que lire du JSON déjà reçu.
 */
import { donkiDate, parseLocatedFlares, parseRegions, parseStonyhurst } from './solar-regions.service';

// Groupe de tests.
describe('solar-regions', () => {
  // Test : la lecture d'une position écrite à la manière de la NOAA.
  it('lit une position héliographique « N16E35 »', () => {
    // Nord et est : latitude positive, longitude négative.
    expect(parseStonyhurst('N16E35')).toEqual({ lat: 16, lon: -35 });
    // Sud et ouest : latitude négative, longitude positive.
    expect(parseStonyhurst('S23W90')).toEqual({ lat: -23, lon: 90 });
    // Les espaces et la casse sont tolérés.
    expect(parseStonyhurst(' n05 w07 ')).toEqual({ lat: 5, lon: 7 });
    // Une longitude à trois chiffres, comme pour une éruption passée derrière le limbe.
    expect(parseStonyhurst('S17W99')).toEqual({ lat: -17, lon: 99 });
  // Fin du test.
  });

  // Test : les positions illisibles.
  it('écarte les positions illisibles', () => {
    // Texte vide, absent ou d'une autre forme.
    for (const bad of ['', '  ', 'N16', 'E35', 'X16E35', 'inconnue', null, undefined, 42]) {
      // Aucune de ces valeurs ne donne de position.
      expect(parseStonyhurst(bad)).toBeNull();
    // Fin de la boucle.
    }
    // Une latitude hors des bornes physiques est refusée.
    expect(parseStonyhurst('N95W10')).toBeNull();
  // Fin du test.
  });

  // Test : la lecture des régions actives.
  it('ne garde que le dernier jour observé, une entrée par région, la plus grande d’abord', () => {
    // Un flux à deux jours, avec une région répétée et une ligne sans position.
    const regions = parseRegions([
      // Une région de la veille : écartée, puisqu'un jour plus récent est présent.
      { observed_date: '2026-11-08', region: 4571, latitude: -18, longitude: -80, area: 10 },
      // Une petite région du dernier jour.
      { observed_date: '2026-11-09', region: 4571, latitude: -18, longitude: -69, carrington_longitude: 195, area: 10, number_spots: 2, c_flare_probability: 15 },
      // Une grande région du dernier jour.
      { observed_date: '2026-11-09', region: 4572, latitude: 12, longitude: 30, area: 240, number_spots: 14, spot_class: 'Dao', mag_class: 'Beta', m_flare_probability: 25, x_flare_probability: 5 },
      // Une ligne sans position : écartée.
      { observed_date: '2026-11-09', region: 4573, latitude: null, longitude: null, area: 90 },
    // Fin du flux.
    ]);
    // Deux régions seulement sont retenues.
    expect(regions).toHaveLength(2);
    // La plus grande vient en premier.
    expect(regions[0].number).toBe(4572);
    // Sa position et ses probabilités sont lues.
    expect(regions[0]).toMatchObject({ lat: 12, lon: 30, area: 240, spots: 14, spotClass: 'Dao', magClass: 'Beta' });
    // Ses probabilités, les champs absents valant zéro.
    expect(regions[0].probability).toEqual({ c: 0, m: 25, x: 5 });
    // La seconde région est celle du dernier jour, avec sa longitude de ce jour-là et non celle de la veille.
    expect(regions[1]).toMatchObject({ number: 4571, lon: -69, carringtonLon: 195, observedAt: '2026-11-09' });
  // Fin du test.
  });

  // Test : un flux absent ou vide.
  it('rend une liste vide quand le flux des régions manque', () => {
    // Pour chacune de ces valeurs,
    for (const bad of [null, undefined, {}, [], 'erreur']) {
      // aucune région n'est rendue.
      expect(parseRegions(bad)).toEqual([]);
    // Fin de la boucle.
    }
  // Fin du test.
  });

  // Test : la lecture des éruptions localisées.
  it('lit les éruptions de DONKI, les plus récentes d’abord, et écarte celles sans lieu', () => {
    // Un flux à trois éruptions, dont une sans lieu de départ.
    const flares = parseLocatedFlares([
      // Une éruption ancienne.
      { classType: 'M1.2', beginTime: '2026-04-23T04:50Z', peakTime: '2026-04-23T04:59Z', endTime: '2026-04-23T05:08Z', sourceLocation: 'N16E35', activeRegionNum: 14420 },
      // Une éruption récente, dans une région non encore numérotée.
      { classType: 'X2.0', beginTime: '2026-04-26T19:18Z', peakTime: '2026-04-26T19:24Z', endTime: '2026-04-26T19:27Z', sourceLocation: 'S05W40', activeRegionNum: null },
      // Une éruption sans lieu : écartée.
      { classType: 'C7.4', peakTime: '2026-04-27T10:00Z', sourceLocation: '' },
      // Une ligne sans classe : écartée.
      { beginTime: '2026-04-27T11:00Z', sourceLocation: 'N10W10' },
    // Fin du flux.
    ]);
    // Deux éruptions seulement sont retenues.
    expect(flares).toHaveLength(2);
    // La plus récente vient en premier, avec sa position et sa région.
    expect(flares[0]).toMatchObject({ cls: 'X2.0', lat: -5, lon: 40, region: null });
    // La plus ancienne vient ensuite.
    expect(flares[1]).toMatchObject({ cls: 'M1.2', lat: 16, lon: -35, region: 14420 });
  // Fin du test.
  });

  // Test : la date au format de DONKI.
  it('écrit la date au format attendu par DONKI', () => {
    // Un instant connu donne sa seule partie date, en UTC.
    expect(donkiDate(Date.UTC(2026, 10, 14, 23, 30))).toBe('2026-11-14');
  // Fin du test.
  });
// Fin du groupe.
});
