// Fonctions testées.
import { MIN_HOTSPOT_CONFIDENCE, SAT_BITS, aggregateHotspots, hotspotToEvent, hotspotsInBounds, parseAcquisition, parseConfidence, parseFirmsCsv, prepareHotspots, satellitesOf } from './firms';

// En-tête et lignes réelles du fichier VIIRS NOAA-20 de FIRMS (20 octobre 2026).
const VIIRS = [
  // En-tête.
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight',
  // Trois détections de nuit.
  '43.54181,16.43759,295.29,0.5,0.66,2026-10-20,0001,N20,nominal,2.0NRT,284.4,1.23,N',
  // Deuxième.
  '42.71803,24.16994,305.69,0.4,0.44,2026-10-20,0001,N20,nominal,2.0NRT,273.95,1.74,N',
  // Troisième : confiance faible.
  '38.89507,41.56676,296.07,0.36,0.57,2026-10-20,0001,N20,low,2.0NRT,279.25,0.57,N',
// Fin des lignes.
].join('\n');
// En-tête et lignes réelles du fichier MODIS de FIRMS (13 novembre 2026).
const MODIS = [
  // En-tête.
  'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight',
  // Deux détections Terra.
  '-34.88919,-57.9215,306.53,2.14,1.42,2026-11-13,0017,T,68,6.1NRT,288.99,22.53,N',
  // Seconde.
  '-30.13363,-51.52654,362.58,1,1,2026-11-13,0020,T,100,6.1NRT,294.05,94.24,N',
// Fin des lignes.
].join('\n');

