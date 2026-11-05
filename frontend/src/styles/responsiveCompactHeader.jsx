import { C, fixedReset } from './responsiveTokens';

// Mobile : en-tête, boussole, zoom et barre d’outils du bas (contenu du palier compact).
export const compactHeader = {
  ':root': { '--logo-w': 'clamp(84px, 26vw, 128px)', '--hud-font': '13px' },

  // En-tête en haut à gauche.
  'html .hud-title': {
    ...fixedReset,
    position: 'fixed',
    top: `calc(${C.safeT} + 6px)`,
    left: `calc(${C.safeL} + 6px)`,
    right: `calc(${C.safeR} + 64px)`, // place pour la boussole
    pointerEvents: 'none',
  },
  'html .hud-title h1': { fontSize: '15px' },
  'html .hud-title .title-glyphs': { display: 'none' },
  'html .hud-title p': { fontSize: '11px' },
  'html .hud-title p.title-focus': { display: 'none' },

  // Boussole en haut à droite.
  'html .compass-pad': {
    position: 'fixed',
    top: `calc(${C.safeT} + 8px)`,
    right: `calc(${C.safeR} + 8px)`,
    left: 'auto',
    bottom: 'auto',
  },
  'html .compass': { width: '48px', height: '48px' },

  // Zoom sur le bord droit, au milieu.
  'html .zoom-pad': {
    position: 'fixed',
    right: `calc(${C.safeR} + 8px)`,
    top: '50%',
    bottom: 'auto',
    left: 'auto',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  // Barre d'outils fixe en bas.
  'html .toolbar.toolbar-compact': {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    top: 'auto',
    transform: 'none',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '4px',
    margin: 0,
    padding: `6px calc(${C.safeR} + 6px) calc(${C.safeB} + 6px) calc(${C.safeL} + 6px)`,
    minHeight: C.toolbarH,
    borderRadius: 0,
    flexWrap: 'nowrap',
    zIndex: 40,
  },
  'html .toolbar-compact .tool-btn': {
    flexDirection: 'column',
    gap: '2px',
    padding: '4px 2px',
    fontSize: '11px',
    minHeight: C.touch,
    width: '100%',
  },
  'html .toolbar-compact .tool-menu-item': { flexDirection: 'row', fontSize: '14px', gap: '10px', padding: '8px 12px' },
  'html .toolbar-compact .tool-icon': { fontSize: '18px' },
};
