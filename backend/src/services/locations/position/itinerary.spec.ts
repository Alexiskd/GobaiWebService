// Ce qui est testé : la reconnaissance des moyens de locomotion, la lecture tolérante de la réponse JSON du modèle,
// l'enchaînement des étapes, et le service (faux assistant, aucun réseau).
import { MODES, buildItineraryMessage, geoPointOf, parseItineraryReply, pathKm, resolveMode } from './itinerary';
import { PositionService } from './position.service';

const conflans = { body: 'earth' as const, lat: 48.9992, lon: 2.0967, name: 'Conflans' };
const newYork = { body: 'earth' as const, lat: 40.7128, lon: -74.006, name: 'New York' };

// Réponse type du modèle : marche, train, avion, voiture.
const reply = JSON.stringify({
  summary: 'Marche, train, avion puis voiture.',
  segments: [
    { mode: 'À pied', category: 'sol', label: 'Jusqu’à la gare', from: { lat: 48.9992, lon: 2.0967 }, to: { lat: 48.9961, lon: 2.0924, name: 'Gare' }, waypoints: [[48.998, 2.095]], minutes: 8 },
    { mode: 'TGV', category: 'sol', label: 'Vers l’aéroport', from: { lat: 48.9961, lon: 2.0924 }, to: { lat: 49.0097, lon: 2.5479, name: 'CDG' }, waypoints: [{ lat: 49.0, lon: 2.3 }], minutes: 40 },
    { mode: 'Avion de ligne', category: 'vol', label: 'Vol direct', from: { lat: 49.0097, lon: 2.5479 }, to: { lat: 40.6413, lon: -73.7781, name: 'JFK' }, waypoints: [], minutes: 480, altitudeKm: 11 },
    { mode: 'Taxi', category: 'sol', label: 'Vers Manhattan', from: { lat: 40.6413, lon: -73.7781 }, to: { lat: 40.7128, lon: -74.006 }, waypoints: [], minutes: 55 },
  ],
});

function fakeAssistant(texts: string[]) {
  const calls: { key: string; system: string; messages: { role: string; content: string }[] }[] = [];
  let i = 0;
  return {
    calls,
    complete: async (provider: string, key: string, system: string, messages: { role: string; content: string }[]) => {
      calls.push({ key, system, messages: [...messages] });
      return { text: texts[Math.min(i++, texts.length - 1)], provider, model: 'modele-essai' };
    },
  };
}

describe('moyens de locomotion', () => {
  it('reconnaît les noms libres, avec accents et synonymes', () => {
    expect(resolveMode('À pied').id).toBe('marche');
    expect(resolveMode('TGV').id).toBe('train');
    expect(resolveMode('Avion de ligne').id).toBe('avion');
    expect(resolveMode('Hélicoptère').id).toBe('helicoptere');
    expect(resolveMode('Autocar').id).toBe('bus');
    expect(resolveMode('Taxi').id).toBe('voiture');
    expect(resolveMode('RER B').id).toBe('metro');
    expect(resolveMode('Montgolfière').id).toBe('ballon');
  });
  it('un moyen inconnu prend le moteur générique de sa catégorie (au sol par défaut)', () => {
    expect(resolveMode('Tuk-tuk', 'sol').id).toBe('autre-sol');
    expect(resolveMode('Jetpack', 'vol').id).toBe('autre-vol');
    expect(resolveMode('Téléphérique').id).toBe('autre-sol');
  });
  it('les véhicules volants sont en 3D (vol), les autres en 2D (sol)', () => {
    for (const id of ['avion', 'helicoptere', 'fusee', 'drone', 'ballon', 'planeur']) expect(MODES.find((m) => m.id === id)?.category).toBe('vol');
    for (const id of ['marche', 'velo', 'voiture', 'train', 'bateau']) expect(MODES.find((m) => m.id === id)?.category).toBe('sol');
  });
});

