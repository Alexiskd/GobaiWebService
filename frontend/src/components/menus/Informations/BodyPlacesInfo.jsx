import { Hint } from '../../ui/Hint';
import { Section } from '../../ui/Section';
import { AdaptiveStyles } from './AdaptiveStyles';
import { Facts } from './Facts';
import { MoonExtras } from './MoonExtras';

/** Composante adaptative : recherche de lieux, fiche et sections du panneau « en direct ». */
export function BodyPlacesInfo({ view, handlers, Search }) {
  const { id, name, places, placeholder, onPick, facts, moon, phases } = view;

  return (
    <div className="ac">
      <AdaptiveStyles />

      <Section title="Rechercher un lieu">
        {places.length > 0 ? (
          <Search key={id} places={places} onPick={onPick} placeholder={placeholder} />
        ) : (
          <Hint>Aucun lieu répertorié pour {name}.</Hint>
        )}
        {places.length > 0 && (
          <Hint>
            {onPick
              ? 'Choisissez un lieu pour y placer la caméra.'
              : `Repères en lecture seule : la surface de ${name} n’est pas cartographiée dans cette vue.`}
          </Hint>
        )}
      </Section>

      {facts.length > 0 && (
        <Section title="Caractéristiques">
          <Facts items={facts} />
        </Section>
      )}

      {moon && <MoonExtras moon={moon} phases={phases} handlers={handlers} />}
    </div>
  );
}
