// Importe useMemo de React.
import { useMemo } from 'react';
// Importe searchPlaces, la recherche distante de lieux.
import { searchPlaces } from '@/moteur/api';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe les lieux des astres et bodyId, l'identifiant d'un astre.
import { BODY_PLACES, bodyId } from '@/moteur/engine/bodyPlaces';
// Importe les types et la liste des lieux lunaires.
import { FEATURE_TYPES, MOON_FEATURES } from '@/moteur/engine/moonFeatures';
// Importe les caractéristiques de la Lune, d'une planète et d'un satellite.
import { moonFacts, planetFacts, satelliteFacts } from './bodyFacts';

// Lieux lunaires, avec le nom de leur type en clair (le type brut à défaut).
const MOON_PLACES = MOON_FEATURES.map((f) => ({ ...f, kind: FEATURE_TYPES[f.type]?.label || f.type }));

// Navigation par astre : chaque entrée désigne le geste fourni par SolarScene.
// Nom du rappel de navigation de chaque astre.
const NAVIGATION = { moon: 'onGoMoon', earth: 'onGoPlace', mars: 'onGoMars', mercury: 'onGoMercury', venus: 'onGoVenus' };

// Adaptation uniforme : la Lune et la Terre ont leurs particularités, toutes les autres planètes
// partagent la même règle (repères de BODY_PLACES, lecture seule si la surface n’est pas cartographiée).
// Format compact des populations, en français, avec une décimale au plus.
const popFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

// Terre : les ≈ 7 300 villes du globe (Natural Earth, triées par population), puis la liste de base pour celles qui
// manqueraient ; les autres localités du monde viennent de la recherche distante (OpenStreetMap / Uber Maps).
// Déclare earthPlaces : les villes de base et les villes du monde.
function earthPlaces(cities, worldCities = []) {
  // Chaque ville du monde devient un lieu (début).
  const out = worldCities.map((c) => ({
    // Son nom français (sinon son nom), sa position et son type.
    name: c.nameFr || c.name, lat: c.lat, lon: c.lon, kind: 'Ville',
    // Son nom local et ses variantes.
    native: c.native, alt: [c.name, c.nameFr].filter(Boolean),
    // Son pays et sa population, séparés par un point médian.
    info: [c.countryFr || c.country, c.pop > 0 ? `${popFmt.format(c.pop)} hab.` : null].filter(Boolean).join(' · '),
  // Fin de la conversion.
  }));
  // near : vrai si deux lieux sont à moins de 0,3° l'un de l'autre.
  const near = (a, b) => Math.abs(a.lat - b.lat) < 0.3 && Math.abs(a.lon - b.lon) < 0.3;
  // Ajoute les villes de base qui n'ont pas de voisine dans la liste.
  for (const c of cities) if (!out.some((w) => near(w, c))) out.push({ ...c, kind: 'Ville' });
  // Renvoie la liste.
  return out;
// Fin de earthPlaces.
}

/** Recherche distante de toutes les localités du monde (OpenStreetMap via Photon, ou Uber Maps). */
// searchWorld : lance la recherche distante…
const searchWorld = (q, signal) => searchPlaces(q, signal)
  // … et convertit chaque résultat en lieu (liste vide à défaut).
  .then((r) => (r.items || []).map((p) => ({ name: p.name, lat: p.lat, lon: p.lon, kind: 'Lieu', info: p.context })));

// Déclare adaptPlaces : choisit les lieux et le texte indicatif selon l'astre.
function adaptPlaces({ id, name, isMoon, cities, worldCities }) {
  // Lune : les lieux lunaires.
  if (isMoon) return { places: MOON_PLACES, placeholder: 'Rechercher un lieu lunaire…' };
  // Terre : les villes, avec la recherche distante.
  if (id === 'earth') return { places: earthPlaces(cities, worldCities), placeholder: 'Rechercher une ville du monde…', remote: searchWorld };
  // Autre astre : ses repères, liste vide s'il n'en a pas.
  return { places: BODY_PLACES[id] || [], placeholder: `Rechercher un lieu sur ${name}…` };
// Fin de adaptPlaces.
}