// Groupe de tests : les points chauds de NASA FIRMS.
describe('points chauds NASA FIRMS', () => {
  // Test : la lecture des champs.
  it('lit la confiance VIIRS (texte) et MODIS (pourcentage), et l’heure de passage UTC', () => {
    // VIIRS nominale.
    expect(parseConfidence('nominal')).toBe(0.65);
    // VIIRS faible, forme courte.
    expect(parseConfidence('l')).toBe(0.3);
    // MODIS 68 %.
    expect(parseConfidence('68')).toBeCloseTo(0.68, 5);
    // Illisible : nulle.
    expect(parseConfidence('?')).toBe(0);
    // Heure « 0017 » du 13 novembre 2026.
    expect(parseAcquisition('2026-11-13', '0017')).toBe(Date.UTC(2026, 10, 13, 0, 17));
    // Heure sans zéros de tête.
    expect(parseAcquisition('2026-11-13', '5')).toBe(Date.UTC(2026, 10, 13, 0, 5));
    // Heure impossible.
    expect(parseAcquisition('2026-11-13', '2575')).toBeNaN();
  // Fin du test.
  });

  // Test : les fichiers réels.
  it('lit les fichiers VIIRS et MODIS : satellite, pixel, puissance, nuit', () => {
    // Lecture VIIRS.
    const v = parseFirmsCsv(VIIRS, 'firms-viirs-n20');
    // Trois points.
    expect(v).toHaveLength(3);
    // Premier point : position, satellite NOAA-20, pixel de 375 m, puissance, nuit.
    expect(v[0]).toEqual({ lon: 16.43759, lat: 43.54181, t: Date.UTC(2026, 9, 20, 0, 1), frp: 1.23, conf: 0.65, sats: SAT_BITS.N20, resM: 375, night: true, n: 1 });
    // Lecture MODIS.
    const m = parseFirmsCsv(MODIS, 'firms-modis');
    // Pixel de 1 km, satellite Terra.
    expect(m[1].resM).toBe(1000);
    // Masque de Terra.
    expect(m[1].sats).toBe(SAT_BITS.T);
    // Confiance 100 %.
    expect(m[1].conf).toBe(1);
  // Fin du test.
  });

  // Test : les fichiers inattendus.
  it('rend une liste vide pour un fichier inattendu ou des lignes illisibles', () => {
    // Sans colonnes de position.
    expect(parseFirmsCsv('a,b,c\n1,2,3', 'firms-modis')).toEqual([]);
    // Texte vide.
    expect(parseFirmsCsv('', 'firms-modis')).toEqual([]);
    // Ligne hors du globe : ignorée.
    expect(parseFirmsCsv(`${VIIRS.split('\n')[0]}\n120,10,1,1,1,2026-10-20,0001,N20,high,2,1,1,D`, 'firms-viirs-n20')).toEqual([]);
  // Fin du test.
  });

  // Test : la fusion entre satellites.
  it('réunit le même lieu vu par deux satellites, garde distincts les pixels voisins d’une même image', () => {
    // Heure de référence.
    const t = Date.UTC(2026, 10, 14, 12, 0);
    // Détection NOAA-20.
    const a = { lon: 10, lat: 45, t, frp: 5, conf: 0.65, sats: SAT_BITS.N20, resM: 375, night: false, n: 1 };
    // Même lieu (100 m) vu par Suomi NPP 40 min plus tard.
    const b = { ...a, lon: 10.0012, t: t + 40 * 60_000, frp: 8, sats: SAT_BITS.N };
    // Pixel voisin (375 m) de la même image NOAA-20.
    const c = { ...a, lon: 10.0048 };
    // Préparation.
    const { hotspots, stats } = prepareHotspots([[a, c], [b]]);
    // Deux points : le lieu réuni et le pixel voisin.
    expect(hotspots).toHaveLength(2);
    // Une fusion.
    expect(stats.merged).toBe(1);
    // Point réuni : deux satellites.
    const merged = hotspots.find((h) => h.n === 2)!;
    // Ses satellites.
    expect(satellitesOf(merged.sats).sort()).toEqual(['N', 'N20']);
    // Puissance la plus forte, heure la plus récente.
    expect([merged.frp, merged.t]).toEqual([8, t + 40 * 60_000]);
    // Confiance combinée : 1 − 0,35² ≈ 0,88.
    expect(merged.conf).toBeCloseTo(0.88, 2);
  // Fin du test.
  });

  // Test : la confiance minimale.
  it('écarte un point peu sûr isolé, garde un point peu sûr confirmé par un autre satellite', () => {
    // Heure de référence.
    const t = Date.UTC(2026, 10, 14, 12, 0);
    // Point faible isolé.
    const lone = { lon: 30, lat: 0, t, frp: 1, conf: 0.3, sats: SAT_BITS.N20, resM: 375, night: false, n: 1 };
    // Point faible ailleurs, vu aussi par MODIS (40 %).
    const weak = { ...lone, lon: 40 };
    // Confirmation MODIS à 300 m.
    const modis = { ...weak, lon: 40.0027, conf: 0.4, sats: SAT_BITS.A, resM: 1000 };
    // Préparation.
    const { hotspots, stats } = prepareHotspots([[lone, weak], [modis]]);
    // Seul le point confirmé reste.
    expect(hotspots.map((h) => h.lon)).toEqual([40]);
    // Un point écarté.
    expect(stats.dropped).toBe(1);
    // Au-dessus du seuil.
    expect(hotspots[0].conf).toBeGreaterThanOrEqual(MIN_HOTSPOT_CONFIDENCE);
  // Fin du test.
  });

  // Test : l'agrégation et le détail.
  it('agrège en cellules (barycentre, puissance totale, âge) et sert le détail d’une emprise, sans données périmées', () => {
    // Instant de référence.
    const now = Date.UTC(2026, 10, 14, 12, 0);
    // Deux points dans la même cellule de 0,5°, un troisième périmé (25 h).
    const h = [
      // Premier, il y a 2 h.
      { lon: 10.1, lat: 45.1, t: now - 2 * 3_600_000, frp: 3, conf: 0.9, sats: 1, resM: 375, night: false, n: 1 },
      // Second, il y a 30 min.
      { lon: 10.3, lat: 45.3, t: now - 30 * 60_000, frp: 7, conf: 0.65, sats: 4, resM: 375, night: false, n: 1 },
      // Périmé.
      { lon: 10.2, lat: 45.2, t: now - 25 * 3_600_000, frp: 100, conf: 0.9, sats: 1, resM: 375, night: false, n: 1 },
    // Fin des points.
    ];
    // Cellules.
    const cells = aggregateHotspots(h, 0.5, now);
    // Une cellule : barycentre, puissance totale, deux points, âge 30 min, confiance max, satellites.
    expect(cells).toEqual({ cellDeg: 0.5, count: 1, lon: [10.2], lat: [45.2], frp: [10], n: [2], ageMin: [30], conf: [0.9], sats: [5] });
    // Détail de l'emprise : deux points récents.
    expect(hotspotsInBounds(h, [10, 45, 11, 46], now).count).toBe(2);
    // Hors de l'emprise : aucun.
    expect(hotspotsInBounds(h, [0, 0, 1, 1], now).count).toBe(0);
  // Fin du test.
  });

  // Test : le format commun.
  it('rend un point chaud au format commun : observé, NON confirmé, une provenance par satellite', () => {
    // Point vu par NOAA-20 et Aqua.
    const e = hotspotToEvent({ lon: 1, lat: 2, t: Date.UTC(2026, 10, 14), frp: 12.5, conf: 0.9, sats: SAT_BITS.N20 | SAT_BITS.A, resM: 375, night: true, n: 2 }, '2026-11-14T01:00:00.000Z');
    // Famille et statut.
    expect([e.type, e.status, e.confirmed]).toEqual(['hotspot', 'observé', false]);
    // Deux provenances.
    expect(e.sources.map((s) => s.provider)).toEqual(['firms-viirs-n20', 'firms-modis']);
    // Intensité : la puissance radiative.
    expect(e.intensity).toEqual({ value: 12.5, unit: 'MW', label: 'Puissance radiative du feu (FRP)' });
  // Fin du test.
  });
// Fin du groupe.
});
