import { useEffect, useRef, useState } from 'react';
import { Box, Collapse, IconButton, Paper, Stack, Typography } from '@mui/material';
import { PlaceSearch } from '@/components/ui/PlaceSearch';
import { useHudDraggable } from '@/hooks/useHudDraggable';
import { useViewport } from '@/hooks/useViewport';
import { PANEL_W, TOOLBAR_H, edge } from '@/theme/layout';
import { safe } from '@/theme/mediaQueries';
import { CloseIcon, ExpandLessIcon, ExpandMoreIcon } from '../../ui/icons';
import { LiveChip, PanelHeader } from '../../ui/PanelHeader';
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

  // Ordinateur : fenêtre flottante à droite (déplaçable). Mobile : tiroir au-dessus de la barre d'outils.
  const placement = compact ? {
    left: 0, right: 0, bottom: `calc(${TOOLBAR_H}px + ${safe('bottom')})`, width: 'auto',
    maxHeight: `min(62dvh, calc(100dvh - ${TOOLBAR_H}px - ${safe('bottom')} - ${safe('top')} - 90px))`,
    borderRadius: '18px 18px 0 0', zIndex: (t) => t.zIndex.toolbar + 5,
  } : {
    right: edge('right', 76), top: edge('top', 12), width: PANEL_W, maxHeight: 'calc(100dvh - 100px)',
    zIndex: (t) => t.zIndex.hudPanel,
  };

  return (
    <Paper
      component="section"
      elevation={8}
      data-body={view?.id}
      aria-label={view ? `${view.name} en direct` : 'Informations'}
      ref={drag.ref}
      style={drag.style}
      sx={{ position: 'fixed', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...placement }}
    >
      <PanelHeader
        sheet={compact}
        dragProps={drag.handleProps}
        onClick={compact ? () => setOpen((v) => !v) : undefined}
        title={view ? view.name : 'Informations'}
        titleAdornment={view ? <LiveChip /> : null}
        sx={open ? undefined : { borderBottom: 0 }}
        actions={(
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-expanded={open}
            aria-label={open ? 'Réduire' : 'Déplier'}
          >
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        )}
      />
      <Collapse in={open} timeout="auto" unmountOnExit sx={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <Box sx={{ px: 2, pt: 1.5, pb: compact ? `calc(${safe('bottom')} + 12px)` : 1.5 }}>
          {children}
          {layersOpen && (
            <Box component="section" aria-label="Informations" ref={layersRef} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 36 }}>
                {view && (
                  <Typography component="h3" variant="subtitle2" color="text.secondary">
                    Informations{menu.bodyName ? ` · ${menu.bodyName}` : ''}
                  </Typography>
                )}
                <IconButton size="small" onClick={onCloseLayers} aria-label="Fermer les informations" sx={{ ml: 'auto' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <BodyLayersMenu hud={hud} {...menu} />
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
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
