import { Group } from '../../ui/Group';
import { Hint } from '../../ui/Hint';
import { Radio } from '../../ui/Radio';

/** Fonds d'une planète cartographiée (Mars, Mercure, Vénus) : même structure, une seule implémentation. */
export function PlanetBases({ label, groupName, layers, baseId, onBase, listStatus }) {
  const bases = layers.filter((l) => l.kind !== 'overlay');
  return (
    <Group title={`Fond de carte · ${label}`}>
      {bases.map((l) => (
        <Radio key={l.id} name={groupName} checked={baseId === l.id} onChange={() => onBase?.(l.id)} label={l.label} description={l.description} />
      ))}
      {bases.length === 0 && listStatus === 'loading' && <Hint>Chargement des fonds…</Hint>}
      {bases.length === 0 && listStatus === 'ready' && <Hint>Aucune carte de {label} proposée par le fournisseur.</Hint>}
    </Group>
  );
}
