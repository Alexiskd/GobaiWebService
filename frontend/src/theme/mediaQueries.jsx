// Requêtes média partagées par `useMediaQuery` (logique) et par les `sx` MUI (mise en page).
export const QUERIES = {
  xs: '(max-width: 480px)',
  sm: '(max-width: 720px)',
  md: '(max-width: 1024px)',
  lg: '(max-width: 1440px)',
  xl: '(min-width: 1441px)',
  coarse: '(pointer: coarse)',
  short: '(max-height: 500px)',
  landscape: '(orientation: landscape)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  // Mobile, ou téléphone en paysage (large mais très bas) : mode compact.
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
};

export const MQ = {
  coarse: `@media ${QUERIES.coarse}`,
  compact: `@media ${QUERIES.compact}`,
  reducedMotion: `@media ${QUERIES.reducedMotion}`,
};

/** Marge de sécurité des écrans à encoche (iOS, Android). */
export const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

/** Hauteur minimale d'une cible tactile (Material Design). */
export const TOUCH = 44;
