// Requêtes média du panneau Contributions : écran étroit, tactile, mouvement réduit.

export const QUERIES = {
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
  xs: '(max-width: 480px)',
  coarse: '(pointer: coarse)',
};

export const MQ = {
  compact: `@media ${QUERIES.compact}`,
  xs: `@media ${QUERIES.xs}`,
  coarse: `@media ${QUERIES.coarse}`,
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
};
