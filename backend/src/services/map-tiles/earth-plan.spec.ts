// Importe ce qui est testé : la table, sa version, son adresse et son en-tête de cache.
import { EARTH_PLAN_CACHE, EARTH_PLAN_PATH, EARTH_PLAN_VERSION, earthPlan } from './earth-plan';
// Importe les sources actives, pour comparer l'ordre.
import { enabledSources } from './earth-sources';

// Environnement sans clé ni interrupteur.
const env: Record<string, string | undefined> = {};

// Groupe de tests de la table de priorité.
describe('table de priorité des sources de la Terre', () => {
  // Test : une ligne par source active, dans l'ordre de la liste, avec des rangs 1, 2, 3…
  it('range les sources : orthophotos nationales, puis Sentinel-2, puis GIBS', () => {
    // La table.
    const plan = earthPlan(enabledSources(env), env);
    // Les identifiants, dans l'ordre.
    const ids = plan.sources.map((s) => s.id);
    // Même ordre que les sources actives.
    expect(ids).toEqual(enabledSources(env).map((s) => s.id));
    // Les rangs se suivent à partir de 1.
    expect(plan.sources.map((s) => s.priority)).toEqual(ids.map((_, i) => i + 1));
    // L'IGN passe avant Sentinel-2, qui passe avant GIBS.
    expect(ids.indexOf('ign')).toBeLessThan(ids.indexOf('sentinel2'));
    // Sentinel-2 avant GIBS.
    expect(ids.indexOf('sentinel2')).toBeLessThan(ids.indexOf('gibs'));
    // Sentinel-2 et GIBS couvrent le monde : aucune emprise.
    expect(plan.sources.find((s) => s.id === 'sentinel2')!.bboxes).toBeUndefined();
    // L'IGN a une emprise : la France.
    expect(plan.sources.find((s) => s.id === 'ign')!.bboxes!.length).toBeGreaterThan(0);
  // Fin du test.
  });

  // Test : la table décrit la couche, son relais, sa version et l'accord des couleurs.
  it('donne la version, le relais du serveur et l’accord des couleurs', () => {
    // La table.
    const plan = earthPlan(enabledSources(env), env);
    // Version et couche.
    expect([plan.version, plan.layerId]).toEqual([EARTH_PLAN_VERSION, 'earth-hd']);
    // Le relais du serveur, à remplir par le navigateur.
    expect(plan.relay).toBe('/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}');
    // Accord des couleurs actif par défaut.
    expect(plan.colorMatch).toBe(true);
    // Coupé par EARTH_COLOR_MATCH=0.
    expect(earthPlan(enabledSources(env), { EARTH_COLOR_MATCH: '0' }).colorMatch).toBe(false);
    // L'adresse de la table et un cache d'un jour.
    expect([EARTH_PLAN_PATH, EARTH_PLAN_CACHE.includes('max-age=86400')]).toEqual(['/api/v1/tiles/earth/plan', true]);
  // Fin du test.
  });

  // Test : les modèles d'adresse ne sont donnés que pour les sources chargeables par le navigateur.
  it('donne les adresses directes des sources chargeables, aucune quand le direct est coupé', () => {
    // La table par défaut.
    const plan = earthPlan(enabledSources(env), env);
    // Sentinel-2 et l'IGN se chargent chez leur fournisseur.
    for (const id of ['sentinel2', 'ign']) expect(plan.sources.find((s) => s.id === id)!.templates!.length).toBeGreaterThan(0);
    // Avec EARTH_DIRECT=0 : plus aucun modèle d'adresse, tout passe par le relais.
    expect(earthPlan(enabledSources(env), { EARTH_DIRECT: '0' }).sources.every((s) => s.templates === undefined)).toBe(true);
  // Fin du test.
  });
// Fin du groupe.
});
