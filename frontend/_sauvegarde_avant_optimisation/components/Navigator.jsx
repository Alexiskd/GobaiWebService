import { memo } from 'react';
import { useDraggable } from '@/hooks/useDraggable';

// Rail des astres : un clic centre la vue sur l'astre, sans changer le niveau de zoom.
// Les tuiles larges (Soleil, Lune) ouvrent et ferment la grille bento.
function Navigator({ bodies, focus, onSelect }) {
  const drag = useDraggable('navigation');
  return (
    <nav className="navigator" aria-label="Astres" ref={drag.ref} style={drag.style} {...drag.handleProps}>
      <span className="nav-title" aria-hidden="true"><span className="drag-grip" />Navigation</span>
      {bodies.map((body, i) => {
        const wide = i === 0 || i === bodies.length - 1;
        return (
          <button
            key={body.name}
            className={wide ? 'nav-item nav-wide' : 'nav-item'}
            style={{ '--body': body.color }}
            aria-current={focus === i ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className="nav-orb" aria-hidden="true" />
            <span className="nav-name">{body.name}</span>
            <span className="nav-id" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default memo(Navigator);
