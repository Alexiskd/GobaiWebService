import { useCallback, useEffect, useRef } from 'react';

const HOLD_INTERVAL_MS = 65;

export function ZoomPad({ onZoom }) {
  const timer = useRef(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = (factor) => (e) => {
    // Clic droit ignoré ; le doigt reste capturé même s'il glisse hors du bouton.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
    onZoom(factor);
    timer.current = setInterval(() => onZoom(factor), HOLD_INTERVAL_MS);
  };

  const onKeyDown = (factor) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onZoom(factor);
    }
  };

  useEffect(() => {
    const events = ['pointerup', 'pointercancel'];
    events.forEach((t) => window.addEventListener(t, stop));
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      events.forEach((t) => window.removeEventListener(t, stop));
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [stop]);

  const common = {
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    // Empêche le menu contextuel / la loupe sur appui long (iOS, Android).
    onContextMenu: (e) => e.preventDefault(),
  };

  return (
    <div className="zoom-pad" role="group" aria-label="Contrôles de zoom">
      <button type="button" title="Maintenir pour zoomer" aria-label="Maintenir pour zoomer" onPointerDown={start(0.94)} onKeyDown={onKeyDown(0.94)} {...common}>
        +
      </button>
      <button type="button" title="Maintenir pour dézoomer" aria-label="Maintenir pour dézoomer" onPointerDown={start(1.064)} onKeyDown={onKeyDown(1.064)} {...common}>
        −
      </button>
    </div>
  );
}
