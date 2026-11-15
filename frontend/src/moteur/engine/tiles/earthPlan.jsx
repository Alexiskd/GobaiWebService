// Importe le test des paliers de zoom, depuis zoomTiers.
import { validTiers } from './zoomTiers';

// Table de priorité des sources de la Terre, lue sur le serveur (GET /api/v1/tiles/earth/plan, voir backend
// earth-plan.ts). Le navigateur ne garde aucune règle de choix en dur : il lit cette table, la vérifie et la convertit
// en plan de chargement direct (les sources dans l'ordre de priorité, avec leurs emprises, leurs niveaux et les
// adresses qu'il peut charger lui-même). Fonctions pures, testées dans earthPlan.test.jsx.

/** La table est-elle utilisable ? (version, et au moins une source bien formée) */
// Déclare et exporte validEarthPlan : la table reçue.
export function validEarthPlan(plan) {
  // Vrai si c'est un objet avec une version numérique
  return Boolean(plan && Number.isFinite(plan.version)
    // et une liste non vide de sources, chacune avec un identifiant, un rang et des niveaux numériques.
    && Array.isArray(plan.sources) && plan.sources.length > 0
    // (chaque source bien formée)
    && plan.sources.every((s) => s && typeof s.id === 'string' && Number.isFinite(s.priority) && Number.isFinite(s.minZoom) && Number.isFinite(s.maxZoom)));
// Fin de validEarthPlan.
}

/**
 * Plan de chargement direct tiré de la table : les sources triées par rang (1 d'abord), avec seulement ce dont le
 * chargement a besoin. null si la table est inutilisable : tout passe alors par le relais du serveur.
 */
// Déclare et exporte planToDirect : la table reçue.
export function planToDirect(plan) {
  // Table inutilisable : null.
  if (!validEarthPlan(plan)) return null;
  // Copie des sources, triée par rang ;
  return [...plan.sources].sort((a, b) => a.priority - b.priority).map((s) => ({
    // identifiant, rang et niveaux natifs ;
    id: s.id, priority: s.priority, minZoom: s.minZoom, maxZoom: s.maxZoom,
    // emprises, s'il y en a ;
    ...(Array.isArray(s.bboxes) && s.bboxes.length ? { bboxes: s.bboxes } : {}),
    // adresses chargeables par le navigateur, s'il y en a ;
    ...(Array.isArray(s.templates) && s.templates.length ? { templates: s.templates } : {}),
    // niveau bas de la vue de loin, s'il y en a un.
    ...(Number.isFinite(s.lowZoom) ? { lowZoom: s.lowZoom } : {}),
  // Fin de la conversion.
  }));
// Fin de planToDirect.
}

/**
 * Description de la couche complétée par sa table : le plan direct (`direct`), l'accord des couleurs, la version de
 * la table, ses paliers de zoom (`tiers`) et le chargement limité au champ de la caméra (`fieldOnly`). Sans table
 * utilisable, la description est rendue sans plan direct (tout passe par le relais) ni paliers.
 */
// Déclare et exporte withPlan : la description de la couche et la table reçue (ou null).
export function withPlan(info, plan) {
  // Plan direct tiré de la table.
  const direct = planToDirect(plan);
  // Description sans l'ancien plan direct éventuel.
  const { direct: _old, ...rest } = info || {};
  // Sans plan : la description seule.
  if (!direct) return rest;
  // Sinon : la description, le plan, l'accord des couleurs de la table et sa version,
  return { ...rest, direct, colorMatch: plan.colorMatch !== false, planVersion: plan.version,
    // ses paliers s'ils sont utilisables, et le chargement limité au champ de la caméra.
    ...(validTiers(plan.tiers) ? { tiers: plan.tiers } : {}), fieldOnly: plan.fieldOnly === true };
// Fin de withPlan.
}
