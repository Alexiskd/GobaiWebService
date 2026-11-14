// Ouvre l'import de ce qui est testé :
import {
  // la liste des planètes naines, le contrôle de vraisemblance, l'adresse de la requête,
  DWARF_PLANETS, checkHorizonsTarget, horizonsElementsUrl,
  // la lecture de la réponse, la conversion en éléments, la conversion en planète et le repli d'un angle.
  parseHorizonsElements, toDwarfPlanet, toPlanetElements, wrap360,
// Fin de l'import.
} from './dwarf-planets';
// Table produite par le script, comparée au résultat de la conversion.
import { DWARF_PLANETS_DATA } from '../data/dwarf-planets.data';
// Liste des planètes, pour vérifier que les naines y sont bien entrées.
import { PLANETS } from '../data/bodies.data';

/**
 * Réponse réelle de JPL Horizons pour Cérès (commande « 1; », centre du Soleil, éléments à J2000, UA et jours),
 * réduite aux lignes que le module lit. Elle sert de référence : la conversion est vérifiée sur une vraie réponse,
 * sans réseau.
 */
// Réponse d'Horizons pour Cérès.
const CERES = `*******************************************************************************
JPL/HORIZONS                      1 Ceres                 2026-Nov-14 04:00:00
Rec #:       1 (+COV) Soln.date: 2021-Apr-13_11:04:44    # obs: 1075 (1995-2021)

Asteroid physical parameters (km, seconds, rotational period in hours):
   GM= 62.6284             RAD= 469.7              ROTPER= 9.07417
*******************************************************************************
$$SOE
2451545.000000000 = A.D. 2000-Jan-01 12:00:00.0000 TDB
 EC= 7.837562647163010E-02 QR= 2.549670161296045E+00 IN= 1.058336045805628E+01
 OM= 8.049435747295279E+01 W = 7.392286274285209E+01 Tp=  2451516.163382899947
 N = 2.141948374796613E-01 MA= 6.176654513180588E+00 TA= 7.246681675032771E+00
 A = 2.766496019994375E+00 AD= 2.983321878692705E+00 PR= 1.680712776442072E+03
$$EOE
*******************************************************************************`;

/** Réponse portant sur Haumea : sert à vérifier que le contrôle refuse une réponse sur un autre corps. */
// Réponse d'Horizons pour Haumea.
const HAUMEA = `JPL/HORIZONS                136108 Haumea (2003 EL61)        2026-Nov-14 04:00:00
   GM= n.a.                RAD= n.a.               ROTPER= 3.9154
$$SOE
2451545.000000000 = A.D. 2000-Jan-01 12:00:00.0000 TDB
 EC= 1.999209495775122E-01 QR= 3.433079812364024E+01 IN= 2.820614176692052E+01
 OM= 1.219332385932479E+02 W = 2.405907776701739E+02 Tp=  2500141.397260433994
 N = 3.506530106862839E-03 MA= 1.895952699212210E+02 TA= 1.865367939018350E+02
 A = 4.290925766086690E+01 AD= 5.148771719809355E+01 PR= 1.026655950551865E+05
$$EOE`;

