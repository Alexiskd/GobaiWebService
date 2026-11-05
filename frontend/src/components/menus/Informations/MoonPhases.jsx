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
      <ol className="ac-rows">
        {phases.items.map((p) => (
          <li className="ac-row" key={p.utc}>
            <span>{p.phase}</span>
            <time className="ac-row-value" dateTime={p.utc}>{dateLabel(p.utc)}</time>
          </li>
        ))}
      </ol>
      {phases.source && <Hint>Source : {phases.source}</Hint>}
    </Section>
  );
}
