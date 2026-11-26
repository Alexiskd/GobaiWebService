// Importe la liste des fonds de carte d'une planète.
import { PlanetBases } from './PlanetBases.jsx';
// Importe la ligne d'état des tuiles.
import { TileStatus } from '../couches/TileStatus.jsx';

/** Menu « Vénus » : fonds de carte (Venus Trek, USGS), affichage et état des tuiles. */
// Déclare et exporte le composant Venus : HUD, calques, fond choisi, rappel de choix, statut de la liste et ombrage.
export function Venus({ hud, layers, baseId, onBase, listStatus, shade, onShade }) {
  // Début du rendu.
  return (
    // Fragment : regroupe les deux blocs.
    <>
      {/* Les fonds de carte de Vénus. */}
      <PlanetBases groupName="venus-base" label="Vénus" layers={layers} baseId={baseId} onBase={onBase} listStatus={listStatus} />
      {/* L'état des tuiles de Vénus. */}
      <TileStatus hud={hud} source="venusTiles" label="Vénus" />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Venus.
}
