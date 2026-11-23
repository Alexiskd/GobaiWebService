// Point d'entrée de l'engine astre-solide : les astres solides (Terre, Lune, Mars, Mercure, satellites à carte)
// dessinés par un globe CesiumJS, par-dessus la scène three.js ou de près.

// Le module (superposition, passage entre la scène three.js et le globe CesiumJS).
export { AstreSolideGlobe } from './astre-solide.module.js';
// Les règles du passage (altitudes de la Terre, ramenées au rayon de chaque astre).
export { ENTER_KM, EXIT_KM, RETURN_KM, REARM_KM, EARTH_RADIUS_KM, altitudeKm, scaledKm, shouldEnter, shouldExit, rearm, lonLatOf } from './astre-solide.handoff.js';
// Les sources d'imagerie de la Terre.
export { CESIUM_IMAGERY, FRANCE_BBOX, imageryCredits } from './astre-solide.sources.js';
// Le fond de carte de l'app lu par CesiumJS (autres astres).
export { imageryOptions, tileSourceImageryProvider } from './astre-solide.imagery.js';
// Le nom du lieu sous la caméra (ville, région, pays selon l'altitude).
export { placeText, nearestCity, distanceKm } from './astre-solide.place.js';
