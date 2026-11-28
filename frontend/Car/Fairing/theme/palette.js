/**
 * Palette « Orbite » : la seule source des couleurs de l'app (plan de refonte, étape 3).
 *
 * Base : le bleu de la marque (#8baeff). Les accents ont la même luminosité perçue et sont répartis sur le cercle
 * chromatique (bleu, violet, cyan, vert, or, corail) : ils se distinguent sans qu'aucun ne crie. Une couleur = un sens :
 *  - bleu : marque, sélection, orbites ;      - violet : satellites naturels ;
 *  - cyan : eau, littoraux, information ;     - vert : succès ;
 *  - or : Soleil, frontières, sites de référence ; - corail : erreur, Mars.
 *
 * Utilisée par :
 *  - l'interface (variables CSS --color-* d'app.css, vérifiées égales à ces valeurs par palette.test.js) ;
 *  - les calques 3D three.js et CesiumJS (engines/astre-solide/astre-solide.style.js) ;
 *  - les composants qui ont besoin d'une couleur en JS (navball, écran de chargement, assistant).
 * Contrastes : tout jeton de texte ≥ 4,5 : 1 sur son panneau (WCAG 2.1, vérifié par palette.test.js).
 */

/** Thème nuit (par défaut). */
// Déclare et exporte le thème nuit.
export const NIGHT = Object.freeze({
  bg: '#05070d', panel: '#0a0f1c', raised: '#111a2e',
  ink: '#f4f7ff', soft: '#9daac4', faint: '#68758e',
  primary: '#8baeff', primaryLight: '#b5caff', primaryDark: '#5e82d5', onPrimary: '#08152c',
  violet: '#b39aff', cyan: '#70dceb', green: '#5ad9b3', gold: '#e8c46a', coral: '#ff8a7a',
  // Nacre : blanc neutre légèrement chaud, pour les traits discrets sur le globe (littoraux), sans bleu.
  pearl: '#eeeae0',
});

/** Thème jour (bouton Ombre / heure locale). */
// Déclare et exporte le thème jour.
export const DAY = Object.freeze({
  bg: '#eef2f9', panel: '#f9fbff', raised: '#e4eaf5',
  ink: '#10162a', soft: '#4a5672', faint: '#8b96a9',
  primary: '#3d63c9', primaryLight: '#5e82d5', primaryDark: '#2c4ea8', onPrimary: '#ffffff',
  violet: '#6b4fd0', cyan: '#127a8a', green: '#177a5b', gold: '#876510', coral: '#c2413a',
});

/** Jetons de texte, vérifiés ≥ 4,5 : 1 sur le panneau de leur thème. */
// Déclare et exporte les jetons de texte.
export const TEXT_TOKENS = ['ink', 'soft', 'primary', 'violet', 'cyan', 'green', 'gold', 'coral'];

/** Couleurs des pays de la Lune, prises dans la palette (une par pays). */
// Déclare et exporte les couleurs des pays de la Lune.
export const MOON_COUNTRY_COLORS = Object.freeze({
  apollonie: NIGHT.primary, lunovie: NIGHT.coral, guanghanie: NIGHT.gold, chandrapur: NIGHT.green, kaguyakuni: NIGHT.violet,
});

/** Luminance relative d'une couleur #rrggbb (WCAG 2.1). */
// Déclare et exporte luminance : la couleur (début).
export function luminance(hex) {
  // Composantes 0 … 1.
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  // Linéarisation.
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  // Luminance.
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
// Fin de luminance.
}

/** Rapport de contraste entre deux couleurs #rrggbb (1 à 21). */
// Déclare et exporte contrast : les deux couleurs (début).
export function contrast(a, b) {
  // Luminances, la plus claire d'abord.
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  // Rapport.
  return (hi + 0.05) / (lo + 0.05);
// Fin de contrast.
}
