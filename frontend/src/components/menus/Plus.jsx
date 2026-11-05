import { useCallback, useRef, useState } from 'react';
import { useOutsideClose } from '@/hooks/useOutsideClose';
import { ToolbarButton } from '../toolbar/ToolbarButton';

// Menu « Plus » de la barre compacte : regroupe les actions secondaires. Monté uniquement sur petit écran.
export function Plus({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(ref, open, close);

  // Indicateur sur « Plus » quand une option cachée est active.
  const hiddenActive = actions.some((a) => a.pressed);

  return (
    <div className="toolbar-more" ref={ref}>
      <button
        type="button"
        className={hiddenActive ? 'tool-btn has-active' : 'tool-btn'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tool-icon" aria-hidden="true">⋯</span>
        <span className="tool-label">Plus</span>
      </button>
      {open && (
        <div className="toolbar-menu" role="menu">
          {actions.map((a) => <ToolbarButton key={a.id} action={a} compact inMenu onPick={close} />)}
        </div>
      )}
    </div>
  );
}
