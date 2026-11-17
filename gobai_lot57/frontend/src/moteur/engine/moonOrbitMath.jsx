// Réglages du tracé de l'orbite lunaire (sans three.js), testés par moonOrbit.test.jsx.
// Les calculs eux-mêmes sont ceux du tracé générique (bodyOrbitMath.jsx) : ici, seule la Lune est décrite.

// Importe l'opacité le long du tracé, les instants des points et le nombre de segments par défaut.
import { orbitAlpha as alphaOf, orbitTimes as timesOf, DEFAULT_SAMPLES } from './bodyOrbitMath';

// Durée du mois sidéral, en millisecondes.
export const SIDEREAL_MONTH_MS = 27.321661 * 864e5;
// Nombre de segments du tracé.
export const ORBIT_SAMPLES = DEFAULT_SAMPLES;    // ≈ 0,5° entre deux points
// Intervalle de recalcul du tracé, en millisecondes simulées.
export const ORBIT_REFRESH_MS = 3_600_000;       // recalcul toutes les heures simulées (la Lune avance de ≈ 0,55°/h)

/**
 * Opacité d'un point du tracé selon sa position dans la fenêtre : u = -1 (½ mois passé) … 0 (Lune) … 1 (½ mois à venir).
 * Fonction pure, testée par moonOrbit.test.jsx.
 */
// Déclare et exporte orbitAlpha : reçoit la position u dans la fenêtre, de -1 à 1.
export const orbitAlpha = (u) => alphaOf(u);

/** Instants (ms) des points du tracé, centrés sur `centerMs` : un mois sidéral complet. */
// Déclare et exporte orbitTimes : l'instant central et le nombre de segments.
export const orbitTimes = (centerMs, n = ORBIT_SAMPLES) => timesOf(centerMs, SIDEREAL_MONTH_MS, n);
