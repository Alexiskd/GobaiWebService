/**
 * Catalogue de la Documentation : une fiche par astre présent dans l'application (Soleil, planètes, planètes naines,
 * Lune et satellites naturels), construite à partir des mêmes données que la scène 3D (bodies.data) et des mêmes
 * caractéristiques que la fenêtre Informations (bodyFacts, planetData, sunFacts). Calcul pur, sans React.
 */
import { planetFacts, satelliteFacts } from '../Informations/bodyFacts.jsx';
import { SUN_FACTS } from '../Informations/sunFacts.js';
import { MOON_KEPLER_ELEMENTS } from '../../../../Engine/AstreSolideEngine/planetOrbits.jsx';
import { nf } from '../../../../Engine/shared/lib/format.jsx';

/** Identifiant d'une planète dans les données des satellites (champ `parent`) : 'earth', 'jupiter'… */
const PARENT_ID = {
  Mercure: 'mercury', Vénus: 'venus', Terre: 'earth', Mars: 'mars', Cérès: 'ceres', Jupiter: 'jupiter',
  Saturne: 'saturn', Uranus: 'uranus', Neptune: 'neptune', Pluton: 'pluto', Hauméa: 'haumea', Makémaké: 'makemake', Éris: 'eris',
};

/** Nom d'une planète dans une phrase : « la Terre », sinon le nom seul (« Jupiter »). */
const inSentence = (name) => (name === 'Terre' ? 'la Terre' : name);

/** Sans accents ni majuscules : pour la recherche. */
export const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const slug = (name) => fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Caractéristiques fixes de la Lune (celles de la fenêtre Informations sont en direct : phase, distance). */
function moonFixedFacts() {
  const m = MOON_KEPLER_ELEMENTS;
  return [
    { term: 'Type', value: 'Satellite naturel' },
    { term: 'Diamètre', value: '3 474,8 km', note: 'diamètre moyen' },
    { term: 'Orbite', value: `${nf(m.aKm)} km`, note: 'demi-grand axe autour de la Terre' },
    { term: 'Période orbitale', value: `${nf(m.periodDays, 2)} j`, note: 'période sidérale' },
    { term: 'Excentricité', value: nf(m.eccentricity, 4) },
    { term: 'Inclinaison', value: `${nf(m.inclinationDeg, 3)}°`, note: 'sur l’écliptique' },
    { term: 'Rotation', value: 'Synchrone', note: 'la Lune montre toujours la même face à la Terre' },
  ];
}

/**
 * Construit le catalogue : { groups: [{ id, name, entries }], entries } dans l'ordre d'affichage.
 * Une entrée : { id, name, kind, kindLabel, parentName, color, summary, facts: [{ term, value, note }] }.
 */
export function buildBodyCatalog({ sun, moon, planets = [], satellites = [] }) {
  const groups = [];
  const add = (id, name, entries) => { if (entries.length) groups.push({ id, name, entries }); };

  // Le Soleil.
  if (sun) {
    add('etoile', 'Étoile', [{
      id: 'soleil', name: sun.name || 'Soleil', kind: 'etoile', kindLabel: 'Étoile', parentName: null, color: sun.color || '#ffb300',
      facts: SUN_FACTS.map(([term, value]) => ({ term, value })),
    }]);
  }

  // Planètes, puis planètes naines, dans l'ordre de l'application (distance au Soleil).
  const planetEntry = (p) => {
    const facts = planetFacts(null, p);
    const type = facts.find((f) => f.term === 'Type')?.value;
    return {
      id: slug(p.name), name: p.name, kind: p.dwarf ? 'naine' : 'planete',
      kindLabel: type || (p.dwarf ? 'Planète naine' : 'Planète'), parentName: null, color: p.color || '#9aa4b2',
      facts,
    };
  };
  add('planetes', 'Planètes', planets.filter((p) => !p.dwarf).map(planetEntry));
  add('naines', 'Planètes naines', planets.filter((p) => p.dwarf).map(planetEntry));

  // Satellites naturels, par planète, du plus proche au plus lointain. La Lune ouvre le système de la Terre.
  for (const p of planets) {
    const pid = PARENT_ID[p.name];
    const own = satellites
      .filter((s) => s.parent === pid)
      .sort((a, b) => (a.aKm || 0) - (b.aKm || 0))
      .map((s) => ({
        id: s.id || slug(s.name), name: s.name, kind: 'satellite', kindLabel: 'Satellite naturel', parentName: p.name,
        color: s.color || '#a7a29a',
        facts: [{ term: 'Type', value: 'Satellite naturel' }, ...satelliteFacts({ parentName: inSentence(p.name) }, s)],
      }));
    if (pid === 'earth' && moon) {
      own.unshift({ id: 'lune', name: moon.name || 'Lune', kind: 'satellite', kindLabel: 'Satellite naturel', parentName: p.name, color: moon.color || '#c9c6bf', facts: moonFixedFacts() });
    }
    const of = p.name === 'Terre' ? 'de la Terre' : `${/^[AEIOUÉÈ]/i.test(p.name) ? 'd’' : 'de '}${p.name}`;
    add(`satellites-${pid}`, `${own.length > 1 ? 'Satellites' : 'Satellite'} ${of}`, own);
  }

  const entries = groups.flatMap((g) => g.entries);
  // Résumé d'une ligne pour la carte : type, diamètre, et planète pour un satellite.
  for (const e of entries) {
    const diameter = e.facts.find((f) => f.term === 'Diamètre')?.value
      ?? (e.kind === 'etoile' ? '1 391 400 km' : null);
    e.summary = [e.kindLabel, diameter && `Ø ${diameter}`, e.parentName && `autour de ${inSentence(e.parentName)}`].filter(Boolean).join(' · ');
  }
  return { groups, entries };
}

/** Filtre le catalogue : texte (nom, type, planète) et groupe ('tous' pour aucun filtre de groupe). */
export function filterCatalog(catalog, { query = '', group = 'tous' } = {}) {
  const q = fold(query).trim();
  return catalog.groups
    .filter((g) => group === 'tous' || g.id === group)
    .map((g) => ({ ...g, entries: q ? g.entries.filter((e) => fold(`${e.name} ${e.kindLabel} ${e.parentName || ''}`).includes(q)) : g.entries }))
    .filter((g) => g.entries.length);
}
