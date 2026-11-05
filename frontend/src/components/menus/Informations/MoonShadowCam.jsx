import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';
import { ShadowCamTile } from './ShadowCamTile';

export function MoonShadowCam({ items, onGoMoon }) {
  if (!items.length) return null;
  return (
    <Section title="Pôles vus par Danuri (ShadowCam)">
      <Hint>Fond des cratères jamais éclairés par le Soleil, photographié dans la lumière renvoyée par les reliefs voisins.</Hint>
      {['south', 'north'].map((pole) => {
        const list = items.filter((s) => s.pole === pole);
        if (!list.length) return null;
        return (
          <div key={pole} className="ac-section">
            <h4 className="ac-subtitle">{pole === 'south' ? 'Pôle Sud' : 'Pôle Nord'}</h4>
            <ul className="ac-tiles">
              {list.map((s) => <ShadowCamTile key={s.id} site={s} onGoMoon={onGoMoon} />)}
            </ul>
          </div>
        );
      })}
    </Section>
  );
}
