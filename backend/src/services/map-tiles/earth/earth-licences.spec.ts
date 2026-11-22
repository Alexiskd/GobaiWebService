// Garde-fou des licences : aucune image d'une source non commerciale dans un export vendu.
import { EARTH_SOURCES } from './earth-sources';
import { EARTH_LICENCES, isCommercialSource, maxCommercialEarthZoom } from './earth-licences';

describe('licences des sources de la Terre', () => {
  it('chaque source d’images a une licence déclarée', () => {
    for (const s of EARTH_SOURCES) expect(Object.keys(EARTH_LICENCES)).toContain(s.id);
  });

  it('une source inconnue n’est jamais vendable', () => {
    expect(isCommercialSource('gebco')).toBe(false);
  });

  it('le plafond des exports reste sous le premier niveau de toute source non commerciale', () => {
    const max = maxCommercialEarthZoom();
    for (const s of EARTH_SOURCES.filter((x) => !isCommercialSource(x.id))) {
      expect(max).toBeLessThan(s.lowZoom ?? s.minZoom);
    }
  });

  it('sans source non commerciale, aucun plafond', () => {
    expect(maxCommercialEarthZoom(EARTH_SOURCES.filter((s) => isCommercialSource(s.id)))).toBe(Number.POSITIVE_INFINITY);
  });
});
