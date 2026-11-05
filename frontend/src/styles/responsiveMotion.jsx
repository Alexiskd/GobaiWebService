import { MQ } from './mediaQueries';

// Téléportation entre astres (animations) et accessibilité.
export const motionStyles = {
  // ================================================ Téléportation entre astres
  // Couche plein écran, sans interaction : traînées d'hyperespace, anneau de choc, flash
  // à la couleur de l'astre d'arrivée, puis nom de la destination. Durée totale ≈ 1,1 s.
  '@keyframes tpVeil': {
    '0%': { opacity: 0 },
    '18%': { opacity: 1 },
    '62%': { opacity: 1 },
    '100%': { opacity: 0 },
  },
  '@keyframes tpWarp': {
    '0%': { opacity: 0, transform: 'scale(0.15) rotate(0deg)' },
    '20%': { opacity: 0.95 },
    '55%': { opacity: 0.9, transform: 'scale(1.6) rotate(8deg)' },
    '100%': { opacity: 0, transform: 'scale(3.2) rotate(14deg)' },
  },
  '@keyframes tpRing': {
    '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.05)' },
    '35%': { opacity: 0 },
    '45%': { opacity: 1 },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(2.4)' },
  },
  '@keyframes tpFlash': {
    '0%, 35%': { opacity: 0 },
    '46%': { opacity: 0.95 },
    '100%': { opacity: 0 },
  },
  '@keyframes tpCore': {
    '0%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.2)' },
    '40%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
    '55%': { opacity: 1, transform: 'translate(-50%, -50%) scale(0.6)' },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(4)' },
  },
  '@keyframes tpLabel': {
    '0%, 40%': { opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)', filter: 'blur(14px)', letterSpacing: '0.9em' },
    '58%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', filter: 'blur(0)', letterSpacing: '0.32em' },
    '82%': { opacity: 1 },
    '100%': { opacity: 0, transform: 'translate(-50%, -50%) scale(0.96)', filter: 'blur(4px)', letterSpacing: '0.28em' },
  },

  '.teleport-fx': {
    '--tp': '#8fd3ff',
    position: 'fixed',
    inset: 0,
    zIndex: 80,
    pointerEvents: 'none',
    overflow: 'hidden',
    contain: 'strict',
  },
  // Assombrit et floute légèrement la scène pendant le saut.
  '.teleport-fx .tp-veil': {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(2, 4, 12, 0.55) 55%, rgba(2, 4, 12, 0.92) 100%)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    animation: 'tpVeil 1100ms ease-in-out both',
  },
  // Traînées d'étoiles qui jaillissent du centre (effet hyperespace).
  '.teleport-fx .tp-warp': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '200vmax',
    height: '200vmax',
    margin: '-100vmax 0 0 -100vmax',
    background: [
      'repeating-conic-gradient(from 0deg, transparent 0deg 3.1deg, color-mix(in srgb, var(--tp) 70%, white) 3.1deg 3.35deg, transparent 3.35deg 7.3deg, rgba(255,255,255,0.85) 7.3deg 7.45deg)',
    ].join(','),
    WebkitMaskImage: 'radial-gradient(circle, transparent 0%, transparent 6%, black 22%, transparent 62%)',
    maskImage: 'radial-gradient(circle, transparent 0%, transparent 6%, black 22%, transparent 62%)',
    mixBlendMode: 'screen',
    animation: 'tpWarp 1100ms cubic-bezier(0.55, 0, 0.25, 1) both',
    willChange: 'transform, opacity',
  },
  // Noyau lumineux au centre, qui se contracte puis explose.
  '.teleport-fx .tp-core': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '26vmin',
    height: '26vmin',
    borderRadius: '50%',
    background: 'radial-gradient(circle, white 0%, var(--tp) 28%, transparent 70%)',
    filter: 'blur(2px)',
    mixBlendMode: 'screen',
    animation: 'tpCore 1100ms cubic-bezier(0.5, 0, 0.2, 1) both',
  },
  // Onde de choc à l'arrivée.
  '.teleport-fx .tp-ring': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '60vmin',
    height: '60vmin',
    borderRadius: '50%',
    border: '2px solid var(--tp)',
    boxShadow: '0 0 40px var(--tp), inset 0 0 40px var(--tp)',
    mixBlendMode: 'screen',
    animation: 'tpRing 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
  },
  '.teleport-fx .tp-flash': {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, white 0%, var(--tp) 30%, transparent 75%)',
    mixBlendMode: 'screen',
    animation: 'tpFlash 1100ms ease-out both',
  },
  // Nom de l'astre d'arrivée.
  '.teleport-fx .tp-label': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    margin: 0,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    fontWeight: 700,
    fontSize: 'clamp(22px, 4.2vw, 56px)',
    color: '#fff',
    textShadow: '0 0 18px var(--tp), 0 0 42px var(--tp)',
    animation: 'tpLabel 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
  },
  '.teleport-fx .tp-label small': {
    display: 'block',
    marginTop: '6px',
    textAlign: 'center',
    fontSize: '0.28em',
    fontWeight: 500,
    letterSpacing: '0.4em',
    opacity: 0.75,
  },
  // ================================================ Accessibilité
  [MQ.reducedMotion]: {
    '*, *::before, *::after': {
      animationDuration: '0.01ms !important',
      transitionDuration: '0.01ms !important',
      scrollBehavior: 'auto !important',
    },
  },
};
