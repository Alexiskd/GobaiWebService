// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe le squelette de chargement.
import { LayerSkeleton } from '../../ui/LayerSkeleton';
// Importe Radio, l'option d'un fond de carte.
import { Radio } from '../../ui/Radio';
// Importe layerSource, qui donne la source d'un calque.
import { layerSource } from './layerSource';

/** Fonds d'une planète cartographiée (Mars, Mercure, Vénus) : même structure, une seule implémentation. */
// Déclare et exporte le composant PlanetBases : nom, groupe radio, calques, fond choisi, rappel et statut de la liste.
export function PlanetBases({ label, groupName, layers, baseId, onBase, listStatus }) {
  // Les fonds : les calques qui ne sont pas des calques superposés.
  const bases = layers.filter((l) => l.kind !== 'overlay');
  // Début du rendu.
  return (
    // Groupe titré « Fond de carte », suivi du nom de l'astre.
    <Group title={`Fond de carte · ${label}`}>
      {/* Une option par fond (début). */}
      {bases.map((l) => (
        // L'option : cochée si c'est le fond choisi, avec sa source, sa description et son téléchargement.
        <Radio key={l.id} name={groupName} checked={baseId === l.id} onChange={() => onBase?.(l.id)} label={l.label} source={layerSource(l)} download={{ layerId: l.id, body: label }} description={l.description} />
      // Fin des options.
      ))}
      {/* Aucun fond pendant le chargement : le squelette. */}
      {bases.length === 0 && listStatus === 'loading' && <LayerSkeleton />}
      {/* Aucun fond une fois la liste prête : une note qui le dit. */}
      {bases.length === 0 && listStatus === 'ready' && <Hint>Aucune carte de {label} proposée par le fournisseur.</Hint>}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de PlanetBases.
}
