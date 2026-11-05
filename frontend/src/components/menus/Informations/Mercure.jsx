import { DisplayGroup } from './DisplayGroup';
import { PlanetBases } from './PlanetBases';
import { TileStatus } from './TileStatus';

/** Menu « Mercure » : fonds de carte, affichage et état des tuiles. */
export function Mercure({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  return (
    <>
      <PlanetBases groupName="mercury-base" label="Mercure" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      <DisplayGroup shade={shade} onShade={onShade} />
      <TileStatus hud={hud} source="mercuryTiles" label="Mercure" />
    </>
  );
}
