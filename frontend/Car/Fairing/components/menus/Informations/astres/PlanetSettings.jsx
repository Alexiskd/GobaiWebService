import { Atmosphere } from '../../Parametres/Atmosphere.jsx';
import { Cartographie, CartographieRelief } from '../../Parametres/Cartographie.jsx';
import { VitesseRotation } from '../../Parametres/VitesseRotation.jsx';
import { Group } from '../../../ui/Group.jsx';
import { Switch } from '../../../ui/Switch.jsx';

/** Astres, hors la Terre, dont le relief en volume vient de tuiles d'altitude (voir tiledBodies) : l'interrupteur « Relief 3D » leur est proposé. */
const RELIEF_BODIES = ['moon', 'mars', 'mercury', 'venus'];

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
    <section aria-label={`Réglages de ${bodyName || 'l’astre'}`} className="mt-2 pt-2 border-t border-line">
      <h3 className="t-subtitle2 text-soft min-h-9 flex items-center">
        Réglages · {bodyName || 'Astre'}
      </h3>
      <VitesseRotation speed={rotateSpeed} onSpeed={onRotateSpeed} rotating={rotating} />

      {earth && (
        <>
          <Cartographie {...earthLayers} />
          <CartographieRelief {...earthLayers} relief={relief} onRelief={onRelief} onGoPlace={onGoPlace} onDone={onDone} />
          <Atmosphere
            {...atmosphereLayers}
            showBodyAtmospheres={false}
            showEarthAtmosphere
          />
        </>
      )}

      {(venus || mars) && (
        <Group title="Atmosphère">
          {venus && <Switch checked={venusAtmosphere ?? atmospheres} onChange={onVenusAtmosphere} label="Atmosphère de Vénus" hint="Couche nuageuse et diffusion de la lumière." />}
          {mars && <Switch checked={marsAtmosphere ?? atmospheres} onChange={onMarsAtmosphere} label="Atmosphère de Mars" hint="Diffusion atmosphérique autour de la planète." />}
        </Group>
      )}

      {/* Relief en volume des astres dont le serveur sert les altitudes (Lune : LOLA ; Mars : MOLA + HRSC ; Mercure :
          MESSENGER ; Vénus : GTDR Magellan). C'est le même réglage que le « Relief 3D » de la Terre : un seul interrupteur pour tous les astres. */}
      {RELIEF_BODIES.includes(bodyId) && (
        <Group title="Cartographie en relief">
          <Switch checked={Boolean(relief)} onChange={onRelief} label="Relief 3D" hint="Cratères, volcans et bassins en volume, d’après les altitudes mesurées ; décoché : carte à plat, plus rapide" />
        </Group>
      )}

      {bodyId === 'moon' && (
        <Group title="Repères lunaires">
          <Switch checked={moonPlaces} onChange={onMoonPlaces} label="Lieux de la Lune" hint="Alunissages (Apollo, Chang’e…), mers, cratères" />
        </Group>
      )}
    </section>
  );
}
