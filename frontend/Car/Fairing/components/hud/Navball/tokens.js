// ======================================================
// NAVBALL DESIGN TOKENS
// Jetons visuels de la navball
// ======================================================

// Couleurs de la palette Orbite.
import { NIGHT } from '../../../theme/palette.js';

// Déclare et exporte C, la palette et les polices de la navball, prises dans la palette Orbite (début de l'objet).
export const C = {
  // Couleur de fond.
  bg: NIGHT.bg,
  // Couleur des panneaux.
  panel: NIGHT.panel,
  // Couleur des traits.
  line: "#1c2540",

  // Couleur du texte.
  fg: NIGHT.ink,
  // Couleur du texte atténué.
  mute: NIGHT.soft,

  // Couleur d'accent, presque blanche.
  accent: NIGHT.ink,
  // Ambre.
  amber: NIGHT.gold,

  // Police des titres (valeur à la ligne suivante).
  display:
    // Chakra Petch, puis ses polices de repli.
    '"Chakra Petch", "Bahnschrift", "Arial Narrow", sans-serif',

  // Police à chasse fixe (valeur à la ligne suivante).
  mono:
    // IBM Plex Mono, puis ses polices de repli.
    '"IBM Plex Mono", ui-monospace, Menlo, monospace'
// Fin de l'objet.
};
