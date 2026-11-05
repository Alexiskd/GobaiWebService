import { memo, useEffect, useRef } from 'react';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';

// Grand écran : rail bento déplaçable. Petit écran : bande horizontale défilante en bas.
export const Navigator = memo(function Navigator({ bodies, focus, onSelect }) {
  const { compact } = useViewport();
  const drag = useHudDraggable('navigation', !compact);
  const activeRef = useRef(null);

  // En bande horizontale, l'astre actif reste visible.
  useEffect(() => {
    if (compact) activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [compact, focus]);

  return (
    <nav
      className={compact ? 'navigator navigator-strip' : 'navigator'}
      aria-label="Astres"
      ref={drag.ref}
      style={drag.style}
      {...drag.handleProps}
    >
      {!compact && <span className="nav-title" aria-hidden="true"><span className="drag-grip" />Navigation</span>}
      {bodies.map((body, i) => {
        const wide = !compact && (i === 0 || i === bodies.length - 1);
        const current = focus === i;
        return (
          <button
            type="button"
            key={body.name}
            ref={current ? activeRef : undefined}
            className={wide ? 'nav-item nav-wide' : 'nav-item'}
            style={{ '--body': body.color }}
            aria-current={current ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className="nav-orb" aria-hidden="true" />
            <span className="nav-name">{body.name}</span>
            {!compact && <span className="nav-id" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>}
          </button>
        );
      })}
    </nav>
  );
});
