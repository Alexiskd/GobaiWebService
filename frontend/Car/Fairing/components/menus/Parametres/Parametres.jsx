import { useState } from 'react';
import { Box, Dialog, DialogContent, Stack, Tab, Tabs } from '@mui/material';
import { useViewport } from '@/Fairing/hooks/useViewport';
import { PanelHeader } from '../../ui/PanelHeader.jsx';
import { AstresAffiches } from './AstresAffiches.jsx';
import { Reperes } from './Reperes.jsx';
import { PilotageTelephone } from './PilotageTelephone.jsx';
import { AllerAUnAstre } from './AllerAUnAstre.jsx';
import { CatalogueAstres } from '../Astres/CatalogueAstres.jsx';
import { MaPosition } from './MaPosition.jsx';

const tabs = [
  { value: 'general', label: 'Général' },
  { value: 'affichage', label: 'Affichage' },
  { value: 'astres', label: 'Astres' },
];

export function Parametres({
  open, onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky,
  onGoPlace, myPosition, engineRef,
}) {
  const { compact } = useViewport();
  const [tab, setTab] = useState('general');
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
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Catégories des paramètres"
        sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider', flex: 'none', '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600 } }}
      >
        {tabs.map((item) => <Tab key={item.value} value={item.value} label={item.label} id={`settings-tab-${item.value}`} aria-controls={`settings-panel-${item.value}`} />)}
      </Tabs>
      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.default : 'transparent') }}>
        <Box role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} sx={{ maxWidth: 900, mx: 'auto' }}>
          {tab === 'general' && (
            <Stack spacing={1.5}>
              <MaPosition onGoPlace={onGoPlace} myPosition={myPosition} onDone={onClose} />
              <PilotageTelephone />
            </Stack>
          )}
          {tab === 'affichage' && (
            <Stack spacing={1.5}>
              {/* Repères et Univers : masqués à l'écran, mais toujours montés dans le DOM, */}
              {/* pour que l'assistant puisse continuer à actionner ces réglages. */}
              <Box sx={{ display: 'none' }} aria-hidden="true">
                <Reperes orbits={orbits} onOrbits={onOrbits} markers={markers} onMarkers={onMarkers} satellites={satellites} onSatellites={onSatellites} sky={sky} onSky={onSky} />
              </Box>
            </Stack>
          )}
          {tab === 'astres' && (
            <Stack spacing={1.5}>
              {/* Familles d'astres : déplacées ici depuis l'onglet Affichage. */}
              <AstresAffiches kinds={kinds} onKind={onKind} />
              <AllerAUnAstre bodies={bodies} focus={focus} onPick={pick} onShown={onBodyShown} />
              <CatalogueAstres bodies={bodies} onSelect={onSelect} onBodyShown={onBodyShown} onDone={onClose} engineRef={engineRef} />
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
