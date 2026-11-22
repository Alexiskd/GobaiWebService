// Importe ce qui est testé : la table, ses paliers, sa version, son adresse et son en-tête de cache.
import { EARTH_PLAN_CACHE, EARTH_PLAN_PATH, EARTH_PLAN_VERSION, EARTH_TIERS, earthPlan } from './earth-plan';
// Importe les sources actives, pour comparer l'ordre.
import { enabledSources } from './earth-sources';
// Importe la carte marine, pour la comparer à celle de la table.
import { earthMarine } from './earth-seafloor';

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
    // GIBS couvre le monde sans emprise ; Sentinel-2 aussi, hormis le sud de −70° (le bord blanc de sa mosaïque).
    expect(plan.sources.find((s) => s.id === 'gibs')!.bboxes).toBeUndefined();
    expect(plan.sources.find((s) => s.id === 'sentinel2')!.bboxes).toEqual([[-180, -70, 180, 86]]);
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

  // Test : les paliers vont de la rue à l'espace, sans trou ni recul.
  it('décrit les paliers de zoom, de la rue à l’espace', () => {
    // La table.
    const plan = earthPlan(enabledSources(env), env);
    // Les paliers de la table sont ceux du serveur, et le chargement est limité au champ de la caméra.
    expect([plan.tiers, plan.fieldOnly]).toEqual([EARTH_TIERS, true]);
    // Du plus proche au plus lointain.
    expect(EARTH_TIERS.map((t) => t.id)).toEqual(['rue', 'quartier', 'ville', 'region', 'pays', 'continent', ...Array.from({ length: 30 }, (_, i) => `planete-${(i + 1) * 10_000}`), 'espace']);
    // Distances croissantes, le dernier sans limite.
    for (let i = 1; i < EARTH_TIERS.length - 1; i++) expect(EARTH_TIERS[i].maxKm!).toBeGreaterThan(EARTH_TIERS[i - 1].maxKm!);
    // Le dernier palier n'a pas de limite.
    expect(EARTH_TIERS[EARTH_TIERS.length - 1].maxKm).toBeNull();
    // Le niveau le plus fin baisse (ou reste) en s'éloignant, de 19 à 3.
    for (let i = 1; i < EARTH_TIERS.length; i++) expect(EARTH_TIERS[i].maxZoom).toBeLessThanOrEqual(EARTH_TIERS[i - 1].maxZoom);
    // Extrémités : 19 à la rue, 3 dans l'espace (la mosaïque instantanée).
    expect([EARTH_TIERS[0].maxZoom, EARTH_TIERS[EARTH_TIERS.length - 1].maxZoom]).toEqual([19, 3]);
    // Sur téléphone, jamais plus de tuiles que sur ordinateur, et au moins 85 (la mosaïque instantanée).
    for (const t of EARTH_TIERS) expect(t.maxTiles.phone <= t.maxTiles.desktop && t.maxTiles.phone >= 85).toBe(true);
    // La carte marine passe de la teinte NOAA (loin) à GEBCO seule (près).
    expect([EARTH_TIERS[EARTH_TIERS.length - 1].details.marine, EARTH_TIERS[0].details.marine]).toEqual(['noaa', 'gebco']);
  // Fin du test.
  });

  // Test : la carte marine est dans la table, ses seuils sont la colonne « marine » des paliers, et elle se coupe.
  it('décrit la carte marine : NOAA loin, fondu, puis GEBCO seule, sans retour en arrière', () => {
    // La table.
    const plan = earthPlan(enabledSources(env), env);
    // Version 3, avec la carte marine du serveur.
    expect([plan.version, plan.marine]).toEqual([3, earthMarine(env)]);
    // Ordre des étapes, du plus lointain au plus proche.
    const order = ['noaa', 'fondu', 'gebco'];
    // Étapes des paliers, du plus lointain au plus proche.
    const steps = [...EARTH_TIERS].reverse().map((t) => order.indexOf(t.details.marine));
    // Jamais de retour en arrière (NOAA → fondu → GEBCO).
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    // Les trois étapes sont présentes.
    expect(new Set(steps).size).toBe(3);
    // Fonds marins coupés : pas de carte marine.
    expect(earthPlan(enabledSources(env), { ...env, EARTH_SEAFLOOR: '0' }).marine).toBe(null);
  // Fin du test.
  });
// Fin du groupe.
});
