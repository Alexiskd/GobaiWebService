// Familles d'astres que la fenêtre « Paramètres » peut masquer d'un bouton. Fonctions pures.
// Importe bodyId, l'identifiant d'une planète, depuis bodyPlaces.
import { bodyId } from './bodyPlaces';

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
  { id: 'dwarf', label: 'Planètes naines', hint: 'Pluton, Cérès' },
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
 * Identifiants des astres qui ont réellement au moins un fond de carte, comme le montre leur fiche d'information.
 *  - `layers` : liste générale de l'API (GET /tiles/layers) ; une couche sans `body` appartient à la Terre.
 *  - `status` : état des satellites et des géantes (GET /tiles/satellites/status), [{ id, layers }] où `layers` est
 *    le nombre de fonds réellement trouvés. Il fait foi pour ces astres : la liste générale leur donne toujours une
 *    entrée « fond principal », même quand aucune carte n'a été trouvée, et les croyait donc tous cartographiés.
 */
// Déclare et exporte bodiesWithLayers : la liste des couches et l'état, vides par défaut.
export function bodiesWithLayers(layers = [], status = []) {
  // Ensemble des astres des couches ; une couche sans astre compte pour la Terre.
  const set = new Set(layers.map((l) => l.body || 'earth'));
  // Pour chaque ligne de l'état (début).
  for (const row of status || []) {
    // Ligne sans identifiant : ignorée.
    if (!row?.id) continue;
    // Au moins un fond : l'astre est ajouté ; sinon il est retiré.
    if (row.layers > 0) set.add(row.id); else set.delete(row.id);
  // Fin de la boucle.
  }
  // Renvoie l'ensemble.
  return set;
// Fin de bodiesWithLayers.
}

/**
 * LA fonction booléenne de l'affichage par défaut : un seul ET sur toutes les conditions, et seules les couches de
 * cartes comptent. Un astre est affiché par défaut si, et seulement si, toutes ces conditions sont vraies :
 *   1. il a au moins une couche de carte ;
 *   2. si c'est un satellite, sa planète a elle aussi au moins une couche (sinon il disparaîtrait avec elle).
 * Le Soleil, qui n'a ni couche ni case à cocher, est toujours affiché.
 * @param body        astre de la navigation : { index, id, satellite? }
 * @param withLayers  Set renvoyé par bodiesWithLayers
 * @param parentBody  sa planète, pour un satellite
 */
// Déclare et exporte shownByDefault : l'astre, l'ensemble des astres avec couche et sa planète (aucune par défaut).
export function shownByDefault(body, withLayers, parentBody = null) {
  // L'indice 0, le Soleil : toujours affiché.
  if (body.index === 0) return true;
  // Renvoie vrai si l'astre a une couche…
  return withLayers.has(body.id)
    // … et si ce n'est pas un satellite, ou si sa planète est inconnue, ou si sa planète a une couche.
    && (!body.satellite || !parentBody || withLayers.has(parentBody.id));
// Fin de shownByDefault.
}

/**
 * Astres décochés par défaut dans Paramètres, une fois la liste des couches connue : ceux pour qui shownByDefault
 * est faux. Exception : l'astre de l'adresse d'arrivée (« /jupiter », « /titan »…) et sa planète restent affichés,
 * pour que sa page s'ouvre bien sur lui.
 * @param bodies  astres de la navigation : { index, id, name, satellite?, parent? }
 * @param layers  couches de l'API : [{ id, body? }]
 * @param path    chemin de l'adresse (window.location.pathname)
 * @param status  état des satellites et des géantes : [{ id, layers }] (voir bodiesWithLayers)
 * @returns {number[]}  indices des astres à décocher
 */
// Déclare et exporte defaultHiddenBodies : les astres, les couches, le chemin de l'adresse et l'état.
export function defaultHiddenBodies(bodies = [], layers = [], path = '', status = []) {
  // Ensemble des astres qui ont une couche.
  const withLayers = bodiesWithLayers(layers, status);
  // Table des astres par indice.
  const byIndex = new Map(bodies.map((b) => [b.index, b]));
  // Chemin sans ses barres obliques de début et de fin.
  let slug = String(path).replace(/^\/+|\/+$/g, '');
  // Décode les caractères encodés de l'adresse ; en cas d'erreur, le chemin est vidé.
  try { slug = decodeURIComponent(slug); } catch { slug = ''; }
  // Astre de l'adresse d'arrivée : celui dont le nom, sans accents ni majuscules, est égal au chemin ; aucun pour un chemin vide.
  const landing = slug ? bodies.find((b) => fold(b.name) === fold(slug)) : null;
  // Indices à garder affichés : cet astre et sa planète, quand ils existent.
  const keep = new Set([landing?.index, landing?.parent].filter((i) => i != null));
  // Renvoie, à partir des astres (début),
  return bodies
    // ceux qui ne sont pas à garder et que shownByDefault n'affiche pas, la planète d'un satellite étant retrouvée par son indice,
    .filter((b) => !keep.has(b.index) && !shownByDefault(b, withLayers, b.parent != null ? byIndex.get(b.parent) : null))
    // réduits à leur indice.
    .map((b) => b.index);
// Fin de defaultHiddenBodies.
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
