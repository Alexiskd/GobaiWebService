import { MQ } from './mediaQueries';

// Grand écran / TV et tablette.
export const screenStyles = {
  // ================================================ Grand écran / TV (> 1440px)
  [MQ.xl]: {
    ':root': { '--panel-w': 'clamp(380px, 24vw, 480px)' },
    'html .navigator': { fontSize: '1.05em' },
  },

  // ================================================ Tablette (≤ 1024px)
  [MQ.tablet]: {
    ':root': { '--logo-w': 'clamp(120px, 18vw, 180px)', '--panel-w': 'min(340px, 42vw)' },
    'html .hud-title p.title-focus': { display: 'none' },
    'html .navigator .nav-id': { display: 'none' },
    'html .readout .dim': { display: 'none' },
  },
};
