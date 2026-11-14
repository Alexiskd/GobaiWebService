// Ce qui est testé.
import { CLOUD_BATCH, CLOUD_GRID, cloudCoverUrls, cloudGridPoints, parseCloudCover } from './earth-cloud-cover';

// Fonction answers : fabrique de fausses réponses d'Open-Meteo, à partir d'une fonction qui donne la valeur de chaque point.
const answers = (value: (i: number) => unknown): unknown[] => {
  // Un faux point par point de la grille.
  const points = cloudGridPoints().map((_p, i) => ({ current: { time: '2026-11-11T22:00', cloud_cover: value(i) } }));
  // Réponses produites.
  const out: unknown[] = [];
  // Découpe les points par paquets, comme les vraies requêtes.
  for (let i = 0; i < points.length; i += CLOUD_BATCH) out.push(points.slice(i, i + CLOUD_BATCH));
  // Renvoie les réponses.
  return out;
// Fin de answers.
};

// Groupe de tests de la couverture nuageuse.
describe('couverture nuageuse de la Terre (Open-Meteo)', () => {
  // Premier test : les points.
  it('place les points au centre des cases, du sud au nord depuis 180° Ouest', () => {
    // Points de la grille.
    const points = cloudGridPoints();
    // Il y en a 288.
    expect(points.length).toBe(288);
    // Le premier est au centre de la case du sud-ouest.
    expect(points[0]).toEqual({ lat: -82.5, lon: -172.5 });
    // Le dernier de la première ligne est à l'est.
    expect(points[23]).toEqual({ lat: -82.5, lon: 172.5 });
    // Le dernier est au nord-est.
    expect(points[287]).toEqual({ lat: 82.5, lon: 172.5 });
  // Fin du test.
  });

  // Deuxième test : les adresses.
  it('demande la couverture du moment en trois requêtes courtes', () => {
    // Adresses à appeler.
    const urls = cloudCoverUrls();
    // Il y en a trois.
    expect(urls.length).toBe(3);
    // Pour chacune :
    for (const url of urls) {
      // elle vise Open-Meteo ;
      expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
      // elle demande la couverture du moment ;
      expect(url).toContain('current=cloud_cover');
      // elle fait moins de 2 000 caractères.
      expect(url.length).toBeLessThan(2000);
    // Fin de la boucle.
    }
    // La première porte 96 latitudes.
    expect(new URL(urls[0]).searchParams.get('latitude')!.split(',').length).toBe(96);
  // Fin du test.
  });

  // Troisième test : la conversion.
  it('convertit les pourcentages en octets, dans l’ordre de la grille', () => {
    // Grille où le premier point vaut 0 %, le deuxième 100 %, les autres 50 %.
    const grid = parseCloudCover(answers((i) => (i === 0 ? 0 : i === 1 ? 100 : 50)));
    // Octets décodés.
    const bytes = Buffer.from(grid.cover, 'base64');
    // Largeur de la grille.
    expect(grid.width).toBe(CLOUD_GRID.width);
    // Hauteur de la grille.
    expect(grid.height).toBe(CLOUD_GRID.height);
    // 288 octets.
    expect(bytes.length).toBe(288);
    // 0 % donne 0.
    expect(bytes[0]).toBe(0);
    // 100 % donne 255.
    expect(bytes[1]).toBe(255);
    // 50 % donne 128.
    expect(bytes[2]).toBe(128);
    // Heure de validité.
    expect(grid.validAt).toBe('2026-11-11T22:00');
    // Moyenne de 50 %.
    expect(grid.mean).toBe(50);
  // Fin du test.
  });

  // Quatrième test : bornes et erreurs.
  it('borne les valeurs et refuse une réponse incomplète', () => {
    // Grille de valeurs hors limites : 140 % et −5 %.
    const bytes = Buffer.from(parseCloudCover(answers((i) => (i % 2 ? 140 : -5))).cover, 'base64');
    // −5 % est ramené à 0.
    expect(bytes[0]).toBe(0);
    // 140 % est ramené à 255.
    expect(bytes[1]).toBe(255);
    // Un point sans valeur fait échouer la lecture.
    expect(() => parseCloudCover(answers((i) => (i === 7 ? null : 20)))).toThrow();
    // Une réponse d'un seul point aussi.
    expect(() => parseCloudCover([[{ current: { cloud_cover: 10 } }]])).toThrow();
    // Une réponse d'erreur aussi.
    expect(() => parseCloudCover([{ error: true, reason: 'limite atteinte' }])).toThrow();
  // Fin du test.
  });
// Fin du groupe.
});
