import { DisplayGroup } from './DisplayGroup';
import { PlanetBases } from './PlanetBases';
import { TileStatus } from './TileStatus';

/** Menu « Vénus » : fonds de carte, affichage et état des tuiles. */
export function Venus({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  return (
    <>
      <PlanetBases groupName="venus-base" label="Vénus" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      <DisplayGroup shade={shade} onShade={onShade} />
      <TileStatus hud={hud} source="venusTiles" label="Vénus" />
    </>
  );
}
