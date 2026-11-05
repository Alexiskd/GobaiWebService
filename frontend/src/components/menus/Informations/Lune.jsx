import { Group } from '../../ui/Group';
import { Hint } from '../../ui/Hint';
import { Radio } from '../../ui/Radio';
import { Switch } from '../../ui/Switch';
import { DisplayGroup } from './DisplayGroup';
import { TileStatus } from './TileStatus';

/** Menu « Lune » : fond de carte (réel ou NASA), calques lunaires et affichage. */
export function Lune({
  hud, moonLayers, moonBaseId, onMoonBase, moonRealAvailable, moonColorOk, listStatus,
  moonModel, onMoonModel, moonModelHint, shadowcam, onShadowcam, shadowcamHint,
  moonFeatures, onMoonFeatures, moonOrbiters, onMoonOrbiters, shade, onShade,
}) {
  const moonBases = moonLayers.filter((l) => l.kind !== 'overlay');

  return (
    <>
      <Group title="Fond de carte · Lune">
        {listStatus === 'loading' ? (
          <Hint>Chargement des fonds…</Hint>
        ) : moonRealAvailable ? (
          <Hint>
            <strong>Lune réelle</strong> : couleurs naturelles (NASA SVS) et détail de plus en plus fin en zoomant (Kaguya, jusqu’à ≈ 20 m).
            {moonColorOk === false ? ' Couleurs indisponibles : gris neutre.' : ''}
          </Hint>
        ) : (
          <Hint>Relief de la Lune indisponible : sphère aux couleurs naturelles seule.</Hint>
        )}
        {moonRealAvailable && (
          <Radio
            name="moon-base"
            checked={moonBaseId === 'real'}
            onChange={() => onMoonBase?.('real')}
            label="Lune réelle"
            description="Couleurs naturelles NASA SVS · détail Kaguya en zoomant"
          />
        )}
        {moonBases.map((l) => (
          <Radio key={l.id} name="moon-base" checked={moonBaseId === l.id} onChange={() => onMoonBase?.(l.id)} label={l.label} description={l.description} />
        ))}
      </Group>

      <Group title="Calques">
        <Switch checked={moonModel} onChange={onMoonModel} label="Modèle 3D NASA" hint={moonModelHint} />
        <Switch checked={shadowcam} onChange={onShadowcam} label="Pôles vus par Danuri" hint={shadowcamHint} />
        <Switch checked={moonFeatures} onChange={onMoonFeatures} label="Lieux de la Lune" hint="Alunissages (Apollo, Chang’e…), mers, cratères" />
        <Switch checked={moonOrbiters} onChange={onMoonOrbiters} label="Sondes en orbite" hint="LRO, Chandrayaan-2, Danuri, CAPSTONE · JPL Horizons" />
      </Group>

      <DisplayGroup shade={shade} onShade={onShade} />
      <TileStatus hud={hud} source="moonTiles" label="Lune" warmup />
    </>
  );
}
