import { useHud } from '@/engine/hudStore';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';

export function HudTop({ hud }) {
  const { compact } = useViewport();
  const date = useHud(hud, (s) => s.date);
  const focusText = useHud(hud, (s) => s.focusText);
  const drag = useHudDraggable('titre', !compact);
  // Les tailles et marges du logo sont dans les styles MUI (`responsiveStyles`), plus de valeurs figées en ligne.
  return (
    <header className="title hud-title" ref={drag.ref}  {...drag.handleProps}>
      <img
        className="brand-logo"
        src="/logo.png?v=3"
        alt="Logo Gobai"
        width="252"
        height="138"
        draggable={false}
        decoding="async"
      />
      <div className="title-text">
        <h1>
          Gobai Space <span className="title-glyphs" aria-hidden="true">١д१壹אη하</span>
        </h1>
        <span className="live" role="status">En direct</span>
        <p className="title-date">{date}</p>
        {focusText && <p className="title-focus">{focusText}</p>}
      </div>
    </header>
  );
}
