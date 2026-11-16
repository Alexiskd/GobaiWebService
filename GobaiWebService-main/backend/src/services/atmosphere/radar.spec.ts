// Fonctions testées.
import { COVERAGE, DBZ_CODE_OFFSET, PALETTE, RAINVIEWER_HOST, dbzOfCode, decodeRadarColor, decodeRadarTile, isRadarTile, parseWeatherMaps, radarTileUrl, radarToRgb, rainRateMmH } from './radar';

// hex : « rrggbbaa » → quatre octets.
const hex = (h: string): [number, number, number, number] => [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number, number];

// Groupe de tests : le radar Rain Viewer.
describe('radar : table Universal Blue, index et décodage', () => {
  // Test : la table.
  it('contient la pluie de −10 à 65 dBZ et la neige de −9 à 75 dBZ, sans couleur partagée entre pluie et neige', () => {
    // Entrées de pluie et de neige.
    const rain = PALETTE.filter((e) => !e.snow), snow = PALETTE.filter((e) => e.snow);
    // Bornes et nombres (la neige à −10 dBZ est transparente, donc absente).
    expect([rain.length, rain[0].dbz, rain[rain.length - 1].dbz, snow.length, snow[0].dbz, snow[snow.length - 1].dbz]).toEqual([76, -10, 65, 85, -9, 75]);
    // Couleurs de la pluie et de la neige.
    const r = new Set(rain.map((e) => e.rgba.join())), s = snow.map((e) => e.rgba.join());
    // Aucune couleur commune.
    expect(s.filter((c) => r.has(c))).toEqual([]);
  // Fin du test.
  });

  // Test : le décodage d'une couleur.
  it('reconvertit les couleurs exactes, rapproche une couleur voisine et refuse une couleur étrangère', () => {
    // 20 dBZ de pluie.
    expect(decodeRadarColor(...hex('00a3e0ff'))).toEqual({ rgba: hex('00a3e0ff'), dbz: 20, snow: false });
    // 35 dBZ de neige.
    expect(decodeRadarColor(...hex('3f7fffff'))?.dbz).toBe(35);
    // 45 dBZ de pluie (rouge-orangé), et blanc saturé : 65 dBZ.
    expect([decodeRadarColor(...hex('ff4400ff'))?.dbz, decodeRadarColor(...hex('ffffffff'))?.dbz]).toEqual([45, 65]);
    // Transparent : aucun écho.
    expect(decodeRadarColor(0, 0, 0, 0)).toBeNull();
    // Couleur voisine (un écart de 2) : rapprochée de 45 dBZ.
    expect(decodeRadarColor(255, 70, 0, 255)?.dbz).toBe(45);
    // Vert franc, absent de la table : inconnu.
    expect(decodeRadarColor(0, 255, 0, 255)).toBeNull();
  // Fin du test.
  });

  // Test : l'index.
  it('lit l’index (chemins opaques), trie les images et refuse un hôte inattendu', () => {
    // Index d'essai (identifiants opaques, comme depuis 2025).
    const j = { version: '2.0', generated: 1_700_000_900, host: RAINVIEWER_HOST, radar: { past: [{ time: 1_700_000_600, path: '/v2/radar/bbbb2222' }, { time: 1_700_000_000, path: '/v2/radar/aaaa1111' }, { time: 1, path: '/v2/radar/../x' }] } };
    // Lecture.
    const idx = parseWeatherMaps(j);
    // Images triées, chemin invalide écarté, heures en ms.
    expect(idx?.frames).toEqual([{ id: 'aaaa1111', time: 1_700_000_000_000 }, { id: 'bbbb2222', time: 1_700_000_600_000 }]);
    // Hôte inattendu : refusé.
    expect(parseWeatherMaps({ ...j, host: 'https://exemple.org' })).toBeNull();
    // Sans liste : refusé.
    expect(parseWeatherMaps({ host: RAINVIEWER_HOST })).toBeNull();
  // Fin du test.
  });

  // Test : adresses et niveaux.
  it('forme l’adresse des tuiles (512 px, jeu 2, sans lissage, neige distinguée) et borne les niveaux à 7', () => {
    // Adresse.
    expect(radarTileUrl('abcd', 2, 1, 3)).toBe('https://tilecache.rainviewer.com/v2/radar/abcd/512/2/1/3/2/0_1.png');
    // Niveaux.
    expect([isRadarTile(7, 127, 0), isRadarTile(8, 0, 0), isRadarTile(1, 2, 0), isRadarTile(0, 0, 0)]).toEqual([true, false, false, true]);
  // Fin du test.
  });

  // Test : le décodage d'une tuile.
  it('décode une tuile en codes de pluie, de neige et de couverture, et compte les couleurs inconnues', () => {
    // Quatre pixels : pluie 40 dBZ, neige 20 dBZ, transparent, vert inconnu.
    const rgba = new Uint8Array([...hex('ffaa00ff'), ...hex('7fbfffff'), 0, 0, 0, 0, 0, 255, 0, 255]);
    // Masque de couverture : le troisième pixel hors de portée.
    const d = decodeRadarTile({ width: 4, height: 1, rgba }, new Uint8Array([1, 1, 0, 1]));
    // Codes de la pluie.
    expect(Array.from(d.rain)).toEqual([40 + DBZ_CODE_OFFSET, 0, 0, 0]);
    // Codes de la neige.
    expect(Array.from(d.snow)).toEqual([0, 20 + DBZ_CODE_OFFSET, 0, 0]);
    // Couverture.
    expect(Array.from(d.coverage)).toEqual([COVERAGE.covered, COVERAGE.covered, COVERAGE.none, COVERAGE.covered]);
    // Bilan.
    expect([d.echoes, d.unknown]).toEqual([2, 1]);
    // Sans masque : couverture inconnue hors des échos.
    expect(Array.from(decodeRadarTile({ width: 4, height: 1, rgba }, null).coverage)).toEqual([COVERAGE.covered, COVERAGE.covered, COVERAGE.unknown, COVERAGE.unknown]);
    // Pixels RVB envoyés : pluie, neige, couverture.
    expect(Array.from(radarToRgb(d)).slice(0, 6)).toEqual([51, 0, 255, 0, 31, 255]);
    // Codes relus.
    expect([dbzOfCode(51), dbzOfCode(0)]).toEqual([40, null]);
  // Fin du test.
  });

  // Test : l'intensité estimée.
  it('estime l’intensité par Marshall-Palmer (pluie) et Z = 2 000 R² (neige)', () => {
    // 20, 40 et 50 dBZ de pluie ; 30 dBZ de neige.
    expect([rainRateMmH(20), rainRateMmH(40), rainRateMmH(50), rainRateMmH(30, true)]).toEqual([0.6, 11.5, 48.6, 0.7]);
  // Fin du test.
  });
// Fin du groupe.
});
