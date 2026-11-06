import { ToggleButton, ToggleButtonGroup } from '@mui/material';

// Choix du classement du flux : tendances (« hot ») ou recommandations pour l'utilisateur.
export function FeedTabs({ feedMode, compact, onChange }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      fullWidth={compact}
      color="primary"
      value={feedMode}
      onChange={(_, mode) => { if (mode) onChange(mode); }}
      aria-label="Mode de classement"
    >
      <ToggleButton value="hot">{compact ? 'Tendances' : 'Tendances · Hot'}</ToggleButton>
      <ToggleButton value="recommended">{compact ? 'Pour vous' : 'Pour vous · voisins'}</ToggleButton>
    </ToggleButtonGroup>
  );
}
