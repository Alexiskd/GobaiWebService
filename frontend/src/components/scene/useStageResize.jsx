import { useEffect } from 'react';

/** Le canvas WebGL suit la taille réelle du conteneur (rotation d’écran, barre d’adresse mobile, fenêtre redimensionnée). */
export function useStageResize(containerRef, engineRef) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (typeof engineRef.current?.resize === 'function') engineRef.current.resize();
        else window.dispatchEvent(new Event('resize'));
      });
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [containerRef, engineRef]);
}
