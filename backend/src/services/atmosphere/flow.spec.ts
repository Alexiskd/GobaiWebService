// Fonctions testées.
import { FLOW_GRID, FLOW_LEVELS, JET_MIN_MS, LevelWinds, detectJets, flowPoints, flowUrl, jetToEvent, parseFlow } from './flow';

// Nombre de points de la grille.
const N = FLOW_GRID.width * FLOW_GRID.height;
// response : réponse d'essai d'Open-Meteo ; `wind(lon, lat)` donne [vitesse, direction] pour tous les niveaux.
const response = (wind: (lon: number, lat: number) => [number, number], drop?: string) => flowPoints().map((p) => ({ current: { time: '2026-11-15T16:45', ...Object.fromEntries(FLOW_LEVELS.flatMap((l): [string, number | null][] => { const [s, d] = wind(p.lon, p.lat); return l.speed === drop ? [[l.speed, null], [l.dir, null]] : [[l.speed, s], [l.dir, d]]; })) } }));
// levelOf : vents d'un niveau à partir de composantes données par une fonction.
const levelOf = (uv: (lon: number, lat: number) => [number, number]): LevelWinds => { const u: number[] = [], v: number[] = []; flowPoints().forEach((p) => { const [a, b] = uv(p.lon, p.lat); u.push(a); v.push(b); }); return { u, v, maxMs: 0 }; };

// Groupe de tests : les vents et les courants-jets.
describe('vents : grille Open-Meteo, niveaux, courants-jets', () => {
  // Test : la grille et l'adresse.
  it('forme 510 points (12° × 10°) et une seule requête avec 8 variables en m/s', () => {
    // Points, premier et dernier.
    const pts = flowPoints();
    // Contrôles.
    expect([pts.length, pts[0], pts[N - 1]]).toEqual([510, { lon: -180, lat: -80 }, { lon: 168, lat: 80 }]);
    // Adresse : variables du moment et unité.
    expect(decodeURIComponent(flowUrl())).toMatch(/current=wind_speed_10m,wind_direction_10m,wind_speed_850hPa,wind_direction_850hPa,wind_speed_500hPa,wind_direction_500hPa,wind_speed_250hPa,wind_direction_250hPa&wind_speed_unit=ms$/);
  // Fin du test.
  });

  // Test : la lecture.
  it('lit les composantes (vent d’ouest : vers l’est), la vitesse maximale, et rend indisponible un niveau incomplet', () => {
    // Vent d'ouest de 20 m/s partout (vient de 270°).
    const r = parseFlow(response(() => [20, 270], 'wind_speed_500hPa'))!;
    // Composantes au sol : 20 vers l'est, 0 vers le nord ; vitesse maximale.
    expect([r.levels['10m']!.u[0], Math.abs(r.levels['10m']!.v[0]), r.levels['10m']!.maxMs, r.validAt]).toEqual([20, 0, 20, '2026-11-15T16:45']);
    // 500 hPa : valeur nulle → indisponible.
    expect(r.levels['500hPa']).toBeNull();
    // Mauvais nombre de points : null.
    expect(parseFlow([{}, {}])).toBeNull();
  // Fin du test.
  });

  // Test : les courants-jets.
  it('relie les maxima ≥ 30 m/s en axes (tour complet au nord, axe partiel au sud), ignore les vents faibles', () => {
    // Nord : jet de 50 m/s à 40° N tout autour du globe ; sud : jet de 35 m/s à 50° S de 0° à 60° E ; ailleurs 10 m/s.
    const w = levelOf((lon, lat) => (lat === 40 ? [50, 0] : lat === -50 && lon >= 0 && lon <= 60 ? [35, 0] : [10, 0]));
    // Détection.
    const jets = detectJets(w);
    // Deux axes : le nord (30 colonnes), puis le sud (6 colonnes : 0° à 60°).
    expect(jets.map((j) => [j.hemisphere, j.points.length, j.maxMs])).toEqual([['nord', 30, 50], ['sud', 6, 35]]);
    // Latitudes : 40° N et 50° S.
    expect([jets[0].points[0][1], jets[1].points[0][1]]).toEqual([40, -50]);
    // Vents faibles seulement : aucun axe.
    expect(detectJets(levelOf(() => [JET_MIN_MS - 1, 0]))).toEqual([]);
  // Fin du test.
  });

  // Test : le format commun.
  it('rend un axe au format commun : ligne, vitesse en km/h, estimé (sortie de modèle)', () => {
    // Axe d'essai.
    const e = jetToEvent({ points: [[0, 40, 40], [12, 42, 62], [24, 41, 50]], maxMs: 62, meanMs: 50.7, hemisphere: 'nord', lengthKm: 2000 }, '2026-11-15T16:45:00.000Z', '2026-11-15T16:50:00.000Z');
    // Famille, géométrie, position du maximum, intensité, statut.
    expect([e.type, e.geometry.type, e.lon, e.lat, e.intensity.value, e.intensity.label, e.status, e.confirmed]).toEqual(['jet-stream', 'LineString', 12, 42, 223, 'courant-jet très fort', 'estimé', false]);
  // Fin du test.
  });
// Fin du groupe.
});
