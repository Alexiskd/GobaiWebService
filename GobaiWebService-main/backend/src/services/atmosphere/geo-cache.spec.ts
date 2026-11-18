// Cache et tuiles testés.
import { RateGate, TtlCache, isTile, tileBounds, tileOf } from './geo-cache';
// Registre des fournisseurs testé.
import { PROVIDERS, listProviders, provider } from './providers';

// Groupe de tests : le cache géographique.
describe('cache des fournisseurs et tuiles', () => {
  // Test : la durée de vie et le partage.
  it('n’appelle le fournisseur qu’une fois par période, partage la lecture en cours', async () => {
    // Horloge d'essai.
    let t = 0;
    // Cache d'une minute.
    const c = new TtlCache<number>(60_000, 4, 120_000, () => t);
    // Nombre d'appels.
    let calls = 0;
    // Fournisseur d'essai.
    const loader = async () => ++calls;
    // Deux demandes simultanées : un seul appel.
    const [a, b] = await Promise.all([c.get('k', loader), c.get('k', loader)]);
    // Même donnée, un appel.
    expect([a.data, b.data, calls]).toEqual([1, 1, 1]);
    // 30 s plus tard : toujours en cache.
    t = 30_000;
    // Lecture.
    expect((await c.get('k', loader)).data).toBe(1);
    // 61 s plus tard : nouvel appel.
    t = 61_000;
    // Lecture fraîche.
    expect([(await c.get('k', loader)).data, calls]).toEqual([2, 2]);
  // Fin du test.
  });

  // Test : la panne d'un fournisseur.
  it('rend la dernière donnée connue, marquée périmée, et ne rappelle pas le fournisseur pendant le repos', async () => {
    // Horloge d'essai.
    let t = 0;
    // Cache d'une minute, repos de deux minutes.
    const c = new TtlCache<string>(60_000, 4, 120_000, () => t);
    // Nombre d'appels.
    let calls = 0;
    // Première lecture réussie.
    await c.get('k', async () => { calls++; return 'ok'; });
    // Fournisseur en panne.
    const down = async () => { calls++; throw new Error('HTTP 503'); };
    // Après expiration.
    t = 70_000;
    // Lecture en panne : dernière donnée, périmée, avec l'erreur.
    const r = await c.get('k', down);
    // Contrôle.
    expect([r.data, r.stale, r.error]).toEqual(['ok', true, 'HTTP 503']);
    // Pendant le repos : aucun appel de plus.
    t = 100_000;
    // Lecture.
    await c.get('k', down);
    // Deux appels en tout.
    expect(calls).toBe(2);
    // Jamais rien lu : pas de donnée, pas « périmé ».
    const empty = await new TtlCache<string>(1, 4, 0, () => 0).get('z', async () => null);
    // Contrôle.
    expect([empty.data, empty.stale]).toEqual([null, false]);
  // Fin du test.
  });

  // Test : la limite d'entrées.
  it('retire les entrées les moins récemment utilisées au-delà du maximum', async () => {
    // Cache de deux entrées.
    const c = new TtlCache<string>(60_000, 2, 0, () => 0);
    // Trois clés.
    for (const k of ['a', 'b', 'c']) await c.get(k, async () => k);
    // La première est partie.
    expect([c.peek('a'), c.peek('b'), c.peek('c')]).toEqual([null, 'b', 'c']);
  // Fin du test.
  });

  // Test : les tuiles.
  it('découpe le globe en tuiles de 10°', () => {
    // Paris : colonne 18, ligne 13.
    expect(tileOf(2.35, 48.85)).toEqual({ tx: 18, ty: 13 });
    // Coin nord-est du globe : dernière tuile.
    expect(tileOf(180, 90)).toEqual({ tx: 35, ty: 17 });
    // Bornes de la tuile de Paris.
    expect(tileBounds(18, 13)).toEqual([0, 40, 10, 50]);
    // Tuiles valides et invalides.
    expect([isTile(0, 0), isTile(35, 17), isTile(36, 0), isTile(1.5, 2)]).toEqual([true, true, false, false]);
  // Fin du test.
  });
// Fin du groupe.
});

