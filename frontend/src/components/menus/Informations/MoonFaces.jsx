import { Section } from '../../ui/Section';

export function MoonFaces({ onSide }) {
  return (
    <Section title="Faces de la Lune">
      <div className="ac-segmented" role="group" aria-label="Face de la Lune">
        <button type="button" className="ac-btn" onClick={() => onSide?.('near')}>Face visible</button>
        <button type="button" className="ac-btn" onClick={() => onSide?.('far')}>Face cachée</button>
      </div>
    </Section>
  );
}
