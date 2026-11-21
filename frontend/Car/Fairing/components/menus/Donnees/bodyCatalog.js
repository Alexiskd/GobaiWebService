/**
 * Catalogue de la Documentation : une fiche par astre présent dans l'application (Soleil, planètes, planètes naines,
 * Lune et satellites naturels), construite à partir des mêmes données que la scène 3D (bodies.data) et des mêmes
 * caractéristiques que la fenêtre Informations (bodyFacts, planetData, sunFacts). Calcul pur, sans React.
 */
import { planetFacts, satelliteFacts } from '../Informations/bodyFacts.jsx';
import { SUN_FACTS } from '../Informations/astres/sunFacts.js';
import { MOON_KEPLER_ELEMENTS } from '../../../../Engine/AstreSolideEngine/OrbitEngine/planetOrbits.jsx';
import { nf } from '../../../../Engine/shared/lib/format.jsx';

/** Identifiant d'une planète dans les données des satellites (champ `parent`) : 'earth', 'jupiter'… */
const PARENT_ID = {
  Mercure: 'mercury', Vénus: 'venus', Terre: 'earth', Mars: 'mars', Cérès: 'ceres', Jupiter: 'jupiter',
  Saturne: 'saturn', Uranus: 'uranus', Neptune: 'neptune', Pluton: 'pluto', Hauméa: 'haumea', Makémaké: 'makemake', Éris: 'eris',
};

/** Nom d'une planète dans une phrase : « la Terre », sinon le nom seul (« Jupiter »). */
const inSentence = (name) => (name === 'Terre' ? 'la Terre' : name);

