// Fonctions testées : le catalogue des exports payants et les droits du jeton.
import {
  BODY_IDS, CURRENCY, MAX_ORBIT_HOURS, SCOPE_ALL, SCOPE_TILES, bodyKey, buildCatalogue, formatPrice,
  priceFor, priceFrom, productById, scopeAllows, scopeOfBody, scopeOfOrbit, totalCents,
} from './catalogue';

// Groupe de tests.
describe('catalogue', () => {
  // Test : le contenu du catalogue.
  it('vend chaque astre à l’unité, son orbite à l’heure, les tuiles et le tout', () => {
    // Le catalogue, sans variable d'environnement.
    const catalogue = buildCatalogue({});
    // Un article d'export et un article d'orbite par astre, plus les tuiles et le forfait complet.
    expect(catalogue).toHaveLength(BODY_IDS.length * 2 + 2);
    // Les articles d'orbite sont les seuls à prix horaire.
    expect(catalogue.filter((p) => p.hourly).map((p) => p.id)).toEqual(BODY_IDS.map((n) => `orbit-${bodyKey(n)}`));
    // Les astres vendus comprennent les planètes et la Lune.
    expect(BODY_IDS).toContain('Mars');
    expect(BODY_IDS).toContain('Lune');
    // Chaque article a un identifiant unique, un intitulé, un prix entier positif et au moins un droit.
    const ids = new Set<string>();
    for (const p of catalogue) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.cents) && p.cents > 0).toBe(true);
      expect(p.scopes.length).toBeGreaterThan(0);
      ids.add(p.id);
    }
    expect(ids.size).toBe(catalogue.length);
  // Fin du test.
  });

  // Test : les prix par défaut.
  it('applique les prix annoncés, et les laisse régler par l’environnement', () => {
    // Prix par défaut : 1 500 € par astre, 100 000 € pour la Terre, 1 999 € les tuiles, 4 999 € le tout.
    const base = buildCatalogue({});
    expect(productById('body-mars', base)!.cents).toBe(150_000);
    expect(productById('body-terre', base)!.cents).toBe(10_000_000);
    for (const nom of BODY_IDS.filter((n) => n !== 'Terre')) {
      expect(productById(`body-${bodyKey(nom)}`, base)!.cents).toBe(150_000);
    }
    expect(productById('tiles', base)!.cents).toBe(199_900);
    expect(productById('all', base)!.cents).toBe(499_900);
    // Le calcul d'orbite se loue 1 000 € l'heure, par astre.
    expect(productById('orbit-mars', base)!.cents).toBe(100_000);
    // Réglés par l'environnement.
    const cher = buildCatalogue({ PRICE_BODY_CENTS: '200000', PRICE_EARTH_CENTS: '12000000', PRICE_TILES_CENTS: '1000000', PRICE_ALL_CENTS: '2500000', PRICE_ORBIT_HOUR_CENTS: '250000' });
    expect(productById('body-mars', cher)!.cents).toBe(200_000);
    expect(productById('body-terre', cher)!.cents).toBe(12_000_000);
    expect(productById('all', cher)!.cents).toBe(2_500_000);
    expect(productById('orbit-mars', cher)!.cents).toBe(250_000);
    // Une valeur inutilisable retombe sur le prix par défaut : jamais d'article gratuit par accident.
    for (const bad of ['', '0', '-1', 'gratuit', '12.5', 'NaN']) {
      expect(priceFrom({ PRICE_BODY_CENTS: bad }, 'PRICE_BODY_CENTS', 150_000)).toBe(150_000);
    }
  // Fin du test.
  });

  // Test : l'identifiant d'un astre.
  it('range les astres sous une clé sans accent ni majuscule', () => {
    // Les accents et la casse disparaissent.
    expect(bodyKey('Vénus')).toBe('venus');
    expect(bodyKey('Mercure')).toBe('mercure');
    expect(bodyKey('Lune')).toBe('lune');
    // Et le droit en découle.
    expect(scopeOfBody('Vénus')).toBe('body:venus');
  // Fin du test.
  });

  // Test : les droits.
  it('accorde l’accès selon les droits du jeton, et rien de plus', () => {
    // Un droit sur Mars seulement.
    const mars = ['body:mars'];
    expect(scopeAllows(mars, 'body:mars')).toBe(true);
    expect(scopeAllows(mars, 'body:venus')).toBe(false);
    // L'export d'un astre n'ouvre pas le calcul de son orbite : celui-ci se loue à part, à l'heure.
    expect(scopeAllows(mars, scopeOfOrbit('Mars'))).toBe(false);
    // Le droit sur un astre ouvre aussi ses tuiles : l'article comprend le modèle 3D et les tuiles.
    expect(scopeAllows(mars, 'tiles:mars')).toBe(true);
    expect(scopeAllows(mars, 'tiles:venus')).toBe(false);
    // Le droit sur les tuiles ouvre l'assemblage de n'importe quel astre, mais pas les modèles 3D.
    expect(scopeAllows([SCOPE_TILES], 'tiles:venus')).toBe(true);
    expect(scopeAllows([SCOPE_TILES], 'body:venus')).toBe(false);
    // Le droit universel ouvre les modèles et les tuiles de tous les astres.
    for (const needed of ['body:mars', 'tiles:terre', 'body:lune']) {
      expect(scopeAllows([SCOPE_ALL], needed)).toBe(true);
    }
    // Mais pas le calcul d'orbite, qui se loue à l'heure et pour un astre précis.
    expect(scopeAllows([SCOPE_ALL], scopeOfOrbit('Mars'))).toBe(false);
    expect(scopeAllows([scopeOfOrbit('Mars')], scopeOfOrbit('Mars'))).toBe(true);
    expect(scopeAllows([scopeOfOrbit('Mars')], scopeOfOrbit('Vénus'))).toBe(false);
    // Sans droits, ou avec des valeurs inattendues : rien n'est ouvert.
    for (const bad of [undefined, [], ['autre'], [1, null, {}] as unknown[]]) {
      expect(scopeAllows(bad as unknown[], 'body:mars')).toBe(false);
    }
  // Fin du test.
  });

  // Test : le prix horaire.
  it('facture la location d’orbite à l’heure, bornée au mois', () => {
    // L'article horaire.
    const orbite = productById('orbit-mars', buildCatalogue({}))!;
    // Une heure, puis plusieurs.
    expect(priceFor(orbite, 1)).toBe(100_000);
    expect(priceFor(orbite, 3)).toBe(300_000);
    expect(priceFor(orbite, 24)).toBe(2_400_000);
    // Moins d'une heure compte pour une heure ; au-delà d'un mois, le prix est celui d'un mois.
    expect(priceFor(orbite, 0)).toBe(100_000);
    expect(priceFor(orbite, -5)).toBe(100_000);
    expect(priceFor(orbite, 10_000)).toBe(100_000 * MAX_ORBIT_HOURS);
    // Un article à prix fixe ignore les heures.
    const mars = productById('body-mars', buildCatalogue({}))!;
    expect(priceFor(mars, 10)).toBe(150_000);
  // Fin du test.
  });

  // Test : les totaux et l'affichage.
  it('additionne et met en forme les prix', () => {
    // Le catalogue.
    const catalogue = buildCatalogue({});
    // Deux astres.
    const deux = [productById('body-mars', catalogue)!, productById('body-venus', catalogue)!];
    expect(totalCents(deux)).toBe(99_800);
    // Mise en forme française, espaces insécables normalisés pour la comparaison.
    expect(formatPrice(49_900).replace(/ | /g, ' ')).toBe('499,00 €');
    expect(formatPrice(499_900).replace(/ | /g, ' ')).toBe('4 999,00 €');
    // La devise du catalogue est l'euro.
    expect(CURRENCY).toBe('eur');
  // Fin du test.
  });
// Fin du groupe.
});
