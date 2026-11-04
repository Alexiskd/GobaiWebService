import { useHud } from '@/engine/hudStore';
import { useDraggable } from '@/hooks/useDraggable';

export default function HudTop({ hud }) {
  const date = useHud(hud, (s) => s.date);
  const focusText = useHud(hud, (s) => s.focusText);
  const drag = useDraggable('titre');
  return (
    <header className="title" ref={drag.ref} style={drag.style} {...drag.handleProps}>
      <img className="brand-logo" src="/logo.png" alt="" width="96" height="96" draggable={false} />
      <div className="title-text">
        <h1>
          Gobai Space ١д१壹אη하 <span className="live">en direct</span>
        </h1>
        <p>{date}</p>
        <p>{focusText}</p>
      </div>
    </header>
  );
}
