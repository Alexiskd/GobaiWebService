// Clé de recherche : sans accents, en minuscules.
// Fonction fold : retire les accents et passe en minuscules.
export const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Survol d'une adresse : la hauteur de l'écran couvre environ 300 m (on reconnaît la rue et les bâtiments).
// Hauteur de vue d'une adresse : 300 m.
export const ADDRESS_VIEW_M = 300;

/**
 * Icône d'un résultat de recherche selon son type : repère visuel avant de lire le nom.
 * Ce module ne dessine rien — il rend une clé, et la fenêtre de recherche la traduit en icône MUI. Cela garde
 * le module pur (testable sans React) et laisse le dessin à la couche d'affichage.
 */
// Clé d'icône de chaque type de résultat.
const ICONS = { body: 'astre', city: 'ville', world: 'ville', place: 'lieu', address: 'adresse', gps: 'coordonnees' };
// Fonction resultIcon : la clé d'icône d'un type, ou celle d'un lieu.
export const resultIcon = (type) => ICONS[type] ?? 'lieu';

/** Type d'affichage d'un lieu renvoyé par la recherche mondiale : adresse (rue, numéro) ou localité. */
// Fonction placeResultType : « address » pour une adresse, sinon « place ».
export const placeResultType = (place) => (place?.kind === 'address' ? 'address' : 'place');
