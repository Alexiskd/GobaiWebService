// Requêtes média partagées par `useMediaQuery` (JS) et par les styles MUI (CSS-in-JS).
export const QUERIES = {
  xs: '(max-width: 480px)',
  sm: '(max-width: 720px)',
  md: '(max-width: 1024px)',
  lg: '(max-width: 1440px)',
  xl: '(min-width: 1441px)',
  tiny: '(max-width: 380px)',
  coarse: '(pointer: coarse)',
  noHover: '(hover: none)',
  short: '(max-height: 500px)',
  landscape: '(orientation: landscape)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
};
export const MQ = {
  coarse: `@media ${QUERIES.coarse}`,
  noHover: `@media ${QUERIES.noHover}`,
  xl: `@media ${QUERIES.xl}`,
  tablet: `@media ${QUERIES.md}`,
  // Mobile, ou téléphone en paysage (large mais très bas) : mode compact.
  compact: `@media ${QUERIES.sm}, ${QUERIES.short} and ${QUERIES.coarse}`,
  tiny: `@media ${QUERIES.tiny}`,
  landscapePhone: `@media ${QUERIES.short} and ${QUERIES.landscape} and ${QUERIES.coarse}`,
  reducedMotion: `@media ${QUERIES.reducedMotion}`,
};
