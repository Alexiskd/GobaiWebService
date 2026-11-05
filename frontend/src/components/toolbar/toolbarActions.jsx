// Actions de la barre d’outils. `primary` = toujours visible ; les autres passent dans « Plus » sur petit écran.
// `group` = bloc de la barre ordinateur, séparés par un trait vertical.
export function toolbarActions({
  layersOpen, bodySelected, citySelected, pointCloudOpen, contributionOpen, lidarOpen, lidarCount = 0, auto, tilt, sound,
  onSearch, onToggleLayers, onReset, onPointClouds, onContributions, onLidar, onToggleAuto, onToggleTilt, onToggleSound, onHelp,
}) {
  return [
    { id: 'search', group: 'explore', icon: '⌕', label: 'Rechercher', primary: true, onClick: onSearch, title: 'Rechercher une ville ou un astre (Ctrl K)', kbd: 'Ctrl K' },
    { id: 'info', group: 'explore', icon: 'ⓘ', label: 'Informations', short: 'Infos', primary: true, pressed: layersOpen, disabled: !bodySelected, onClick: onToggleLayers, title: bodySelected ? 'Informations sur l’astre (L)' : 'Choisissez une planète pour afficher ses informations' },
    { id: 'reset', group: 'explore', icon: '◎', label: 'Vue globale', short: 'Global', primary: true, onClick: onReset, title: 'Retour à la vue d’ensemble (0 du pavé numérique)' },
    { id: 'cloud', group: 'data', icon: '▦', label: 'Tuile 3D', pressed: pointCloudOpen, disabled: !citySelected, onClick: onPointClouds, title: citySelected ? 'Ouvrir le nuage 3D de cette ville' : 'Choisissez une ville pour ouvrir ses nuages' },
    onLidar && { id: 'lidar', group: 'data', icon: '◍', label: lidarCount ? `LiDAR (${lidarCount})` : 'LiDAR', short: 'LiDAR', pressed: lidarOpen, onClick: onLidar, title: 'Afficher des nuages LAS / LAZ sur le globe' },
    { id: 'contrib', group: 'data', icon: '⇪', label: 'Contribuer', pressed: contributionOpen, onClick: onContributions, title: 'Importer et évaluer des nuages de points' },
    { id: 'auto', group: 'camera', icon: '↻', label: 'Rotation', pressed: auto, onClick: onToggleAuto, title: 'Rotation automatique' },
    { id: 'tilt', group: 'camera', icon: '◢', label: 'Vue 3/4', pressed: tilt, onClick: onToggleTilt, title: 'Vue 3/4 automatique en approchant du sol' },
    onToggleSound && { id: 'sound', group: 'help', icon: '♪', label: sound ? 'Son activé' : 'Son coupé', short: 'Son', iconOnly: true, pressed: sound, noSound: true, onClick: onToggleSound, title: sound ? 'Couper le son des clics' : 'Activer le son des clics' },
    onHelp && { id: 'help', group: 'help', icon: '?', label: 'Aide', iconOnly: true, onClick: onHelp, title: 'Raccourcis clavier (?)' },
  ].filter(Boolean);
}
