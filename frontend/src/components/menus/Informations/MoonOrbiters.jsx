import { Stack } from '@mui/material';
import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';
import { Orbiter } from './Orbiter';

export function MoonOrbiters({ orbiters, source, onSelect }) {
  return (
    <Section title="Sondes en orbite">
      {orbiters.length === 0 ? (
        <Hint>Chargement des positions (JPL Horizons)…</Hint>
      ) : (
        <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {orbiters.map((o) => <Orbiter key={o.id} o={o} onSelect={onSelect} />)}
        </Stack>
      )}
      {source && <Hint>Positions : {source}</Hint>}
    </Section>
  );
}
