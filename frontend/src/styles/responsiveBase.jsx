import { C } from './responsiveTokens';

// En-tête, panneau droit, palette, zoom : paliers et variables de base.
export const baseStyles = {
  // ------------------------------------------------ Variables
  ':root': {
    '--gap': 'clamp(8px, 1.4vw, 18px)',
    '--safe-t': 'env(safe-area-inset-top, 0px)',
    '--safe-r': 'env(safe-area-inset-right, 0px)',
    '--safe-b': 'env(safe-area-inset-bottom, 0px)',
    '--safe-l': 'env(safe-area-inset-left, 0px)',
    '--touch': '44px', // cible tactile minimale (Apple / Material)
    '--logo-w': 'clamp(120px, 16vw, 252px)',
    '--panel-w': 'clamp(300px, 28vw, 420px)',
    '--toolbar-h': '56px',
    '--strip-h': '52px',
    '--hud-font': 'clamp(12px, 0.75vw + 8px, 15px)',
  },

  // ------------------------------------------------ Base
  'html, body, #root': { height: '100%' },
  body: {
    margin: 0,
    overflow: 'hidden',
    overscrollBehavior: 'none',
    WebkitTextSizeAdjust: '100%',
    WebkitTapHighlightColor: 'transparent',
  },
  '.app-shell': { position: 'fixed', inset: 0, height: '100dvh', fontSize: 'var(--hud-font)' },

  // Le canvas 3D occupe tout l'écran visible, barre d'adresse mobile comprise.
  '.stage': {
    position: 'fixed',
    inset: 0,
    width: '100vw',
    height: ['100vh', '100dvh'],
    touchAction: 'none', // les gestes vont au moteur, pas au navigateur
  },
  '.stage canvas': { display: 'block', width: '100% !important', height: '100% !important' },

  // ------------------------------------------------ En-tête
  'html .hud-title': {
    gap: 0,
    paddingLeft: 0,
    maxWidth: `calc(100vw - 2 * ${C.gap} - ${C.safeL} - ${C.safeR})`,
    display: 'flex',
    alignItems: 'center',
  },
  'html .hud-title .brand-logo': {
    width: C.logoW,
    height: 'auto',
    margin: `0 0 0 calc(${C.logoW} * -0.12)`, // équivaut à −30px à 252px
    position: 'relative',
    zIndex: 2,
    flex: 'none',
  },
  'html .hud-title .title-text': {
    margin: `0 0 0 calc(${C.logoW} * -0.16)`, // équivaut à −40px à 252px
    paddingLeft: 0,
    position: 'relative',
    zIndex: 1,
    // Textes centrés les uns sous les autres : titre, badge « En direct », date, astre suivi.
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '5px',
    minWidth: 0,
  },
  'html .hud-title h1': { fontSize: 'clamp(15px, 1.2vw + 9px, 26px)', lineHeight: 1.15, margin: 0, justifyContent: 'center' },
  'html .hud-title p': { margin: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // ------------------------------------------------ Panneau droit
  'html .live-panel': {
    width: 'var(--panel-w)',
    maxWidth: `calc(100vw - 2 * ${C.gap})`,
    maxHeight: `calc(100dvh - 2 * ${C.gap} - ${C.safeT} - ${C.safeB})`,
    display: 'flex',
    flexDirection: 'column',
  },
  'html .live-panel .panel-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
  },
  // Marges intérieures du panneau flottant (la version mobile en feuille a déjà les siennes).
  'html .live-panel:not(.panel-sheet) .panel-body': { padding: '6px 16px 14px' },

  // ------------------------------------------------ Palette
  'html .palette': {
    width: `min(640px, calc(100vw - 2 * ${C.gap}))`,
    maxHeight: 'min(70dvh, 620px)',
    display: 'flex',
    flexDirection: 'column',
  },
  'html .palette ul': { overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 },
  '.palette-bar': { display: 'flex', alignItems: 'center', gap: '8px' },
  '.palette-bar input': { flex: 1, minWidth: 0, fontSize: '16px' }, // 16px : pas de zoom auto sur iOS
  '.palette-close': { flex: 'none' },

  // ------------------------------------------------ Zoom
  '.zoom-pad button': {
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
};
