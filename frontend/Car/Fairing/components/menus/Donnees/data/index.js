// Index des données de la fenêtre Données : une fiche par PDF du dossier public/data/documents.
import { metis } from './metis.js';
import { adrastee } from './adrastee.js';
import { elara } from './elara.js';
import { lysithea } from './lysithea.js';
import { leda } from './leda.js';
import { themisto } from './themisto.js';
import { carme } from './carme.js';
import { taygete } from './taygete.js';
import { isonoe } from './isonoe.js';
import { erinome } from './erinome.js';
import { ananke } from './ananke.js';
import { hermippe } from './hermippe.js';
import { pasiphoe } from './pasiphoe.js';
import { sinope } from './sinope.js';
import { callirrhoe } from './callirrhoe.js';
import { megaclite } from './megaclite.js';
import { autonoe } from './autonoe.js';
import { eurydome } from './eurydome.js';

// Ordre des groupes de la documentation (début du tableau).
export const GROUPS = [
  // Groupe d'Amalthée.
  { id: 'amalthee', name: 'Groupe d\'Amalthée' },
  // Groupe d'Himalia.
  { id: 'himalia', name: 'Groupe d\'Himalia' },
  // Satellite isolé.
  { id: 'isolee', name: 'Satellite isolé' },
  // Groupe de Carmé.
  { id: 'carme', name: 'Groupe de Carmé' },
  // Groupe d'Ananké.
  { id: 'ananke', name: 'Groupe d\'Ananké' },
  // Groupe de Pasiphaé.
  { id: 'pasiphoe', name: 'Groupe de Pasiphaé' },
// Fin du tableau.
];

// Toutes les fiches, groupées puis triées (début du tableau).
export const DOCUMENTS = [
  // Métis (Jupiter XVI).
  metis,
  // Adrastée (Jupiter XV).
  adrastee,
  // Élara (Jupiter VII).
  elara,
  // Lysithéa (Jupiter X).
  lysithea,
  // Léda (Jupiter XIII).
  leda,
  // Thémisto (Jupiter XVIII).
  themisto,
  // Carmé (Jupiter XI).
  carme,
  // Taygète (Jupiter XX).
  taygete,
  // Isonoé (Jupiter XXVI).
  isonoe,
  // Érinomé (Jupiter XXV).
  erinome,
  // Ananké (Jupiter XII).
  ananke,
  // Hermippé (Jupiter XXX).
  hermippe,
  // Pasiphaé (Jupiter VIII).
  pasiphoe,
  // Sinopé (Jupiter IX).
  sinope,
  // Callirrhoé (Jupiter XVII).
  callirrhoe,
  // Mégaclité (Jupiter XIX).
  megaclite,
  // Autonoé (Jupiter XXVIII).
  autonoe,
  // Eurydomé (Jupiter XXXII).
  eurydome,
// Fin du tableau.
];

// documentsOf : les fiches d'un groupe (début de la fonction).
export function documentsOf(groupId) {
  // Filtre les fiches du groupe.
  return DOCUMENTS.filter((d) => d.groupId === groupId);
// Fin de documentsOf.
}
