import { C, fixedReset } from './responsiveTokens';

// Mobile : astres en bande, tiroir d’infos, sources, toasts, palette plein écran et aide.
export const compactSheet = {
  // Indicateur de zoom au-dessus du rail.
  'html .readout': {
    position: 'fixed',
    left: `calc(${C.safeL} + 10px)`,
    bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 10px)`,
    top: 'auto',
    right: 'auto',
    fontSize: '11px',
    pointerEvents: 'none',
  },
  'html .readout .dim': { display: 'none' },

  // Astres : bande horizontale défilante au-dessus de la barre d'outils.
  'html .navigator.navigator-strip': {
    ...fixedReset,
    position: 'fixed',
    left: 0,
    right: 0,
    top: 'auto',
    bottom: `calc(${C.toolbarH} + ${C.safeB})`,
    width: 'auto',
    height: C.stripH,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gridTemplateColumns: 'none',
    gap: '6px',
    padding: `6px calc(${C.safeR} + 8px) 6px calc(${C.safeL} + 8px)`,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollSnapType: 'x proximity',
    scrollbarWidth: 'none',
    borderRadius: 0,
    zIndex: 35,
  },
  'html .navigator-strip::-webkit-scrollbar': { display: 'none' },
  'html .navigator-strip .nav-item': {
    flex: 'none',
    width: 'auto',
    minWidth: 0,
    gridColumn: 'auto',
    padding: '0 12px',
    minHeight: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '999px',
    scrollSnapAlign: 'center',
    whiteSpace: 'nowrap',
  },
  'html .navigator-strip .nav-orb': { width: '12px', height: '12px', flex: 'none' },

  // Panneau d'infos : tiroir bas.
  'html .live-panel.panel-sheet': {
    ...fixedReset,
    position: 'fixed',
    left: 0,
    right: 0,
    top: 'auto',
    bottom: `calc(${C.toolbarH} + ${C.safeB})`,
    width: 'auto',
    maxWidth: 'none',
    maxHeight: `min(62dvh, calc(100dvh - ${C.toolbarH} - ${C.safeB} - ${C.safeT} - 90px))`,
    margin: 0,
    borderRadius: '18px 18px 0 0',
    paddingLeft: `calc(${C.safeL} + 12px)`,
    paddingRight: `calc(${C.safeR} + 12px)`,
    zIndex: 45,
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
  },
  'html .live-panel.panel-sheet.is-collapsed': { maxHeight: C.stripH, overflow: 'hidden' },
  'html .live-panel.panel-sheet > header': {
    cursor: 'pointer',
    position: 'relative',
    paddingTop: '12px',
    minHeight: C.touch,
  },
  'html .live-panel.panel-sheet > header h2': { fontSize: '15px' },
  '.sheet-handle': {
    position: 'absolute',
    top: '5px',
    left: '50%',
    width: '38px',
    height: '4px',
    marginLeft: '-19px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.35)',
  },

  // Sources : coin bas gauche.
  'html .attribution.attribution-compact': {
    position: 'fixed',
    left: `calc(${C.safeL} + 10px)`,
    right: `calc(${C.safeR} + 64px)`,
    bottom: `calc(${C.toolbarH} + ${C.stripH} + ${C.safeB} + 30px)`,
    top: 'auto',
    maxWidth: 'none',
    fontSize: '11px',
    zIndex: 30,
  },

  // Toasts en haut, sous l'en-tête.
  'html .toasts': {
    position: 'fixed',
    top: `calc(${C.safeT} + 70px)`,
    left: `calc(${C.safeL} + 8px)`,
    right: `calc(${C.safeR} + 8px)`,
    bottom: 'auto',
    maxWidth: 'none',
    transform: 'none',
  },

  // Palette plein écran.
  'html .palette-overlay': { alignItems: 'stretch', justifyContent: 'stretch', padding: 0 },
  'html .palette.palette-sheet': {
    width: '100%',
    maxWidth: 'none',
    height: '100dvh',
    maxHeight: 'none',
    margin: 0,
    borderRadius: 0,
    padding: `calc(${C.safeT} + 10px) calc(${C.safeR} + 12px) calc(${C.safeB} + 10px) calc(${C.safeL} + 12px)`,
  },
  'html .palette.palette-sheet ul': { flex: 1, maxHeight: 'none' },
  'html .palette-close': { minHeight: C.touch, padding: '0 10px' },

  // Aide : quasiment plein écran.
  'html .panel.help': {
    width: `calc(100vw - 2 * ${C.gap})`,
    maxHeight: `calc(100dvh - 2 * ${C.gap} - ${C.safeT} - ${C.safeB})`,
    overflowY: 'auto',
  },
  'html .panel.help dl > div': { display: 'flex', flexWrap: 'wrap', gap: '4px 10px' },
};
