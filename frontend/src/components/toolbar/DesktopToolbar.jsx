import { Readout } from '../hud/Readout';
import { ToolbarButton } from './ToolbarButton';

// Ordinateur / laptop : une seule ligne alignée, groupes séparés, indicateur de zoom intégré à gauche.
export function DesktopToolbar({ hud, actions }) {
  const groups = ['explore', 'data', 'camera', 'help']
    .map((g) => actions.filter((a) => a.group === g))
    .filter((list) => list.length);

  return (
    <div className="toolbar toolbar-desktop" role="toolbar" aria-label="Actions">
      <Readout hud={hud} />
      {groups.map((list, gi) => (
        <div key={list[0].group} className="tool-group" role="group" aria-label={list[0].group}>
          {gi > 0 && <span className="tool-sep" aria-hidden="true" />}
          {list.map((a) => <ToolbarButton key={a.id} action={a} compact={false} />)}
        </div>
      ))}
    </div>
  );
}
