import { DisplayGroup } from './DisplayGroup';
import { PlanetBases } from './PlanetBases';
import { TileStatus } from './TileStatus';

/** Menu « Mars » : fonds de carte, affichage et état des tuiles. */
export function Mars({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  return (
    <>
      <PlanetBases groupName="mars-base" label="Mars" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      <DisplayGroup shade={shade} onShade={onShade} />
      <TileStatus hud={hud} source="marsTiles" label="Mars" />
    </>
  );
}
