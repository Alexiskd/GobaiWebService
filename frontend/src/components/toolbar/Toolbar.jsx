import { useViewport } from '@/hooks/useViewport';
import { CompactToolbar } from './CompactToolbar';
import { DesktopToolbar } from './DesktopToolbar';
import { toolbarActions } from './toolbarActions';

// Barre d’outils du bas : version ordinateur sur grand écran, version compacte sur petit écran.
export function Toolbar({
  hud, auto, tilt, layersOpen, bodySelected = true,
  citySelected, pointCloudOpen, onPointClouds,
  contributionOpen, onContributions,
  lidarOpen, lidarCount, onLidar,
  onSearch, onToggleLayers, onToggleAuto, onToggleTilt, onReset, onHelp, onDonate,
  sound = true, onToggleSound,
}) {
  const { compact } = useViewport();
  const actions = toolbarActions({
    layersOpen, bodySelected, citySelected, pointCloudOpen, contributionOpen, lidarOpen, lidarCount, auto, tilt, sound,
    onSearch, onToggleLayers, onReset, onPointClouds, onContributions, onLidar, onToggleAuto, onToggleTilt, onToggleSound, onHelp, onDonate,
  });
  return compact ? <CompactToolbar hud={hud} actions={actions} /> : <DesktopToolbar hud={hud} actions={actions} />;
}
