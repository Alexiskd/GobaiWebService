import { List, ListItem, ListItemText, Typography } from '@mui/material';
import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';

const dateLabel = (utc) => {
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function MoonPhases({ phases }) {
  if (!phases?.items?.length) return null;
  return (
    <Section title="Prochaines phases">
      <List dense disablePadding component="ol">
        {phases.items.map((p) => (
          <ListItem key={p.utc} disableGutters secondaryAction={(
            <Typography component="time" variant="body2" color="text.secondary" dateTime={p.utc}>{dateLabel(p.utc)}</Typography>
          )}>
            <ListItemText primary={p.phase} />
          </ListItem>
        ))}
      </List>
      {phases.source && <Hint>Source : {phases.source}</Hint>}
    </Section>
  );
}
