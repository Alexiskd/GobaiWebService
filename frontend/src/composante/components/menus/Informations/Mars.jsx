// Importe la liste des fonds de carte d'une planète.
import { PlanetBases } from './PlanetBases';
// Importe la ligne d'état des tuiles.
import { TileStatus } from './TileStatus';

/** Menu « Mars » : fonds de carte, affichage et état des tuiles. */
// Déclare et exporte le composant Mars : HUD, calques, fond choisi, rappel de choix, statut de la liste et ombrage.
export function Mars({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  // Début du rendu.
  return (
    // Fragment : regroupe les deux blocs.
    <>
      {/* Les fonds de carte de Mars. */}
      <PlanetBases groupName="mars-base" label="Mars" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      {/* L'état des tuiles de Mars. */}
      <TileStatus hud={hud} source="marsTiles" label="Mars" />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Mars.
}
