import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';
import { Orbiter } from './Orbiter';

export function MoonOrbiters({ orbiters, source, onSelect }) {
  return (
    <Section title="Sondes en orbite">
      {orbiters.length === 0 ? (
        <Hint>Chargement des positions (JPL Horizons)…</Hint>
      ) : (
        <ul className="ac-orbiters">
          {orbiters.map((o) => <Orbiter key={o.id} o={o} onSelect={onSelect} />)}
        </ul>
      )}
      {source && <Hint>Positions : {source}</Hint>}
    </Section>
  );
}