describe('lecture de la réponse du modèle', () => {
  it('lit un itinéraire complet : étapes enchaînées, longueurs recalculées', () => {
    const it = parseItineraryReply(`Voici : ${reply} Bon voyage.`, conflans, newYork);
    expect(it).not.toBeNull();
    expect(it!.segments.map((s) => s.mode)).toEqual(['marche', 'train', 'avion', 'voiture']);
    expect(it!.segments.map((s) => s.category)).toEqual(['sol', 'sol', 'vol', 'sol']);
    expect(it!.segments[0].from).toMatchObject({ lat: 48.9992, lon: 2.0967, name: 'Conflans' });
    expect(it!.segments[3].to).toMatchObject({ lat: 40.7128, lon: -74.006, name: 'New York' });
    for (let i = 1; i < it!.segments.length; i++) expect(it!.segments[i].from).toEqual(it!.segments[i - 1].to);
    expect(it!.totalMinutes).toBe(8 + 40 + 480 + 55);
    expect(it!.segments[2].altitudeKm).toBe(11);
    expect(it!.segments[2].km).toBeGreaterThan(5000);
    expect(it!.totalKm).toBeCloseTo(it!.segments.reduce((n, s) => n + s.km, 0), 0);
  });
  it('déduit la durée manquante de la vitesse du moyen', () => {
    const text = JSON.stringify({ segments: [{ mode: 'Avion', category: 'vol', to: { lat: 40.7128, lon: -74.006 }, waypoints: [] }] });
    const it = parseItineraryReply(text, conflans, newYork)!;
    expect(it.segments[0].minutes).toBeGreaterThan(400);
    expect(it.segments[0].minutes).toBeLessThan(600);
  });
  it('la dernière étape arrive toujours en B, et un moyen inconnu est gardé avec son nom', () => {
    const text = JSON.stringify({ etapes: [{ mode: 'Traîneau', category: 'sol', to: { lat: 40.7, lon: -74.0 }, minutes: 90 }] });
    const it = parseItineraryReply(text, conflans, newYork)!;
    expect(it.segments[0].to.lat).toBe(40.7128);
    expect(it.segments[0].mode).toBe('autre-sol');
    expect(it.segments[0].modeLabel).toBe('Traîneau');
  });
  it('refuse le texte sans JSON, sans étape ou avec des coordonnées hors bornes', () => {
    expect(parseItineraryReply('désolé', conflans, newYork)).toBeNull();
    expect(parseItineraryReply('{"segments": []}', conflans, newYork)).toBeNull();
    // Une étape intermédiaire aux coordonnées hors bornes est ignorée ; la dernière arrive quand même en B.
    const skipped = parseItineraryReply('{"segments":[{"mode":"Train","to":{"lat":120,"lon":0}},{"mode":"Avion","minutes":10}]}', conflans, newYork)!;
    expect(skipped.segments).toHaveLength(1);
    expect(skipped.segments[0].to.lat).toBe(40.7128);
  });
  it('limite les étapes et les points intermédiaires', () => {
    const many = Array.from({ length: 80 }, (_, i) => [49 + i * 0.001, 2.1 + i * 0.001]);
    const text = JSON.stringify({ segments: [{ mode: 'Voiture', waypoints: many, minutes: 30 }] });
    expect(parseItineraryReply(text, conflans, { body: 'earth', lat: 49.2, lon: 2.4 })!.segments[0].waypoints.length).toBeLessThanOrEqual(30);
  });
});

describe('outils', () => {
  it('lit un point sous plusieurs formes et refuse les valeurs hors bornes', () => {
    expect(geoPointOf([48.9, 2.1])).toEqual({ lat: 48.9, lon: 2.1 });
    expect(geoPointOf({ latitude: '48,9', lng: '2.1', name: ' Gare ' })).toEqual({ lat: 48.9, lon: 2.1, name: 'Gare' });
    expect(geoPointOf([95, 2])).toBeNull();
    expect(geoPointOf('x')).toBeNull();
  });
  it('mesure un tracé et écrit le message du modèle', () => {
    expect(pathKm([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }])).toBeGreaterThan(110);
    expect(buildItineraryMessage(conflans, newYork)).toContain('Départ (A) : Conflans, Terre');
  });
});

describe('service d’itinéraire', () => {
  it('renvoie les étapes validées avec le fournisseur', async () => {
    const fake = fakeAssistant([reply]);
    const r = await new PositionService(fake as never).itinerary('claude', 'sk-test', conflans, newYork);
    expect(r.segments).toHaveLength(4);
    expect(r.provider).toBe('claude');
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].key).toBe('sk-test');
  });
  it('redemande une fois une réponse illisible, puis refuse (502)', async () => {
    const bad = fakeAssistant(['pas de json']);
    await expect(new PositionService(bad as never).itinerary('claude', 'k', conflans, newYork)).rejects.toMatchObject({ status: 502 });
    expect(bad.calls).toHaveLength(2);
    const ok = fakeAssistant(['n’importe quoi', reply]);
    expect((await new PositionService(ok as never).itinerary('claude', 'k', conflans, newYork)).segments).toHaveLength(4);
  });
  it('refuse un point sur la Lune ou invalide (400)', async () => {
    const fake = fakeAssistant([reply]);
    const svc = new PositionService(fake as never);
    await expect(svc.itinerary('claude', 'k', { body: 'moon', lat: 0, lon: 0 }, newYork)).rejects.toMatchObject({ status: 400 });
    await expect(svc.itinerary('claude', 'k', { body: 'earth', lat: 99, lon: 0 }, newYork)).rejects.toMatchObject({ status: 400 });
    expect(fake.calls).toHaveLength(0);
  });
});
