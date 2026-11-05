import { C } from './responsiveTokens';

// Barre d’outils (ordinateur) et menu « Plus ».
export const toolbarStyles = {
  // ------------------------------------------------ Barre d'outils
  '.tool-btn': { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap' },
  '.tool-icon': { fontSize: '1.15em', lineHeight: 1 },
  '.tool-label-short': { display: 'none' },

  // ------------------------------------------------ Barre du bas · ordinateur / laptop
  // Une seule ligne centrée, jamais de retour à la ligne : [zoom] | Explorer | Données | Caméra | ?
  'html .toolbar.toolbar-desktop': {
    position: 'fixed',
    left: '50%',
    right: 'auto',
    top: 'auto',
    bottom: `calc(${C.safeB} + ${C.gap})`,
    transform: 'translateX(-50%)',
    zIndex: 40,
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: '4px',
    width: 'max-content',
    maxWidth: `calc(100vw - 2 * ${C.gap} - ${C.safeL} - ${C.safeR})`,
    height: '52px',
    margin: 0,
    padding: '6px',
    boxSizing: 'border-box',
    borderRadius: '16px',
    background: 'rgba(10, 14, 24, 0.78)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
    boxShadow: '0 10px 32px rgba(0, 0, 0, 0.4)',
    overflowX: 'auto',          // filet de sécurité : défile plutôt que de passer à la ligne
    overflowY: 'hidden',
    scrollbarWidth: 'none',
  },
  'html .toolbar-desktop::-webkit-scrollbar': { display: 'none' },

  // Indicateur de zoom intégré à gauche de la barre.
  'html .toolbar-desktop .readout': {
    position: 'static',
    inset: 'auto',
    transform: 'none',
    flex: '0 1 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '1px',
    minWidth: 0,
    maxWidth: '220px',
    height: '100%',
    padding: '0 12px 0 8px',
    marginRight: '2px',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '12px',
    lineHeight: 1.2,
    pointerEvents: 'none',
  },
  'html .toolbar-desktop .readout span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  'html .toolbar-desktop .readout .dim': { opacity: 0.6, fontSize: '11px' },

  'html .toolbar-desktop .tool-group': { display: 'flex', alignItems: 'center', gap: '4px', flex: 'none', height: '100%' },
  'html .toolbar-desktop .tool-sep': {
    width: '1px',
    alignSelf: 'stretch',
    margin: '6px 4px',
    background: 'rgba(255, 255, 255, 0.12)',
  },

  // Boutons : même hauteur, même rayon, même espacement → alignement parfait.
  'html .toolbar-desktop .tool-btn': {
    height: '40px',
    minHeight: '40px',
    minWidth: 0,
    margin: 0,
    padding: '0 14px',
    gap: '8px',
    borderRadius: '10px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    fontSize: '13.5px',
    fontWeight: 500,
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease, opacity 120ms ease',
  },
  'html .toolbar-desktop .tool-btn .tool-icon': { fontSize: '16px', width: '16px', textAlign: 'center', opacity: 0.85 },
  'html .toolbar-desktop .tool-btn.tool-btn-icon': { width: '40px', padding: 0 },
  'html .toolbar-desktop .tool-btn:hover:not(:disabled)': { background: 'rgba(255, 255, 255, 0.08)' },
  'html .toolbar-desktop .tool-btn:focus-visible': { outline: '2px solid #4fc3f7', outlineOffset: '1px' },
  'html .toolbar-desktop .tool-btn[aria-pressed="true"]': {
    background: 'rgba(79, 195, 247, 0.16)',
    borderColor: 'rgba(79, 195, 247, 0.45)',
    color: '#bfe9ff',
  },
  'html .toolbar-desktop .tool-btn[aria-pressed="true"] .tool-icon': { opacity: 1 },
  'html .toolbar-desktop .tool-btn:disabled': { opacity: 0.38, cursor: 'not-allowed' },

  // Laptop 13–14" (≤ 1366 px) : un peu plus serré.
  '@media (max-width: 1366px)': {
    'html .toolbar-desktop .tool-btn': { padding: '0 11px', gap: '6px', fontSize: '13px' },
    'html .toolbar-desktop .readout': { maxWidth: '170px' },
  },
  // Petit laptop (≤ 1180 px) : libellés courts (« Infos », « Global »), plus de niveau de carte.
  '@media (max-width: 1180px)': {
    'html .toolbar-desktop .tool-label-full.has-short': { display: 'none' },
    'html .toolbar-desktop .tool-label-short': { display: 'inline' },
    'html .toolbar-desktop .readout': { maxWidth: '130px' },
    'html .toolbar-desktop .readout .dim': { display: 'none' },
  },
  // Tablette / fenêtre réduite (≤ 1024 px) : indicateur de zoom masqué, boutons resserrés.
  '@media (max-width: 1024px)': {
    'html .toolbar-desktop .readout': { display: 'none' },
    'html .toolbar-desktop .tool-btn': { padding: '0 9px', fontSize: '12.5px' },
  },
  // Très étroit mais pas mobile (≤ 860 px) : icônes seules, le libellé reste dans l'info-bulle.
  '@media (max-width: 860px)': {
    'html .toolbar-desktop .tool-label': { display: 'none' },
    'html .toolbar-desktop .tool-btn': { width: '40px', padding: 0 },
  },
  '.toolbar-more': { position: 'relative' },
  '.toolbar-menu': {
    position: 'absolute',
    right: 0,
    bottom: 'calc(100% + 8px)',
    display: 'flex',
    flexDirection: 'column',
    minWidth: '190px',
    padding: '6px',
    borderRadius: '14px',
    background: 'rgba(12, 16, 28, 0.94)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
    zIndex: 60,
  },
  '.tool-menu-item': { justifyContent: 'flex-start', width: '100%', minHeight: C.touch },
  '.tool-btn.has-active': { position: 'relative' },
  '.tool-btn.has-active::after': {
    content: '""',
    position: 'absolute',
    top: '6px',
    right: '8px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#4fc3f7',
  },
};
