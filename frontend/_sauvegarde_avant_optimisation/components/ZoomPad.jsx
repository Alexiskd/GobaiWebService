import { useCallback, useEffect, useRef } from 'react';

const HOLD_INTERVAL_MS = 65;

// Boutons + / − flottants : le zoom se répète tant que le bouton reste enfoncé
// (souris ou écran tactile).
export default function ZoomPad({ onZoom }) {
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = (factor) => (e) => {
    e.preventDefault();
    stop();
    onZoom(factor);
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  };

  // Accessibilité clavier : Entrée / Espace = un cran de zoom.
  const onKeyDown = (factor) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(factor);
    }
  };

  useEffect(() => {
    const events = ['pointerup', 'pointercancel', 'pointerleave'];
    events.forEach((t) => window.addEventListener(t, stop));
    window.addEventListener('blur', stop);
    return () => {
      stop();
      events.forEach((t) => window.removeEventListener(t, stop));
      window.removeEventListener('blur', stop);
    };
  }, [stop]);

  return (
    <div className="zoom-pad" role="group" aria-label="Contrôles de zoom">
      <button title="Maintenir pour zoomer" aria-label="Maintenir pour zoomer" onPointerDown={start(0.94)} onKeyDown={onKeyDown(0.94)}>
        +
      </button>
      <button title="Maintenir pour dézoomer" aria-label="Maintenir pour dézoomer" onPointerDown={start(1.064)} onKeyDown={onKeyDown(1.064)}>
        −
      </button>
    </div>
  );
}
