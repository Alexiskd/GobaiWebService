/**
 * Style unique des calques des astres (plan de refonte, étape 3), lu par CesiumJS (astre-solide.overlays.js) et par
 * three.js (frontières et littoraux de la Terre). Couleurs prises dans la palette Orbite (Fairing/theme/palette.js).
 *
 *  - lignes : 1 px, couleur pleine à 45-90 % selon l'importance, plus fines de loin ;
 *  - noms : Google Sans, encre à 90 % avec un halo sombre doux (au lieu d'un contour noir dur), trois tailles ;
 *  - points : pastille de 6 px à la couleur du calque.
 */

// Importe la palette Orbite.
import { MAP_GRAYS, MOON_COUNTRY_COLORS, NIGHT } from '../../Fairing/theme/palette.js';

/** Lignes, par calque : couleur, opacité, épaisseur (px). */
// Déclare et exporte le style des lignes.
export const LINES = Object.freeze({
  // Cartographie en noir et blanc, fondu de gris : frontières gris clair, littoraux gris moyen, plus discrets.
  border: { color: MAP_GRAYS.g80, alpha: 0.75, width: 1 },
  coast: { color: MAP_GRAYS.g50, alpha: 0.55, width: 1 },
  moonBorder: { color: NIGHT.primaryLight, alpha: 0.6, width: 1 },
  orbit: { alpha: 0.35, width: 1 },
});

/** Noms : trois tailles (px), en majuscules espacées pour les pays. */
// Déclare et exporte le style des noms.
export const LABELS = Object.freeze({
  // Pays (Terre et Lune) : 15 px, majuscules espacées.
  country: { size: 15, weight: 600, upper: true },
  // Grandes villes, capitales, sites de référence : 13 px.
  major: { size: 13, weight: 600, upper: false },
  // Lieux secondaires (villes, cratères) : 11 px.
  minor: { size: 11, weight: 500, upper: false },
});

/** Couleurs des noms : encre à 90 %, halo sombre à 60 % de 2 px. */
// Déclare et exporte les couleurs des noms.
export const LABEL_INK = Object.freeze({ fill: NIGHT.ink, fillAlpha: 0.9, halo: NIGHT.bg, haloAlpha: 0.6, haloWidth: 2 });

/** Police CSS d'un nom d'après sa classe. */
// Déclare et exporte labelFont : la classe du nom (début).
export function labelFont(kind = 'major') {
  // Style de la classe (grande par défaut).
  const s = LABELS[kind] || LABELS.major;
  // Police.
  return `${s.weight} ${s.size}px "Google Sans", system-ui, sans-serif`;
// Fin de labelFont.
}

/** Texte d'un nom d'après sa classe : majuscules espacées (espaces fines) pour les pays. */
// Déclare et exporte labelText : le texte et la classe (début).
export function labelText(text, kind = 'major') {
  // Pas de majuscules : tel quel.
  if (!LABELS[kind]?.upper) return String(text);
  // Majuscules, une espace fine entre les lettres (Cesium n'a pas d'espacement des lettres).
  return [...String(text).toLocaleUpperCase('fr-FR')].join(' ');
// Fin de labelText.
}

/** Couleur d'un pays de la Lune (palette), bleu de la marque par défaut. */
// Déclare et exporte moonCountryColor : l'identifiant du pays.
export const moonCountryColor = (id) => MOON_COUNTRY_COLORS[id] ?? NIGHT.primary;

/** Valeur numérique 0xrrggbb d'une couleur #rrggbb (pour three.js). */
// Déclare et exporte hexNumber : la couleur.
export const hexNumber = (hex) => parseInt(String(hex).slice(1), 16);
