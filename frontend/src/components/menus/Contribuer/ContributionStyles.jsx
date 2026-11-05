import { GlobalStyles } from '@mui/material';
import { MQ } from './media';

// Styles MUI du panneau Contributions, injectés par le composant (aucun fichier .css).

const TOUCH = '44px';
const safe = (side) => `env(safe-area-inset-${side}, 0px)`;

const contributionStyles = {
  // ------------------------------------------------ Fenêtre (écran large)
  'html .contribution-overlay': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `clamp(8px, 2vw, 24px)`,
  },
  'html .contribution-panel': {
    width: 'min(760px, calc(100vw - 32px))',
    maxHeight: `calc(100dvh - 32px - ${safe('top')} - ${safe('bottom')})`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: 0,
  },
  'html .contribution-panel > header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flex: 'none',
  },
  'html .contribution-panel > header h2': { margin: 0, fontSize: 'clamp(17px, 1vw + 12px, 22px)' },
  'html .contribution-panel .icon-btn': { minWidth: '36px', minHeight: '36px', flex: 'none' },
  'html .contribution-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: `calc(12px + ${safe('bottom')})`,
  },

  // ------------------------------------------------ Champs
  'html .contribution-field, html .contribution-search': {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  'html .contribution-panel input': { width: '100%', minWidth: 0, boxSizing: 'border-box' },
  'html .contribution-panel input[type="file"]': { cursor: 'pointer' },
  'html .contribution-panel fieldset': { margin: 0, minWidth: 0, border: 'none', padding: 0 },
  'html .contribution-panel legend': { padding: 0, marginBottom: '6px' },
  'html .contribution-grid': {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
  },
  'html .contribution-grid label': { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },

  // ------------------------------------------------ Textes longs (CID, CRS) : jamais de débordement
  'html .contribution-meta': { display: 'flex', flexDirection: 'column', gap: '4px' },
  [[
    'html .contribution-meta span',
    'html .contribution-card small',
    'html .contribution-card p',
    'html .contribution-status',
    'html .contribution-error',
    'html .contribution-note',
    'html .contribution-comment p',
  ].join(', ')]: { overflowWrap: 'anywhere', wordBreak: 'break-word' },
  'html .contribution-cid': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' },

  // ------------------------------------------------ Notes repliables
  'html .contribution-notes summary': { cursor: 'pointer', fontSize: '13px', opacity: 0.85 },
  'html .contribution-notes[open] summary': { marginBottom: '6px' },

  // ------------------------------------------------ Actions
  'html .contribution-actions': { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  'html .contribution-actions button': { flex: '1 1 auto' },
  'html .contribution-feed-tabs': { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  'html .contribution-feed-tabs button': { flex: '1 1 0', minWidth: 0 },

  // ------------------------------------------------ Flux
  'html .contribution-feed': { display: 'flex', flexDirection: 'column', gap: '10px' },
  'html .contribution-card': { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
  'html .contribution-card-title': {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
  },
  'html .contribution-card-title strong': { minWidth: 0, overflowWrap: 'anywhere' },
  'html .contribution-badge': { flex: 'none', whiteSpace: 'nowrap' },

  // ------------------------------------------------ Commentaires
  'html .contribution-comment': {
    marginLeft: 'calc(var(--depth, 0) * 12px)',
    paddingLeft: '8px',
    borderLeft: '2px solid rgba(255, 255, 255, 0.12)',
    minWidth: 0,
  },
  'html .contribution-comment-form': { display: 'flex', gap: '6px', alignItems: 'stretch', marginTop: '6px' },
  'html .contribution-comment-form input': { flex: 1 },
  'html .contribution-comment-form button': { flex: 'none' },

  // ================================================ Tactile
  [MQ.coarse]: {
    [[
      'html .contribution-panel button',
      'html .contribution-panel input:not([type="file"])',
      'html .contribution-notes summary',
    ].join(', ')]: { minHeight: TOUCH },
    'html .contribution-panel .icon-btn': { minWidth: TOUCH },
    'html .contribution-panel input': { fontSize: '16px' }, // pas de zoom auto sur iOS
  },

  // ================================================ Mobile : plein écran
  [MQ.compact]: {
    'html .contribution-overlay': { padding: 0, alignItems: 'stretch', justifyContent: 'stretch' },
    'html .contribution-panel': {
      width: '100%',
      maxWidth: 'none',
      height: '100dvh',
      maxHeight: 'none',
      borderRadius: 0,
      padding: `calc(${safe('top')} + 10px) calc(${safe('right')} + 12px) 0 calc(${safe('left')} + 12px)`,
    },
    'html .contribution-panel > header': {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      paddingBottom: '8px',
    },
    'html .contribution-panel input': { fontSize: '16px' },
    'html .contribution-actions button': { flex: '1 1 100%' },
    'html .contribution-comment': { marginLeft: 'calc(var(--depth, 0) * 8px)' },
  },

  // ================================================ Téléphone étroit
  [MQ.xs]: {
    'html .contribution-grid': { gridTemplateColumns: '1fr' },
    'html .contribution-comment-form': { flexDirection: 'column' },
    'html .contribution-comment-form button': { width: '100%' },
  },

  [MQ.reducedMotion]: {
    'html .contribution-body': { scrollBehavior: 'auto' },
  },
};

export function ContributionStyles() {
  return <GlobalStyles styles={contributionStyles} />;
}
