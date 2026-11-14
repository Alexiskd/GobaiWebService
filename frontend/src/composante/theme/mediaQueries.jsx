// Requêtes média partagées par `useMediaQuery` (logique) et par les `sx` MUI (mise en page).
// Requêtes média :
export const QUERIES = {
  // xs : jusqu'à 480 pixels de large ;
  xs: '(max-width: 480px)',
  // sm : jusqu'à 720 ;
  sm: '(max-width: 720px)',
  // md : jusqu'à 1 024 ;
  md: '(max-width: 1024px)',
  // lg : jusqu'à 1 440 ;
  lg: '(max-width: 1440px)',
  // xl : au-delà ;
  xl: '(min-width: 1441px)',
  // coarse : écran tactile ;
  coarse: '(pointer: coarse)',
  // short : écran de 500 pixels de haut au plus ;
  short: '(max-height: 500px)',
  // landscape : en paysage ;
  landscape: '(orientation: landscape)',
  // reducedMotion : animations réduites ;
  reducedMotion: '(prefers-reduced-motion: reduce)',
  // Mobile, ou téléphone en paysage (large mais très bas) : mode compact.
  // compact : écran étroit, ou téléphone en paysage.
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
// Fin des requêtes.
};

// Les mêmes, prêtes pour les styles :
export const MQ = {
  // écran tactile ;
  coarse: `@media ${QUERIES.coarse}`,
  // mode compact ;
  compact: `@media ${QUERIES.compact}`,
  // animations réduites.
  reducedMotion: `@media ${QUERIES.reducedMotion}`,
// Fin de MQ.
};

/** Marge de sécurité des écrans à encoche (iOS, Android). */
// Fonction safe : la marge de sécurité d'un côté de l'écran.
export const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

/** Hauteur minimale d'une cible tactile (Material Design). */
// Hauteur minimale d'une cible tactile : 44 pixels.
export const TOUCH = 44;
