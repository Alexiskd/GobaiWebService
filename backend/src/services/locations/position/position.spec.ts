// Ce qui est testé : les calculs de position, la durée fixée Terre ↔ Apollo, la lecture de la réponse du modèle.
import {
  APOLLO_SITES, MAX_TRIP_MINUTES, apolloSiteAt, buildTripMessage, fixedTripMinutes, normalizePoint, parseTripReply,
  surfaceDistanceKm, tripDistance,
} from './position';
// Service de position, testé avec un faux assistant (aucun appel réseau).
import { PositionService } from './position.service';

// Points d'essai : Paris, Conflans, Apollo 11 et un point lunaire quelconque.
const paris = { body: 'earth' as const, lat: 48.8566, lon: 2.3522, name: 'Paris' };
const conflans = { body: 'earth' as const, lat: 48.9992, lon: 2.0967 };
const apollo11 = { body: 'moon' as const, lat: 0.674, lon: 23.473, name: 'Apollo 11' };
const tycho = { body: 'moon' as const, lat: -43.3, lon: -11.2 };

// Faux assistant : renvoie un texte choisi et note les appels.
function fakeAssistant(text: string) {
  const calls: { provider: string; key: string; system: string; messages: { role: string; content: string }[] }[] = [];
  return {
    calls,
    complete: async (provider: string, key: string, system: string, messages: { role: string; content: string }[]) => {
      calls.push({ provider, key, system, messages });
      return { text, provider, model: 'modele-essai' };
    },
  };
}

describe('position GPS', () => {
  it('valide une position et refuse les valeurs hors bornes ou d’un astre inconnu', () => {
    expect(normalizePoint({ body: 'earth', lat: 48.9, lon: 2.1, name: '  Conflans  ' })).toEqual({ body: 'earth', lat: 48.9, lon: 2.1, name: 'Conflans' });
    expect(normalizePoint({ body: 'mars', lat: 0, lon: 0 })).toBeNull();
    expect(normalizePoint({ body: 'earth', lat: 91, lon: 0 })).toBeNull();
    expect(normalizePoint({ body: 'moon', lat: 0, lon: 181 })).toBeNull();
    expect(normalizePoint({ body: 'moon', lat: '0', lon: 0 })).toBeNull();
    expect(normalizePoint(null)).toBeNull();
  });

  it('calcule la distance au sol sur un même astre seulement', () => {
    // Paris–Conflans : une vingtaine de kilomètres.
    const d = surfaceDistanceKm(paris, conflans) as number;
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(25);
    // Un quart de méridien lunaire : π/2 × rayon lunaire.
    const quart = surfaceDistanceKm({ body: 'moon', lat: 0, lon: 0 }, { body: 'moon', lat: 90, lon: 0 }) as number;
    expect(quart).toBeCloseTo((Math.PI / 2) * 1737.4, 1);
    // Entre deux astres : pas de distance au sol, la distance moyenne Terre–Lune est donnée.
    expect(surfaceDistanceKm(paris, apollo11)).toBeNull();
    expect(tripDistance(paris, apollo11)).toEqual({ km: 384_400, kind: 'terre-lune' });
  });

  it('reconnaît les sites Apollo à leurs coordonnées', () => {
    expect(APOLLO_SITES).toHaveLength(6);
    expect(apolloSiteAt(apollo11)?.id).toBe('apollo-11');
    expect(apolloSiteAt(tycho)).toBeNull();
    expect(apolloSiteAt(paris)).toBeNull();
  });
});

describe('durée fixée Terre ↔ Apollo', () => {
  it('vaut 3 jours entre la Terre et un site Apollo, dans les deux sens', () => {
    expect(fixedTripMinutes(paris, apollo11)).toBe(3 * 24 * 60);
    expect(fixedTripMinutes(apollo11, paris)).toBe(3 * 24 * 60);
  });

  it('ne s’applique pas aux autres trajets', () => {
    expect(fixedTripMinutes(paris, tycho)).toBeNull();
    expect(fixedTripMinutes(paris, conflans)).toBeNull();
    expect(fixedTripMinutes(apollo11, tycho)).toBeNull();
  });
});

describe('réponse du modèle', () => {
  it('lit un objet JSON, même entouré de texte', () => {
    const r = parseTripReply('Voici : {"durationMinutes": 35.4, "mode": "Voiture", "summary": "Environ 35 minutes."} Fin.');
    expect(r).toEqual({ durationMinutes: 35, mode: 'Voiture', summary: 'Environ 35 minutes.' });
  });

  it('refuse une réponse sans durée plausible', () => {
    expect(parseTripReply('aucune durée')).toBeNull();
    expect(parseTripReply('{"durationMinutes": 0}')).toBeNull();
    expect(parseTripReply('{"durationMinutes": -5}')).toBeNull();
    expect(parseTripReply(`{"durationMinutes": ${MAX_TRIP_MINUTES + 1}}`)).toBeNull();
    expect(parseTripReply('{"durationMinutes": "beaucoup"}')).toBeNull();
    expect(parseTripReply('{pas du json}')).toBeNull();
  });

  it('met les deux positions et la distance dans le message du modèle', () => {
    const m = buildTripMessage(paris, conflans);
    expect(m).toContain('Départ (A) : Paris, Terre');
    expect(m).toContain('Arrivée (B) : Terre');
    expect(m).toMatch(/Distance au sol : \d+ km/);
  });
});

describe('PositionService', () => {
  it('répond 3 jours Terre → Apollo sans appeler le modèle ni lire la clé', async () => {
    const fake = fakeAssistant('inutile');
    const service = new PositionService(fake as never);
    const r = await service.trip('claude', '', paris, apollo11);
    expect(r.source).toBe('fixe');
    expect(r.durationMinutes).toBe(4320);
    expect(r.distanceKind).toBe('terre-lune');
    expect(fake.calls).toHaveLength(0);
  });

  it('demande l’estimation au modèle de l’utilisateur pour les autres trajets, avec sa clé', async () => {
    const fake = fakeAssistant('{"durationMinutes": 40, "mode": "Voiture", "summary": "Une quarantaine de minutes."}');
    const service = new PositionService(fake as never);
    const r = await service.trip('mistral', 'cle-utilisateur-123456', paris, conflans);
    expect(r).toMatchObject({ source: 'ia', durationMinutes: 40, mode: 'Voiture', provider: 'mistral', model: 'modele-essai', distanceKind: 'surface' });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].key).toBe('cle-utilisateur-123456');
    expect(fake.calls[0].system).toContain('aucun itinéraire');
  });

  it('refuse une position invalide (400) et une réponse inutilisable du modèle (502)', async () => {
    const service = new PositionService(fakeAssistant('pas de durée') as never);
    await expect(service.trip('claude', 'k', { body: 'earth', lat: 120, lon: 0 }, paris)).rejects.toThrow('Position A invalide');
    await expect(service.trip('claude', 'k', paris, { body: 'moon', lat: 0, lon: 999 })).rejects.toThrow('Position B invalide');
    const refus = await service.trip('claude', 'k', paris, conflans).catch((e: { getStatus(): number }) => e);
    expect((refus as { getStatus(): number }).getStatus()).toBe(502);
  });
});
