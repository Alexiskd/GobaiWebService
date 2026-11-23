// Point d'entrée de l'engine earth-globe : ce que les autres engines importent.

// Les profils d'affichage, par astre.
export { GLOBE_PROFILES, DEFAULT_GLOBE_PROFILE } from './earth-globe.profile.js';
// Le service (application du profil et réponses au moteur de tuiles).
export { globeProfile, withGlobeProfile, usesHexCells, reliefCapKm, reliefShown } from './earth-globe.service.js';
