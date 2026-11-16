// ======================================================
// NAVBALL DESIGN TOKENS
// Jetons visuels partagés avec le thème MUI
// ======================================================

// Déclare et exporte C, la palette et les polices de la navball (début de l'objet).
export const C = {
  // Couleur de fond.
  bg: "#08090a",
  // Couleur des panneaux.
  panel: "#111315",
  // Couleur des traits.
  line: "#26292c",

  // Couleur du texte.
  fg: "#e9ebec",
  // Couleur du texte atténué.
  mute: "#80868b",

  // Couleur d'accent, presque blanche.
  accent: "#f2f4f5",
  // Ambre.
  amber: "#e8b44a",

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

// ======================================================
// LABELS
// ======================================================

// Déclare et exporte le style des libellés (début de l'objet).
export const labelSx = {
  // Police à chasse fixe.
  fontFamily: C.mono,
  // Taille de 11 px.
  fontSize: 11,
  // Lettres espacées.
  letterSpacing: ".1em",
  // En capitales.
  textTransform: "uppercase",
  // Couleur atténuée.
  color: C.mute
// Fin de l'objet.
};

// ======================================================
// SLIDERS
// ======================================================

// Déclare et exporte le style des réglettes (début de l'objet).
export const sliderSx = {
  // Couleur d'accent.
  color: C.accent,
  // Épaisseur de 3 px.
  height: 3,
  // Marge verticale.
  py: 1.5,

  // Style du curseur de la réglette (début).
  "& .MuiSlider-thumb": {
    // Largeur de 14 px.
    width: 14,
    // Hauteur de 14 px.
    height: 14,
    // Couleur d'accent.
    bgcolor: C.accent,

    // Au survol ou au focus clavier (début).
    "&:hover, &.Mui-focusVisible": {
      // Halo ambré translucide de 6 px.
      boxShadow: "0 0 0 6px rgba(232,180,74,.25)",
      // Contour ambré de 2 px.
      outline: `2px solid ${C.amber}`
    // Fin du survol et du focus.
    }
  // Fin du style du curseur.
  },

  // Style du rail de la réglette (début).
  "& .MuiSlider-rail": {
    // Couleur des traits.
    bgcolor: C.line,
    // Entièrement opaque.
    opacity: 1
  // Fin du style du rail.
  }
// Fin de l'objet.
};

// ======================================================
// BUTTONS
// ======================================================

// Déclare et exporte le style des boutons (début de l'objet).
export const buttonSx = {
  // Police à chasse fixe.
  fontFamily: C.mono,
  // Taille de 12 px.
  fontSize: 12,
  // Lettres espacées.
  letterSpacing: ".08em",

  // Couleur du texte.
  color: C.fg,
  // Couleur de la bordure.
  borderColor: C.line,

  // Coins arrondis de 4 px.
  borderRadius: "4px",
  // Marge verticale.
  py: 1.2,
  // Pas de largeur minimale.
  minWidth: 0,

  // Au survol (début).
  "&:hover": {
    // Bordure atténuée.
    borderColor: C.mute,
    // Fond transparent.
    bgcolor: "transparent"
  // Fin du survol.
  },

  // Au focus clavier (début).
  "&.Mui-focusVisible": {
    // Contour ambré de 2 px.
    outline: `2px solid ${C.amber}`,
    // Contour décalé de 2 px.
    outlineOffset: 2
  // Fin du focus.
  }
// Fin de l'objet.
};

// ======================================================
// KEYBOARD
// ======================================================

// Déclare et exporte le style des touches de clavier (début de l'objet).
export const kbdSx = {
  // Police à chasse fixe.
  fontFamily: C.mono,
  // Bordure fine, de la couleur des traits.
  border: `1px solid ${C.line}`,
  // Coins arrondis de 3 px.
  borderRadius: "3px",
  // Marge horizontale de 5 px.
  px: "5px",
  // Couleur du texte.
  color: C.fg
// Fin de l'objet.
};
