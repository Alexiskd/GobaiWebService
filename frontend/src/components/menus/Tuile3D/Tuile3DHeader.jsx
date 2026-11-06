import { PanelHeader } from '../../ui/PanelHeader';

export function Tuile3DHeader({ name, onClose }) {
  return <PanelHeader kicker="Tuile urbaine · Potree" title={name} onClose={onClose} closeLabel="Fermer le nuage 3D" />;
}
