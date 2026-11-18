// Données des planètes et des satellites affichés.
import { PLANETS, SATELLITES } from './bodies.data';
// Fonction qui retire les accents et les majuscules d'un texte.
import { normalize } from '../../common/text';

/**
 * Chiffres de chaque astre pour les pages de référencement (body-pages.ts) : repris dans le texte de départ, les
 * données structurées et la version Markdown lue par les assistants IA. Uniquement des valeurs déjà présentes dans
 * le projet : rayons moyens et orbites (bodies.data.ts, JPL SSD), densité, pesanteur et température des planètes
 * (mêmes valeurs que frontend/src/moteur/engine/planetData.jsx, fiches NASA NSSDCA). Un astre sans chiffres fiables
 * ici (Phobos, Deimos) n'a pas de liste.
 */
// Forme d'un chiffre présenté sur la page d'un astre.
export interface BodyFact {
  // key : sa nature, parmi huit (type, diamètre, distance, orbite, rotation, masse volumique, pesanteur, température).
  key: 'type' | 'diameter' | 'distance' | 'orbit' | 'rotation' | 'density' | 'gravity' | 'temperature';
  // label : son intitulé affiché.
  label: string;
  // value : sa valeur, déjà mise en forme.
  value: string;
// Fin de BodyFact.
}

// Nombre de kilomètres dans une unité astronomique.
const AU_KM = 149_597_870.7;
// Nombre de jours dans une année.
const YEAR_DAYS = 365.25;

/** Nombre en écriture française (« 12 742 », « 5,43 »), espaces ordinaires entre les milliers. */
// Fonction fr : écrit un nombre à la française, avec le nombre de décimales voulu (0 par défaut).
export function fr(value: number, digits = 0): string {
  // Valeur absolue arrondie, coupée en partie entière et partie décimale.
  const [int, frac] = Math.abs(value).toFixed(digits).split('.');
  // Insère une espace tous les trois chiffres de la partie entière, en partant de la droite.
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Assemble : signe moins si le nombre est négatif, partie entière, puis virgule et décimales s'il y en a.
  return (value < 0 ? '−' : '') + grouped + (frac ? `,${frac}` : '');
// Fin de fr.
}

/** Durée en jours écrite simplement : heures sous 2 jours, jours sous 2 ans, années au-delà. */
// Fonction duration : écrit une durée donnée en jours.
export function duration(days: number): string {
  // Durée sans son signe (une rotation rétrograde est négative).
  const d = Math.abs(days);
  // Moins de 2 jours : en heures, avec une décimale.
  if (d < 2) return `${fr(d * 24, 1)} heures`;
  // Moins de 2 ans : en jours, avec 2 décimales sous 100 jours, sans décimale au-delà.
  if (d < 2 * YEAR_DAYS) return `${fr(d, d < 100 ? 2 : 0)} jours`;
  // Au-delà : en années, avec 2 décimales sous 100 ans, sans décimale au-delà.
  return `${fr(d / YEAR_DAYS, d < 100 * YEAR_DAYS ? 2 : 0)} ans`;
// Fin de duration.
}

/** Rayon moyen (km) et caractéristiques fixes des planètes ; clé = nom français de bodies.data.ts. */
// Caractéristiques fixes de chaque planète, par nom français : rayon moyen, type, masse volumique, pesanteur, température.
const PLANET_FACTS: Record<string, { radiusKm: number; type: string; density: number; gravity: number; temperature: string }> = {
  // Mercure : rayon moyen 2439,7 km, planète tellurique, masse volumique 5,43 g/cm³, pesanteur 3,7 m/s², et sa température.
  Mercure: { radiusKm: 2439.7, type: 'Planète tellurique', density: 5.43, gravity: 3.7, temperature: '−180 à +430 °C, de la nuit au plein jour' },
  // Vénus : rayon moyen 6051,8 km, planète tellurique, masse volumique 5,24 g/cm³, pesanteur 8,87 m/s², et sa température.
  'Vénus': { radiusKm: 6051.8, type: 'Planète tellurique', density: 5.24, gravity: 8.87, temperature: '≈ 465 °C au sol, jour et nuit' },
  // Terre : rayon moyen 6371 km, planète tellurique, masse volumique 5,51 g/cm³, pesanteur 9,8 m/s², et sa température.
  Terre: { radiusKm: 6371, type: 'Planète tellurique', density: 5.51, gravity: 9.8, temperature: '−89 à +57 °C au sol, moyenne ≈ 15 °C' },
  // Mars : rayon moyen 3389,5 km, planète tellurique, masse volumique 3,93 g/cm³, pesanteur 3,71 m/s², et sa température.
  Mars: { radiusKm: 3389.5, type: 'Planète tellurique', density: 3.93, gravity: 3.71, temperature: '−153 à +20 °C, moyenne ≈ −63 °C' },
  // Jupiter : rayon moyen 69911 km, géante gazeuse, masse volumique 1,33 g/cm³, pesanteur 24,79 m/s², et sa température.
  Jupiter: { radiusKm: 69911, type: 'Géante gazeuse', density: 1.33, gravity: 24.79, temperature: '≈ −108 °C au niveau 1 bar' },
  // Saturne : rayon moyen 58232 km, géante gazeuse, masse volumique 0,69 g/cm³, pesanteur 10,44 m/s², et sa température.
  Saturne: { radiusKm: 58232, type: 'Géante gazeuse', density: 0.69, gravity: 10.44, temperature: '≈ −139 °C au niveau 1 bar' },
  // Uranus : rayon moyen 25362 km, géante de glaces, masse volumique 1,27 g/cm³, pesanteur 8,87 m/s², et sa température.
  Uranus: { radiusKm: 25362, type: 'Géante de glaces', density: 1.27, gravity: 8.87, temperature: '≈ −197 °C au niveau 1 bar' },
  // Neptune : rayon moyen 24622 km, géante de glaces, masse volumique 1,64 g/cm³, pesanteur 11,15 m/s², et sa température.
  Neptune: { radiusKm: 24622, type: 'Géante de glaces', density: 1.64, gravity: 11.15, temperature: '≈ −201 °C au niveau 1 bar' },
  // Pluton : rayon moyen 1188,3 km, planète naine, masse volumique 1,85 g/cm³, pesanteur 0,62 m/s², et sa température.
  Pluton: { radiusKm: 1188.3, type: 'Planète naine', density: 1.85, gravity: 0.62, temperature: '≈ −230 °C au sol' },
// Fin de la table.
};

