import { GlobalStyles } from '@mui/material';
import { MQ, TOUCH, safe } from './queries';

// ---------------------------------------------------------------- Styles MUI

const pointCloudStyles = {
  // ------------------------------------------------ Panneau (écran large)
  'html .city-pointcloud': {
    width: 'clamp(340px, 34vw, 560px)',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: `calc(100dvh - 32px - ${safe('top')} - ${safe('bottom')})`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  'html .city-pointcloud > header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flex: 'none',
  },
  'html .city-pointcloud > header h2': {
    margin: 0,
    fontSize: 'clamp(17px, 1vw + 12px, 22px)',
    overflowWrap: 'anywhere',
  },
  'html .city-pointcloud-body': {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingBottom: `calc(8px + ${safe('bottom')})`,
  },
  'html .city-pointcloud-location': { margin: 0, opacity: 0.8, fontVariantNumeric: 'tabular-nums' },

  // ------------------------------------------------ Méta-données : jamais de débordement
  'html .city-pointcloud-meta': { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.9em' },
  'html .city-pointcloud-meta span, html .city-pointcloud-message, html .city-pointcloud-message code': {
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    minWidth: 0,
  },

  // ------------------------------------------------ Sélecteur
  'html .city-pointcloud-select': { display: 'flex', flexDirection: 'column', gap: '6px' },
  'html .city-pointcloud-select select': { width: '100%', minWidth: 0, boxSizing: 'border-box' },

  // ------------------------------------------------ Viewer 3D
  'html .city-pointcloud-viewer': {
    position: 'relative',
    width: '100%',
    height: 'clamp(240px, 42dvh, 520px)',
    flex: 'none',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#080c14',
  },
  'html .city-pointcloud-canvas-host': { position: 'absolute', inset: 0 },
  'html .city-pointcloud-canvas': {
    display: 'block',
    width: '100% !important',
    height: '100% !important',
    touchAction: 'none', // les gestes (rotation, pincement) vont aux OrbitControls
    outline: 'none',
  },
  'html .city-pointcloud-viewer .city-pointcloud-message': {
    position: 'absolute',
    inset: 'auto 12px 12px 12px',
    margin: 0,
    pointerEvents: 'none',
  },
  'html .city-pointcloud-tools': {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '6px',
    zIndex: 1,
  },
  'html .city-pointcloud-tools button': {
    minWidth: '36px',
    minHeight: '36px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(12, 16, 28, 0.78)',
    color: '#fff',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    cursor: 'pointer',
  },
  'html .city-pointcloud-hint': { margin: 0, fontSize: '12px', opacity: 0.7 },

  // ------------------------------------------------ LiDAR Lyon
  'html .city-pointcloud-lyon': { display: 'flex', flexDirection: 'column', gap: '8px' },
  'html .city-pointcloud-lyon h3': { margin: 0 },
  'html .city-pointcloud-ept-frame': {
    width: '100%',
    height: 'clamp(240px, 42dvh, 520px)',
    border: 0,
    borderRadius: '10px',
    background: '#080c14',
    display: 'block',
  },
  'html .city-pointcloud-lyon a': { alignSelf: 'flex-start', padding: '4px 0' },

  // ================================================ Grand écran
  [MQ.xl]: {
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': { height: 'clamp(320px, 48dvh, 640px)' },
  },

  // ================================================ Tablette
  [MQ.tablet]: {
    'html .city-pointcloud': { width: 'min(460px, calc(100vw - 32px))' },
  },

  // ================================================ Tactile
  [MQ.coarse]: {
    'html .city-pointcloud button, html .city-pointcloud select, html .city-pointcloud-tools button': {
      minHeight: TOUCH,
      minWidth: TOUCH,
    },
    'html .city-pointcloud select': { fontSize: '16px' }, // pas de zoom auto sur iOS
  },

  // ================================================ Mobile : plein écran
  [MQ.compact]: {
    'html .city-pointcloud': {
      position: 'fixed',
      inset: 0,
      transform: 'none !important',
      width: '100%',
      maxWidth: 'none',
      height: '100dvh',
      maxHeight: 'none',
      margin: 0,
      borderRadius: 0,
      zIndex: 70,
      padding: `calc(${safe('top')} + 10px) calc(${safe('right')} + 12px) 0 calc(${safe('left')} + 12px)`,
    },
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': {
      height: 'max(260px, 55dvh)',
      borderRadius: '8px',
    },
    'html .city-pointcloud-meta': { fontSize: '12px' },
  },

  // ================================================ Téléphone en paysage : le nuage prend la hauteur
  [MQ.landscapePhone]: {
    'html .city-pointcloud-viewer, html .city-pointcloud-ept-frame': {
      height: `calc(100dvh - ${safe('top')} - ${safe('bottom')} - 80px)`,
    },
    'html .city-pointcloud-location': { display: 'none' },
  },
};

export function PointCloudStyles() {
  return <GlobalStyles styles={pointCloudStyles} />;
}
