// Fonctions testées : le blocage des API externes par hôte.
import {
  ApiBlockedError, blockedHosts, guardFetch, hostBlocked, hostOf, normalizeHosts, parseHosts,
  reloadEnvBlockedHosts, setRuntimeBlockedHosts, urlBlocked,
} from './api-blocklist';

// Groupe de tests.
describe('api-blocklist', () => {
  // Après chaque test : listes remises à vide.
  afterEach(() => { reloadEnvBlockedHosts(''); setRuntimeBlockedHosts([]); });

  // Test : nettoyage des listes.
  it('nettoie les hôtes : minuscules, doublons et noms invalides retirés', () => {
    // Liste en texte, avec séparateurs variés.
    expect(parseHosts(' Api.Open-Meteo.com, photon.komoot.io\napi.open-meteo.com ;pas un hôte!')).toEqual([
      'api.open-meteo.com', 'photon.komoot.io',
    ]);
    // Une adresse complète n'est pas un nom d'hôte.
    expect(normalizeHosts(['https://trek.nasa.gov/x', 'localhost', 'trek.nasa.gov.'])).toEqual(['trek.nasa.gov']);
  // Fin du test.
  });

  // Test : correspondance d'hôte.
  it('bloque un hôte et ses sous-domaines, pas ses voisins', () => {
    // Liste d'un hôte.
    const list = ['nasa.gov'];
    // L'hôte lui-même.
    expect(hostBlocked('nasa.gov', list)).toBe(true);
    // Un sous-domaine.
    expect(hostBlocked('Trek.NASA.gov', list)).toBe(true);
    // Un nom qui se termine pareil sans être un sous-domaine.
    expect(hostBlocked('notnasa.gov', list)).toBe(false);
  // Fin du test.
  });

  // Test : lecture de l'hôte d'une adresse.
  it('ne voit un hôte que dans une adresse http(s)', () => {
    // Adresse https.
    expect(hostOf('https://api.open-meteo.com/v1/forecast?x=1')).toBe('api.open-meteo.com');
    // Adresse relative et adresse data: : pas d'hôte.
    expect(hostOf('/api/v1/health')).toBeNull();
    expect(hostOf('data:text/plain,abc')).toBeNull();
  // Fin du test.
  });

  // Test : les deux listes s'additionnent.
  it('réunit la liste permanente et la liste d’exécution', () => {
    // Liste permanente.
    reloadEnvBlockedHosts('api.open-meteo.com');
    // Liste d'exécution.
    setRuntimeBlockedHosts(['photon.komoot.io', 'api.open-meteo.com']);
    // Réunion sans doublon.
    expect(blockedHosts()).toEqual(['api.open-meteo.com', 'photon.komoot.io']);
    // Une adresse bloquée, une adresse libre.
    expect(urlBlocked('https://photon.komoot.io/api?q=paris')).toBe(true);
    expect(urlBlocked('https://tiles.maps.eox.at/wmts')).toBe(false);
  // Fin du test.
  });

  // Test : le garde de fetch.
  it('refuse l’appel bloqué sans toucher au réseau, laisse passer les autres', async () => {
    // Faux fetch qui compte ses appels.
    const inner = jest.fn(async () => new Response('ok'));
    // Garde avec une liste fixe.
    const guarded = guardFetch(inner as unknown as typeof fetch, () => ['api.stripe.com']);
    // Appel bloqué, sous ses trois formes : texte, URL, Request.
    await expect(guarded('https://api.stripe.com/v1/x')).rejects.toBeInstanceOf(ApiBlockedError);
    await expect(guarded(new URL('https://api.stripe.com/v1/x'))).rejects.toBeInstanceOf(ApiBlockedError);
    await expect(guarded(new Request('https://api.stripe.com/v1/x'))).rejects.toBeInstanceOf(ApiBlockedError);
    // Le réseau n'a pas été appelé.
    expect(inner).not.toHaveBeenCalled();
    // Appel libre : il passe.
    await expect(guarded('https://data.geopf.fr/wmts').then((r) => r.text())).resolves.toBe('ok');
    expect(inner).toHaveBeenCalledTimes(1);
  // Fin du test.
  });
// Fin du groupe.
});
