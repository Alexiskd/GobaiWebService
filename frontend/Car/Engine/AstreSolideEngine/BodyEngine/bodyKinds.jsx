// Familles d'astres que la fenêtre « Paramètres » peut masquer d'un bouton. Fonctions pures.
// Importe bodyId, l'identifiant d'une planète, depuis bodyPlaces.
import { bodyId } from '../LabelEngine/bodyPlaces.jsx';

/** Géantes gazeuses et de glace (mêmes astres que les entrées `gas` de tiledBodies.jsx). */
// Ensemble des identifiants des planètes gazeuses.
const GAS_IDS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);

/** Familles, dans l'ordre des boutons. `satellite` regroupe la Lune et tous les satellites naturels. */
// Déclare et exporte la liste des familles (début).
export const BODY_KINDS = [
  // Famille « solid » : son libellé et ses exemples.
  { id: 'solid', label: 'Planètes solides', hint: 'Mercure, Vénus, Terre, Mars' },
  // Famille « gas » : son libellé et ses exemples.
  { id: 'gas', label: 'Planètes gazeuses', hint: 'Jupiter, Saturne, Uranus, Neptune' },
  // Famille « dwarf » : son libellé et ses exemples.
  { id: 'dwarf', label: 'Planètes naines', hint: 'Pluton, Cérès, Hauméa, Makémaké, Éris' },
  // Famille « satellite » : son libellé et ses exemples.
  { id: 'satellite', label: 'Satellites naturels', hint: 'Lune, Io, Titan, Phobos…' },
// Fin de la liste.
];

// Déclare et exporte l'objet où chaque famille est affichée : identifiant → vrai.
export const ALL_KINDS_SHOWN = Object.fromEntries(BODY_KINDS.map((k) => [k.id, true]));

// fold : texte sans accents et en minuscules, pour comparer deux noms.
const fold = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Affichage au tout premier instant : tout est affiché, le temps que la liste des couches de cartes arrive. */
// Déclare et exporte defaultVisibility.
export function defaultVisibility() {
  // Renvoie une copie de toutes les familles affichées, et aucun astre masqué.
  return { kinds: { ...ALL_KINDS_SHOWN }, hiddenBodies: [] };
// Fin de defaultVisibility.
}

/**
 * Politique d'affichage initial : la présence ou l'absence d'une couche cartographique
 * ne doit jamais décider si un astre existe dans la scène 3D.
 * Les couches restent des ressources de surface ; elles ne filtrent pas le catalogue.
 */
export function bodiesWithLayers(layers = [], status = []) {
  // Conservé pour compatibilité : renvoie les astres ayant une couche.
  const set = new Set((layers || []).map((l) => l.body || 'earth'));
  for (const row of status || []) {
    if (!row?.id) continue;
    if (row.layers > 0) set.add(row.id); else set.delete(row.id);
  }
  return set;
}

/** Tous les astres du catalogue sont affichés au lancement, quelle que soit leur couche. */
export function shownByDefault(body) {
  // Le Soleil et tous les autres astres sont visibles initialement.
  return Boolean(body);
}

/** Aucun astre n'est décoché automatiquement au chargement. */
export function defaultHiddenBodies(bodies = [], layers = [], path = '', status = []) {
  // Paramètres conservés pour compatibilité avec les anciens appels.
  return [];
}

/** Famille d'une planète (définition de l'API) : 'dwarf' (Pluton), 'gas' (géantes) ou 'solid' (les autres). */
// Déclare et exporte planetKind : la définition de la planète.
export function planetKind(def) {
  // Marquée naine : « dwarf ».
  if (def?.dwarf) return 'dwarf';
  // Dans l'ensemble des gazeuses : « gas » ; sinon « solid ».
  return GAS_IDS.has(bodyId(def)) ? 'gas' : 'solid';
// Fin de planetKind.
}

/**
 * Un astre est masqué si sa famille l'est. Un satellite suit aussi sa planète : masquer les planètes gazeuses
 * masque Io et Titan avec elles.
 * @param hidden  Set des familles masquées
 * @param kind    famille de la planète (la sienne, ou celle de sa planète pour un satellite) ; null pour le Soleil
 * @param satellite  vrai pour la Lune et les satellites naturels
 */
// Déclare et exporte isKindHidden : les familles masquées, la famille de l'astre et s'il s'agit d'un satellite (faux par défaut).
export function isKindHidden(hidden, kind, satellite = false) {
  // Sans famille : jamais masqué.
  if (!kind) return false;
  // Masqué si sa famille l'est, ou si c'est un satellite et que la famille des satellites l'est.
  return hidden.has(kind) || (satellite && hidden.has('satellite'));
// Fin de isKindHidden.
}
