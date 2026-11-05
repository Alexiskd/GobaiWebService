import { C } from './responsiveTokens';
import { MQ } from './mediaQueries';

// Téléphone très étroit et téléphone en paysage.
export const smallScreenStyles = {
  // ================================================ Téléphone très étroit (≤ 380px)
  [MQ.tiny]: {
    ':root': { '--logo-w': '76px' },
    'html .hud-title h1 .live': { display: 'none' },
    'html .toolbar-compact .tool-btn': { fontSize: '10px' },
  },

  // ================================================ Téléphone en paysage : panneau sur le côté
  [MQ.landscapePhone]: {
    ':root': { '--toolbar-h': '48px', '--strip-h': '44px', '--logo-w': '80px' },
    'html .hud-title p': { display: 'none' },
    'html .live-panel.panel-sheet': {
      left: 'auto',
      top: `calc(${C.safeT} + 6px)`,
      right: `calc(${C.safeR} + 64px)`,
      width: 'min(380px, 48vw)',
      maxHeight: `calc(100dvh - ${C.toolbarH} - ${C.stripH} - ${C.safeT} - ${C.safeB} - 12px)`,
      bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 6px)`,
      borderRadius: '14px',
    },
    'html .live-panel.panel-sheet.is-collapsed': { bottom: 'auto' },
    'html .zoom-pad': { top: `calc(${C.safeT} + 64px)`, transform: 'none', flexDirection: 'row' },
    'html .toolbar.toolbar-compact': { gridTemplateColumns: 'repeat(4, minmax(0, 120px))', justifyContent: 'center' },
    'html .toolbar-compact .tool-btn': { flexDirection: 'row', fontSize: '12px' },
    'html .attribution.attribution-compact': { display: 'none' },
  },
};
