import { Readout } from '../hud/Readout';
import { Plus } from '../menus/Plus';
import { ToolbarButton } from './ToolbarButton';

// Petit écran : actions principales visibles, le reste dans le menu « Plus ».
export function CompactToolbar({ hud, actions }) {
  return (
    <>
      <Readout hud={hud} />
      <div className="toolbar toolbar-compact" role="toolbar" aria-label="Actions">
        {actions.filter((a) => a.primary).map((a) => <ToolbarButton key={a.id} action={a} compact />)}
        <Plus actions={actions.filter((a) => !a.primary)} />
      </div>
    </>
  );
}
