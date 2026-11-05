import { useEffect, useRef, useState } from 'react';
import { PlaceSearch } from '@/components/ui/PlaceSearch';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';
import { BodyLayersMenu } from './BodyLayersMenu';
import { BodyPlacesInfo } from './BodyPlacesInfo';
import { useBodyView } from './useBodyView';

function InformationsShell({ view, hud, layersOpen, onCloseLayers, menu, children }) {
  const { compact } = useViewport();
  // Replié par défaut sur petit écran, pour laisser la carte visible.
  const [open, setOpen] = useState(() => !compact);
  const drag = useHudDraggable('panneau', !compact);
  const layersRef = useRef(null);

  useEffect(() => {
    if (!layersOpen) return;
    setOpen(true);
    layersRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [layersOpen]);

  // Passage en compact : on replie pour ne pas recouvrir l'écran.
  const wasCompact = useRef(compact);
  useEffect(() => {
    if (compact && !wasCompact.current && !layersOpen) setOpen(false);
    wasCompact.current = compact;
  }, [compact, layersOpen]);

  const className = [
    'panel moon-live live-panel',
    compact && 'panel-sheet',
    compact && (open ? 'is-open' : 'is-collapsed'),
  ].filter(Boolean).join(' ');

  return (
    <section
      className={className}
      data-body={view?.id}
      aria-label={view ? `${view.name} en direct` : 'Informations'}
      ref={drag.ref}
      style={drag.style}
    >
      <header {...drag.handleProps} onClick={compact ? () => setOpen((v) => !v) : undefined}>
        {compact ? <span className="sheet-handle" aria-hidden="true" /> : <span className="drag-grip" aria-hidden="true" />}
        {/* Nom de l'astre et badge « En direct » centrés ; poignée à gauche, bouton de repli à droite. */}
        <div className="live-heading">
          <h2>{view ? view.name : 'Informations'}</h2>
          {view && <span className="live" role="status">En direct</span>}
        </div>
        <button
          type="button"
          className="ghost"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-expanded={open}
          aria-label={open ? 'Réduire' : 'Déplier'}
        >
          {open ? '–' : '+'}
        </button>
      </header>
      {open && (
        <div className="panel-body">
          {children}
          {layersOpen && (
            <section className="layers-section" aria-label="Informations" ref={layersRef}>
              <header>
                {view && <h3>Informations{menu.bodyName ? ` · ${menu.bodyName}` : ''}</h3>}
                <button type="button" className="ghost" onClick={onCloseLayers} aria-label="Fermer les informations">×</button>
              </header>
              <BodyLayersMenu hud={hud} {...menu} />
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export function Informations({ hud, data, phases, handlers, layersOpen, onCloseLayers, ...menu }) {
  const view = useBodyView({ hud, data, phases, handlers });
  if (!view && !layersOpen) return null;

  return (
    <InformationsShell view={view} hud={hud} layersOpen={layersOpen} onCloseLayers={onCloseLayers} menu={menu}>
      {view && <BodyPlacesInfo view={view} handlers={handlers} Search={PlaceSearch} />}
    </InformationsShell>
  );
}