// Groupe de tests : le registre des fournisseurs.
describe('registre des fournisseurs atmosphériques', () => {
  // Test : la cohérence du registre.
  it('a des identifiants uniques, un rythme, une licence et une mention pour chaque fournisseur', () => {
    // Identifiants uniques.
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    // Rythme d'au moins une minute, licence et mention.
    expect(PROVIDERS.every((p) => p.refreshMs >= 60_000 && p.licence && p.attribution && p.url.startsWith('https://'))).toBe(true);
    // Fournisseur inconnu : erreur.
    expect(() => provider('inconnu')).toThrow('inconnu');
  // Fin du test.
  });

  // Test : la présence des clés.
  it('rapporte la présence des clés sans jamais exposer leur valeur', () => {
    // Environnement : clés Xweather et The Weather Company renseignées.
    const list = listProviders({ XWEATHER_CLIENT_ID: 'secret-id', XWEATHER_CLIENT_SECRET: 'secret', TWC_API_KEY: 'secret-twc' });
    // Foudre Xweather : clés présentes et branchée (lot 3).
    const x = list.find((p) => p.id === 'xweather-lightning')!;
    // Contrôle.
    expect([x.keysPresent, x.available]).toEqual([true, true]);
    // The Weather Company : clé présente, pas encore branchée.
    const twc = list.find((p) => p.id === 'twc-lightning')!;
    // Contrôle.
    expect([twc.keysPresent, twc.available]).toEqual([true, false]);
    // FIRMS : sans clé, branché, disponible.
    expect(list.find((p) => p.id === 'firms-viirs-n20')!.available).toBe(true);
    // Radar Rain Viewer et avertissements du NWS : sans clé, branchés, disponibles (lot 4).
    expect(['rainviewer', 'nws-alerts'].map((id) => list.find((p) => p.id === id)!.available)).toEqual([true, true]);
    // Aérosols observés (GIBS) et prévision CAMS publique : sans clé, branchés (lot 5) ; CAMS par l'ADS : clé requise.
    expect(['gibs-viirs-aod', 'gibs-omps-ai', 'cams-wms', 'cams'].map((id) => list.find((p) => p.id === id)!.available)).toEqual([true, true, true, false]);
    // Vents Open-Meteo : sans clé, branchés (lot 6).
    expect(list.find((p) => p.id === 'open-meteo-winds')!.available).toBe(true);
    // Aucune valeur de clé dans la réponse.
    expect(['secret-id', 'secret-twc'].some((k) => JSON.stringify(list).includes(k))).toBe(false);
  // Fin du test.
  });
// Fin du groupe.
});

// Groupe de tests : la limite de débit.
describe('limite de débit glissante', () => {
  // Test : attente puis refus.
  it('laisse passer le maximum, fait attendre la suite jusqu’à la sortie du plus ancien appel, refuse une attente trop longue', async () => {
    // Horloge d'essai.
    let t = 0;
    // Deux appels par seconde ; l'attente avance l'horloge.
    const gate = new RateGate(2, 1_000, () => t, async (ms) => { t += ms; });
    // Deux appels immédiats.
    await gate.take(); await gate.take();
    // Deux dans la fenêtre.
    expect(gate.used()).toBe(2);
    // Le troisième attend la sortie du premier (1 s).
    await gate.take(5_000);
    // Horloge avancée d'une seconde.
    expect(t).toBe(1_000);
    // Les deux premiers sont sortis : un quatrième passe tout de suite, la fenêtre est de nouveau pleine.
    await gate.take(); expect([t, gate.used()]).toEqual([1_000, 2]);
    // Cinquième : il faudrait attendre 1 s ; refusé avec une attente maximale de 500 ms.
    let refused = false;
    // Appel avec une attente maximale trop courte.
    await gate.take(500).catch(() => { refused = true; });
    // Refusé.
    expect(refused).toBe(true);
  // Fin du test.
  });
// Fin du groupe.
});
