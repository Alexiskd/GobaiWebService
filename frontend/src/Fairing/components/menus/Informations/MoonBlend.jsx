import { Group } from '../../ui/Group.jsx';
import { Hint } from '../../ui/Hint.jsx';

/** Le blend dépendait d'un service de fabrication et d'un stockage backend : désactivé en mode statique. */
export function MoonBlend() {
  return (
    <Group title="Blend · Lune">
      <Hint>Le service de fabrication et de stockage du blend est désactivé. La Lune utilise les ressources et le rendu locaux de Gobai Space.</Hint>
    </Group>
  );
}
