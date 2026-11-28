import { AstresAffiches } from './AstresAffiches.jsx';
import { AllerAUnAstre } from './AllerAUnAstre.jsx';
import { EntrainementIA } from './EntrainementIA.jsx';
import { CatalogueAstres } from '../Astres/CatalogueAstres.jsx';

/**
 * Contenu des paramètres : une seule page : astres (familles affichées, aller à un astre, catalogue) et lien « Entraînement IA » vers gobaispace.info.
 * Il n'a plus de fenêtre propre : c'est l'onglet « Paramètres » de la fenêtre Node (hud/node/Attribution). Les pages
 * « Général » (Ma position, pilotage au téléphone) et « Affichage » ont été supprimées ; « Ma position » vit sous la navball.
 */
export function Parametres({
  onClose, bodies, onBodyShown, focus, onSelect, kinds, onKind,
  engineRef,
}) {
  const pick = (index) => { onSelect?.(index); onClose?.(); };

  return (
    <div className="max-w-225 mx-auto">
      <div className="flex flex-col gap-3">
        <AstresAffiches kinds={kinds} onKind={onKind} />
        <EntrainementIA />
        <AllerAUnAstre bodies={bodies} focus={focus} onPick={pick} onShown={onBodyShown} />
        <CatalogueAstres bodies={bodies} onSelect={onSelect} onBodyShown={onBodyShown} onDone={onClose} engineRef={engineRef} />
      </div>
    </div>
  );
}
