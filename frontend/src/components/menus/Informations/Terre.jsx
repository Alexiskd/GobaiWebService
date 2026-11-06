import { Group } from '../../ui/Group';
import { Hint } from '../../ui/Hint';
import { Radio } from '../../ui/Radio';
import { Switch } from '../../ui/Switch';
import { DisplayGroup } from './DisplayGroup';
import { EarthStatus } from './EarthStatus';

/** Menu « Terre » : fond de carte, calques (villes, pays, frontières, littoraux, routes) et affichage. */
export function Terre({
  hud, layers, baseId, onBase, listStatus, listError,
  roads, onRoads, roadsHint, shade, onShade, borders, onBorders, bordersHint, coasts, onCoasts,
  countryNames, onCountryNames, cityNames, onCityNames, cityNamesHint, cityNamesDisabled, gps, onGps,
}) {
  const bases = layers.filter((l) => l.kind !== 'overlay');

  return (
    <>
      <Group title="Fond de carte · Terre">
        {bases.map((l) => (
          <Radio
            key={l.id}
            name="earth-base"
            checked={baseId === l.id}
            onChange={() => onBase?.(l.id)}
            label={l.label}
            description={`${l.description || ''}${l.experimental ? ' (expérimental)' : ''}`}
          />
        ))}
        {bases.length === 0 && <Hint>{listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond proposé par le fournisseur.'}</Hint>}
      </Group>

      <Group title="Calques">
        <Switch checked={cityNames} disabled={cityNamesDisabled} onChange={onCityNames} label="Noms des villes" hint={cityNamesHint} />
        <Switch checked={countryNames} onChange={onCountryNames} label="Noms des pays" hint="À plat sur l’écran, dans leur alphabet local, visibles en zoomant" />
        <Switch checked={borders} onChange={onBorders} label="Frontières des pays" hint={bordersHint} />
        <Switch checked={coasts} onChange={onCoasts} label="Littoraux" hint="Bord de mer, océans et Caspienne" />
        <Switch checked={roads} disabled={Boolean(roadsHint)} onChange={onRoads} label="Routes et noms" hint={roadsHint} />
        <Switch checked={gps} onChange={onGps} label="Coordonnées GPS" hint="Coins de l’écran, centre et échelle ; précision selon le zoom (touche G)" />
      </Group>

      <DisplayGroup shade={shade} onShade={onShade} />
      <EarthStatus hud={hud} listStatus={listStatus} listError={listError} />
    </>
  );
}
