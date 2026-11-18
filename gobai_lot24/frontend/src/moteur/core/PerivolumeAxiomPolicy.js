import { LOAD_STATE } from './PerivolumeManager.js';

export const PERIVOLUME_RELATION = Object.freeze({ INTERNAL: 'internal', EXTERNAL: 'external' });
export const PERIVOLUME_LEVEL = Object.freeze({ SYSTEM: 'system', BODY: 'body' });

/** Configuration canonique des quatre axiomes. Les IDs sont personnalisables à l'intégration. */
export function createGobaiPerivolumeAxioms(ids = {}) {
  const value = {
    earthSystem: ids.earthSystem || 'system:earth',
    solarSystem: ids.solarSystem || 'system:solar',
    proximaSystem: ids.proximaSystem || 'system:proxima-centauri',
    earth: ids.earth || 'body:earth',
    moon: ids.moon || 'body:moon',
    mercury: ids.mercury || 'body:mercury',
  };
  return [
    { id: 'systems-earth-solar-internal', level: PERIVOLUME_LEVEL.SYSTEM, relation: PERIVOLUME_RELATION.INTERNAL, members: [value.earthSystem, value.solarSystem] },
    { id: 'systems-solar-proxima-external', level: PERIVOLUME_LEVEL.SYSTEM, relation: PERIVOLUME_RELATION.EXTERNAL, members: [value.solarSystem, value.proximaSystem] },
    { id: 'bodies-earth-moon-internal', level: PERIVOLUME_LEVEL.BODY, relation: PERIVOLUME_RELATION.INTERNAL, members: [value.earth, value.moon] },
    { id: 'bodies-earth-mercury-external', level: PERIVOLUME_LEVEL.BODY, relation: PERIVOLUME_RELATION.EXTERNAL, members: [value.earth, value.mercury] },
  ];
}

function validateAxiom(axiom) {
  if (!axiom || !Array.isArray(axiom.members) || axiom.members.length !== 2
    || axiom.members.some((id) => typeof id !== 'string' || !id.trim())
    || !Object.values(PERIVOLUME_RELATION).includes(axiom.relation)) {
    throw new TypeError('Chaque axiome doit définir deux membres et une relation internal/external.');
  }
}

/** Applique les règles de concurrence après les distances géométriques.
 * INTERNAL : le membre actif reste ACTIVE, son partenaire est plafonné à BACKGROUND.
 * EXTERNAL : le membre actif gagne et son partenaire passe à UNLOADED.
 * Si les deux volumes se chevauchent, le membre ayant la plus petite distance/rayon gagne.
 */
export function applyPerivolumeAxioms(decisions, axioms = []) {
  if (!Array.isArray(decisions) || !Array.isArray(axioms)) throw new TypeError('decisions et axioms doivent être des tableaux.');
  const byId = new Map(decisions.map((decision) => [decision.id, { ...decision }]));
  for (const axiom of axioms) {
    validateAxiom(axiom);
    const [leftId, rightId] = axiom.members;
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) continue;
    const active = [left, right].filter((item) => item.state === LOAD_STATE.ACTIVE);
    if (!active.length) continue;
    const normalizedDistance = (item) => Number.isFinite(item.radius) && item.radius > 0
      ? item.distance / item.radius : item.distance;
    active.sort((a, b) => normalizedDistance(a) - normalizedDistance(b)); // tri stable : à égalité, le premier membre déclaré gagne
    const winner = active[0];
    const loser = winner.id === leftId ? right : left;
    const effectiveState = axiom.relation === PERIVOLUME_RELATION.EXTERNAL
      ? LOAD_STATE.UNLOADED
      : (loser.state === LOAD_STATE.UNLOADED ? LOAD_STATE.UNLOADED : LOAD_STATE.BACKGROUND);
    if (loser.state !== effectiveState) {
      loser.axiomPreviousState = loser.state;
      loser.state = effectiveState;
      loser.axiom = { id: axiom.id || null, relation: axiom.relation, level: axiom.level || null, winner: winner.id };
      loser.changed = true;
    }
    winner.axiom = { id: axiom.id || null, relation: axiom.relation, level: axiom.level || null, winner: winner.id };
  }
  return [...byId.values()];
}
