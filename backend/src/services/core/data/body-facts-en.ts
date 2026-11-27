// Données des astres (orbites, rayons) : la même source que les chiffres français.
import { PLANETS, SATELLITES } from './bodies.data';
// Rayons, densités, pesanteurs des planètes (fiches NASA NSSDCA), et forme d'un chiffre.
import { PLANET_FACTS, type BodyFact } from './body-facts';
// Fonction qui retire accents et majuscules.
import { normalize } from '../../../common/text';

/**
 * Chiffres des astres en anglais, pour les pages /en/… (body-pages-en.ts). Mêmes valeurs que body-facts.ts,
 * écrites à l'anglaise (« 12,742 km », « 5.43 g/cm³ »). Clé : adresse française de l'astre (« mars », « ganymede »).
 */

// Une unité astronomique en kilomètres.
const AU_KM = 149_597_870.7;
// Une année en jours.
const YEAR_DAYS = 365.25;

/** Nombre en écriture anglaise : virgule des milliers, point décimal. */
export function en(value: number, digits = 0): string {
  // Partie entière et décimales.
  const [int, frac] = Math.abs(value).toFixed(digits).split('.');
  // Milliers séparés par des virgules.
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Signe, entier, décimales.
  return (value < 0 ? '−' : '') + grouped + (frac ? `.${frac}` : '');
}

/** Durée en jours : heures sous 2 jours, jours sous 2 ans, années au-delà. */
function durationEn(days: number): string {
  // Valeur absolue (une rotation rétrograde est négative).
  const d = Math.abs(days);
  // Heures.
  if (d < 2) return `${en(d * 24, 1)} hours`;
  // Jours.
  if (d < 2 * YEAR_DAYS) return `${en(d, d < 100 ? 2 : 0)} days`;
  // Années.
  return `${en(d / YEAR_DAYS, d < 100 * YEAR_DAYS ? 2 : 0)} years`;
}

/** Nature et température des planètes, en anglais ; clé = nom français (comme PLANET_FACTS). */
const PLANET_EN: Record<string, { type: string; temperature: string }> = {
  Mercure: { type: 'Terrestrial planet', temperature: '−180 to +430 °C, from night to full day' },
  'Vénus': { type: 'Terrestrial planet', temperature: '≈ 465 °C at the surface, day and night' },
  Terre: { type: 'Terrestrial planet', temperature: '−89 to +57 °C at the surface, average ≈ 15 °C' },
  Mars: { type: 'Terrestrial planet', temperature: '−153 to +20 °C, average ≈ −63 °C' },
  Jupiter: { type: 'Gas giant', temperature: '≈ −108 °C at the 1 bar level' },
  Saturne: { type: 'Gas giant', temperature: '≈ −139 °C at the 1 bar level' },
  Uranus: { type: 'Ice giant', temperature: '≈ −197 °C at the 1 bar level' },
  Neptune: { type: 'Ice giant', temperature: '≈ −201 °C at the 1 bar level' },
  'Cérès': { type: 'Dwarf planet', temperature: '≈ −105 °C average at the surface' },
  Pluton: { type: 'Dwarf planet', temperature: '≈ −230 °C at the surface' },
};

