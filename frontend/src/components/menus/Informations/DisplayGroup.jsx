import { Group } from '../../ui/Group';
import { Switch } from '../../ui/Switch';

export function DisplayGroup({ shade, onShade }) {
  return (
    <Group title="Affichage">
      <Switch checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
    </Group>
  );
}
