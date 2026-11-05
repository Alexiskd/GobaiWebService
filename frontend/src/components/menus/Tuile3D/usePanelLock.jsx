import { useEffect } from 'react';

// Échap ferme le panneau ; en plein écran mobile, le fond ne défile pas.
export function usePanelLock(open, onClose, compact) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape' && !document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', onKey);
    let previous;
    if (compact) {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      if (compact) document.body.style.overflow = previous;
    };
  }, [open, onClose, compact]);
}