/** Nom anglais de la planète mère, d'après la clé de bodies.data.ts. */
const PARENT_EN: Record<string, string> = {
  earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

/** Chiffres anglais des planètes. */
function planetFactsEn(): [string, BodyFact[]][] {
  // Pour chaque planète connue des deux tables :
  return PLANETS.flatMap((p): [string, BodyFact[]][] => {
    // valeurs fixes ;
    const f = PLANET_FACTS[p.name];
    // textes anglais ;
    const t = PLANET_EN[p.name];
    // absente d'une table : pas de chiffres ;
    if (!f || !t) return [];
    // demi-grand axe en unités astronomiques ;
    const a = p.elements[0];
    // rotation rétrograde ;
    const retro = p.rotation < 0 ? ', retrograde' : '';
    // liste des chiffres.
    return [[normalize(p.name), [
      { key: 'type', label: 'Type', value: t.type },
      { key: 'diameter', label: 'Mean diameter', value: `${en(2 * f.radiusKm)} km` },
      { key: 'distance', label: 'Mean distance from the Sun', value: `${en(a, 2)} AU (${en((a * AU_KM) / 1e6, a < 2 ? 1 : 0)} million km)` },
      { key: 'orbit', label: 'Orbital period around the Sun', value: durationEn(Math.pow(a, 1.5) * YEAR_DAYS) },
      { key: 'rotation', label: 'Rotation period', value: `${durationEn(p.rotation)}${retro}` },
      { key: 'density', label: 'Mean density', value: `${en(f.density, 2)} g/cm³` },
      { key: 'gravity', label: 'Surface gravity', value: `${en(f.gravity, 2)} m/s²` },
      { key: 'temperature', label: 'Temperature', value: t.temperature },
    ]]];
  });
}

/** Chiffres anglais d'un satellite. */
function satelliteFactsEn(name: string, parent: string, radiusKm: number, aKm: number, periodDays: number): [string, BodyFact[]] {
  // Nom anglais de la planète mère.
  const parentName = PARENT_EN[parent];
  // Liste des chiffres.
  return [normalize(name), [
    { key: 'type', label: 'Type', value: `Natural satellite of ${parentName}` },
    { key: 'diameter', label: 'Mean diameter', value: `${en(2 * radiusKm, radiusKm < 500 ? 1 : 0)} km` },
    { key: 'distance', label: `Mean distance from ${parentName}`, value: `${en(aKm)} km` },
    { key: 'orbit', label: 'Orbital period', value: `${durationEn(periodDays)}${periodDays < 0 ? ', retrograde' : ''}` },
  ]];
}

/** Chiffres anglais par adresse française de page. */
export const BODY_FACTS_EN: ReadonlyMap<string, BodyFact[]> = new Map<string, BodyFact[]>([
  // Soleil.
  ['soleil', [
    { key: 'type', label: 'Type', value: 'Star (yellow dwarf)' },
    { key: 'diameter', label: 'Mean diameter', value: `${en(2 * 695_700)} km, about 109 times Earth’s` },
  ]],
  // Planètes.
  ...planetFactsEn(),
  // Lune.
  satelliteFactsEn('Lune', 'earth', 1737.4, 384_400, 27.321661),
  // Autres satellites.
  ...SATELLITES.map((s) => satelliteFactsEn(s.name, s.parent, s.radiusKm, s.aKm, s.periodDays)),
]);

/** Questions-réponses anglaises tirées des chiffres (FAQ). `name` : nom anglais (« the Moon », « Mars »). */
export function bodyQuestionsEn(name: string, facts: BodyFact[]): { question: string; answer: string }[] {
  // Nom en début de phrase.
  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  // Géante (pas de sol) ?
  const giant = facts.some((f) => f.key === 'type' && /giant/i.test(f.value));
  // Orbite autour du Soleil ?
  const aroundSun = facts.some((f) => f.key === 'distance' && f.label.includes('Sun'));
  // Une fabrique par type de chiffre.
  const make: Partial<Record<BodyFact['key'], (v: string) => [string, string]>> = {
    diameter: (v) => [`What is the diameter of ${name}?`, `The mean diameter of ${name} is ${v}.`],
    distance: (v) => (aroundSun
      ? [`How far is ${name} from the Sun?`, `${Name} is on average ${v} from the Sun.`]
      : [`How far does ${name} orbit from its planet?`, `${Name} orbits on average ${v} from the centre of its planet.`]),
    orbit: (v) => [`How long is one orbit of ${name}?`, `One orbit of ${name} takes ${v}.`],
    rotation: (v) => [`How long does ${name} take to rotate?`, `One rotation of ${name} on its axis takes ${v}.`],
    gravity: (v) => [`What is the gravity on ${name}?`, `The surface gravity of ${name} is ${v}${giant ? ', measured where the pressure is 1 bar (a giant planet has no solid surface)' : ''}.`],
    temperature: (v) => [`What is the temperature on ${name}?`, `Temperature on ${name}: ${v}.`],
  };
  // Une question par chiffre qui en a une.
  return facts.flatMap((f) => {
    const q = make[f.key]?.(f.value);
    return q ? [{ question: q[0], answer: q[1] }] : [];
  });
}
