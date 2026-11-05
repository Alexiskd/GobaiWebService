// Requêtes média et constantes du panneau « Tuile 3D », partagées par la logique (JS) et les styles MUI.

export const QUERIES = {
  compact: '(max-width: 720px), (max-height: 500px) and (pointer: coarse)',
  landscapePhone: '(max-height: 500px) and (orientation: landscape) and (pointer: coarse)',
  coarse: '(pointer: coarse)',
};

export const MQ = {
  compact: `@media ${QUERIES.compact}`,
  landscapePhone: `@media ${QUERIES.landscapePhone}`,
  coarse: `@media ${QUERIES.coarse}`,
  tablet: '@media (max-width: 1024px)',
  xl: '@media (min-width: 1441px)',
};

export const TOUCH = '44px';

export const safe = (side) => `env(safe-area-inset-${side}, 0px)`;