// Nom de chaque planète mère, avec son article :
const PARENT_NAME: Record<string, string> = {
  // la Terre, Mars, Jupiter, Saturne, Uranus, Neptune, Pluton.
  earth: 'la Terre', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
// Fin de la table.
};

// Fonction planetFacts : les chiffres de chaque planète, sous forme de couples [adresse de page, liste de chiffres].
function planetFacts(): [string, BodyFact[]][] {
  // Pour chaque planète (flatMap permet d'en sauter une en rendant une liste vide) :
  return PLANETS.flatMap((p): [string, BodyFact[]][] => {
    // ses caractéristiques fixes ;
    const f = PLANET_FACTS[p.name];
    // absentes : la planète est sautée.
    if (!f) return [];
    // Demi-grand axe de son orbite.
    const a = p.elements[0]; // demi-grand axe, en unités astronomiques
    // Mention ajoutée si sa rotation est rétrograde.
    const retro = p.rotation < 0 ? ', rétrograde' : '';
    // Un couple : l'adresse (le nom sans accents ni majuscules) et ses chiffres :
    return [[normalize(p.name), [
      // son type ;
      { key: 'type', label: 'Type', value: f.type },
      // son diamètre : deux fois le rayon ;
      { key: 'diameter', label: 'Diamètre moyen', value: `${fr(2 * f.radiusKm)} km` },
      // sa distance au Soleil en UA, et en millions de kilomètres (une décimale en dessous de 2 UA) ;
      { key: 'distance', label: 'Distance moyenne au Soleil', value: `${fr(a, 2)} UA (${fr((a * AU_KM) / 1e6, a < 2 ? 1 : 0)} millions de km)` },
      // la durée de son orbite : troisième loi de Kepler, a puissance 1,5 en années ;
      { key: 'orbit', label: 'Durée d’une orbite autour du Soleil', value: duration(Math.pow(a, 1.5) * YEAR_DAYS) },
      // sa rotation, avec la mention « rétrograde » s'il y a lieu ;
      { key: 'rotation', label: 'Rotation sur elle-même', value: `${duration(p.rotation)}${retro}` },
      // sa masse volumique ;
      { key: 'density', label: 'Masse volumique moyenne', value: `${fr(f.density, 2)} g/cm³` },
      // sa pesanteur ;
      { key: 'gravity', label: 'Pesanteur', value: `${fr(f.gravity, 2)} m/s²` },
      // sa température.
      { key: 'temperature', label: 'Température', value: f.temperature },
    // Fin du couple.
    ]]];
  // Fin de la transformation.
  });
// Fin de planetFacts.
}

// Fonction satelliteFacts : les chiffres d'un satellite, à partir de son nom, de sa planète, de son rayon, de son demi-grand axe et de sa période.
function satelliteFacts(name: string, parent: string, radiusKm: number, aKm: number, periodDays: number): [string, BodyFact[]] {
  // Nom de sa planète, avec article.
  const parentName = PARENT_NAME[parent];
  // Tournure « de » : « de la Terre », « d'Uranus » devant une voyelle, « de Mars » sinon.
  const of = /^(la|le) /.test(parentName) ? `de ${parentName}` : /^[AEIOUY]/.test(parentName) ? `d’${parentName}` : `de ${parentName}`;
  // Un couple : l'adresse et ses chiffres :
  return [normalize(name), [
    // son type, « Satellite naturel de… » ;
    { key: 'type', label: 'Type', value: `Satellite naturel ${of}` },
    // son diamètre, avec une décimale pour les petits satellites (rayon sous 500 km) ;
    { key: 'diameter', label: 'Diamètre moyen', value: `${fr(2 * radiusKm, radiusKm < 500 ? 1 : 0)} km` },
    // sa distance, « à la Terre » pour la Lune, « à sa planète » sinon ;
    { key: 'distance', label: `Distance moyenne ${parent === 'earth' ? 'à la Terre' : 'à sa planète'}`, value: `${fr(aKm)} km` },
    // la durée de son orbite, avec la mention « en sens rétrograde » si la période est négative.
    { key: 'orbit', label: 'Durée d’une orbite', value: `${duration(periodDays)}${periodDays < 0 ? ', en sens rétrograde' : ''}` },
  // Fin du couple.
  ]];
// Fin de satelliteFacts.
}

