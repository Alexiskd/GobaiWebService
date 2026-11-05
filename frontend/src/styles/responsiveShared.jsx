import { C } from './responsiveTokens';
import { MQ } from './mediaQueries';

// Étiquettes, sources repliables, toasts et pointeur tactile.
export const sharedStyles = {
  // ------------------------------------------------ Étiquettes de scène
  '.l-city': { fontSize: '11px' },
  '.l-planet': { cursor: 'pointer' },

  // ------------------------------------------------ Sources repliables
  '.attribution-compact summary': { cursor: 'pointer', listStyle: 'none', fontSize: '12px', opacity: 0.8 },
  '.attribution-compact summary::-webkit-details-marker': { display: 'none' },
  '.attribution-compact[open] p': { margin: '6px 0 0', maxHeight: '30dvh', overflowY: 'auto' },

  // ------------------------------------------------ Toasts
  'html .toasts': { maxWidth: `min(440px, calc(100vw - 2 * ${C.gap}))` },
  'html .toast span': { overflowWrap: 'anywhere' },

  // ================================================ Pointeur tactile
  [MQ.coarse]: {
    [[
      'html .toolbar button',
      'html .nav-item',
      'html .zoom-pad button',
      'html .compass',
      'html .ghost',
      'html .palette li',
      'html .place-search li > *',
    ].join(', ')]: { minHeight: C.touch },
    'html .zoom-pad button, html .compass': { minWidth: C.touch },
    'html input, html select, html textarea': { fontSize: '16px' },
  },
  [MQ.noHover]: {
    'html button:hover': { filter: 'none' },
  },
};
