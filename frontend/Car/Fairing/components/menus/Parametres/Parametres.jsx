import { Box, Dialog, DialogContent, Stack } from '@mui/material';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { PanelHeader } from '../../ui/PanelHeader.jsx';
import { AstresAffiches } from './AstresAffiches.jsx';
import { Reperes } from './Reperes.jsx';
import { AllerAUnAstre } from './AllerAUnAstre.jsx';
import { CatalogueAstres } from '../Astres/CatalogueAstres.jsx';

/**
 * Fenêtre des paramètres : une seule page, les astres (familles affichées, aller à un astre, catalogue). Les pages
 * « Général » (Ma position, pilotage au téléphone) et « Affichage » ont été supprimées ; « Ma position » vit sous la navball.
 */
export function Parametres({
  open, onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky, engineRef,
}) {
  const { compact } = useViewport();
  const pick = (index) => { onSelect?.(index); onClose?.(); };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={compact}
      maxWidth="md"
      fullWidth
      aria-label="Paramètres"
      slotProps={{ paper: { sx: { overflow: 'hidden', borderRadius: compact ? 0 : 3, minHeight: compact ? '100%' : 560, maxHeight: compact ? '100%' : 'min(82vh, 820px)' } } }}
    >
      <PanelHeader kicker="GOBai SPACE" title="Paramètres" onClose={onClose} sx={{ px: 2.5, pt: 2, pb: 1.5 }} />
      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.default : 'transparent') }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <Stack spacing={1.5}>
            {/* Repères et Univers : masqués à l'écran, mais toujours montés dans le DOM, */}
            {/* pour que l'assistant puisse continuer à actionner ces réglages. */}
            <Box sx={{ display: 'none' }} aria-hidden="true">
              <Reperes orbits={orbits} onOrbits={onOrbits} markers={markers} onMarkers={onMarkers} satellites={satellites} onSatellites={onSatellites} sky={sky} onSky={onSky} />
            </Box>
            <AstresAffiches kinds={kinds} onKind={onKind} />
            <AllerAUnAstre bodies={bodies} focus={focus} onPick={pick} onShown={onBodyShown} />
            <CatalogueAstres bodies={bodies} onSelect={onSelect} onBodyShown={onBodyShown} onDone={onClose} engineRef={engineRef} />
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
