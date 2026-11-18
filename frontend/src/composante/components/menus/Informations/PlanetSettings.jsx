import { Box, Typography } from '@mui/material';
import { Atmosphere } from '../Parametres/Atmosphere';
import { Cartographie, CartographieRelief } from '../Parametres/Cartographie';
import { VitesseRotation } from '../Parametres/VitesseRotation';
import { Group } from '../../ui/Group';
import { Switch } from '../../ui/Switch';

/** Réglages attachés à l'astre actuellement décrit dans le panneau Informations. */
export function PlanetSettings({
  bodyId, bodyName, rotateSpeed, onRotateSpeed, rotating,
  atmosphereLayers = {}, atmospheres, onAtmospheres, venusAtmosphere, onVenusAtmosphere,
  marsAtmosphere, onMarsAtmosphere, relief, onRelief, earthLayers = {}, onGoPlace, onDone,
  moonPlaces, onMoonPlaces,
}) {
  if (!bodyId) return null;
  const earth = bodyId === 'earth';
  const venus = bodyId === 'venus';
  const mars = bodyId === 'mars';

  return (
    <Box component="section" aria-label={`Réglages de ${bodyName || 'l’astre'}`} sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
      <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ minHeight: 36, display: 'flex', alignItems: 'center' }}>
        Réglages · {bodyName || 'Astre'}
      </Typography>
      <VitesseRotation speed={rotateSpeed} onSpeed={onRotateSpeed} rotating={rotating} />

      {earth && (
        <>
          <Cartographie {...earthLayers} />
          <CartographieRelief {...earthLayers} relief={relief} onRelief={onRelief} onGoPlace={onGoPlace} onDone={onDone} />
          <Atmosphere
            {...atmosphereLayers}
            showBodyAtmospheres={false}
            showEarthAtmosphere
            showEarthLayers
          />
        </>
      )}

      {(venus || mars) && (
        <Group title="Atmosphère">
          {venus && <Switch checked={venusAtmosphere ?? atmospheres} onChange={onVenusAtmosphere} label="Atmosphère de Vénus" hint="Couche nuageuse et diffusion de la lumière." />}
          {mars && <Switch checked={marsAtmosphere ?? atmospheres} onChange={onMarsAtmosphere} label="Atmosphère de Mars" hint="Diffusion atmosphérique autour de la planète." />}
        </Group>
      )}

      {bodyId === 'moon' && (
        <Group title="Repères lunaires">
          <Switch checked={moonPlaces} onChange={onMoonPlaces} label="Lieux de la Lune" hint="Alunissages (Apollo, Chang’e…), mers, cratères" />
        </Group>
      )}
    </Box>
  );
}