/** Premier nombre d'un texte français (« 24 046 000 km » → 24046000), ou NaN. */
export const leadingNumber = (text) => {
  const m = String(text ?? '').replace(/[\s\u00a0\u202f]/g, '').match(/^\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : NaN;
};

/**
 * Fiche d'un satellite documenté par un PDF (petits satellites de Jupiter, absents de la scène 3D) : mêmes champs
 * qu'un satellite de la scène, plus `doc` (le document) et `inScene: false`.
 */
function documentEntry(doc, parentName) {
  const facts = [
    { term: 'Type', value: 'Satellite naturel', note: doc.group },
    { term: 'Désignation', value: doc.designation, note: `découverte : ${doc.discovery.provisional}` },
    { term: 'Dimensions', value: doc.physical.size },
    { term: 'Masse', value: doc.physical.mass },
    { term: 'Masse volumique', value: doc.physical.density },
    { term: 'Albédo moyen', value: doc.physical.albedo },
    { term: 'Orbite', value: doc.orbit.semiMajorAxis, note: `demi-grand axe autour de ${inSentence(parentName)}` },
    { term: 'Période orbitale', value: doc.orbit.period, note: doc.motion === 'rétrograde' ? 'rétrograde' : 'prograde' },
    { term: 'Excentricité', value: doc.orbit.eccentricity },
    { term: 'Inclinaison', value: doc.orbit.inclination },
    { term: 'Découverte', value: doc.discovery.date, note: [doc.discovery.who, doc.discovery.where].filter(Boolean).join(' · ') },
  ].filter((f) => f.value);
  return {
    id: `doc-${doc.id}`, name: doc.name, kind: 'satellite', kindLabel: 'Satellite naturel', parentName, color: '#a7a29a',
    aKm: leadingNumber(doc.orbit.semiMajorAxis), inScene: false, doc, facts,
  };
}

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
 * Une entrée : { id, name, kind, kindLabel, parentName, color, summary, facts: [{ term, value, note }], inScene, doc? }.
 * `documents` : les fiches PDF (petits satellites de Jupiter) ; elles rejoignent les satellites de Jupiter, rangées
 * avec eux par distance à la planète (elles ne sont pas dans la scène 3D : `inScene: false`).
 */
export function buildBodyCatalog({ sun, moon, planets = [], satellites = [], documents = [] }) {
  const groups = [];
  const add = (id, name, entries) => { if (entries.length) groups.push({ id, name, entries }); };

  // Le Soleil.
  if (sun) {
    add('etoile', 'Étoile', [{
      id: 'soleil', name: sun.name || 'Soleil', kind: 'etoile', kindLabel: 'Étoile', parentName: null, color: sun.color || '#ffb300', inScene: true,
      facts: SUN_FACTS.map(([term, value]) => ({ term, value })),
    }]);
  }

  // Planètes, puis planètes naines, dans l'ordre de l'application (distance au Soleil).
  const planetEntry = (p) => {
    const facts = planetFacts(null, p);
    const type = facts.find((f) => f.term === 'Type')?.value;
    return {
      id: slug(p.name), name: p.name, kind: p.dwarf ? 'naine' : 'planete',
      kindLabel: type || (p.dwarf ? 'Planète naine' : 'Planète'), parentName: null, color: p.color || '#9aa4b2', inScene: true,
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
      .map((s) => ({
        id: s.id || slug(s.name), name: s.name, kind: 'satellite', kindLabel: 'Satellite naturel', parentName: p.name,
        color: s.color || '#a7a29a', aKm: s.aKm, inScene: true,
        facts: [{ term: 'Type', value: 'Satellite naturel' }, ...satelliteFacts({ parentName: inSentence(p.name) }, s)],
      }));
    // Fiches PDF du même système (Jupiter), sans doublon avec un satellite de la scène.
    if (pid === 'jupiter') {
      const known = new Set(own.map((e) => fold(e.name)));
      for (const doc of documents) if (!known.has(fold(doc.name))) own.push(documentEntry(doc, p.name));
    }
    // Du plus proche au plus lointain de la planète.
    own.sort((a, b) => (Number.isFinite(a.aKm) ? a.aKm : Infinity) - (Number.isFinite(b.aKm) ? b.aKm : Infinity));
    if (pid === 'earth' && moon) {
      own.unshift({ id: 'lune', name: moon.name || 'Lune', kind: 'satellite', kindLabel: 'Satellite naturel', parentName: p.name, color: moon.color || '#c9c6bf', inScene: true, facts: moonFixedFacts() });
    }
    const of = p.name === 'Terre' ? 'de la Terre' : `${/^[AEIOUÉÈ]/i.test(p.name) ? 'd’' : 'de '}${p.name}`;
    add(`satellites-${pid}`, `${own.length > 1 ? 'Satellites' : 'Satellite'} ${of}`, own);
  }

  const entries = groups.flatMap((g) => g.entries);
  // Résumé d'une ligne pour la carte : type, diamètre, et planète pour un satellite.
  for (const e of entries) {
    const diameter = e.facts.find((f) => f.term === 'Diamètre' || f.term === 'Dimensions')?.value
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
    .map((g) => ({ ...g, entries: q ? g.entries.filter((e) => fold(`${e.name} ${e.kindLabel} ${e.parentName || ''} ${e.doc?.designation || ''}`).includes(q)) : g.entries }))
    .filter((g) => g.entries.length);
}

/**
 * Arborescence de la Documentation : le Soleil à la racine ; en dessous, deux branches, « Planètes » et
 * « Planètes naines » ; sous chaque planète, ses satellites (dans l'ordre du catalogue : du plus proche au plus
 * lointain). Renvoie { root } ; un nœud : { id, entry?, name, count?, children: [nœuds] }.
 */
export function bodyTree(catalog) {
  const satellitesOf = new Map();
  for (const e of catalog.entries) {
    if (e.kind !== 'satellite' || !e.parentName) continue;
    if (!satellitesOf.has(e.parentName)) satellitesOf.set(e.parentName, []);
    satellitesOf.get(e.parentName).push({ id: e.id, entry: e, name: e.name, children: [] });
  }
  const planetNode = (e) => ({ id: e.id, entry: e, name: e.name, children: satellitesOf.get(e.name) ?? [] });
  const branch = (id, name, kind) => {
    const children = catalog.entries.filter((e) => e.kind === kind).map(planetNode);
    return { id: `branche-${id}`, name, count: children.length, children };
  };
  const sun = catalog.entries.find((e) => e.kind === 'etoile');
  const branches = [branch('planetes', 'Planètes', 'planete'), branch('naines', 'Planètes naines', 'naine')].filter((b) => b.children.length);
  return { root: { id: sun?.id ?? 'soleil', entry: sun ?? null, name: sun?.name ?? 'Soleil', children: branches } };
}