/** Résout l’astre ciblé et son contenu adapté, pour que la coquille globale reste identique partout. */
// Déclare et exporte le crochet useBodyView : HUD, données, villes du monde, phases et rappels.
export function useBodyView({ hud, data, worldCities, phases, handlers }) {
  // Lit l'état en direct de la Lune.
  const moon = useHud(hud, (s) => s.moonLive);
  // Lit l'état en direct de l'astre visé.
  const body = useHud(hud, (s) => s.bodyLive);

  // Vrai si la Lune est visée.
  const isMoon = Boolean(moon);
  // Identifiant de l'astre : « moon », sinon celui de l'astre visé, null à défaut.
  const id = moon ? 'moon' : body?.id ?? null;
  // Nom de l'astre : celui de la Lune, sinon celui de l'astre visé, vide à défaut.
  const name = moon ? data.bodies.moon.name : body?.name ?? '';

  // La liste des lieux ne change qu'avec l'astre : elle n'est plus recréée à chaque mise à jour du HUD.
  // Lieux, texte indicatif et recherche distante (début du calcul mémorisé).
  const { places, placeholder, remote } = useMemo(
    // Adaptés à l'astre ; rien sans astre.
    () => (id ? adaptPlaces({ id, name, isMoon, cities: data.cities, worldCities }) : { places: [], placeholder: '' }),
    // Dépendances : l'astre, les villes de base et les villes du monde.
    [id, name, isMoon, data.cities, worldCities],
  // Fin du calcul.
  );
  // Définition de la planète visée (début du calcul mémorisé).
  const def = useMemo(
    // Cherchée dans les données, hors Lune ; null sinon.
    () => (id && !isMoon ? data.bodies.planets.find((p) => bodyId(p) === id) || null : null),
    // Dépendances : l'astre et la liste des planètes.
    [id, isMoon, data.bodies.planets],
  // Fin du calcul.
  );

  // Satellite naturel (Io, Titan, Phobos…) : ses caractéristiques viennent de la liste des satellites de l'API.
  // Définition du satellite visé (début du calcul mémorisé).
  const satDef = useMemo(
    // Cherchée dans les satellites des données, si l'astre visé en est un ; null sinon.
    () => (id && !isMoon && body?.satellite ? (data.bodies.satellites || []).find((s) => s.id === id) || null : null),
    // Dépendances : l'astre, son statut de satellite et la liste des satellites.
    [id, isMoon, body?.satellite, data.bodies.satellites],
  // Fin du calcul.
  );

  // Sans astre, pas de vue.
  if (!id) return null;

  // Caractéristiques : celles de la Lune, du satellite ou de la planète ; aucune sinon.
  const facts = moon ? moonFacts(moon) : satDef ? satelliteFacts(body, satDef) : def ? planetFacts(body, def) : [];

  // Renvoie la vue (début de l'objet).
  return {
    // L'identifiant.
    id,
    // Le nom.
    name,
    // L'état de la Lune.
    moon,
    // Les phases.
    phases,
    // Les lieux.
    places,
    // Le texte indicatif.
    placeholder,
    // La recherche distante.
    remote,
    // Les caractéristiques.
    facts,
    // Type présenté dans l'en-tête : satellite naturel, type scientifique de la planète ou planète.
    type: (moon || satDef) ? 'Satellite naturel' : (facts.find((f) => f.term === 'Type')?.value || 'Planète'),
    // Diamètre scientifique, repris de la fiche des caractéristiques.
    diameter: facts.find((f) => f.term === 'Diamètre')?.value || '',
    // Le rappel de navigation de cet astre, null s'il n'en a pas.
    onPick: handlers[NAVIGATION[id]] || null,
  // Fin de l'objet.
  };
// Fin de useBodyView.
}
