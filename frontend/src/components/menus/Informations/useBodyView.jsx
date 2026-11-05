import { useMemo } from 'react';
import { useHud } from '@/engine/hudStore';
import { BODY_PLACES, bodyId } from '@/engine/bodyPlaces';
import { FEATURE_TYPES, MOON_FEATURES } from '@/engine/moonFeatures';
import { moonFacts, planetFacts } from './bodyFacts';

const MOON_PLACES = MOON_FEATURES.map((f) => ({ ...f, kind: FEATURE_TYPES[f.type]?.label || f.type }));

// Navigation par astre : chaque entrée désigne le geste fourni par SolarScene.
const NAVIGATION = { moon: 'onGoMoon', earth: 'onGoPlace', mars: 'onGoMars', mercury: 'onGoMercury', venus: 'onGoVenus' };

// Adaptation uniforme : la Lune et la Terre ont leurs particularités, toutes les autres planètes
// partagent la même règle (repères de BODY_PLACES, lecture seule si la surface n’est pas cartographiée).
function adaptPlaces({ id, name, isMoon, cities }) {
  if (isMoon) return { places: MOON_PLACES, placeholder: 'Rechercher un lieu lunaire…' };
  if (id === 'earth') return { places: cities.map((c) => ({ ...c, kind: 'Ville' })), placeholder: 'Rechercher une ville…' };
  return { places: BODY_PLACES[id] || [], placeholder: `Rechercher un lieu sur ${name}…` };
}

/** Résout l’astre ciblé et son contenu adapté, pour que la coquille globale reste identique partout. */
export function useBodyView({ hud, data, phases, handlers }) {
  const moon = useHud(hud, (s) => s.moonLive);
  const body = useHud(hud, (s) => s.bodyLive);

  const isMoon = Boolean(moon);
  const id = moon ? 'moon' : body?.id ?? null;
  const name = moon ? data.bodies.moon.name : body?.name ?? '';

  // La liste des lieux ne change qu'avec l'astre : elle n'est plus recréée à chaque mise à jour du HUD.
  const { places, placeholder } = useMemo(
    () => (id ? adaptPlaces({ id, name, isMoon, cities: data.cities }) : { places: [], placeholder: '' }),
    [id, name, isMoon, data.cities],
  );
  const def = useMemo(
    () => (id && !isMoon ? data.bodies.planets.find((p) => bodyId(p) === id) || null : null),
    [id, isMoon, data.bodies.planets],
  );

  if (!id) return null;

  const facts = moon ? moonFacts(moon) : def ? planetFacts(body, def) : [];

  return {
    id,
    name,
    moon,
    phases,
    places,
    placeholder,
    facts,
    onPick: handlers[NAVIGATION[id]] || null,
  };
}