/** Chiffres par adresse de page (« mars », « ganymede »…). */
// Table adresse de page → chiffres, non modifiable, construite à partir de :
export const BODY_FACTS: ReadonlyMap<string, BodyFact[]> = new Map<string, BodyFact[]>([
  // le Soleil, écrit à la main :
  ['soleil', [
    // son type ;
    { key: 'type', label: 'Type', value: 'Étoile (naine jaune)' },
    // son diamètre.
    { key: 'diameter', label: 'Diamètre moyen', value: `${fr(2 * 695_700)} km, environ 109 fois celui de la Terre` },
  // Fin du Soleil.
  ]],
  // les planètes ;
  ...planetFacts(),
  // la Lune, avec son rayon, sa distance et sa période ;
  satelliteFacts('Lune', 'earth', 1737.4, 384_400, 27.321661),
  // et chaque satellite affiché.
  ...SATELLITES.map((s) => satelliteFacts(s.name, s.parent, s.radiusKm, s.aKm, s.periodDays)),
// Fin de la table.
]);

/** « de la Terre », « du Soleil », « d’Io », « de Mars » : nom avec article précédé de « de ». */
// Fonction ofLabel : met « de » devant un nom avec article.
export function ofLabel(label: string): string {
  // « le … » devient « du … ».
  if (label.startsWith('le ')) return `du ${label.slice(3)}`;
  // Devant une voyelle ou un h (accents retirés pour le test) : « d'… ».
  if (/^[aeiouyéèh]/i.test(normalize(label))) return `d’${label}`;
  // Sinon « de … ».
  return `de ${label}`;
// Fin de ofLabel.
}

// Fonction capitalize : met la première lettre en majuscule.
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Questions-réponses tirées des chiffres d'un astre (pour la FAQ de sa page). `label` : nom avec article. */
// Fonction bodyQuestions : fabrique des questions-réponses à partir des chiffres d'un astre.
export function bodyQuestions(label: string, facts: BodyFact[]): { question: string; answer: string }[] {
  // Nom précédé de « de ».
  const of = ofLabel(label);
  // Nom avec majuscule, pour commencer une phrase.
  const Label = capitalize(label);
  // L'astre est-il une géante ?
  const giant = facts.some((f) => f.key === 'type' && f.value.startsWith('Géante'));
  // Tourne-t-il autour du Soleil (et non autour d'une planète) ?
  const aroundSun = facts.some((f) => f.key === 'distance' && f.label.includes('Soleil'));
  // Pour chaque nature de chiffre, une fonction qui fabrique la question et la réponse (toutes les natures n'en ont pas) :
  const make: Partial<Record<BodyFact['key'], (v: string) => [string, string]>> = {
    // diamètre ;
    diameter: (v) => [`Quel est le diamètre ${of} ?`, `Le diamètre moyen ${of} est de ${v}.`],
    // distance, selon le cas :
    distance: (v) => (aroundSun
      // autour du Soleil ;
      ? [`À quelle distance du Soleil se trouve ${label} ?`, `${Label} se trouve en moyenne à ${v} du Soleil.`]
      // autour d'une planète.
      : [`À quelle distance de sa planète orbite ${label} ?`, `${Label} orbite en moyenne à ${v} du centre de sa planète.`]),
    // durée de l'orbite ;
    orbit: (v) => [`Combien de temps dure une orbite ${of} ?`, `Une orbite ${of} dure ${v}.`],
    // durée de la rotation ;
    rotation: (v) => [`Combien de temps dure la rotation ${of} ?`, `La rotation ${of} sur elle-même dure ${v}.`],
    // pesanteur, avec une précision pour une géante, qui n'a pas de sol ;
    gravity: (v) => [`Quelle est la pesanteur ${of} ?`, `La pesanteur ${of} est de ${v}${giant ? ', mesurée au niveau où la pression vaut 1 bar (une géante n’a pas de sol)' : ''}.`],
    // température.
    temperature: (v) => [`Quelle est la température ${of} ?`, `Température ${of} : ${v}.`],
  // Fin de la table.
  };
  // Pour chaque chiffre de l'astre :
  return facts.flatMap((f) => {
    // fabrique sa question, si sa nature en a une ;
    const q = make[f.key]?.(f.value);
    // et la garde ; sinon rien.
    return q ? [{ question: q[0], answer: q[1] }] : [];
  // Fin de la transformation.
  });
// Fin de bodyQuestions.
}
