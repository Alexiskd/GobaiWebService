// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe Section, la section d'un panneau.
import { Section } from '../../ui/Section';
// Importe Facts, la liste des caractéristiques.
import { Facts } from './Facts';
// Importe les sections propres à la Lune.
import { MoonExtras } from './MoonExtras';

/** Composante adaptative : recherche de lieux, fiche et sections du panneau « en direct ». */
// Déclare et exporte le composant BodyPlacesInfo : la vue de l'astre, les rappels et le composant de recherche.
export function BodyPlacesInfo({ view, handlers, Search }) {
  // Extrait de la vue tout ce qui sert à l'affichage.
  const { id, name, places, placeholder, remote, onPick, facts, moon, phases } = view;

  // Début du rendu.
  return (
    // Fragment : regroupe les sections.
    <>

      {/* Section de recherche. */}
      <Section title="Rechercher un lieu">
        {/* S'il y a des lieux (début). */}
        {places.length > 0 ? (
          // Le champ de recherche, recréé à chaque changement d'astre ; 20 résultats avec la recherche distante, 8 sinon.
          <Search key={id} places={places} remote={remote} onPick={onPick} placeholder={placeholder} max={remote ? 20 : 8} />
        // Sinon (début).
        ) : (
          // Une note : aucun lieu pour cet astre.
          <Hint>Aucun lieu répertorié pour {name}.</Hint>
        // Fin du choix.
        )}
        {/* S'il y a des lieux (début). */}
        {places.length > 0 && (
          // Note d'aide (début de la balise).
          <Hint>
            {/* Si un lieu peut être choisi… */}
            {onPick
              // … l'invitation à en choisir un…
              ? 'Choisissez un lieu pour y placer la caméra.'
              // … sinon l'avertissement « lecture seule ».
              : `Repères en lecture seule : la surface de ${name} n’est pas cartographiée dans cette vue.`}
          {/* Fin de la note. */}
          </Hint>
        // Fin du cas.
        )}
      {/* Fin de la section de recherche. */}
      </Section>

      {/* S'il y a des caractéristiques (début). */}
      {facts.length > 0 && (
        // Section titrée.
        <Section title="Caractéristiques">
          {/* La liste des caractéristiques. */}
          <Facts items={facts} />
        {/* Fin de la section. */}
        </Section>
      // Fin du cas.
      )}

      {/* Pour la Lune : ses sections propres. */}
      {moon && <MoonExtras moon={moon} phases={phases} handlers={handlers} />}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de BodyPlacesInfo.
}
