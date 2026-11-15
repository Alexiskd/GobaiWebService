// Vue d'un système planétaire sur téléphone : quand on zoome dans le système d'une planète (la planète, ses
// satellites, la Lune pour la Terre), le téléphone passe au rendu d'un ordinateur et au rythme d'images maximal,
// et, pour ne pas chauffer, les planètes et les satellites des autres systèmes ne sont plus dessinés.
//
// Le système d'une planète est sa sphère de Hill : la région où sa gravité retient ses satellites face au Soleil,
// de rayon a·∛(m / 3M). Environ 1,5 million de km pour la Terre, 53 millions pour Jupiter, 220 000 pour Mercure.

// Importe la table des masses, pour celle du Soleil.
import { BODY_MASS_KG } from './gravityMath';

/** On ressort du système un peu au-delà de sa limite (15 %) : pas de va-et-vient au bord. */
// Déclare et exporte la marge de sortie : 1,15 fois le rayon du système.
export const SYSTEM_EXIT_FACTOR = 1.15;

/** Rayon de la sphère de Hill d'une planète, dans l'unité de `sunDistance` (sa distance au Soleil). */
// Déclare et exporte hillRadius : la distance au Soleil, la masse de la planète et celle du Soleil.
export function hillRadius(sunDistance, massKg, sunMassKg = BODY_MASS_KG.sun) {
  // a · ∛(m / 3M), nul sans distance ou sans masse.
  return sunDistance > 0 && massKg > 0 ? sunDistance * Math.cbrt(massKg / (3 * sunMassKg)) : 0;
// Fin de hillRadius.
}

/** Caméra dans le système : dedans sous son rayon ; si elle y était déjà, elle n'en sort qu'au-delà de la marge. */
// Déclare et exporte insideSystem : la distance de la caméra à la planète, le rayon du système et l'état précédent.
export function insideSystem(distance, radius, wasInside = false) {
  // Rayon nul : jamais dedans.
  if (!(radius > 0)) return false;
  // Sous le rayon, ou sous la marge si elle y était déjà.
  return distance < radius * (wasInside ? SYSTEM_EXIT_FACTOR : 1);
// Fin de insideSystem.
}

/** Planète dont la cible fait partie du système : la planète elle-même, la Terre pour la Lune, la planète d'un satellite ; null pour le Soleil. */
// Déclare et exporte systemHostOf : la cible et la Terre.
export function systemHostOf(target, earth) {
  // Sans cible : aucune.
  if (!target) return null;
  // Planète : elle-même.
  if (target.body) return target.body;
  // Lune : la Terre.
  if (target.moon) return earth || null;
  // Satellite : sa planète ; sinon (Soleil) aucune.
  return target.satellite?.parent || null;
// Fin de systemHostOf.
}

/** Astre hors du système affiché : vrai si un système est affiché et que la planète de l'astre n'est pas la sienne. */
// Déclare et exporte outsideSystem : la planète du système affiché (ou null) et la planète de l'astre.
export const outsideSystem = (host, planet) => Boolean(host) && planet !== host;
