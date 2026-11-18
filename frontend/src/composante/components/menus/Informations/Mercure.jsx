// Importe la liste des fonds de carte d'une planète.
import { PlanetBases } from './PlanetBases';
// Importe la ligne d'état des tuiles.
import { TileStatus } from './TileStatus';

/** Menu « Mercure » : fonds de carte, affichage et état des tuiles. */
// Déclare et exporte le composant Mercure : HUD, calques, fond choisi, rappel de choix, statut de la liste et ombrage.
export function Mercure({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  // Début du rendu.
  return (
    // Fragment : regroupe les deux blocs.
    <>
      {/* Les fonds de carte de Mercure. */}
      <PlanetBases groupName="mercury-base" label="Mercure" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      {/* L'état des tuiles de Mercure. */}
      <TileStatus hud={hud} source="mercuryTiles" label="Mercure" />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Mercure.
}