// Groupe de tests de l'import des planètes naines.
describe('import des planètes naines depuis JPL Horizons', () => {
  // Premier test : la liste.
  it('connaît les cinq planètes naines de l’UAI, avec leur commande Horizons', () => {
    // Les cinq identifiants, par distance croissante au Soleil.
    expect(DWARF_PLANETS.map((d) => d.id)).toEqual(['ceres', 'pluto', 'haumea', 'makemake', 'eris']);
    // Pour chacune :
    for (const d of DWARF_PLANETS) {
      // sa commande finit par un point-virgule, qui dit à Horizons de chercher un petit corps ;
      expect(d.horizons.endsWith(';')).toBe(true);
      // sa couleur est un code hexadécimal ;
      expect(d.color).toMatch(/^#[0-9a-f]{6}$/i);
      // son demi-grand axe attendu est positif.
      expect(d.aAttendu).toBeGreaterThan(0);
    // Fin de la boucle.
    }
  // Fin du test.
  });

  // Deuxième test : l'adresse de la requête.
  it('demande les éléments osculateurs autour du Soleil, en UA et en jours', () => {
    // Adresse de la requête pour Cérès, à une époque donnée.
    const url = horizonsElementsUrl('1;', '2000-01-01 12:00', 'https://ssd.jpl.nasa.gov/api/horizons.api');
    // Les paramètres lus dans l'adresse.
    const q = new URL(url).searchParams;
    // Le corps demandé, entre apostrophes comme Horizons l'attend.
    expect(q.get('COMMAND')).toBe("'1;'");
    // Le type d'éphéméride : des éléments d'orbite.
    expect(q.get('EPHEM_TYPE')).toBe('ELEMENTS');
    // Le centre : celui du Soleil.
    expect(q.get('CENTER')).toBe("'500@10'");
    // Les unités : unités astronomiques et jours.
    expect(q.get('OUT_UNITS')).toBe('AU-D');
    // Les paramètres physiques sont demandés, pour le rayon et la rotation.
    expect(q.get('OBJ_DATA')).toBe('YES');
  // Fin du test.
  });

  // Troisième test : la lecture de la réponse.
  it('lit les éléments, le rayon et la rotation d’une vraie réponse', () => {
    // Les éléments lus pour Cérès.
    const el = parseHorizonsElements(CERES);
    // Le corps est bien Cérès.
    expect(el.target).toBe('1 Ceres');
    // Son demi-grand axe.
    expect(el.a).toBeCloseTo(2.766496019994375, 12);
    // Son excentricité.
    expect(el.ec).toBeCloseTo(0.0783756264716301, 12);
    // Son inclinaison.
    expect(el.inc).toBeCloseTo(10.58336045805628, 10);
    // Son rayon, mesuré par Horizons.
    expect(el.radiusKm).toBe(469.7);
    // Sa période de rotation.
    expect(el.rotationHours).toBe(9.07417);
    // Pour un transneptunien, Horizons répond « n.a. » : le rayon est alors inconnu.
    expect(parseHorizonsElements(HAUMEA).radiusKm).toBe(null);
  // Fin du test.
  });

  // Quatrième test : une réponse inutilisable.
  it('refuse une réponse sans bloc d’éléments ou amputée', () => {
    // Message d'erreur d'Horizons, sans éléments : refusée.
    expect(() => parseHorizonsElements('No matches found.')).toThrow(/sans bloc d’éléments/);
    // Bloc présent mais sans demi-grand axe : refusé, et l'élément manquant est nommé.
    expect(() => parseHorizonsElements('$$SOE\n EC= 1.0E-01 IN= 1.0E+01 OM= 1.0E+01 W = 1.0E+01 N = 1.0E-01 MA= 1.0E+01\n$$EOE')).toThrow(/« A » absent/);
  // Fin du test.
  });

  // Cinquième test : le contrôle de vraisemblance.
  it('refuse une réponse portant sur un autre corps que celui demandé', () => {
    // La définition d'Éris.
    const eris = DWARF_PLANETS.find((d) => d.id === 'eris')!;
    // La définition de Haumea.
    const haumea = DWARF_PLANETS.find((d) => d.id === 'haumea')!;
    // Les éléments de la réponse de Haumea.
    const el = parseHorizonsElements(HAUMEA);
    // Demander Éris et recevoir Haumea : refusé, en nommant les deux corps.
    expect(() => checkHorizonsTarget(eris, el)).toThrow(/Haumea.*et non.*Éris/);
    // Demander Haumea et recevoir Haumea : accepté.
    expect(() => checkHorizonsTarget(haumea, el)).not.toThrow();
    // Un demi-grand axe très éloigné de celui attendu : refusé, même avec le bon nom.
    expect(() => checkHorizonsTarget(haumea, { ...el, a: 12 })).toThrow(/invraisemblable/);
  // Fin du test.
  });

  // Sixième test : la conversion des éléments.
  it('convertit les éléments d’Horizons au format de la table des planètes', () => {
    // Les douze nombres obtenus pour Cérès.
    const e = toPlanetElements(parseHorizonsElements(CERES));
    // Douze nombres : six éléments et leurs six dérives.
    expect(e).toHaveLength(12);
    // Le demi-grand axe est repris tel quel.
    expect(e[0]).toBeCloseTo(2.766496019994375, 12);
    // L'excentricité aussi.
    expect(e[2]).toBeCloseTo(0.0783756264716301, 12);
    // La longitude du périhélie vaut Ω + ω.
    expect(e[8]).toBeCloseTo(80.49435747295279 + 73.92286274285209, 9);
    // La longitude moyenne vaut Ω + ω + M.
    expect(e[6]).toBeCloseTo(wrap360(80.49435747295279 + 73.92286274285209 + 6.176654513180588), 9);
    // Le nœud ascendant est repris tel quel.
    expect(e[10]).toBeCloseTo(80.49435747295279, 9);
    // La dérive de la longitude moyenne vaut le moyen mouvement sur un siècle julien.
    expect(e[7]).toBeCloseTo(0.2141948374796613 * 36525, 6);
    // Les autres dérives sont nulles : on n'a pas de dérive séculaire pour une planète naine.
    expect([e[1], e[3], e[5], e[9], e[11]]).toEqual([0, 0, 0, 0, 0]);
    // La période déduite du demi-grand axe vaut bien les 4,6 ans de Cérès.
    expect(e[0] ** 1.5).toBeCloseTo(4.6, 1);
  // Fin du test.
  });

  // Septième test : la planète construite.
  it('construit l’entrée de Cérès, et refuse un astre sans rayon', () => {
    // La définition de Cérès.
    const def = DWARF_PLANETS.find((d) => d.id === 'ceres')!;
    // La planète construite depuis la réponse d'Horizons.
    const { data, rayonSource } = toDwarfPlanet(def, parseHorizonsElements(CERES));
    // Son nom français.
    expect(data.name).toBe('Cérès');
    // Son rayon, en rayons terrestres : 469,7 km sur 6 371 km.
    expect(data.radius).toBeCloseTo(469.7 / 6371, 5);
    // Sa rotation, en jours : 9,07417 heures sur 24.
    expect(data.rotation).toBeCloseTo(9.07417 / 24, 5);
    // Elle porte la marque de planète naine.
    expect(data.dwarf).toBe(true);
    // Son rayon vient d'Horizons, qui le mesure.
    expect(rayonSource).toBe('horizons');
    // Haumea : Horizons ne donne pas de rayon, c'est la valeur publiée qui sert.
    expect(toDwarfPlanet(DWARF_PLANETS.find((d) => d.id === 'haumea')!, parseHorizonsElements(HAUMEA)).rayonSource).toBe('publié');
    // Sans rayon d'Horizons ni valeur publiée : refusé, un astre sans rayon ne se dessine pas.
    expect(() => toDwarfPlanet({ ...def, rayonPublieKm: undefined }, { ...parseHorizonsElements(CERES), radiusKm: null })).toThrow(/rayon inconnu/);
  // Fin du test.
  });

  // Huitième test : la table produite correspond au résultat de la conversion.
  it('la table produite par le script correspond à la conversion de la réponse d’Horizons', () => {
    // L'entrée de Cérès dans la table produite.
    const fichier = DWARF_PLANETS_DATA.find((p) => p.name === 'Cérès');
    // Elle existe.
    expect(fichier).toBeDefined();
    // La même entrée, recalculée depuis la réponse d'Horizons.
    const calcule = toDwarfPlanet(DWARF_PLANETS.find((d) => d.id === 'ceres')!, parseHorizonsElements(CERES)).data;
    // Les deux doivent être identiques : sinon le fichier produit a été modifié à la main, ou le calcul a changé.
    expect(fichier).toEqual(calcule);
  // Fin du test.
  });

  // Neuvième test : l'entrée dans la liste des planètes.
  it('ajoute les planètes naines à la liste des planètes, classées par distance au Soleil', () => {
    // Les noms de la liste des planètes.
    const noms = PLANETS.map((p) => p.name);
    // Chaque planète naine produite y figure.
    for (const d of DWARF_PLANETS_DATA) expect(noms).toContain(d.name);
    // Les huit planètes et Pluton y sont toujours.
    for (const n of ['Mercure', 'Vénus', 'Terre', 'Mars', 'Jupiter', 'Saturne', 'Uranus', 'Neptune', 'Pluton']) expect(noms).toContain(n);
    // Les demi-grands axes de la liste.
    const axes = PLANETS.map((p) => p.elements[0]);
    // Ils sont croissants : la liste reste classée par distance au Soleil.
    expect([...axes].sort((a, b) => a - b)).toEqual(axes);
    // Cérès, à 2,77 UA, se place entre Mars et Jupiter.
    expect(noms.indexOf('Cérès')).toBeGreaterThan(noms.indexOf('Mars'));
    // et avant Jupiter.
    expect(noms.indexOf('Cérès')).toBeLessThan(noms.indexOf('Jupiter'));
  // Fin du test.
  });
// Fin du groupe.
});
