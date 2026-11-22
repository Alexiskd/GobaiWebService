/**
 * Table des moyens de locomotion de l'itinéraire : une ligne par moyen, des données seulement.
 *
 * Le moteur est unique et mutable (voir createModeEngine dans modes.js) : il prend une ligne de cette table et
 * devient le moteur de ce moyen. Ajouter un moyen = ajouter une ligne, sans nouveau fichier ni nouveau code.
 * Les identifiants sont ceux que renvoie le backend (POST /position/itineraire, champ `mode`).
 */

// Importe les profils d'altitude communs des véhicules volants.
import { climbCruiseDescent, smoothstep } from './flightEngine.js';

// Profil de la fusée : arc suborbital (sinus aplati), nul au départ et à l'arrivée.
const arcFusee = (u) => Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.7;
// Profil du planeur : lancé en altitude, plané jusqu'à l'atterrissage.
const planeVol = (u) => Math.max(0, 1 - Math.min(1, Math.max(0, u))) ** 0.8 * smoothstep(u / 0.05);

/** Moyens au sol (moteur 2D) : style du tracé, arrêts et vitesse. */
export const GROUND_MODES = Object.freeze([
  // Marche : petits pointillés.
  { id: 'marche', label: 'Marche', color: '#2e7d32', glyph: '🚶', smooth: 1, width: 4, dash: [2, 6], stops: false, speedKmh: 5 },
  // Course à pied : tirets courts.
  { id: 'course', label: 'Course à pied', color: '#ef6c00', glyph: '🏃', smooth: 1, width: 4, dash: [8, 4], stops: false, speedKmh: 10 },
  // Vélo : trait continu lissé.
  { id: 'velo', label: 'Vélo', color: '#00897b', glyph: '🚴', smooth: 2, width: 4, dash: [], stops: false, speedKmh: 16 },
  // Trottinette : tirets.
  { id: 'trottinette', label: 'Trottinette', color: '#8e24aa', glyph: '🛴', smooth: 2, width: 4, dash: [10, 4], stops: false, speedKmh: 15 },
  // Moto : trait épais lissé.
  { id: 'moto', label: 'Moto', color: '#d84315', glyph: '🏍️', smooth: 2, width: 5, dash: [], stops: false, speedKmh: 70 },
  // Voiture : trait épais.
  { id: 'voiture', label: 'Voiture', color: '#1565c0', glyph: '🚗', smooth: 1, width: 5, dash: [], stops: false, speedKmh: 70 },
  // Bus : avec arrêts.
  { id: 'bus', label: 'Bus', color: '#f9a825', glyph: '🚌', smooth: 1, width: 5, dash: [], stops: true, speedKmh: 30 },
  // Tramway : avec arrêts.
  { id: 'tramway', label: 'Tramway', color: '#c2185b', glyph: '🚋', smooth: 2, width: 5, dash: [], stops: true, speedKmh: 20 },
  // Métro : trait droit et épais, avec arrêts.
  { id: 'metro', label: 'Métro', color: '#6a1b9a', glyph: '🚇', smooth: 0, width: 6, dash: [], stops: true, speedKmh: 30 },
  // Train : tirets longs, avec arrêts.
  { id: 'train', label: 'Train', color: '#455a64', glyph: '🚆', smooth: 3, width: 5, dash: [14, 6], stops: true, speedKmh: 120 },
  // Bateau : tirets, très lissé.
  { id: 'bateau', label: 'Bateau', color: '#0277bd', glyph: '🚢', smooth: 3, width: 5, dash: [12, 6], stops: false, speedKmh: 30 },
  // Ski : très lissé.
  { id: 'ski', label: 'Ski', color: '#4fc3f7', glyph: '⛷️', smooth: 3, width: 4, dash: [], stops: false, speedKmh: 25 },
  // Cheval : tirets courts.
  { id: 'cheval', label: 'Cheval', color: '#795548', glyph: '🐎', smooth: 2, width: 4, dash: [6, 3], stops: false, speedKmh: 20 },
  // Moyen au sol inconnu du frontend : moteur générique.
  { id: 'autre-sol', label: 'Autre (au sol)', color: '#757575', glyph: '📍', smooth: 1, width: 4, dash: [], stops: false, speedKmh: 30 },
// Fin des moyens au sol.
]);

/** Moyens volants (moteur 3D) : forme, altitude de croisière, profil d'altitude et vitesse. */
export const FLIGHT_MODES = Object.freeze([
  // Avion de ligne : montée, croisière à 11 km, descente.
  { id: 'avion', label: 'Avion', color: '#1e88e5', glyph: '✈️', shape: 'avion', cruiseKm: 11, profile: climbCruiseDescent(0.15, 0.15), speedKmh: 800 },
  // Hélicoptère : croisière basse.
  { id: 'helicoptere', label: 'Hélicoptère', color: '#e53935', glyph: '🚁', shape: 'rotor', cruiseKm: 0.6, profile: climbCruiseDescent(0.08, 0.08), speedKmh: 220 },
  // Fusée : arc suborbital, apogée à 200 km.
  { id: 'fusee', label: 'Fusée', color: '#fb8c00', glyph: '🚀', shape: 'fusee', cruiseKm: 200, profile: arcFusee, speedKmh: 25000 },
  // Drone : très bas.
  { id: 'drone', label: 'Drone', color: '#00acc1', glyph: '🛸', shape: 'rotor', cruiseKm: 0.12, profile: climbCruiseDescent(0.06, 0.06), speedKmh: 50 },
  // Ballon : montée et descente lentes.
  { id: 'ballon', label: 'Ballon', color: '#ab47bc', glyph: '🎈', shape: 'ballon', cruiseKm: 3, profile: climbCruiseDescent(0.35, 0.35), speedKmh: 25 },
  // Planeur : plané jusqu'à l'atterrissage.
  { id: 'planeur', label: 'Planeur', color: '#43a047', glyph: '🪂', shape: 'planeur', cruiseKm: 3, profile: planeVol, speedKmh: 110 },
  // Moyen volant inconnu du frontend : moteur générique.
  { id: 'autre-vol', label: 'Autre (aérien)', color: '#7e57c2', glyph: '🛩️', shape: 'point', cruiseKm: 5, profile: climbCruiseDescent(0.2, 0.2), speedKmh: 300 },
// Fin des moyens volants.
]);
