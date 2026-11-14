// Importe le choix de la face de la Lune.
import { MoonFaces } from './MoonFaces';
// Importe la liste des prochaines phases.
import { MoonPhases } from './MoonPhases';

/** Sections lunaires : faces et phases. Les planètes n’en affichent aucune. */
// Déclare et exporte le composant MoonExtras : les phases et les rappels.
export function MoonExtras({ phases, handlers }) {
  // Début du rendu.
  return (
    // Fragment : regroupe les deux sections.
    <>
      {/* Les faces de la Lune. */}
      <MoonFaces onSide={handlers.onSide} />
      {/* Les prochaines phases. */}
      <MoonPhases phases={phases} />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de MoonExtras.
}
